import { describe, it, expect } from 'vitest';
import { cloudinaryImage } from './cloudinary';

const BASE = 'https://res.cloudinary.com/tvdpnfdn/image/upload';

describe('cloudinaryImage', () => {
  it('inserts f_auto, q_auto, w_<width>, dpr_auto into a plain Cloudinary upload URL', () => {
    const out = cloudinaryImage(`${BASE}/v123/manyorder/demo/x.jpg`, 600);
    expect(out).toBe(`${BASE}/f_auto,q_auto,w_600,dpr_auto/v123/manyorder/demo/x.jpg`);
  });

  it('works without a version segment', () => {
    const out = cloudinaryImage(`${BASE}/manyorder/demo/x.jpg`, 400);
    expect(out).toBe(`${BASE}/f_auto,q_auto,w_400,dpr_auto/manyorder/demo/x.jpg`);
  });

  it('rounds the width', () => {
    expect(cloudinaryImage(`${BASE}/v1/x.jpg`, 199.6)).toContain('w_200,');
  });

  it('leaves an already-transformed Cloudinary URL unchanged', () => {
    const already = `${BASE}/w_300,c_fill/v123/x.jpg`;
    expect(cloudinaryImage(already, 600)).toBe(already);
    const fauto = `${BASE}/f_auto,q_auto/v1/x.jpg`;
    expect(cloudinaryImage(fauto, 600)).toBe(fauto);
  });

  it('leaves non-Cloudinary URLs unchanged', () => {
    for (const u of [
      'https://example.com/image/upload/v1/x.jpg', // not cloudinary host
      'blob:http://localhost:3000/abc-123',        // local object-URL preview
      'data:image/png;base64,iVBOR',               // data URL
      '/assets/manyorder-logo-abc.png',            // imported asset
    ]) {
      expect(cloudinaryImage(u, 600)).toBe(u);
    }
  });

  it('is safe with null/undefined/empty', () => {
    expect(cloudinaryImage(null, 600)).toBe('');
    expect(cloudinaryImage(undefined, 600)).toBe('');
    expect(cloudinaryImage('', 600)).toBe('');
  });
});
