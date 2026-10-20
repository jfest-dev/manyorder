/**
 * Cloudflare Web Analytics loader. The beacon is privacy-friendly (no cookies, no
 * cross-site tracking). It is injected at runtime, and only when it makes sense:
 *  - the VITE_CF_ANALYTICS_TOKEN env var is set (blank/unset is a silent no-op),
 *  - not on localhost (local dev traffic is never counted),
 *  - not under the test runner (MODE === 'test').
 * Loading is best-effort: any failure is swallowed so it can never affect the app.
 */

/** Pure decision, split out so every branch is unit-testable without touching the DOM. */
export function shouldLoadAnalytics(opts: { token?: string; mode?: string; hostname: string }): boolean {
  const { token, mode, hostname } = opts;
  if (!token) return false;            // unset or blank
  if (mode === 'test') return false;   // never under vitest
  const isLocal =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' ||
    hostname === '[::1]' || hostname.endsWith('.localhost');
  return !isLocal;                     // never on localhost
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
    if (!shouldLoadAnalytics({ token: env.VITE_CF_ANALYTICS_TOKEN, mode: env.MODE, hostname: window.location.hostname })) {
      return;
    }
    injectBeacon(env.VITE_CF_ANALYTICS_TOKEN);
  } catch {
    // Analytics must never break the app.
  }
}
