// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listMock = vi.fn();
const updateMock = vi.fn().mockResolvedValue(undefined);
const productsListMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    discountsApi: {
      ...actual.discountsApi,
      list: () => listMock(),
      update: (storeId: number, id: number, p: unknown) => updateMock(storeId, id, p),
      create: vi.fn(),
      delete: vi.fn(),
      reorder: vi.fn(),
    },
    productsApi: { ...actual.productsApi, list: () => productsListMock() },
  };
});

import { Marketing } from './Marketing';
import { ConfirmProvider } from '../ConfirmDialog';
import type { DiscountResponse } from '../../lib/api';

const base: DiscountResponse = {
  id: 7, code: 'SAVE', name: 'Promo', type: 'PERCENTAGE', value: 10,
  usageLimit: 100, minSpend: 20, usedCount: 0, startsAt: null, endsAt: null,
  active: true, firstOrderOnly: false, canStackWithSale: false, isPublic: true,
  appliesToDelivery: false, productIds: [],
} as unknown as DiscountResponse;

/** The exact payload submit() should produce when nothing is edited. */
const expectedPayload = (d: DiscountResponse) => ({
  code: d.code,
  name: d.name ?? undefined,
  type: d.type,
  value: d.type === 'FREE_DELIVERY' ? 0 : d.value,
  usageLimit: d.usageLimit,
  minSpend: d.minSpend,
  startsAt: null,
  endsAt: null,
  active: d.active,
  firstOrderOnly: d.firstOrderOnly,
  canStackWithSale: d.canStackWithSale,
  isPublic: d.isPublic,
  appliesToDelivery: d.appliesToDelivery,
  productIds: d.productIds,
});

beforeEach(() => {
  cleanup();
  updateMock.mockClear();
  productsListMock.mockReset().mockResolvedValue([
    { id: 1, name: 'Latte', price: 5, stock: 10, isActive: true, preOrder: false, unitsSold: 0, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null },
    { id: 2, name: 'Mocha', price: 6, stock: 10, isActive: true, preOrder: false, unitsSold: 0, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null },
  ]);
});

async function editAndSave(discount: DiscountResponse) {
  listMock.mockReset().mockResolvedValue([discount]);
  const user = userEvent.setup();
  render(<ConfirmProvider><Marketing storeId={1} currency="SGD" /></ConfirmProvider>);
  await screen.findByText('Promo');
  await user.click(screen.getByLabelText(`Edit ${discount.code}`));
  await screen.findByRole('button', { name: 'Save changes' });
  await user.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(updateMock).toHaveBeenCalled());
  return updateMock.mock.calls[0][2];
}

describe('Marketing form round-trips each discount type unchanged', () => {
  it('percentage (whole order)', async () => {
    const d = { ...base, type: 'PERCENTAGE', value: 10 } as DiscountResponse;
    expect(await editAndSave(d)).toEqual(expectedPayload(d));
  });

  it('fixed amount (whole order)', async () => {
    const d = { ...base, type: 'FIXED', value: 5 } as DiscountResponse;
    expect(await editAndSave(d)).toEqual(expectedPayload(d));
  });

  it('free delivery', async () => {
    const d = { ...base, type: 'FREE_DELIVERY', value: 0 } as DiscountResponse;
    expect(await editAndSave(d)).toEqual(expectedPayload(d));
  });

  it('delivery-fee percentage', async () => {
    const d = { ...base, type: 'PERCENTAGE', value: 15, appliesToDelivery: true } as DiscountResponse;
    expect(await editAndSave(d)).toEqual(expectedPayload(d));
  });

  it('specific products', async () => {
    const d = { ...base, type: 'PERCENTAGE', value: 10, productIds: [1, 2] } as DiscountResponse;
    expect(await editAndSave(d)).toEqual(expectedPayload(d));
  });
});
