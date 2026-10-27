import * as RC from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  id?: string;
  style?: CSSProperties;
}

/**
 * Custom checkbox (Radix Checkbox) styled via .mo-checkbox in index.css to match
 * the app - rounded square, solid fill when checked. Radix renders a labelable
 * button, so an enclosing <label> still toggles it on text clicks.
 */
export function Checkbox({ checked, onChange, disabled, ariaLabel, id, style }: CheckboxProps) {
  return (
    <RC.Root
      id={id}
      className="mo-checkbox"
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      style={style}
    >
      <RC.Indicator style={{ display: 'inline-flex' }}>
        <Check size={13} strokeWidth={3} />
      </RC.Indicator>
    </RC.Root>
  );
}
