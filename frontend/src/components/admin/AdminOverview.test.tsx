// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const overview = vi.fn();
const analytics = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, adminApi: { ...actual.adminApi, overview: () => overview(), analytics: () => analytics() } };
});

import { AdminOverview } from './AdminOverview';

const DATA = {
  valueLast30Days: [{ currency: 'SGD', total: 1234.5, orders: 7 }],
  valueAllTime: [{ currency: 'SGD', total: 9999, orders: 40 }, { currency: 'IDR', total: 500000, orders: 3 }],
  ordersPerDay: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, count: i % 3 })),
  topStores: [{ id: 5, name: 'Kiri Brew', slug: 'kiri', currency: 'SGD', orders: 12, value: 300 }],
  needsAttention: {
    unverifiedOwners: { count: 2, items: [{ id: 5, name: 'Kiri Brew', slug: 'kiri' }, { id: 6, name: 'Momo', slug: 'momo' }] },
    noProducts: { count: 0, items: [] },
    noOrders30Days: { count: 1, items: [{ id: 7, name: 'Quiet Store', slug: 'quiet' }] },
    suspended: { count: 0, items: [] },
  },
  newestStores: [{ id: 8, name: 'Fresh Store', slug: 'fresh', ownerName: 'Pat Owner', createdAt: '2026-10-01T10:00:00' }],
  recentActions: [{ id: 1, actorEmail: 'admin@manyorder.app', actorName: 'Dana Admin', action: 'SUSPEND_MERCHANT', targetType: 'MERCHANT', targetId: 5, merchantId: 5, detail: null, createdAt: '2026-10-02T09:00:00', storeName: 'Kiri Brew' }],
};

// Minimal range-analytics payload so the embedded <AdminAnalytics> renders without a network call.
const ANALYTICS = {
  window: { range: '30d', fromDate: '2026-09-01', toDate: '2026-09-30', fromUtc: '2026-08-31T16:00:00Z', toUtc: '2026-09-30T16:00:00Z', compare: false, prevFromUtc: null, prevToUtc: null },
  orders: { total: 0, previousTotal: null, byCurrency: [], byDay: [], byStatus: {}, delivery: 0, pickup: 0, guest: 0, cancelled: 0, withDiscount: 0, topStores: [] },
  stores: { newInRange: 0, previousNewInRange: null, active: 0, suspended: 0, archived: 0, firstProductInRange: 0, firstOrderInRange: 0 },
  funnel: { steps: [{ step: 'signed_up', count: 0, retentionFromPrev: null }] },
  snapshot: { outOfStockProducts: 0 },
  timingsMs: { total: 1 },
};

beforeEach(() => {
  cleanup();
  overview.mockReset().mockResolvedValue(DATA);
  analytics.mockReset().mockResolvedValue(ANALYTICS);
});

describe('AdminOverview', () => {
  it('renders the range analytics section plus attention, newest and recent actions', async () => {
    render(<AdminOverview onOpenStore={vi.fn()} />);

    // The range analytics section (its own selector + funnel panel) is present.
    expect(await screen.findByRole('group', { name: 'Time range' })).toBeTruthy();
    expect(await screen.findByText(/Signup funnel/)).toBeTruthy();

    // Operational panels remain.
    expect(screen.getByText('Owners not verified')).toBeTruthy();
    expect(screen.getByText('Fresh Store')).toBeTruthy();
    expect(screen.getByText('Pat Owner')).toBeTruthy();
    // Recent actions show the readable name (shared with Activity), not the raw code,
    // and the store name beside its id.
    expect(screen.getByText('Suspended store')).toBeTruthy();
    expect(screen.queryByText('SUSPEND_MERCHANT')).toBeNull();
    expect(screen.getByText(/Kiri Brew #5/)).toBeTruthy();
    // The admin's display name is shown, not their email.
    expect(screen.getByText(/Dana Admin/)).toBeTruthy();
    expect(screen.queryByText(/admin@manyorder\.app/)).toBeNull();
  });

  it('links a store so clicking opens its drill-down', async () => {
    const onOpenStore = vi.fn();
    const user = userEvent.setup();
    render(<AdminOverview onOpenStore={onOpenStore} />);

    // "Kiri Brew" links from the attention list; clicking opens store 5.
    const links = await screen.findAllByRole('button', { name: 'Kiri Brew' });
    await user.click(links[0]);
    await waitFor(() => expect(onOpenStore).toHaveBeenCalledWith(5));
  });
});
