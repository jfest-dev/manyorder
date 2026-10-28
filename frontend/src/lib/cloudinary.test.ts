import { describe, it, expect } from 'vitest';
import { cloudinaryImage, cloudinarySrcSet } from './cloudinary';

const BASE = 'https://res.cloudinary.com/tvdpnfdn/image/upload';

describe('cloudinaryImage', () => {
  it('inserts f_auto, a product quality tier, c_limit and the width (no dpr)', () => {
    const out = cloudinaryImage(`${BASE}/v123/manyorder/demo/x.jpg`, 600);
    expect(out).toBe(`${BASE}/f_auto,q_auto:good,c_limit,w_600/v123/manyorder/demo/x.jpg`);
    expect(out).not.toContain('dpr_auto');
  });

  it('uses the best quality tier for logos', () => {
    const out = cloudinaryImage(`${BASE}/v1/x.jpg`, 128, 'logo');
    expect(out).toBe(`${BASE}/f_auto,q_auto:best,c_limit,w_128/v1/x.jpg`);
  });

  it('works without a version segment and rounds the width', () => {
    expect(cloudinaryImage(`${BASE}/manyorder/demo/x.jpg`, 400))
      .toBe(`${BASE}/f_auto,q_auto:good,c_limit,w_400/manyorder/demo/x.jpg`);
    expect(cloudinaryImage(`${BASE}/v1/x.jpg`, 199.6)).toContain('w_200/');
  });

  it('leaves an already-transformed, non-Cloudinary, or empty URL unchanged', () => {
    const already = `${BASE}/w_300,c_fill/v123/x.jpg`;
    expect(cloudinaryImage(already, 600)).toBe(already);
    for (const u of ['https://example.com/image/upload/v1/x.jpg', 'blob:http://localhost:3000/abc', '/assets/logo.png']) {
      expect(cloudinaryImage(u, 600)).toBe(u);
    }
    expect(cloudinaryImage(null, 600)).toBe('');
    expect(cloudinaryImage(undefined, 600)).toBe('');
  });
});

describe('cloudinarySrcSet', () => {
  it('returns a 1x + 2x pair with no upscaling param', () => {
    const out = cloudinarySrcSet(`${BASE}/v1/x.jpg`, 400);
    expect(out).toBe(
      `${BASE}/f_auto,q_auto:good,c_limit,w_400/v1/x.jpg 1x, ${BASE}/f_auto,q_auto:good,c_limit,w_800/v1/x.jpg 2x`);
  });

  it('doubles the width for the 2x entry (logos use the best tier)', () => {
    const out = cloudinarySrcSet(`${BASE}/v1/l.png`, 128, 'logo');
    expect(out).toContain('q_auto:best,c_limit,w_128/v1/l.png 1x');
    expect(out).toContain('q_auto:best,c_limit,w_256/v1/l.png 2x');
  });

  it('returns empty for a non-transformable or empty URL (caller omits srcset)', () => {
    expect(cloudinarySrcSet('blob:http://localhost/abc', 400)).toBe('');
    expect(cloudinarySrcSet(`${BASE}/w_300,c_fill/v1/x.jpg`, 400)).toBe('');
    expect(cloudinarySrcSet(null, 400)).toBe('');
    expect(cloudinarySrcSet('', 400)).toBe('');
  });
});
