import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FieldInput } from './Field';

interface PasswordFieldProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange: (value: string) => void;
  helperText?: string;
  error?: string;
  required?: boolean;
  style?: React.CSSProperties;
}

/** Password input with an in-field eye icon to toggle visibility.
 *  Wraps FieldInput so all input styling stays in one place. */
export function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  helperText,
  error,
  required,
  style,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <FieldInput
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      helperText={helperText}
      error={error}
      required={required}
      style={style}
      type={show ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: '4px',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
}
