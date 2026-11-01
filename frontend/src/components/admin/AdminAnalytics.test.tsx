// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const analytics = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, adminApi: { ...actual.adminApi, analytics: (p: unknown) => analytics(p) } };
});

// Mock the calendar popover to a plain text input so a test can set a date directly.
vi.mock('../DatePicker', () => ({
  DatePicker: ({ value, onChange, ariaLabel }: { value: string; onChange: (v: string) => void; ariaLabel?: string }) =>
    <input aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)} />,
}));

import { AdminAnalytics } from './AdminAnalytics';

const PAYLOAD = {
  window: { range: '30d', fromDate: '2026-10-01', toDate: '2026-10-30', fromUtc: '2026-09-30T16:00:00Z', toUtc: '2026-10-30T16:00:00Z', compare: false, prevFromUtc: null, prevToUtc: null },
  orders: {
    total: 12, previousTotal: null,
    byCurrency: [{ currency: 'SGD', orders: 5, value: 150, averageOrderValue: 30, previousOrders: null, previousValue: null }],
    byDay: [{ date: '2026-10-01', count: 2 }, { date: '2026-10-02', count: 1 }],
    byStatus: { DELIVERED: 5, CANCELLED: 1 },
    delivery: 7, pickup: 5, guest: 4, cancelled: 1, withDiscount: 3, topStores: [{ id: 9, name: 'Kiri Brew', slug: 'kiri', currency: 'SGD', orders: 5, value: 150 }],
  },
  stores: { newInRange: 3, previousNewInRange: null, active: 10, suspended: 1, archived: 2, firstProductInRange: 2, firstOrderInRange: 1 },
  people: { signIns: 8, signUps: 3, signUpsByMethod: { PASSWORD: 2, GOOGLE: 1 }, emailVerified: 2, failedSignIns: 5, accountsLocked: 1, passwordResetsRequested: 1, activeOwners7d: 4, activeOwners30d: 9 },
  funnel: { steps: [
    { step: 'signed_up', count: 4, retentionFromPrev: null },
    { step: 'first_order', count: 1, retentionFromPrev: 0.25 },
  ] },
  snapshot: { outOfStockProducts: 6 },
  timingsMs: { total: 3 },
};

beforeEach(() => {
  cleanup();
  analytics.mockReset().mockResolvedValue(PAYLOAD);
});

describe('AdminAnalytics', () => {
  it('loads the default 30-day range and renders tiles and the funnel', async () => {
    render(<AdminAnalytics onOpenStore={vi.fn()} />);

    await waitFor(() => expect(analytics).toHaveBeenCalledWith({ range: '30d', compare: false }));
    expect(await screen.findByText('12')).toBeTruthy();              // orders total tile
    expect(screen.getByText(/Signup funnel/)).toBeTruthy();
    expect(screen.getByText('Storefront (guest)')).toBeTruthy();     // breakdown
    expect(screen.getByText('Out of stock products')).toBeTruthy();  // snapshot
  });

  it('requests a different named range when a chip is clicked', async () => {
    const user = userEvent.setup();
    render(<AdminAnalytics onOpenStore={vi.fn()} />);
    await waitFor(() => expect(analytics).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: '7 days' }));
    await waitFor(() => expect(analytics).toHaveBeenCalledWith({ range: '7d', compare: false }));
  });

  it('passes compare=true when the toggle is on', async () => {
    const user = userEvent.setup();
    render(<AdminAnalytics onOpenStore={vi.fn()} />);
    await waitFor(() => expect(analytics).toHaveBeenCalled());

    await user.click(screen.getByRole('checkbox', { name: /Compare with previous period/ }));
    await waitFor(() => expect(analytics).toHaveBeenCalledWith({ range: '30d', compare: true }));
  });

  it('reveals the custom date fields when Custom is selected', async () => {
    const user = userEvent.setup();
    render(<AdminAnalytics onOpenStore={vi.fn()} />);
    await waitFor(() => expect(analytics).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'Custom' }));
    expect(screen.getByLabelText('Custom range start date')).toBeTruthy();
    expect(screen.getByLabelText('Custom range end date')).toBeTruthy();
  });

  it('rejects an over-366-day custom range with a message and does not call the endpoint', async () => {
    const user = userEvent.setup();
    render(<AdminAnalytics onOpenStore={vi.fn()} />);
    await waitFor(() => expect(analytics).toHaveBeenCalled());
    analytics.mockClear();

    await user.click(screen.getByRole('button', { name: 'Custom' }));
    // DatePicker is mocked (below) to a plain date input keyed by its aria-label.
    await user.clear(screen.getByLabelText('Custom range start date'));
    await user.type(screen.getByLabelText('Custom range start date'), '2026-01-01');
    await user.clear(screen.getByLabelText('Custom range end date'));
    await user.type(screen.getByLabelText('Custom range end date'), '2027-06-01');

    expect(await screen.findByText(/max 366 days/i)).toBeTruthy();
    expect(analytics).not.toHaveBeenCalledWith({ range: 'custom', from: '2026-01-01', to: '2027-06-01', compare: false });
  });
});
