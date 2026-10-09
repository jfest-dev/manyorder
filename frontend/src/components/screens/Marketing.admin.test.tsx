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
      discountsFor: () => ({
        list: () => listMock(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
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
});

describe('Marketing admin read-only vs editable', () => {
  it('read-only: no New Discount, Edit or Delete', async () => {
    render(<Marketing storeId={3} currency="SGD" adminMerchantId={3} readOnly />);
    await screen.findAllByText('SAVE10');

    expect(screen.queryByRole('button', { name: /New Discount/i })).toBeNull();
    expect(screen.queryByLabelText('Edit SAVE10')).toBeNull();
    expect(screen.queryByLabelText('Delete SAVE10')).toBeNull();
  });

  it('editable: New Discount, Edit and Delete are present', async () => {
    render(<Marketing storeId={3} currency="SGD" adminMerchantId={3} />);
    await screen.findAllByText('SAVE10');

    expect(screen.getByRole('button', { name: /New Discount/i })).toBeTruthy();
    expect(screen.getByLabelText('Edit SAVE10')).toBeTruthy();
    expect(screen.getByLabelText('Delete SAVE10')).toBeTruthy();
  });
});
