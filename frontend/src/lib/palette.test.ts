import { describe, it, expect } from 'vitest';
import { PALETTE, THEME_SOLIDS, TAG_SOFT, TAG_COLOR_KEYS, tagColor, isKnownThemeColor } from './palette';

describe('shared palette (tags and theme picker are one list)', () => {
  it('both pickers render the same keys, names and order, side by side', () => {
    const KEYS = ['gray', 'blue', 'purple', 'pink', 'green', 'orange'];
    const NAMES = ['Slate', 'Blue', 'Purple', 'Pink', 'Green', 'Orange'];
    expect(PALETTE.map((c) => c.key)).toEqual(KEYS);
    expect(PALETTE.map((c) => c.name)).toEqual(NAMES);
    // The theme swatches and the tag keys come from the same list in the same order.
    expect(TAG_COLOR_KEYS).toEqual(PALETTE.map((c) => c.key));
    expect(THEME_SOLIDS).toEqual(PALETTE.map((c) => c.solid));
    expect(Object.keys(TAG_SOFT)).toEqual(PALETTE.map((c) => c.key));
  });

  // Pins every theme swatch (Settings picker). Unchanged from origin/main.
  it('pins every theme picker swatch exactly', () => {
    const SOLIDS: Record<string, string> = {
      gray: '#000000', blue: '#3B82F6', purple: '#8B5CF6',
      pink: '#EC4899', green: '#10B981', orange: '#F97316',
    };
    for (const c of PALETTE) expect(c.solid, `swatch ${c.key}`).toBe(SOLIDS[c.key]);
  });

  // Pins every derived tag chip value (fill / text / border / dot).
  it('pins every tag chip colour exactly', () => {
    const LOCK: Record<string, { bg: string; text: string; border: string; dot: string }> = {
      gray:   { bg: '#E0E0E0', text: '#636363', border: '#000000', dot: '#000000' },
      blue:   { bg: '#E7F0FE', text: '#0B62EF', border: '#3B82F6', dot: '#3B82F6' },
      purple: { bg: '#F1EBFE', text: '#530DF2', border: '#8B5CF6', dot: '#8B5CF6' },
      pink:   { bg: '#FDE9F3', text: '#CB156F', border: '#EC4899', dot: '#EC4899' },
      green:  { bg: '#E2F7F0', text: '#0B7A55', border: '#10B981', dot: '#10B981' },
      orange: { bg: '#FEEEE3', text: '#B34C05', border: '#F97316', dot: '#F97316' },
    };
    for (const c of PALETTE) expect(tagColor(c.key), `tag ${c.key}`).toEqual(LOCK[c.key]);
  });

  it('preserves the existing saved tag keys', () => {
    for (const key of ['gray', 'orange', 'blue', 'pink', 'purple', 'green']) {
      expect(TAG_COLOR_KEYS).toContain(key);
      expect(tagColor(key)).toBeTruthy();
    }
  });

  it('a saved key not in the palette maps to the default swatch without renaming it', () => {
    expect(tagColor('brown')).toEqual(tagColor('gray'));
  });

  it('known theme solids are known; an off-palette hex is Custom', () => {
    for (const hex of ['#000000', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F97316']) {
      expect(isKnownThemeColor(hex)).toBe(true);
    }
    expect(isKnownThemeColor('#123456')).toBe(false);
    expect(isKnownThemeColor(null)).toBe(false);
  });
});
