// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { shouldLoadAnalytics, isPublicStorefrontPath, injectBeacon, loadCloudflareAnalytics } from './analytics';

const beacon = () => document.querySelector('script[data-cf-beacon]') as HTMLScriptElement | null;
const base = { token: 'tok', mode: 'production', hostname: 'manyorder.app' };

afterEach(() => {
  document.querySelectorAll('script[data-cf-beacon]').forEach((s) => s.remove());
});

describe('isPublicStorefrontPath', () => {
  it('is true for storefront paths', () => {
    expect(isPublicStorefrontPath('/kiri-brew')).toBe(true);
    expect(isPublicStorefrontPath('/kiri-brew/product/5')).toBe(true);
  });
  it('is false for the root and every app/auth/token route', () => {
    for (const p of [
      '/', '/app', '/app?screen=orders-all', '/signin', '/register', '/forgot-password',
      '/reset-password', '/verify-email', '/confirm-store-email', '/track', '/track/abc123',
    ]) {
      // query strings are not part of pathname; test the pathname portion
      expect(isPublicStorefrontPath(p.split('?')[0])).toBe(false);
    }
  });
});

describe('shouldLoadAnalytics', () => {
  it('is false when the token is blank or unset', () => {
    expect(shouldLoadAnalytics({ ...base, token: '', pathname: '/kiri' })).toBe(false);
    expect(shouldLoadAnalytics({ ...base, token: undefined, pathname: '/kiri' })).toBe(false);
  });
  it('is false under the test runner', () => {
    expect(shouldLoadAnalytics({ ...base, mode: 'test', pathname: '/kiri' })).toBe(false);
  });
  it('is false on localhost and loopback hosts', () => {
    for (const h of ['localhost', '127.0.0.1', '::1', 'foo.localhost']) {
      expect(shouldLoadAnalytics({ ...base, hostname: h, pathname: '/kiri' })).toBe(false);
    }
  });
  it('is false on token-bearing and app/auth routes even in production off localhost', () => {
    for (const pathname of ['/verify-email', '/confirm-store-email', '/reset-password', '/track/abc', '/app', '/signin', '/']) {
      expect(shouldLoadAnalytics({ ...base, pathname })).toBe(false);
    }
  });
  it('is true only on a public storefront page', () => {
    expect(shouldLoadAnalytics({ ...base, pathname: '/kiri-brew' })).toBe(true);
  });
});

describe('injectBeacon', () => {
  it('appends the Cloudflare beacon with the token, once', () => {
    injectBeacon('tok123');
    const s = beacon();
    expect(s).toBeTruthy();
    expect(s!.src).toContain('static.cloudflareinsights.com/beacon.min.js');
    expect(s!.defer).toBe(true);
    expect(s!.getAttribute('data-cf-beacon')).toContain('tok123');
    injectBeacon('tok123'); // idempotent
    expect(document.querySelectorAll('script[data-cf-beacon]').length).toBe(1);
  });
});

describe('loadCloudflareAnalytics', () => {
  it('is a no-op under the test runner (never loads in tests)', () => {
    loadCloudflareAnalytics();
    expect(beacon()).toBeNull();
  });
});
