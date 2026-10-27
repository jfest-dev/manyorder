import { formatMoney } from './currency';
import type { PublicOffer } from './api';

/** The offer's headline value, e.g. "10% off", "$5.00 off", "Free delivery",
 *  "20% off delivery" / "$3.00 off delivery" for a partial delivery discount. */
export function offerValueLabel(o: PublicOffer, currency: string): string {
  if (o.type === 'FREE_DELIVERY') return 'Free delivery';
  const base = o.type === 'PERCENTAGE' ? `${o.value}% off` : `${formatMoney(o.value, currency)} off`;
  return o.appliesToDelivery ? `${base} delivery` : base;
}

/** What the offer applies to, for the card's scope line: "Delivery" for any
 *  delivery discount, otherwise the server-provided product scope. */
export function offerScopeLabel(o: PublicOffer): string {
  return (o.type === 'FREE_DELIVERY' || o.appliesToDelivery) ? 'Delivery' : o.scopeLabel;
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
