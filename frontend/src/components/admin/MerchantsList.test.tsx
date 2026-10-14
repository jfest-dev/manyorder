// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockMatchMedia } from '../../test-utils/matchMedia';

const searchMerchants = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: { ...actual.adminApi, searchMerchants: (params?: unknown) => searchMerchants(params) },
  };
});

import { MerchantsList } from './MerchantsList';

function row(id: number) {
  return {
    id, name: `Store ${id}`, slug: `store-${id}`, ownerName: 'Owner', ownerEmail: `owner${id}@x.com`,
    status: 'ACTIVE' as const, currency: 'SGD', createdAt: '2026-07-07T09:00:00',
    productCount: 0, orderCount: 0, customerCount: 0,
  };
}

// 25 stores total: page 1 has 20, page 2 has 5.
function pageFor(page: number) {
  const all = Array.from({ length: 25 }, (_, i) => row(i + 1));
  const content = all.slice((page - 1) * 20, page * 20);
  return { content, totalElements: 25, totalPages: 2, page };
}

function renderList() {
  return render(
    <MerchantsList onView={vi.fn()} onToggleSuspend={vi.fn()} busyId={null} reloadToken={0} />,
  );
}

beforeEach(() => {
  cleanup();
  mockMatchMedia(false);
  searchMerchants.mockReset().mockImplementation((p: { page?: number }) => Promise.resolve(pageFor(p?.page ?? 1)));
});

describe('MerchantsList', () => {
  it('pages through server results with the total count', async () => {
    const user = userEvent.setup();
    renderList();

    expect(await screen.findByText('Showing 1 to 20 of 25')).toBeTruthy();
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    expect(screen.getByText('Store 1')).toBeTruthy();
    expect(screen.queryByText('Store 25')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Showing 21 to 25 of 25')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    expect(screen.getByText('Store 25')).toBeTruthy();
    await waitFor(() => expect(searchMerchants).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });

  it('shows the empty message when nothing matches', async () => {
    searchMerchants.mockResolvedValue({ content: [], totalElements: 0, totalPages: 1, page: 1 });
    renderList();
    expect(await screen.findByText('No stores match your search')).toBeTruthy();
  });

  it('searches the server as the box is typed, from the first page', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Showing 1 to 20 of 25');

    await user.type(screen.getByLabelText('Search merchants'), 'kiri');
    await waitFor(() =>
      expect(searchMerchants).toHaveBeenCalledWith(expect.objectContaining({ q: 'kiri', page: 1 })));
  });

  it('on mobile, hides filters behind a Filters button and lists stores as cards', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    renderList();
    await screen.findByText('Showing 1 to 20 of 25');

    // Filter dropdowns are collapsed until the Filters button is tapped.
    expect(screen.queryByLabelText('Filter by status')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    expect(await screen.findByLabelText('Filter by status')).toBeTruthy();

    // Stores render as cards with per-store View / Suspend actions (no data table).
    expect(screen.getByRole('button', { name: 'View Store 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Suspend Store 1' })).toBeTruthy();
    expect(document.querySelector('table')).toBeNull();
  });
});
