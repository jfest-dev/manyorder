// @vitest-environment node
import { describe, it, expect } from 'vitest';
// The production link-card server lives at the frontend root.
import { headTags, bannerUrl } from '../../server.mjs';

describe('link card head tags', () => {
  it('gives a logoless shop a generic preview image on a summary card', () => {
    const head = headTags({ name: 'No Logo Cafe', logoUrl: null }, 'no-logo-cafe');
    expect(head).toContain('property="og:image"');
    expect(head).toContain('/manyorder-logo.png');
    expect(head).toContain('name="twitter:card" content="summary"');
  });

  it('uses a wide 1200x630 banner when the shop has a Cloudinary logo', () => {
    const logo = 'https://res.cloudinary.com/x/image/upload/v1/manyorder/1/logo/a.png';
    const head = headTags({ name: 'Kiri', logoUrl: logo, themeColor: '#123456' }, 'kiri');
    expect(head).toContain('summary_large_image');
    expect(head).toContain('w_1200,h_630');
    expect(bannerUrl({ logoUrl: logo })).toContain('/upload/w_1200,h_630');
  });
});
