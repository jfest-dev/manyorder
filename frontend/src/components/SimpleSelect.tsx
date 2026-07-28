import { styledSelect } from '../lib/selectStyle';

interface SimpleSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  helperText?: string;
  compact?: boolean;
}

/** Native select styled to match the FieldInput look. */
export function SimpleSelect({ label, value, onChange, options, helperText, compact }: SimpleSelectProps) {
  return (
    <div>
      {label && (
        <label className="text-small" style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-small"
        style={{ ...styledSelect, height: compact ? '32px' : '40px' }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {helperText && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>{helperText}</p>
      )}
    </div>
  );
}
