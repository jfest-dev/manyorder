import type { OrderType } from '../lib/api';

interface OrderTypeToggleProps {
  value: OrderType;
  onChange: (value: OrderType) => void;
  label?: string;
  helperText?: string;
}

const OPTIONS: { value: OrderType; label: string }[] = [
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'DELIVERY', label: 'Delivery' },
];

/**
 * Single source of truth for the Pickup / Delivery choice, shared by Add Order
 * and Edit Order. Styled to match the Orders status filter pills.
 */
export function OrderTypeToggle({ value, onChange, label = 'Order Type', helperText }: OrderTypeToggleProps) {
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</label>
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="text-small"
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 'var(--radius-pill)',
                cursor: 'pointer',
                fontWeight: 600,
                border: active ? '1px solid var(--primary-solid)' : '1px solid var(--border-strong)',
                background: active ? 'var(--primary-solid)' : 'var(--bg-card)',
                color: active ? 'var(--text-on-dark)' : 'var(--text-primary)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {helperText && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>{helperText}</p>
      )}
    </div>
  );
}
