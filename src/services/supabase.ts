import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default project credentials pre-configured for WH Store (ensures any device or domain like Netlify connects immediately)
export const DEFAULT_SUPABASE_URL = 'https://mtgthmajyipmyufvnjag.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mfyL4T2qtgt3TQKo2P51yQ_g-s3SfIE';

// Configuration keys
export const SUPABASE_URL_KEY = 'wh_store_supabase_url';
export const SUPABASE_ANON_KEY = 'wh_store_supabase_anon_key';

// In-memory cache for credentials synchronized from the server
let memoryUrl = '';
let memoryAnonKey = '';
let isServerSynced = false;

/**
 * Retrieves the Supabase project URL from memory cache, env vars, localStorage override, or default project credentials
 */
export function getSupabaseUrl(): string {
  if (memoryUrl && memoryUrl.startsWith('https://') && !memoryUrl.includes('your-project-id')) {
    return memoryUrl;
  }
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  if (envUrl && envUrl !== 'https://your-project-id.supabase.co' && envUrl.startsWith('https://')) {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(SUPABASE_URL_KEY);
    if (local && local.startsWith('http') && !local.includes('your-project-id')) return local.trim();
  }
  return DEFAULT_SUPABASE_URL;
}

/**
 * Retrieves the Supabase Anon Key from memory cache, env vars, localStorage override, or default project credentials
 */
export function getSupabaseAnonKey(): string {
  if (memoryAnonKey && memoryAnonKey.length > 20 && !memoryAnonKey.includes('your-supabase-anon-key')) {
    return memoryAnonKey;
  }
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (envKey && envKey !== 'your-supabase-anon-key' && envKey.length > 20) {
    return envKey;
  }
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(SUPABASE_ANON_KEY);
    if (local && local.length > 20 && !local.includes('your-supabase-anon-key')) return local.trim();
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

/**
 * Initializes Supabase global configuration from the backend server (/api/config/supabase)
 * or static config (/supabase-config.json) for static deploys like Netlify.
 */
export async function initSupabaseGlobalConfig(): Promise<{ configured: boolean; url: string; anonKey: string }> {
  // 1. Try server API route (when running full-stack Node/Express)
  try {
    const resp = await fetch('/api/config/supabase');
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.configured && data.url && data.anonKey) {
        memoryUrl = data.url.trim();
        memoryAnonKey = data.anonKey.trim();
        isServerSynced = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem(SUPABASE_URL_KEY, memoryUrl);
          localStorage.setItem(SUPABASE_ANON_KEY, memoryAnonKey);
        }
        supabaseInstance = null;
        return { configured: true, url: memoryUrl, anonKey: memoryAnonKey };
      }
    }
  } catch (err) {
    // Expected on static hosting like Netlify where /api is not present
  }

  // 2. Try static supabase-config.json (works on Netlify, Vercel, static CDN)
  try {
    const staticResp = await fetch('/supabase-config.json');
    if (staticResp.ok) {
      const staticData = await staticResp.json();
      if (staticData && staticData.url && staticData.anonKey) {
        memoryUrl = staticData.url.trim();
        memoryAnonKey = staticData.anonKey.trim();
        isServerSynced = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem(SUPABASE_URL_KEY, memoryUrl);
          localStorage.setItem(SUPABASE_ANON_KEY, memoryAnonKey);
        }
        supabaseInstance = null;
        return { configured: true, url: memoryUrl, anonKey: memoryAnonKey };
      }
    }
  } catch (err) {
    // Ignore static fetch error
  }

  // 3. Fallback: Check localStorage
  if (typeof window !== 'undefined') {
    const localUrl = (localStorage.getItem(SUPABASE_URL_KEY) || '').trim();
    const localKey = (localStorage.getItem(SUPABASE_ANON_KEY) || '').trim();
    if (
      localUrl &&
      localKey &&
      localUrl.startsWith('https://') &&
      !localUrl.includes('your-project-id') &&
      localKey.length > 20
    ) {
      memoryUrl = localUrl;
      memoryAnonKey = localKey;
      isServerSynced = true;
      return { configured: true, url: localUrl, anonKey: localKey };
    }
  }

  // 4. Fallback to default constants
  memoryUrl = DEFAULT_SUPABASE_URL;
  memoryAnonKey = DEFAULT_SUPABASE_ANON_KEY;
  isServerSynced = true;
  return { configured: true, url: memoryUrl, anonKey: memoryAnonKey };
}

/**
 * Saves custom Supabase credentials globally to the backend server and locally in localStorage
 */
export async function saveSupabaseCredentialsGlobally(url: string, anonKey: string): Promise<boolean> {
  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();

  memoryUrl = cleanUrl;
  memoryAnonKey = cleanKey;

  if (typeof window !== 'undefined') {
    if (cleanUrl) localStorage.setItem(SUPABASE_URL_KEY, cleanUrl);
    else localStorage.removeItem(SUPABASE_URL_KEY);

    if (cleanKey) localStorage.setItem(SUPABASE_ANON_KEY, cleanKey);
    else localStorage.removeItem(SUPABASE_ANON_KEY);
  }

  // Reset client instance so it reconnects with new credentials
  supabaseInstance = null;

  try {
    const res = await fetch('/api/config/supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, anonKey: cleanKey }),
    });
    if (res.ok) {
      isServerSynced = true;
      return true;
    }
  } catch (err) {
    console.error('[Supabase Service] Erro ao sincronizar credenciais com o servidor:', err);
  }
  return false;
}

/**
 * Synchronous backward-compatible wrapper to save Supabase credentials
 */
export function setSupabaseCredentials(url: string, anonKey: string): void {
  saveSupabaseCredentialsGlobally(url, anonKey).catch(() => {});
}

/**
 * Returns whether credentials have been verified with the server
 */
export function getIsServerSynced(): boolean {
  return isServerSynced;
}

/**
 * Checks if valid Supabase credentials have been configured
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(
    url &&
    key &&
    url.startsWith('https://') &&
    !url.includes('your-project-id') &&
    key.length > 20
  );
}

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns the active Supabase client singleton
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabaseInstance;
}

/**
 * Tests connection to the Supabase PostgreSQL database
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      message: 'Supabase URL ou Chave Anon não configuradas. Operando com armazenamento local.',
    };
  }
  try {
    const client = getSupabaseClient();
    if (!client) {
      return { ok: false, message: 'Falha ao inicializar cliente Supabase.' };
    }
    // Query a lightweight count from store_settings or products
    const { error } = await client.from('store_settings').select('id').limit(1);
    if (error) {
      // If table doesn't exist yet, SQL schema needs to be executed
      if (error.code === '42P01' || error.message.includes('relation "public.store_settings" does not exist')) {
        return {
          ok: false,
          message: 'Tabelas do Supabase não encontradas. Execute o script supabase_schema.sql no SQL Editor.',
        };
      }
      return { ok: false, message: `Erro ao conectar: ${error.message}` };
    }
    return { ok: true, message: 'Conectado com sucesso ao Supabase PostgreSQL!' };
  } catch (err: any) {
    return {
      ok: false,
      message: `Falha de rede ou timeout: ${err?.message || 'Sem conexão'}`,
    };
  }
}
