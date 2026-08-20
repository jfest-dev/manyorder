// Shared client-side image validation, mirrored by the server (which re-checks
// type, size, and the real magic bytes - this check is advisory UX only, never
// the security boundary). Constants match the backend's ImageValidation.

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',');
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const IMAGE_RULE_TEXT = 'JPG, PNG, or WebP, up to 5 MB.';

/** Returns an error message to show the user, or null when the file is acceptable. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Please upload a JPG, PNG, or WebP image.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'Image must be under 5 MB.';
  }
  return null;
}

/**
 * Downscale + re-encode an image in the browser before upload, so a multi-MB
 * phone photo becomes a small WebP. Cuts upload time (and the browser→server→
 * Cloudinary double hop) dramatically. WebP preserves transparency and is
 * accepted server-side. Falls back to the original file on any failure or when
 * re-encoding wouldn't help.
 */
export async function downscaleImage(file: File, maxDim: number, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // decoder unavailable / unsupported - upload as-is
  }
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) return file;
    // Keep the original if it was already smaller and we didn't shrink dimensions.
    if (scale === 1 && blob.size >= file.size) return file;

    const name = file.name.replace(/\.\w+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
  } finally {
    bitmap.close?.();
  }
}
