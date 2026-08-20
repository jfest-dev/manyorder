import { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { storefrontApi, ApiError, type PublicStoreResponse, type GuestCheckoutResult } from '../../lib/api';
import { OrderConfirmationView } from './OrderConfirmationView';

interface OrderLookupViewProps {
  store: PublicStoreResponse;
  onBack: () => void;
  onBackToShop: () => void;
  /** Device-local last order, used to pre-fill the form so recall is one tap. */
  initial?: { orderId: number; phone: string } | null;
}

const BRAND = 'var(--primary-solid)';

/**
 * "Find my order" - a customer who navigated away re-opens their confirmation
 * (and the WhatsApp hand-off) with their order number + phone. On success this
 * renders the shared OrderConfirmationView, so a split order looks identical to
 * the post-checkout screen.
 */
export function OrderLookupView({ store, onBack, onBackToShop, initial }: OrderLookupViewProps) {
  const [orderNumber, setOrderNumber] = useState(initial ? String(initial.orderId) : '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuestCheckoutResult | null>(null);

  const submit = async () => {
    setError(null);
    const id = Number(orderNumber.replace(/\D/g, ''));
    if (!id) { setError('Enter your order number.'); return; }
    if (phone.replace(/\D/g, '').length < 7) { setError('Enter the phone number you used at checkout.'); return; }

    setLoading(true);
    try {
      setResult(await storefrontApi.lookupOrder(store.slug, { orderId: id, phone: phone.trim() }));
    } catch (e) {
      setError(e instanceof ApiError
        ? "We couldn't find an order with that number and phone. Please double-check both."
        : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (result) return <OrderConfirmationView result={result} store={store} onBackToShop={onBackToShop} />;

  const inputStyle = { width: '100%', height: '44px', padding: '0 12px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'white', fontSize: '14px', outline: 'none' } as const;
  const labelStyle = { fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '12px 16px', background: 'white', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button onClick={onBack} aria-label="Back" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><ArrowLeft size={20} /></button>
        <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Find my order</h1>
      </div>

      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          Enter your order number and the phone number you used to pull your order back up.
        </p>
        <div>
          <label style={labelStyle}>Order number</label>
          <input style={inputStyle} inputMode="numeric" value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="e.g. 42" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input style={inputStyle} type="tel" inputMode="tel" value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+\-\s]/g, ''))}
            placeholder="8123 4567" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </div>
        {error && <p style={{ fontSize: '13px', color: '#B91C1C', margin: 0 }}>{error}</p>}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '16px', background: 'white', borderTop: '1px solid var(--border-subtle)' }}>
        <button onClick={submit} disabled={loading}
          style={{ width: '100%', height: '48px', borderRadius: '12px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', background: BRAND, color: 'white', fontSize: '15px', fontWeight: 700, opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Search size={17} /> {loading ? 'Looking…' : 'Find order'}
        </button>
      </div>
    </div>
  );
}
