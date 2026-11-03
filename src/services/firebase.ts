import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocFromServer,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, StoreSettings, BannerConfig } from '../types';
import { compressBase64Image, createCompactThumbnail, optimizeImageFile } from './imageOptimizer';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const errStr = error instanceof Error ? error.message : String(error);
  const errCode = (error as any)?.code;
  return (
    errCode === 'resource-exhausted' ||
    errStr.includes('resource-exhausted') ||
    errStr.includes('Quota limit exceeded') ||
    errStr.includes('Quota exceeded') ||
    errStr.includes('Free daily write units') ||
    errStr.includes('Free daily read units')
  );
}

const QUOTA_STORAGE_KEY = 'wh_store_firestore_quota_exceeded';

export function isWriteQuotaExhausted(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    sessionStorage.getItem(QUOTA_STORAGE_KEY) === 'true' ||
    localStorage.getItem(QUOTA_STORAGE_KEY) === 'true'
  );
}

export function setWriteQuotaExhausted(exhausted: boolean): void {
  if (typeof window === 'undefined') return;
  if (exhausted) {
    sessionStorage.setItem(QUOTA_STORAGE_KEY, 'true');
    localStorage.setItem(QUOTA_STORAGE_KEY, 'true');
  } else {
    sessionStorage.removeItem(QUOTA_STORAGE_KEY);
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  }
}

export function resetWriteQuotaCircuitBreaker(): void {
  setWriteQuotaExhausted(false);
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 1. Initialize Firebase Apps
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestoreApp = getApps().some((a) => a.name === 'wh_store_firestore')
  ? getApp('wh_store_firestore')
  : initializeApp(firebaseConfig, 'wh_store_firestore');

// Silence internal SDK backoff logs so quota errors don't trigger repeated console alarms
try {
  setLogLevel('silent');
} catch (e) {
  // Ignore
}

// Initialize Firestore with pure in-memory cache so rejected quota writes
// are never queued in browser IndexedDB to retry endlessly on refresh
export const db = initializeFirestore(
  firestoreApp,
  {
    localCache: memoryLocalCache(),
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 2. Initialize Firebase Storage
export const storage = getStorage(
  app,
  firebaseConfig.storageBucket || `${firebaseConfig.projectId}.firebasestorage.app`
);

export const STORE_SETTINGS_DOC_PATH = 'store_config/settings';

/**
 * Validates connection to Firestore at application boot
 */
export async function testFirestoreConnection(): Promise<boolean> {
  if (isWriteQuotaExhausted()) {
    console.info('[Firestore] Cota de gravação em modo de contingência local.');
    return false;
  }
  try {
    const docRef = doc(db, 'store_config', 'settings');
    await getDocFromServer(docRef);
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('Firebase client is offline, using local cache.');
    } else if (isQuotaExceededError(error)) {
      setWriteQuotaExhausted(true);
      console.warn('Firestore quota exceeded. Operando em modo de cache local com armazenamento seguro.');
    } else {
      console.warn('Firestore initial test notice:', error);
    }
    return false;
  }
}

/**
 * Recursively removes all undefined values from an object or array
 * so that Firestore's setDoc() never encounters an "Unsupported field value: undefined" error.
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedFields(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = removeUndefinedFields(value);
      }
    }
    return result as T;
  }
  return obj;
}

// =========================================================================
// 2. FIRESTORE TIMEOUT & CIRCUIT BREAKER
// =========================================================================

const FIRESTORE_WRITE_TIMEOUT_MS = 1800; // 1.8 seconds max per write to prevent SDK backoff stalls

/**
 * Wraps a Firestore write promise with a fail-fast timeout to avoid the SDK's 30s backoff loops
 */
export async function executeFirestoreWrite<T>(
  writePromise: Promise<T>,
  contextName: string
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(
        `Tempo limite esgotado ao gravar no Firestore (${contextName}). Cota diária atingida ou Firestore em backoff.`
      );
      (err as any).code = 'resource-exhausted';
      reject(err);
    }, FIRESTORE_WRITE_TIMEOUT_MS);
  });

  try {
    const res = await Promise.race([writePromise, timeoutPromise]);
    clearTimeout(timer);
    return res;
  } catch (error) {
    clearTimeout(timer);
    if (isQuotaExceededError(error)) {
      setWriteQuotaExhausted(true);
    }
    throw error;
  }
}

// Storage availability circuit breaker
let isStorageReachable = true;
let storageFailureCount = 0;

export function resetStorageCircuitBreaker(): void {
  isStorageReachable = true;
  storageFailureCount = 0;
}

// =========================================================================
// 3. FIREBASE STORAGE: Upload & Management Functions
// =========================================================================

/**
 * Uploads a product image (Base64 dataURL or File) to Firebase Storage
 * and returns the permanent HTTPS download URL.
 * If Storage has permission/bucket errors or times out, falls back safely in < 1.5s
 * so operations and migration are NEVER stuck or delayed.
 */
export async function uploadProductImage(
  dataUrlOrFile: string | File,
  productId: string,
  slotIndex = 0
): Promise<string> {
  if (!dataUrlOrFile) return '';

  // If already an external HTTPS URL (e.g., Unsplash or existing Storage URL), return directly
  if (typeof dataUrlOrFile === 'string' && (dataUrlOrFile.startsWith('http://') || dataUrlOrFile.startsWith('https://'))) {
    return dataUrlOrFile;
  }

  let dataUrl: string;
  if (typeof dataUrlOrFile === 'string') {
    dataUrl = dataUrlOrFile;
  } else {
    const optimized = await optimizeImageFile(dataUrlOrFile, 1800, 0.90);
    dataUrl = optimized.dataUrl;
  }

  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  // If Storage has already failed or timed out multiple times, return local high-res dataUrl immediately
  if (!isStorageReachable) {
    return dataUrl;
  }

  try {
    const cleanId = (productId || 'prod').replace(/[^a-zA-Z0-9_-]/g, '_');
    const path = `products/${cleanId}/slot_${slotIndex}_${Date.now()}.webp`;
    const imageFileRef = storageRef(storage, path);

    const uploadTask = (async () => {
      await uploadString(imageFileRef, dataUrl, 'data_url', {
        contentType: 'image/webp',
      });
      return await getDownloadURL(imageFileRef);
    })();

    let timer: any;
    const timeoutTask = new Promise<string>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firebase Storage timeout (1500ms)')), 1500);
    });

    const downloadUrl = await Promise.race([uploadTask, timeoutTask]);
    clearTimeout(timer);
    storageFailureCount = 0;
    return downloadUrl;
  } catch (storageError) {
    storageFailureCount++;
    if (storageFailureCount >= 2) {
      isStorageReachable = false;
      console.info('[Firebase Storage] Modo local ativo para uploads subsequentes.');
    }
    return dataUrl;
  }
}

/**
 * Uploads a banner image to Firebase Storage and returns the download URL.
 */
export async function uploadBannerImage(dataUrlOrFile: string | File): Promise<string> {
  if (!dataUrlOrFile) return '';

  if (typeof dataUrlOrFile === 'string' && (dataUrlOrFile.startsWith('http://') || dataUrlOrFile.startsWith('https://'))) {
    return dataUrlOrFile;
  }

  let dataUrl: string;
  if (typeof dataUrlOrFile === 'string') {
    dataUrl = dataUrlOrFile;
  } else {
    const optimized = await optimizeImageFile(dataUrlOrFile, 1800, 0.90);
    dataUrl = optimized.dataUrl;
  }

  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  if (!isStorageReachable) {
    return dataUrl;
  }

  try {
    const path = `banners/hero_${Date.now()}.webp`;
    const bannerFileRef = storageRef(storage, path);

    const uploadTask = (async () => {
      await uploadString(bannerFileRef, dataUrl, 'data_url', {
        contentType: 'image/webp',
      });
      return await getDownloadURL(bannerFileRef);
    })();

    let timer: any;
    const timeoutTask = new Promise<string>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firebase Storage timeout (1500ms)')), 1500);
    });

    const downloadUrl = await Promise.race([uploadTask, timeoutTask]);
    clearTimeout(timer);
    return downloadUrl;
  } catch (storageError) {
    isStorageReachable = false;
    return dataUrl;
  }
}

/**
 * Deletes a stored image from Firebase Storage if it's hosted there.
 */
export async function deleteStoredImage(imageUrl: string): Promise<void> {
  if (!imageUrl || !imageUrl.includes('firebasestorage.googleapis.com')) {
    return;
  }
  try {
    const fileRef = storageRef(storage, imageUrl);
    await deleteObject(fileRef);
  } catch (err) {
    console.warn('Firebase Storage deletion notice:', err);
  }
}

// =========================================================================
// 4. INDEPENDENT COLLECTION FUNCTIONS: Products, Banners, StoreSettings
// =========================================================================

// Cache for products already saved to Firestore to prevent redundant re-uploads and re-writes
const savedProductsCache = new Map<string, string>();

export function getProductHash(p: Product): string {
  const imgLen = typeof p.image === 'string' ? p.image.length : 0;
  const imgsCount = Array.isArray(p.images) ? p.images.length : 0;
  return `${p.id}_${p.name}_${p.price}_${p.category}_${p.inStock}_${imgLen}_${imgsCount}_${p.description || ''}`;
}

/**
 * Resolves the admin PIN for write authorization
 */
function resolveAdminPin(customPin?: string): string {
  const backupPin = typeof window !== 'undefined' ? localStorage.getItem('wh_store_admin_pin_backup') : null;
  return (customPin && customPin.trim()) || backupPin || '';
}

/**
 * Saves a single product as an independent document in the 'products' collection.
 * Converts any Base64 images into Firebase Storage URLs so Firestore documents
 * remain ultra-lightweight (~1KB - 2KB) and never hit document size limits.
 */
export async function saveProduct(product: Product, user?: User | null): Promise<Product> {
  const prodId = product.id || `prod-${Date.now()}`;
  const targetPin = resolveAdminPin();

  // 1. Upload main image to Storage if Base64
  let mainImageUrl = product.image || '';
  if (mainImageUrl.startsWith('data:image/')) {
    mainImageUrl = await uploadProductImage(mainImageUrl, prodId, 0);
  }

  // 2. Upload gallery images to Storage if Base64 (with deduplication)
  const rawGallery = Array.isArray(product.images) && product.images.length > 0
    ? product.images.filter(Boolean)
    : (mainImageUrl ? [mainImageUrl] : []);

  const galleryUrls = await Promise.all(
    rawGallery.slice(0, 4).map(async (img, idx) => {
      // If gallery item matches original main image, reuse the already uploaded mainImageUrl
      if (img === product.image && mainImageUrl) {
        return mainImageUrl;
      }
      if (img.startsWith('data:image/')) {
        return uploadProductImage(img, prodId, idx);
      }
      return img;
    })
  );

  const cleanProduct: Record<string, any> = {
    id: prodId,
    name: product.name.trim(),
    category: product.category.trim() || 'Geral',
    price: Number(product.price) || 0,
    image: mainImageUrl || galleryUrls[0] || '',
    images: galleryUrls.length > 0 ? galleryUrls : [mainImageUrl],
    description: product.description || '',
    inStock: product.inStock !== false,
    adminPin: targetPin,
    updatedAt: new Date().toISOString(),
    updatedBy: user?.email || user?.uid || 'lojista-pin',
  };

  if (product.installments?.trim()) {
    cleanProduct.installments = product.installments.trim();
  }
  if (product.video?.trim()) {
    cleanProduct.video = product.video.trim();
  }

  const payload = removeUndefinedFields(cleanProduct);

  try {
    if (isWriteQuotaExhausted()) {
      console.info(`[Offline Contingência] Cota de gravações excedida. Mantendo produto "${cleanProduct.name}" com segurança no LocalStorage.`);
    } else {
      const productRef = doc(db, 'products', prodId);
      await executeFirestoreWrite(setDoc(productRef, payload, { merge: true }), `products/${prodId}`);
    }
    // Register in cache so saveStoreSettingsToFirestore does not re-process this product
    savedProductsCache.set(prodId, getProductHash(cleanProduct as Product));
  } catch (error) {
    if (isQuotaExceededError(error)) {
      setWriteQuotaExhausted(true);
      console.warn(`Firestore Quota limit exceeded ao salvar produto ${prodId}. Salvo localmente.`);
    } else {
      handleFirestoreError(error, OperationType.WRITE, `products/${prodId}`);
    }
  }

  const resultProd: Product = {
    id: prodId,
    name: cleanProduct.name,
    category: cleanProduct.category,
    price: cleanProduct.price,
    image: cleanProduct.image,
    images: cleanProduct.images,
    description: cleanProduct.description,
    inStock: cleanProduct.inStock,
    installments: cleanProduct.installments,
    video: cleanProduct.video,
  };

  savedProductsCache.set(prodId, getProductHash(resultProd));
  return resultProd;
}

/**
 * Deletes a product document from the 'products' collection.
 */
export async function deleteProduct(productId: string, user?: User | null): Promise<void> {
  if (!productId) return;
  savedProductsCache.delete(productId);
  try {
    if (isWriteQuotaExhausted()) {
      console.info(`[Offline Contingência] Cota de gravações excedida. Excluindo produto ${productId} do cache local.`);
    } else {
      const productRef = doc(db, 'products', productId);
      await executeFirestoreWrite(deleteDoc(productRef), `products/${productId}`);
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      setWriteQuotaExhausted(true);
      console.warn(`Firestore Quota limit exceeded ao excluir produto ${productId}.`);
    } else {
      handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
    }
  }
}

/**
 * Loads all products from the 'products' collection.
 */
export async function loadProducts(): Promise<Product[]> {
  try {
    const snap = await getDocs(collection(db, 'products'));
    const products: Product[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data();
      products.push({
        id: docSnap.id,
        name: d.name || '',
        category: d.category || 'Geral',
        price: Number(d.price) || 0,
        image: d.image || '',
        images: Array.isArray(d.images) && d.images.length > 0 ? d.images : (d.image ? [d.image] : []),
        video: d.video || '',
        description: d.description || '',
        inStock: d.inStock !== false,
        installments: d.installments || '',
      });
    });
    return products;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn('Firestore Quota limit exceeded ao carregar produtos.');
      return [];
    }
    handleFirestoreError(error, OperationType.LIST, 'products');
  }
}

/**
 * Saves banner configuration to the independent 'banners/main' document.
 */
export async function saveBanner(banner: BannerConfig, user?: User | null): Promise<BannerConfig> {
  const targetPin = resolveAdminPin();
  let safeImageUrl = banner.image || '';

  if (safeImageUrl.startsWith('data:image/')) {
    safeImageUrl = await uploadBannerImage(safeImageUrl);
  }

  const payload = removeUndefinedFields({
    subtitle: banner.subtitle || '',
    title: banner.title || '',
    description: banner.description || '',
    image: safeImageUrl,
    adminPin: targetPin,
    updatedAt: new Date().toISOString(),
    updatedBy: user?.email || user?.uid || 'lojista-pin',
  });

  try {
    if (isWriteQuotaExhausted()) {
      console.info('[Offline Contingência] Cota de gravações excedida. Mantendo banner no cache local.');
    } else {
      const bannerRef = doc(db, 'banners', 'main');
      await executeFirestoreWrite(setDoc(bannerRef, payload, { merge: true }), 'banners/main');
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      setWriteQuotaExhausted(true);
      console.warn('Firestore Quota limit exceeded ao salvar banner.');
    } else {
      handleFirestoreError(error, OperationType.WRITE, 'banners/main');
    }
  }

  return {
    subtitle: payload.subtitle,
    title: payload.title,
    description: payload.description,
    image: safeImageUrl,
  };
}

/**
 * Loads the current banner from 'banners/main'.
 */
export async function loadBanners(): Promise<BannerConfig | null> {
  try {
    const snap = await getDoc(doc(db, 'banners', 'main'));
    if (snap.exists()) {
      const data = snap.data();
      return {
        subtitle: data.subtitle || '',
        title: data.title || '',
        description: data.description || '',
        image: data.image || '',
      };
    }
    return null;
  } catch (error) {
    console.warn('Notice ao carregar banner:', error);
    return null;
  }
}

/**
 * Saves global store configuration (WhatsApp number, admin PIN, categories, authorized emails)
 * to 'store_config/settings'. This document NEVER contains the products array or raw base64 images,
 * guaranteeing its size is always under 2KB.
 */
export async function saveStoreSettings(
  settings: Partial<StoreSettings>,
  user?: User | null
): Promise<void> {
  const targetPin = resolveAdminPin(settings.adminPin);

  const rawPayload: Record<string, any> = {
    whatsappNumber: settings.whatsappNumber || '',
    adminPin: targetPin,
    categories: Array.isArray(settings.categories) ? settings.categories : [],
    authorizedEmails:
      Array.isArray(settings.authorizedEmails) && settings.authorizedEmails.length > 0
        ? settings.authorizedEmails
        : ['wellysondasilva92@gmail.com', 'whstore081@gmail.com'],
    updatedAt: new Date().toISOString(),
    updatedBy: user?.email || user?.uid || 'lojista-pin',
    architectureVersion: 2, // Marks collection-per-product architecture
  };

  if (settings.previousAdminPin) {
    rawPayload.previousAdminPin = settings.previousAdminPin;
  }

  // Mirror banner metadata only (URL and text) without raw images
  if (settings.banner) {
    rawPayload.banner = {
      subtitle: settings.banner.subtitle || '',
      title: settings.banner.title || '',
      description: settings.banner.description || '',
      image: settings.banner.image?.startsWith('data:') ? '' : (settings.banner.image || ''),
    };
  }

  const payload = removeUndefinedFields(rawPayload);

  try {
    if (isWriteQuotaExhausted()) {
      console.info('[Offline Contingência] Cota de gravações excedida. Mantendo configurações no cache local.');
    } else {
      const settingsRef = doc(db, 'store_config', 'settings');
      await executeFirestoreWrite(setDoc(settingsRef, payload, { merge: true }), 'store_config/settings');
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      setWriteQuotaExhausted(true);
      console.warn('Firestore Quota limit exceeded ao salvar store_config/settings.');
    } else {
      handleFirestoreError(error, OperationType.WRITE, STORE_SETTINGS_DOC_PATH);
    }
  }
}

/**
 * Loads general store configuration from 'store_config/settings'.
 */
export async function loadStoreSettings(): Promise<Partial<StoreSettings> | null> {
  try {
    const snap = await getDoc(doc(db, 'store_config', 'settings'));
    if (snap.exists()) {
      return snap.data() as Partial<StoreSettings>;
    }
    return null;
  } catch (error) {
    console.warn('Notice ao carregar store_config/settings:', error);
    return null;
  }
}

// =========================================================================
// 5. REAL-TIME SUBSCRIPTION: Multi-Collection Listener
// =========================================================================

/**
 * Listens in real time to the separated Firestore architecture:
 * - 'store_config/settings' (General settings)
 * - 'banners/main' (Banner)
 * - 'products' collection (Individual product documents)
 * Merges everything into a cohesive StoreSettings object.
 */
export function subscribeToStoreCatalog(
  onData: (settings: StoreSettings) => void,
  onError: (err: any) => void
): () => void {
  let latestSettings: any = null;
  let latestBanner: BannerConfig | null = null;
  let latestProducts: Product[] = [];

  const emitMerged = () => {
    if (!latestSettings && latestProducts.length === 0 && !latestBanner) {
      return;
    }

    const bannerImage =
      (latestBanner?.image && latestBanner.image.trim()) ||
      (latestSettings?.banner?.image && latestSettings.banner.image.trim()) ||
      'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1600&q=85';

    const resolvedBanner: BannerConfig = {
      subtitle: latestBanner?.subtitle || latestSettings?.banner?.subtitle || 'COLEÇÃO EXCLUSIVA & ATEMPORAL',
      title: latestBanner?.title || latestSettings?.banner?.title || 'Elegância e Brilho para Todos os Momentos',
      description: latestBanner?.description || latestSettings?.banner?.description || 'Descubra nossa curadoria especial de joias em prata 925 legítima...',
      image: bannerImage,
    };

    // Fall back to legacy settings.products only if products collection is still empty
    const resolvedProducts = latestProducts.length > 0
      ? latestProducts
      : (Array.isArray(latestSettings?.products) ? latestSettings.products : []);

    const merged: StoreSettings = {
      whatsappNumber: latestSettings?.whatsappNumber || '5581989947016',
      categories: Array.isArray(latestSettings?.categories) && latestSettings.categories.length > 0
        ? latestSettings.categories
        : undefined,
      adminPin: latestSettings?.adminPin || '',
      authorizedEmails: latestSettings?.authorizedEmails,
      banner: resolvedBanner,
      products: resolvedProducts,
      updatedAt: latestSettings?.updatedAt || new Date().toISOString(),
      updatedBy: latestSettings?.updatedBy,
      isFullCatalog: true,
    };

    onData(merged);
  };

  // 1. Listen to settings document
  const unsubSettings = onSnapshot(
    doc(db, 'store_config', 'settings'),
    (snap) => {
      if (snap.exists()) {
        latestSettings = snap.data();
        emitMerged();
      }
    },
    (err) => onError(err)
  );

  // 2. Listen to banner document
  const unsubBanner = onSnapshot(
    doc(db, 'banners', 'main'),
    (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        latestBanner = {
          subtitle: d.subtitle || '',
          title: d.title || '',
          description: d.description || '',
          image: d.image || '',
        };
        emitMerged();
      }
    },
    (err) => console.warn('Banner listener notice:', err)
  );

  // 3. Listen to independent products collection
  const unsubProducts = onSnapshot(
    collection(db, 'products'),
    (snap) => {
      const prods: Product[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        prods.push({
          id: docSnap.id,
          name: d.name || '',
          category: d.category || 'Geral',
          price: Number(d.price) || 0,
          image: d.image || '',
          images: Array.isArray(d.images) && d.images.length > 0 ? d.images : (d.image ? [d.image] : []),
          video: d.video || '',
          description: d.description || '',
          inStock: d.inStock !== false,
          installments: d.installments || '',
        });
      });
      if (prods.length > 0) {
        latestProducts = prods;
        // Pre-warm cache with Firestore products so future saves skip unchanged items
        prods.forEach((p) => {
          savedProductsCache.set(p.id, getProductHash(p));
        });
      }
      emitMerged();
    },
    (err) => onError(err)
  );

  return () => {
    unsubSettings();
    unsubBanner();
    unsubProducts();
  };
}

/**
 * Alias for subscribeToStoreCatalog to maintain backwards compatibility
 */
export const subscribeToStoreSettings = subscribeToStoreCatalog;

// Hashes to track document changes and prevent redundant writes
let lastSavedSettingsHash = '';
function getSettingsHash(s: Partial<StoreSettings>): string {
  const cats = (s.categories || []).join(',');
  return `${s.whatsappNumber}_${s.adminPin}_${cats}_${(s.authorizedEmails || []).join(',')}`;
}

let lastSavedBannerHash = '';
function getBannerHash(b?: BannerConfig): string {
  if (!b) return '';
  return `${b.title}_${b.subtitle}_${b.description}_${b.image}`;
}

/**
 * Pre-warms the cache with loaded settings and products so saving only
 * updates entities that genuinely changed.
 */
export function warmUpSavedProductsCache(settings: StoreSettings): void {
  if (Array.isArray(settings.products)) {
    settings.products.forEach((p) => {
      savedProductsCache.set(p.id, getProductHash(p));
    });
  }
  if (settings.banner) {
    lastSavedBannerHash = getBannerHash(settings.banner);
  }
  lastSavedSettingsHash = getSettingsHash(settings);
}

/**
 * Orchestrator: Saves full store settings with granular change detection
 * - Only writes store_config/settings if general settings actually changed
 * - Only writes banners/main if banner actually changed
 * - Only writes products that genuinely changed (instantaneous < 100ms for single edits)
 */
export async function saveStoreSettingsToFirestore(
  settings: StoreSettings,
  user?: User | null
): Promise<StoreSettings> {
  const activeUser = user || auth.currentUser;

  // 1. Only save general settings if they changed
  const currentSettingsHash = getSettingsHash(settings);
  if (lastSavedSettingsHash !== currentSettingsHash) {
    await saveStoreSettings(settings, activeUser);
    lastSavedSettingsHash = currentSettingsHash;
  }

  // 2. Only save banner if it changed
  let updatedBanner = settings.banner;
  if (settings.banner) {
    const currentBannerHash = getBannerHash(settings.banner);
    if (lastSavedBannerHash !== currentBannerHash) {
      updatedBanner = await saveBanner(settings.banner, activeUser);
      lastSavedBannerHash = currentBannerHash;
    }
  }

  // 3. Only save products that actually changed
  let updatedProducts: Product[] = [];
  if (Array.isArray(settings.products)) {
    updatedProducts = await Promise.all(
      settings.products.map(async (p) => {
        const hash = getProductHash(p);
        if (savedProductsCache.get(p.id) === hash) {
          return p;
        }
        const saved = await saveProduct(p, activeUser);
        savedProductsCache.set(p.id, hash);
        return saved;
      })
    );
  }

  return {
    ...settings,
    banner: updatedBanner,
    products: updatedProducts,
    updatedAt: new Date().toISOString(),
  };
}

// =========================================================================
// 6. AUTHENTICATION HELPERS
// =========================================================================

/**
 * Sign in with Google Popup
 */
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request' ||
      error?.code === 'auth/user-cancelled' ||
      error?.message?.includes('popup-closed-by-user')
    ) {
      console.info('Autenticação Google cancelada pelo usuário (janela fechada).');
      return null;
    }
    if (
      error?.message?.includes('token-service-api-has-not-been-used') ||
      error?.message?.includes('securetoken.googleapis.com')
    ) {
      const gcpError = new Error(
        'A API Token Service do Google (securetoken.googleapis.com) está desativada no seu projeto 450022699385. Ative-a no Google Cloud Console ou continue usando sua Senha do Lojista.'
      );
      (gcpError as any).code = 'auth/token-service-disabled';
      throw gcpError;
    }
    throw error;
  }
}

/**
 * Sign out
 */
export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Auth state listener helper
 */
export function onAuthChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}
