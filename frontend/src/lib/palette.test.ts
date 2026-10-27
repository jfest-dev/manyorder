import { describe, it, expect } from 'vitest';
import { PALETTE, THEME_SOLIDS, TAG_COLOR_KEYS, tagColor, isKnownThemeColor } from './palette';

// WCAG relative-luminance contrast ratio between two hex colours.
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
function contrast(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('shared palette', () => {
  it('theme solids and tag keys are the same single list', () => {
    expect(THEME_SOLIDS).toEqual(PALETTE.map((c) => c.solid));
    expect(TAG_COLOR_KEYS).toEqual(PALETTE.map((c) => c.key));
    expect(THEME_SOLIDS.length).toBe(TAG_COLOR_KEYS.length);
  });

  it('every tag tint has readable text (WCAG AA, >= 4.5:1 text on bg)', () => {
    for (const c of PALETTE) {
      const ratio = contrast(c.soft.text, c.soft.bg);
      expect(ratio, `${c.key} text on bg = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('preserves the existing saved tag keys', () => {
    for (const key of ['gray', 'orange', 'blue', 'pink', 'purple']) {
      expect(TAG_COLOR_KEYS).toContain(key);
      expect(tagColor(key)).toBeTruthy();
    }
  });

  it('preserves the existing saved theme solids', () => {
    for (const hex of ['#000000', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F97316']) {
      expect(isKnownThemeColor(hex)).toBe(true);
    }
  });

  it('treats an unknown saved theme colour as Custom', () => {
    expect(isKnownThemeColor('#123456')).toBe(false);
    expect(isKnownThemeColor(null)).toBe(false);
  });

  it('falls back to the default tag colour for an unknown key', () => {
    expect(tagColor('chartreuse')).toEqual(tagColor('gray'));
  });
});
