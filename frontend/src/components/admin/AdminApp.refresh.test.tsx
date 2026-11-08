// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 1, email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

const metrics = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      metrics: () => metrics(),
      overview: () => Promise.resolve({
        valueLast30Days: [], valueAllTime: [],
        ordersPerDay: Array.from({ length: 30 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, count: 0 })),
        topStores: [],
        needsAttention: {
          unverifiedOwners: { count: 0, items: [] }, noProducts: { count: 0, items: [] },
          noOrders30Days: { count: 0, items: [] }, suspended: { count: 0, items: [] },
        },
        newestStores: [], recentActions: [],
      }),
      analytics: () => Promise.resolve({
        window: { range: '30d', fromDate: '2026-09-01', toDate: '2026-09-30', fromUtc: '2026-08-31T16:00:00Z', toUtc: '2026-09-30T16:00:00Z', compare: false, prevFromUtc: null, prevToUtc: null },
        orders: { total: 0, previousTotal: null, byCurrency: [], byDay: [], byStatus: {}, delivery: 0, pickup: 0, guest: 0, cancelled: 0, withDiscount: 0, topStores: [] },
        stores: { newInRange: 0, previousNewInRange: null, active: 0, suspended: 0, archived: 0, firstProductInRange: 0, firstOrderInRange: 0 },
        people: { signIns: 0, signUps: 0, signUpsByMethod: {}, emailVerified: 0, failedSignIns: 0, accountsLocked: 0, passwordResetsRequested: 0, activeOwners7d: 0, activeOwners30d: 0 },
        funnel: { steps: [] }, snapshot: { outOfStockProducts: 0 }, timingsMs: { total: 0 },
      }),
      dashboard: () => Promise.resolve({
        window: { range: 'today', fromDate: '2026-11-02', toDate: '2026-11-02', fromUtc: '2026-11-01T16:00:00Z', toUtc: '2026-11-02T16:00:00Z', previousFromUtc: null, previousToUtc: null },
        happened: { orders: { current: 0, previous: null }, sales: [], signUps: { current: 0, previous: null }, signIns: { current: 0, previous: null }, stores: [], latestOrders: [] },
        needsAction: [], dropOff: [{ step: 'signed_up', count: 0, stuck: [] }],
        rightNow: { activeStores: 0, suspendedStores: 0, protectedStores: 0, ownersActive7Days: 0, ownersActive30Days: 0 }, timingsMs: { total: 0 },
      }),
    },
  };
});

import { AdminApp } from './AdminApp';
import { ConfirmProvider } from '../ConfirmDialog';

const EMPTY_METRICS = {
  totalMerchants: 0, activeMerchants: 0, suspendedMerchants: 0, archivedMerchants: 0,
  totalOrders: 0, totalCustomers: 0, newMerchantsLast30Days: 0,
};

beforeEach(() => {
  cleanup();
  metrics.mockReset().mockResolvedValue(EMPTY_METRICS);
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList));
});

describe('AdminApp background refresh', () => {
  it('refetches metrics when the window regains focus', async () => {
    render(<MemoryRouter><ConfirmProvider><AdminApp /></ConfirmProvider></MemoryRouter>);

    // Initial load finished.
    await waitFor(() => expect(metrics).toHaveBeenCalledTimes(1));

    // Regaining focus triggers a silent refetch.
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(metrics).toHaveBeenCalledTimes(2));
  });

  it('keeps the last good data when a focus refresh fails', async () => {
    render(<MemoryRouter><ConfirmProvider><AdminApp /></ConfirmProvider></MemoryRouter>);
    await waitFor(() => expect(metrics).toHaveBeenCalledTimes(1));

    // Next refresh rejects; the screen must not show an error or go blank.
    metrics.mockRejectedValueOnce(new Error('network'));
    window.dispatchEvent(new Event('focus'));

    await waitFor(() => expect(metrics).toHaveBeenCalledTimes(2));
    // Still showing the console (nav present), no error banner.
    expect(screen.getByRole('button', { name: 'Merchants' })).toBeTruthy();
    expect(screen.queryByText(/Could not load admin data/i)).toBeNull();
  });
});
