// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

const ownerList = vi.fn();
const adminList = vi.fn();
const ordersFor = vi.fn((id: number) => ({ list: () => adminList(id) }));

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    ordersApi: { ...actual.ordersApi, list: (storeId: number) => ownerList(storeId) },
    adminApi: { ...actual.adminApi, ordersFor: (id: number) => ordersFor(id) },
  };
});

import { Dashboard } from './Dashboard';

const STORE = { id: '7', name: 'Kiri Brew', slug: 'kiri', color: '#000000', currency: 'SGD' } as never;
const ORDER = {
  id: 101, status: 'COMPLETED', createdAt: '2026-07-07T09:00:00', totalAmount: 20,
  customerName: 'Mei', items: [], orderType: 'DELIVERY', paymentStatus: 'PAID',
};

beforeEach(() => {
  cleanup();
  ownerList.mockReset().mockResolvedValue([]);
  adminList.mockReset().mockResolvedValue([ORDER]);
  ordersFor.mockClear();
});

describe('Dashboard admin data source', () => {
  it('reads orders through the admin endpoint when adminMerchantId is set', async () => {
    render(<Dashboard store={STORE} onNavigate={vi.fn()} adminMerchantId={7} />);

    await waitFor(() => expect(ordersFor).toHaveBeenCalledWith(7));
    expect(adminList).toHaveBeenCalledWith(7);
    expect(ownerList).not.toHaveBeenCalled();
    expect(await screen.findByText(/#101/)).toBeTruthy(); // recent order from the admin feed
  });

  it('reads orders through the owner endpoint when it is not an admin view', async () => {
    render(<Dashboard store={STORE} onNavigate={vi.fn()} />);

    await waitFor(() => expect(ownerList).toHaveBeenCalledWith(7));
    expect(ordersFor).not.toHaveBeenCalled();
  });
});
