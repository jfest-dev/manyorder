import { deriveTagStyle, type TagStyle } from './tagStyle';

// The one brand palette, shared by the store theme picker (which uses the solid shade)
// and the customer tag picker. Each hue has:
//  - key:   the stored tag colour (stable; also the backend CustomerTag.COLORS key)
//  - name:  the display label
//  - solid: the theme swatch (hex) shown in the Settings picker (unchanged from before)
// A tag's chip colours are DERIVED from the solid by deriveTagStyle (border and dot are
// the exact swatch colour, the fill is a pale tint, the text a readable darker shade),
// so the two pickers share one list, names and order, and can never drift apart. Saved
// tag keys and saved theme hex values are preserved (do not rename keys or change the
// existing solids); a saved theme colour not in this list is treated as "Custom".
export interface PaletteColor {
  key: string;
  name: string;
  solid: string;
}

export const PALETTE: PaletteColor[] = [
  { key: 'gray',   name: 'Slate',  solid: '#000000' },
  { key: 'blue',   name: 'Blue',   solid: '#3B82F6' },
  { key: 'purple', name: 'Purple', solid: '#8B5CF6' },
  { key: 'pink',   name: 'Pink',   solid: '#EC4899' },
  { key: 'green',  name: 'Green',  solid: '#10B981' },
  { key: 'orange', name: 'Orange', solid: '#F97316' },
];

/** Theme swatches (solid hex), in palette order. */
export const THEME_SOLIDS: string[] = PALETTE.map((c) => c.solid);

/** Tag chip styles keyed by the stored colour key, derived from each swatch. */
export const TAG_SOFT: Record<string, TagStyle> =
  Object.fromEntries(PALETTE.map((c) => [c.key, deriveTagStyle(c.solid)]));

export const TAG_COLOR_KEYS: string[] = PALETTE.map((c) => c.key);
export const DEFAULT_TAG_COLOR = 'gray';

/** A saved tag key that is not in the palette maps to the default swatch, without
 *  changing the stored key (so no saved data is touched). */
export function tagColor(key: string): TagStyle {
  return TAG_SOFT[key] ?? TAG_SOFT[DEFAULT_TAG_COLOR];
}

/** True when a stored theme hex is one of the palette solids (else it is Custom). */
export function isKnownThemeColor(hex: string | null | undefined): boolean {
  return !!hex && THEME_SOLIDS.includes(hex);
}
