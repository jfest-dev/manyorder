import { describe, it, expect } from 'vitest';
import type { ProductResponse } from './api';
import { bestsellerProductIds } from './bestsellers';

// Minimal product factory: only the fields the helper reads matter here.
function product(id: number, name: string, unitsSold: number): ProductResponse {
  return {
    id, merchantId: 1, name, description: null, price: 10,
    salePrice: null, saleStartsAt: null, saleEndsAt: null, onSale: false, effectivePrice: 10,
    isActive: true, categoryId: null, categoryName: null, categoryDisplayOrder: null, stock: 50, sku: null,
    photoUrl: null, preOrder: false, preOrderReadyDate: null,
    preOrderReadyTimeStart: null, preOrderReadyTimeEnd: null, preOrderNote: null,
    modifierGroups: [], unitsSold, createdAt: '2026-01-01T00:00:00',
  };
}

describe('bestsellerProductIds', () => {
  it('badges the top 3 by units when all clear the floor', () => {
    const products = [
      product(1, 'A', 50),
      product(2, 'B', 40),
      product(3, 'C', 30),
      product(4, 'D', 20), // 4th: excluded by topN even though well over the floor
    ];
    expect(bestsellerProductIds(products)).toEqual(new Set([1, 2, 3]));
  });

  it('excludes a store leader that has not cleared the absolute floor (thin store)', () => {
    // A brand-new store: its top product has only 2 sales. Nothing is flattering yet.
    const products = [product(1, 'A', 2), product(2, 'B', 1)];
    expect(bestsellerProductIds(products)).toEqual(new Set());
  });

  it('within the top 3, keeps only those meeting the floor', () => {
    const products = [
      product(1, 'A', 40), // top 3, over floor -> badged
      product(2, 'B', 12), // top 3, over floor -> badged
      product(3, 'C', 5),  // top 3 by rank, but under floor -> not badged
      product(4, 'D', 3),
    ];
    expect(bestsellerProductIds(products)).toEqual(new Set([1, 2]));
  });

  it('treats exactly the floor value as qualifying', () => {
    expect(bestsellerProductIds([product(1, 'A', 10)])).toEqual(new Set([1]));
    expect(bestsellerProductIds([product(1, 'A', 9)])).toEqual(new Set());
  });

  it('breaks unit ties alphabetically by name for a stable top-N cut', () => {
    // Three products tie at the boundary; topN=2 must pick deterministically.
    const products = [
      product(1, 'Cherry', 20),
      product(2, 'Apple', 20),
      product(3, 'Banana', 20),
    ];
    expect(bestsellerProductIds(products, { topN: 2, minUnits: 10 })).toEqual(new Set([2, 3]));
  });

  it('ignores products with zero sales entirely', () => {
    const products = [product(1, 'A', 15), product(2, 'B', 0), product(3, 'C', 0)];
    expect(bestsellerProductIds(products)).toEqual(new Set([1]));
  });

  it('returns an empty set for an empty catalogue', () => {
    expect(bestsellerProductIds([])).toEqual(new Set());
  });

  it('respects custom topN and minUnits', () => {
    const products = [product(1, 'A', 100), product(2, 'B', 60), product(3, 'C', 55)];
    expect(bestsellerProductIds(products, { topN: 1, minUnits: 10 })).toEqual(new Set([1]));
    expect(bestsellerProductIds(products, { topN: 5, minUnits: 70 })).toEqual(new Set([1]));
  });
});
