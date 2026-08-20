import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Tag, Clock } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import { formatPreorderReady } from '../../lib/datetime';
import { saveRecentOrder } from '../../lib/orderRecall';
import { DEFAULT_DELIVERY_TBC_MESSAGE } from '../../lib/delivery';
import { NoteBlock } from '../NoteBlock';
import {
  storefrontApi, ApiError,
  type PublicStoreResponse, type GuestCheckoutResult, type FulfilmentMethod,
} from '../../lib/api';
import type { CartLine } from './storefrontTypes';
import { cartLineToCheckoutItem } from '../../lib/cart';

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

  // Persist the in-progress form so navigating back to the cart and returning
  // doesn't wipe what the customer typed. Per store, cleared once the order is placed.
  const formKey = `manyorder_checkout_${store.id}`;
  const saved = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem(formKey) || '{}'); } catch { return {}; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formKey]);

  const [name, setName] = useState<string>(saved.name ?? '');
  const [phone, setPhone] = useState<string>(saved.phone ?? '');
  const [email, setEmail] = useState<string>(saved.email ?? '');
  // The store may offer only pickup or only delivery - restrict the choice
  // accordingly, and default to the sole option when there's just one.
  const allowedFulfilment: FulfilmentMethod[] =
    store.fulfilmentMode === 'PICKUP_ONLY' ? ['PICKUP']
    : store.fulfilmentMode === 'DELIVERY_ONLY' ? ['DELIVERY']
    : ['PICKUP', 'DELIVERY'];
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>(() => {
    const initial = saved.fulfilment ?? (allowedFulfilment[0]);
    return allowedFulfilment.includes(initial) ? initial : allowedFulfilment[0];
  });
  // Coerce a persisted choice that's no longer allowed (e.g. store switched to delivery-only).
  useEffect(() => {
    if (!allowedFulfilment.includes(fulfilment)) setFulfilment(allowedFulfilment[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.fulfilmentMode]);
  const [address, setAddress] = useState<string>(saved.address ?? '');
  const [notes, setNotes] = useState<string>(saved.notes ?? '');
  const [paymentMethod, setPaymentMethod] = useState<string>(saved.paymentMethod ?? PAYMENT_METHODS[0]);

  useEffect(() => {
    sessionStorage.setItem(formKey, JSON.stringify({ name, phone, email, fulfilment, address, notes, paymentMethod }));
  }, [formKey, name, phone, email, fulfilment, address, notes, paymentMethod]);

  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ code: string; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => items.reduce((s, l) => s + l.lineSubtotal, 0), [items]);
  // Preview the split: ready (in-stock) vs pre-order lines. Two non-empty groups
  // means the checkout will produce two separate orders.
  const readyLines = useMemo(() => items.filter((l) => !l.product.preOrder), [items]);
  const preorderLines = useMemo(() => items.filter((l) => l.product.preOrder), [items]);
  const willSplit = readyLines.length > 0 && preorderLines.length > 0;
  const discount = applied?.amount ?? 0;

  // Delivery fee: unset (not configured) → "to be confirmed" (estimate); a set
  // fee is waived at/above the free-delivery threshold; explicit 0 = free.
  const isDelivery = fulfilment === 'DELIVERY';
  const deliveryPending = isDelivery && !store.deliveryFeeConfigured;
  const freeByThreshold = isDelivery && store.deliveryFeeConfigured
    && store.freeDeliveryThreshold != null && subtotal >= store.freeDeliveryThreshold;
  const deliveryFee = (isDelivery && store.deliveryFeeConfigured && !freeByThreshold)
    ? (store.deliveryFee ?? 0) : 0;
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
        items: items.map(cartLineToCheckoutItem),
      });
      sessionStorage.removeItem(formKey); // order placed - don't restore the stale form
      saveRecentOrder(store.id, { orderId: result.orderId, phone: phone.trim() }); // device-local recall
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
      <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '12px 16px', background: 'white', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          {allowedFulfilment.length > 1 ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              {allowedFulfilment.map((m) => {
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
          ) : (
            <div style={{ height: '42px', borderRadius: '10px', border: `1px solid ${accent}`, background: accent, color: 'white', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {fulfilment === 'PICKUP' ? 'Pickup only' : 'Delivery only'}
            </div>
          )}
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
          <textarea style={{ ...inputStyle, height: '72px', padding: '10px 12px', lineHeight: 1.5, resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any special requests?" />
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
            <div style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '12px', marginTop: '10px' }}>
              <NoteBlock label="How to pay">{store.paymentInstruction}</NoteBlock>
            </div>
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

        {/* Split preview - a mixed cart becomes two orders. */}
        {willSplit && (
          <section style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#92400E', background: '#FEF3C7', borderRadius: '8px', padding: '8px 10px', marginBottom: '12px' }}>
              <Clock size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>This checkout will be placed as <strong>2 separate orders</strong>. Your ready items and your pre-order items are fulfilled at different times.</span>
            </div>
            <SplitGroup title="Ready now" lines={readyLines} currency={currency} />
            <div style={{ height: '10px' }} />
            <SplitGroup title="Pre-order" lines={preorderLines} currency={currency} showReady />
          </section>
        )}

        {/* Summary */}
        <section style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
          <Row label="Subtotal" value={formatMoney(subtotal, currency)} />
          {isDelivery && (
            deliveryPending
              ? <Row label="Delivery fee" value="To be confirmed" accent="#92400E" />
              : freeByThreshold
                ? <Row label="Delivery fee" value="Free" accent="#065F46" />
                : deliveryFee > 0 && <Row label="Delivery fee" value={formatMoney(deliveryFee, currency)} />
          )}
          {discount > 0 && <Row label={`Discount (${applied?.code})`} value={`− ${formatMoney(discount, currency)}`} accent="#065F46" />}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '8px' }}>
            <Row label={deliveryPending ? 'Estimated total' : 'Total'} value={formatMoney(total, currency)} bold />
          </div>
          {deliveryPending && (
            <div style={{ marginTop: '8px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 10px' }}>
              <p style={{ fontSize: '12px', color: '#92400E', margin: 0, lineHeight: 1.45 }}>
                {store.deliveryToBeConfirmedMessage?.trim() || DEFAULT_DELIVERY_TBC_MESSAGE}
              </p>
            </div>
          )}
        </section>

        {error && <p style={{ fontSize: '13px', color: '#B91C1C' }}>{error}</p>}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '16px', background: 'white', borderTop: '1px solid var(--border-subtle)' }}>
        <button onClick={submit} disabled={submitting}
          style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', background: accent, color: 'white', fontSize: '15px', fontWeight: 700, opacity: submitting ? 0.7 : 1 }}>
          {submitting ? 'Placing order…' : `Place order · ${formatMoney(total, currency)}${deliveryPending ? ' (est.)' : ''}`}
        </button>
      </div>
    </div>
  );
}

function SplitGroup({ title, lines, currency, showReady }: { title: string; lines: CartLine[]; currency: string; showReady?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>{title}</div>
      {lines.map((l) => {
        const ready = showReady
          ? formatPreorderReady(l.product.preOrderReadyDate, l.product.preOrderReadyTimeStart, l.product.preOrderReadyTimeEnd)
          : null;
        return (
          <div key={l.signature} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px', gap: '10px' }}>
            <span style={{ color: 'var(--text-secondary)', minWidth: 0 }}>
              {l.quantity} × {l.product.name}
              {ready && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> · ready {ready}</span>}
              {l.selectedOptions.length > 0 && (
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> · {l.selectedOptions.map((o) => o.optionName).join(', ')}</span>
              )}
              {l.notes && <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic' }}> · “{l.notes}”</span>}
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>{formatMoney(l.lineSubtotal, currency)}</span>
          </div>
        );
      })}
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
