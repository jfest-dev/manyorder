import { describe, it, expect } from 'vitest';
import { reasonText, offerUnmetReasons } from './discountReasons';
import type { DiscountReason, PublicOffer } from './api';

const r = (code: DiscountReason['code'], amount: number | null = null, productName: string | null = null): DiscountReason =>
  ({ code, amount, productName });

describe('reasonText - customer-facing wording', () => {
  it('MIN_SPEND shows the remaining amount in SGD', () => {
    expect(reasonText(r('MIN_SPEND', 12.5), 'SGD')).toBe('Add S$12.50 more to use this code');
  });

  it('MIN_SPEND shows IDR with no decimals', () => {
    expect(reasonText(r('MIN_SPEND', 12500), 'IDR')).toBe('Add Rp 12.500 more to use this code');
  });

  it('PRODUCT_SCOPE names the item to add', () => {
    expect(reasonText(r('PRODUCT_SCOPE', null, 'Iced Latte'), 'SGD')).toBe('Add Iced Latte to use this code');
  });

  it('first-order and delivery-only read as specified', () => {
    expect(reasonText(r('FIRST_ORDER_ONLY'), 'SGD')).toBe('For first orders only');
    expect(reasonText(r('DELIVERY_ONLY'), 'SGD')).toBe('Delivery orders only');
  });

  it('lifecycle reasons are plain', () => {
    expect(reasonText(r('EXPIRED'), 'SGD')).toBe('This code has expired');
    expect(reasonText(r('NOT_STARTED'), 'SGD')).toBe("This code isn't available yet");
    expect(reasonText(r('USAGE_LIMIT'), 'SGD')).toBe('This code has reached its limit');
    expect(reasonText(r('INACTIVE'), 'SGD')).toBe('This code is no longer available');
  });

  it('an unknown code reveals only that it is invalid', () => {
    expect(reasonText(r('INVALID'), 'SGD')).toBe("This code isn't valid");
  });
});

const offer = (over: Partial<PublicOffer>): PublicOffer => ({
  code: 'CODE', name: null, type: 'PERCENTAGE', value: 10, minSpend: null, firstOrderOnly: false,
  appliesToDelivery: false, storeWide: true, productIds: [], scopeLabel: 'All products', endsAt: null,
  ...over,
});

describe('offerUnmetReasons - the public offers list mirror', () => {
  it('flags min spend not met, with the remaining amount', () => {
    const out = offerUnmetReasons(offer({ minSpend: 30 }), { subtotal: 17.5, delivery: false, productIds: [1] });
    expect(out).toEqual([{ code: 'MIN_SPEND', amount: 12.5, productName: null }]);
  });

  it('flags a delivery offer on a pickup order', () => {
    const out = offerUnmetReasons(offer({ type: 'FREE_DELIVERY' }), { subtotal: 50, delivery: false, productIds: [1] });
    expect(out).toEqual([{ code: 'DELIVERY_ONLY', amount: null, productName: null }]);
  });

  it('flags a product-specific offer whose item is missing, with the scope label', () => {
    const out = offerUnmetReasons(
      offer({ storeWide: false, productIds: [99], scopeLabel: 'Iced Latte' }),
      { subtotal: 50, delivery: false, productIds: [1, 2] },
    );
    expect(out).toEqual([{ code: 'PRODUCT_SCOPE', amount: null, productName: 'Iced Latte' }]);
  });

  it('returns nothing when the offer applies', () => {
    expect(offerUnmetReasons(offer({ minSpend: 10 }), { subtotal: 50, delivery: true, productIds: [1] })).toEqual([]);
  });

  it('does not flag first-order-only (unknown client-side)', () => {
    expect(offerUnmetReasons(offer({ firstOrderOnly: true }), { subtotal: 50, delivery: false, productIds: [1] })).toEqual([]);
  });
});
