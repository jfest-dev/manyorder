import type { ProductResponse } from '../../lib/api';

// Cart types + logic live in lib/cart.ts (pure + unit-tested). Re-exported here
// so existing storefront imports keep working.
export type { CartItem, CartLine, SelectedOption } from '../../lib/cart';

/**
 * Minimal store shape the presentational storefront views render. The public
 * page passes a real PublicStoreResponse; the onboarding/edit previews pass an
 * in-progress draft - both satisfy this, so one component serves every surface.
 */
export interface StorefrontStore {
  name: string;
  storeDescription?: string | null;
  logoUrl?: string | null;
  themeColor?: string | null;
  currency: string;
  totalItemsSold?: number;
  phoneNumber?: string | null;
  address?: string | null;
  operatingHours?: string | null;
}

/** A product is orderable when it has stock, or is explicitly a pre-order item. */
export function isOrderable(p: ProductResponse): boolean {
  return p.preOrder || (p.stock ?? 0) > 0;
}

/** The most a customer may order of a product: a normal product is capped at its
 *  current stock (orders can't oversell); a pre-order item draws from future
 *  stock, so it stays uncapped (undefined = no limit). */
export function maxOrderQuantity(p: ProductResponse): number | undefined {
  return p.preOrder ? undefined : (p.stock ?? 0);
}

/** At/below this remaining stock a product is "low" — the storefront nudges with
 *  an "Only N left" label. Shared with the merchant Products list. */
export const LOW_STOCK_AT = 5;

/** Remaining units when a product is low on stock (1..LOW_STOCK_AT), else null.
 *  Pre-order items draw from future stock, so they're never "low". */
export function lowStockRemaining(p: ProductResponse): number | null {
  if (p.preOrder) return null;
  const stock = p.stock ?? 0;
  return stock > 0 && stock <= LOW_STOCK_AT ? stock : null;
}

export function initialsOf(name: string): string {
  return (name || 'MS')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
