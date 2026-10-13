// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { purgeRecentOrderRecall } from './legacyCleanup';

describe('purgeRecentOrderRecall', () => {
  beforeEach(() => localStorage.clear());

  it('removes every manyorder_lastorder_* key and leaves other keys alone', () => {
    localStorage.setItem('manyorder_lastorder_1', JSON.stringify({ orderId: 42, phone: '999', token: 'abc' }));
    localStorage.setItem('manyorder_lastorder_77', JSON.stringify({ orderId: 7 }));
    localStorage.setItem('manyorder_cart_1', '[]');
    localStorage.setItem('mo_token', 'keep-me');

    purgeRecentOrderRecall();

    expect(localStorage.getItem('manyorder_lastorder_1')).toBeNull();
    expect(localStorage.getItem('manyorder_lastorder_77')).toBeNull();
    expect(localStorage.getItem('manyorder_cart_1')).toBe('[]');
    expect(localStorage.getItem('mo_token')).toBe('keep-me');
  });

  it('is a no-op when there is nothing to clean', () => {
    expect(() => purgeRecentOrderRecall()).not.toThrow();
    expect(localStorage.length).toBe(0);
  });
});
