import type { ProductResponse } from './api';

/**
 * Which products earn a "Bestseller" badge on the storefront.
 *
 * A product qualifies only if it is BOTH among the store's top `topN` products
 * by units sold AND has sold at least `minUnits`. The relative rule keeps the
 * badge meaningful (a real leader, and few enough to matter); the absolute floor
 * is the anti-weak guard, so the top product of a brand-new or thin-selling
 * store, with only a handful of sales, is never badged. A store with nothing
 * over the floor yields an empty set and shows no badge at all.
 *
 * `unitsSold` here is the storefront-only, fulfilled-only count the public API
 * returns, windowed to a rolling 30 days server-side, so the badge reflects
 * recent popularity and can't be inflated by a merchant's manual orders.
 */
export function bestsellerProductIds(
  products: ProductResponse[],
  { topN = 3, minUnits = 10 }: { topN?: number; minUnits?: number } = {},
): Set<number> {
  const ranked = [...products]
    .filter((p) => p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold || a.name.localeCompare(b.name))
    .slice(0, topN)
    .filter((p) => p.unitsSold >= minUnits);
  return new Set(ranked.map((p) => p.id));
}
