import { describe, it, expect } from 'vitest';
import { ADMIN_FONT, ADMIN_SIZE, adminText } from './adminTokens';

describe('admin size tokens', () => {
  it('meets the floors: body at least 14, small/caption at least 12', () => {
    expect(ADMIN_FONT.body).toBeGreaterThanOrEqual(14);
    expect(ADMIN_FONT.small).toBeGreaterThanOrEqual(12);
    expect(ADMIN_FONT.caption).toBeGreaterThanOrEqual(12);
  });

  it('uses the agreed six values', () => {
    expect(ADMIN_FONT).toMatchObject({ title: 20, heading: 16, body: 14, small: 13, caption: 12, metric: 24 });
  });

  it('keeps phone tap targets at least 44', () => {
    expect(ADMIN_SIZE.tapTarget).toBeGreaterThanOrEqual(44);
    expect(ADMIN_SIZE.controlHeight).toBe(40);
  });

  it('exposes ready text styles backed by the font scale', () => {
    expect(adminText.body.fontSize).toBe(ADMIN_FONT.body);
    expect(adminText.metric.fontSize).toBe(ADMIN_FONT.metric);
  });
});
