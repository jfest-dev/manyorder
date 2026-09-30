// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteMock = vi.fn().mockResolvedValue(undefined);
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
        delete: (id: number) => deleteMock(id),
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
  deleteMock.mockClear();
});

describe('ProductsList (admin scope)', () => {
  it('hides Add Product and deletes via a typed-name confirm', async () => {
    const user = userEvent.setup();
    render(<ProductsList storeId={5} currency="SGD" adminMerchantId={5} />);
    await screen.findAllByText('Widget');

    // Add/create is a merchant-flow action — hidden in admin mode.
    expect(screen.queryByRole('button', { name: 'Add Product' })).toBeNull();

    // Delete → typed-name confirm gate.
    await user.click(screen.getAllByLabelText('Delete Widget')[0]);
    const del = await screen.findByRole('button', { name: 'Delete' });
    expect((del as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText('Confirmation text'), 'Widget');
    await user.click(del);
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(11));
  });
});
