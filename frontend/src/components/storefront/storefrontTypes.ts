import type { ProductResponse } from '../../lib/api';

/**
 * Minimal store shape the presentational storefront views render. The public
 * page passes a real PublicStoreResponse; the onboarding/edit previews pass an
 * in-progress draft — both satisfy this, so one component serves every surface.
 */
export interface StorefrontStore {
  name: string;
  storeDescription?: string | null;
  logoUrl?: string | null;
  themeColor?: string | null;
  currency: string;
  totalItemsSold?: number;
}

/** One line in the guest cart. */
export interface CartLine {
  product: ProductResponse;
  quantity: number;
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
