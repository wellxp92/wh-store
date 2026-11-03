import { StoreSettings } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

/**
 * Fetches store settings (WhatsApp, Admin Pin, Authorized Emails) from Supabase
 */
export async function fetchStoreSettingsFromSupabase(): Promise<Partial<StoreSettings> | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('store_settings')
      .select('*')
      .eq('id', 'main_settings')
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.warn('[Supabase] Erro ao buscar configurações:', error.message);
      }
      return null;
    }

    if (!data) return null;

    return {
      whatsappNumber: data.whatsapp_number,
      adminPin: data.admin_pin || '1234',
      authorizedEmails: Array.isArray(data.authorized_emails) ? data.authorized_emails : undefined,
      updatedAt: data.updated_at,
      updatedBy: data.updated_by,
    };
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar configurações:', err);
    return null;
  }
}

/**
 * Saves store settings to Supabase
 */
export async function saveStoreSettingsToSupabase(settings: StoreSettings): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const payload = {
    id: 'main_settings',
    whatsapp_number: settings.whatsappNumber,
    admin_pin: settings.adminPin || '1234',
    authorized_emails: settings.authorizedEmails || ['wellysondasilva92@gmail.com', 'whstore081@gmail.com'],
    updated_at: new Date().toISOString(),
    updated_by: settings.updatedBy || 'admin',
  };

  const { error } = await client.from('store_settings').upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(`Erro ao salvar configurações no Supabase: ${error.message}`);
  }
}
