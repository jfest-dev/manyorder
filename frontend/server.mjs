// Small production server for the frontend service. It serves the static Vite
// build, and for a storefront path requested by a social/search crawler it
// injects that shop's title, description, Open Graph and Twitter tags, canonical
// and a 1200x630 Cloudinary banner into the page head. Human browsers get the
// unmodified SPA (the app sets its own title client-side). Missing, suspended or
// deleted shops (the public API returns 404) get a generic noindex card. Results
// are cached briefly, and any API error falls back to the plain page.
//
// No framework, Node built-ins only. Start with:  node server.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, 'build');
const PORT = process.env.PORT || 3000;
const API_BASE = process.env.VITE_API_BASE || process.env.API_BASE || 'http://localhost:8080';
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://manyorder.app';
const CACHE_TTL_MS = 60_000;
// Site-wide default card: a 600x600 brand logo (small, <200KB), used when there is
// nothing shop-specific to show. Replaces the old 4500x4500 square.
const GENERIC_PREVIEW = `${SITE_ORIGIN}/manyorder-card.png`;
const GENERIC_PREVIEW_SIZE = 600;
// Wide link-card dimensions (Open Graph recommends 1200x630).
const BANNER_W = 1200;
const BANNER_H = 630;
// A branded 1200x630 card for a shop with NO logo is built by drawing the shop
// name onto a base image via Cloudinary's text overlay, when a base image is
// configured (env CARD_BANNER_BASE, a Cloudinary upload URL). When unset, a
// logoless shop falls back to the small square default above. Read at call time.

// First path segments that are app routes or assets, never shop slugs.
const RESERVED = new Set([
  'signin', 'register', 'login', 'logout', 'forgot-password', 'reset-password',
  'verify-email', 'confirm-store-email', 'app', 'track', 'assets', 'static',
]);
const CRAWLER = /facebookexternalhit|facebot|WhatsApp|Telegram|Twitterbot|LinkedInBot|Slackbot|Discordbot|Googlebot|bingbot|redditbot|Pinterest|vkShare|embedly|Applebot|SkypeUriPreview|TelegramBot/i;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
};

// Text-ish types worth compressing; already-compressed binaries (images, woff2)
// are left as-is. Checked by MIME prefix/substring so charset suffixes still match.
function isCompressible(type) {
  return /^text\/|application\/(javascript|json|xml|manifest)|image\/svg/.test(type);
}

// Best encoding the client accepts, preferring Brotli, then gzip, then none.
function pickEncoding(req) {
  const ae = String(req.headers['accept-encoding'] || '');
  if (/\bbr\b/.test(ae)) return 'br';
  if (/\bgzip\b/.test(ae)) return 'gzip';
  return null;
}

const br = (buf) => brotliCompressSync(buf, { params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 } });
const gz = (buf) => gzipSync(buf, { level: 9 });

// Cache-Control by path: hashed build assets never change, so cache them for a
// year immutably; the SPA shell must always be revalidated; other public files
// (logo, card, icons, robots) get a short shared cache.
function cacheControlFor(rel) {
  if (rel === 'index.html') return 'no-cache';
  if (rel.startsWith('assets/')) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

let indexHtmlCache = null;
async function indexHtml() {
  if (indexHtmlCache == null) indexHtmlCache = await readFile(join(BUILD_DIR, 'index.html'), 'utf8');
  return indexHtmlCache;
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function shorten(text, max = 180) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).replace(/\s+\S*$/, '').concat('…');
}

// 1200x630 banner: pad the logo onto a theme-coloured canvas when the logo is a
// Cloudinary upload URL; otherwise fall back to the logo as-is, else no image.
function bannerUrl(store) {
  const logo = store.logoUrl;
  if (!logo) return '';
  if (logo.includes('/upload/')) {
    const bg = (store.themeColor || '#111111').replace('#', '');
    const t = `w_${BANNER_W},h_${BANNER_H},c_pad,b_rgb:${bg},f_auto,q_auto`;
    return logo.replace('/upload/', `/upload/${t}/`);
  }
  return /^https?:\/\//.test(logo) ? logo : '';
}

// A 1200x630 branded banner for a logoless shop: the shop name drawn onto the
// configured Cloudinary base image. Returns '' when no base is configured (the
// caller then uses the small square default). Cloudinary draws the name as a
// white text layer near the bottom of the base card.
function logolessBanner(store) {
  const base = process.env.CARD_BANNER_BASE || '';
  if (!base.includes('/upload/')) return '';
  const name = String(store.name || 'ManyOrder').slice(0, 40);
  const text = encodeURIComponent(name); // encodes spaces, commas and slashes
  const t = `w_${BANNER_W},h_${BANNER_H},c_fill,f_auto,q_auto`
    + `/l_text:Arial_72_bold:${text},co_white,g_south,y_72`;
  return base.replace('/upload/', `/upload/${t}/`);
}

function headTags(store, slug) {
  const name = store.name || 'ManyOrder';
  const base = store.storeDescription ? shorten(store.storeDescription) : `Order online from ${name}`;
  const showAddress = store.showAddressInPreview !== false; // undefined/true => shown
  const addr = showAddress ? (store.address || store.city || '') : '';
  const description = addr ? `${base} · ${addr}` : base;
  const url = `${SITE_ORIGIN}/${slug}`;
  // A shop with a logo gets a wide banner padded on its theme colour; a logoless
  // shop gets a wide banner with its name drawn on the brand card (when a base is
  // configured); otherwise the small square default, so the preview is never blank.
  const banner = bannerUrl(store) || logolessBanner(store);
  const img = banner || GENERIC_PREVIEW;
  const wide = Boolean(banner);
  const card = wide ? 'summary_large_image' : 'summary';
  const w = wide ? BANNER_W : GENERIC_PREVIEW_SIZE;
  const h = wide ? BANNER_H : GENERIC_PREVIEW_SIZE;
  const imgTags = `\n    <meta property="og:image" content="${esc(img)}" />`
    + `\n    <meta property="og:image:width" content="${w}" />`
    + `\n    <meta property="og:image:height" content="${h}" />`
    + `\n    <meta name="twitter:image" content="${esc(img)}" />`
    + `\n    <meta name="twitter:card" content="${card}" />`;
  return `<title>${esc(name)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${esc(url)}" />
    <meta property="og:site_name" content="ManyOrder" />
    <meta property="og:title" content="${esc(name)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${esc(url)}" />${imgTags}`;
}

const GENERIC_NOINDEX = `<title>ManyOrder</title>
    <meta name="description" content="Online ordering for small shops." />
    <meta name="robots" content="noindex" />
    <meta property="og:image" content="${GENERIC_PREVIEW}" />
    <meta property="og:image:width" content="${GENERIC_PREVIEW_SIZE}" />
    <meta property="og:image:height" content="${GENERIC_PREVIEW_SIZE}" />
    <meta name="twitter:image" content="${GENERIC_PREVIEW}" />
    <meta name="twitter:card" content="summary" />`;

function injectHead(html, headBlock) {
  // Strip the build's site-wide title/description/canonical/OG/Twitter tags so the
  // shop block is the only set, then insert it before </head>.
  const stripped = html
    .replace(/[ \t]*<title>[\s\S]*?<\/title>\n?/i, '')
    .replace(/[ \t]*<meta\s+name="description"[^>]*>\n?/ig, '')
    .replace(/[ \t]*<link\s+rel="canonical"[^>]*>\n?/ig, '')
    .replace(/[ \t]*<meta\s+property="og:[^"]*"[^>]*>\n?/ig, '')
    .replace(/[ \t]*<meta\s+name="twitter:[^"]*"[^>]*>\n?/ig, '');
  return stripped.replace(/<\/head>/i, `    ${headBlock}\n  </head>`);
}

const cache = new Map(); // slug -> { at, head }
async function headForSlug(slug) {
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.head;
  let head = null; // null => fall back to the plain page
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(`${API_BASE}/public/stores/${encodeURIComponent(slug)}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) head = headTags(await res.json(), slug);
    else if (res.status === 404) head = GENERIC_NOINDEX; // missing / suspended / deleted
    // other statuses: leave head null -> plain page fallback
  } catch {
    head = null; // network error/timeout -> plain page fallback
  }
  cache.set(slug, { at: Date.now(), head });
  return head;
}

// Raw + precompressed bytes per file, built once on first hit and kept in memory
// (cleared on redeploy, since the process restarts). Keyed by absolute file path.
const staticCache = new Map();

async function serveStatic(res, req, pathname) {
  // Strip any leading-up traversal and leading slashes, so `rel` is a clean path
  // like "assets/index-ABC.js" (what cacheControlFor matches on).
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  const file = join(BUILD_DIR, rel);
  if (!file.startsWith(BUILD_DIR)) { res.writeHead(403).end(); return true; }
  let entry = staticCache.get(file);
  if (!entry) {
    let raw;
    try { raw = await readFile(file); } catch { return false; }
    const type = MIME[extname(file)] || 'application/octet-stream';
    entry = { raw, type, br: null, gzip: null };
    if (isCompressible(type)) { entry.br = br(raw); entry.gzip = gz(raw); }
    staticCache.set(file, entry);
  }
  sendBytes(res, req, entry, cacheControlFor(rel));
  return true;
}

// Send a cached entry with the best encoding the client accepts.
function sendBytes(res, req, entry, cacheControl) {
  const enc = entry.br || entry.gzip ? pickEncoding(req) : null;
  const body = enc === 'br' ? entry.br : enc === 'gzip' ? entry.gzip : entry.raw;
  const headers = { 'content-type': entry.type, 'cache-control': cacheControl, 'content-length': body.length };
  if (enc && body !== entry.raw) {
    headers['content-encoding'] = enc;
    headers['vary'] = 'Accept-Encoding';
  }
  res.writeHead(200, headers);
  res.end(body);
}

// Compressed HTML sender for the SPA shell and crawler previews. The unmodified
// shell is compressed once and memoised; per-shop crawler HTML is compressed on
// the fly (crawler hits are rare) and never memoised under the shell key.
let shellCompressed = null;
function sendHtml(res, req, html, cacheControl, memoiseShell = false) {
  const type = 'text/html; charset=utf-8';
  let entry;
  if (memoiseShell && shellCompressed && shellCompressed.raw.equals(Buffer.from(html))) {
    entry = shellCompressed;
  } else {
    const raw = Buffer.from(html);
    entry = { raw, type, br: br(raw), gzip: gz(raw) };
    if (memoiseShell) shellCompressed = entry;
  }
  sendBytes(res, req, entry, cacheControl);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);
    const first = pathname.split('/').filter(Boolean)[0] || '';

    // Static asset (has an extension) -> serve from build with long/short caching.
    if (extname(pathname)) { if (await serveStatic(res, req, pathname)) return; }

    const ua = req.headers['user-agent'] || '';
    const isShopPath = first && !RESERVED.has(first) && !extname(pathname);
    if (isShopPath && CRAWLER.test(ua)) {
      const head = await headForSlug(first);
      const html = head ? injectHead(await indexHtml(), head) : await indexHtml();
      // Short cache: the preview is derived from shop data that can change.
      sendHtml(res, req, html, 'public, max-age=60');
      return;
    }

    // Everyone else (and all SPA routes): the unmodified SPA shell, always
    // revalidated so a deploy's new asset hashes are picked up immediately.
    sendHtml(res, req, await indexHtml(), 'no-cache', true);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  }
});

// Only start listening when run directly (node server.mjs), not when imported.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => console.log(`frontend server on :${PORT} (api ${API_BASE})`));
}

export { headTags, bannerUrl, logolessBanner, injectHead, shorten, cacheControlFor, isCompressible, pickEncoding };
