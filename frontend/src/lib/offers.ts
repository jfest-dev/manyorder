import { formatMoney } from './currency';
import type { PublicOffer } from './api';

/** The offer's headline value, e.g. "10% off", "$5.00 off", "Free delivery". */
export function offerValueLabel(o: PublicOffer, currency: string): string {
  return o.type === 'FREE_DELIVERY' ? 'Free delivery'
    : o.type === 'PERCENTAGE' ? `${o.value}% off`
      : `${formatMoney(o.value, currency)} off`;
}

/**
 * Short, dot-separated conditions for an offer, e.g. "Min spend $20 · First order
 * only". Scope is handled separately (o.scopeLabel), so it's not repeated here.
 * Empty string when the offer has no conditions to note.
 */
export function offerConditions(o: PublicOffer, currency: string): string {
  const parts: string[] = [];
  if (o.minSpend != null && o.minSpend > 0) parts.push(`Min spend ${formatMoney(o.minSpend, currency)}`);
  if (o.firstOrderOnly) parts.push('First order only');
  return parts.join(' · ');
}

/** "Valid until 30 Sep 2026" from the offer's end date, or '' when there's none. */
export function offerExpiry(o: PublicOffer): string {
  if (!o.endsAt) return '';
  const d = new Date(o.endsAt);
  if (Number.isNaN(d.getTime())) return '';
  return `Valid until ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
