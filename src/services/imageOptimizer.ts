/**
 * Client-side media validator and optimizer.
 * Compresses uploaded images with optimal clarity for mobile and retina displays (750px, quality 0.72)
 * to ensure jewelry facets, silver reflections, and details look premium and sharp
 * while maintaining ultra-lightweight size (20KB - 35KB) well within Firestore's 1MB limit.
 */

export interface ImageOptimizationResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export function isBase64DataUrl(str: string | undefined | null): boolean {
  if (!str || typeof str !== 'string') return false;
  return str.startsWith('data:image/');
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Formato inválido. Por favor, envie uma imagem nos formatos JPG, PNG ou WEBP.',
    };
  }

  // Max 15MB input limit for high-res source photos before compression
  const maxBytes = 15 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: 'O arquivo original é muito grande (máximo 15MB).',
    };
  }

  return { valid: true };
}

export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-m4v',
    'video/x-matroska',
  ];

  const extension = file.name ? file.name.split('.').pop()?.toLowerCase() || '' : '';
  const allowedExtensions = ['mp4', 'webm', 'mov', 'ogg', 'm4v', 'mkv'];

  const isTypeAllowed = allowedTypes.includes(file.type) || allowedExtensions.includes(extension);

  if (!isTypeAllowed) {
    return {
      valid: false,
      error: 'Formato de vídeo não suportado. Por favor, envie um vídeo nos formatos MP4, WEBM ou MOV.',
    };
  }

  // Permite até 60MB com armazenamento em nuvem CDN, mantendo 100% da qualidade original
  const maxBytes = 60 * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `O vídeo selecionado possui ${sizeInMB}MB e ultrapassa o limite de 60MB. Selecione um vídeo de até 60MB.`,
    };
  }

  return { valid: true };
}


/**
 * Optimizes an uploaded File into a crystal-clear, high-resolution WebP/JPEG dataURL
 * (1800px, quality 0.90) so gemstones, zirconias, metals, and fine engravings look razor-sharp.
 */
export async function optimizeImageFile(
  file: File,
  maxDimension = 1800,
  quality = 0.90
): Promise<ImageOptimizationResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem selecionado.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao processar o arquivo de imagem.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio, capping max dimension
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível obter contexto para otimização de imagem.'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as WebP if supported, fallback to JPEG
        let dataUrl: string;
        try {
          dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const compressedApproxBytes = Math.round((dataUrl.length * 3) / 4);

        resolve({
          dataUrl,
          originalSize: file.size,
          compressedSize: compressedApproxBytes,
          width,
          height,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an existing base64 image data URL to safe dimensions and quality.
 * Essential for sanitizing pre-existing large images before saving to Firestore.
 */
export async function compressBase64Image(
  dataUrl: string,
  maxDimension = 1800,
  quality = 0.90
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  // If it's already an external HTTP URL or small dataUrl (< 50KB in string length), skip
  if (!dataUrl.startsWith('data:image/') || dataUrl.length < 50000) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let compressed: string;
        try {
          compressed = canvas.toDataURL('image/webp', quality);
          if (!compressed.startsWith('data:image/webp')) {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        // Return whichever is smaller
        if (compressed.length < dataUrl.length) {
          resolve(compressed);
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Generates a crisp, sharp preview thumbnail (1200px, quality 0.88)
 * for the catalog vitrine with high-quality antialiasing.
 */
export async function createCompactThumbnail(
  dataUrl: string,
  maxDimension = 1200,
  quality = 0.88
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  if (!dataUrl.startsWith('data:image/')) return dataUrl;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let compressed: string;
        try {
          compressed = canvas.toDataURL('image/webp', quality);
          if (!compressed.startsWith('data:image/webp')) {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }
        } catch {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(compressed);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

