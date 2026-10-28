// Client-side image handling for uploads. The browser shrinks and re-encodes a
// picked photo to WebP before upload; the server re-checks type, magic bytes and
// the 5 MB limit on the shrunk file (that is the real boundary, never this).

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(',');

/** Server limit, applied to the SHRUNK output (never the original). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
/** Largest original a user may pick; bigger inputs are refused before shrinking. */
export const MAX_PICK_BYTES = 20 * 1024 * 1024; // 20 MB

/** The only line shown under an upload box. */
export const IMAGE_RULE_TEXT = 'JPG, PNG or WebP';

/** The only two errors the UI ever shows for a picked image. */
export const ERR_NOT_A_PICTURE = "That file isn't a picture. Please use a JPG, PNG or WebP.";
export const ERR_UNREADABLE = "We couldn't read that photo. Try a different one.";

/** Shrink targets: product photos and logos, longest side in px and WebP quality. */
export const PRODUCT_MAX_DIM = 1600;
export const PRODUCT_QUALITY = 0.85;
export const LOGO_MAX_DIM = 600;
export const LOGO_QUALITY = 0.92;

/**
 * Validate a freshly picked file. Checks the declared type and refuses an original
 * larger than the pick ceiling. Returns an error message to show, or null when the
 * file is acceptable to try shrinking.
 */
export function validatePickedImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return ERR_NOT_A_PICTURE;
  }
  if (file.size > MAX_PICK_BYTES) {
    return ERR_UNREADABLE;
  }
  return null;
}

/**
 * Downscale + re-encode a picked image to WebP (which keeps transparency and is
 * accepted server-side), capping the longest side at {@code maxDim}. Throws
 * {@link ERR_UNREADABLE} when the image cannot be decoded/encoded or when the
 * shrunk output is still over the 5 MB server limit. The stored original is the
 * shrunk file; nothing here upscales.
 */
export async function prepareImageForUpload(file: File, maxDim: number, quality: number): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(ERR_UNREADABLE);
  }
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(ERR_UNREADABLE);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
    if (!blob) throw new Error(ERR_UNREADABLE);
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error(ERR_UNREADABLE);

    const name = file.name.replace(/\.\w+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
  } finally {
    bitmap.close?.();
  }
}
