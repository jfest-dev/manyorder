export type StoreCurrency = 'SGD' | 'IDR';

/** Single source of truth for currency symbols — both formatMoney and
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
