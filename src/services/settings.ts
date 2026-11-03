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
    let { data, error } = await client
      .from('store_settings')
      .select('*')
      .eq('id', 'main_settings')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.warn('[Supabase] Erro ao buscar configurações com ID main_settings:', error.message);
    }

    // Se não encontrou pelo id fixo, tenta pegar o primeiro registro existente
    if (!data) {
      const allRes = await client.from('store_settings').select('*').limit(1);
      if (allRes.data && allRes.data.length > 0) {
        data = allRes.data[0];
      }
    }

    if (!data) return null;

    return {
      whatsappNumber: data.whatsapp_number || '5581989947016',
      adminPin: (data.admin_pin && String(data.admin_pin).trim()) || '',
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

  const pinToSave = (settings.adminPin && settings.adminPin.trim()) || '';

  const payload = {
    id: 'main_settings',
    whatsapp_number: settings.whatsappNumber || '5581989947016',
    admin_pin: pinToSave,
    authorized_emails: settings.authorizedEmails || ['wellysondasilva92@gmail.com', 'whstore081@gmail.com'],
    updated_at: new Date().toISOString(),
    updated_by: settings.updatedBy || 'admin',
  };

  const { error } = await client.from('store_settings').upsert(payload, { onConflict: 'id' });

  if (error) {
    // Tenta fallback com update caso upsert tenha falhado por constraint
    const { error: updErr } = await client
      .from('store_settings')
      .update({
        whatsapp_number: payload.whatsapp_number,
        admin_pin: payload.admin_pin,
        authorized_emails: payload.authorized_emails,
        updated_at: payload.updated_at,
        updated_by: payload.updated_by,
      })
      .eq('id', 'main_settings');

    if (updErr) {
      console.error('[Supabase] Falha ao persistir store_settings:', error.message || updErr.message);
      throw new Error(`Erro ao salvar configurações no Supabase: ${error.message || updErr.message}`);
    }
  }
}

