import type { CustomerTag } from '../lib/api';

/** Soft-tint palette for customer tags. Keys kept in sync with the backend
 *  CustomerTag.COLORS set. */
export const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gray: { bg: '#F3F4F6', text: '#4B5563', border: '#D1D5DB' },
  orange: { bg: '#FFF3E6', text: '#C2570C', border: '#FED7AA' },
  blue: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  pink: { bg: '#FCE7F3', text: '#BE185D', border: '#FBCFE8' },
  purple: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
};

export const TAG_COLOR_KEYS = Object.keys(TAG_COLORS);
export const DEFAULT_TAG_COLOR = 'gray';

export function tagColor(key: string): { bg: string; text: string; border: string } {
  return TAG_COLORS[key] ?? TAG_COLORS[DEFAULT_TAG_COLOR];
}

/** Read-only colored tag pill, used on the Customers list and the Orders screen. */
export function TagChip({ tag, size = 'sm' }: { tag: CustomerTag; size?: 'sm' | 'xs' }) {
  const c = tagColor(tag.color);
  return (
    <span style={{
      padding: size === 'xs' ? '0 6px' : '1px 7px', borderRadius: '999px',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontSize: size === 'xs' ? '10px' : '11px',
      fontWeight: 600, whiteSpace: 'nowrap', lineHeight: size === 'xs' ? '15px' : 1.5,
    }}>{tag.name}</span>
  );
}
