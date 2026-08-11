import { CheckCircle2, MessageCircle } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import type { PublicStoreResponse, GuestCheckoutResult, GuestCheckoutOrderSummary } from '../../lib/api';

interface OrderConfirmationViewProps {
  result: GuestCheckoutResult;
  store: PublicStoreResponse;
  onBackToShop: () => void;
}

function kindLabel(kind: GuestCheckoutOrderSummary['kind']): string | null {
  return kind === 'READY' ? 'Ready now' : kind === 'PREORDER' ? 'Pre-order' : null;
}

/**
 * The per-order list, tolerating a response that omits `orders` (e.g. an older
 * backend) by synthesizing one STANDARD order from the top-level fields — so a
 * shape mismatch degrades gracefully instead of crashing.
 */
function resolveOrders(result: GuestCheckoutResult): GuestCheckoutOrderSummary[] {
  if (result.orders && result.orders.length > 0) return result.orders;
  return [{
    orderId: result.orderId,
    kind: 'STANDARD',
    orderStatus: result.orderStatus,
    paymentStatus: result.paymentStatus,
    subtotal: result.subtotal,
    deliveryFee: result.deliveryFee,
    discountAmount: result.discountAmount,
    totalAmount: result.totalAmount,
    items: result.items ?? [],
  }];
}

/**
 * Build the wa.me handoff message. The order is already saved — this is a relay.
 * A split checkout lists each order as its own section, then one combined total.
 */
function whatsappUrl(result: GuestCheckoutResult, store: PublicStoreResponse): string | null {
  const raw = result.storePhone || store.phoneNumber;
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  const c = store.currency;
  const orders = resolveOrders(result);
  const split = orders.length > 1;
  const lines: string[] = [];
  lines.push(`Hi ${result.storeName}! I've placed an order.`);
  lines.push('');
  orders.forEach((o) => {
    const label = kindLabel(o.kind);
    lines.push(label ? `Order #${o.orderId} — ${label}` : `Order #${o.orderId}`);
    o.items.forEach((it) => lines.push(`• ${it.quantity} × ${it.productName}: ${formatMoney(it.subtotal, c)}`));
    if (split) lines.push(`Order total: ${formatMoney(o.totalAmount, c)}`);
    lines.push('');
  });
  lines.push(`Subtotal: ${formatMoney(result.subtotal, c)}`);
  if (result.deliveryFee > 0) lines.push(`Delivery fee: ${formatMoney(result.deliveryFee, c)}`);
  if (result.discountAmount > 0) lines.push(`Discount (${result.discountCode}): ${formatMoney(result.discountAmount, c)} off`);
  lines.push(`${split ? 'Combined total' : 'Total'}: ${formatMoney(result.totalAmount, c)}`);
  lines.push('');
  lines.push(`Fulfilment: ${result.fulfilmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}`);
  if (result.fulfilmentMethod === 'DELIVERY' && result.deliveryAddress) lines.push(`Address: ${result.deliveryAddress}`);
  if (result.paymentMethod) lines.push(`Payment: ${result.paymentMethod}`);
  lines.push(`Name: ${result.customerName}`);

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function OrderConfirmationView({ result, store, onBackToShop }: OrderConfirmationViewProps) {
  const accent = 'var(--primary-solid)'; // brand-black button, not the store theme
  const currency = store.currency;
  const waUrl = whatsappUrl(result, store);
  const orders = resolveOrders(result);
  const split = orders.length > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <div style={{ padding: '32px 16px 20px', textAlign: 'center', background: 'white', borderBottom: '1px solid var(--border-subtle)' }}>
        <CheckCircle2 size={48} style={{ color: '#059669', marginBottom: '10px' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Order placed!</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          {split ? `${orders.length} orders` : `Order #${result.orderId}`} · {result.storeName}
        </p>
      </div>

      <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {split && (
          <p style={{ fontSize: '12px', color: '#92400E', margin: 0, background: '#FEF3C7', borderRadius: '8px', padding: '8px 10px' }}>
            Your checkout was placed as 2 separate orders — ready items and pre-order items are fulfilled at different times.
          </p>
        )}

        {/* Per-order items (one section normally, two when split) */}
        {orders.map((o) => {
          const label = kindLabel(o.kind);
          return (
            <section key={o.orderId} style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
              {split && (
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Order #{o.orderId}{label ? ` · ${label}` : ''}
                </div>
              )}
              {o.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{it.quantity} × {it.productName}</span>
                  <span>{formatMoney(it.subtotal, currency)}</span>
                </div>
              ))}
              {split && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '6px', paddingTop: '6px' }}>
                  <Row label="Order total" value={formatMoney(o.totalAmount, currency)} bold />
                </div>
              )}
            </section>
          );
        })}

        {/* Combined breakdown */}
        <section style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Row label="Subtotal" value={formatMoney(result.subtotal, currency)} />
          {result.deliveryFee > 0 && <Row label="Delivery fee" value={formatMoney(result.deliveryFee, currency)} />}
          {result.discountAmount > 0 && <Row label={`Discount (${result.discountCode})`} value={`− ${formatMoney(result.discountAmount, currency)}`} accent="#065F46" />}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '8px' }}>
            <Row label={split ? 'Combined total' : 'Total'} value={formatMoney(result.totalAmount, currency)} bold />
          </div>
        </section>

        {/* Payment */}
        {(result.paymentMethod || result.paymentInstruction) && (
          <section style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Payment</div>
            {result.paymentMethod && <div style={{ fontSize: '14px', fontWeight: 600 }}>{result.paymentMethod}</div>}
            {result.paymentInstruction && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{result.paymentInstruction}</p>}
          </section>
        )}

        {waUrl && (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
            Send your order to the store on WhatsApp so they can confirm it.
          </p>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: 0, padding: '16px', background: 'white', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            style={{ height: '48px', borderRadius: '12px', background: '#25D366', color: 'white', fontSize: '15px', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <MessageCircle size={18} /> Message on WhatsApp
          </a>
        )}
        <button onClick={onBackToShop}
          style={{ height: '44px', borderRadius: '12px', border: `1px solid ${accent}`, background: 'white', color: accent, fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
          Back to shop
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? '15px' : '13px' }}>
      <span style={{ color: accent || 'var(--text-secondary)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ color: accent || 'var(--text-primary)', fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}
