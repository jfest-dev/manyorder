import { describe, it, expect } from 'vitest';
import type { PublicOffer } from './api';
import { offerValueLabel, offerConditions, offerExpiry } from './offers';

function offer(overrides: Partial<PublicOffer> = {}): PublicOffer {
  return {
    code: 'SAVE', name: null, type: 'PERCENTAGE', value: 10,
    minSpend: null, firstOrderOnly: false, storeWide: true, productIds: [],
    scopeLabel: 'All products', endsAt: null,
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

  it('lists min spend and first-order-only (scope handled separately)', () => {
    const s = offerConditions(offer({ minSpend: 20, firstOrderOnly: true }), 'SGD');
    expect(s).toContain('Min spend');
    expect(s).toContain('First order only');
    expect(s.split(' · ')).toHaveLength(2);
    // scope is NOT part of conditions
    expect(s).not.toContain('products');
  });

  it('ignores a zero/absent min spend', () => {
    expect(offerConditions(offer({ minSpend: 0 }), 'SGD')).toBe('');
  });

  it('shows only first-order-only when that is the sole condition', () => {
    expect(offerConditions(offer({ firstOrderOnly: true }), 'SGD')).toBe('First order only');
  });
});

describe('offerExpiry', () => {
  it('is empty when there is no end date', () => {
    expect(offerExpiry(offer({ endsAt: null }))).toBe('');
  });

  it('formats an end date as "Valid until …"', () => {
    const s = offerExpiry(offer({ endsAt: '2026-09-30T23:59:59' }));
    expect(s.startsWith('Valid until')).toBe(true);
    expect(s).toContain('2026');
  });

  it('ignores an unparseable end date', () => {
    expect(offerExpiry(offer({ endsAt: 'nope' }))).toBe('');
  });
});
