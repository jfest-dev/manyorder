export type StoreCurrency = 'SGD' | 'IDR';

/**
 * SGD -> "S$5.50"  (2 decimals, comma thousands)
 * IDR -> "Rp 25.000" (0 decimals, dot thousands)
 */
export function formatMoney(amount: number, currency: string | undefined): string {
  const code = (currency || 'SGD').toUpperCase();
  if (code === 'IDR') {
    return `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
  }
  return `S$${amount.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
