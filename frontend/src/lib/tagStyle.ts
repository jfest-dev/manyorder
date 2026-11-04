/**
 * Derives a customer tag's chip colours from one shared swatch colour, so the tag
 * picker and the theme picker can never drift apart. For a swatch (the solid hex):
 *   - border and dot are the EXACT swatch colour,
 *   - fill is a pale (12%) tint of it,
 *   - text is a darker shade of the SAME hue, darkened by the minimum needed to stay
 *     readable on the fill (WCAG AA, >= 4.5:1).
 * Everything is derived by this function, never tuned by hand, so a later swatch
 * change flows through automatically and a test can pin the result.
 */

export interface TagStyle {
  /** Chip fill: a pale tint of the swatch. */
  bg: string;
  /** Chip text: a darker shade of the swatch hue, readable on the fill. */
  text: string;
  /** Chip border and dot: the exact swatch colour. */
  border: string;
  dot: string;
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function relLuminance([r, g, b]: RGB): number {
  const v = [r, g, b].map((x) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

export function contrast(a: RGB, b: RGB): number {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    switch (mx) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

function tint([r, g, b]: RGB, f: number): RGB {
  return [r * f + 255 * (1 - f), g * f + 255 * (1 - f), b * f + 255 * (1 - f)];
}

/** AA text contrast target. */
export const TAG_TEXT_MIN_CONTRAST = 4.5;

/** Derive the tag chip colours for one swatch (exact tested algorithm). */
export function deriveTagStyle(solidHex: string): TagStyle {
  const solid = hexToRgb(solidHex);
  const fill = tint(solid, 0.12);
  const [h, s] = rgbToHsl(solid);
  // Darken from the swatch's own lightness downward by the least amount that reaches
  // readable contrast on the fill; same hue and saturation throughout.
  let text: RGB = hslToRgb(h, s, 0);
  for (let l = 0.5; l >= 0; l -= 0.01) {
    const candidate = hslToRgb(h, s, l);
    if (contrast(candidate, fill) >= TAG_TEXT_MIN_CONTRAST) { text = candidate; break; }
  }
  return { bg: rgbToHex(fill), text: rgbToHex(text), border: solidHex, dot: solidHex };
}
