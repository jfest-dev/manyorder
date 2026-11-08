// @vitest-environment jsdom
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const overview = vi.fn();
const dashboard = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, adminApi: { ...actual.adminApi, overview: () => overview(), dashboard: () => dashboard() } };
});

import { AdminOverview } from './AdminOverview';

const OVERVIEW = {
  valueLast30Days: [], valueAllTime: [], ordersPerDay: [], topStores: [],
  needsAttention: { unverifiedOwners: { count: 0, items: [] }, noProducts: { count: 0, items: [] }, noOrders30Days: { count: 0, items: [] }, suspended: { count: 0, items: [] } },
  newestStores: [],
  recentActions: [{ id: 1, actorEmail: 'admin@manyorder.app', actorName: 'Dana Admin', action: 'SUSPEND_MERCHANT', targetType: 'MERCHANT', targetId: 5, merchantId: 5, detail: null, createdAt: '2026-10-02T09:00:00', storeName: 'Kiri Brew' }],
};

const DASHBOARD = {
  window: { range: 'today', fromDate: '2026-11-02', toDate: '2026-11-02', fromUtc: '2026-11-01T16:00:00Z', toUtc: '2026-11-02T16:00:00Z', previousFromUtc: null, previousToUtc: null },
  happened: { orders: { current: 3, previous: null }, sales: [{ currency: 'SGD', value: 50, previousValue: null }], signUps: { current: 1, previous: null }, signIns: { current: 2, previous: null }, stores: [], latestOrders: [] },
  needsAction: [],
  dropOff: [{ step: 'signed_up', count: 1, stuck: [] }],
  rightNow: { activeStores: 4, suspendedStores: 1, protectedStores: 0, ownersActive7Days: 2, ownersActive30Days: 3 },
  timingsMs: { total: 1 },
};

beforeEach(() => {
  cleanup();
  overview.mockReset().mockResolvedValue(OVERVIEW);
  dashboard.mockReset().mockResolvedValue(DASHBOARD);
});

describe('AdminOverview', () => {
  it('shows the plain-words dashboard sections and the recent actions', async () => {
    render(<MemoryRouter><AdminOverview onOpenStore={vi.fn()} /></MemoryRouter>);

    expect(await screen.findByText('What happened')).toBeTruthy();
    expect(screen.getByText('Needs your action')).toBeTruthy();
    expect(screen.getByText('Where people drop off')).toBeTruthy();
    expect(screen.getByText('Right now (ignores the dates)')).toBeTruthy();
    expect(screen.getByText('More details')).toBeTruthy();
    // Empty needs-action shows the plain sentence.
    expect(screen.getByText('Nothing needs your action.')).toBeTruthy();

    // Recent actions still render with a readable name and the admin's display name.
    expect(await screen.findByText('Suspended store')).toBeTruthy();
    expect(screen.queryByText('SUSPEND_MERCHANT')).toBeNull();
    expect(screen.getByText(/Dana Admin/)).toBeTruthy();
  });
});
