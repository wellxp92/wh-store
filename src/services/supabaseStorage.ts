import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { optimizeImageFile } from './imageOptimizer';

export type SupabaseBucketName = 'product-images' | 'banners' | 'store-assets';

/**
 * Converts a dataURL string (Base64) to a Blob for upload
 */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/webp';
  const byteString = atob(parts[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return { blob: new Blob([uint8Array], { type: mimeType }), mimeType };
}

/**
 * Uploads an image or file to Supabase Storage and returns the public CDN URL.
 * If Supabase is not configured or fails, gracefully returns the optimized dataUrl.
 */
export async function uploadToSupabaseStorage(
  dataUrlOrFile: string | File,
  bucket: SupabaseBucketName,
  filePath: string
): Promise<string> {
  if (!dataUrlOrFile) return '';

  // If already an external HTTP/HTTPS URL, return directly
  if (typeof dataUrlOrFile === 'string' && (dataUrlOrFile.startsWith('http://') || dataUrlOrFile.startsWith('https://'))) {
    return dataUrlOrFile;
  }

  // Optimize image if it's a raw file
  let dataUrl: string;
  if (typeof dataUrlOrFile === 'string') {
    dataUrl = dataUrlOrFile;
  } else {
    const opt = await optimizeImageFile(dataUrlOrFile, 1800, 0.90);
    dataUrl = opt.dataUrl;
  }

  // If not configured, return dataUrl directly for local persistence
  if (!isSupabaseConfigured()) {
    return dataUrl;
  }

  const client = getSupabaseClient();
  if (!client) return dataUrl;

  try {
    const { blob, mimeType } = dataUrlToBlob(dataUrl);
    const cleanPath = filePath.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // Upload with upsert enabled to prevent duplicate key errors
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(cleanPath, blob, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.warn(`[Supabase Storage] Aviso no bucket ${bucket}:`, uploadError.message);
      return dataUrl;
    }

    // Get public URL
    const { data: publicData } = client.storage.from(bucket).getPublicUrl(cleanPath);
    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
    return dataUrl;
  } catch (err) {
    console.warn('[Supabase Storage] Erro ao fazer upload:', err);
    return dataUrl;
  }
}

/**
 * Uploads a raw video File directly to Supabase Storage (product-images bucket)
 * without compression or quality degradation, returning the public CDN URL.
 * Preserves 100% of original video resolution, framerate, and audio.
 */
export async function uploadVideoToSupabaseStorage(
  file: File,
  productId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  if (!file) {
    return { success: false, error: 'Nenhum arquivo de vídeo fornecido.' };
  }

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Serviço de armazenamento em nuvem não configurado.' };
  }

  try {
    const ext = (file.name ? file.name.split('.').pop()?.toLowerCase() : '') || 'mp4';
    const cleanExt = ['mp4', 'webm', 'mov', 'ogg', 'm4v', 'mkv'].includes(ext) ? ext : 'mp4';
    const cleanId = (productId || 'prod').replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanPath = `videos/prod_${cleanId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${cleanExt}`;

    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (cleanExt === 'mov') mimeType = 'video/quicktime';
      else if (cleanExt === 'webm') mimeType = 'video/webm';
      else mimeType = 'video/mp4';
    }

    const { error: uploadError } = await client.storage
      .from('product-images')
      .upload(cleanPath, file, {
        contentType: mimeType,
        upsert: true,
        cacheControl: '31536000', // 1 ano de cache CDN de alta performance
      });

    if (uploadError) {
      console.error('[Supabase Storage] Erro no upload de vídeo:', uploadError);
      return { success: false, error: uploadError.message };
    }

    const { data: publicData } = client.storage.from('product-images').getPublicUrl(cleanPath);
    if (!publicData?.publicUrl) {
      return { success: false, error: 'Falha ao gerar link público do vídeo.' };
    }

    return {
      success: true,
      url: publicData.publicUrl,
    };
  } catch (err: any) {
    console.error('[Supabase Storage] Exceção no upload de vídeo:', err);
    return {
      success: false,
      error: err?.message || 'Erro inesperado ao enviar vídeo para a nuvem.',
    };
  }
}
