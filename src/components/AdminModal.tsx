import React, { useState, useMemo } from 'react';
import {
  X,
  Package,
  Phone,
  Image as ImageIcon,
  ShieldCheck,
  Plus,
  Trash2,
  Edit2,
  Upload,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  RefreshCw,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Mail,
  UserCheck,
  ShieldAlert,
  Copy,
  Check,
  Sparkles,
  ChevronDown,
  BarChart3,
  Database,
  Fingerprint,
  ScanFace,
  Smartphone,
  Search,
} from 'lucide-react';
import { Product, StoreSettings, BannerConfig, SyncState, MigrationState, MigrationStatus } from '../types';
import {
  TrustedDevice,
  getCurrentDeviceId,
  detectDeviceName,
  isBiometricsAvailable,
  getLocalTrustedDevices,
  saveLocalTrustedDevices,
  isCurrentDeviceRecognized,
  registerCurrentDevice,
  revokeDevice,
  registerBiometricPasskey,
  authenticateWithBiometrics,
} from '../services/deviceSecurity';
import {
  formatCurrency,
  calculateInstallments,
  isAuthorizedAdminEmail,
  DEFAULT_AUTHORIZED_EMAILS,
  DEFAULT_STORE_CATEGORIES,
  generateSmartDescription,
  saveLocalStoreSettings,
  fetchGlobalSecurityPin,
  saveGlobalSecurityPin,
} from '../services/storage';
import {
  loginWithGoogle,
  logoutUser,
  auth,
  saveProduct,
  deleteProduct,
  saveBanner,
  saveStoreSettings,
  loadStoreSettings,
  isWriteQuotaExhausted,
  resetWriteQuotaCircuitBreaker,
} from '../services/firebase';
import {
  runCatalogMigration,
  getSavedMigrationState,
  isMigrationCompleted,
} from '../services/migration';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  setSupabaseCredentials,
  saveSupabaseCredentialsGlobally,
  initSupabaseGlobalConfig,
  isSupabaseConfigured,
  testSupabaseConnection,
} from '../services/supabase';
import {
  runSupabaseMigration,
  getSupabaseMigrationState,
  isSupabaseMigrationCompleted,
} from '../services/supabaseMigration';
import { saveProductToSupabase, deleteProductFromSupabase } from '../services/products';
import { saveBannerToSupabase } from '../services/banners';
import { saveStoreSettingsToSupabase, fetchStoreSettingsFromSupabase } from '../services/settings';
import { validateImageFile, validateVideoFile, optimizeImageFile } from '../services/imageOptimizer';
import { User } from 'firebase/auth';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  onSaveSettings: (newSettings: StoreSettings) => Promise<boolean>;
  currentUser: User | null;
  syncState: SyncState;
  onForceSync: () => Promise<void>;
}

type TabType = 'produtos' | 'gestao' | 'whatsapp' | 'banner' | 'supabase' | 'seguranca';

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  currentUser,
  syncState,
  onForceSync,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('produtos');

  // Supabase Configuration & Migration State
  const [supabaseUrlInput, setSupabaseUrlInput] = useState(getSupabaseUrl());
  const [supabaseAnonKeyInput, setSupabaseAnonKeyInput] = useState(getSupabaseAnonKey());
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseTestResult, setSupabaseTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isMigratingSupabase, setIsMigratingSupabase] = useState(false);
  const [supabaseMigState, setSupabaseMigState] = useState<MigrationState>(getSupabaseMigrationState());
  const [copiedSql, setCopiedSql] = useState(false);


  // Category Manager State
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryKey, setEditingCategoryKey] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState('');

  // Form states for Product CRUD
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productForm, setProductForm] = useState<{
    id: string;
    name: string;
    category: string;
    price: string;
    installments: string;
    image: string;
    image2: string;
    image3: string;
    image4: string;
    video: string;
    description: string;
    inStock: boolean;
  }>({
    id: '',
    name: '',
    category: '',
    price: '',
    installments: '',
    image: '',
    image2: '',
    image3: '',
    image4: '',
    video: '',
    description: '',
    inStock: true,
  });

  // Categories displayed in the select dropdown (setinha) and Category Manager (A-Z)
  // Exclui todas as categorias que não estão sendo utilizadas e organiza estritamente em ordem alfabética (A-Z)
  const dropdownCategories = React.useMemo(() => {
    const usedCategoriesMap = new Map<string, string>();

    // 1. Coleta apenas as categorias dos produtos que realmente existem no catálogo
    (settings.products || []).forEach((p) => {
      if (p.category && p.category.trim()) {
        const trimmed = p.category.trim();
        const key = trimmed.toLowerCase();
        if (!usedCategoriesMap.has(key)) {
          usedCategoriesMap.set(key, trimmed);
        }
      }
    });

    // 2. Se o formulário do produto estiver com uma categoria específica em edição ou recém-criada, mantém disponível
    if (productForm.category && productForm.category.trim()) {
      const trimmedForm = productForm.category.trim();
      const key = trimmedForm.toLowerCase();
      if (!usedCategoriesMap.has(key)) {
        usedCategoriesMap.set(key, trimmedForm);
      }
    }

    const list = Array.from(usedCategoriesMap.values());
    if (list.length === 0) {
      return [...DEFAULT_STORE_CATEGORIES].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      );
    }

    // 3. Sempre organiza em ordem alfabética A-Z
    return list.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [settings.products, productForm.category]);

  // Barra de Pesquisa e Filtros na Vitrine do Painel de Administração
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState('Todas');
  const [adminStockFilter, setAdminStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  // Produtos filtrados na vitrine com base no termo de busca, categoria e status de estoque
  const filteredAdminProducts = useMemo(() => {
    let list = settings.products || [];
    const term = adminSearchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.category.toLowerCase().includes(term) ||
          p.id.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }
    if (adminCategoryFilter && adminCategoryFilter !== 'Todas') {
      list = list.filter(
        (p) => p.category.toLowerCase() === adminCategoryFilter.toLowerCase()
      );
    }
    if (adminStockFilter === 'in_stock') {
      list = list.filter((p) => p.inStock !== false);
    } else if (adminStockFilter === 'out_of_stock') {
      list = list.filter((p) => p.inStock === false);
    }
    return list;
  }, [settings.products, adminSearchTerm, adminCategoryFilter, adminStockFilter]);

  // Sincroniza e exclui automaticamente categorias sem produtos de settings.categories, mantendo A-Z
  React.useEffect(() => {
    if (Array.isArray(settings.products) && settings.products.length > 0) {
      const usedCategoriesMap = new Map<string, string>();
      settings.products.forEach((p) => {
        if (p.category && p.category.trim()) {
          const trimmed = p.category.trim();
          const key = trimmed.toLowerCase();
          if (!usedCategoriesMap.has(key)) {
            usedCategoriesMap.set(key, trimmed);
          }
        }
      });

      const cleanSorted = Array.from(usedCategoriesMap.values()).sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
      );

      const currentCats = settings.categories || [];
      const hasDifferences =
        currentCats.length !== cleanSorted.length ||
        currentCats.some((c, i) => c !== cleanSorted[i]);

      if (hasDifferences) {
        onSaveSettings({
          ...settings,
          categories: cleanSorted,
        });
      }
    }
  }, [settings.products]);

  // WhatsApp Tab State
  const [whatsappInput, setWhatsappInput] = useState(settings.whatsappNumber);

  // Banner Tab State
  const [bannerForm, setBannerForm] = useState<BannerConfig>({
    subtitle: settings.banner.subtitle,
    title: settings.banner.title,
    description: settings.banner.description,
    image: settings.banner.image,
  });

  // Security Tab State
  const [adminPinInput, setAdminPinInput] = useState('');
  const [authenticatedWithPin, setAuthenticatedWithPin] = useState(false);
  const [customNewPin, setCustomNewPin] = useState('');
  const [showUnlockPin, setShowUnlockPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showActivePin, setShowActivePin] = useState(true);

  // Authorized Emails State
  const [authorizedEmailsList, setAuthorizedEmailsList] = useState<string[]>(
    settings.authorizedEmails && settings.authorizedEmails.length > 0
      ? settings.authorizedEmails
      : DEFAULT_AUTHORIZED_EMAILS
  );
  const [newEmailInput, setNewEmailInput] = useState('');

  const [showDomainHelp, setShowDomainHelp] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHostname = () => {
    if (navigator.clipboard && currentHostname) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  const handleCopyCustom = (domainText: string) => {
    if (navigator.clipboard && domainText) {
      navigator.clipboard.writeText(domainText);
      showStatus('success', `Domínio "${domainText}" copiado com sucesso!`);
    }
  };

  // Trusted Devices (Limite de 3 Aparelhos: Computador Lojista, Celular Lojista, Celular Esposa) & Face ID / Biometria
  const [isBiometricsSupported, setIsBiometricsSupported] = useState(false);
  const [trustedDevicesList, setTrustedDevicesList] = useState<TrustedDevice[]>(() =>
    settings.trustedDevices || getLocalTrustedDevices()
  );
  const [strictDeviceMode, setStrictDeviceMode] = useState<boolean>(
    settings.strictDeviceLimit !== false
  );
  const [currentDeviceId] = useState<string>(() => getCurrentDeviceId());
  const [currentDeviceName] = useState<string>(() => detectDeviceName());

  React.useEffect(() => {
    isBiometricsAvailable().then(setIsBiometricsSupported);
  }, []);

  React.useEffect(() => {
    if (settings.trustedDevices && Array.isArray(settings.trustedDevices)) {
      setTrustedDevicesList(settings.trustedDevices);
      saveLocalTrustedDevices(settings.trustedDevices);
    }
  }, [settings.trustedDevices]);

  React.useEffect(() => {
    const newEmails = settings.authorizedEmails;
    if (newEmails && Array.isArray(newEmails)) {
      setAuthorizedEmailsList((prev) => {
        const prevJoined = prev.join(',');
        const nextJoined = newEmails.join(',');
        return prevJoined === nextJoined ? prev : newEmails;
      });
    }
  }, [settings.authorizedEmails]);

  const PRODUCT_DRAFT_KEY = 'wh_store_product_form_draft_v1';

  // UI feedback
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [imageOptimizing, setImageOptimizing] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Auto-save form draft whenever editing or creating so sudden tab reloads never lose progress
  React.useEffect(() => {
    if (isCreatingProduct || editingProduct) {
      if (productForm.name || productForm.price || productForm.image || productForm.description) {
        try {
          sessionStorage.setItem(
            PRODUCT_DRAFT_KEY,
            JSON.stringify({
              form: productForm,
              isCreating: isCreatingProduct,
              editingId: editingProduct?.id,
            })
          );
        } catch {
          // Ignore
        }
      }
    }
  }, [productForm, isCreatingProduct, editingProduct]);

  // Restore draft if the user was editing when the browser or server reloaded
  React.useEffect(() => {
    try {
      const rawDraft = sessionStorage.getItem(PRODUCT_DRAFT_KEY);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (draft && draft.form && (draft.form.name || draft.form.price || draft.form.image)) {
          setProductForm(draft.form);
          if (draft.isCreating) {
            setIsCreatingProduct(true);
            setEditingProduct(null);
          } else if (draft.editingId) {
            const prod = settings.products.find((p) => p.id === draft.editingId);
            if (prod) {
              setEditingProduct(prod);
              setIsCreatingProduct(false);
            }
          }
          setStatusMessage({
            type: 'info',
            text: 'Rascunho de produto em edição restaurado automaticamente.',
          });
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  // Migration & Sync State
  const [migrationState, setMigrationState] = useState<MigrationState>(getSavedMigrationState);
  const [isMigrating, setIsMigrating] = useState(false);

  const handleRunMigration = async () => {
    setIsMigrating(true);
    showStatus('info', 'Iniciando migração dos dados locais para o Firestore e Storage...');
    try {
      const res = await runCatalogMigration((progress) => {
        setMigrationState(progress);
      });
      if (res.success) {
        showStatus('success', `Migração concluída com sucesso! ${res.migratedProducts} produtos migrados para documentos independentes.`);
        if (onForceSync) await onForceSync();
      } else {
        showStatus('error', `A migração teve ${res.errors.length} aviso(s). Veja os detalhes na aba Segurança & Sincronização.`);
      }
    } catch (err: any) {
      showStatus('error', 'Falha ao executar migração: ' + (err?.message || 'Erro inesperado'));
    } finally {
      setIsMigrating(false);
    }
  };

  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Auto-lock whenever modal is closed or re-opened; synchronize latest cloud PIN
  React.useEffect(() => {
    if (!isOpen) {
      setAuthenticatedWithPin(false);
      setAdminPinInput('');
    } else {
      // Synchronize Supabase credentials from server across devices
      initSupabaseGlobalConfig().then((cfg) => {
        if (cfg.url) setSupabaseUrlInput(cfg.url);
        if (cfg.anonKey) setSupabaseAnonKeyInput(cfg.anonKey);
      });

      // Busca imediatamente a senha ativa mais recente do arquivo global (servidor / Netlify CDN)
      fetchGlobalSecurityPin().then((pin) => {
        if (pin && pin !== settings.adminPin) {
          onSaveSettings({ ...settings, adminPin: pin });
          if (typeof window !== 'undefined') {
            localStorage.setItem('wh_store_admin_pin_backup', pin);
          }
        }
      }).catch(() => {});

      // Busca imediatamente a senha ativa mais recente na nuvem (Supabase + fallback Firestore)
      fetchStoreSettingsFromSupabase().then((sbSettings) => {
        if (sbSettings?.adminPin) {
          const cloudPin = sbSettings.adminPin.trim();
          if (cloudPin && cloudPin !== settings.adminPin) {
            onSaveSettings({ ...settings, adminPin: cloudPin });
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('wh_store_admin_pin_backup', cloudPin);
          }
        }
      }).catch(() => {
        loadStoreSettings().then((fsSettings) => {
          if (fsSettings?.adminPin) {
            const fsPin = fsSettings.adminPin.trim();
            if (fsPin && fsPin !== settings.adminPin) {
              onSaveSettings({ ...settings, adminPin: fsPin });
            }
          }
        }).catch(() => {});
      });
    }
  }, [isOpen]);

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 5500);
  };

  // Admin is strictly authorized only when PIN is entered
  const isAuthorized = authenticatedWithPin;

  const handlePinAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = adminPinInput.trim();
    if (!cleanInput) return;

    // Bloqueia qualquer tentativa de senha genérica sem expor a senha real
    if (cleanInput === '1234') {
      showStatus('error', 'Credenciais inválidas. Verifique sua senha ou utilize Face ID / Biometria.');
      return;
    }

    setIsVerifyingPin(true);

    try {
      // 1. Sempre verifica a fonte global autoritária em tempo real (servidor / store-security.json no Netlify)
      const globalPin = await fetchGlobalSecurityPin();

      // 2. Consulta também Supabase e Firestore
      let cloudPin: string | null =
        globalPin && globalPin.trim() && globalPin.trim() !== '1234' ? globalPin.trim() : null;
      if (!cloudPin) {
        try {
          const sbSettings = await fetchStoreSettingsFromSupabase();
          if (sbSettings?.adminPin && sbSettings.adminPin.trim() && sbSettings.adminPin.trim() !== '1234') {
            cloudPin = sbSettings.adminPin.trim();
          }
        } catch (err) {
          console.warn('Erro ao consultar PIN no Supabase:', err);
        }
      }

      if (!cloudPin) {
        try {
          const fsSettings = await loadStoreSettings();
          if (fsSettings?.adminPin && fsSettings.adminPin.trim() && fsSettings.adminPin.trim() !== '1234') {
            cloudPin = fsSettings.adminPin.trim();
          }
        } catch (err) {
          console.warn('Erro ao consultar PIN no Firestore:', err);
        }
      }

      const backupPin = typeof window !== 'undefined' ? localStorage.getItem('wh_store_admin_pin_backup') : null;
      const validBackup = backupPin && backupPin.trim() !== '1234' ? backupPin.trim() : null;
      const validSettingsPin = settings.adminPin && settings.adminPin.trim() !== '1234' ? settings.adminPin.trim() : null;

      // Senha oficial configurada pelo lojista
      const authoritativePin = cloudPin || validSettingsPin || validBackup || '209220';

      if (cleanInput === authoritativePin) {
        // Validação dos 3 dispositivos autorizados (Computador Lojista, Celular Lojista, Celular Esposa)
        const currentList = settings.trustedDevices || getLocalTrustedDevices();
        const isRecognized = isCurrentDeviceRecognized(currentList);

        if (!isRecognized) {
          if (currentList.length < 3) {
            // Se ainda tem espaço para cadastrar (menos de 3), cadastra automaticamente este dispositivo do lojista
            const regRes = registerCurrentDevice(detectDeviceName(), currentList);
            const updatedSettings = {
              ...settings,
              adminPin: authoritativePin,
              trustedDevices: regRes.updatedList,
              strictDeviceLimit: true,
            };
            onSaveSettings(updatedSettings);
            saveLocalStoreSettings(updatedSettings);
            saveStoreSettings(updatedSettings).catch(() => {});
            setTrustedDevicesList(regRes.updatedList);
          } else if (settings.strictDeviceLimit !== false) {
            // Já existem 3 dispositivos registrados e este aparelho é um 4º não autorizado!
            showStatus(
              'error',
              'Acesso bloqueado: Limite de 3 dispositivos autorizados atingido. Este aparelho não está cadastrado na WH Store.'
            );
            return;
          }
        }

        // Atualiza o estado local e localStorage caso a nuvem estivesse com senha mais recente
        if (authoritativePin !== settings.adminPin) {
          const updatedSettings = { ...settings, adminPin: authoritativePin };
          onSaveSettings(updatedSettings);
          saveLocalStoreSettings(updatedSettings);
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('wh_store_admin_pin_backup', authoritativePin);
        }

        setAuthenticatedWithPin(true);
        setAdminPinInput('');
        showStatus('success', 'Acesso autorizado com sucesso no dispositivo reconhecido!');
      } else {
        showStatus('error', 'Senha incorreta. Verifique e tente novamente.');
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleBiometricAuth = async () => {
    setIsVerifyingPin(true);
    try {
      const res = await authenticateWithBiometrics();
      if (res.success) {
        // Garante que o dispositivo atual está registrado na lista dos 3
        const currentList = settings.trustedDevices || getLocalTrustedDevices();
        if (!isCurrentDeviceRecognized(currentList) && currentList.length < 3) {
          const regRes = registerCurrentDevice(detectDeviceName(), currentList, true);
          const updatedSettings = {
            ...settings,
            trustedDevices: regRes.updatedList,
            strictDeviceLimit: true,
          };
          onSaveSettings(updatedSettings);
          saveLocalStoreSettings(updatedSettings);
          saveStoreSettings(updatedSettings).catch(() => {});
          setTrustedDevicesList(regRes.updatedList);
        }

        setAuthenticatedWithPin(true);
        showStatus('success', 'Autenticado com sucesso via Face ID / Biometria!');
      } else {
        showStatus(
          'info',
          res.error || 'Autenticação biométrica não concluída. Você pode entrar com sua senha de administrador.'
        );
      }
    } catch (err: any) {
      showStatus('error', err?.message || 'Erro ao processar biometria.');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleRegisterBiometricsOnCurrentDevice = async () => {
    setIsSaving(true);
    try {
      const res = await registerBiometricPasskey(`Lojista WH (${detectDeviceName()})`);
      if (res.success) {
        const currentList = settings.trustedDevices || getLocalTrustedDevices();
        const reg = registerCurrentDevice(detectDeviceName(), currentList, true);
        const updated = {
          ...settings,
          trustedDevices: reg.updatedList,
          strictDeviceLimit: true,
        };
        await onSaveSettings(updated);
        saveLocalStoreSettings(updated);
        saveStoreSettings(updated).catch(() => {});
        setTrustedDevicesList(reg.updatedList);
        showStatus('success', 'Face ID / Biometria cadastrada com sucesso neste aparelho!');
      } else {
        showStatus('error', res.error || 'Não foi possível cadastrar biometria neste aparelho.');
      }
    } catch (err: any) {
      showStatus('error', err?.message || 'Falha ao registrar biometria.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterThisDevice = async () => {
    const currentList = settings.trustedDevices || getLocalTrustedDevices();
    if (currentList.length >= 3 && !isCurrentDeviceRecognized(currentList)) {
      showStatus('error', 'Limite de 3 dispositivos autorizados atingido. Remova um dispositivo antigo primeiro.');
      return;
    }
    const reg = registerCurrentDevice(detectDeviceName(), currentList);
    const updated = {
      ...settings,
      trustedDevices: reg.updatedList,
      strictDeviceLimit: true,
    };
    await onSaveSettings(updated);
    saveLocalStoreSettings(updated);
    saveStoreSettings(updated).catch(() => {});
    setTrustedDevicesList(reg.updatedList);
    showStatus('success', reg.message);
  };

  const handleRevokeDevice = async (deviceId: string) => {
    const currentList = settings.trustedDevices || getLocalTrustedDevices();
    const updatedList = revokeDevice(deviceId, currentList);
    const updated = {
      ...settings,
      trustedDevices: updatedList,
    };
    await onSaveSettings(updated);
    saveLocalStoreSettings(updated);
    saveStoreSettings(updated).catch(() => {});
    setTrustedDevicesList(updatedList);
    showStatus('success', 'Dispositivo removido da lista de reconhecidos com sucesso.');
  };

  const handleGoogleLogin = async () => {
    try {
      setIsSaving(true);
      const user = await loginWithGoogle();
      if (!user) {
        // User closed or cancelled the popup dialog
        return;
      }

      const userEmail = user?.email?.trim().toLowerCase();

      // Check strictly against authorized email list
      if (userEmail && isAuthorizedAdminEmail(userEmail, settings)) {
        setAuthenticatedWithPin(true);
        showStatus('success', `Autenticado com sucesso via Google (${user.email})!`);
        await onSaveSettings(settings);
      } else {
        // IMMEDIATELY log out unauthorized user to clear session
        await logoutUser();
        setAuthenticatedWithPin(false);
        showStatus(
          'error',
          `Acesso negado: O e-mail "${user?.email || 'desconhecido'}" NÃO está autorizado como administrador. Apenas e-mails salvos na lista têm acesso.`
        );
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.code === 'auth/user-cancelled' ||
        err?.message?.includes('popup-closed-by-user')
      ) {
        return;
      }

      if (
        err?.code === 'auth/unauthorized-domain' ||
        err?.message?.includes('unauthorized-domain')
      ) {
        setShowDomainHelp(true);
        showStatus(
          'info',
          'Domínio do app não listado no Firebase Auth para login com Google. O painel continua funcionando 100% com a sua Senha do Lojista.'
        );
        return;
      }

      if (
        err?.code === 'auth/token-service-disabled' ||
        err?.message?.includes('token-service-api-has-not-been-used') ||
        err?.message?.includes('securetoken.googleapis.com')
      ) {
        setShowDomainHelp(true);
        showStatus(
          'error',
          'A API Token Service do Google está desativada no seu projeto. Ative-a no link das instruções abaixo ou use sua Senha do Lojista.'
        );
        return;
      }

      console.warn('Google login notice:', err);
      showStatus('error', err?.message || 'Falha ao autenticar com Google.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAuthorizedEmail = () => {
    const emailToAdd = newEmailInput.trim().toLowerCase();
    if (!emailToAdd) return;
    if (!emailToAdd.includes('@') || !emailToAdd.includes('.')) {
      showStatus('error', 'Digite um endereço de e-mail válido.');
      return;
    }
    if (authorizedEmailsList.some((e) => e.toLowerCase() === emailToAdd)) {
      showStatus('info', 'Este e-mail já está na lista de autorizados.');
      return;
    }
    setAuthorizedEmailsList((prev) => [...prev, emailToAdd]);
    setNewEmailInput('');
  };

  const handleRemoveAuthorizedEmail = (emailToRemove: string) => {
    if (emailToRemove.toLowerCase() === 'wellysondasilva92@gmail.com') {
      showStatus('error', 'O e-mail principal do proprietário (wellysondasilva92@gmail.com) não pode ser removido.');
      return;
    }
    setAuthorizedEmailsList((prev) => prev.filter((e) => e.toLowerCase() !== emailToRemove.toLowerCase()));
  };

  const handleSaveAuthorizedEmails = async () => {
    const cleanList = Array.from(
      new Set(
        [
          'wellysondasilva92@gmail.com',
          ...authorizedEmailsList.map((e) => e.trim().toLowerCase()),
        ].filter(Boolean)
      )
    );

    setIsSaving(true);
    const ok = await onSaveSettings({
      ...settings,
      authorizedEmails: cleanList,
    });
    setIsSaving(false);

    if (ok) {
      showStatus('success', 'Lista de e-mails autorizados salva e sincronizada com sucesso!');
    } else {
      showStatus('error', 'Falha ao salvar lista de e-mails autorizados.');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setAuthenticatedWithPin(false);
      setAdminPinInput('');
      showStatus('info', 'Sessão administrativa bloqueada.');
    } catch (err) {
      console.error(err);
    }
  };

  // Category Management Handlers (Saved directly to setinha)
  const handleAddNewCategory = async (nameToAdd?: string) => {
    const raw = (nameToAdd || newCategoryName).trim();
    if (!raw) {
      showStatus('error', 'Digite um nome para a nova categoria.');
      return;
    }
    if (dropdownCategories.some((c) => c.toLowerCase() === raw.toLowerCase())) {
      showStatus('info', `A categoria "${raw}" já está disponível na setinha.`);
      setProductForm((prev) => ({ ...prev, category: raw }));
      setNewCategoryName('');
      return;
    }

    const updated = Array.from(new Set([...dropdownCategories, raw])).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );

    setIsSaving(true);
    const ok = await onSaveSettings({
      ...settings,
      categories: updated,
    });
    setIsSaving(false);

    if (ok) {
      setProductForm((prev) => ({ ...prev, category: raw }));
      setNewCategoryName('');
      showStatus('success', `Categoria "${raw}" salva na setinha em ordem alfabética!`);
    } else {
      showStatus('error', 'Falha ao salvar nova categoria na setinha.');
    }
  };

  const handleSaveRenamedCategory = async (oldName: string) => {
    const cleanNew = editingCategoryValue.trim();
    if (!cleanNew) {
      showStatus('error', 'O nome da categoria não pode ficar vazio.');
      return;
    }
    if (cleanNew.toLowerCase() === oldName.toLowerCase()) {
      setEditingCategoryKey(null);
      return;
    }

    const updatedCategories = dropdownCategories
      .map((c) => (c === oldName ? cleanNew : c))
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    const updatedProducts = settings.products.map((p) =>
      p.category === oldName ? { ...p, category: cleanNew } : p
    );

    setIsSaving(true);
    const ok = await onSaveSettings({
      ...settings,
      categories: updatedCategories,
      products: updatedProducts,
    });
    setIsSaving(false);

    if (ok) {
      if (productForm.category === oldName) {
        setProductForm((prev) => ({ ...prev, category: cleanNew }));
      }
      setEditingCategoryKey(null);
      showStatus('success', `Categoria alterada para "${cleanNew}" e reorganizada de A a Z!`);
    } else {
      showStatus('error', 'Falha ao renomear categoria na setinha.');
    }
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    const updatedCategories = dropdownCategories
      .filter((c) => c !== catToDelete)
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

    setIsSaving(true);
    const ok = await onSaveSettings({
      ...settings,
      categories: updatedCategories.length > 0 ? updatedCategories : DEFAULT_STORE_CATEGORIES,
    });
    setIsSaving(false);

    if (ok) {
      if (productForm.category === catToDelete) {
        setProductForm((prev) => ({
          ...prev,
          category: updatedCategories[0] || DEFAULT_STORE_CATEGORIES[0],
        }));
      }
      showStatus('success', `Categoria "${catToDelete}" removida da setinha.`);
    } else {
      showStatus('error', 'Falha ao remover categoria da setinha.');
    }
  };

  const handleCleanUnusedCategories = async () => {
    const usedCategoriesMap = new Map<string, string>();
    settings.products.forEach((p) => {
      if (p.category && p.category.trim()) {
        const trimmed = p.category.trim();
        const key = trimmed.toLowerCase();
        if (!usedCategoriesMap.has(key)) {
          usedCategoriesMap.set(key, trimmed);
        }
      }
    });

    const cleanSorted = Array.from(usedCategoriesMap.values()).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );

    setIsSaving(true);
    const ok = await onSaveSettings({
      ...settings,
      categories: cleanSorted,
    });
    setIsSaving(false);

    if (ok) {
      showStatus('success', 'Categorias sem produtos foram excluídas e organizadas em ordem alfabética (A-Z)!');
    }
  };

  // Product CRUD
  const handleOpenNewProduct = () => {
    setIsCategoryManagerOpen(false);
    const initialCat = dropdownCategories[0] || DEFAULT_STORE_CATEGORIES[0] || 'Conjuntos prata 925';
    setProductForm({
      id: `prod-${Date.now()}`,
      name: '',
      category: initialCat,
      price: '',
      installments: '',
      image: '',
      image2: '',
      image3: '',
      image4: '',
      video: '',
      description: '',
      inStock: true,
    });
    setEditingProduct(null);
    setIsCreatingProduct(true);
  };

  const handleEditProduct = (prod: Product) => {
    setIsCategoryManagerOpen(false);
    const rawImages = prod.images && prod.images.length > 0 ? prod.images : [prod.image];
    const cat = prod.category || dropdownCategories[0] || 'Conjuntos prata 925';
    setProductForm({
      id: prod.id,
      name: prod.name,
      category: cat,
      price: String(prod.price),
      installments: prod.installments || '',
      image: rawImages[0] || prod.image || '',
      image2: rawImages[1] || '',
      image3: rawImages[2] || '',
      image4: rawImages[3] || '',
      video: prod.video || '',
      description: prod.description || '',
      inStock: prod.inStock !== false,
    });
    setEditingProduct(prod);
    setIsCreatingProduct(false);
  };

  const handleToggleStock = async (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentStock = prod.inStock !== false;
    const newStock = !currentStock;
    const updatedProd: Product = { ...prod, inStock: newStock };
    const updatedList = settings.products.map((p) =>
      p.id === prod.id ? updatedProd : p
    );

    setIsSaving(true);
    try {
      // 1. Atualiza imediatamente o estado do catálogo e LocalStorage
      const ok = await onSaveSettings({
        ...settings,
        products: updatedList,
      });

      // 2. Persiste imediatamente o estoque no Firestore e no Supabase para não reverter na sincronização
      const syncTasks: Promise<any>[] = [
        saveProduct(updatedProd, currentUser).catch((err) => {
          console.warn('Notice ao salvar estoque no Firestore:', err);
        }),
      ];

      if (isSupabaseConfigured()) {
        syncTasks.push(
          saveProductToSupabase(updatedProd).catch((sbErr) => {
            console.warn('Notice ao salvar estoque no Supabase:', sbErr);
          })
        );
      }

      await Promise.allSettled(syncTasks);

      if (ok) {
        showStatus(
          'success',
          newStock
            ? `"${prod.name}" marcado como DISPONÍVEL!`
            : `"${prod.name}" marcado como ESGOTADO!`
        );
      } else {
        showStatus('error', 'Falha ao atualizar status de estoque.');
      }
    } catch (err: any) {
      console.error('Erro ao alternar estoque:', err);
      showStatus('error', 'Erro ao salvar alteração de estoque.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestDelete = (prod: Product) => {
    setProductToDelete(prod);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete) return;
    const id = productToDelete.id;
    setProductToDelete(null);

    // Delete in background from Firestore & Supabase
    deleteProduct(id, currentUser).catch((e) => {
      console.warn('Notice ao excluir produto do Firestore:', e);
    });
    if (isSupabaseConfigured()) {
      deleteProductFromSupabase(id).catch((e) => {
        console.warn('Notice ao excluir produto do Supabase:', e);
      });
    }

    const updated = settings.products.filter((p) => p.id !== id);
    setIsSaving(true);
    try {
      const ok = await onSaveSettings({
        ...settings,
        products: updated,
      });
      if (ok) {
        showStatus('success', 'Produto removido com sucesso!');
      } else {
        showStatus('error', 'Falha ao remover produto.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      showStatus('error', 'Informe o nome do produto.');
      return;
    }
    const priceNum = parseFloat(productForm.price.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      showStatus('error', 'Informe um preço válido.');
      return;
    }

    const allPhotos = [
      productForm.image.trim(),
      productForm.image2.trim(),
      productForm.image3.trim(),
      productForm.image4.trim(),
    ].filter(Boolean);

    if (allPhotos.length === 0) {
      showStatus('error', 'Insira pelo menos a Foto Principal (Foto 1).');
      return;
    }

    const calculatedInstallments = calculateInstallments(priceNum);
    const chosenInstallments = productForm.installments.trim() || calculatedInstallments;
    const chosenVideo = productForm.video.trim();

    const finalDescription =
      productForm.description.trim() ||
      generateSmartDescription(productForm.name, productForm.category, priceNum);

    const newProduct: Product = {
      id: productForm.id || `prod-${Date.now()}`,
      name: productForm.name.trim(),
      category: productForm.category.trim() || 'Geral',
      price: priceNum,
      image: allPhotos[0],
      images: allPhotos,
      description: finalDescription,
      inStock: productForm.inStock !== false,
      ...(chosenInstallments ? { installments: chosenInstallments } : {}),
      ...(chosenVideo ? { video: chosenVideo } : {}),
    };

    setIsSaving(true);
    try {
      let updatedList: Product[];
      if (editingProduct) {
        updatedList = settings.products.map((p) =>
          p.id === newProduct.id ? newProduct : p
        );
      } else {
        updatedList = [newProduct, ...settings.products];
      }

      // Fast optimistic save to LocalStorage and UI
      const ok = await onSaveSettings({
        ...settings,
        products: updatedList,
      });

      // Persist to individual cloud document in Firestore and Supabase
      const cloudPromises: Promise<any>[] = [
        saveProduct(newProduct, currentUser).catch((saveErr) => {
          console.warn('Notice ao salvar produto individual no Firestore:', saveErr);
        }),
      ];
      if (isSupabaseConfigured()) {
        cloudPromises.push(
          saveProductToSupabase(newProduct).catch((sbErr) => {
            console.warn('Notice ao salvar produto no Supabase:', sbErr);
          })
        );
      }
      await Promise.allSettled(cloudPromises);

      if (ok) {
        try {
          sessionStorage.removeItem(PRODUCT_DRAFT_KEY);
        } catch {
          // Ignore
        }
        showStatus(
          'success',
          editingProduct ? 'Produto atualizado com sucesso!' : 'Novo produto cadastrado com sucesso!'
        );
        setEditingProduct(null);
        setIsCreatingProduct(false);
      } else {
        showStatus('error', 'Falha ao salvar produto.');
      }
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      showStatus('error', 'Erro ao salvar produto: ' + (error?.message || 'Tente novamente'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoGenerateDescription = (
    tone: 'detalhado' | 'presente' | 'luxo' = 'detalhado'
  ) => {
    const desc = generateSmartDescription(
      productForm.name || 'Joia Exclusiva WH Store',
      productForm.category || 'Geral',
      parseFloat(productForm.price.replace(',', '.')) || 0,
      tone
    );
    setProductForm((prev) => ({ ...prev, description: desc }));
    showStatus('success', 'Descrição personalizada gerada com sucesso para a peça!');
  };

  // Image Upload handler for Product (slots 1, 2, 3, 4)
  const handleProductImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    slotKey: 'image' | 'image2' | 'image3' | 'image4'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      showStatus('error', validation.error || 'Arquivo de imagem inválido.');
      return;
    }

    try {
      setImageOptimizing(true);
      const optimized = await optimizeImageFile(file, 1800, 0.90);
      setProductForm((prev) => {
        // Automatically provide an intelligent description if currently empty
        const autoDesc = !prev.description.trim()
          ? generateSmartDescription(
              prev.name || 'Nova Joia',
              prev.category || 'Geral',
              parseFloat(prev.price.replace(',', '.')) || 0
            )
          : prev.description;

        return {
          ...prev,
          [slotKey]: optimized.dataUrl,
          description: autoDesc,
        };
      });
      showStatus(
        'success',
        `Foto em alta definição (${optimized.width}x${optimized.height}px) pronta!`
      );
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Falha ao processar e otimizar imagem.');
    } finally {
      setImageOptimizing(false);
    }
  };

  // Video Upload handler for Product
  const handleProductVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateVideoFile(file);
    if (!validation.valid) {
      showStatus('error', validation.error || 'Arquivo de vídeo inválido.');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          setProductForm((prev) => ({ ...prev, video: event.target!.result as string }));
          showStatus('success', 'Vídeo do produto anexado com sucesso!');
        }
      };
      reader.readAsDataURL(file);
    } catch {
      showStatus('error', 'Falha ao processar vídeo.');
    }
  };

  // Image Upload handler for Banner
  const handleBannerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      showStatus('error', validation.error || 'Arquivo de imagem inválido.');
      return;
    }

    try {
      setImageOptimizing(true);
      const optimized = await optimizeImageFile(file, 1800, 0.90);
      setBannerForm((prev) => ({ ...prev, image: optimized.dataUrl }));
      showStatus('success', `Imagem do banner em alta definição (${optimized.width}x${optimized.height}px) pronta!`);
    } catch (err: any) {
      console.error(err);
      showStatus('error', 'Falha ao processar imagem do banner.');
    } finally {
      setImageOptimizing(false);
    }
  };

  // Save WhatsApp settings
  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = whatsappInput.replace(/\D/g, '');
    if (clean.length < 10) {
      showStatus('error', 'Informe um número de WhatsApp válido com DDD (ex: 5581989947016).');
      return;
    }

    setIsSaving(true);
    const ok = await onSaveSettings({
      ...settings,
      whatsappNumber: clean,
    });
    if (isSupabaseConfigured()) {
      saveStoreSettingsToSupabase({ ...settings, whatsappNumber: clean }).catch((wErr) => {
        console.warn('Notice ao salvar WhatsApp no Supabase:', wErr);
      });
    }
    setIsSaving(false);
    if (ok) {
      showStatus('success', 'Número de WhatsApp comercial atualizado!');
    } else {
      showStatus('error', 'Falha ao salvar número do WhatsApp.');
    }
  };

  // Save Banner settings
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerForm.title.trim() || !bannerForm.image.trim()) {
      showStatus('error', 'Preencha ao menos o título e a imagem do banner.');
      return;
    }

    setIsSaving(true);
    try {
      const ok = await onSaveSettings({
        ...settings,
        banner: bannerForm,
      });

      // Save banner in background without freezing UI
      saveBanner(bannerForm, currentUser).catch((bErr) => {
        console.warn('Notice ao salvar banner no Firestore:', bErr);
      });
      if (isSupabaseConfigured()) {
        saveBannerToSupabase(bannerForm).catch((bErr) => {
          console.warn('Notice ao salvar banner no Supabase:', bErr);
        });
      }

      if (ok) {
        showStatus('success', 'Banner principal atualizado na vitrine!');
      } else {
        showStatus('error', 'Falha ao salvar banner.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Save Security PIN
  const handleSaveNewPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = customNewPin.trim();
    if (cleanPin.length < 4) {
      showStatus('error', 'A nova senha deve ter no mínimo 4 dígitos.');
      return;
    }

    const oldPin = settings.adminPin || '209220';
    setIsSaving(true);

    try {
      const updatedSettings: StoreSettings = {
        ...settings,
        previousAdminPin: oldPin,
        adminPin: cleanPin,
        updatedAt: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('wh_store_admin_pin_backup', cleanPin);
      }
      saveLocalStoreSettings(updatedSettings);

      // Salva no estado do React
      await onSaveSettings(updatedSettings);

      // 1. Salva no arquivo global store-security.json e envia git push para o Netlify
      await saveGlobalSecurityPin(cleanPin);

      // 2. Salva e aguarda explicitamente na nuvem (Supabase e Firestore)
      const cloudPromises: Promise<any>[] = [];
      if (isSupabaseConfigured()) {
        cloudPromises.push(saveStoreSettingsToSupabase(updatedSettings).catch(() => null));
      }
      cloudPromises.push(saveStoreSettings(updatedSettings, currentUser).catch(() => null));

      await Promise.all(cloudPromises);

      showStatus('success', 'Nova senha gravada globalmente e sincronizada para o GitHub e Netlify com sucesso!');
      setCustomNewPin('');
    } catch (err: any) {
      console.error('Erro ao sincronizar nova senha na nuvem:', err);
      showStatus('error', `Aviso ao salvar na nuvem: ${err?.message || 'verifique sua conexão'}.`);
    } finally {
      setIsSaving(false);
    }
  };

  // Supabase Handlers
  const handleSaveSupabaseCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = supabaseUrlInput.trim();
    const cleanKey = supabaseAnonKeyInput.trim();
    setIsTestingSupabase(true);
    await saveSupabaseCredentialsGlobally(cleanUrl, cleanKey);
    showStatus('success', 'Credenciais salvas no servidor! Todos os celulares e dispositivos agora terão acesso automático.');
    const res = await testSupabaseConnection();
    setIsTestingSupabase(false);
    setSupabaseTestResult(res);
    if (res.ok) {
      showStatus('success', res.message);
    } else {
      showStatus('error', res.message);
    }
  };

  const handleTestSupabase = async () => {
    setIsTestingSupabase(true);
    const res = await testSupabaseConnection();
    setIsTestingSupabase(false);
    setSupabaseTestResult(res);
    if (res.ok) {
      showStatus('success', res.message);
    } else {
      showStatus('error', res.message);
    }
  };

  const handleRunSupabaseMigration = async () => {
    if (!isSupabaseConfigured()) {
      showStatus('error', 'Configure a URL e a Chave Anon do Supabase primeiro.');
      return;
    }
    setIsMigratingSupabase(true);
    try {
      const res = await runSupabaseMigration(settings, (st) => {
        setSupabaseMigState(st);
      });
      if (res.success) {
        showStatus('success', `Migração concluída! ${res.migratedProducts} produtos migrados para o Supabase.`);
      } else {
        showStatus('error', `Migração finalizada com ${res.errors.length} avisos.`);
      }
    } catch (err: any) {
      showStatus('error', 'Erro durante a migração: ' + (err?.message || 'Falha de conexão.'));
    } finally {
      setIsMigratingSupabase(false);
    }
  };

  const handleCopySqlScript = async () => {
    try {
      const resp = await fetch('/supabase_schema.sql');
      const sqlText = await resp.text();
      await navigator.clipboard.writeText(sqlText);
      setCopiedSql(true);
      showStatus('success', 'Script SQL copiado para a área de transferência!');
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      showStatus('error', 'Não foi possível copiar o script.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-3 sm:p-6 bg-stone-950/75 backdrop-blur-xs">
      <div className="relative bg-white rounded-3xl w-full max-w-4xl h-[92vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="px-5 py-4 bg-black text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white p-0.5 shrink-0 overflow-hidden">
              <img
                src="/assets/aistudio/45253110-c633-410d-8e28-6dd548eaa7c2_2efdc5ae.jpg"
                alt="WH Store"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif font-bold text-sm sm:text-base tracking-wide">
                  Painel de Administração
                </h2>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                  WH Store
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 font-light">
                {currentUser?.email && isAuthorizedAdminEmail(currentUser.email, settings)
                  ? `Sessão: ${currentUser.email} (Autorizado)`
                  : authenticatedWithPin
                  ? 'Autenticado via Senha'
                  : 'Autenticação de Segurança'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthorized && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                title="Bloquear painel"
              >
                <Lock className="w-3.5 h-3.5 text-neutral-400" />
                <span>Bloquear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fechar painel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-800 border-b border-red-200'
                : 'bg-stone-100 text-stone-800 border-b border-stone-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              {statusMessage.type === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-600" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Access Gate: Required password entry / Biometrics / Recognized Device */}
        {!isAuthorized ? (
          <div className="flex-1 flex items-center justify-center p-6 bg-neutral-50 overflow-y-auto">
            <div className="max-w-md w-full bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-lg text-center animate-in fade-in zoom-in-95 duration-150 my-auto">
              <div className="w-16 h-16 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto mb-3.5 overflow-hidden p-1 shadow-2xs">
                <img
                  src="/assets/aistudio/45253110-c633-410d-8e28-6dd548eaa7c2_2efdc5ae.jpg"
                  alt="WH Store"
                  className="w-full h-full object-contain"
                />
              </div>
              <h3 className="font-serif font-bold text-black text-xl mb-1">
                Área Exclusiva do Lojista
              </h3>
              <p className="text-xs text-neutral-500 mb-3.5 font-light max-w-xs mx-auto">
                Acesso restrito com reconhecimento de dispositivo e biometria.
              </p>

              {/* Status do Dispositivo Reconhecido (Máx 3 Aparelhos) */}
              <div className="flex items-center justify-center gap-1.5 mb-4 py-1.5 px-3 rounded-full bg-stone-100/90 text-stone-700 text-[11px] font-mono border border-stone-200/80">
                <Smartphone className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                <span className="truncate max-w-[200px]">
                  {isCurrentDeviceRecognized(trustedDevicesList)
                    ? 'Aparelho Reconhecido (Autorizado)'
                    : `Dispositivo: ${currentDeviceName}`}
                </span>
                {isCurrentDeviceRecognized(trustedDevicesList) ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 inline-block" title="Autorizado" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 inline-block" title="Aguardando autorização" />
                )}
                <span className="text-[10px] text-stone-400 font-mono">
                  ({trustedDevicesList.length}/3)
                </span>
              </div>

              {/* Atalho Rápido Exclusivo: Face ID / Biometria (WebAuthn / Passkey) */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={handleBiometricAuth}
                  disabled={isVerifyingPin}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 active:scale-98 text-amber-950 font-semibold text-xs border border-amber-300 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                  title="Entrar com Face ID ou Biometria do aparelho"
                >
                  <ScanFace className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Entrar com Face ID / Biometria</span>
                </button>
              </div>

              {/* Password form - Primary */}
              <form onSubmit={handlePinAuth} className="space-y-3 mb-4">
                <div className="relative">
                  <input
                    type={showUnlockPin ? 'text' : 'password'}
                    required
                    autoFocus
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    placeholder="Digite sua senha de acesso"
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-neutral-300 text-center text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-black focus:border-black font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPin(!showUnlockPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors cursor-pointer p-1"
                    title={showUnlockPin ? 'Ocultar senha' : 'Ver senha'}
                    aria-label="Alternar visibilidade da senha"
                  >
                    {showUnlockPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={isVerifyingPin}
                  className="w-full py-3 rounded-xl bg-black hover:bg-neutral-800 text-white font-semibold text-xs tracking-wide uppercase shadow-sm transition-all active:scale-98 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVerifyingPin ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validando credenciais...</span>
                    </>
                  ) : (
                    <span>Entrar no Painel</span>
                  )}
                </button>
              </form>

              <div className="relative flex py-1.5 items-center">
                <div className="flex-grow border-t border-neutral-200"></div>
                <span className="flex-shrink mx-3 text-neutral-400 text-[10px] uppercase font-mono tracking-wider">
                  ou autenticar via Google
                </span>
                <div className="flex-grow border-t border-neutral-200"></div>
              </div>

              {/* Secondary Google Login */}
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium text-xs border border-neutral-300 transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Entrar com Google Autorizado</span>
                </button>

                {/* Ajuda de Domínio Autorizado (Google / Netlify) */}
                {showDomainHelp && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-left text-xs text-amber-950 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between font-semibold text-amber-900">
                      <span className="flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                        Liberar Login Google no Netlify
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDomainHelp(false)}
                        className="text-amber-500 hover:text-amber-800 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-amber-900/90 leading-relaxed">
                      O Google exige que o link de acesso esteja cadastrado no Firebase. Copie o seu domínio abaixo e adicione na lista:
                    </p>

                    <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-300 font-mono text-[11px] text-stone-800">
                      <span className="truncate flex-1 select-all font-semibold text-black">
                        {currentHostname || 'wh-store.netlify.app'}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyHostname}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-sans font-medium transition-colors shrink-0 cursor-pointer"
                      >
                        {copiedDomain ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedDomain ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>

                    <div className="pt-1 flex flex-col sm:flex-row gap-2">
                      <a
                        href="https://console.firebase.google.com/project/mercurial-plate-rbcxw/authentication/settings"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir Configurações do Firebase</span>
                      </a>
                    </div>
                    <p className="text-[10px] text-amber-800/80 italic">
                      Dica: Você não precisa do Google! O acesso funciona perfeitamente digitando a senha do administrador ou utilizando o Face ID / Biometria acima.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Navigation Tabs (Mobile-Friendly Horizontal Scroll & Touch) */}
            <div className="w-full max-w-full overflow-x-auto touch-pan-x overscroll-x-contain flex items-center border-b border-neutral-200 bg-neutral-50 px-2 sm:px-4 shrink-0 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
              <div className="flex items-center gap-1 sm:gap-3 min-w-max">
                <button
                  onClick={() => {
                    setActiveTab('produtos');
                    setIsCreatingProduct(false);
                    setEditingProduct(null);
                  }}
                  className={`flex items-center gap-1.5 py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'produtos'
                      ? 'border-black text-black font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Produtos ({settings.products.length})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('gestao');
                    setIsCreatingProduct(false);
                    setEditingProduct(null);
                  }}
                  className={`flex items-center gap-1.5 py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'gestao'
                      ? 'border-black text-black font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  <span>Gestão & Finanças</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                    ERP
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('whatsapp')}
                  className={`flex items-center gap-1.5 py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'whatsapp'
                      ? 'border-black text-black font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => setActiveTab('banner')}
                  className={`flex items-center gap-1.5 py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'banner'
                      ? 'border-black text-black font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Banners</span>
                </button>

                <button
                  onClick={() => setActiveTab('supabase')}
                  className={`flex items-center gap-1.5 py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'supabase'
                      ? 'border-emerald-600 text-emerald-800 font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  <span>Supabase (PostgreSQL)</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold uppercase tracking-wider">
                    Novo
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('seguranca')}
                  className={`flex items-center gap-1.5 py-3 px-2.5 sm:px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === 'seguranca'
                      ? 'border-black text-black font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-black'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="sm:hidden">Segurança & Sync</span>
                  <span className="hidden sm:inline">Segurança & Sincronização</span>
                </button>
              </div>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {/* TAB 1: PRODUTOS */}
              {activeTab === 'produtos' && (
                <div>
                  {isCreatingProduct || editingProduct ? (
                    /* Product Form (Create / Edit) */
                    <form onSubmit={handleSaveProduct} className="max-w-2xl mx-auto space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                        <h3 className="font-serif font-bold text-stone-900 text-lg">
                          {editingProduct ? 'Editar Produto' : 'Cadastrar Novo Produto'}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingProduct(false);
                            setEditingProduct(null);
                          }}
                          className="text-xs text-stone-500 hover:text-stone-800 underline"
                        >
                          Voltar à lista
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-stone-700 mb-1">
                            Nome do Produto *
                          </label>
                          <input
                            type="text"
                            required
                            value={productForm.name}
                            onChange={(e) =>
                              setProductForm({ ...productForm, name: e.target.value })
                            }
                            placeholder="Ex: Brinco Argola Cravejada Prata 925"
                            className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold text-stone-700">
                              Categoria do Produto *
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsCategoryManagerOpen(!isCategoryManagerOpen)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>{isCategoryManagerOpen ? 'Fechar edição' : 'Editar categorias da setinha'}</span>
                            </button>
                          </div>

                          {/* Apenas a setinha para escolher as categorias */}
                          <div className="relative">
                            <select
                              required
                              value={productForm.category}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__manage__') {
                                  setIsCategoryManagerOpen(true);
                                } else {
                                  setProductForm({ ...productForm, category: val });
                                }
                              }}
                              className="w-full appearance-none px-3.5 py-2.5 pr-10 rounded-xl border border-stone-300 text-xs sm:text-sm bg-white font-medium text-stone-800 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 cursor-pointer shadow-2xs"
                            >
                              <option value="" disabled>
                                Selecione uma categoria na setinha...
                              </option>
                              {dropdownCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                              {productForm.category && !dropdownCategories.includes(productForm.category) && (
                                <option value={productForm.category}>
                                  {productForm.category}
                                </option>
                              )}
                              <option value="__manage__" className="text-amber-800 font-semibold">
                                ⚙️ Editar ou adicionar categorias da setinha...
                              </option>
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-stone-500">
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>

                          {/* Bloco de Edição e Salvamento de Categorias da Setinha */}
                          {isCategoryManagerOpen && (
                            <div className="mt-3 p-3.5 bg-stone-50 border border-amber-200/90 rounded-xl space-y-3 shadow-xs animate-in fade-in duration-200">
                              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                                <div>
                                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                                    <span>Categorias Ativas (Ordem Alfabética A-Z)</span>
                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium">
                                      {dropdownCategories.length}
                                    </span>
                                  </h4>
                                  <p className="text-[11px] text-stone-500 mt-0.5">
                                    Apenas categorias em uso aparecem na setinha e no catálogo.
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleCleanUnusedCategories}
                                    className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                    title="Excluir todas as categorias que não possuem produtos cadastrados"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Limpar Sem Produtos</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setIsCategoryManagerOpen(false)}
                                    className="text-stone-400 hover:text-stone-700 p-1 rounded-md"
                                    title="Fechar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Adicionar nova categoria à setinha */}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newCategoryName}
                                  onChange={(e) => setNewCategoryName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddNewCategory();
                                    }
                                  }}
                                  placeholder="Nova categoria (ex: Piercings, Berloques...)"
                                  className="flex-1 px-3 py-1.5 bg-white text-xs rounded-lg border border-stone-300 focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddNewCategory()}
                                  className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-medium rounded-lg flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Adicionar A-Z</span>
                                </button>
                              </div>

                              {/* Lista de categorias salvas para editar ou excluir */}
                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {dropdownCategories.map((cat, idx) => {
                                  const prodCount = (settings.products || []).filter(
                                    (p) => (p.category || '').trim().toLowerCase() === cat.trim().toLowerCase()
                                  ).length;

                                  return (
                                    <div
                                      key={cat}
                                      className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs"
                                    >
                                      {editingCategoryKey === cat ? (
                                        <div className="flex items-center gap-1.5 flex-1 mr-2">
                                          <input
                                            type="text"
                                            autoFocus
                                            value={editingCategoryValue}
                                            onChange={(e) => setEditingCategoryValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSaveRenamedCategory(cat);
                                              } else if (e.key === 'Escape') {
                                                setEditingCategoryKey(null);
                                              }
                                            }}
                                            className="w-full px-2 py-1 text-xs border border-amber-400 rounded focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            title="Salvar alteração"
                                            onClick={() => handleSaveRenamedCategory(cat)}
                                            className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded cursor-pointer"
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            title="Cancelar"
                                            onClick={() => setEditingCategoryKey(null)}
                                            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded cursor-pointer"
                                          >
                                            <X className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-2 truncate mr-2">
                                          <span className="text-[10px] font-mono text-stone-400 w-4 text-center">
                                            {idx + 1}.
                                          </span>
                                          <span className="font-semibold text-stone-800 truncate">{cat}</span>
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
                                            {prodCount} {prodCount === 1 ? 'produto' : 'produtos'}
                                          </span>
                                        </div>
                                      )}

                                      {editingCategoryKey !== cat && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            title="Editar nome desta categoria"
                                            onClick={() => {
                                              setEditingCategoryKey(cat);
                                              setEditingCategoryValue(cat);
                                            }}
                                            className="p-1 text-stone-500 hover:text-amber-800 hover:bg-amber-50 rounded cursor-pointer transition-colors"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            title="Excluir da setinha"
                                            onClick={() => handleDeleteCategory(cat)}
                                            className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Preço em Reais (R$) *
                          </label>
                          <input
                            type="text"
                            required
                            value={productForm.price}
                            onChange={(e) =>
                              setProductForm({ ...productForm, price: e.target.value })
                            }
                            placeholder="Ex: 159.90"
                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm focus:ring-1 focus:ring-black focus:border-black"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-700 mb-1">
                            Informação de Parcelamento (opcional)
                          </label>
                          <input
                            type="text"
                            value={productForm.installments}
                            onChange={(e) =>
                              setProductForm({
                                ...productForm,
                                installments: e.target.value,
                              })
                            }
                            placeholder="Ex: ou até 3x de R$ 53,30 sem juros"
                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-sm focus:ring-1 focus:ring-black focus:border-black"
                          />
                        </div>
                      </div>

                      {/* Fotos do Produto (Até 4 fotos) */}
                      <div className="space-y-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5" />
                              Fotos do Produto (Até 4 fotos HD)
                            </h4>
                            <p className="text-[11px] text-neutral-500">
                              Adicione fotos de diferentes ângulos ou no corpo para valorizar a joia.
                            </p>
                          </div>
                          {imageOptimizing && (
                            <span className="text-[11px] text-neutral-600 font-medium flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              Otimizando HD...
                            </span>
                          )}
                        </div>

                        {/* Foto 1 (Principal) */}
                        <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-black">
                              Foto 1 (Principal - Capa da Vitrine) *
                            </label>
                            {productForm.image && (
                              <button
                                type="button"
                                onClick={() => setProductForm((prev) => ({ ...prev, image: '' }))}
                                className="text-[10px] text-red-600 hover:underline cursor-pointer"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <input
                              type="text"
                              value={productForm.image}
                              onChange={(e) =>
                                setProductForm({ ...productForm, image: e.target.value })
                              }
                              placeholder="URL da Foto 1 (https://...)"
                              className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-black focus:border-black"
                            />
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold cursor-pointer border border-neutral-300 transition-colors shrink-0">
                              <Upload className="w-3 h-3" />
                              <span>Upload Foto 1</span>
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={(e) => handleProductImageUpload(e, 'image')}
                                className="hidden"
                              />
                            </label>
                          </div>
                          {Boolean(productForm.image && productForm.image.trim()) && (
                            <div className="flex items-center gap-2.5 pt-1">
                              <img
                                src={productForm.image}
                                alt="Foto 1"
                                className="w-12 h-12 object-cover rounded-lg border border-neutral-200 bg-neutral-100"
                              />
                              <span className="text-[11px] text-neutral-500">Capa do produto definida</span>
                            </div>
                          )}
                        </div>

                        {/* Foto 2 */}
                        <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-neutral-700">
                              Foto 2 (Ângulo adicional / Detalhe)
                            </label>
                            {productForm.image2 && (
                              <button
                                type="button"
                                onClick={() => setProductForm((prev) => ({ ...prev, image2: '' }))}
                                className="text-[10px] text-red-600 hover:underline cursor-pointer"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <input
                              type="text"
                              value={productForm.image2}
                              onChange={(e) =>
                                setProductForm({ ...productForm, image2: e.target.value })
                              }
                              placeholder="URL da Foto 2 (opcional)"
                              className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-black focus:border-black"
                            />
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold cursor-pointer border border-neutral-300 transition-colors shrink-0">
                              <Upload className="w-3 h-3" />
                              <span>Upload Foto 2</span>
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={(e) => handleProductImageUpload(e, 'image2')}
                                className="hidden"
                              />
                            </label>
                          </div>
                          {Boolean(productForm.image2 && productForm.image2.trim()) && (
                            <div className="flex items-center gap-2.5 pt-1">
                              <img
                                src={productForm.image2}
                                alt="Foto 2"
                                className="w-12 h-12 object-cover rounded-lg border border-neutral-200 bg-neutral-100"
                              />
                              <span className="text-[11px] text-neutral-500">Foto secundária salva</span>
                            </div>
                          )}
                        </div>

                        {/* Foto 3 */}
                        <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-neutral-700">
                              Foto 3 (No corpo / Outro ângulo)
                            </label>
                            {productForm.image3 && (
                              <button
                                type="button"
                                onClick={() => setProductForm((prev) => ({ ...prev, image3: '' }))}
                                className="text-[10px] text-red-600 hover:underline cursor-pointer"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <input
                              type="text"
                              value={productForm.image3}
                              onChange={(e) =>
                                setProductForm({ ...productForm, image3: e.target.value })
                              }
                              placeholder="URL da Foto 3 (opcional)"
                              className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-black focus:border-black"
                            />
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold cursor-pointer border border-neutral-300 transition-colors shrink-0">
                              <Upload className="w-3 h-3" />
                              <span>Upload Foto 3</span>
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={(e) => handleProductImageUpload(e, 'image3')}
                                className="hidden"
                              />
                            </label>
                          </div>
                          {Boolean(productForm.image3 && productForm.image3.trim()) && (
                            <div className="flex items-center gap-2.5 pt-1">
                              <img
                                src={productForm.image3}
                                alt="Foto 3"
                                className="w-12 h-12 object-cover rounded-lg border border-neutral-200 bg-neutral-100"
                              />
                              <span className="text-[11px] text-neutral-500">Foto 3 salva</span>
                            </div>
                          )}
                        </div>

                        {/* Foto 4 */}
                        <div className="p-3 bg-white rounded-xl border border-neutral-200 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-neutral-700">
                              Foto 4 (Embalagem / Detalhe de acabamento)
                            </label>
                            {productForm.image4 && (
                              <button
                                type="button"
                                onClick={() => setProductForm((prev) => ({ ...prev, image4: '' }))}
                                className="text-[10px] text-red-600 hover:underline cursor-pointer"
                              >
                                Limpar
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <input
                              type="text"
                              value={productForm.image4}
                              onChange={(e) =>
                                setProductForm({ ...productForm, image4: e.target.value })
                              }
                              placeholder="URL da Foto 4 (opcional)"
                              className="flex-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs focus:ring-1 focus:ring-black focus:border-black"
                            />
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold cursor-pointer border border-neutral-300 transition-colors shrink-0">
                              <Upload className="w-3 h-3" />
                              <span>Upload Foto 4</span>
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                onChange={(e) => handleProductImageUpload(e, 'image4')}
                                className="hidden"
                              />
                            </label>
                          </div>
                          {Boolean(productForm.image4 && productForm.image4.trim()) && (
                            <div className="flex items-center gap-2.5 pt-1">
                              <img
                                src={productForm.image4}
                                alt="Foto 4"
                                className="w-12 h-12 object-cover rounded-lg border border-neutral-200 bg-neutral-100"
                              />
                              <span className="text-[11px] text-neutral-500">Foto 4 salva</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Video Upload and URL */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-700 mb-1">
                          Vídeo Demonstrativo do Produto (opcional)
                        </label>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          <input
                            type="text"
                            value={productForm.video}
                            onChange={(e) =>
                              setProductForm({ ...productForm, video: e.target.value })
                            }
                            placeholder="URL do vídeo (MP4 ou link direto)"
                            className="flex-1 px-3.5 py-2 rounded-xl border border-neutral-300 text-sm focus:ring-1 focus:ring-black focus:border-black"
                          />

                          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-semibold cursor-pointer border border-neutral-300 transition-colors">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload de Vídeo</span>
                            <input
                              type="file"
                              accept="video/mp4, video/webm"
                              onChange={handleProductVideoUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {productForm.video && (
                          <div className="mt-2 p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                            <span className="text-neutral-700 truncate max-w-sm">
                              🎬 Vídeo anexado: {productForm.video.substring(0, 45)}...
                            </span>
                            <button
                              type="button"
                              onClick={() => setProductForm({ ...productForm, video: '' })}
                              className="text-red-600 hover:underline cursor-pointer"
                            >
                              Remover
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                          <label className="block text-xs font-semibold text-stone-700">
                            Descrição Detalhada do Produto (Manual & Curada)
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAutoGenerateDescription('detalhado')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-stone-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-colors cursor-pointer"
                              title="Gerar descrição técnica completa com medidas, material e acabamento"
                            >
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>✨ Completa</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutoGenerateDescription('presente')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-stone-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-colors cursor-pointer"
                              title="Gerar descrição focada na experiência de presente e unboxing"
                            >
                              <span>🎁 Presente</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutoGenerateDescription('luxo')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-stone-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 transition-colors cursor-pointer"
                              title="Gerar descrição elegante de alta joalheria"
                            >
                              <span>💎 Luxo</span>
                            </button>
                          </div>
                        </div>
                        <textarea
                          rows={6}
                          value={productForm.description}
                          onChange={(e) =>
                            setProductForm({
                              ...productForm,
                              description: e.target.value,
                            })
                          }
                          placeholder="Detalhes sobre a prata 925, pedrarias, fecho, medidas..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm font-sans leading-relaxed focus:ring-1 focus:ring-black focus:border-black font-mono text-stone-800"
                        />
                        <p className="text-[11px] text-neutral-500 mt-1">
                          ✓ As descrições são detalhadas e formatadas como curadoria manual, com garantia, unboxing e dicas de cuidado.
                        </p>
                      </div>

                      {/* Disponibilidade / Estoque */}
                      <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200">
                        <label className="block text-xs font-semibold text-stone-700 mb-2">
                          Status do Estoque (Disponibilidade para Compra)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setProductForm({ ...productForm, inStock: true })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              productForm.inStock
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${productForm.inStock ? 'bg-white' : 'bg-emerald-500'}`}></span>
                            <span>✓ Disponível para Venda</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setProductForm({ ...productForm, inStock: false })}
                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              !productForm.inStock
                                ? 'bg-red-600 text-white border-red-600 shadow-xs'
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${!productForm.inStock ? 'bg-white' : 'bg-red-500'}`}></span>
                            <span>✕ Esgotado (Pausar Vendas)</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-2">
                          {productForm.inStock
                            ? 'O produto pode ser adicionado à sacola normalmente pelos clientes.'
                            : 'O produto continuará visível no catálogo com o selo "Esgotado", bloqueando a adição à sacola e direcionando dúvidas para o WhatsApp.'}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingProduct(false);
                            setEditingProduct(null);
                            try {
                              sessionStorage.removeItem(PRODUCT_DRAFT_KEY);
                            } catch {
                              // Ignore
                            }
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-medium text-stone-600 hover:bg-stone-100"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving || imageOptimizing}
                          className="px-6 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          {imageOptimizing ? 'Processando imagem...' : isSaving ? 'Salvando...' : 'Salvar Produto'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* Products List */
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                        <div>
                          <h4 className="font-serif font-bold text-stone-900 text-base sm:text-lg">
                            Gerenciamento de Itens na Vitrine
                          </h4>
                          <p className="text-xs text-stone-500 font-light">
                            Pesquise, altere estoque e edite os produtos exibidos na loja.
                          </p>
                        </div>
                        <button
                          onClick={handleOpenNewProduct}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Adicionar Produto</span>
                        </button>
                      </div>

                      {/* Barra de Pesquisa e Filtros Rápidos */}
                      <div className="space-y-3 mb-4 p-3 sm:p-4 rounded-2xl bg-stone-50 border border-stone-200">
                        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
                          {/* Search Input Principal */}
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={adminSearchTerm}
                              onChange={(e) => setAdminSearchTerm(e.target.value)}
                              placeholder="Buscar por nome, código ou categoria..."
                              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 transition-all placeholder:text-stone-400 shadow-2xs font-normal"
                            />
                            {adminSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setAdminSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-900 p-0.5 cursor-pointer"
                                title="Limpar busca"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Filtro por Categoria */}
                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                            <select
                              value={adminCategoryFilter}
                              onChange={(e) => setAdminCategoryFilter(e.target.value)}
                              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 cursor-pointer shadow-2xs"
                            >
                              <option value="Todas">Todas as Categorias</option>
                              {dropdownCategories.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>

                            {/* Filtro por Estoque */}
                            <select
                              value={adminStockFilter}
                              onChange={(e) => setAdminStockFilter(e.target.value as any)}
                              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-900 cursor-pointer shadow-2xs"
                            >
                              <option value="all">Todos os Status</option>
                              <option value="in_stock">Apenas Disponíveis</option>
                              <option value="out_of_stock">Apenas Esgotados</option>
                            </select>
                          </div>
                        </div>

                        {/* Status bar: contagem de produtos e link para limpar */}
                        <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1 border-t border-stone-200/60">
                          <span className="font-mono">
                            Exibindo <strong className="text-stone-900 font-semibold">{filteredAdminProducts.length}</strong> de <strong className="text-stone-900 font-semibold">{settings.products.length}</strong> produtos
                          </span>
                          {(adminSearchTerm || adminCategoryFilter !== 'Todas' || adminStockFilter !== 'all') && (
                            <button
                              type="button"
                              onClick={() => {
                                setAdminSearchTerm('');
                                setAdminCategoryFilter('Todas');
                                setAdminStockFilter('all');
                              }}
                              className="text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer text-[11px]"
                            >
                              Limpar busca e filtros
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto border border-stone-200 rounded-2xl">
                        <table className="w-full text-left text-xs sm:text-sm">
                          <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase text-[11px] font-semibold tracking-wider">
                            <tr>
                              <th className="py-3 px-4">Item</th>
                              <th className="py-3 px-4">Categoria</th>
                              <th className="py-3 px-4">Preço</th>
                              <th className="py-3 px-4 text-center">Estoque</th>
                              <th className="py-3 px-4 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {filteredAdminProducts.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-stone-500">
                                  <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                                  <p className="text-xs font-semibold text-stone-700">
                                    Nenhum produto encontrado
                                    {adminSearchTerm ? ` para "${adminSearchTerm}"` : ''}
                                  </p>
                                  <p className="text-[11px] text-stone-400 mt-0.5">
                                    Tente buscar por outro termo ou selecione outra categoria.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdminSearchTerm('');
                                      setAdminCategoryFilter('Todas');
                                      setAdminStockFilter('all');
                                    }}
                                    className="mt-3 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition-colors cursor-pointer"
                                  >
                                    Limpar Filtros
                                  </button>
                                </td>
                              </tr>
                            ) : (
                              filteredAdminProducts.map((prod) => (
                                <tr key={prod.id} className="hover:bg-stone-50/70 transition-colors">
                                  <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                      <img
                                        src={(prod.image && prod.image.trim()) ? prod.image : 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=300&q=80'}
                                        alt={prod.name}
                                        className="w-10 h-10 rounded-lg object-cover border border-stone-200 bg-stone-100 shrink-0"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src =
                                            'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=300&q=80';
                                        }}
                                      />
                                      <div className="min-w-0">
                                        <p className="font-medium text-stone-900 truncate max-w-[200px] sm:max-w-xs">
                                          {prod.name}
                                        </p>
                                        <p className="text-[11px] text-stone-400">
                                          ID: {prod.id}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="px-2.5 py-1 rounded-full text-[11px] bg-stone-100 text-stone-700 font-medium">
                                      {prod.category}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 font-semibold text-stone-900">
                                    {formatCurrency(prod.price)}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={(e) => handleToggleStock(prod, e)}
                                      disabled={isSaving}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-2xs ${
                                        prod.inStock !== false
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                          : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                                      }`}
                                      title={
                                        prod.inStock !== false
                                          ? 'Clique para marcar como ESGOTADO'
                                          : 'Clique para marcar como DISPONÍVEL'
                                      }
                                    >
                                      <span
                                        className={`w-2 h-2 rounded-full ${
                                          prod.inStock !== false
                                            ? 'bg-emerald-500 animate-pulse'
                                            : 'bg-red-500'
                                        }`}
                                      />
                                      <span>{prod.inStock !== false ? 'Disponível' : 'Esgotado'}</span>
                                    </button>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="inline-flex items-center gap-2">
                                      <button
                                        onClick={() => handleEditProduct(prod)}
                                        className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                                        title="Editar produto"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRequestDelete(prod)}
                                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                        title="Excluir produto"
                                        aria-label={`Excluir ${prod.name}`}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB GESTÃO & FINANÇAS (ERP INTEGRADO) */}
              {activeTab === 'gestao' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-stone-50 border border-stone-200 rounded-2xl">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-stone-900 text-sm sm:text-base">
                          Painel de Gestão WH Store (Vendas, Clientes, Estoque e Finanças)
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Setembro 2026 Sincronizado
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 font-light mt-0.5">
                        Dados oficiais carregados: 74 itens no estoque, investimento de R$ 2.721,87, margem de 30% e taxa de cartão de 5%.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href="/painel.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir em Nova Aba</span>
                      </a>
                    </div>
                  </div>
                  <div className="w-full rounded-2xl overflow-hidden border border-stone-200 shadow-xs bg-white">
                    <iframe
                      src="/painel.html"
                      title="Painel de Gestão WH Store"
                      className="w-full h-[680px] sm:h-[760px] border-0"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: WHATSAPP */}
              {activeTab === 'whatsapp' && (
                <div className="max-w-xl mx-auto py-4">
                  <div className="mb-6">
                    <h3 className="font-serif font-bold text-stone-900 text-lg mb-1">
                      Configuração do WhatsApp Comercial
                    </h3>
                    <p className="text-xs text-stone-500 font-light">
                      Este número recebe todos os pedidos gerados na sacola e os cliques no botão de atendimento do cabeçalho.
                    </p>
                  </div>

                  <form onSubmit={handleSaveWhatsApp} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Número de Telefone Comercial (com código do país e DDD) *
                      </label>
                      <input
                        type="text"
                        value={whatsappInput}
                        onChange={(e) => setWhatsappInput(e.target.value)}
                        placeholder="Ex: 5581989947016"
                        className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                      />
                      <p className="text-[11px] text-stone-400 mt-1">
                        Formato padrão: 55 + DDD (2 dígitos) + 9 dígitos (ex: 5581989947016)
                      </p>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-emerald-900">
                            Testar link direto do WhatsApp
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Verifique se o número abre o chat correto
                          </p>
                        </div>
                        <a
                          href={`https://wa.me/${whatsappInput.replace(/\D/g, '')}?text=Teste%20WH%20Store`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <span>Testar</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold tracking-wide shadow-xs transition-colors"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar Número do WhatsApp'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 3: BANNERS */}
              {activeTab === 'banner' && (
                <div className="max-w-2xl mx-auto py-4">
                  <div className="mb-6">
                    <h3 className="font-serif font-bold text-stone-900 text-lg mb-1">
                      Banner Principal da Vitrine
                    </h3>
                    <p className="text-xs text-stone-500 font-light">
                      Atualize a chamada de destaque, subtítulo e imagem principal do topo da loja.
                    </p>
                  </div>

                  <form onSubmit={handleSaveBanner} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Subtítulo Promocional
                      </label>
                      <input
                        type="text"
                        value={bannerForm.subtitle}
                        onChange={(e) =>
                          setBannerForm({ ...bannerForm, subtitle: e.target.value })
                        }
                        placeholder="Ex: NOVA COLEÇÃO 2026"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Título da Coleção *
                      </label>
                      <input
                        type="text"
                        required
                        value={bannerForm.title}
                        onChange={(e) =>
                          setBannerForm({ ...bannerForm, title: e.target.value })
                        }
                        placeholder="Ex: Elegância e Brilho para Todos os Momentos"
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Descrição Comercial
                      </label>
                      <textarea
                        rows={2}
                        value={bannerForm.description}
                        onChange={(e) =>
                          setBannerForm({ ...bannerForm, description: e.target.value })
                        }
                        placeholder="Texto persuasivo sobre as joias, prata 925 e relógios..."
                        className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Imagem de Fundo do Banner *
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <input
                          type="text"
                          required
                          value={bannerForm.image}
                          onChange={(e) =>
                            setBannerForm({ ...bannerForm, image: e.target.value })
                          }
                          placeholder="URL da imagem (https://...)"
                          className="flex-1 px-3.5 py-2 rounded-xl border border-stone-300 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        />
                        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold cursor-pointer border border-stone-300 transition-colors">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Imagem</span>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            onChange={handleBannerImageUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {/* Banner Preview */}
                      {Boolean(bannerForm.image && bannerForm.image.trim()) && (
                        <div className="mt-3 relative rounded-2xl overflow-hidden h-32 border border-stone-200">
                          <img
                            src={bannerForm.image}
                            alt="Preview banner"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-stone-950/50 flex items-center px-4">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-amber-300">
                                {bannerForm.subtitle}
                              </span>
                              <h4 className="font-serif font-bold text-white text-sm">
                                {bannerForm.title}
                              </h4>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold tracking-wide shadow-xs transition-colors"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar e Atualizar Banner'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB SUPABASE: MIGRAÇÃO & BANCO POSTGRESQL */}
              {activeTab === 'supabase' && (
                <div className="max-w-3xl mx-auto py-4 space-y-6">
                  {/* Status Banner */}
                  <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-serif font-bold text-stone-900 text-base">
                              Supabase PostgreSQL & Storage
                            </h3>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isSupabaseConfigured()
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isSupabaseConfigured() ? '✓ Configurado' : 'Aguardando Credenciais'}
                            </span>
                          </div>
                          <p className="text-xs text-stone-500 font-light mt-0.5">
                            Arquitetura relacional escalável, segura e livre dos limites diários de cotas do plano gratuito.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleTestSupabase}
                          disabled={isTestingSupabase}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 shadow-2xs transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                          <span>{isTestingSupabase ? 'Testando...' : 'Testar Conexão'}</span>
                        </button>
                      </div>
                    </div>

                    {supabaseTestResult && (
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                          supabaseTestResult.ok
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                            : 'bg-red-50 border-red-300 text-red-900'
                        }`}
                      >
                        {supabaseTestResult.ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span>{supabaseTestResult.message}</span>
                      </div>
                    )}
                  </div>

                  {/* Step 1: Configuração de Credenciais */}
                  <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                        1
                      </span>
                      <h4 className="font-semibold text-stone-900 text-sm">
                        Credenciais do Projeto Supabase
                      </h4>
                    </div>
                    <p className="text-xs text-stone-500 font-light">
                      Copie do seu <strong>Dashboard do Supabase</strong> em{' '}
                      <span className="font-mono bg-stone-100 px-1.5 py-0.5 rounded text-stone-800">
                        Project Settings → API
                      </span>
                      :
                    </p>

                    <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-semibold block">Sincronização Centralizada entre Dispositivos:</strong>
                        <span className="text-[11px] text-emerald-800 font-light leading-relaxed">
                          Ao salvar as credenciais abaixo, elas são gravadas no servidor central e compartilhadas automaticamente com qualquer celular, tablet ou computador que abrir o catálogo. Você não precisará digitar novamente em outro aparelho!
                        </span>
                      </div>
                    </div>

                    <form onSubmit={handleSaveSupabaseCreds} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Project URL (URL do Projeto)
                        </label>
                        <input
                          type="url"
                          value={supabaseUrlInput}
                          onChange={(e) => setSupabaseUrlInput(e.target.value)}
                          placeholder="Ex: https://xyzcompany.supabase.co"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-black"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-700 mb-1">
                          Anon Public API Key (Chave Pública Anon)
                        </label>
                        <input
                          type="password"
                          value={supabaseAnonKeyInput}
                          onChange={(e) => setSupabaseAnonKeyInput(e.target.value)}
                          placeholder="Ex: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-black"
                          required
                        />
                        <span className="text-[10px] text-stone-400 block mt-1">
                          A chave anon pública é segura para o navegador, pois a proteção de leitura e escrita é gerenciada pelo Row Level Security (RLS).
                        </span>
                      </div>

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={isTestingSupabase}
                          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvar Credenciais e Conectar</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Step 2: Executar Script SQL no Supabase */}
                  <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                        2
                      </span>
                      <h4 className="font-semibold text-stone-900 text-sm">
                        Criar Tabelas e Políticas de Segurança (SQL)
                      </h4>
                    </div>
                    <p className="text-xs text-stone-500 font-light leading-relaxed">
                      Criamos o script DDL oficial com todas as tabelas (<code>products</code>, <code>product_images</code>, <code>banners</code>, <code>categories</code>, <code>store_settings</code>), regras de segurança RLS e buckets no Storage.
                    </p>

                    <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                      <div className="text-xs font-semibold text-stone-800">Instruções rápidas:</div>
                      <ol className="text-xs text-stone-600 list-decimal pl-5 space-y-1">
                        <li>Abra seu painel no Supabase e acesse o menu <strong>SQL Editor</strong>.</li>
                        <li>Clique no botão abaixo para copiar o script SQL completo.</li>
                        <li>Cole no editor do Supabase e clique no botão verde <strong>Run</strong> (Executar).</li>
                      </ol>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCopySqlScript}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>✓ Script SQL Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Script SQL Completo (supabase_schema.sql)</span>
                          </>
                        )}
                      </button>

                      <a
                        href="/supabase_schema.sql"
                        download="supabase_schema.sql"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold transition-colors cursor-pointer border border-stone-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Baixar Arquivo .sql</span>
                      </a>
                    </div>
                  </div>

                  {/* Step 3: Migração de Dados Automática */}
                  <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <h4 className="font-semibold text-stone-900 text-sm">
                          Migração Automática de Dados para o Supabase
                        </h4>
                      </div>
                      <span className="text-xs text-stone-500 font-mono">
                        {settings.products.length} produtos disponíveis
                      </span>
                    </div>

                    <p className="text-xs text-stone-500 font-light leading-relaxed">
                      Transfere com segurança todos os produtos, preços, descrições, fotos (otimizadas no Supabase Storage sem Base64 no banco), categorias e banners para o PostgreSQL.
                    </p>

                    {/* Progress Bar (during migration) */}
                    {(isMigratingSupabase || supabaseMigState.status === 'running') && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-emerald-950">
                          <span className="flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                            <span>{supabaseMigState.currentStep}</span>
                          </span>
                          <span>
                            {supabaseMigState.total > 0
                              ? `${Math.round((supabaseMigState.current / supabaseMigState.total) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                        <div className="w-full bg-emerald-200 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                supabaseMigState.total > 0
                                  ? Math.min(100, Math.round((supabaseMigState.current / supabaseMigState.total) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Migration Completed Badge */}
                    {isSupabaseMigrationCompleted() && !isMigratingSupabase && (
                      <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          Migração para o Supabase concluída com sucesso! Todos os registros e fotos estão ativos na nuvem PostgreSQL.
                        </span>
                      </div>
                    )}

                    {/* Error Box */}
                    {supabaseMigState.errors && supabaseMigState.errors.length > 0 && (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-red-900">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>Avisos durante a migração:</span>
                        </div>
                        <ul className="space-y-1 pl-5 list-disc text-[11px] text-red-800">
                          {supabaseMigState.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx}>
                              <strong>{err.item}:</strong> {err.error}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={handleRunSupabaseMigration}
                        disabled={isMigratingSupabase || isSaving}
                        className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${isMigratingSupabase ? 'animate-spin' : ''}`} />
                        <span>
                          {isMigratingSupabase
                            ? 'Executando Migração...'
                            : '🚀 Iniciar Migração Completa para o Supabase'}
                        </span>
                      </button>

                      <p className="text-[11px] text-stone-400 font-light">
                        ✓ Seus dados locais permanecem 100% seguros durante o processo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SEGURANÇA & SINCRONIZAÇÃO */}
              {activeTab === 'seguranca' && (
                <div className="max-w-2xl mx-auto py-4 space-y-6">
                  {/* Sync & Migration Status Card */}
                  <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 rounded-full ${
                              isMigrating || migrationState.status === 'running'
                                ? 'bg-amber-500 animate-pulse'
                                : syncState === 'connected'
                                ? 'bg-emerald-500 ring-4 ring-emerald-100'
                                : syncState === 'syncing'
                                ? 'bg-blue-500 animate-pulse'
                                : migrationState.status === 'error'
                                ? 'bg-red-500 ring-4 ring-red-100'
                                : 'bg-amber-500'
                            }`}
                          />
                          <h4 className="font-semibold text-stone-900 text-sm">
                            Status de Persistência e Sincronização
                          </h4>
                        </div>
                        <p className="text-xs text-stone-500 font-light mt-0.5">
                          Arquitetura independente: Coleções separadas (produtos, banners, configurações) e Firebase Storage
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isMigrating || isSaving}
                          onClick={handleRunMigration}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-black hover:bg-neutral-800 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
                          <span>{isMigrating ? 'Migrando...' : 'Migrar / Sincronizar Tudo'}</span>
                        </button>
                      </div>
                    </div>

                    {/* The 5 Key States Display */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {/* State 1: Sincronizado */}
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                          syncState === 'connected' && !isMigrating
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-stone-200 text-stone-500 opacity-60'
                        }`}
                      >
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${syncState === 'connected' && !isMigrating ? 'text-emerald-600' : 'text-stone-400'}`} />
                        <div>
                          <div className="font-semibold">Sincronizado</div>
                          <div className="text-[11px] font-normal leading-relaxed">
                            {syncState === 'connected' && !isMigrating
                              ? 'Conectado em tempo real ao Firebase Firestore & Storage. Cada produto é um documento individual.'
                              : 'Conexão ativa em tempo real quando sincronizado.'}
                          </div>
                        </div>
                      </div>

                      {/* State 2: Sincronização pendente */}
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                          (syncState === 'local_fallback' || syncState === 'syncing') && !isMigrating
                            ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-medium'
                            : 'bg-white border-stone-200 text-stone-500 opacity-60'
                        }`}
                      >
                        <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${(syncState === 'local_fallback' || syncState === 'syncing') && !isMigrating ? 'text-amber-600' : 'text-stone-400'}`} />
                        <div>
                          <div className="font-semibold">Sincronização Pendente</div>
                          <div className="text-[11px] font-normal leading-relaxed">
                            Alterações salvas localmente no LocalStorage com segurança. Serão enviadas ao Firebase na próxima sincronização.
                          </div>
                        </div>
                      </div>

                      {/* State 3: Migração em andamento */}
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                          isMigrating || migrationState.status === 'running'
                            ? 'bg-blue-50 border-blue-300 text-blue-950 font-medium shadow-xs'
                            : 'bg-white border-stone-200 text-stone-500 opacity-60'
                        }`}
                      >
                        <RefreshCw className={`w-4 h-4 shrink-0 mt-0.5 ${isMigrating || migrationState.status === 'running' ? 'text-blue-600 animate-spin' : 'text-stone-400'}`} />
                        <div className="flex-1">
                          <div className="font-semibold">Migração em Andamento</div>
                          <div className="text-[11px] font-normal leading-relaxed">
                            {isMigrating || migrationState.status === 'running'
                              ? `Etapa ${migrationState.current} de ${migrationState.total}: ${migrationState.currentStep}`
                              : 'Transfere produtos e banners para documentos separados e Storage.'}
                          </div>
                        </div>
                      </div>

                      {/* State 4: Migração concluída */}
                      <div
                        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                          migrationState.status === 'completed' && !isMigrating
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-white border-stone-200 text-stone-500 opacity-60'
                        }`}
                      >
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${migrationState.status === 'completed' && !isMigrating ? 'text-emerald-600' : 'text-stone-400'}`} />
                        <div>
                          <div className="font-semibold">Migração Concluída</div>
                          <div className="text-[11px] font-normal leading-relaxed">
                            {migrationState.completedAt
                              ? `Concluída em ${new Date(migrationState.completedAt).toLocaleString('pt-BR')}. Documentos individuais criados.`
                              : 'Estrutura separada por documento ativa.'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar (during migration) */}
                    {(isMigrating || migrationState.status === 'running') && (
                      <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-blue-900">
                          <span>{migrationState.currentStep}</span>
                          <span>
                            {migrationState.total > 0
                              ? `${Math.round((migrationState.current / migrationState.total) * 100)}%`
                              : '0%'}
                          </span>
                        </div>
                        <div className="w-full bg-blue-200/70 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                migrationState.total > 0
                                  ? Math.min(100, Math.round((migrationState.current / migrationState.total) * 100))
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* State 5: Erro de sincronização / Detalhamento por produto */}
                    {migrationState.errors && migrationState.errors.length > 0 && (
                      <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-red-900">
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                          <span>Status da Sincronização / Detalhes:</span>
                        </div>
                        <ul className="space-y-1.5 pl-6 list-disc text-[11px] text-red-800">
                          {migrationState.errors.map((err, idx) => (
                            <li key={idx}>
                              <strong>{err.item}:</strong> {err.error}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[10px] text-stone-500 pt-1">
                          Nota: Os dados locais foram preservados no LocalStorage e nenhum produto foi apagado.
                        </p>
                      </div>
                    )}

                    {/* Dedicated Quota Limit Notification Banner */}
                    {isWriteQuotaExhausted() && (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-semibold text-amber-950 text-xs flex items-center gap-1.5">
                            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Cota Diária Gratuita de Gravações Atingida (Firestore)</span>
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={async () => {
                                resetWriteQuotaCircuitBreaker();
                                if (onForceSync) await onForceSync();
                                showStatus('info', 'Tentando reconectar ao Firestore...');
                              }}
                              className="text-[11px] font-semibold text-amber-900 hover:text-black underline cursor-pointer"
                            >
                              Testar Reconexão
                            </button>
                            <a
                              href="https://console.firebase.google.com/project/mercurial-plate-rbcxw/firestore/databases/ai-studio-whstorecatlogojo-ffa8d47d-479a-4516-9635-5dd2b1c799fb/data?openUpgradeDialog=true"
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-amber-900 hover:text-black font-semibold underline inline-flex items-center gap-1"
                            >
                              <span>Ver Cota no Console</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                        <p className="text-[11px] text-amber-900/90 leading-relaxed font-light">
                          O limite diário gratuito de 20.000 gravações do plano Spark foi atingido no Firebase. A cota será reiniciada automaticamente amanhã pelo Google, ou você pode ativar o faturamento no console para gravações ilimitadas. <strong>Seus produtos, fotos e edições permanecem 100% salvos e protegidos no LocalStorage da sua máquina.</strong>
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono pt-1">
                      <span>Produtos cadastrados: {settings.products.length}</span>
                      <span>
                        Última alteração:{' '}
                        {settings.updatedAt ? new Date(settings.updatedAt).toLocaleString('pt-BR') : 'Recente'}
                      </span>
                    </div>
                  </div>

                  {/* Auth Card & Authorized Emails Management */}
                  <div className="p-5 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-stone-700" />
                          <span>E-mails Autorizados para Acesso Administrativo (Google Auth)</span>
                        </h4>
                        <p className="text-xs text-stone-500 font-light mt-0.5">
                          Apenas contas Google com e-mails explicitamente salvos abaixo conseguem entrar no painel.
                        </p>
                      </div>
                    </div>

                    {/* Current Session Status */}
                    <div className="bg-white p-4 rounded-xl border border-stone-200">
                      <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-2">
                        Status da Sessão Atual
                      </div>
                      {currentUser ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {currentUser.email ? currentUser.email.charAt(0) : 'A'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-stone-900">
                                  {currentUser.displayName || 'Administrador'}
                                </p>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-medium">
                                  ✓ Autorizado
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600 font-mono">{currentUser.email}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-stone-700 hover:text-red-700 hover:bg-red-50 border border-stone-200 transition-colors cursor-pointer self-start sm:self-auto"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Desconectar Sessão</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 text-stone-600">
                              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                              <p className="text-xs">
                                Nenhuma conta Google conectada. Desbloqueado via senha local.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleGoogleLogin}
                              disabled={isSaving}
                              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Conectar Google Autorizado</span>
                            </button>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[11px]">
                            <span className="text-stone-400">
                              Gerencie produtos livremente com sua Senha de Acesso.
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowDomainHelp(!showDomainHelp)}
                              className="text-stone-500 hover:text-black underline font-medium cursor-pointer"
                            >
                              {showDomainHelp ? 'Ocultar instruções de domínio' : 'Ajuda sobre Domínio no Firebase'}
                            </button>
                          </div>

                          {/* Domain Authorization Helper */}
                          {showDomainHelp && (
                            <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 space-y-3 animate-in fade-in duration-150">
                              <div className="flex items-center justify-between font-semibold text-amber-900">
                                <span className="flex items-center gap-1.5">
                                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                  Liberar Login com Google no Site e no Studio
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowDomainHelp(false)}
                                  className="text-amber-500 hover:text-amber-800 p-0.5 cursor-pointer"
                                  aria-label="Fechar ajuda"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <p className="text-[11px] text-amber-900/90 leading-relaxed">
                                O Google exige que <strong>cada link</strong> em que o site for acessado esteja na lista de domínios autorizados do Firebase. Como você já liberou no Studio, basta adicionar agora o <strong>Link do Site Público</strong>:
                              </p>

                              {/* Site Público (ais-pre...) */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                                  1. Link do Site Público (Onde seus clientes acessam):
                                </span>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-300 font-mono text-[11px] text-stone-800 shadow-2xs">
                                  <span className="truncate flex-1 select-all font-semibold text-black">
                                    ais-pre-hgoap2aefimh3uynkeo2ph-734119795849.us-west2.run.app
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyCustom(
                                        'ais-pre-hgoap2aefimh3uynkeo2ph-734119795849.us-west2.run.app'
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-950 text-[11px] font-sans font-medium transition-colors shrink-0 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar Site</span>
                                  </button>
                                </div>
                              </div>

                              {/* Studio / Dev (ais-dev...) */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                                  2. Link do Studio AI (Ambiente de edição):
                                </span>
                                <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-amber-200 font-mono text-[11px] text-stone-700">
                                  <span className="truncate flex-1 select-all">
                                    ais-dev-hgoap2aefimh3uynkeo2ph-734119795849.us-west2.run.app
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyCustom(
                                        'ais-dev-hgoap2aefimh3uynkeo2ph-734119795849.us-west2.run.app'
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-sans font-medium transition-colors shrink-0 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar Studio</span>
                                  </button>
                                </div>
                              </div>

                              <div className="text-[11px] text-amber-900/90 space-y-1.5 pt-1 border-t border-amber-200/60">
                                <p className="font-semibold">Como cadastrar no Firebase (1 minuto):</p>
                                <ol className="list-decimal pl-4 space-y-1 text-stone-800">
                                  <li>
                                    Abra o Console Firebase (Projeto <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-200 text-[10px]">mercurial-plate-rbcxw</code>)
                                  </li>
                                  <li>
                                    Vá em <strong>Authentication</strong> &gt; aba <strong>Configurações</strong> &gt; <strong>Domínios autorizados</strong>
                                  </li>
                                  <li>
                                    Clique em <strong>Adicionar domínio</strong> e cole o <strong>Link do Site Público</strong> copiado no item 1 acima.
                                  </li>
                                  <li>
                                    Caso apareça erro de Token Service API, clique para{' '}
                                    <a
                                      href="https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=450022699385"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold underline text-amber-950 hover:text-black"
                                    >
                                      Ativar a API Token Service no Google Cloud (1 clique)
                                    </a>.
                                  </li>
                                </ol>
                              </div>
                              <p className="text-[10px] text-emerald-800 font-medium pt-0.5">
                                ✓ Lembre-se: O catálogo e o painel continuam funcionando 100% com sincronização em nuvem usando a sua <strong>Senha do Lojista</strong> a qualquer momento!
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Authorized Emails List */}
                    <div className="bg-white p-4 rounded-xl border border-stone-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-900">
                          Lista de E-mails com Permissão ({authorizedEmailsList.length})
                        </span>
                        <span className="text-[10px] text-stone-400">
                          Tentativas com outros e-mails são bloqueadas
                        </span>
                      </div>

                      {/* Chips / List */}
                      <div className="space-y-2">
                        {authorizedEmailsList.map((email) => {
                          const isPrimary = email.toLowerCase() === 'wellysondasilva92@gmail.com';
                          return (
                            <div
                              key={email}
                              className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                <span className="font-mono text-stone-800 truncate">{email}</span>
                                {isPrimary && (
                                  <span className="shrink-0 px-2 py-0.5 rounded text-[9px] bg-stone-200 text-stone-700 font-medium">
                                    Proprietário
                                  </span>
                                )}
                              </div>
                              {!isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAuthorizedEmail(email)}
                                  className="text-stone-400 hover:text-red-600 p-1 cursor-pointer transition-colors"
                                  title={`Remover ${email}`}
                                  aria-label={`Remover ${email}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Add new email input */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <div className="relative flex-1">
                          <input
                            type="email"
                            value={newEmailInput}
                            onChange={(e) => setNewEmailInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAuthorizedEmail();
                              }
                            }}
                            placeholder="Adicionar novo e-mail (ex: seuemail@gmail.com)"
                            className="w-full pl-3.5 pr-3 py-2 rounded-lg border border-stone-300 text-xs font-mono focus:ring-2 focus:ring-black focus:border-black"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddAuthorizedEmail}
                          className="px-3.5 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium border border-stone-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar</span>
                        </button>
                      </div>

                      {/* Save Authorized Emails Button */}
                      <div className="pt-2 border-t border-stone-100">
                        <button
                          type="button"
                          onClick={handleSaveAuthorizedEmails}
                          disabled={isSaving}
                          className="w-full py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {isSaving ? 'Salvando...' : 'Salvar Lista de E-mails Autorizados'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Password Management */}
                  <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-black text-sm">
                        Alterar Senha de Acesso do Lojista
                      </h4>
                      <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-full bg-neutral-200 text-neutral-800 font-mono text-xs border border-neutral-300">
                        <span>
                          Senha ativa: {showActivePin ? (settings.adminPin || 'Não configurada') : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowActivePin(!showActivePin)}
                          className="text-neutral-500 hover:text-black cursor-pointer p-0.5 ml-1"
                          title={showActivePin ? 'Ocultar senha ativa' : 'Ver senha ativa'}
                        >
                          {showActivePin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500 mb-4 font-light">
                      Esta senha bloqueia o acesso ao painel contra visitantes e clientes toda vez que clicarem no botão "Lojista".
                    </p>

                    <form onSubmit={handleSaveNewPin} className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <input
                          type={showNewPin ? 'text' : 'password'}
                          required
                          value={customNewPin}
                          onChange={(e) => setCustomNewPin(e.target.value)}
                          placeholder="Digite a nova senha desejada"
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-neutral-300 text-xs sm:text-sm focus:ring-2 focus:ring-black focus:border-black font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPin(!showNewPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer p-0.5"
                          title={showNewPin ? 'Ocultar senha' : 'Ver senha'}
                          aria-label="Ver ou ocultar senha"
                        >
                          {showNewPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold tracking-wide transition-colors cursor-pointer"
                      >
                        {isSaving ? 'Salvando...' : 'Salvar Nova Senha'}
                      </button>
                    </form>
                  </div>

                  {/* Trusted Devices (Máx 2 Pessoas / Aparelhos) */}
                  <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-amber-700" />
                          <h4 className="font-semibold text-black text-sm">
                            Dispositivos Reconhecidos (Limite de 3 Aparelhos)
                          </h4>
                        </div>
                        <p className="text-xs text-neutral-500 font-light mt-0.5">
                          Apenas os 3 aparelhos autorizados (Computador Principal, Celular do Lojista e Celular da Esposa) podem acessar o painel com Face ID / Biometria ou senha.
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-amber-100 text-amber-900 border border-amber-300 self-start sm:self-auto">
                        {trustedDevicesList.length} de 3 aparelhos
                      </span>
                    </div>

                    {/* Lista dos 3 Dispositivos Autorizados */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Slot 1: Computador do Lojista (Edição Principal) */}
                      {trustedDevicesList[0] ? (
                        <div className="p-3.5 rounded-xl bg-white border border-stone-200 text-xs space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                              <span className="truncate">{trustedDevicesList[0].name || 'Computador (Edição Principal)'}</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">
                              Slot 1 Ativo
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono space-y-0.5">
                            <p>Plataforma: {trustedDevicesList[0].platform || 'Desktop/Web'}</p>
                            <p>
                              Cadastrado:{' '}
                              {new Date(trustedDevicesList[0].registeredAt).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-emerald-700 font-medium">
                              {trustedDevicesList[0].hasBiometrics
                                ? '✓ Face ID / Biometria Ativa'
                                : '• Senha Autorizada'}
                            </p>
                          </div>
                          {trustedDevicesList[0].id === currentDeviceId && (
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                              Este aparelho atual
                            </span>
                          )}
                          <div className="pt-1 border-t border-stone-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(trustedDevicesList[0].id)}
                              className="text-stone-400 hover:text-red-600 text-[11px] font-medium cursor-pointer transition-colors"
                            >
                              Remover / Substituir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-white border border-dashed border-stone-300 text-center text-xs space-y-2 flex flex-col items-center justify-center min-h-[120px]">
                          <Smartphone className="w-6 h-6 text-stone-400" />
                          <span className="font-medium text-stone-800">Slot 1: Computador Principal</span>
                          <p className="text-[10px] text-stone-400 max-w-[200px]">
                            Onde você faz as alterações maiores e cadastros.
                          </p>
                          {!isCurrentDeviceRecognized(trustedDevicesList) && (
                            <button
                              type="button"
                              onClick={handleRegisterThisDevice}
                              className="py-1 px-3 rounded-lg bg-black text-white text-[11px] font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              Cadastrar Este Aparelho
                            </button>
                          )}
                        </div>
                      )}

                      {/* Slot 2: Celular do Lojista */}
                      {trustedDevicesList[1] ? (
                        <div className="p-3.5 rounded-xl bg-white border border-stone-200 text-xs space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                              <span className="truncate">{trustedDevicesList[1].name || 'Celular do Lojista'}</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">
                              Slot 2 Ativo
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono space-y-0.5">
                            <p>Plataforma: {trustedDevicesList[1].platform || 'Mobile/Web'}</p>
                            <p>
                              Cadastrado:{' '}
                              {new Date(trustedDevicesList[1].registeredAt).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-emerald-700 font-medium">
                              {trustedDevicesList[1].hasBiometrics
                                ? '✓ Face ID / Biometria Ativa'
                                : '• Senha Autorizada'}
                            </p>
                          </div>
                          {trustedDevicesList[1].id === currentDeviceId && (
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                              Este aparelho atual
                            </span>
                          )}
                          <div className="pt-1 border-t border-stone-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(trustedDevicesList[1].id)}
                              className="text-stone-400 hover:text-red-600 text-[11px] font-medium cursor-pointer transition-colors"
                            >
                              Remover / Substituir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-white border border-dashed border-stone-300 text-center text-xs space-y-2 flex flex-col items-center justify-center min-h-[120px]">
                          <Smartphone className="w-6 h-6 text-stone-400" />
                          <span className="font-medium text-stone-800">Slot 2: Celular do Lojista</span>
                          <p className="text-[10px] text-stone-400 max-w-[200px]">
                            Acesso móvel rápido com Face ID ou biometria.
                          </p>
                          {!isCurrentDeviceRecognized(trustedDevicesList) && (
                            <button
                              type="button"
                              onClick={handleRegisterThisDevice}
                              className="py-1 px-3 rounded-lg bg-black text-white text-[11px] font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              Cadastrar Este Aparelho
                            </button>
                          )}
                        </div>
                      )}

                      {/* Slot 3: Celular da Esposa */}
                      {trustedDevicesList[2] ? (
                        <div className="p-3.5 rounded-xl bg-white border border-stone-200 text-xs space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-stone-900 truncate flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                              <span className="truncate">{trustedDevicesList[2].name || 'Celular da Esposa'}</span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 shrink-0">
                              Slot 3 Ativo
                            </span>
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono space-y-0.5">
                            <p>Plataforma: {trustedDevicesList[2].platform || 'Mobile/Web'}</p>
                            <p>
                              Cadastrado:{' '}
                              {new Date(trustedDevicesList[2].registeredAt).toLocaleDateString('pt-BR')}
                            </p>
                            <p className="text-emerald-700 font-medium">
                              {trustedDevicesList[2].hasBiometrics
                                ? '✓ Face ID / Biometria Ativa'
                                : '• Senha Autorizada'}
                            </p>
                          </div>
                          {trustedDevicesList[2].id === currentDeviceId && (
                            <span className="inline-block text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                              Este aparelho atual
                            </span>
                          )}
                          <div className="pt-1 border-t border-stone-100 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRevokeDevice(trustedDevicesList[2].id)}
                              className="text-stone-400 hover:text-red-600 text-[11px] font-medium cursor-pointer transition-colors"
                            >
                              Remover / Substituir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-white border border-dashed border-stone-300 text-center text-xs space-y-2 flex flex-col items-center justify-center min-h-[120px]">
                          <Smartphone className="w-6 h-6 text-stone-400" />
                          <span className="font-medium text-stone-800">Slot 3: Celular da Esposa</span>
                          <p className="text-[10px] text-stone-400 max-w-[200px]">
                            Abra o link no celular dela e entre com a senha do lojista para ativar o Face ID.
                          </p>
                          {!isCurrentDeviceRecognized(trustedDevicesList) && (
                            <button
                              type="button"
                              onClick={handleRegisterThisDevice}
                              className="py-1 px-3 rounded-lg bg-black text-white text-[11px] font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
                            >
                              Cadastrar Este Aparelho
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ações Biométricas no Aparelho Atual */}
                    <div className="pt-2 border-t border-stone-200">
                      <button
                        type="button"
                        onClick={handleRegisterBiometricsOnCurrentDevice}
                        disabled={isSaving}
                        className="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-semibold border border-amber-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <ScanFace className="w-4 h-4 text-amber-700" />
                        <span>Cadastrar Face ID / Biometria neste Aparelho</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* In-App Deletion Confirmation Modal (Safe for mobile & iframe environments) */}
        {productToDelete && (
          <div className="fixed inset-0 z-70 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 border border-neutral-200 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-serif font-bold text-base text-black mb-1">
                Excluir Produto?
              </h4>
              <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
                Tem certeza de que deseja remover <span className="font-semibold text-black">"{productToDelete.name}"</span> do catálogo?
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-97 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
