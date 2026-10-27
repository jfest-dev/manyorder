import { useEffect, useState } from 'react';
import { Select } from './Select';
import { PHONE_CODE_SHORT, PHONE_COUNTRY_OPTIONS, combinePhone, splitPhone } from '../lib/storeFields';

interface PhoneFieldProps {
  /** The stored combined phone string (e.g. "+6591234567" or a legacy value). */
  value: string;
  onChange: (combined: string) => void;
  label?: string;
  helperText?: string;
}

/**
 * The one phone input used by Create Store and Store Settings: a country-code
 * dropdown plus a number box. A stored phone that starts with +65/+62 splits
 * into code + number; anything else shows unchanged in the number box with no
 * code selected. It only calls onChange on a real edit, so an untouched phone
 * is never rewritten on save.
 */
// A blank field defaults the code to +65 (a convenience for new stores); a
// non-blank legacy value keeps "no code" so it is shown exactly as stored.
function deriveParts(value: string | null | undefined): { code: string; number: string } {
  const s = splitPhone(value);
  if (s.code === '' && s.number === '') return { code: '+65', number: '' };
  return s;
}

export function PhoneField({ value, onChange, label, helperText }: PhoneFieldProps) {
  const [code, setCode] = useState(() => deriveParts(value).code);
  const [number, setNumber] = useState(() => deriveParts(value).number);

  // Re-seed when the value arrives or changes from outside (e.g. an async load),
  // but not from our own edits (then value already equals our combined output).
  useEffect(() => {
    if (value !== combinePhone(code, number)) {
      const s = deriveParts(value);
      setCode(s.code);
      setNumber(s.number);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (nextCode: string, nextNumber: string) => {
    setCode(nextCode);
    setNumber(nextNumber);
    onChange(combinePhone(nextCode, nextNumber));
  };

  return (
    <div>
      {label && (
        <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>{label}</label>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
        <Select
          value={code}
          onChange={(c) => emit(c, number)}
          options={PHONE_COUNTRY_OPTIONS}
          placeholder="Code"
          ariaLabel="Country code"
          renderValue={(v) => PHONE_CODE_SHORT[v] ?? v}
        />
        <input
          type="tel"
          placeholder="8123 4567"
          value={number}
          aria-label="Phone number"
          onChange={(e) => emit(code, e.target.value)}
          style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-field)', background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
        />
      </div>
      {helperText && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>{helperText}</p>
      )}
    </div>
  );
}
