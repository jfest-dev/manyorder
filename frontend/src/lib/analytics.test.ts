// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { shouldLoadAnalytics, injectBeacon, loadCloudflareAnalytics } from './analytics';

const beacon = () => document.querySelector('script[data-cf-beacon]') as HTMLScriptElement | null;

afterEach(() => {
  document.querySelectorAll('script[data-cf-beacon]').forEach((s) => s.remove());
});

describe('shouldLoadAnalytics', () => {
  it('is false when the token is blank or unset', () => {
    expect(shouldLoadAnalytics({ token: '', mode: 'production', hostname: 'app.manyorder.app' })).toBe(false);
    expect(shouldLoadAnalytics({ token: undefined, mode: 'production', hostname: 'app.manyorder.app' })).toBe(false);
  });

  it('is false under the test runner', () => {
    expect(shouldLoadAnalytics({ token: 'tok', mode: 'test', hostname: 'app.manyorder.app' })).toBe(false);
  });

  it('is false on localhost and loopback hosts', () => {
    for (const h of ['localhost', '127.0.0.1', '::1', 'foo.localhost']) {
      expect(shouldLoadAnalytics({ token: 'tok', mode: 'production', hostname: h })).toBe(false);
    }
  });

  it('is true with a token, in production, off localhost', () => {
    expect(shouldLoadAnalytics({ token: 'tok', mode: 'production', hostname: 'app.manyorder.app' })).toBe(true);
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
