import { useState, useEffect, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import { Product, StoreSettings, CartItem, SyncState } from './types';
import {
  getLocalStoreSettings,
  saveLocalStoreSettings,
  loadStoreSettingsFromIndexedDB,
  INITIAL_STORE_SETTINGS,
  isAuthorizedAdminEmail,
} from './services/storage';
import {
  testFirestoreConnection,
  subscribeToStoreSettings,
  saveStoreSettingsToFirestore,
  warmUpSavedProductsCache,
  onAuthChanged,
  logoutUser,
  auth,
} from './services/firebase';
import {
  isSupabaseConfigured,
  testSupabaseConnection,
  getSupabaseClient,
  initSupabaseGlobalConfig,
} from './services/supabase';
import { fetchProductsFromSupabase } from './services/products';
import { fetchBannerFromSupabase, saveBannerToSupabase } from './services/banners';
import { fetchStoreSettingsFromSupabase, saveStoreSettingsToSupabase } from './services/settings';
import { fetchCategoriesFromSupabase, saveCategoriesToSupabase } from './services/categories';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { ProductCatalog } from './components/ProductCatalog';
import { CartDrawer } from './components/CartDrawer';
import { AdminModal } from './components/AdminModal';
import { Footer } from './components/Footer';

const CART_STORAGE_KEY = 'wh_store_cart_v1';
const FAVORITES_STORAGE_KEY = 'wh_store_favorites_v1';

export default function App() {
  // Store Settings (products, whatsapp, banner)
  const [settings, setSettings] = useState<StoreSettings>(() => getLocalStoreSettings());
  const [syncState, setSyncState] = useState<SyncState>('syncing');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Favorites / Wishlist State
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // UI Drawers & Modals
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Auth User
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Save Favorites to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
    } catch (err) {
      console.warn('Erro ao salvar favoritos no LocalStorage:', err);
    }
  }, [favorites]);

  // Save Cart to LocalStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.warn('Erro ao salvar sacola no LocalStorage:', err);
    }
  }, [cart]);

  // Keep ref to latest settings to avoid re-triggering auth effects
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Auth Listener with strict authorized email enforcement (runs once on mount)
  useEffect(() => {
    const unsubscribeAuth = onAuthChanged(async (user) => {
      if (user && user.email) {
        if (!isAuthorizedAdminEmail(user.email, settingsRef.current)) {
          console.warn(`Tentativa de acesso com e-mail não autorizado: ${user.email}. Desconectando.`);
          try {
            await logoutUser();
          } catch (e) {
            console.error('Erro ao desconectar usuário não autorizado:', e);
          }
          setCurrentUser(null);
          return;
        }

        // Authorized admin connected
        setCurrentUser(user);
        return;
      }
      setCurrentUser(user);
    });
    return () => unsubscribeAuth();
  }, []);

  // Firestore Sync & Connection Boot
  useEffect(() => {
    let isMounted = true;

    // Warm up cache with initial loaded local products
    warmUpSavedProductsCache(settings);

    // Asynchronously hydrate from IndexedDB (preserves high-res photos without quota limits)
    loadStoreSettingsFromIndexedDB().then((idbSettings) => {
      if (!isMounted || !idbSettings) return;
      setSettings((prev) => {
        const hasIdbProducts = Array.isArray(idbSettings.products) && idbSettings.products.length > 0;
        if (!hasIdbProducts) return prev;

        const prevMissingImages = prev.products.some(
          (p) => !p.image && idbSettings.products.some((ip) => ip.id === p.id && ip.image)
        );

        const isIdbNewer = idbSettings.updatedAt
          ? !prev.updatedAt || idbSettings.updatedAt >= prev.updatedAt
          : false;

        if (prevMissingImages || isIdbNewer) {
          warmUpSavedProductsCache(idbSettings);
          return idbSettings;
        }
        return prev;
      });
    });

    async function initCloudSync() {
      // 0. Sincroniza configurações globais salvas no servidor para todos os dispositivos
      try {
        await initSupabaseGlobalConfig();
      } catch (cfgErr) {
        console.warn('[CloudSync] Não foi possível verificar credenciais no servidor:', cfgErr);
      }

      // 1. Try Supabase first if credentials are configured
      if (isSupabaseConfigured()) {
        setSyncState('supabase_syncing');
        const testRes = await testSupabaseConnection();

        if (isMounted && testRes.ok) {
          try {
            const [sbProducts, sbBanner, sbSettings, sbCategories] = await Promise.all([
              fetchProductsFromSupabase(),
              fetchBannerFromSupabase(),
              fetchStoreSettingsFromSupabase(),
              fetchCategoriesFromSupabase(),
            ]);

            if (isMounted) {
              setSettings((prev) => {
                const hasSbProducts = Array.isArray(sbProducts) && sbProducts.length > 0;
                const updated: StoreSettings = {
                  ...prev,
                  ...(hasSbProducts ? { products: sbProducts } : {}),
                  ...(sbBanner ? { banner: sbBanner } : {}),
                  ...(sbSettings?.whatsappNumber ? { whatsappNumber: sbSettings.whatsappNumber } : {}),
                  ...(sbCategories && sbCategories.length > 0 ? { categories: sbCategories } : {}),
                  updatedAt: new Date().toISOString(),
                };
                saveLocalStoreSettings(updated);
                warmUpSavedProductsCache(updated);
                return updated;
              });
              setSyncState('supabase_connected');
            }

            // Setup Realtime listener with Supabase
            const client = getSupabaseClient();
            if (client) {
              const channel = client
                .channel('public:wh_store_sync')
                .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'products' },
                  async () => {
                    const freshProducts = await fetchProductsFromSupabase();
                    if (freshProducts && isMounted) {
                      setSettings((prev) => ({
                        ...prev,
                        products: freshProducts,
                        updatedAt: new Date().toISOString(),
                      }));
                    }
                  }
                )
                .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'banners' },
                  async () => {
                    const freshBanner = await fetchBannerFromSupabase();
                    if (freshBanner && isMounted) {
                      setSettings((prev) => ({
                        ...prev,
                        banner: freshBanner,
                        updatedAt: new Date().toISOString(),
                      }));
                    }
                  }
                )
                .on(
                  'postgres_changes',
                  { event: '*', schema: 'public', table: 'store_settings' },
                  async () => {
                    const freshSettings = await fetchStoreSettingsFromSupabase();
                    if (freshSettings && isMounted) {
                      setSettings((prev) => ({
                        ...prev,
                        ...(freshSettings.whatsappNumber ? { whatsappNumber: freshSettings.whatsappNumber } : {}),
                        ...(freshSettings.adminPin ? { adminPin: freshSettings.adminPin } : {}),
                      }));
                    }
                  }
                )
                .subscribe();

              return () => {
                client.removeChannel(channel);
              };
            }
            return;
          } catch (sbErr) {
            console.warn('[Supabase Sync Error]:', sbErr);
          }
        }
      }

      // 2. Fallback to Firestore if Supabase not configured
      setSyncState('syncing');
      const isConnected = await testFirestoreConnection();

      if (!isMounted) return;

      if (isConnected) {
        setSyncState('connected');
      } else {
        setSyncState('local_fallback');
      }

      // Listen for remote catalog & settings updates in real time
      const unsubscribeFirestore = subscribeToStoreSettings(
        (remoteSettings) => {
          if (!isMounted) return;
          if (
            remoteSettings &&
            Array.isArray(remoteSettings.products) &&
            remoteSettings.products.length > 0
          ) {
            setSettings((prev) => {
              if (prev.updatedAt && remoteSettings.updatedAt) {
                const localTime = new Date(prev.updatedAt).getTime();
                const remoteTime = new Date(remoteSettings.updatedAt).getTime();
                if (localTime > remoteTime) {
                  return prev;
                }
              }

              if (
                prev.updatedAt === remoteSettings.updatedAt &&
                prev.products.length === remoteSettings.products.length
              ) {
                return prev;
              }

              const remoteIds = new Set((remoteSettings.products || []).map((p) => p.id));
              const localUnsyncedProducts = (prev.products || []).filter(
                (p) => !remoteIds.has(p.id)
              );

              const mergedProducts = [...(remoteSettings.products || []), ...localUnsyncedProducts];

              const resolvedSettings: StoreSettings = {
                ...remoteSettings,
                products: mergedProducts,
              };
              saveLocalStoreSettings(resolvedSettings);
              warmUpSavedProductsCache(resolvedSettings);
              return resolvedSettings;
            });
            setSyncState('connected');
          }
        },
        (error) => {
          if (!isMounted) return;
          console.warn('Fallback to local cache:', error);
          setSyncState('local_fallback');
        }
      );

      return () => {
        unsubscribeFirestore();
      };
    }

    const cleanupPromise = initCloudSync();

    return () => {
      isMounted = false;
      cleanupPromise.then((cleanup) => cleanup && cleanup());
    };
  }, []);

  // Save Store Settings (to Supabase, Firestore and LocalStorage) - Instant & Non-blocking
  const handleSaveSettings = useCallback(
    async (newSettings: StoreSettings): Promise<boolean> => {
      const freshSettings: StoreSettings = {
        ...newSettings,
        updatedAt: new Date().toISOString(),
      };

      // 1. Immediate local state update for instantaneous (< 1ms) responsiveness
      setSettings(freshSettings);
      saveLocalStoreSettings(freshSettings);

      const activeUser = currentUser || auth.currentUser;

      // 2. Asynchronous background cloud persistence (Supabase + fallback)
      if (isSupabaseConfigured()) {
        setSyncState('supabase_syncing');
        Promise.all([
          saveStoreSettingsToSupabase(freshSettings),
          saveBannerToSupabase(freshSettings.banner),
          saveCategoriesToSupabase(freshSettings.categories || []),
        ])
          .then(() => setSyncState('supabase_connected'))
          .catch((err) => {
            console.warn('[Supabase Sync Error]:', err);
            setSyncState('local_fallback');
          });
      } else {
        setSyncState('syncing');
        saveStoreSettingsToFirestore(freshSettings, activeUser)
          .then((savedSettings) => {
            if (savedSettings) {
              setSettings(savedSettings);
              saveLocalStoreSettings(savedSettings);
            }
            setSyncState('connected');
          })
          .catch((err) => {
            console.warn('Erro ao sincronizar com nuvem, mantendo no LocalStorage:', err);
            setSyncState('local_fallback');
          });
      }

      // 3. Return true immediately so UI unlocks in milliseconds
      return true;
    },
    [currentUser]
  );

  // Manual Force Sync
  const handleForceSync = useCallback(async () => {
    if (isSupabaseConfigured()) {
      setSyncState('supabase_syncing');
      try {
        const testRes = await testSupabaseConnection();
        if (testRes.ok) {
          const [sbProducts, sbBanner, sbSettings] = await Promise.all([
            fetchProductsFromSupabase(),
            fetchBannerFromSupabase(),
            fetchStoreSettingsFromSupabase(),
          ]);
          if (Array.isArray(sbProducts) && sbProducts.length > 0) {
            setSettings((prev) => ({
              ...prev,
              products: sbProducts,
              ...(sbBanner ? { banner: sbBanner } : {}),
              ...(sbSettings?.whatsappNumber ? { whatsappNumber: sbSettings.whatsappNumber } : {}),
            }));
          }
          setSyncState('supabase_connected');
          return;
        }
      } catch {
        setSyncState('local_fallback');
      }
    }

    setSyncState('syncing');
    try {
      const ok = await testFirestoreConnection();
      const activeUser = currentUser || auth.currentUser;
      if (ok) {
        const freshSettings: StoreSettings = {
          ...settings,
          updatedAt: new Date().toISOString(),
        };
        const savedSettings = await saveStoreSettingsToFirestore(freshSettings, activeUser);
        if (savedSettings) {
          setSettings(savedSettings);
          saveLocalStoreSettings(savedSettings);
        }
        setSyncState('connected');
      } else {
        setSyncState('local_fallback');
      }
    } catch {
      setSyncState('local_fallback');
    }
  }, [settings, currentUser]);

  // Cart Management
  const handleAddToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const handleUpdateQuantity = useCallback(
    (productId: string, quantity: number) => {
      setCart((prev) => {
        if (quantity <= 0) {
          return prev.filter((item) => item.product.id !== productId);
        }
        return prev.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        );
      });
    },
    []
  );

  const handleClearCart = useCallback(() => {
    setCart([]);
  }, []);

  const handleToggleFavorite = useCallback((productId: string) => {
    setFavorites((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  }, []);

  const totalCartCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  const handleScrollToCatalog = () => {
    const el = document.getElementById('catalogo');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOpenFavorites = () => {
    setShowOnlyFavorites(true);
    handleScrollToCatalog();
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black selection:bg-neutral-200 selection:text-black">
      {/* Sticky Header */}
      <Header
        cartCount={totalCartCount}
        favoritesCount={favorites.length}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenFavorites={handleOpenFavorites}
        whatsappNumber={settings.whatsappNumber}
        syncState={syncState}
        onTriggerSync={handleForceSync}
      />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Banner */}
        <HeroBanner
          banner={settings.banner || INITIAL_STORE_SETTINGS.banner}
          onExploreClick={handleScrollToCatalog}
        />

        {/* Product Catalog */}
        <ProductCatalog
          products={settings.products || []}
          onAddToCart={handleAddToCart}
          whatsappNumber={settings.whatsappNumber}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          showOnlyFavorites={showOnlyFavorites}
          onClearFavoritesFilter={() => setShowOnlyFavorites(false)}
        />
      </main>

      {/* Shopping Bag Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onClearCart={handleClearCart}
        whatsappNumber={settings.whatsappNumber}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        currentUser={currentUser}
        syncState={syncState}
        onForceSync={handleForceSync}
      />

      {/* Footer */}
      <Footer
        onOpenAdmin={() => setIsAdminOpen(true)}
        syncState={syncState}
        whatsappNumber={settings.whatsappNumber}
      />
    </div>
  );
}
