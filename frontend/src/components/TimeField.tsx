import { useEffect, useState } from 'react';

interface TimeFieldProps {
  /** 24-hour "HH:mm" (what the backend stores), or '' when unset. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // 1..12
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

/** "HH:mm" (24h) -> { h12, min, mer }; empty parts when unparseable. */
function parse(value: string): { h12: string; min: string; mer: 'AM' | 'PM' | '' } {
  const m = (value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return { h12: '', min: '00', mer: '' };
  let h = parseInt(m[1], 10);
  const mer: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return { h12: String(h), min: m[2], mer };
}

/** { h12, min, mer } -> "HH:mm" (24h), or '' unless both hour and AM/PM are chosen. */
function compose(h12: string, min: string, mer: string): string {
  if (!h12 || !mer) return '';
  let h = parseInt(h12, 10) % 12;
  if (mer === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${(min || '00').padStart(2, '0')}`;
}

const selectStyle: React.CSSProperties = {
  height: '40px', padding: '0 8px', borderRadius: 'var(--radius-field)',
  border: '1px solid var(--border-strong)', background: 'var(--bg-card)',
  fontSize: '13px', outline: 'none',
};

/**
 * A 12-hour AM/PM time input (hour · minute · AM/PM), avoiding the native
 * `<input type="time">` whose format follows the browser locale (often 24h) and
 * is fiddly to clear on mobile. Stores/emits 24-hour "HH:mm"; emits '' until both
 * hour and AM/PM are set, and is fully cleared when the value is set back to ''.
 */
export function TimeField({ value, onChange, ariaLabel }: TimeFieldProps) {
  const p = parse(value);
  const [h12, setH12] = useState(p.h12);
  const [min, setMin] = useState(p.min);
  const [mer, setMer] = useState<string>(p.mer);

  // Re-sync when the value changes from outside (e.g. a "Clear" button, or load).
  useEffect(() => {
    if (compose(h12, min, mer) !== value) {
      const next = parse(value);
      setH12(next.h12); setMin(next.min); setMer(next.mer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (nh: string, nm: string, nmer: string) => onChange(compose(nh, nm, nmer));

  // Keep a legacy off-step minute (e.g. "37") selectable rather than dropping it.
  const minuteOptions = MINUTES.includes(min) || min === '' ? MINUTES : [...MINUTES, min].sort();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} aria-label={ariaLabel}>
      <select style={{ ...selectStyle, flex: 1 }} value={h12}
        onChange={(e) => { setH12(e.target.value); emit(e.target.value, min, mer); }}>
        <option value="">--</option>
        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>:</span>
      <select style={{ ...selectStyle, flex: 1 }} value={min}
        onChange={(e) => { setMin(e.target.value); emit(h12, e.target.value, mer); }}>
        {minuteOptions.map((mm) => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <select style={{ ...selectStyle, width: '64px' }} value={mer}
        onChange={(e) => { setMer(e.target.value); emit(h12, min, e.target.value); }}>
        <option value="">--</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
