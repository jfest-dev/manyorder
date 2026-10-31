// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
// The production link-card server lives at the frontend root.
import { headTags, bannerUrl, logolessBanner } from '../../server.mjs';

afterEach(() => { delete process.env.CARD_BANNER_BASE; });

describe('link card head tags', () => {
  it('gives a logoless shop the small square default card when no banner base is set', () => {
    const head = headTags({ name: 'No Logo Cafe', logoUrl: null }, 'no-logo-cafe');
    expect(head).toContain('property="og:image"');
    expect(head).toContain('/manyorder-card.png');
    expect(head).not.toContain('/manyorder-logo.png'); // the old 4500x4500 square is gone
    expect(head).toContain('name="twitter:card" content="summary"');
    expect(head).toContain('property="og:image:width" content="600"');
    expect(head).toContain('property="og:image:height" content="600"');
  });

  it('builds a 1200x630 name banner for a logoless shop when a Cloudinary base is set', () => {
    process.env.CARD_BANNER_BASE = 'https://res.cloudinary.com/x/image/upload/manyorder/brand/card.png';
    const head = headTags({ name: 'Nasi Padang Ibu', logoUrl: null }, 'nasi-padang');
    expect(head).toContain('summary_large_image');
    expect(head).toContain('property="og:image:width" content="1200"');
    expect(head).toContain('property="og:image:height" content="630"');
    // The shop name is drawn as a Cloudinary text overlay (URL-encoded).
    const url = logolessBanner({ name: 'Nasi Padang Ibu' });
    expect(url).toContain('/upload/w_1200,h_630,c_fill');
    expect(url).toContain('l_text:Arial_72_bold:Nasi%20Padang%20Ibu');
  });

  it('returns no overlay banner when no base image is configured', () => {
    expect(logolessBanner({ name: 'Whatever' })).toBe('');
  });

  it('uses a wide 1200x630 banner when the shop has a Cloudinary logo', () => {
    const logo = 'https://res.cloudinary.com/x/image/upload/v1/manyorder/1/logo/a.png';
    const head = headTags({ name: 'Kiri', logoUrl: logo, themeColor: '#123456' }, 'kiri');
    expect(head).toContain('summary_large_image');
    expect(head).toContain('w_1200,h_630');
    expect(head).toContain('property="og:image:width" content="1200"');
    expect(head).toContain('property="og:image:height" content="630"');
    expect(bannerUrl({ logoUrl: logo })).toContain('/upload/w_1200,h_630');
  });
});
