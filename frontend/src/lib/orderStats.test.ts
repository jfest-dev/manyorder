import { describe, it, expect } from 'vitest';
import type { OrderResponse, OrderItemResponse, OrderStatus, PaymentStatus } from './api';
import { computeOrderStats, ordersWithinRange, ordersInMonth, monthsWithSales, monthLabel, topProductsByUnits } from './orderStats';

// --- fixtures --------------------------------------------------------------

function item(overrides: Partial<OrderItemResponse> = {}): OrderItemResponse {
  return {
    productId: 1, productName: 'Milk Tea', quantity: 1,
    price: 10, unitPrice: 10, lineSubtotal: 10, modifiers: [], notes: null,
    ...overrides,
  };
}

let seq = 0;
function order(overrides: Partial<OrderResponse> = {}): OrderResponse {
  const status: OrderStatus = overrides.status ?? 'COMPLETED';
  const paymentStatus: PaymentStatus = overrides.paymentStatus ?? 'PAID';
  return {
    id: ++seq, customerId: null, customerName: null, merchantId: 1, merchantName: 'S',
    status, paymentStatus, paymentMethod: null, paymentReference: null,
    orderType: 'PICKUP', contactName: null, contactPhone: null, contactEmail: null,
    deliveryAddress: null, notes: null, createdAt: '2026-09-13T00:00:00Z',
    subtotal: 0, deliveryFee: 0, deliveryFeePending: false, discountAmount: 0,
    discountCode: null, orderGroupId: null, totalAmount: 0, items: [],
    ...overrides,
  };
}

// --- computeOrderStats -----------------------------------------------------

describe('computeOrderStats', () => {
  it('sums revenue from fulfilled orders only, counts all orders', () => {
    const orders = [
      order({ status: 'COMPLETED', totalAmount: 100 }),
      order({ status: 'DELIVERED', totalAmount: 50 }),
      order({ status: 'PENDING', totalAmount: 999 }),   // not fulfilled: excluded from revenue
      order({ status: 'PREPARING', totalAmount: 40 }),  // not fulfilled: excluded from revenue
    ];
    const s = computeOrderStats(orders);
    expect(s.totalRevenue).toBe(150);
    expect(s.totalOrders).toBe(4);
  });

  it('counts refunded amount by payment status, independent of order status', () => {
    const orders = [
      order({ status: 'COMPLETED', paymentStatus: 'REFUNDED', totalAmount: 30 }),
      order({ status: 'CANCELLED', paymentStatus: 'REFUNDED', totalAmount: 20 }),
      order({ status: 'COMPLETED', paymentStatus: 'PAID', totalAmount: 70 }),
    ];
    const s = computeOrderStats(orders);
    expect(s.refundedAmount).toBe(50);
  });

  it('counts cancelled orders', () => {
    const orders = [
      order({ status: 'CANCELLED' }),
      order({ status: 'CANCELLED' }),
      order({ status: 'COMPLETED' }),
    ];
    expect(computeOrderStats(orders).cancelledCount).toBe(2);
  });

  it('returns zeros for an empty list', () => {
    expect(computeOrderStats([])).toEqual({
      totalRevenue: 0, totalOrders: 0, refundedAmount: 0, cancelledCount: 0,
    });
  });
});

// --- ordersWithinRange -----------------------------------------------------

describe('ordersWithinRange', () => {
  const now = new Date('2026-09-13T12:00:00Z').getTime();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString();

  const orders = [
    order({ createdAt: daysAgo(1) }),
    order({ createdAt: daysAgo(10) }),
    order({ createdAt: daysAgo(45) }),
    order({ createdAt: daysAgo(200) }),
  ];

  it('7d keeps only the last week', () => {
    expect(ordersWithinRange(orders, '7d', now)).toHaveLength(1);
  });

  it('30d keeps orders up to 30 days back', () => {
    expect(ordersWithinRange(orders, '30d', now)).toHaveLength(2);
  });

  it('90d keeps orders up to 90 days back', () => {
    expect(ordersWithinRange(orders, '90d', now)).toHaveLength(3);
  });

  it('all keeps everything, unfiltered', () => {
    expect(ordersWithinRange(orders, 'all', now)).toHaveLength(4);
  });

  it('excludes an unparseable createdAt from bounded windows but keeps it for all', () => {
    const withBad = [...orders, order({ createdAt: 'not-a-date' })];
    expect(ordersWithinRange(withBad, '30d', now)).toHaveLength(2);
    expect(ordersWithinRange(withBad, 'all', now)).toHaveLength(5);
  });
});

// --- ordersInMonth ---------------------------------------------------------

describe('ordersInMonth', () => {
  it('keeps only orders in the given local calendar month', () => {
    const orders = [
      order({ createdAt: new Date(2026, 7, 1, 0, 0, 0).toISOString() }),    // 1 Aug: kept
      order({ createdAt: new Date(2026, 7, 31, 23, 0, 0).toISOString() }),  // 31 Aug: kept
      order({ createdAt: new Date(2026, 8, 1, 0, 0, 0).toISOString() }),    // 1 Sep: dropped
      order({ createdAt: new Date(2026, 6, 31, 23, 0, 0).toISOString() }),  // 31 Jul: dropped
    ];
    expect(ordersInMonth(orders, '2026-08')).toHaveLength(2);
  });

  it('handles the year rollover (December vs January)', () => {
    const orders = [
      order({ createdAt: new Date(2025, 11, 15, 12, 0, 0).toISOString() }), // Dec 2025
      order({ createdAt: new Date(2026, 0, 5, 12, 0, 0).toISOString() }),   // Jan 2026
    ];
    expect(ordersInMonth(orders, '2025-12')).toHaveLength(1);
    expect(ordersInMonth(orders, '2026-01')).toHaveLength(1);
  });

  it('excludes an unparseable createdAt', () => {
    expect(ordersInMonth([order({ createdAt: 'nope' })], '2026-08')).toHaveLength(0);
  });
});

// --- monthsWithSales / monthLabel ------------------------------------------

describe('monthsWithSales', () => {
  it('lists only months with fulfilled sales, newest first, with labels', () => {
    const orders = [
      order({ status: 'COMPLETED', createdAt: new Date(2026, 7, 10, 12, 0, 0).toISOString() }), // Aug
      order({ status: 'DELIVERED', createdAt: new Date(2026, 6, 2, 12, 0, 0).toISOString() }),  // Jul
      order({ status: 'COMPLETED', createdAt: new Date(2026, 7, 20, 12, 0, 0).toISOString() }), // Aug (dedup)
      order({ status: 'PENDING', createdAt: new Date(2026, 5, 1, 12, 0, 0).toISOString() }),    // Jun: not fulfilled, omitted
      order({ status: 'CANCELLED', createdAt: new Date(2026, 4, 1, 12, 0, 0).toISOString() }),  // May: omitted
    ];
    expect(monthsWithSales(orders)).toEqual([
      { key: '2026-08', label: monthLabel('2026-08') },
      { key: '2026-07', label: monthLabel('2026-07') },
    ]);
  });

  it('returns an empty list when there are no fulfilled sales', () => {
    expect(monthsWithSales([order({ status: 'PENDING' })])).toEqual([]);
  });

  it('monthLabel formats a key as month and year', () => {
    // Locale-independent check: contains the year and is non-empty.
    expect(monthLabel('2026-08')).toContain('2026');
    expect(monthLabel('2026-08').length).toBeGreaterThan(4);
  });
});

// --- topProductsByUnits ----------------------------------------------------

describe('topProductsByUnits', () => {
  it('sums quantity per product on fulfilled lines, ranks desc, drops zeros', () => {
    const orders = [
      order({ status: 'COMPLETED', items: [item({ productName: 'Latte', quantity: 3 }), item({ productName: 'Bun', quantity: 1 })] }),
      order({ status: 'DELIVERED', items: [item({ productName: 'Latte', quantity: 2 })] }),
      order({ status: 'PENDING', items: [item({ productName: 'Ghost', quantity: 99 })] }), // unfulfilled: ignored
    ];
    const top = topProductsByUnits(orders);
    expect(top).toEqual([
      { productName: 'Latte', units: 5 },
      { productName: 'Bun', units: 1 },
    ]);
  });

  it('groups by name snapshot even when the underlying productId differs (deleted/re-added)', () => {
    const orders = [
      order({ status: 'COMPLETED', items: [item({ productId: 1, productName: 'Kaya Toast', quantity: 2 })] }),
      order({ status: 'COMPLETED', items: [item({ productId: null as any, productName: 'Kaya Toast', quantity: 3 })] }),
    ];
    expect(topProductsByUnits(orders)).toEqual([{ productName: 'Kaya Toast', units: 5 }]);
  });

  it('respects the limit and breaks ties alphabetically', () => {
    const orders = [
      order({ status: 'COMPLETED', items: [
        item({ productName: 'Cherry', quantity: 1 }),
        item({ productName: 'Apple', quantity: 1 }),
        item({ productName: 'Banana', quantity: 1 }),
      ] }),
    ];
    expect(topProductsByUnits(orders, 2)).toEqual([
      { productName: 'Apple', units: 1 },
      { productName: 'Banana', units: 1 },
    ]);
  });

  it('returns an empty list when there are no fulfilled sales', () => {
    expect(topProductsByUnits([order({ status: 'PENDING', items: [item()] })])).toEqual([]);
  });
});
