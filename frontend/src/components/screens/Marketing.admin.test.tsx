// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listMock = vi.fn();
const deactivateMock = vi.fn().mockResolvedValue({});

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
        delete: vi.fn(),
        reorder: vi.fn(),
        activate: vi.fn().mockResolvedValue({}),
        deactivate: (id: number, reason?: string) => deactivateMock(id, reason),
      }),
      productsFor: () => ({
        list: () => Promise.resolve([]),
        activate: vi.fn(), deactivate: vi.fn(), delete: vi.fn(), reorder: vi.fn(),
      }),
    },
  };
});

import { Marketing } from './Marketing';
import { ConfirmProvider } from '../ConfirmDialog';
import type { DiscountResponse } from '../../lib/api';

const DISCOUNT = {
  id: 21, code: 'SAVE10', name: null, type: 'PERCENTAGE', value: 10, usageLimit: null,
  minSpend: null, usedCount: 0, startsAt: null, endsAt: null, active: true, firstOrderOnly: false,
  canStackWithSale: false, isPublic: true, appliesToDelivery: false, productIds: [],
  scopeLabel: 'All products', displayOrder: 0, createdAt: '2026-01-01T00:00:00Z',
} as unknown as DiscountResponse;

const renderAdmin = () =>
  render(<ConfirmProvider><Marketing storeId={3} currency="SGD" adminMerchantId={3} readOnly /></ConfirmProvider>);

beforeEach(() => {
  cleanup();
  listMock.mockReset().mockResolvedValue([DISCOUNT]);
  deactivateMock.mockClear();
});

describe('Marketing admin read-only vs editable', () => {
  it('read-only: only an Active toggle; no New Discount, Edit or Delete', async () => {
    renderAdmin();
    await screen.findAllByText('SAVE10');

    expect(screen.queryByRole('button', { name: /New Discount/i })).toBeNull();
    expect(screen.queryByLabelText('Edit SAVE10')).toBeNull();
    expect(screen.queryByLabelText('Delete SAVE10')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Active' })).toBeTruthy();
  });

  it('read-only: switching a discount off needs a reason, then calls deactivate with it', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findAllByText('SAVE10');

    await user.click(screen.getByRole('switch', { name: 'Active' }));
    // Confirmation copy appears, with a required reason.
    expect(await screen.findByText('Switch off this discount?')).toBeTruthy();

    await user.type(screen.getByLabelText('Reason (shown to the owner)'), 'Expired promo');
    await user.click(screen.getByRole('button', { name: 'Switch off' }));
    await waitFor(() => expect(deactivateMock).toHaveBeenCalledWith(21, 'Expired promo'));
  });

  it('editable: New Discount, Edit and Delete are present (no toggle)', async () => {
    render(<Marketing storeId={3} currency="SGD" adminMerchantId={3} />);
    await screen.findAllByText('SAVE10');

    expect(screen.getByRole('button', { name: /New Discount/i })).toBeTruthy();
    expect(screen.getByLabelText('Edit SAVE10')).toBeTruthy();
    expect(screen.getByLabelText('Delete SAVE10')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Active' })).toBeNull();
  });
});
