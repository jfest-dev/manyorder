// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { cacheControlFor, isCompressible, pickEncoding } from '../../server.mjs';

describe('static cache-control tiers', () => {
  it('caches hashed build assets for a year, immutably', () => {
    expect(cacheControlFor('assets/index-ABC123.js')).toBe('public, max-age=31536000, immutable');
    expect(cacheControlFor('assets/StorefrontApp-XYZ.css')).toBe('public, max-age=31536000, immutable');
  });

  it('never caches the SPA shell, so new asset hashes are picked up on deploy', () => {
    expect(cacheControlFor('index.html')).toBe('no-cache');
  });

  it('gives other public files a short shared cache', () => {
    expect(cacheControlFor('manyorder-card.png')).toBe('public, max-age=3600');
    expect(cacheControlFor('robots.txt')).toBe('public, max-age=3600');
  });
});

describe('compression selection', () => {
  it('compresses text-ish types only', () => {
    expect(isCompressible('text/javascript; charset=utf-8')).toBe(true);
    expect(isCompressible('text/css; charset=utf-8')).toBe(true);
    expect(isCompressible('application/json')).toBe(true);
    expect(isCompressible('image/svg+xml')).toBe(true);
    expect(isCompressible('image/png')).toBe(false);
    expect(isCompressible('font/woff2')).toBe(false);
  });

  it('prefers Brotli, then gzip, then identity', () => {
    expect(pickEncoding({ headers: { 'accept-encoding': 'gzip, deflate, br' } })).toBe('br');
    expect(pickEncoding({ headers: { 'accept-encoding': 'gzip, deflate' } })).toBe('gzip');
    expect(pickEncoding({ headers: {} })).toBe(null);
  });
});
