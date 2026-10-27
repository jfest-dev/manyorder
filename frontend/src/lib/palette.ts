// The one brand palette, shared by the store theme picker (which uses the solid
// shade) and the customer tag picker (which uses the soft shade). Each hue has:
//  - key:   the stored tag colour (stable; also the backend CustomerTag.COLORS key)
//  - name:  the display label
//  - solid: the stored theme colour (hex)
//  - soft:  the tag-chip tint (bg / text / border), same hue as the solid
// Both pickers render exactly this list, so they can never drift apart. Saved tag
// keys and saved theme hex values are preserved (do not rename keys or change the
// existing solids); a saved theme colour not in this list is treated as "Custom"
// and left unchanged.
export interface PaletteColor {
  key: string;
  name: string;
  solid: string;
  soft: { bg: string; text: string; border: string };
}

export const PALETTE: PaletteColor[] = [
  { key: 'gray',   name: 'Slate',  solid: '#000000', soft: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' } },
  { key: 'blue',   name: 'Blue',   solid: '#3B82F6', soft: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' } },
  { key: 'purple', name: 'Purple', solid: '#8B5CF6', soft: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' } },
  { key: 'pink',   name: 'Pink',   solid: '#EC4899', soft: { bg: '#FCE7F3', text: '#BE185D', border: '#FBCFE8' } },
  { key: 'green',  name: 'Green',  solid: '#10B981', soft: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' } },
  { key: 'orange', name: 'Orange', solid: '#F97316', soft: { bg: '#FFF3E6', text: '#9A3412', border: '#FED7AA' } },
];

/** Theme swatches (solid hex), in palette order. */
export const THEME_SOLIDS: string[] = PALETTE.map((c) => c.solid);

/** Tag soft tints keyed by the stored colour key. */
export const TAG_SOFT: Record<string, { bg: string; text: string; border: string }> =
  Object.fromEntries(PALETTE.map((c) => [c.key, c.soft]));

export const TAG_COLOR_KEYS: string[] = PALETTE.map((c) => c.key);
export const DEFAULT_TAG_COLOR = 'gray';

export function tagColor(key: string): { bg: string; text: string; border: string } {
  return TAG_SOFT[key] ?? TAG_SOFT[DEFAULT_TAG_COLOR];
}

/** True when a stored theme hex is one of the palette solids (else it is Custom). */
export function isKnownThemeColor(hex: string | null | undefined): boolean {
  return !!hex && THEME_SOLIDS.includes(hex);
}
