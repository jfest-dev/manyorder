// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listMock = vi.fn();
const deactivateMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      productsFor: () => ({
        list: () => listMock(),
        activate: vi.fn(),
        deactivate: (id: number, reason?: string) => deactivateMock(id, reason),
        delete: vi.fn(),
        reorder: vi.fn(),
      }),
    },
  };
});

import { ProductsList } from './ProductsList';
import { ConfirmProvider } from '../ConfirmDialog';
import type { ProductResponse } from '../../lib/api';

const PRODUCT = {
  id: 11, name: 'Widget', price: 5, stock: 3, isActive: true, preOrder: false,
  unitsSold: 0, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null,
} as unknown as ProductResponse;

beforeEach(() => {
  cleanup();
  listMock.mockReset().mockResolvedValue([PRODUCT]);
  deactivateMock.mockReset().mockResolvedValue({ ...PRODUCT, isActive: false });
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

  it('read-only: hiding a product needs a reason, then calls deactivate with it', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><ProductsList storeId={5} currency="SGD" adminMerchantId={5} readOnly /></ConfirmProvider>);
    await screen.findAllByText('Widget');

    await user.click(screen.getAllByRole('switch', { name: 'Active' })[0]);
    expect(await screen.findByText('Hide Widget?')).toBeTruthy();

    await user.type(screen.getByLabelText('Reason (shown to the owner)'), 'Misleading photo');
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith(11, 'Misleading photo'));
  });

  it('editable: Add and Edit are present', async () => {
    render(<ProductsList storeId={5} currency="SGD" adminMerchantId={5} />);
    await screen.findAllByText('Widget');

    expect(screen.getByRole('button', { name: 'Add Product' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });
});
