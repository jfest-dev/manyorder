import type { CustomerTag } from '../lib/api';
import { TAG_SOFT, TAG_COLOR_KEYS, DEFAULT_TAG_COLOR, tagColor } from '../lib/palette';

/** Soft-tint tag palette, sourced from the one shared brand palette so the tag
 *  picker and the theme picker never drift. Kept in sync with the backend
 *  CustomerTag.COLORS set. */
export const TAG_COLORS = TAG_SOFT;
export { TAG_COLOR_KEYS, DEFAULT_TAG_COLOR, tagColor };

/** Read-only colored tag pill, used on the Customers list and the Orders screen. The
 *  dot and border are the exact swatch colour; the fill and text are derived from it. */
export function TagChip({ tag, size = 'sm' }: { tag: CustomerTag; size?: 'sm' | 'xs' }) {
  const c = tagColor(tag.color);
  const d = size === 'xs' ? 6 : 7;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: size === 'xs' ? '4px' : '5px',
      padding: size === 'xs' ? '0 6px' : '1px 7px', borderRadius: '999px',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontSize: size === 'xs' ? '10px' : '11px',
      fontWeight: 600, whiteSpace: 'nowrap', lineHeight: size === 'xs' ? '15px' : 1.5,
    }}>
      <span aria-hidden="true" style={{ width: d, height: d, borderRadius: '999px', background: c.dot, flexShrink: 0 }} />
      {tag.name}
    </span>
  );
}
