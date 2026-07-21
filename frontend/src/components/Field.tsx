import { useState } from 'react';

interface FieldInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  prefix?: string;
  suffix?: React.ReactNode;
  type?: string;

  // ✅ add these
  required?: boolean;
  maxLength?: number;
  style?: React.CSSProperties;
}

export function FieldInput({
  label,
  placeholder,
  value = '',
  onChange,
  helperText,
  error,
  prefix,
  suffix,
  type = 'text',

  // ✅ receive here
  required,
  maxLength,
  style,
}: FieldInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div style={style}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
          {required && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              *
            </span>
          )}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        {prefix && (
          <div
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '13px',
              pointerEvents: 'none',
            }}
          >
            {prefix}
          </div>
        )}

        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          // ✅ apply here
          required={required}
          maxLength={maxLength}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="text-small w-full"
          style={{
            height: '40px',
            borderRadius: 'var(--radius-field)',
            border: error
              ? '1px solid var(--error-color)'
              : isFocused
                ? '1px solid var(--primary-solid)'
                : '1px solid var(--border-strong)',
            background: 'var(--bg-card)',
            paddingLeft: prefix ? '32px' : '12px',
            paddingRight: suffix ? '36px' : '12px',
            outline: 'none',
            boxShadow: isFocused ? '0 0 0 3px rgba(15, 23, 42, 0.1)' : 'none',
            transition: 'all 0.15s ease',
          }}
        />

        {suffix && (
          <div
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {suffix}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs" style={{ color: 'var(--error-color)', marginTop: '6px' }}>
          {error}
        </p>
      ) : helperText ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

interface FieldSelectOption {
  value: string;
  label: string;
}

interface FieldSelectProps {
  label?: string;
  placeholder?: string;
  options: FieldSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  helperText?: string;
  required?: boolean;
}

export function FieldSelect({
  label,
  placeholder = 'Select...',
  options,
  value = '',
  onChange,
  helperText,
  required,
}: FieldSelectProps) {
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </label>
          {required && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              *
            </span>
          )}
        </div>
      )}

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          width: '100%',
          height: '40px',
          padding: '0 32px 0 12px',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-field)',
          background: 'var(--bg-card)',
          fontSize: '13px',
          outline: 'none',
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {helperText && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
