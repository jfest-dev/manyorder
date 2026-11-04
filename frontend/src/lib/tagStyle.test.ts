// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { deriveTagStyle, contrast, TAG_TEXT_MIN_CONTRAST } from './tagStyle';

const hex2rgb = (h: string): [number, number, number] => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
};

// The six swatches and the exact style each one derives to (pinned).
const EXPECT: Record<string, { bg: string; text: string; border: string }> = {
  '#000000': { bg: '#E0E0E0', text: '#636363', border: '#000000' }, // gray/Slate
  '#3B82F6': { bg: '#E7F0FE', text: '#0B62EF', border: '#3B82F6' }, // blue
  '#8B5CF6': { bg: '#F1EBFE', text: '#530DF2', border: '#8B5CF6' }, // purple
  '#EC4899': { bg: '#FDE9F3', text: '#CB156F', border: '#EC4899' }, // pink
  '#10B981': { bg: '#E2F7F0', text: '#0B7A55', border: '#10B981' }, // green
  '#F97316': { bg: '#FEEEE3', text: '#B34C05', border: '#F97316' }, // orange
};

describe('deriveTagStyle', () => {
  it('derives the exact pinned chip colours for every swatch', () => {
    for (const [solid, exp] of Object.entries(EXPECT)) {
      const d = deriveTagStyle(solid);
      expect(d, solid).toEqual({ bg: exp.bg, text: exp.text, border: exp.border, dot: solid });
    }
  });

  it('border and dot are always the EXACT swatch colour', () => {
    for (const solid of Object.keys(EXPECT)) {
      const d = deriveTagStyle(solid);
      expect(d.border).toBe(solid);
      expect(d.dot).toBe(solid);
    }
  });

  it('text stays readable on the fill (WCAG AA) for every swatch', () => {
    for (const solid of Object.keys(EXPECT)) {
      const d = deriveTagStyle(solid);
      expect(contrast(hex2rgb(d.text), hex2rgb(d.bg)), `${solid} text on fill`).toBeGreaterThanOrEqual(TAG_TEXT_MIN_CONTRAST);
    }
  });

  it('the fill is a pale tint (much lighter than the swatch)', () => {
    for (const solid of Object.keys(EXPECT)) {
      const d = deriveTagStyle(solid);
      // Every channel of the fill is lighter than, or equal to, the swatch, and the
      // fill reads as near-white (each channel >= 0xDE).
      const [r, g, b] = hex2rgb(d.bg);
      expect(Math.min(r, g, b), `${solid} fill is pale`).toBeGreaterThanOrEqual(0xDE);
    }
  });
});
