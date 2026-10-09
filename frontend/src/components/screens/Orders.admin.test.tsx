// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listMock = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      ordersFor: () => ({
        list: () => listMock(),
        updateStatus: vi.fn(),
        updatePaymentStatus: vi.fn(),
      }),
    },
  };
});

import { Orders } from './Orders';
import type { OrderResponse } from '../../lib/api';
import type { Store } from '../../App';

const ORDER = {
  id: 501, customerId: null, customerName: null, merchantId: 1, merchantName: 'Kiri Brew',
  status: 'PENDING', paymentStatus: 'UNPAID', paymentMethod: null, paymentReference: null,
  orderType: 'PICKUP', contactName: 'Buyer', contactPhone: '+6590000000', contactEmail: null,
  deliveryAddress: null, notes: null, createdAt: '2026-10-01T00:00:00Z',
  subtotal: 10, deliveryFee: 0, deliveryFeePending: false, discountAmount: 0, deliveryDiscount: 0,
  discountCode: null, orderGroupId: null, totalAmount: 10, source: 'MANUAL', customerTags: [], items: [],
} as unknown as OrderResponse;

const STORE = { id: '1', name: 'Kiri Brew', slug: 'kiri', color: '#000', currency: 'SGD' } as Store;

beforeEach(() => {
  cleanup();
  listMock.mockReset().mockResolvedValue([ORDER]);
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList));
});

describe('Orders admin read-only vs editable', () => {
  it('read-only: no Add Order, and the expanded order has no status or payment change buttons', async () => {
    const user = userEvent.setup();
    render(<Orders store={STORE} onNavigate={() => {}} adminMerchantId={1} readOnly />);
    await screen.findByText('Buyer');
    expect(screen.queryByRole('button', { name: /Add Order/i })).toBeNull();

    await user.click(screen.getByText('Buyer')); // expand the row
    expect(screen.queryByRole('button', { name: /Cancel Order|^Mark /i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'PAID' })).toBeNull();
  });

  it('editable: Add Order and the status/payment change buttons are present', async () => {
    const user = userEvent.setup();
    render(<Orders store={STORE} onNavigate={() => {}} adminMerchantId={1} />);
    await screen.findByText('Buyer');
    expect(screen.getByRole('button', { name: /Add Order/i })).toBeTruthy();

    await user.click(screen.getByText('Buyer'));
    expect(screen.getByRole('button', { name: 'PAID' })).toBeTruthy();
  });
});
