import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar as CalendarIcon, X as XIcon } from 'lucide-react';

// 'YYYY-MM-DD' <-> local Date, avoiding the UTC shift `new Date("YYYY-MM-DD")` causes.
function parseYmd(s: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmt(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

interface DatePickerProps {
  value: string;                 // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void;
  min?: string;                  // earliest selectable 'YYYY-MM-DD'
  placeholder?: string;
  ariaLabel?: string;
}

/**
 * Date field with a custom calendar popover (Radix Popover + react-day-picker),
 * styled via .mo-popover-content / .mo-daypicker in index.css to match the app's
 * dialogs. Replaces native <input type="date"> so the calendar isn't browser chrome.
 */
export function DatePicker({ value, onChange, min, placeholder = 'Select date', ariaLabel }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseYmd(value);
  const minDate = min ? parseYmd(min) : undefined;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Relative wrapper so the clear (X) button can sit as a sibling of the
          trigger, not nested inside it (nested <button> is invalid HTML). */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            className="mo-select-trigger"
            style={{
              width: '100%', height: 40, padding: '0 12px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: 8, border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-field)', background: 'var(--bg-card)',
              color: selected ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13,
              fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
            }}
          >
            <span>{selected ? fmt(selected) : placeholder}</span>
            {/* Keep the space reserved; the clear button overlays this slot when set. */}
            <CalendarIcon
              size={16}
              style={{ color: 'var(--text-muted)', flexShrink: 0, visibility: selected ? 'hidden' : 'visible' }}
            />
          </button>
        </Popover.Trigger>
        {selected && (
          <button
            type="button"
            aria-label={ariaLabel ? `Clear ${ariaLabel.toLowerCase()}` : 'Clear date'}
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, padding: 0, border: 'none', borderRadius: 'var(--radius-field)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
            }}
          >
            <XIcon size={16} />
          </button>
        )}
      </div>
      <Popover.Portal>
        <Popover.Content className="mo-popover-content" align="start" sideOffset={6} style={{ zIndex: 1100 }}>
          <DayPicker
            className="mo-daypicker"
            mode="single"
            selected={selected}
            defaultMonth={selected ?? minDate}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(d) => { if (d) { onChange(toYmd(d)); setOpen(false); } }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
