import { describe, it, expect } from 'vitest';
import type { PublicOffer } from './api';
import { offerValueLabel, offerConditions } from './offers';

function offer(overrides: Partial<PublicOffer> = {}): PublicOffer {
  return {
    code: 'SAVE', name: null, type: 'PERCENTAGE', value: 10,
    minSpend: null, firstOrderOnly: false, storeWide: true, productIds: [],
    ...overrides,
  };
}

describe('offerValueLabel', () => {
  it('formats percentage, fixed, and free delivery', () => {
    expect(offerValueLabel(offer({ type: 'PERCENTAGE', value: 10 }), 'SGD')).toBe('10% off');
    expect(offerValueLabel(offer({ type: 'FIXED', value: 5 }), 'SGD')).toContain('off');
    expect(offerValueLabel(offer({ type: 'FIXED', value: 5 }), 'SGD')).toMatch(/5/);
    expect(offerValueLabel(offer({ type: 'FREE_DELIVERY', value: 0 }), 'SGD')).toBe('Free delivery');
  });
});

describe('offerConditions', () => {
  it('is empty when there are no conditions', () => {
    expect(offerConditions(offer(), 'SGD')).toBe('');
  });

  it('lists min spend, first-order-only, and product scope in order', () => {
    const s = offerConditions(offer({ minSpend: 20, firstOrderOnly: true, storeWide: false }), 'SGD');
    expect(s).toContain('min');
    expect(s).toContain('first order only');
    expect(s).toContain('selected items');
    // dot-separated
    expect(s.split(' · ')).toHaveLength(3);
  });

  it('ignores a zero/absent min spend', () => {
    expect(offerConditions(offer({ minSpend: 0 }), 'SGD')).toBe('');
  });

  it('omits the product-scope note for a store-wide offer', () => {
    expect(offerConditions(offer({ storeWide: true, firstOrderOnly: true }), 'SGD')).toBe('first order only');
  });
});
