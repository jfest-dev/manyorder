/**
 * Insert Cloudinary delivery transforms into a Cloudinary image URL so the browser
 * gets a right-sized, modern-format, auto-quality image instead of the full-size
 * original. Applies ONLY to Cloudinary delivery URLs that don't already carry a
 * transform; every other URL (local object/blob previews, imported assets, other
 * hosts, already-transformed Cloudinary URLs) is returned unchanged. The stored
 * original is never altered - this only changes how we request the image.
 *
 * Example:
 *   https://res.cloudinary.com/x/image/upload/v123/a/b.jpg
 *   -> https://res.cloudinary.com/x/image/upload/f_auto,q_auto,w_600,dpr_auto/v123/a/b.jpg
 */
const UPLOAD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.+)$/;

/** True if the first path segment after /upload/ is already a transform (e.g. w_600, c_fill, f_auto). */
function alreadyTransformed(afterUpload: string): boolean {
  const first = afterUpload.split('/')[0] ?? '';
  // Cloudinary transform params are key_value pairs, comma-separated (w_, q_, f_, c_, e_, ...).
  return /(^|,)[a-z]+_[^/,]+/.test(first);
}

export function cloudinaryImage(url: string | null | undefined, width: number): string {
  if (!url) return url ?? '';
  const m = UPLOAD.exec(url);
  if (!m) return url;                  // not a Cloudinary delivery URL
  const [, base, rest] = m;
  if (alreadyTransformed(rest)) return url; // respect an existing transform
  return `${base}/f_auto,q_auto,w_${Math.round(width)},dpr_auto/${rest}`;
}
