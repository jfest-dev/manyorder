/**
 * Storefront button colour rule (permanent).
 *
 * If the store has a valid saved theme colour, that EXACT colour is used, with
 * white text, with no contrast gate and no darkening or mapping, for ONLY two
 * things:
 *   - the Add to cart buttons: the shop-page product cards (StorefrontView) and the
 *     product detail page (ProductDetailView), and
 *   - the selected category bubble on the shop page (StorefrontView).
 * If the store has no valid saved colour, --sf-accent falls back to
 * var(--primary-solid) (black), so those elements look exactly as on origin/main.
 *
 * Everything else stays black exactly as on origin/main, including the View cart
 * bar, Checkout and Place order. Only StorefrontView and ProductDetailView may read
 * --sf-accent; storefrontAccent.test.tsx enforces that no other component does.
 * parseHex/contrastRatio are kept only for the colour-rule-check report, never as a
 * gate.
 */

/** Background used when the store has no valid saved colour: the origin/main black. */
export const SF_ACCENT_FALLBACK = 'var(--primary-solid)';

type RGB = [number, number, number];

/** Parse #rgb or #rrggbb into [r,g,b] 0-255, or null if not a valid hex colour. */
export function parseHex(hex: string | null | undefined): RGB | null {
  if (!hex) return null;
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** WCAG relative luminance of an sRGB colour. */
function relativeLuminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours (order independent), 1..21. Kept for the
 *  colour-rule-check report only; the rule applies no contrast gate. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** The CSS custom property set the storefront root carries. */
export type StorefrontThemeVars = { '--sf-accent': string };

/**
 * The accent variable for a saved theme colour: the EXACT colour when it is a valid
 * hex, otherwise the no-theme black. No contrast gate, no darkening, no mapping.
 */
export function storefrontTheme(hex: string | null | undefined): StorefrontThemeVars {
  return { '--sf-accent': parseHex(hex) ? hex!.trim() : SF_ACCENT_FALLBACK };
}
