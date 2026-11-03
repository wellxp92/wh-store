import { getSupabaseClient, isSupabaseConfigured } from './supabase';

/**
 * Fetches all store categories from Supabase
 */
export async function fetchCategoriesFromSupabase(): Promise<string[] | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('categories')
      .select('name')
      .order('display_order', { ascending: true });

    if (error) {
      console.warn('[Supabase] Erro ao buscar categorias:', error.message);
      return null;
    }

    if (!Array.isArray(data)) return [];
    return data.map((c) => c.name);
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar categorias:', err);
    return null;
  }
}

/**
 * Saves or updates categories in Supabase
 */
export async function saveCategoriesToSupabase(categories: string[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !Array.isArray(categories)) return;

  try {
    const categoryRows = categories.map((name, index) => ({
      slug: name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || `cat-${index}`,
      name,
      display_order: index + 1,
    }));

    await client.from('categories').upsert(categoryRows, { onConflict: 'slug' });
  } catch (err) {
    console.warn('[Supabase] Erro ao salvar categorias:', err);
  }
}
