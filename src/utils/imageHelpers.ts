export const SAFE_IMAGE_DATA_URL_REGEX =
  /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/;

const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export function isSafeImageDataUrl(value?: string | null): value is string {
  return Boolean(value && SAFE_IMAGE_DATA_URL_REGEX.test(value.trim()));
}

export async function compressImageFileToDataUrl(
  file: File,
  options?: { maxDim?: number; maxChars?: number }
): Promise<string> {
  if (!ALLOWED_IMAGE_MIME.has(file.type.toLowerCase())) {
    throw new Error('Please upload a PNG, JPG, or WEBP image.');
  }

  const maxDim = options?.maxDim ?? 960;
  const maxChars = options?.maxChars ?? 380000;
  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Failed to load selected image file.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processor unavailable in this browser.');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const pngUrl = canvas.toDataURL('image/png');
    if (pngUrl.length <= Math.min(240000, maxChars)) return pngUrl;

    for (const quality of [0.88, 0.76, 0.62, 0.48]) {
      const jpegUrl = canvas.toDataURL('image/jpeg', quality);
      if (jpegUrl.length <= maxChars) return jpegUrl;
    }

    throw new Error('Image is too large even after compression. Please select a smaller screenshot.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
