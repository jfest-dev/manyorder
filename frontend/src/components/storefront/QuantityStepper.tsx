import { Minus, Plus } from 'lucide-react';

interface QuantityStepperProps {
  quantity: number;
  onChange: (quantity: number) => void;
  /** Smallest allowed value. 0 lets the minus button remove the item (cart/shop). */
  min?: number;
  /** Largest allowed value (e.g. a product's stock). Undefined = no cap. */
  max?: number;
  /** When true and the quantity has hit `max`, show a small "Max N" caption so
   *  the disabled "+" isn't silent. */
  maxHint?: boolean;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

/**
 * Shared quantity control used on the shop rows, the cart, and the PDP so the
 * spacing/alignment is identical everywhere. Evenly-sized touch targets with a
 * centered value between them.
 */
export function QuantityStepper({ quantity, onChange, min = 0, max, maxHint = false, size = 'sm', disabled = false }: QuantityStepperProps) {
  const dim = size === 'md' ? 44 : 34;
  const valueWidth = size === 'md' ? 44 : 38;
  const icon = size === 'md' ? 18 : 15;

  const btn = (active: boolean): React.CSSProperties => ({
    width: dim, height: dim, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: 'none', background: 'transparent', padding: 0,
    cursor: active ? 'pointer' : 'not-allowed',
    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
  });

  const atMax = max !== undefined && quantity >= max;
  const canDec = !disabled && quantity > min;
  const canInc = !disabled && !atMax;

  const control = (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center',
        border: '1px solid var(--border-subtle)', borderRadius: '10px',
        background: 'white', overflow: 'hidden', height: dim,
      }}
    >
      <button type="button" aria-label="Decrease quantity" disabled={!canDec} onClick={() => onChange(quantity - 1)} style={btn(canDec)}>
        <Minus size={icon} />
      </button>
      <span style={{ minWidth: valueWidth, textAlign: 'center', fontSize: size === 'md' ? '15px' : '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {quantity}
      </span>
      <button type="button" aria-label="Increase quantity" disabled={!canInc} onClick={() => onChange(quantity + 1)} style={btn(canInc)}>
        <Plus size={icon} />
      </button>
    </div>
  );

  // When maxed and asked to, explain the disabled "+" with a compact caption.
  if (maxHint && atMax) {
    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
        {control}
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Max {max}</span>
      </div>
    );
  }
  return control;
}
