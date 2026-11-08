// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const remindOwner = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, adminApi: { ...actual.adminApi, remindOwner: (id: number) => remindOwner(id) } };
});

import { NeedsAction } from './AdminDashboard';
import type { AdminDashboardActionItem } from '../../lib/api';

const withOwner: AdminDashboardActionItem = {
  kind: 'store_no_products', name: 'Kiri Brew', storeId: 5, userId: null,
  ownerEmail: 'owner@kiri.test', ownerPhone: '+65 9123 4567', lastRemindedAt: null,
};
const noOwner: AdminDashboardActionItem = {
  kind: 'signed_up_no_store', name: 'Pat', storeId: null, userId: 9,
  ownerEmail: null, ownerPhone: null, lastRemindedAt: null,
};

beforeEach(() => { cleanup(); remindOwner.mockReset(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('NeedsAction reminder buttons', () => {
  it('shows Email and WhatsApp reminder buttons for a row with an owner', () => {
    render(<NeedsAction items={[withOwner]} onOpenStore={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Email reminder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'WhatsApp reminder' })).toBeTruthy();
  });

  it('shows no reminder buttons for a row without a store/owner', () => {
    render(<NeedsAction items={[noOwner]} onOpenStore={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Email reminder' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'WhatsApp reminder' })).toBeNull();
  });

  it('WhatsApp reminder opens wa.me to the owner, with no server call', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    render(<NeedsAction items={[withOwner]} onOpenStore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp reminder' }));
    expect(open).toHaveBeenCalledTimes(1);
    const url = open.mock.calls[0][0] as string;
    expect(url.startsWith('https://wa.me/6591234567?text=')).toBe(true);
    expect(remindOwner).not.toHaveBeenCalled(); // no server call
  });

  it('Email reminder calls the server and then shows a confirmation', async () => {
    remindOwner.mockResolvedValue({ emailSent: true, remindedAt: new Date().toISOString() });
    render(<NeedsAction items={[withOwner]} onOpenStore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Email reminder' }));
    expect(remindOwner).toHaveBeenCalledWith(5);
    await waitFor(() => expect(screen.getByText(/Reminder emailed\./)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Reminded today/)).toBeTruthy());
  });

  it('shows the rate-limit message when the server refuses', async () => {
    const { ApiError } = await import('../../lib/api');
    remindOwner.mockRejectedValue(new ApiError(429, 'This owner was already reminded in the last 3 days.'));
    render(<NeedsAction items={[withOwner]} onOpenStore={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Email reminder' }));
    await waitFor(() => expect(screen.getByText(/already reminded in the last 3 days/)).toBeTruthy());
  });

  it('shows "Reminded N days ago" from the audit timestamp', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    render(<NeedsAction items={[{ ...withOwner, lastRemindedAt: threeDaysAgo }]} onOpenStore={vi.fn()} />);
    expect(screen.getByText('Reminded 3 days ago')).toBeTruthy();
  });
});
