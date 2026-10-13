/**
 * The recent-order recall shortcut was removed. A returning visitor's browser
 * may still hold last-order copies it saved under `manyorder_lastorder_<storeId>`
 * (order number, phone and tracking token). Purge every such key on load so no
 * last-order data lingers on the device.
 *
 * Storage access can throw (private mode, blocked cookies), so this is a no-op
 * when localStorage is unavailable.
 */
const LEGACY_PREFIX = 'manyorder_lastorder_';

export function purgeRecentOrderRecall(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LEGACY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable - nothing to clean */
  }
}
