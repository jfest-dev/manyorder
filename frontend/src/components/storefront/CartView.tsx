import { Package, Trash2, ArrowLeft, Pencil } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import type { CartLine } from './storefrontTypes';
import { QuantityStepper } from './QuantityStepper';

interface CartViewProps {
  items: CartLine[];
  currency: string;
  onQtyChange: (signature: string, quantity: number) => void;
  onRemove: (signature: string) => void;
  /** Reopen a customized line (modifiers/notes) in the PDP to change its choices. */
  onEditLine?: (line: CartLine) => void;
  onCheckout: () => void;
  /** Header back - returns to the actual previous screen. */
  onBack: () => void;
  /** Empty-state "Browse the shop" CTA - always goes to the shop. Defaults to onBack. */
  onBrowseShop?: () => void;
}

const BRAND = 'var(--primary-solid)';

/** Full-page cart - part of the multi-page shop → cart → checkout → confirmation flow. */
export function CartView({ items, currency, onQtyChange, onRemove, onEditLine, onCheckout, onBack, onBrowseShop }: CartViewProps) {
  const subtotal = items.reduce((sum, l) => sum + l.lineSubtotal, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '12px 16px', background: 'white', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Your cart</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ marginBottom: '12px' }}>Your cart is empty.</div>
            <button onClick={onBrowseShop ?? onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'underline' }}>Browse the shop</button>
          </div>
        ) : (
          items.map((l) => {
            // A customized line (options or a note) can be reopened in the PDP to
            // change its choices; a plain line has nothing to edit but its quantity.
            const editable = !!onEditLine && (l.selectedOptions.length > 0 || !!l.notes);
            const editLine = editable ? () => onEditLine!(l) : undefined;
            return (
            <div key={l.signature} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '10px' }}>
              <div onClick={editLine} style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', background: '#E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: editLine ? 'pointer' : 'default' }}>
                {l.product.photoUrl
                  ? <img src={l.product.photoUrl} alt={l.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Package size={20} style={{ color: '#9CA3AF' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div onClick={editLine} style={{ cursor: editLine ? 'pointer' : 'default' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {l.product.name}
                    {editable && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: BRAND }}><Pencil size={11} /> Edit</span>}
                  </div>
                  {/* Chosen modifiers - what distinguishes this line from another of the
                      same product. Shows the +delta only when it costs extra. */}
                  {l.selectedOptions.length > 0 && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px', lineHeight: 1.5 }}>
                      {l.selectedOptions.map((o, i) => (
                        <div key={i}>
                          {o.optionName}
                          {o.priceDelta > 0 && <span style={{ color: 'var(--text-muted)' }}> (+{formatMoney(o.priceDelta, currency)})</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  {l.notes && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', fontStyle: 'italic' }}>“{l.notes}”</div>
                  )}
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{formatMoney(l.unitPrice, currency)} each</div>
                </div>
                <div style={{ marginTop: '8px' }}>
                  <QuantityStepper quantity={l.quantity} onChange={(q) => onQtyChange(l.signature, q)} min={0} size="sm" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                <button aria-label="Remove" onClick={() => onRemove(l.signature)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C' }}><Trash2 size={16} /></button>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatMoney(l.lineSubtotal, currency)}</div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {items.length > 0 && (
        <div style={{ position: 'sticky', bottom: 0, padding: '16px', background: 'white', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
            <span style={{ fontWeight: 700 }}>{formatMoney(subtotal, currency)}</span>
          </div>
          <button
            onClick={onCheckout}
            style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: BRAND, color: 'white', fontSize: '15px', fontWeight: 700 }}
          >
            Checkout
          </button>
        </div>
      )}
    </div>
  );
}
