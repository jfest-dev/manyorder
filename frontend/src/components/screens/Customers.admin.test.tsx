// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const deleteMock = vi.fn().mockResolvedValue(undefined);
const listMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      customersFor: () => ({
        list: () => listMock(),
        create: vi.fn(),
        update: vi.fn(),
        delete: (id: number) => deleteMock(id),
      }),
    },
  };
});

import { Customers } from './Customers';
import type { CustomerResponse } from '../../lib/api';

const CUSTOMER: CustomerResponse = {
  id: 42, fullName: 'Ada Lovelace', email: '', phoneNumber: '+6590000000',
  createdAt: '2026-01-01T00:00:00Z', ordersCount: 0, totalSpent: 0,
  firstOrderAt: null, lastOrderAt: null, tags: [],
};

beforeEach(() => {
  cleanup();
  listMock.mockReset().mockResolvedValue([CUSTOMER]);
  deleteMock.mockClear();
});

describe('Customers (admin scope)', () => {
  it('requires a typed-name confirm before deleting, then calls the admin delete', async () => {
    const user = userEvent.setup();
    render(<Customers storeId={9} currency="SGD" adminMerchantId={9} />);
    await screen.findAllByText('Ada Lovelace');

    // Row delete opens the typed-name confirm (not the lightweight merchant confirm).
    await user.click(screen.getAllByLabelText('Delete Ada Lovelace')[0]);

    const del = await screen.findByRole('button', { name: 'Delete' });
    expect((del as HTMLButtonElement).disabled).toBe(true);
    expect(deleteMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Confirmation text'), 'Ada Lovelace');
    await user.click(del);

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(42));
  });
});
