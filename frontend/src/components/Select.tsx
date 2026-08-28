import * as RS from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { CSSProperties } from 'react';

export interface SelectOption { value: string; label: string; }

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Trigger height in px (default 40; use 32 for compact filters). */
  height?: number;
  fontSize?: number;
  /** Extra styles merged onto the trigger (e.g. width overrides). */
  triggerStyle?: CSSProperties;
}

// Radix forbids an empty-string Item value (it's reserved for "clear"), but the
// app uses '' for "no selection" / placeholder options. Map '' to a sentinel at
// the Radix boundary and back on the way out.
const EMPTY = '__empty__';
const toRadix = (v: string) => (v === '' ? EMPTY : v);
const fromRadix = (v: string) => (v === EMPTY ? '' : v);

/**
 * Custom dropdown built on Radix Select: keyboard nav, focus, click-outside and
 * positioning for free, styled inline + via .mo-select-* rules in index.css to
 * match the app's dialog look (rounded popover card, soft shadow, hover/selected
 * states). Replaces native <select> so the open menu isn't browser chrome.
 */
export function Select({
  value, onChange, options, placeholder = 'Select…', disabled, ariaLabel,
  height = 40, fontSize = 13, triggerStyle,
}: SelectProps) {
  return (
    <RS.Root value={toRadix(value)} onValueChange={(v) => onChange(fromRadix(v))} disabled={disabled}>
      <RS.Trigger
        aria-label={ariaLabel}
        className="mo-select-trigger"
        style={{
          width: '100%', height, padding: '0 12px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '8px', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-field)', background: 'var(--bg-card)', color: 'var(--text-primary)',
          fontSize, fontFamily: 'inherit', outline: 'none', cursor: disabled ? 'default' : 'pointer',
          ...triggerStyle,
        }}
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon asChild><ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} /></RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          className="mo-select-content"
          style={{
            minWidth: 'var(--radix-select-trigger-width)',
            maxHeight: 'var(--radix-select-content-available-height)',
            background: 'var(--bg-card)', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-medium)', boxShadow: 'var(--shadow-overlay)',
            overflow: 'hidden', zIndex: 1100,
          }}
        >
          <RS.Viewport style={{ padding: '6px' }}>
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={toRadix(o.value)}
                className="mo-select-item"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                  padding: '8px 10px', fontSize, color: 'var(--text-primary)',
                  borderRadius: 'var(--radius-field)', cursor: 'pointer', outline: 'none', userSelect: 'none',
                }}
              >
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator><Check size={15} /></RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
