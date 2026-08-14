import { useState } from 'react';
import { CheckCircle2, MessageCircle, Copy, Check } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import { orderSummaryLines, waLink, type WaOrderSection } from '../../lib/whatsapp';
import { OrderStatusBadge } from '../StatusBadge';
import type { PublicStoreResponse, GuestCheckoutResult, GuestCheckoutOrderSummary, OrderStatus } from '../../lib/api';

interface OrderConfirmationViewProps {
  result: GuestCheckoutResult;
  store: PublicStoreResponse;
  onBackToShop: () => void;
  /** Heading over the receipt — "Order placed!" post-checkout, "Your order" on recall/lookup. */
  heading?: string;
}

const ORDER_STATUSES: readonly string[] = [
  'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED',
];

/** The public result types status as a plain string; narrow it for the badge, defaulting to PENDING. */
function toOrderStatus(status: string): OrderStatus {
  return (ORDER_STATUSES.includes(status) ? status : 'PENDING') as OrderStatus;
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
  const sections: WaOrderSection[] = resolveOrders(result).map((o) => ({
    orderId: o.orderId,
    label: kindLabel(o.kind),
    items: o.items,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    discountAmount: o.discountAmount,
    totalAmount: o.totalAmount,
  }));
  const lines = [`Hi ${result.storeName}! I've placed an order.`, ''];
  lines.push(...orderSummaryLines(sections, store.currency, {
    subtotal: result.subtotal,
    deliveryFee: result.deliveryFee,
    deliveryFeePending: result.deliveryFeePending,
    discountAmount: result.discountAmount,
    discountCode: result.discountCode,
    totalAmount: result.totalAmount,
  }));
  lines.push('');
  lines.push(`Fulfilment: ${result.fulfilmentMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}`);
  if (result.fulfilmentMethod === 'DELIVERY' && result.deliveryAddress) lines.push(`Address: ${result.deliveryAddress}`);
  if (result.paymentMethod) lines.push(`Payment: ${result.paymentMethod}`);
  lines.push(`Name: ${result.customerName}`);

  return waLink(result.storePhone || store.phoneNumber, lines.join('\n'));
}

export function OrderConfirmationView({ result, store, onBackToShop, heading = 'Order placed!' }: OrderConfirmationViewProps) {
  const accent = 'var(--primary-solid)'; // brand-black button, not the store theme
  const currency = store.currency;
  const waUrl = whatsappUrl(result, store);
  const orders = resolveOrders(result);
  const split = orders.length > 1;

  const [copied, setCopied] = useState(false);
  const orderNumbers = orders.map((o) => `#${o.orderId}`).join(split ? ' and ' : '');
  const copyNumbers = async () => {
    try {
      await navigator.clipboard.writeText(orders.map((o) => o.orderId).join(', '));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — the number is on screen to copy manually */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <div style={{ padding: '32px 16px 20px', textAlign: 'center', background: 'white', borderBottom: '1px solid var(--border-subtle)' }}>
        <CheckCircle2 size={48} style={{ color: '#059669', marginBottom: '10px' }} />
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{heading}</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>{result.storeName}</p>

        {/* Prominent, copyable order number(s) — the one thing a customer must keep. */}
        <div style={{ marginTop: '16px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#F9FAFB', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px 22px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {split ? 'Your order numbers' : 'Your order number'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '26px', fontWeight: 800 }}>{orderNumbers}</span>
            <button onClick={copyNumbers} aria-label="Copy order number"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '32px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border-subtle)', background: 'white', color: copied ? '#047857' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
            </button>
          </div>
          {!split && <OrderStatusBadge status={toOrderStatus(orders[0].orderStatus)} />}
        </div>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px', maxWidth: '300px', marginInline: 'auto' }}>
          Save your order number — you’ll need it (with your phone) to look up this order later.
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Order #{o.orderId}{label ? ` · ${label}` : ''}</span>
                  <OrderStatusBadge status={toOrderStatus(o.orderStatus)} />
                </div>
              )}
              {o.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{it.quantity} × {it.productName}</span>
                  <span>{formatMoney(it.subtotal, currency)}</span>
                </div>
              ))}
              {split && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '6px', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <Row label="Subtotal" value={formatMoney(o.subtotal, currency)} />
                  {o.deliveryFee > 0 && <Row label="Delivery fee" value={formatMoney(o.deliveryFee, currency)} />}
                  {o.discountAmount > 0 && <Row label={`Discount${result.discountCode ? ` (${result.discountCode})` : ''}`} value={`− ${formatMoney(o.discountAmount, currency)}`} accent="#065F46" />}
                  <Row label="Order total" value={formatMoney(o.totalAmount, currency)} bold />
                </div>
              )}
            </section>
          );
        })}

        {/* Combined breakdown */}
        <section style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <Row label="Subtotal" value={formatMoney(result.subtotal, currency)} />
          {result.deliveryFeePending
            ? <Row label="Delivery fee" value="To be confirmed" accent="#92400E" />
            : result.deliveryFee > 0 && <Row label="Delivery fee" value={formatMoney(result.deliveryFee, currency)} />}
          {result.discountAmount > 0 && <Row label={`Discount (${result.discountCode})`} value={`− ${formatMoney(result.discountAmount, currency)}`} accent="#065F46" />}
          <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '4px', paddingTop: '8px' }}>
            <Row label={result.deliveryFeePending ? 'Estimated total' : split ? 'Combined total' : 'Total'} value={formatMoney(result.totalAmount, currency)} bold />
          </div>
          {result.deliveryFeePending && (
            <p style={{ fontSize: '11px', color: '#92400E', margin: '4px 0 0' }}>
              The delivery fee will be confirmed by the seller over WhatsApp.
            </p>
          )}
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
