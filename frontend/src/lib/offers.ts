import { formatMoney } from './currency';
import type { PublicOffer } from './api';

/** The offer's headline value, e.g. "10% off", "$5.00 off", "Free delivery". */
export function offerValueLabel(o: PublicOffer, currency: string): string {
  return o.type === 'FREE_DELIVERY' ? 'Free delivery'
    : o.type === 'PERCENTAGE' ? `${o.value}% off`
      : `${formatMoney(o.value, currency)} off`;
}

/**
 * Short, dot-separated conditions for an offer, e.g. "min $20 · first order only
 * · selected items". Empty string when the offer has no conditions to note.
 */
export function offerConditions(o: PublicOffer, currency: string): string {
  const parts: string[] = [];
  if (o.minSpend != null && o.minSpend > 0) parts.push(`min ${formatMoney(o.minSpend, currency)}`);
  if (o.firstOrderOnly) parts.push('first order only');
  if (!o.storeWide) parts.push('selected items');
  return parts.join(' · ');
}
