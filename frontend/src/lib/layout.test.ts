import { describe, it, expect } from 'vitest';
import { pagePadding, PAGE_PAD_PHONE, PAGE_PAD_DESKTOP } from './layout';

// The single source for the page side gap. The cross-browser pixel regression
// (spacing audit) relies on this phone value; pinning it here makes an accidental
// change show up as a failing unit test too.
describe('pagePadding - the one shared page side gap', () => {
  it('uses the tighter phone gap below the desktop breakpoint', () => {
    expect(PAGE_PAD_PHONE).toBe(16);
    expect(pagePadding(false)).toBe('16px');
  });

  it('keeps the established desktop gap', () => {
    expect(PAGE_PAD_DESKTOP).toBe(24);
    expect(pagePadding(true)).toBe('24px');
  });
});
