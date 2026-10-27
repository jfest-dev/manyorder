export type StoreCurrency = 'SGD' | 'IDR';

/** Single source of truth for currency symbols - both formatMoney and
 *  currencySymbol read from here so they can never drift apart. */
const CURRENCY_SYMBOLS: Record<StoreCurrency, string> = {
  SGD: 'S$',
  IDR: 'Rp',
};

function normalize(currency: string | undefined): StoreCurrency {
  return (currency || 'SGD').toUpperCase() === 'IDR' ? 'IDR' : 'SGD';
}

/** Bare currency symbol for a store's currency (e.g. input prefixes). */
export function currencySymbol(currency: string | undefined): string {
  return CURRENCY_SYMBOLS[normalize(currency)];
}

/** Sane price bounds for a single F&B product. SGD and IDR differ ~10,000x in
 *  scale, so the ceiling/step are currency-aware rather than one fixed number. */
export function priceLimits(currency: string | undefined): { min: number; max: number; step: number } {
  return normalize(currency) === 'IDR'
    ? { min: 100, max: 100_000_000, step: 100 }
    : { min: 0.01, max: 10_000, step: 0.01 };
}

/**
 * SGD -> "S$5.50"  (2 decimals, comma thousands)
 * IDR -> "Rp 25.000" (0 decimals, dot thousands)
 */
export function formatMoney(amount: number, currency: string | undefined): string {
  const code = normalize(currency);
  if (code === 'IDR') {
    return `${CURRENCY_SYMBOLS.IDR} ${Math.round(amount).toLocaleString('id-ID')}`;
  }
  return `${CURRENCY_SYMBOLS.SGD}${amount.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Decimal places a currency's amounts carry: SGD = 2 (cents), IDR = 0 (whole). */
export function moneyFractionDigits(currency: string | undefined): number {
  return normalize(currency) === 'IDR' ? 0 : 2;
}

export interface MoneyParseResult {
  /** Canonical numeric value in major units, or null when the input is empty. */
  value: number | null;
  /** A human message when the raw text can't be a valid amount for this currency. */
  error?: string;
}

/**
 * Parse merchant-typed money into a canonical number, currency-aware, so the
 * same "5.50" / "5,50" / "25.000" text can't mean different amounts on
 * different browsers.
 *
 *   IDR: no decimals. '.', ',' and spaces are GROUPING only and are stripped,
 *        so "25.000", "25,000" and "25000" all parse to 25000. A leftover
 *        non-digit (or a bare separator) is rejected.
 *   SGD: up to 2 decimals with '.' as the decimal point. A comma is accepted and
 *        normalised: when it's clearly a thousands separator (a dot is also
 *        present, or the run after the last comma is exactly 3 digits) every
 *        comma is stripped as grouping; otherwise the last comma is treated as
 *        the decimal point ("5,50" -> 5.50). Anything leaving >2 decimals (e.g.
 *        the ambiguous "5,500") is rejected rather than silently mis-read.
 *
 * Range is intentionally NOT enforced here - callers apply their own bounds
 * (a product price floor differs from a delivery fee that may be 0).
 */
export function parseMoneyInput(raw: string, currency: string | undefined): MoneyParseResult {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return { value: null };

  if (normalize(currency) === 'IDR') {
    const digits = trimmed.replace(/[.,\s]/g, '');
    if (!/^\d+$/.test(digits)) return { value: null, error: 'Enter a whole number, e.g. 25.000' };
    return { value: parseInt(digits, 10) };
  }

  // SGD
  let s = trimmed.replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) {
    // Mixed separators: comma must be grouping, dot the decimal ("1,000.50").
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3) {
      s = parts.join(''); // e.g. "1,000" -> "1000" (comma = grouping)
    } else {
      s = parts.slice(0, -1).join('') + '.' + last; // e.g. "5,50" -> "5.50"
    }
  }
  if (!/^\d*(\.\d*)?$/.test(s) || s === '.' ) {
    return { value: null, error: 'Enter a valid amount, e.g. 5.50' };
  }
  const decimals = s.split('.')[1];
  if (decimals && decimals.length > 2) {
    return { value: null, error: 'Use at most 2 decimal places, e.g. 5.50' };
  }
  const value = parseFloat(s);
  if (Number.isNaN(value)) return { value: null, error: 'Enter a valid amount, e.g. 5.50' };
  return { value };
}

/**
 * Render a numeric value as the normalised text shown INSIDE a money input (no
 * currency symbol - that's a separate prefix). SGD keeps 2 decimals with comma
 * grouping ("1,000.00"); IDR is a whole number with dot grouping ("25.000").
 * Feeding this back through {@link parseMoneyInput} round-trips exactly.
 */
export function formatMoneyInput(value: number | null | undefined, currency: string | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  if (normalize(currency) === 'IDR') {
    return Math.round(value).toLocaleString('id-ID');
  }
  return value.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
