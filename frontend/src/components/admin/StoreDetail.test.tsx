// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const storeDetail = vi.fn();
const auditLog = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    adminApi: { ...actual.adminApi, storeDetail: () => storeDetail(), auditLog: () => auditLog() },
  };
});

import { StoreDetail } from './StoreDetail';

const DETAIL = {
  id: 5, name: 'Kiri Brew', slug: 'kirikiri-brew', status: 'ACTIVE', currency: 'SGD',
  owner: { name: 'Demo Merchant', email: 'owner@kiri.test', verified: true, createdAt: '2026-01-02T10:00:00' },
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
});

describe('StoreDetail', () => {
  it('shows owner, profile, activity numbers and recent admin actions', async () => {
    render(<StoreDetail merchantId={5} />);

    expect(await screen.findByText('owner@kiri.test')).toBeTruthy();
    // Profile
    expect(screen.getByText('hello@kiri.test')).toBeTruthy();
    expect(screen.getByText('+6581234567')).toBeTruthy();
    // Activity numbers
    expect(screen.getByText('12')).toBeTruthy(); // products
    expect(screen.getByText('2')).toBeTruthy();  // low stock
    // Recent admin action from the audit-log endpoint
    expect(screen.getByText('DEACTIVATE_PRODUCT')).toBeTruthy();
    expect(screen.getByText('admin@manyorder.app')).toBeTruthy();
  });

  it('uses the store-filtered audit log for recent actions', async () => {
    render(<StoreDetail merchantId={5} />);
    await screen.findByText('owner@kiri.test');
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(storeDetail).toHaveBeenCalledTimes(1);
  });
});
