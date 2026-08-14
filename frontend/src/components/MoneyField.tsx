import { useEffect, useRef, useState } from 'react';
import { FieldInput } from './Field';
import {
  currencySymbol,
  parseMoneyInput,
  formatMoneyInput,
  formatMoney,
  moneyFractionDigits,
} from '../lib/currency';

interface MoneyFieldProps {
  label?: string;
  currency: string | undefined;
  /** Canonical numeric value in major units (5.5 for SGD, 25000 for IDR), or null. */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Range bounds (in major units). Enforced with currency-aware messages. */
  min?: number;
  max?: number;
  required?: boolean;
  helperText?: string;
  /** Overrides the currency-aware default placeholder. */
  placeholder?: string;
  /** External error (e.g. a form-level "required") merged with internal validation. */
  error?: string;
  style?: React.CSSProperties;
}

/** Characters allowed WHILE typing (fuller validation happens on parse/blur). */
const ALLOWED = /[0-9.,\s]/g;

function defaultPlaceholder(currency: string | undefined): string {
  return moneyFractionDigits(currency) === 0 ? '25.000' : '5.50';
}

/**
 * A currency-aware money input. It renders as text (not a native number input,
 * whose decimal handling is browser-locale-dependent), filters keystrokes to
 * digits + separators, and parses through the shared {@link parseMoneyInput} so
 * "5,50" and "5.50" always mean the same amount. On blur it re-displays the
 * normalised, grouped value (e.g. you type 25000 for an IDR store and it shows
 * "Rp 25.000") — the visible normalisation is the guard against a merchant
 * entering a price off by 1000×.
 */
export function MoneyField({
  label, currency, value, onChange, min, max, required, helperText, placeholder, error, style,
}: MoneyFieldProps) {
  const [text, setText] = useState<string>(() => formatMoneyInput(value, currency));
  const [internalError, setInternalError] = useState<string | undefined>();
  const [focused, setFocused] = useState(false);

  // Keep the displayed text in sync when the value or currency changes from the
  // outside (initial load, currency switch) — but never fight the user mid-edit.
  useEffect(() => {
    if (!focused) setText(formatMoneyInput(value, currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);

  const validateRange = (v: number): string | undefined => {
    if (min !== undefined && v < min) return `Must be at least ${formatMoney(min, currency)}.`;
    if (max !== undefined && v > max) return `Can't exceed ${formatMoney(max, currency)}.`;
    return undefined;
  };

  const handleChange = (raw: string) => {
    // Filter to the allowed character set so stray letters never land.
    const filtered = (raw.match(ALLOWED) || []).join('');
    setText(filtered);
    const { value: parsed, error: parseError } = parseMoneyInput(filtered, currency);
    // Surface a hard parse error immediately; defer softer range checks to blur
    // so a valid prefix (e.g. "0" on the way to "0.50") doesn't flash an error.
    setInternalError(parseError);
    onChange(parsed);
    if (!parseError && parsed !== null) {
      const rangeError = validateRange(parsed);
      if (rangeError) setInternalError(undefined); // hold range messaging until blur
    }
  };

  const handleBlur = () => {
    setFocused(false);
    const { value: parsed, error: parseError } = parseMoneyInput(text, currency);
    if (parseError) { setInternalError(parseError); return; }
    if (parsed === null) { setInternalError(undefined); setText(''); return; }
    const rangeError = validateRange(parsed);
    setInternalError(rangeError);
    // Re-display the canonical, grouped form so the merchant sees exactly what
    // was understood (the safety net against a 1000× mistake).
    setText(formatMoneyInput(parsed, currency));
  };

  return (
    <FieldInput
      label={label}
      type="text"
      inputMode={moneyFractionDigits(currency) === 0 ? 'numeric' : 'decimal'}
      prefix={currencySymbol(currency)}
      placeholder={placeholder ?? defaultPlaceholder(currency)}
      value={text}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      required={required}
      helperText={helperText}
      error={error ?? internalError}
      style={style}
    />
  );
}
