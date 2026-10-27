import { describe, it, expect } from 'vitest';
import {
  parseMoneyInput,
  formatMoneyInput,
  formatMoney,
  moneyFractionDigits,
} from './currency';

describe('moneyFractionDigits', () => {
  it('is 2 for SGD (and unknown/blank, which fall back to SGD)', () => {
    expect(moneyFractionDigits('SGD')).toBe(2);
    expect(moneyFractionDigits('sgd')).toBe(2);
    expect(moneyFractionDigits(undefined)).toBe(2);
    expect(moneyFractionDigits('USD')).toBe(2);
  });
  it('is 0 for IDR (case-insensitive)', () => {
    expect(moneyFractionDigits('IDR')).toBe(0);
    expect(moneyFractionDigits('idr')).toBe(0);
  });
});

describe('parseMoneyInput - SGD', () => {
  it('accepts a plain 2-decimal amount', () => {
    expect(parseMoneyInput('5.50', 'SGD')).toEqual({ value: 5.5 });
    expect(parseMoneyInput('0', 'SGD')).toEqual({ value: 0 });
    expect(parseMoneyInput('12', 'SGD')).toEqual({ value: 12 });
  });

  it('treats a comma as the decimal point when it is clearly decimal', () => {
    expect(parseMoneyInput('5,50', 'SGD')).toEqual({ value: 5.5 });
    expect(parseMoneyInput('5,5', 'SGD')).toEqual({ value: 5.5 });
  });

  it('treats a comma as thousands grouping when the trailing run is 3 digits', () => {
    expect(parseMoneyInput('1,000', 'SGD')).toEqual({ value: 1000 });
    expect(parseMoneyInput('5,500', 'SGD')).toEqual({ value: 5500 });
  });

  it('handles mixed grouping + decimal (comma grouping, dot decimal)', () => {
    expect(parseMoneyInput('1,000.50', 'SGD')).toEqual({ value: 1000.5 });
    expect(parseMoneyInput('1,234,567.89', 'SGD')).toEqual({ value: 1234567.89 });
  });

  it('rejects more than 2 decimal places rather than silently truncating', () => {
    expect(parseMoneyInput('5.555', 'SGD').value).toBeNull();
    expect(parseMoneyInput('5.555', 'SGD').error).toBeTruthy();
  });

  it('rejects non-numeric junk and a bare separator', () => {
    expect(parseMoneyInput('abc', 'SGD').value).toBeNull();
    expect(parseMoneyInput('.', 'SGD').value).toBeNull();
    expect(parseMoneyInput('5.5.5', 'SGD').value).toBeNull();
  });

  it('ignores surrounding whitespace and returns null for empty input', () => {
    expect(parseMoneyInput('  7.25  ', 'SGD')).toEqual({ value: 7.25 });
    expect(parseMoneyInput('', 'SGD')).toEqual({ value: null });
    expect(parseMoneyInput('   ', 'SGD')).toEqual({ value: null });
  });
});

describe('parseMoneyInput - IDR', () => {
  it('strips . , and spaces as grouping and parses a whole integer', () => {
    // The core guard against a 1000x mis-entry: "25.000" means 25000, not 25.
    expect(parseMoneyInput('25.000', 'IDR')).toEqual({ value: 25000 });
    expect(parseMoneyInput('25,000', 'IDR')).toEqual({ value: 25000 });
    expect(parseMoneyInput('25 000', 'IDR')).toEqual({ value: 25000 });
    expect(parseMoneyInput('25000', 'IDR')).toEqual({ value: 25000 });
    expect(parseMoneyInput('1.250.000', 'IDR')).toEqual({ value: 1250000 });
  });

  it('returns null for empty input', () => {
    expect(parseMoneyInput('', 'IDR')).toEqual({ value: null });
  });

  it('rejects non-numeric junk', () => {
    expect(parseMoneyInput('abc', 'IDR').value).toBeNull();
    expect(parseMoneyInput('12a3', 'IDR').value).toBeNull();
  });
});

describe('formatMoneyInput (editable text, no symbol)', () => {
  it('formats SGD with 2 decimals and comma grouping', () => {
    expect(formatMoneyInput(5.5, 'SGD')).toBe('5.50');
    expect(formatMoneyInput(1000, 'SGD')).toBe('1,000.00');
    expect(formatMoneyInput(0, 'SGD')).toBe('0.00');
  });

  it('formats IDR as a whole number with dot grouping', () => {
    expect(formatMoneyInput(25000, 'IDR')).toBe('25.000');
    expect(formatMoneyInput(1250000, 'IDR')).toBe('1.250.000');
    // Any fractional value is rounded to whole for IDR display.
    expect(formatMoneyInput(25000.4, 'IDR')).toBe('25.000');
  });

  it('renders null/undefined/NaN as an empty string', () => {
    expect(formatMoneyInput(null, 'SGD')).toBe('');
    expect(formatMoneyInput(undefined, 'IDR')).toBe('');
    expect(formatMoneyInput(NaN, 'SGD')).toBe('');
  });
});

describe('round-trip: formatMoneyInput -> parseMoneyInput', () => {
  it('SGD values survive a format/parse round-trip exactly', () => {
    for (const v of [0, 5.5, 12, 1000, 1234.56, 99999.99]) {
      expect(parseMoneyInput(formatMoneyInput(v, 'SGD'), 'SGD')).toEqual({ value: v });
    }
  });

  it('IDR values survive a format/parse round-trip exactly', () => {
    for (const v of [0, 100, 25000, 1250000, 99999999]) {
      expect(parseMoneyInput(formatMoneyInput(v, 'IDR'), 'IDR')).toEqual({ value: v });
    }
  });
});

describe('formatMoney (display, with symbol) stays currency-aware', () => {
  it('SGD shows S$ with 2 decimals', () => {
    expect(formatMoney(5.5, 'SGD')).toBe('S$5.50');
    expect(formatMoney(1000, 'SGD')).toBe('S$1,000.00');
  });
  it('IDR shows Rp with 0 decimals and dot grouping', () => {
    expect(formatMoney(25000, 'IDR')).toBe('Rp 25.000');
  });
});
