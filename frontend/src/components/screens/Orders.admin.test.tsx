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
      ordersFor: () => ({
        list: () => listMock(),
        updateStatus: vi.fn(),
        updatePaymentStatus: vi.fn(),
      }),
    },
  };
});

import { Orders } from './Orders';
import type { OrderResponse, Store } from '../../lib/api';

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
  // jsdom has no matchMedia; Orders uses useMediaQuery.
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList));
});

describe('Orders (admin scope)', () => {
  it('loads orders via the admin scope and hides Add Order', async () => {
    render(<Orders store={STORE} onNavigate={() => {}} adminMerchantId={1} />);
    // Row loads from the admin scope (contact name shown).
    expect(await screen.findByText('Buyer')).toBeTruthy();
    expect(listMock).toHaveBeenCalled();
    // Create is a merchant-flow action — not available to admin.
    expect(screen.queryByRole('button', { name: /Add Order/i })).toBeNull();
  });
});
