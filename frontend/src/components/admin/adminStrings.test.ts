// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ADMIN_STRINGS, BANNED_JARGON } from './adminStrings';

/** Collect every string value in the strings object. */
function allStrings(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === 'string') out.push(obj);
  else if (Array.isArray(obj)) obj.forEach((v) => allStrings(v, out));
  else if (obj && typeof obj === 'object') Object.values(obj).forEach((v) => allStrings(v, out));
  return out;
}

describe('admin dashboard strings are in plain words', () => {
  const strings = allStrings(ADMIN_STRINGS);

  it('has no banned jargon anywhere in the labels or help text', () => {
    for (const s of strings) {
      for (const word of BANNED_JARGON) {
        expect(s.toLowerCase().includes(word), `"${s}" contains banned word "${word}"`).toBe(false);
      }
    }
  });

  it('actually contains the section titles', () => {
    expect(strings).toContain('What happened');
    expect(strings).toContain('Needs your action');
    expect(strings).toContain('Where people drop off');
    expect(strings).toContain('Right now (ignores the dates)');
    expect(strings).toContain('More details');
  });
});
