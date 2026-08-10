import { Package, Trash2, ArrowLeft } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import type { CartLine } from './storefrontTypes';
import { QuantityStepper } from './QuantityStepper';

interface CartViewProps {
  items: CartLine[];
  currency: string;
  onQtyChange: (productId: number, quantity: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
  onBack: () => void;
}

const BRAND = 'var(--primary-solid)';

/** Full-page cart — part of the multi-page shop → cart → checkout → confirmation flow. */
export function CartView({ items, currency, onQtyChange, onRemove, onCheckout, onBack }: CartViewProps) {
  const subtotal = items.reduce((sum, l) => sum + l.product.price * l.quantity, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Your cart</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ marginBottom: '12px' }}>Your cart is empty.</div>
            <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600, textDecoration: 'underline' }}>Browse the shop</button>
          </div>
        ) : (
          items.map((l) => (
            <div key={l.product.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '10px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', background: '#E5E7EB', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {l.product.photoUrl
                  ? <img src={l.product.photoUrl} alt={l.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Package size={20} style={{ color: '#9CA3AF' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{l.product.name}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>{formatMoney(l.product.price, currency)}</div>
                <div style={{ marginTop: '8px' }}>
                  <QuantityStepper quantity={l.quantity} onChange={(q) => onQtyChange(l.product.id, q)} min={0} size="sm" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch' }}>
                <button aria-label="Remove" onClick={() => onRemove(l.product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C' }}><Trash2 size={16} /></button>
                <div style={{ fontSize: '14px', fontWeight: 700 }}>{formatMoney(l.product.price * l.quantity, currency)}</div>
              </div>
            </div>
          ))
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
