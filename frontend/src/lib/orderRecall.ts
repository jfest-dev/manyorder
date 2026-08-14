/**
 * Device-local memory of the last order placed at a store, so a customer who
 * closes the tab can re-open their confirmation without having written the order
 * number down. This is a pure client convenience — the server still requires
 * order number + phone for any lookup, so nothing here weakens lookup security.
 * We keep only the order id + the phone used (to re-fetch fresh status via the
 * normal lookup endpoint); no order contents are cached.
 */
export interface RecentOrder {
  orderId: number;
  phone: string;
  placedAt: string; // ISO
}

/**
 * Statuses where an order is still "in progress" — the recall banner shows only
 * while at least one order is in one of these. The terminal states (DELIVERED,
 * COMPLETED, CANCELLED) drop the banner.
 */
const ACTIVE_ORDER_STATUSES = new Set(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY']);

/** True while any of the given order statuses is still active (non-terminal). */
export function anyOrderStatusActive(statuses: readonly string[]): boolean {
  return statuses.some((s) => ACTIVE_ORDER_STATUSES.has(s));
}

const keyFor = (storeId: number | string) => `manyorder_lastorder_${storeId}`;

export function saveRecentOrder(storeId: number | string, order: { orderId: number; phone: string }): void {
  try {
    localStorage.setItem(keyFor(storeId), JSON.stringify({
      orderId: order.orderId,
      phone: order.phone,
      placedAt: new Date().toISOString(),
    } satisfies RecentOrder));
  } catch { /* storage full/blocked — recall is best-effort */ }
}

export function getRecentOrder(storeId: number | string): RecentOrder | null {
  try {
    const raw = localStorage.getItem(keyFor(storeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.orderId === 'number' && typeof parsed?.phone === 'string') {
      return { orderId: parsed.orderId, phone: parsed.phone, placedAt: String(parsed.placedAt ?? '') };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearRecentOrder(storeId: number | string): void {
  try {
    localStorage.removeItem(keyFor(storeId));
  } catch { /* ignore */ }
}
