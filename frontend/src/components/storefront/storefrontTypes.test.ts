import { describe, it, expect } from 'vitest';
import type { ProductResponse } from '../../lib/api';
import { lowStockRemaining, LOW_STOCK_AT } from './storefrontTypes';

// lowStockRemaining only reads stock + preOrder, so a partial cast is enough.
const p = (stock: number, preOrder = false) => ({ stock, preOrder } as ProductResponse);

describe('lowStockRemaining', () => {
  it('returns the count when stock is 1..LOW_STOCK_AT', () => {
    expect(lowStockRemaining(p(1))).toBe(1);
    expect(lowStockRemaining(p(3))).toBe(3);
    expect(lowStockRemaining(p(LOW_STOCK_AT))).toBe(LOW_STOCK_AT); // boundary is inclusive
  });

  it('is null when out of stock or above the threshold', () => {
    expect(lowStockRemaining(p(0))).toBeNull();
    expect(lowStockRemaining(p(LOW_STOCK_AT + 1))).toBeNull();
  });

  it('is null for pre-order items regardless of stock', () => {
    expect(lowStockRemaining(p(2, true))).toBeNull();
    expect(lowStockRemaining(p(0, true))).toBeNull();
  });
});
