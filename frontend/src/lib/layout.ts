/**
 * The single source for the page side gap, so every shell applies one responsive
 * value and no screen sets its own. Desktop keeps the established 24px (unchanged);
 * phones use a tighter 16px so narrow screens are not squeezed, and so the merchant
 * and admin shells line up at the same gap on small screens.
 */
export const PAGE_PAD_DESKTOP = 24;
export const PAGE_PAD_PHONE = 16;

/** CSS padding value for a shell content box at the given breakpoint. */
export function pagePadding(isDesktop: boolean): string {
  return `${isDesktop ? PAGE_PAD_DESKTOP : PAGE_PAD_PHONE}px`;
}
