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

export function initialsOf(name: string): string {
  return (name || 'MS')
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
