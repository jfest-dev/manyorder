// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { storefrontTheme, parseHex, contrastRatio, SF_ACCENT_FALLBACK } from './storefrontTheme';

const rgb = (hex: string) => parseHex(hex)!;

describe('parseHex', () => {
  it('reads #rrggbb and #rgb, case-insensitively, trimming space', () => {
    expect(parseHex('#000000')).toEqual([0, 0, 0]);
    expect(parseHex('#FFFFFF')).toEqual([255, 255, 255]);
    expect(parseHex('#1d4ed8')).toEqual([29, 78, 216]);
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('  #abc ')).toEqual([170, 187, 204]);
  });

  it('rejects anything that is not a hex colour', () => {
    for (const bad of [null, undefined, '', 'red', '000000', '#12', '#12345', '#1234567', 'rgb(0,0,0)', '#xyzxyz']) {
      expect(parseHex(bad as string | null | undefined)).toBeNull();
    }
  });
});

describe('contrastRatio (report only, not a gate)', () => {
  it('matches known WCAG anchors', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1, 5);
  });
});

describe('storefrontTheme — the permanent rule (no gate)', () => {
  it('uses the EXACT saved colour when it is valid, with no gate and no remapping', () => {
    // Including mid-bright colours that the old gate would have sent to black.
    for (const hex of ['#1D4ED8', '#EC4899', '#10B981', '#F97316', '#8B5CF6', '#000000']) {
      expect(storefrontTheme(hex)).toEqual({ '--sf-accent': hex });
      expect(contrastRatio([255, 255, 255], rgb(hex))).toBeGreaterThan(0); // numbers exist for the report
    }
  });

  it('keeps casing and shorthand exactly as saved, only trimming space', () => {
    expect(storefrontTheme('#1d4ed8')).toEqual({ '--sf-accent': '#1d4ed8' });
    expect(storefrontTheme('#036')).toEqual({ '--sf-accent': '#036' });
    expect(storefrontTheme('  #AABBCC ')).toEqual({ '--sf-accent': '#AABBCC' });
  });

  it('falls back to the no-theme black when the colour is missing or invalid', () => {
    for (const bad of [null, undefined, '', 'blue', '#12345', 'var(--primary-solid)']) {
      expect(storefrontTheme(bad as string | null | undefined)).toEqual({ '--sf-accent': SF_ACCENT_FALLBACK });
    }
    expect(SF_ACCENT_FALLBACK).toBe('var(--primary-solid)');
  });
});
