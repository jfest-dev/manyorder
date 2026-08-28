import { Select } from './Select';

interface TimeFieldProps {
  /** 24-hour "HH:mm" (what the backend stores), or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

/** 12-hour label for a 24h hour + minute, e.g. (14, 30) -> "2:30 PM". */
function label12(h24: number, m: number): string {
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h = h24 % 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

// One option every 15 minutes across the day - plenty for a shop's ready time,
// and a single quick pick instead of three fiddly hour/minute/AM-PM dropdowns.
const OPTIONS: { value: string; label: string }[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    OPTIONS.push({ value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, label: label12(h, m) });
  }
}

/**
 * A single, clean time picker: one styled dropdown of 12-hour times (AM/PM),
 * emitting 24-hour "HH:mm". Replaces the old three-dropdown control - one tap to
 * set a time, and the display is always 12-hour regardless of browser locale.
 */
export function TimeField({ value, onChange, ariaLabel }: TimeFieldProps) {
  const v = (value || '').slice(0, 5); // tolerate "HH:mm:ss"
  const m = v.match(/^(\d{2}):(\d{2})$/);
  const isKnown = OPTIONS.some((o) => o.value === v);
  // Keep an off-grid legacy value (e.g. 14:07) selectable rather than dropping it.
  const options = v && m && !isKnown
    ? [{ value: v, label: label12(parseInt(m[1], 10), parseInt(m[2], 10)) }, ...OPTIONS]
    : OPTIONS;

  return (
    <Select value={v} onChange={onChange} options={options} placeholder="Select time" ariaLabel={ariaLabel} fontSize={14} />
  );
}
