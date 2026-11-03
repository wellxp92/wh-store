import { BannerConfig } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { uploadToSupabaseStorage } from './supabaseStorage';

/**
 * Fetches the active hero banner from Supabase
 */
export async function fetchBannerFromSupabase(): Promise<BannerConfig | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('banners')
      .select('*')
      .eq('id', 'hero_main')
      .maybeSingle();

    if (error) {
      console.warn('[Supabase] Erro ao buscar banner:', error.message);
      return null;
    }

    if (!data) return null;

    return {
      title: data.title,
      subtitle: data.subtitle || '',
      description: data.description || '',
      image: data.image_url,
    };
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar banner:', err);
    return null;
  }
}

/**
 * Saves or updates the hero banner in Supabase
 */
export async function saveBannerToSupabase(banner: BannerConfig): Promise<BannerConfig> {
  const client = getSupabaseClient();
  if (!client) return banner;

  let imageUrl = banner.image;
  if (imageUrl && imageUrl.startsWith('data:image/')) {
    imageUrl = await uploadToSupabaseStorage(
      imageUrl,
      'banners',
      `hero_main_${Date.now()}.webp`
    );
  }

  const payload = {
    id: 'hero_main',
    title: banner.title,
    subtitle: banner.subtitle || null,
    description: banner.description || null,
    image_url: imageUrl,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await client.from('banners').upsert(payload, { onConflict: 'id' });

  if (error) {
    throw new Error(`Erro ao salvar banner no Supabase: ${error.message}`);
  }

  return {
    ...banner,
    image: imageUrl,
  };
}
