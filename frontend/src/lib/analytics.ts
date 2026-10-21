/**
 * Cloudflare Web Analytics loader. The beacon is privacy-friendly (no cookies, no
 * cross-site tracking). It is injected at runtime, and only when it makes sense:
 *  - the VITE_CF_ANALYTICS_TOKEN env var is set (blank/unset is a silent no-op),
 *  - not on localhost (local dev traffic is never counted),
 *  - not under the test runner (MODE === 'test'),
 *  - ONLY on public storefront pages, never on routes whose URL can carry a private
 *    token (see isPublicStorefrontPath).
 * Loading is best-effort: any failure is swallowed so it can never affect the app.
 */

// Non-storefront route prefixes. These are never counted: the signed-in app, the
// auth pages, and every route whose path or query string carries a private token
// (/track/:token, and ?token= on /verify-email, /confirm-store-email, /reset-password).
// Cloudflare Web Analytics records the full page URL (query string included) and
// auto-tracks SPA navigations once loaded, so the only reliable way to keep a token
// out of analytics is to never load the beacon anywhere but the storefront.
const NON_STOREFRONT_PREFIXES = [
  '/app', '/signin', '/register', '/forgot-password',
  '/reset-password', '/verify-email', '/confirm-store-email', '/track',
];

/** True only for public storefront paths (/:slug and below), never the app/auth/token routes. */
export function isPublicStorefrontPath(pathname: string): boolean {
  if (!pathname || pathname === '/') return false; // root redirects to /signin
  return !NON_STOREFRONT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Pure decision, split out so every branch is unit-testable without touching the DOM. */
export function shouldLoadAnalytics(opts: { token?: string; mode?: string; hostname: string; pathname: string }): boolean {
  const { token, mode, hostname, pathname } = opts;
  if (!token) return false;            // unset or blank
  if (mode === 'test') return false;   // never under vitest
  const isLocal =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
    hostname === '[::1]' || hostname.endsWith('.localhost');
  if (isLocal) return false;           // never on localhost
  return isPublicStorefrontPath(pathname); // only public storefront pages
}

/** Append the beacon script once. Pure DOM, so it can be tested directly. */
export function injectBeacon(token: string): void {
  if (document.querySelector('script[data-cf-beacon]')) return; // load once
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  document.head.appendChild(script);
}

/** Entry point called once from main.tsx. */
export function loadCloudflareAnalytics(): void {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const env = (import.meta as any).env ?? {};
    if (!shouldLoadAnalytics({
      token: env.VITE_CF_ANALYTICS_TOKEN,
      mode: env.MODE,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
    })) {
      return;
    }
    injectBeacon(env.VITE_CF_ANALYTICS_TOKEN);
  } catch {
    // Analytics must never break the app.
  }
}
