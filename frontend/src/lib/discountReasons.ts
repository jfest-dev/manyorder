import { formatMoney } from './currency';
import type { PublicOffer, DiscountReason } from './api';

export type { DiscountReason, DiscountReasonCode, DiscountEvaluation } from './api';

/**
 * One human line for a reason, in the store's currency. The MIN_SPEND and
 * PRODUCT_SCOPE wordings are the customer-facing contract:
 *   "Add S$12.50 more to use this code" / "Add Rp 12.500 more to use this code"
 *   "Add Iced Latte to use this code"
 */
export function reasonText(reason: DiscountReason, currency: string): string {
  switch (reason.code) {
    case 'MIN_SPEND':
      return `Add ${formatMoney(reason.amount ?? 0, currency)} more to use this code`;
    case 'PRODUCT_SCOPE':
      return `Add ${reason.productName ?? 'a qualifying item'} to use this code`;
    case 'FIRST_ORDER_ONLY':
      return 'For first orders only';
    case 'DELIVERY_ONLY':
      return 'Delivery orders only';
    case 'DELIVERY_PENDING':
      return "Delivery fee is still to be confirmed, so this code can't apply yet";
    case 'DELIVERY_ALREADY_FREE':
      return 'Delivery is already free on this order';
    case 'SALE_CONFLICT':
      return "Can't be combined with sale-priced items";
    case 'USAGE_LIMIT':
      return 'This code has reached its limit';
    case 'EXPIRED':
      return 'This code has expired';
    case 'NOT_STARTED':
      return "This code isn't available yet";
    case 'INACTIVE':
      return 'This code is no longer available';
    case 'INVALID':
      return "This code isn't valid";
    default:
      return "This code isn't valid";
  }
}

/**
 * Client mirror of the server's eligibility gates for the PUBLIC offers list, so
 * each offer card can show why it doesn't currently apply (greyed Apply) and
 * re-compute instantly as the cart or fulfilment changes - without a server call
 * per offer. The server stays the final check at apply/submit. First-order-only
 * can't be known client-side (no contact yet), so it's shown as a static
 * condition elsewhere, not as a live "not available" reason here.
 */
export function offerUnmetReasons(
  offer: PublicOffer,
  ctx: { subtotal: number; delivery: boolean; productIds: number[] },
): DiscountReason[] {
  const reasons: DiscountReason[] = [];
  if (offer.minSpend != null && ctx.subtotal < offer.minSpend) {
    reasons.push({ code: 'MIN_SPEND', amount: offer.minSpend - ctx.subtotal, productName: null });
  }
  if (offer.type === 'FREE_DELIVERY' || offer.appliesToDelivery) {
    if (!ctx.delivery) reasons.push({ code: 'DELIVERY_ONLY', amount: null, productName: null });
  } else if (!offer.storeWide) {
    const matches = offer.productIds.some((id) => ctx.productIds.includes(id));
    if (!matches) reasons.push({ code: 'PRODUCT_SCOPE', amount: null, productName: offer.scopeLabel });
  }
  return reasons;
}
