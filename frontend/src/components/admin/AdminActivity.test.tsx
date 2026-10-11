// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const auditLog = vi.fn();
const listMerchants = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: { ...actual.adminApi, auditLog: (storeId?: number) => auditLog(storeId), listMerchants: () => listMerchants() },
  };
});

import { AdminActivity } from './AdminActivity';

const ENTRIES = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1, actorEmail: 'admin@manyorder.app', action: `ACTION_${i + 1}`,
  targetType: 'PRODUCT', targetId: i + 1, merchantId: 1, detail: null, createdAt: '2026-07-07T09:00:00',
}));

beforeEach(() => {
  cleanup();
  auditLog.mockReset().mockResolvedValue(ENTRIES);
  listMerchants.mockReset().mockResolvedValue([]);
});

describe('AdminActivity', () => {
  it('pages the feed 20 at a time, newest first', async () => {
    const user = userEvent.setup();
    render(<AdminActivity />);

    expect(await screen.findByText('Showing 1 to 20 of 25')).toBeTruthy();
    expect(screen.getByText('Page 1 of 2')).toBeTruthy();
    expect(screen.getByText('ACTION_1')).toBeTruthy();
    expect(screen.queryByText('ACTION_25')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Showing 21 to 25 of 25')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
    expect(screen.getByText('ACTION_25')).toBeTruthy();
    expect(screen.queryByText('ACTION_1')).toBeNull();
  });

  it('shows a store filter and loads the global feed by default (no storeId)', async () => {
    render(<AdminActivity />);
    await screen.findByText('Showing 1 to 20 of 25');
    expect(screen.getByLabelText('Filter by store')).toBeTruthy();
    expect(auditLog).toHaveBeenCalledWith(undefined); // default = all stores
  });
});
