// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const listMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      productsFor: () => ({
        list: () => listMock(),
        activate: vi.fn(),
        deactivate: vi.fn(),
        delete: vi.fn(),
        reorder: vi.fn(),
      }),
    },
  };
});

import { ProductsList } from './ProductsList';
import type { ProductResponse } from '../../lib/api';

const PRODUCT = {
  id: 11, name: 'Widget', price: 5, stock: 3, isActive: true, preOrder: false,
  unitsSold: 0, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null,
} as unknown as ProductResponse;

beforeEach(() => {
  cleanup();
  listMock.mockReset().mockResolvedValue([PRODUCT]);
});

describe('ProductsList admin read-only vs editable', () => {
  it('read-only: no Add, Edit or Delete, but the hide/unhide toggle stays', async () => {
    render(<ProductsList storeId={5} currency="SGD" adminMerchantId={5} readOnly />);
    await screen.findAllByText('Widget');

    expect(screen.queryByRole('button', { name: 'Add Product' })).toBeNull();
    expect(screen.queryByLabelText('Delete Widget')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    // Hide/unhide (the ToggleSwitch labelled Active/Draft) remains.
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
  });

  it('editable: Add and Edit are present', async () => {
    render(<ProductsList storeId={5} currency="SGD" adminMerchantId={5} />);
    await screen.findAllByText('Widget');

    expect(screen.getByRole('button', { name: 'Add Product' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });
});
