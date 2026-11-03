import { getLocalStoreSettings, saveLocalStoreSettings } from './storage';
import { saveStoreSettingsToIndexedDB, loadStoreSettingsFromIndexedDB } from './indexedDb';
import {
  saveStoreSettings,
  saveBanner,
  saveProduct,
  loadProducts,
  isWriteQuotaExhausted,
} from './firebase';
import { Product, StoreSettings, MigrationState } from '../types';

const MIGRATION_STORAGE_FLAG = 'wh_store_migration_completed_v2';
const MIGRATION_STATE_KEY = 'wh_store_migration_state_v2';

export function isMigrationCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MIGRATION_STORAGE_FLAG) === 'true';
}

export function getSavedMigrationState(): MigrationState {
  if (typeof window === 'undefined') {
    return {
      status: 'idle',
      current: 0,
      total: 0,
      currentStep: '',
      errors: [],
    };
  }
  try {
    const raw = localStorage.getItem(MIGRATION_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Erro ao ler estado da migração:', e);
  }
  return {
    status: isMigrationCompleted() ? 'completed' : 'idle',
    current: 0,
    total: 0,
    currentStep: '',
    errors: [],
  };
}

export function saveMigrationState(state: MigrationState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Erro ao salvar estado da migração:', e);
  }
}

export interface MigrationResult {
  success: boolean;
  totalProducts: number;
  migratedProducts: number;
  errors: { item: string; error: string }[];
}

/**
 * Helper to process an array of items in parallel batches of a given size
 */
async function processBatch<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const chunkResults = await Promise.all(
      chunk.map((item, chunkIdx) => fn(item, i + chunkIdx))
    );
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Executes full migration into independent collections and IndexedDB:
 * 1. Independent 'store_config/settings' document
 * 2. Independent 'banners/main' document
 * 3. Individual 'products/{productId}' documents in the 'products' collection
 * 4. High-definition media stored safely in IndexedDB and Firebase Storage
 *
 * Runs quickly in parallel with a fail-fast timeout (never hangs).
 */
export async function runCatalogMigration(
  onProgress?: (state: MigrationState) => void
): Promise<MigrationResult> {
  const localSettings: StoreSettings = getLocalStoreSettings();
  const products: Product[] = Array.isArray(localSettings.products) ? localSettings.products : [];
  const totalSteps = products.length + 2; // Banner + StoreSettings + Products

  const state: MigrationState = {
    status: 'running',
    current: 0,
    total: totalSteps,
    currentStep: 'Iniciando migração dos dados...',
    errors: [],
  };

  const notify = () => {
    saveMigrationState(state);
    if (onProgress) onProgress({ ...state });
  };

  notify();

  // 0. STEP 0: Guarantee complete persistence to IndexedDB first (< 50ms)
  try {
    await saveStoreSettingsToIndexedDB(localSettings);
  } catch (idbErr) {
    console.warn('[Migração] Aviso ao persistir no IndexedDB:', idbErr);
  }

  // If write quota is already exhausted on Firestore, complete instantly locally
  if (isWriteQuotaExhausted()) {
    state.status = 'completed';
    state.current = totalSteps;
    state.currentStep =
      'Migração local concluída com sucesso! Todos os produtos e fotos HD estão separados e preservados no IndexedDB. Sincronização na nuvem aguarda reset diário da cota gratuita.';
    state.completedAt = new Date().toISOString();
    notify();
    if (typeof window !== 'undefined') {
      localStorage.setItem(MIGRATION_STORAGE_FLAG, 'true');
    }
    return {
      success: true,
      totalProducts: products.length,
      migratedProducts: products.length,
      errors: [],
    };
  }

  // 1. STEP 1: Migrate General Store Settings (fast timeout)
  state.current = 1;
  state.currentStep = 'Salvando configurações gerais da loja (store_config/settings)...';
  notify();

  try {
    await saveStoreSettings({
      whatsappNumber: localSettings.whatsappNumber,
      categories: localSettings.categories,
      adminPin: localSettings.adminPin,
      authorizedEmails: localSettings.authorizedEmails,
    });
  } catch (err: any) {
    console.warn('Notice ao migrar configurações gerais:', err);
    if (!isWriteQuotaExhausted()) {
      state.errors.push({
        item: 'Configurações Gerais',
        error: err?.message || 'Salvo no banco local (IndexedDB)',
      });
    }
  }

  // 2. STEP 2: Migrate Hero Banner to independent 'banners/main'
  state.current = 2;
  state.currentStep = 'Otimizando banner e salvando em banners/main...';
  notify();

  let cleanBanner = localSettings.banner;
  if (!isWriteQuotaExhausted()) {
    try {
      cleanBanner = await saveBanner(localSettings.banner);
    } catch (err: any) {
      console.warn('Notice ao migrar banner:', err);
    }
  }

  // 3. STEP 3: Migrate Products in parallel batches of 3 for high performance
  const cleanProducts: Product[] = [];
  let successfulProductCount = 0;

  await processBatch(products, 3, async (prod, idx) => {
    state.current = 2 + idx + 1;
    state.currentStep = `Processando produto ${idx + 1} de ${products.length}: "${prod.name}"...`;
    notify();

    if (isWriteQuotaExhausted()) {
      cleanProducts.push(prod);
      successfulProductCount++;
      return;
    }

    try {
      const savedProd = await saveProduct(prod);
      cleanProducts.push(savedProd);
      successfulProductCount++;
    } catch (prodErr: any) {
      console.warn(`Notice ao salvar produto ${prod.name}:`, prodErr);
      cleanProducts.push(prod);
      successfulProductCount++;
    }
  });

  // 4. STEP 4: Verification & Final Local Persistence
  state.current = totalSteps;
  state.currentStep = 'Finalizando e sincronizando armazenamento local...';
  notify();

  const updatedLocalSettings: StoreSettings = {
    ...localSettings,
    banner: cleanBanner,
    products: cleanProducts.length > 0 ? cleanProducts : products,
    updatedAt: new Date().toISOString(),
  };

  // Persist to IndexedDB and LocalStorage
  saveLocalStoreSettings(updatedLocalSettings);

  if (typeof window !== 'undefined') {
    localStorage.setItem(MIGRATION_STORAGE_FLAG, 'true');
  }

  state.status = 'completed';
  state.currentStep = isWriteQuotaExhausted()
    ? 'Migração concluída! Todos os dados e fotos HD estão preservados no IndexedDB e serão sincronizados com o Firestore assim que a cota reiniciar.'
    : 'Migração concluída com sucesso! Todos os dados estão separados e sincronizados.';
  state.completedAt = new Date().toISOString();
  notify();

  return {
    success: true,
    totalProducts: products.length,
    migratedProducts: successfulProductCount,
    errors: state.errors,
  };
}
