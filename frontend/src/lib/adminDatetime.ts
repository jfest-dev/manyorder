/**
 * Shared date/time formatting for the admin console, in the viewer's local time.
 *
 * - formatDate:     "7 July 2026"
 * - formatDateTime: "7 July 2026, 5:11 AM"  (12-hour, no seconds)
 *
 * The date part uses en-GB so the day comes first ("7 July 2026"); the time part
 * uses en-US so it reads "5:11 AM" rather than lowercase "am". Both default to the
 * runtime's time zone, so timestamps show in the viewer's local time. Never the
 * numeric "17/07/2026, 05:11:04" form.
 *
 * (The storefront has its own lighter datetime helpers in ./datetime; this module
 * is the admin console's single source for console-wide date/time display.)
 */

const DATE_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

const EMPTY = '-';

function parse(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso?: string | null): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString('en-GB', DATE_OPTS) : EMPTY;
}

const SHORT_DATE_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };

/** Compact day + short month, e.g. "3 Oct". For dense axes and chart labels. */
export function formatShortDate(iso?: string | null): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString('en-GB', SHORT_DATE_OPTS) : EMPTY;
}

export function formatDateTime(iso?: string | null): string {
  const d = parse(iso);
  if (!d) return EMPTY;
  return `${d.toLocaleDateString('en-GB', DATE_OPTS)}, ${d.toLocaleTimeString('en-US', TIME_OPTS)}`;
}
