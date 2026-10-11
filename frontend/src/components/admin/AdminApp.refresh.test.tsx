// @vitest-environment jsdom
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
    adminApi: { ...actual.adminApi, metrics: () => metrics() },
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
    render(<ConfirmProvider><AdminApp /></ConfirmProvider>);

    // Initial load finished.
    await waitFor(() => expect(metrics).toHaveBeenCalledTimes(1));

    // Regaining focus triggers a silent refetch.
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(metrics).toHaveBeenCalledTimes(2));
  });

  it('keeps the last good data when a focus refresh fails', async () => {
    render(<ConfirmProvider><AdminApp /></ConfirmProvider>);
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
