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

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(__dirname, 'build');
const PORT = process.env.PORT || 3000;
const API_BASE = process.env.VITE_API_BASE || process.env.API_BASE || 'http://localhost:8080';
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://manyorder.app';
const CACHE_TTL_MS = 60_000;

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
};

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
    const t = `w_1200,h_630,c_pad,b_rgb:${bg},f_auto,q_auto`;
    return logo.replace('/upload/', `/upload/${t}/`);
  }
  return /^https?:\/\//.test(logo) ? logo : '';
}

function headTags(store, slug) {
  const name = store.name || 'ManyOrder';
  const base = store.storeDescription ? shorten(store.storeDescription) : `Order online from ${name}`;
  const showAddress = store.showAddressInPreview !== false; // undefined/true => shown
  const addr = showAddress ? (store.address || store.city || '') : '';
  const description = addr ? `${base} · ${addr}` : base;
  const url = `${SITE_ORIGIN}/${slug}`;
  const img = bannerUrl(store);
  const imgTags = img
    ? `\n    <meta property="og:image" content="${esc(img)}" />\n    <meta name="twitter:image" content="${esc(img)}" />\n    <meta name="twitter:card" content="summary_large_image" />`
    : `\n    <meta name="twitter:card" content="summary" />`;
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
    <meta name="robots" content="noindex" />`;

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

async function serveStatic(res, pathname) {
  const rel = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(BUILD_DIR, rel);
  if (!file.startsWith(BUILD_DIR)) { res.writeHead(403).end(); return true; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
    return true;
  } catch { return false; }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);
    const first = pathname.split('/').filter(Boolean)[0] || '';

    // Static asset (has an extension) -> serve from build.
    if (extname(pathname)) { if (await serveStatic(res, pathname)) return; }

    const ua = req.headers['user-agent'] || '';
    const isShopPath = first && !RESERVED.has(first) && !extname(pathname);
    if (isShopPath && CRAWLER.test(ua)) {
      const head = await headForSlug(first);
      const html = head ? injectHead(await indexHtml(), head) : await indexHtml();
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' });
      res.end(html);
      return;
    }

    // Everyone else (and all SPA routes): the unmodified SPA shell.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(await indexHtml());
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('server error');
  }
});

// Only start listening when run directly (node server.mjs), not when imported.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, () => console.log(`frontend server on :${PORT} (api ${API_BASE})`));
}

export { headTags, bannerUrl, injectHead, shorten };
