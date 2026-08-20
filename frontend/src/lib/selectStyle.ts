import type { CSSProperties } from 'react';

/**
 * Canonical styled-dropdown look - the same treatment used by the Currency
 * field. Every native <select> in the app should spread this so they match:
 * a suppressed native chrome (across WebKit/Firefox/standard), a custom chevron,
 * a consistent border, and room on the right for the chevron.
 *
 * Override `height`/`flex`/`width` per site as needed; keep everything else.
 * Note: `background` (color) must stay before `backgroundImage` so the chevron
 * image isn't cleared by the shorthand.
 */
export const styledSelect: CSSProperties = {
  width: '100%',
  height: '40px',
  padding: '0 32px 0 12px',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-field)',
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  cursor: 'pointer',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  appearance: 'none',
  backgroundImage:
    `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
};
