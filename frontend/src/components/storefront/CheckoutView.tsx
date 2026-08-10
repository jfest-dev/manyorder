import { useMemo, useState } from 'react';
import { ArrowLeft, Tag } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import {
  storefrontApi, ApiError,
  type PublicStoreResponse, type GuestCheckoutResult, type FulfilmentMethod,
} from '../../lib/api';
import type { CartLine } from './storefrontTypes';

interface CheckoutViewProps {
  store: PublicStoreResponse;
  items: CartLine[];
  onBack: () => void;
  onPlaced: (result: GuestCheckoutResult) => void;
}

const PAYMENT_METHODS = ['PayNow', 'Cash', 'Bank Transfer'];

export function CheckoutView({ store, items, onBack, onPlaced }: CheckoutViewProps) {
  // Buttons/selection controls use the fixed brand colour, not the store theme.
  const accent = 'var(--primary-solid)';
  const currency = store.currency;

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>('PICKUP');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);

  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => items.reduce((s, l) => s + l.product.price * l.quantity, 0), [items]);
  const deliveryFee = fulfilment === 'DELIVERY' && store.deliveryFee ? store.deliveryFee : 0;
  const discount = applied?.amount ?? 0;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const applyCode = async () => {
    if (!code.trim()) return;
    setCheckingCode(true);
    setDiscountError(null);
    try {
      const res = await storefrontApi.validateDiscount({ merchantId: store.id, code: code.trim(), subtotal });
      setApplied({ code: res.code, amount: res.discountAmount });
    } catch (e) {
      setApplied(null);
      setDiscountError(e instanceof ApiError ? e.message : 'Could not apply that code.');
    } finally {
      setCheckingCode(false);
    }
  };

  const clearCode = () => { setApplied(null); setCode(''); setDiscountError(null); };

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError('Please enter your name.'); return; }
    if (phone.replace(/\D/g, '').length < 7) { setError('Please enter a valid phone number.'); return; }
    if (fulfilment === 'DELIVERY' && !address.trim()) { setError('Please enter a delivery address.'); return; }

    setSubmitting(true);
    try {
      const result = await storefrontApi.checkout({
        merchantId: store.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
        fulfilmentMethod: fulfilment,
        deliveryAddress: fulfilment === 'DELIVERY' ? address.trim() : undefined,
        notes: notes.trim() || undefined,
        paymentMethod,
        discountCode: applied?.code,
        items: items.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      });
      onPlaced(result);
    } catch (e) {
      // A code can go stale between apply and submit; surface it and let them retry.
      setError(e instanceof ApiError ? e.message : 'Could not place your order. Please try again.');
      setSubmitting(false);
    }
  };

  const labelStyle = { fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' } as const;
  const inputStyle = { width: '100%', height: '42px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'white', fontSize: '14px', outline: 'none' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Checkout</h1>
      </div>

      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Contact */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={labelStyle}>Name *</label><input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
          <div><label style={labelStyle}>Phone *</label><input style={inputStyle} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s]/g, ''))} placeholder="8123 4567" /></div>
          <div><label style={labelStyle}>Email (optional)</label><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        </section>

        {/* Fulfilment */}
        <section>
          <label style={labelStyle}>How would you like to get it?</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['PICKUP', 'DELIVERY'] as FulfilmentMethod[]).map((m) => {
              const on = fulfilment === m;
              return (
                <button key={m} onClick={() => setFulfilment(m)}
                  style={{ flex: 1, height: '42px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: on ? 600 : 500,
                    border: on ? `1px solid ${accent}` : '1px solid var(--border-subtle)', background: on ? accent : 'white', color: on ? 'white' : 'var(--text-secondary)' }}>
                  {m === 'PICKUP' ? 'Pickup' : 'Delivery'}
                </button>
              );
            })}
          </div>
          {fulfilment === 'DELIVERY' && (
            <div style={{ marginTop: '10px' }}>
              <label style={labelStyle}>Delivery address *</label>
              <textarea style={{ ...inputStyle, height: '64px', padding: '10px 12px', resize: 'vertical' }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Unit, street, postal code" />
            </div>
          )}
        </section>

        {/* Notes */}
        <section>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea style={{ ...inputStyle, height: '56px', padding: '10px 12px', resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requests?" />
        </section>

        {/* Payment method */}
        <section>
          <label style={labelStyle}>Payment method</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {PAYMENT_METHODS.map((m) => {
              const on = paymentMethod === m;
              return (
                <button key={m} onClick={() => setPaymentMethod(m)}
                  style={{ flex: '1 1 30%', height: '40px', borderRadius: '10px', cursor: 'pointer', fontSize: '12.5px', fontWeight: on ? 600 : 500,
                    border: on ? `1px solid ${accent}` : '1px solid var(--border-subtle)', background: on ? accent : 'white', color: on ? 'white' : 'var(--text-secondary)' }}>
                  {m}
                </button>
              );
            })}
          </div>
          {store.paymentInstruction && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '10px 12px', marginTop: '10px', whiteSpace: 'pre-wrap' }}>
              {store.paymentInstruction}
            </p>
          )}
        </section>

        {/* Promo code */}
        <section>
          <label style={labelStyle}>Promo code</label>
          {applied ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '10px 12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#065F46', fontWeight: 600 }}>
                <Tag size={14} /> {applied.code} applied
              </span>
              <button onClick={clearCode} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46', fontSize: '12px', textDecoration: 'underline' }}>Remove</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={inputStyle} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(); } }} />
              <button onClick={applyCode} disabled={checkingCode || !code.trim()}
                style={{ flexShrink: 0, padding: '0 16px', borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'white', cursor: checkingCode || !code.trim() ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                {checkingCode ? '…' : 'Apply'}
              </button>
            </div>
          )}
          {discountError && <p style={{ fontSize: '12px', color: '#B91C1C', marginTop: '6px' }}>{discountError}</p>}
        </section>

        {/* Summary */}
        <section style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
          <Row label="Subtotal" value={formatMoney(subtotal, currency)} />
          {deliveryFee > 0 && <Row label="Delivery fee" value={formatMoney(deliveryFee, currency)} />}
          {discount > 0 && <Row label={`Discount (${applied?.code})`} value={`− ${formatMoney(discount, currency)}`} accent="#065F46" />}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '8px' }}>
            <Row label="Total" value={formatMoney(total, currency)} bold />
          </div>
        </section>

        {error && <p style={{ fontSize: '13px', color: '#B91C1C' }}>{error}</p>}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '16px', background: 'white', borderTop: '1px solid var(--border-subtle)' }}>
        <button onClick={submit} disabled={submitting}
          style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', background: accent, color: 'white', fontSize: '15px', fontWeight: 700, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Placing order…' : `Place order · ${formatMoney(total, currency)}`}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? '15px' : '13px', marginBottom: '4px' }}>
      <span style={{ color: accent || 'var(--text-secondary)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ color: accent || 'var(--text-primary)', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}
