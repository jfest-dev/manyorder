import type { CSSProperties } from 'react';

/**
 * The one scale for every admin-console screen. No admin screen defines its own
 * font size; they all read from here. Baseline is the pushed desktop look, with
 * two floors applied: body text is at least 14, small/caption text at least 12.
 * Merchant screens do not use these tokens and keep the shared text-* classes.
 */
export const ADMIN_FONT = {
  title: 20,
  heading: 16,
  body: 14,
  small: 13,
  caption: 12,
  metric: 24, // big dashboard numbers (tiles, order value)
} as const;

/** Spacing steps (px). */
export const ADMIN_SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

export const ADMIN_SIZE = {
  cardPadding: 16,
  /** Inputs, selects and buttons on desktop. */
  controlHeight: 40,
  /** Minimum interactive size on phones. */
  tapTarget: 44,
  radiusCard: 'var(--radius-medium)',
  radiusField: 'var(--radius-field)',
} as const;

export const ADMIN_ICON = { sm: 14, md: 16, lg: 18 } as const;

/** Ready-made text styles, so a screen writes `...adminText.body` instead of a raw number. */
export const adminText: Record<'title' | 'heading' | 'body' | 'small' | 'caption' | 'metric', CSSProperties> = {
  title: { fontSize: ADMIN_FONT.title, fontWeight: 700 },
  heading: { fontSize: ADMIN_FONT.heading, fontWeight: 700 },
  body: { fontSize: ADMIN_FONT.body },
  small: { fontSize: ADMIN_FONT.small },
  caption: { fontSize: ADMIN_FONT.caption },
  metric: { fontSize: ADMIN_FONT.metric, fontWeight: 800 },
};
