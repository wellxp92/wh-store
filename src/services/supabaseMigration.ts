import { StoreSettings, Product, MigrationState } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { saveProductToSupabase } from './products';
import { saveBannerToSupabase } from './banners';
import { saveStoreSettingsToSupabase } from './settings';
import { saveCategoriesToSupabase } from './categories';
import { loadStoreSettingsFromIndexedDB } from './indexedDb';
import { getLocalStoreSettings } from './storage';

export const SUPABASE_MIGRATION_FLAG = 'wh_store_supabase_migration_completed_v1';
export const SUPABASE_MIGRATION_STATE_KEY = 'wh_store_supabase_migration_state_v1';

export function isSupabaseMigrationCompleted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SUPABASE_MIGRATION_FLAG) === 'true';
}

export function getSupabaseMigrationState(): MigrationState {
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
    const raw = localStorage.getItem(SUPABASE_MIGRATION_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    status: isSupabaseMigrationCompleted() ? 'completed' : 'idle',
    current: 0,
    total: 0,
    currentStep: '',
    errors: [],
  };
}

export function saveSupabaseMigrationState(state: MigrationState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUPABASE_MIGRATION_STATE_KEY, JSON.stringify(state));
  } catch {}
}

export interface SupabaseMigrationResult {
  success: boolean;
  totalProducts: number;
  migratedProducts: number;
  errors: { item: string; error: string }[];
}

/**
 * Runs complete migration from Local Storage / IndexedDB to Supabase
 */
export async function runSupabaseMigration(
  currentSettings?: StoreSettings,
  onProgress?: (state: MigrationState) => void
): Promise<SupabaseMigrationResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado. Insira a URL e a Chave Anon antes de migrar.');
  }

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Falha ao conectar com o Supabase.');
  }

  // 1. Load source data safely (prefer full IndexedDB data if available)
  let sourceSettings: StoreSettings | null = null;
  try {
    sourceSettings = await loadStoreSettingsFromIndexedDB();
  } catch {}
  if (!sourceSettings) {
    sourceSettings = currentSettings || getLocalStoreSettings();
  }

  const productsToMigrate: Product[] = Array.isArray(sourceSettings?.products)
    ? sourceSettings.products
    : [];

  const state: MigrationState = {
    status: 'running',
    current: 0,
    total: productsToMigrate.length + 3, // settings, banner, categories, products
    currentStep: 'Iniciando migração para Supabase PostgreSQL...',
    errors: [],
  };

  const updateState = (step: string, increment = false) => {
    state.currentStep = step;
    if (increment) state.current++;
    saveSupabaseMigrationState(state);
    if (onProgress) onProgress({ ...state });
  };

  updateState('Validando tabelas no Supabase...', false);

  const errors: { item: string; error: string }[] = [];
  let migratedCount = 0;

  try {
    // Step 1: Migrate Categories
    updateState('Migrando categorias para public.categories...', true);
    if (sourceSettings?.categories && sourceSettings.categories.length > 0) {
      await saveCategoriesToSupabase(sourceSettings.categories);
    }

    // Step 2: Migrate Store Settings (WhatsApp, PIN, Emails)
    updateState('Migrando configurações para public.store_settings...', true);
    if (sourceSettings) {
      await saveStoreSettingsToSupabase(sourceSettings);
    }

    // Step 3: Migrate Banner
    updateState('Migrando banner para public.banners e Supabase Storage...', true);
    if (sourceSettings?.banner) {
      await saveBannerToSupabase(sourceSettings.banner);
    }

    // Step 4: Migrate Products in parallel batches of 3
    const BATCH_SIZE = 3;
    for (let i = 0; i < productsToMigrate.length; i += BATCH_SIZE) {
      const batch = productsToMigrate.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (prod, batchIdx) => {
          const itemNumber = i + batchIdx + 1;
          try {
            updateState(
              `Migrando produto (${itemNumber}/${productsToMigrate.length}): ${prod.name}`,
              false
            );
            await saveProductToSupabase(prod);
            migratedCount++;
          } catch (err: any) {
            console.error(`Erro ao migrar ${prod.name}:`, err);
            errors.push({
              item: prod.name,
              error: err?.message || String(err),
            });
          } finally {
            state.current++;
            saveSupabaseMigrationState(state);
            if (onProgress) onProgress({ ...state });
          }
        })
      );
    }

    const success = errors.length === 0;
    state.status = success ? 'completed' : 'error';
    state.completedAt = new Date().toISOString();
    state.currentStep = success
      ? `Migração concluída com sucesso! ${migratedCount} produtos migrados para o Supabase.`
      : `Migração finalizada com ${errors.length} avisos. ${migratedCount} produtos salvos.`;
    state.errors = errors;

    saveSupabaseMigrationState(state);
    if (success) {
      localStorage.setItem(SUPABASE_MIGRATION_FLAG, 'true');
    }
    if (onProgress) onProgress({ ...state });

    return {
      success,
      totalProducts: productsToMigrate.length,
      migratedProducts: migratedCount,
      errors,
    };
  } catch (fatalError: any) {
    state.status = 'error';
    state.currentStep = `Falha na migração: ${fatalError?.message || 'Erro desconhecido'}`;
    state.errors.push({ item: 'Geral', error: fatalError?.message || String(fatalError) });
    saveSupabaseMigrationState(state);
    if (onProgress) onProgress({ ...state });
    throw fatalError;
  }
}
