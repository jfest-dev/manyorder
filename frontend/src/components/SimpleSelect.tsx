import { Select } from './Select';

interface SimpleSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  helperText?: string;
  compact?: boolean;
}

/** Label + custom dropdown, matching the FieldInput look. */
export function SimpleSelect({ label, value, onChange, options, helperText, compact }: SimpleSelectProps) {
  return (
    <div>
      {label && (
        <label className="text-small" style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
          {label}
        </label>
      )}
      <Select value={value} onChange={onChange} options={options} height={compact ? 32 : 40} ariaLabel={label} />
      {helperText && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>{helperText}</p>
      )}
    </div>
  );
}
