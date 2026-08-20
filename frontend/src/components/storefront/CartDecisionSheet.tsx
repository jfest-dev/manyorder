import { Plus, X } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import type { CartLine } from './storefrontTypes';

interface CartDecisionSheetProps {
  productName: string;
  currency: string;
  /** The product's existing cart lines (customizations already ordered). */
  lines: CartLine[];
  /** Bump an existing customization's quantity by one (no PDP needed). */
  onAddOne: (signature: string) => void;
  /** Proceed to the PDP to build a new customization. */
  onAddNew: () => void;
  onClose: () => void;
}

const BRAND = 'var(--primary-solid)';

/**
 * The GrabFood-style "you already have this" prompt, shown from the shop grid the
 * moment a customer taps a product they already have in the cart. It lets them
 * bump an existing choice in one tap, or go to the PDP to pick different options,
 * without being forced through modifier selection first.
 */
export function CartDecisionSheet({ productName, currency, lines, onAddOne, onAddNew, onClose }: CartDecisionSheetProps) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '480px', background: 'white', borderRadius: '16px 16px 0 0', padding: '16px', boxShadow: '0 -8px 30px rgba(0,0,0,0.15)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>You already have {productName} in your cart</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}><X size={20} /></button>
        </div>
        <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '0 0 14px' }}>
          Add one more of a choice you already have, or start a new one with different options.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {lines.map((l) => (
            <div key={l.signature} style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '10px 12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                  {l.selectedOptions.length > 0 ? l.selectedOptions.map((o) => o.optionName).join(', ') : 'No options'}
                </div>
                {l.notes && <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>“{l.notes}”</div>}
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {formatMoney(l.unitPrice, currency)} each · in cart: {l.quantity}
                </div>
              </div>
              <button
                onClick={() => onAddOne(l.signature)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', height: '34px', padding: '0 12px', borderRadius: '9px', border: `1px solid ${BRAND}`, background: 'white', color: BRAND, fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                <Plus size={15} /> Add one
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onAddNew}
          style={{ width: '100%', height: '46px', borderRadius: '12px', border: 'none', background: BRAND, color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          Add a new one with different options
        </button>
      </div>
    </div>
  );
}
