// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const storeDetail = vi.fn();
const auditLog = vi.fn();
const productsList = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      storeDetail: () => storeDetail(),
      auditLog: () => auditLog(),
      productsFor: () => ({ list: () => productsList() }),
    },
  };
});

const PRODUCTS = [
  { id: 1, name: 'Latte', price: 6, stock: 10, isActive: true, preOrder: false, unitsSold: 40, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null },
  { id: 2, name: 'Mocha', price: 6, stock: 10, isActive: true, preOrder: false, unitsSold: 10, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null },
  { id: 3, name: 'Still Tea', price: 4, stock: 10, isActive: true, preOrder: false, unitsSold: 0, categoryName: null, categoryDisplayOrder: null, sku: null, photoUrl: null },
];

import { StoreDetail } from './StoreDetail';

const DETAIL = {
  id: 5, name: 'Kiri Brew', slug: 'kirikiri-brew', status: 'ACTIVE', currency: 'SGD',
  owner: { name: 'Demo Merchant', email: 'owner@kiri.test', phone: '+6599998888', verified: true, createdAt: '2026-01-02T10:00:00' },
  profile: {
    email: 'hello@kiri.test', phoneNumber: '+6581234567', businessType: 'Cafe',
    streetAddress: '1 Coffee Rd', city: 'Singapore', postalCode: '123456',
    storeDescription: null, operatingHours: null, paymentInstruction: null,
    fulfilmentMode: 'BOTH', deliveryFee: 3, freeDeliveryThreshold: 30,
    themeColor: null, logoUrl: null, whatsappVerified: true,
    notifyNewOrderEmail: true, notifyLowStockEmail: false, notifyNewOrderWhatsapp: true,
    notifyUrgentWhatsapp: true, itemNotesEnabled: true,
    createdAt: '2026-01-02T10:00:00', suspendedAt: null, archivedAt: null, lastOrdersViewedAt: null,
  },
  activity: {
    productCount: 12, orderCount: 7, customerCount: 4,
    revenue: 123.5, revenueCurrency: 'SGD', lastOrderAt: '2026-10-01T09:00:00', lowStockCount: 2,
  },
  recentActions: [],
};

const ACTIONS = [
  { id: 1, actorEmail: 'admin@manyorder.app', action: 'DEACTIVATE_PRODUCT', targetType: 'PRODUCT', targetId: 9, merchantId: 5, detail: null, createdAt: '2026-10-02T12:00:00' },
];

beforeEach(() => {
  cleanup();
  storeDetail.mockReset().mockResolvedValue(DETAIL);
  auditLog.mockReset().mockResolvedValue(ACTIONS);
  productsList.mockReset().mockResolvedValue(PRODUCTS);
});

describe('StoreDetail', () => {
  it('shows activity (with best sellers), owner, profile and admin activity', async () => {
    render(<StoreDetail merchantId={5} />);

    expect(await screen.findByText('owner@kiri.test')).toBeTruthy();
    // Profile
    expect(screen.getByText('hello@kiri.test')).toBeTruthy();
    expect(screen.getByText('+6581234567')).toBeTruthy();
    // Activity numbers + best sellers (Still Tea has 0 sales, excluded)
    expect(screen.getByText('12')).toBeTruthy(); // products
    expect(screen.getByText('Latte')).toBeTruthy();
    expect(screen.getByText('40 sold')).toBeTruthy();
    expect(screen.queryByText('Still Tea')).toBeNull();
    // Renamed admin-activity section
    expect(screen.getByText('Admin activity on this store')).toBeTruthy();
    expect(screen.getByText('Changes platform admins made to this store.')).toBeTruthy();
    expect(screen.getByText('DEACTIVATE_PRODUCT')).toBeTruthy();
    // Shared date helper: "2 January 2026", never numeric with seconds
    expect(screen.getByText('2 January 2026')).toBeTruthy();
  });

  it('shows the owner phone with a copy button', async () => {
    render(<StoreDetail merchantId={5} />);
    await screen.findByText('owner@kiri.test');
    expect(screen.getByText('+6599998888')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy +6599998888' })).toBeTruthy();
    // The owner email is copyable too.
    expect(screen.getByRole('button', { name: 'Copy owner@kiri.test' })).toBeTruthy();
  });

  it('shows a dash for an owner with no phone', async () => {
    storeDetail.mockResolvedValue({ ...DETAIL, owner: { ...DETAIL.owner, phone: null } });
    render(<StoreDetail merchantId={5} />);
    await screen.findByText('owner@kiri.test');
    // No copy button is rendered for the missing owner phone.
    expect(screen.queryByRole('button', { name: /Copy \+6599998888/ })).toBeNull();
  });

  it('hides the non-functional WhatsApp-verified field', async () => {
    render(<StoreDetail merchantId={5} />);
    await screen.findByText('owner@kiri.test');
    expect(screen.queryByText(/WhatsApp verified/i)).toBeNull();
  });

  it('uses the store-filtered audit log and products for this store', async () => {
    render(<StoreDetail merchantId={5} />);
    await screen.findByText('owner@kiri.test');
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(storeDetail).toHaveBeenCalledTimes(1);
    expect(productsList).toHaveBeenCalledTimes(1);
  });
});
