// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

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
        delete: vi.fn(),
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
});

describe('Customers admin read-only vs editable', () => {
  it('read-only: no Add, Edit or Delete', async () => {
    render(<Customers storeId={9} currency="SGD" adminMerchantId={9} readOnly />);
    await screen.findAllByText('Ada Lovelace');

    expect(screen.queryByRole('button', { name: /Add Customer/i })).toBeNull();
    expect(screen.queryByLabelText('Edit Ada Lovelace')).toBeNull();
    expect(screen.queryByLabelText('Delete Ada Lovelace')).toBeNull();
  });

  it('editable: Add, Edit and Delete are present', async () => {
    render(<Customers storeId={9} currency="SGD" adminMerchantId={9} />);
    await screen.findAllByText('Ada Lovelace');

    expect(screen.getByRole('button', { name: /Add Customer/i })).toBeTruthy();
    expect(screen.getAllByLabelText('Edit Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('Delete Ada Lovelace').length).toBeGreaterThan(0);
  });
});
