// Shared client-side image validation, mirrored by the server (which re-checks
// type, size, and the real magic bytes — this check is advisory UX only, never
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
