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
