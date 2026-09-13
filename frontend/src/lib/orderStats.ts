import type { OrderResponse } from './api';

/**
 * Shared, range-agnostic order aggregations. The Dashboard pre-filters the
 * orders it passes in (by a selected time window); the Orders screen passes its
 * full list. Keeping the maths here means the two screens can never drift.
 *
 * Revenue counts only fulfilled orders (COMPLETED or DELIVERED), matching the
 * units-sold rule so unfulfilled orders can't inflate it. Refunded and cancelled
 * are surfaced separately as context.
 */

const FULFILLED = new Set<OrderResponse['status']>(['COMPLETED', 'DELIVERED']);

export interface OrderStats {
  totalRevenue: number;
  totalOrders: number;
  refundedAmount: number;
  cancelledCount: number;
}

export function computeOrderStats(orders: OrderResponse[]): OrderStats {
  let totalRevenue = 0;
  let refundedAmount = 0;
  let cancelledCount = 0;
  for (const o of orders) {
    if (FULFILLED.has(o.status)) totalRevenue += o.totalAmount;
    if (o.paymentStatus === 'REFUNDED') refundedAmount += o.totalAmount;
    if (o.status === 'CANCELLED') cancelledCount += 1;
  }
  return { totalRevenue, totalOrders: orders.length, refundedAmount, cancelledCount };
}

/** Preset time windows for the Dashboard tiles and top-products list. */
export type RangeKey = '7d' | '30d' | '90d' | 'all';

const RANGE_DAYS: Record<Exclude<RangeKey, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

/**
 * Orders whose createdAt falls within the given window, measured back from `now`.
 * 'all' returns the list unchanged. Orders with an unparseable createdAt are
 * excluded from bounded windows (kept only for 'all').
 */
export function ordersWithinRange(orders: OrderResponse[], range: RangeKey, now: number = Date.now()): OrderResponse[] {
  if (range === 'all') return orders;
  const cutoff = now - RANGE_DAYS[range] * 86400000;
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
}

/** Local-time 'YYYY-MM' key for a date, or null if unparseable. */
function monthKey(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Human label for a 'YYYY-MM' key, e.g. "August 2026". */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Orders whose createdAt falls in the given local calendar month ('YYYY-MM').
 * Orders with an unparseable createdAt are excluded.
 */
export function ordersInMonth(orders: OrderResponse[], key: string): OrderResponse[] {
  return orders.filter((o) => monthKey(o.createdAt) === key);
}

export interface MonthOption {
  key: string;
  label: string;
}

/**
 * The calendar months (newest first) that actually contain fulfilled sales,
 * for populating the Top-products month picker. Built from fulfilled orders
 * only (the set Top products counts), so every offered month yields a non-empty
 * list and no dead "nothing to show" entries appear. A month with only
 * pending/cancelled orders is intentionally omitted.
 */
export function monthsWithSales(orders: OrderResponse[]): MonthOption[] {
  const keys = new Set<string>();
  for (const o of orders) {
    if (!FULFILLED.has(o.status)) continue;
    const k = monthKey(o.createdAt);
    if (k) keys.add(k);
  }
  return [...keys]
    .sort((a, b) => b.localeCompare(a)) // 'YYYY-MM' sorts chronologically as strings
    .map((key) => ({ key, label: monthLabel(key) }));
}

export interface TopProduct {
  productName: string;
  units: number;
}

/**
 * Top products by units sold across the given orders, counting quantity on
 * fulfilled (COMPLETED/DELIVERED) order lines only, grouped by the productName
 * snapshot on each line (so a since-deleted product still reports honestly).
 * Products with zero fulfilled units are omitted. Ties break alphabetically for
 * a stable order.
 */
export function topProductsByUnits(orders: OrderResponse[], limit = 5): TopProduct[] {
  const units = new Map<string, number>();
  for (const o of orders) {
    if (!FULFILLED.has(o.status)) continue;
    for (const item of o.items) {
      units.set(item.productName, (units.get(item.productName) ?? 0) + item.quantity);
    }
  }
  return [...units.entries()]
    .map(([productName, u]) => ({ productName, units: u }))
    .filter((p) => p.units > 0)
    .sort((a, b) => b.units - a.units || a.productName.localeCompare(b.productName))
    .slice(0, limit);
}
