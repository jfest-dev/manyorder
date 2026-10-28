/**
 * Build Cloudinary delivery URLs (and a 1x/2x srcset) for a stored image. Applies
 * ONLY to Cloudinary delivery URLs that don't already carry a transform; every
 * other URL (local object/blob previews, imported assets, other hosts, already-
 * transformed Cloudinary URLs) is returned unchanged. The stored original is never
 * altered - this only changes how the image is requested.
 *
 * The transform is: f_auto (modern format), a quality tier by kind
 * (q_auto:good for product photos, q_auto:best for logos), c_limit so the original
 * is never upscaled, and the requested width. Density is handled with a 1x/2x
 * srcset rather than dpr_auto, so each image ships at most two sizes and the URLs
 * are stable (no cache-busting).
 *
 * Example:
 *   https://res.cloudinary.com/x/image/upload/v123/a/b.jpg
 *   -> https://res.cloudinary.com/x/image/upload/f_auto,q_auto:good,c_limit,w_600/v123/a/b.jpg
 */
export type ImageKind = 'product' | 'logo';

const UPLOAD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.+)$/;

/** True if the first path segment after /upload/ is already a transform (e.g. w_600, c_fill, f_auto). */
function alreadyTransformed(afterUpload: string): boolean {
  const first = afterUpload.split('/')[0] ?? '';
  return /(^|,)[a-z]+_[^/,]+/.test(first);
}

function quality(kind: ImageKind): string {
  return kind === 'logo' ? 'q_auto:best' : 'q_auto:good';
}

/** One delivery URL at the given CSS width. No dpr param: density comes from the srcset. */
export function cloudinaryImage(url: string | null | undefined, width: number, kind: ImageKind = 'product'): string {
  if (!url) return url ?? '';
  const m = UPLOAD.exec(url);
  if (!m) return url;                      // not a Cloudinary delivery URL
  const [, base, rest] = m;
  if (alreadyTransformed(rest)) return url; // respect an existing transform
  return `${base}/f_auto,${quality(kind)},c_limit,w_${Math.round(width)}/${rest}`;
}

/**
 * A 1x + 2x srcset string ("<url@w> 1x, <url@2w> 2x") for the given CSS width.
 * Returns '' when there is no transformable Cloudinary URL (a falsy value, a blob
 * preview, another host, or an already-transformed URL), so the caller can omit
 * the srcset and just use src.
 */
export function cloudinarySrcSet(url: string | null | undefined, width: number, kind: ImageKind = 'product'): string {
  if (!url) return '';
  const one = cloudinaryImage(url, width, kind);
  if (one === url) return '';              // nothing to size
  const two = cloudinaryImage(url, width * 2, kind);
  return `${one} 1x, ${two} 2x`;
}
