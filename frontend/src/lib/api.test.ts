import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression guard for the session-invalidation bug: an authenticated request
 * that comes back 401 must clear the stored session and redirect to /signin,
 * so a dead token can never leave the app rendering a broken, sidebar-less
 * shell. A 403 (authenticated-but-forbidden) must NOT log the user out.
 *
 * These run in Node, so we stub the browser globals `request()` touches
 * (localStorage/sessionStorage, window.location, fetch).
 */
function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

function seedSession() {
  const ls = makeStorage();
  ls.setItem('manyorder_token', 'stored-token');
  ls.setItem('manyorder_user', '{"userId":1}');
  vi.stubGlobal('localStorage', ls);
  vi.stubGlobal('sessionStorage', makeStorage());
  vi.stubGlobal('window', { location: { pathname: '/app', href: '/app' } });
  return ls;
}

describe('api request() session handling', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.unstubAllGlobals());

  it('on 401 for an authed call: clears token + user and redirects to /signin', async () => {
    const ls = seedSession();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'nope' }), { status: 401 })));

    const { storesApi, ApiError } = await import('./api');
    await expect(storesApi.list()).rejects.toBeInstanceOf(ApiError);

    expect(ls.getItem('manyorder_token')).toBeNull();
    expect(ls.getItem('manyorder_user')).toBeNull();
    expect((window as any).location.href).toBe('/signin');
  });

  it('on 403 (forbidden ≠ unauthenticated): keeps the session and does NOT redirect', async () => {
    const ls = seedSession();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 403 })));

    const { storesApi } = await import('./api');
    await expect(storesApi.list()).rejects.toBeTruthy();

    expect(ls.getItem('manyorder_token')).toBe('stored-token'); // still signed in
    expect((window as any).location.href).toBe('/app'); // no redirect
  });
});
