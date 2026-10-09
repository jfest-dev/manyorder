import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from './adminDatetime';

// A local date-time (no trailing Z) parses as local time, so these are timezone-stable.
const ISO = '2026-07-07T17:11:04';

describe('admin date/time formatting', () => {
  it('formats a date as "7 July 2026"', () => {
    expect(formatDate(ISO)).toBe('7 July 2026');
  });

  it('formats a date-time as "7 July 2026, 5:11 PM" with no seconds', () => {
    const out = formatDateTime(ISO);
    expect(out).toBe('7 July 2026, 5:11 PM');
    expect(out).not.toContain(':04'); // never shows seconds
    expect(out).not.toMatch(/\d{2}\/\d{2}\/\d{4}/); // never the numeric dd/mm/yyyy form
  });

  it('returns a dash for empty values', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
    expect(formatDate('not-a-date')).toBe('-');
  });
});
