// Small date/time formatting helpers for the storefront (and product previews).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08-09" -> "09 Aug 2026". Parses the parts directly (no timezone shift). */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const month = MONTHS[Number(mo) - 1];
  if (!month) return iso;
  return `${d} ${month} ${y}`;
}

/** "14:00" or "14:00:00" -> "2pm"; "14:30" -> "2:30pm". */
export function formatTime12(hhmm: string | null | undefined): string | null {
  if (!hhmm) return null;
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hhmm;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const period = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return min === 0 ? `${h}${period}` : `${h}:${String(min).padStart(2, '0')}${period}`;
}

/**
 * Pre-order ready line: "09 Aug 2026 | 2pm - 6pm".
 * - Time range shown only when BOTH start and end are set.
 * - Date-only when there's a date but not a full time range.
 * - null when there's nothing to show (so the caller can omit the line entirely).
 */
export function formatPreorderReady(
  date: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  const dateStr = formatDate(date);
  const startStr = formatTime12(start);
  const endStr = formatTime12(end);
  const range = startStr && endStr ? `${startStr} - ${endStr}` : null;

  if (dateStr && range) return `${dateStr} | ${range}`;
  if (dateStr) return dateStr;
  if (range) return range;
  return null;
}
