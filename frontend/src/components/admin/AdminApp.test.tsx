// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const suspendMock = vi.fn().mockResolvedValue(undefined);
const listMock = vi.fn();
const metricsMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      metrics: () => metricsMock(),
      listMerchants: () => listMock(),
      suspend: (id: number) => suspendMock(id),
      unsuspend: vi.fn().mockResolvedValue(undefined),
      getMerchant: vi.fn(),
    },
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 1, email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN' }, logout: vi.fn() }),
}));

import { AdminApp } from './AdminApp';
import { ConfirmProvider } from '../ConfirmDialog';

const MERCHANT = {
  id: 7, name: 'Kiri Brew', slug: 'kiri', ownerName: 'Demo', ownerEmail: 'demo@x.com',
  status: 'ACTIVE' as const, currency: 'SGD', createdAt: '2026-01-01T00:00:00Z',
  productCount: 3, orderCount: 5, customerCount: 2,
};
const METRICS = {
  totalMerchants: 1, activeMerchants: 1, suspendedMerchants: 0, archivedMerchants: 0,
  totalOrders: 5, totalCustomers: 2, newMerchantsLast30Days: 1,
};

function renderAdmin() {
  return render(<ConfirmProvider><AdminApp /></ConfirmProvider>);
}

beforeEach(() => {
  cleanup();
  metricsMock.mockReset().mockResolvedValue(METRICS);
  listMock.mockReset().mockResolvedValue([MERCHANT]);
  suspendMock.mockClear();
});

describe('AdminApp', () => {
  it('shows metrics and the merchant list', async () => {
    renderAdmin();
    expect(await screen.findByText('Kiri Brew')).toBeTruthy();
    expect(screen.getByText('Platform Admin')).toBeTruthy();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0); // tile + status badge
    expect(screen.getByText('demo@x.com')).toBeTruthy();      // owner
    expect(screen.getByText('/kiri')).toBeTruthy();           // slug in the row
  });

  it('suspends a merchant after confirmation', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByText('Kiri Brew');

    // Row action (accessible name includes the store); opens the confirm dialog.
    await user.click(screen.getByRole('button', { name: 'Suspend Kiri Brew' }));
    // Dialog confirm button's accessible name is exactly "Suspend".
    await user.click(await screen.findByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(suspendMock).toHaveBeenCalledWith(7));
  });
});
