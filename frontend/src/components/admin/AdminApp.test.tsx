// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockMatchMedia } from '../../test-utils/matchMedia';

const suspendMock = vi.fn().mockResolvedValue(undefined);
const searchMock = vi.fn();
const metricsMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      metrics: () => metricsMock(),
      overview: () => Promise.resolve(OVERVIEW),
      listMerchants: () => Promise.resolve([]),
      businessTypes: () => Promise.resolve([]),
      searchMerchants: () => searchMock(),
      suspend: (id: number, reason: string) => suspendMock(id, reason),
      unsuspend: vi.fn().mockResolvedValue(undefined),
      getMerchant: vi.fn(),
      auditLog: () => Promise.resolve([]),
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
const OVERVIEW = {
  valueLast30Days: [], valueAllTime: [],
  ordersPerDay: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, count: 0 })),
  topStores: [],
  needsAttention: {
    unverifiedOwners: { count: 0, items: [] }, noProducts: { count: 0, items: [] },
    noOrders30Days: { count: 0, items: [] }, suspended: { count: 0, items: [] },
  },
  newestStores: [], recentActions: [],
};

function renderAdmin() {
  return render(<ConfirmProvider><AdminApp /></ConfirmProvider>);
}

beforeEach(() => {
  cleanup();
  mockMatchMedia(false); // desktop by default
  metricsMock.mockReset().mockResolvedValue(METRICS);
  searchMock.mockReset().mockResolvedValue({ content: [MERCHANT], totalElements: 1, totalPages: 1, page: 1 });
  suspendMock.mockClear();
});

describe('AdminApp', () => {
  it('shows the Overview, then the merchant list under the Merchants nav', async () => {
    const user = userEvent.setup();
    renderAdmin();
    // Overview is the landing section.
    expect(screen.getByText('Platform Admin')).toBeTruthy();
    expect(await screen.findByText('New (30d)')).toBeTruthy(); // a metrics tile

    await user.click(screen.getByRole('button', { name: 'Merchants' }));
    expect(await screen.findByText('Kiri Brew')).toBeTruthy();
    expect(screen.getByText('demo@x.com')).toBeTruthy();      // owner
    expect(screen.getByText('/kiri')).toBeTruthy();           // slug in the row
  });

  it('suspends a merchant after confirmation', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await user.click(screen.getByRole('button', { name: 'Merchants' }));
    await screen.findByText('Kiri Brew');

    // Row action (accessible name includes the store); opens the reason dialog.
    await user.click(screen.getByRole('button', { name: 'Suspend Kiri Brew' }));
    // A reason is required before the Suspend button enables.
    await user.type(await screen.findByLabelText('Reason'), 'Spam listings');
    await user.click(screen.getByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(suspendMock).toHaveBeenCalledWith(7, 'Spam listings'));
  });

  it('on mobile, a menu button opens the nav drawer', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByText('New (30d)'); // Overview loaded

    // No persistent sidebar on mobile; a menu button opens a drawer.
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = await screen.findByRole('dialog', { name: 'Admin navigation' });
    await user.click(within(drawer).getByRole('button', { name: 'Merchants' }));

    expect(await screen.findByText('Kiri Brew')).toBeTruthy(); // navigated, drawer closed
  });

  it('left nav switches between Overview, Merchants and Activity', async () => {
    const user = userEvent.setup();
    renderAdmin();
    await screen.findByText('New (30d)'); // Overview (default)

    await user.click(screen.getByRole('button', { name: 'Merchants' }));
    expect(await screen.findByText('Kiri Brew')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Activity' }));
    expect(await screen.findByText('Changes platform admins made across all stores.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Overview' }));
    expect(await screen.findByText('New (30d)')).toBeTruthy();
  });
});
