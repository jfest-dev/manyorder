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
      discountsFor: () => ({
        list: () => listMock(),
        create: vi.fn(),
        update: vi.fn(),
        delete: (id: number) => deleteMock(id),
        reorder: vi.fn(),
      }),
      productsFor: () => ({
        list: () => Promise.resolve([]),
        activate: vi.fn(), deactivate: vi.fn(), delete: vi.fn(), reorder: vi.fn(),
      }),
    },
  };
});

import { Marketing } from './Marketing';
import type { DiscountResponse } from '../../lib/api';

const DISCOUNT = {
  id: 21, code: 'SAVE10', name: null, type: 'PERCENTAGE', value: 10, usageLimit: null,
  minSpend: null, usedCount: 0, startsAt: null, endsAt: null, active: true, firstOrderOnly: false,
  canStackWithSale: false, isPublic: true, appliesToDelivery: false, productIds: [],
  scopeLabel: 'All products', displayOrder: 0, createdAt: '2026-01-01T00:00:00Z',
} as unknown as DiscountResponse;

beforeEach(() => {
  cleanup();
  listMock.mockReset().mockResolvedValue([DISCOUNT]);
  deleteMock.mockClear();
});

describe('Marketing (admin scope)', () => {
  it('deletes a discount via a typed-name confirm', async () => {
    const user = userEvent.setup();
    render(<Marketing storeId={3} currency="SGD" adminMerchantId={3} />);
    await screen.findAllByText('SAVE10');

    await user.click(screen.getAllByLabelText('Delete SAVE10')[0]);
    const del = await screen.findByRole('button', { name: 'Delete' });
    expect((del as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText('Confirmation text'), 'SAVE10');
    await user.click(del);
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(21));
  });
});
