import { Product } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { uploadToSupabaseStorage } from './supabaseStorage';

/**
 * Maps Supabase relational row format to the frontend Product interface
 */
function mapRowToProduct(row: any, images: any[] = []): Product {
  const sortedImages = [...images].sort((a, b) => a.display_order - b.display_order);
  const coverImage = sortedImages.find((img) => img.is_cover)?.image_url || sortedImages[0]?.image_url || '';
  const imageUrls = sortedImages.map((img) => img.image_url);

  return {
    id: row.id,
    name: row.name,
    category: row.category_name,
    price: Number(row.price),
    installments: row.installments || undefined,
    image: coverImage,
    images: imageUrls.length > 0 ? imageUrls : undefined,
    video: row.video_url || undefined,
    description: row.description || undefined,
    inStock: row.in_stock !== false,
  };
}

/**
 * Fetches all products with their associated images from Supabase
 */
export async function fetchProductsFromSupabase(): Promise<Product[] | null> {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: productsData, error: productsError } = await client
      .from('products')
      .select('*, product_images(*)')
      .order('created_at', { ascending: false });

    if (productsError) {
      console.warn('[Supabase] Erro ao buscar produtos:', productsError.message);
      return null;
    }

    if (!Array.isArray(productsData)) return [];

    return productsData.map((row) => mapRowToProduct(row, row.product_images || []));
  } catch (err) {
    console.warn('[Supabase] Falha ao carregar produtos:', err);
    return null;
  }
}

/**
 * Saves or updates a product in Supabase PostgreSQL
 */
export async function saveProductToSupabase(product: Product): Promise<Product> {
  const client = getSupabaseClient();
  if (!client) return product;

  const now = new Date().toISOString();

  // 1. Prepare and upload photos to Supabase Storage if they are Base64
  let mainImageUrl = product.image;
  if (mainImageUrl && mainImageUrl.startsWith('data:image/')) {
    mainImageUrl = await uploadToSupabaseStorage(
      mainImageUrl,
      'product-images',
      `products/${product.id}/cover_${Date.now()}.webp`
    );
  }

  const allImages = product.images && product.images.length > 0 ? [...product.images] : (mainImageUrl ? [mainImageUrl] : []);
  const processedImages: string[] = [];

  for (let i = 0; i < allImages.length; i++) {
    const img = allImages[i];
    if (img.startsWith('data:image/')) {
      const uploaded = await uploadToSupabaseStorage(
        img,
        'product-images',
        `products/${product.id}/slot_${i}_${Date.now()}.webp`
      );
      processedImages.push(uploaded);
    } else {
      processedImages.push(img);
    }
  }

  // Ensure cover image is updated
  const finalCoverImage = processedImages[0] || mainImageUrl || '';

  // 2. Upsert product in public.products table
  const productPayload = {
    id: product.id,
    name: product.name,
    category_name: product.category,
    price: product.price,
    installments: product.installments || null,
    description: product.description || null,
    in_stock: product.inStock !== false,
    video_url: product.video || null,
    updated_at: now,
  };

  const { error: prodError } = await client
    .from('products')
    .upsert(productPayload, { onConflict: 'id' });

  if (prodError) {
    throw new Error(`Erro ao salvar produto no Supabase: ${prodError.message}`);
  }

  // 3. Update gallery images in public.product_images
  // Delete existing records for this product
  await client.from('product_images').delete().eq('product_id', product.id);

  if (processedImages.length > 0) {
    const imageRows = processedImages.map((url, idx) => ({
      product_id: product.id,
      image_url: url,
      display_order: idx,
      is_cover: idx === 0,
    }));

    await client.from('product_images').insert(imageRows);
  }

  return {
    ...product,
    image: finalCoverImage,
    images: processedImages,
  };
}

/**
 * Deletes a product from Supabase
 */
export async function deleteProductFromSupabase(productId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from('products').delete().eq('id', productId);
    if (error) {
      console.error('[Supabase] Erro ao excluir produto:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase] Falha ao excluir produto:', err);
    return false;
  }
}
