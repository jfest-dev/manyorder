// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const listMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    productsApi: { ...actual.productsApi, list: () => listMock() },
    storesApi: { ...actual.storesApi, get: () => Promise.resolve({ itemNotesEnabled: false }) },
  };
});

import { ProductsList } from './ProductsList';
import type { ProductResponse } from '../../lib/api';

const mk = (over: Partial<ProductResponse>) => ({
  id: 0, name: 'X', price: 5, stock: 10, isActive: true, preOrder: false,
  unitsSold: 0, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null,
  ...over,
}) as unknown as ProductResponse;

beforeEach(() => {
  cleanup();
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList));
});

describe('ProductsList low-stock flagging', () => {
  it('flags only active, non-pre-order stock 1..5 as Low; 0 is out, pre-order excluded', async () => {
    listMock.mockReset().mockResolvedValue([
      mk({ id: 1, name: 'LowCroissant', stock: 3 }),      // low -> "Low"
      mk({ id: 2, name: 'OutMuffin', stock: 0 }),         // out -> red, no "Low"
      mk({ id: 3, name: 'PreCake', stock: 2, preOrder: true }), // pre-order excluded
      mk({ id: 4, name: 'PlentyTea', stock: 40 }),        // normal
    ]);

    render(<ProductsList storeId={5} currency="SGD" />);
    await screen.findAllByText('LowCroissant');

    // Exactly one low product, and the list renders a desktop + a mobile row for it,
    // so the "Low" badge appears twice and only for that product.
    expect(screen.getAllByText('Low')).toHaveLength(2);

    // The zero-stock product is out of stock, not "Low".
    expect(screen.getAllByText('Out of Stock').length).toBeGreaterThan(0);
  });
});
