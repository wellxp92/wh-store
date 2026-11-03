export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  installments?: string;
  image: string; // Foto principal (Foto 1)
  images?: string[]; // Lista de até 4 fotos [foto1, foto2, foto3, foto4]
  video?: string; // Opcional: vídeo demonstrativo (mp4/webm)
  description?: string;
  inStock?: boolean;
}

export interface BannerConfig {
  subtitle: string;
  title: string;
  description: string;
  image: string;
}

export interface StoreSettings {
  products: Product[];
  whatsappNumber: string;
  banner: BannerConfig;
  categories?: string[];
  adminPin?: string;
  previousAdminPin?: string;
  authorizedEmails?: string[];
  updatedAt?: string;
  updatedBy?: string;
  isFullCatalog?: boolean;
  chunkCount?: number;
  totalProductCount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type SyncState = 'connected' | 'syncing' | 'local_fallback' | 'error' | 'supabase_connected' | 'supabase_syncing';

export type MigrationStatus = 'idle' | 'running' | 'completed' | 'error';

export interface MigrationState {
  status: MigrationStatus;
  current: number;
  total: number;
  currentStep: string;
  errors: { item: string; error: string }[];
  completedAt?: string;
}
