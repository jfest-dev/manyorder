import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { storefrontApi, ApiError, type TrackingResult, type OrderStatus } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { OrderStatusBadge } from '../StatusBadge';

const ORDER_STATUSES: readonly string[] = [
  'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED',
];
function toOrderStatus(status: string): OrderStatus {
  return (ORDER_STATUSES.includes(status) ? status : 'PENDING') as OrderStatus;
}
function kindLabel(kind: string): string | null {
  return kind === 'READY' ? 'Ready now' : kind === 'PREORDER' ? 'Pre-order' : null;
}

/** Adds a <meta name> to <head> for the lifetime of the component, then removes it. */
function useHeadMeta(name: string, content: string) {
  useEffect(() => {
    const el = document.createElement('meta');
    el.setAttribute('name', name);
    el.setAttribute('content', content);
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [name, content]);
}

/**
 * Public order-status page reached by a private tracking link (/track/:token).
 * noindex keeps the link out of search engines; no-referrer stops the token
 * leaking to other sites via the Referer header. The token is never logged.
 * Status refreshes every 60 seconds; a failed refresh keeps the last good view.
 */
export function TrackOrderView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackingResult | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');

  useHeadMeta('robots', 'noindex, nofollow');
  useHeadMeta('referrer', 'no-referrer');

  const load = useCallback(async (initial: boolean) => {
    if (!token) { setState('notfound'); return; }
    if (initial) setState('loading');
    try {
      const res = await storefrontApi.trackOrder(token);
      setData(res);
      setState('ok');
    } catch (e) {
      // Never log the token (or the error, which could echo the URL).
      if (e instanceof ApiError && e.status === 404) setState('notfound');
      else if (initial) setState('error');
      // A background-refresh failure keeps the last good data on screen.
    }
  }, [token]);

  useEffect(() => { load(true); }, [load]);
  useEffect(() => {
    const id = window.setInterval(() => load(false), 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100%', background: '#F3F4F6', padding: '24px 16px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>{children}</div>
    </div>
  );

  if (state === 'loading') {
    return wrap(<p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading your order…</p>);
  }
  if (state === 'notfound') {
    return wrap(
      <div style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>Order not found</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)', margin: 0 }}>
          This tracking link is not valid. You can still find your order with your order number and phone number using Find my order.
        </p>
      </div>,
    );
  }
  if (state === 'error' || !data) {
    return wrap(
      <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
        We could not load your order right now. Please try again in a moment.
      </p>,
    );
  }

  const money = (n: number) => formatMoney(n, data.currency);

  return wrap(
    <>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Your order</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{data.storeName}</p>
      </div>

      {data.orders.map((o) => {
        const label = kindLabel(o.kind);
        return (
          <section key={o.orderNumber} style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Order #{o.orderNumber}{label ? ` · ${label}` : ''}</span>
              <OrderStatusBadge status={toOrderStatus(o.status)} />
            </div>
            {o.items.map((it, i) => (
              <div key={i} style={{ padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span className="text-small">{it.quantity} x {it.name}</span>
                  <span className="text-small" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{money(it.lineSubtotal)}</span>
                </div>
                {it.modifiers.length > 0 && (
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {it.modifiers.map((m) => m.optionName).join(', ')}
                  </div>
                )}
                {it.notes && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Note: {it.notes}</div>}
              </div>
            ))}
          </section>
        );
      })}

      <section style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <Row label="Fulfilment" value={data.orderType === 'DELIVERY' ? 'Delivery' : 'Pickup'} />
        <Row label="Subtotal" value={money(data.subtotal)} />
        {data.deliveryFee > 0 && <Row label="Delivery fee" value={money(data.deliveryFee)} />}
        {data.discount > 0 && <Row label="Discount" value={`- ${money(data.discount)}`} />}
        <Row label="Total" value={money(data.total)} strong />
        {data.notes && <Row label="Notes" value={data.notes} />}
      </section>

      <div style={{ textAlign: 'center' }}>
        <a href={data.contactLink} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--primary-solid)', fontWeight: 600, textDecoration: 'none' }}>
          Contact {data.storeName}
        </a>
      </div>
    </>,
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-small" style={{ fontWeight: strong ? 700 : 400, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
