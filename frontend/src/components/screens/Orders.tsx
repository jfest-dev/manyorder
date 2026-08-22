import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Plus, Search, MessageCircle } from 'lucide-react';
import { Button } from '../Button';
import { ordersApi, OrderResponse, OrderStatus, PaymentStatus, OrderType } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { orderSummaryLines, waLink, type WaOrderSection } from '../../lib/whatsapp';
import type { Store } from '../../App';

interface OrdersProps {
  store: Store;
  onNavigate: (screen: string) => void;
  initialStatus?: OrderStatus | 'ALL';
  canEdit?: boolean;
  onEditOrder?: (orderId: number) => void;
}

const STATUS_TABS: (OrderStatus | 'ALL')[] = [
  'ALL', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY',
  'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED',
];

const STATUS_LABEL: Record<string, string> = {
  ALL: 'All', PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing',
  READY: 'Ready', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};

const STATUS_STYLE: Record<OrderStatus, { bg: string; fg: string }> = {
  PENDING: { bg: '#FFF7ED', fg: '#C2410C' },
  CONFIRMED: { bg: '#EFF6FF', fg: '#1D4ED8' },
  PREPARING: { bg: '#EEF2FF', fg: '#4338CA' },
  READY: { bg: '#F5F3FF', fg: '#6D28D9' },
  OUT_FOR_DELIVERY: { bg: '#ECFEFF', fg: '#0E7490' },
  DELIVERED: { bg: '#F0FDF4', fg: '#15803D' },
  COMPLETED: { bg: '#ECFDF5', fg: '#047857' },
  CANCELLED: { bg: '#FEF2F2', fg: '#B91C1C' },
};

const PAYMENT_STYLE: Record<PaymentStatus, { bg: string; fg: string }> = {
  PAID: { bg: '#ECFDF5', fg: '#047857' },
  UNPAID: { bg: '#FFF7ED', fg: '#C2410C' },
  REFUNDED: { bg: '#F1F5F9', fg: '#475569' },
};

/** Mirrors the server-side state machine for UX; the API remains the enforcer. */
const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['COMPLETED', 'OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      className="text-xs"
      style={{ background: bg, color: fg, padding: '4px 10px', borderRadius: 'var(--radius-pill)', fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      {text}
    </span>
  );
}

/** A money line in the order breakdown (subtotal / delivery / discount). */
function BreakdownRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-small" style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: accent || 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: accent || 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

/** A labeled detail row (Contact / Fulfilment / Payment / Notes) with a fixed-
 *  width label column, so values line up and read clearly. */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <span className="text-xs" style={{ width: '84px', flexShrink: 0, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.02em', paddingTop: '1px' }}>{label}</span>
      <div className="text-small" style={{ color: 'var(--text-primary)', minWidth: 0 }}>{value}</div>
    </div>
  );
}

export function Orders({ store, onNavigate, initialStatus = 'ALL', canEdit = false, onEditOrder }: OrdersProps) {
  const storeId = Number(store.id);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OrderStatus | 'ALL'>(initialStatus);
  const [query, setQuery] = useState('');
  // Each row toggles its OWN expand/collapse; several can stay open at once, and
  // clicking elsewhere never closes them (same model as the sidebar submenus).
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      setOrders(await ordersApi.list(storeId));
    } catch (e: any) {
      alert(e?.message || 'Could not load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Search across every human-visible field: order number (with/without '#'),
  // customer name, phone, product names, the status label (Pending … Cancelled),
  // and payment status (Unpaid / Paid / Refunded). Status is included both
  // as-shown and collapsed, so "out for delivery" and "outfordelivery" both match.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== 'ALL' && o.status !== tab) return false;
      if (!q) return true;
      const status = STATUS_LABEL[o.status] || o.status;
      const haystack = [
        String(o.id), `#${o.id}`,
        o.contactName, o.contactPhone,
        status, status.replace(/[\s-]/g, ''),
        o.paymentStatus,
        ...o.items.map((i) => i.productName),
      ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return haystack.some((h) => h.includes(q));
    });
  }, [orders, tab, query]);

  const applyUpdated = (updated: OrderResponse) =>
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  const changeStatus = async (order: OrderResponse, status: OrderStatus) => {
    // Cancelling is destructive and can't be undone - confirm before it takes effect.
    if (status === 'CANCELLED' &&
        !window.confirm(`Cancel order #${order.id}? This can't be undone and the customer's order will be marked cancelled.`)) {
      return;
    }
    setBusyOrderId(order.id);
    try {
      applyUpdated(await ordersApi.updateStatus(storeId, order.id, status));
    } catch (e: any) {
      alert(e?.message || 'Status update failed');
    } finally {
      setBusyOrderId(null);
    }
  };

  const changePayment = async (order: OrderResponse, paymentStatus: PaymentStatus) => {
    if (paymentStatus === order.paymentStatus) return;
    setBusyOrderId(order.id);
    try {
      applyUpdated(await ordersApi.updatePaymentStatus(storeId, order.id, paymentStatus));
    } catch (e: any) {
      alert(e?.message || 'Payment update failed');
    } finally {
      setBusyOrderId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Order', 'Customer', 'Phone', 'Total', 'Payment', 'Status', 'Items', 'Created'],
      ...filtered.map((o) => [
        `#${o.id}`,
        o.contactName || '',
        o.contactPhone || '',
        String(o.totalAmount),
        o.paymentStatus,
        o.status,
        o.items.map((i) => `${i.productName} x${i.quantity}`).join('; '),
        o.createdAt,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${store.slug}-orders.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' });

  const fulfilmentLabel = (t: OrderType) => (t === 'DELIVERY' ? 'Delivery' : 'Pickup');

  // One combined WhatsApp message to the customer covering every order in the
  // group. A split checkout is two linked orders sharing an orderGroupId, so a
  // grouped order messages all its siblings as one summary (reusing the shared
  // "one message, sections + combined totals" builder).
  const messageCustomerUrl = (order: OrderResponse): string | null => {
    const group = order.orderGroupId
      ? orders.filter((o) => o.orderGroupId === order.orderGroupId).sort((a, b) => a.id - b.id)
      : [order];
    const sections: WaOrderSection[] = group.map((o) => ({
      orderId: o.id,
      label: null,
      items: o.items.map((it) => ({ quantity: it.quantity, productName: it.productName, subtotal: it.lineSubtotal, modifiers: it.modifiers, notes: it.notes })),
      subtotal: o.subtotal,
      deliveryFee: o.deliveryFee,
      discountAmount: o.discountAmount,
      totalAmount: o.totalAmount,
    }));
    const combined = {
      subtotal: group.reduce((n, o) => n + o.subtotal, 0),
      deliveryFee: group.reduce((n, o) => n + o.deliveryFee, 0),
      deliveryFeePending: group.some((o) => o.deliveryFeePending),
      discountAmount: group.reduce((n, o) => n + o.discountAmount, 0),
      discountCode: group.find((o) => o.discountCode)?.discountCode ?? null,
      totalAmount: group.reduce((n, o) => n + o.totalAmount, 0),
    };
    const name = order.contactName || order.customerName || '';
    const lines = [name ? `Hi ${name}! Here's your order with ${store.name}:` : `Your order with ${store.name}:`, ''];
    lines.push(...orderSummaryLines(sections, store.currency, combined));
    lines.push('');
    lines.push(`Fulfilment: ${fulfilmentLabel(order.orderType)}`);
    if (order.orderType === 'DELIVERY' && order.deliveryAddress) lines.push(`Address: ${order.deliveryAddress}`);
    return waLink(order.contactPhone, lines.join('\n'));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Orders</h1>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Manage and track all customer orders
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate('orders-add')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Add Order
          </div>
        </Button>
      </div>

      {/* Search + filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 320px', minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by order #, customer, product, status or payment"
            style={{
              width: '100%', padding: '10px 14px 10px 40px',
              borderRadius: 'var(--radius-field)', border: '1px solid var(--border-strong)',
              background: 'var(--bg-card)', fontSize: '14px', outline: 'none',
            }}
          />
        </div>
        <Button variant="secondary" onClick={exportCsv}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={15} />
            Export
          </div>
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {STATUS_TABS.map((s) => {
          const active = tab === s;
          const count = s === 'ALL' ? orders.length : orders.filter((o) => o.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className="text-small"
              style={{
                padding: '8px 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                border: active ? '1px solid var(--primary-solid)' : '1px solid var(--border-strong)',
                background: active ? 'var(--primary-solid)' : 'var(--bg-card)',
                color: active ? 'var(--text-on-dark)' : 'var(--text-primary)', fontWeight: 500,
              }}
            >
              {STATUS_LABEL[s]}{count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-card)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div
          className="text-xs orders-head"
          style={{
            display: 'grid', gridTemplateColumns: '78px 1.2fr 96px 92px 90px 96px 52px 120px 0.9fr 36px',
            gap: '12px', padding: '14px 20px', background: 'var(--bg-card-subtle)',
            color: 'var(--text-secondary)', fontWeight: 600,
          }}
        >
          <span>Order</span><span>Customer</span><span>Fulfilment</span><span>Total</span><span>Payment</span><span>Method</span>
          <span>Items</span><span>Status</span><span>Date</span><span />
        </div>

        {loading ? (
          <p className="text-small" style={{ padding: '32px 20px', color: 'var(--text-secondary)' }}>Loading orders…</p>
        ) : filtered.length === 0 ? (
          <p className="text-small" style={{ padding: '32px 20px', color: 'var(--text-secondary)' }}>
            No orders {tab !== 'ALL' ? `with status ${STATUS_LABEL[tab]}` : 'yet'}.
          </p>
        ) : (
          filtered.map((o) => {
            const expanded = expandedIds.has(o.id);
            const busy = busyOrderId === o.id;
            return (
              <div
                key={o.id}
                style={{ borderTop: '1px solid var(--border-subtle)' }}
              >
                <div
                  onClick={() => toggleExpanded(o.id)}
                  className="orders-row"
                  style={{
                    display: 'grid', gridTemplateColumns: '78px 1.2fr 96px 92px 90px 96px 52px 120px 0.9fr 36px',
                    gap: '12px', padding: '16px 20px', alignItems: 'center', cursor: 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <span className="order-id text-small" style={{ fontWeight: 600 }}>#{o.id}</span>
                  <span className="text-small"><span className="m-label">Customer</span>{o.contactName || o.customerName || '-'}</span>
                  <span><span className="m-label">Fulfilment</span>
                    <span style={{
                      display: 'inline-block', fontSize: '11px', fontWeight: 600,
                      padding: '2px 9px', borderRadius: '999px',
                      background: o.orderType === 'DELIVERY' ? '#EFF6FF' : '#F3F4F6',
                      color: o.orderType === 'DELIVERY' ? '#1D4ED8' : '#4B5563',
                    }}>
                      {fulfilmentLabel(o.orderType)}
                    </span>
                  </span>
                  <span className="text-small" style={{ fontWeight: 600 }}><span className="m-label">Total</span>{formatMoney(o.totalAmount, store.currency)}</span>
                  <span><span className="m-label">Payment</span>
                    <Badge text={o.paymentStatus} {...PAYMENT_STYLE[o.paymentStatus]} />
                  </span>
                  <span className="text-small" style={{ color: 'var(--text-secondary)' }}><span className="m-label">Method</span>{o.paymentMethod || '-'}</span>
                  <span className="text-small"><span className="m-label">Items</span>{o.items.reduce((n, i) => n + i.quantity, 0)}</span>
                  <span><span className="m-label">Status</span><Badge text={STATUS_LABEL[o.status]} {...STATUS_STYLE[o.status]} /></span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}><span className="m-label">Date</span>{fmtDate(o.createdAt)}</span>
                  <span className="order-chevron" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
                    <ChevronDown
                      size={16}
                      style={{
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    />
                  </span>
                </div>

                {expanded && (
                  <div className="orders-detail" style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
                    {/* Items, money breakdown + labeled details */}
                    <div style={{ background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-medium)', padding: '16px' }}>
                      <p className="text-xs" style={{ fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.03em', marginBottom: '10px' }}>ITEMS</p>
                      {o.items.length === 0 && <p className="text-small" style={{ color: 'var(--text-muted)' }}>No line items recorded.</p>}
                      {o.items.map((i, idx) => (
                        <div key={idx} className="text-small" style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0' }}>
                          <span style={{ color: 'var(--text-primary)', minWidth: 0 }}>
                            {i.productName} × {i.quantity}
                            {i.modifiers.length > 0 && (
                              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', marginTop: '1px' }}>
                                {i.modifiers.map((m) => m.optionName).join(', ')}
                              </span>
                            )}
                            {i.notes && (
                              <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '11px', fontStyle: 'italic', marginTop: '1px' }}>“{i.notes}”</span>
                            )}
                          </span>
                          <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatMoney(i.lineSubtotal, store.currency)}</span>
                        </div>
                      ))}

                      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '10px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <BreakdownRow label="Subtotal" value={formatMoney(o.subtotal, store.currency)} />
                        {o.deliveryFeePending
                          ? <BreakdownRow label="Delivery fee" value="To be confirmed" accent="#B45309" />
                          : o.orderType === 'DELIVERY' && (
                              o.deliveryFee > 0
                                ? <BreakdownRow label="Delivery fee" value={formatMoney(o.deliveryFee, store.currency)} />
                                : <BreakdownRow label="Delivery fee" value="Free" accent="#047857" />
                            )}
                        {o.discountAmount > 0 && (
                          <BreakdownRow label={`Discount${o.discountCode ? ` (${o.discountCode})` : ''}`} value={`− ${formatMoney(o.discountAmount, store.currency)}`} accent="#047857" />
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          <span>{o.deliveryFeePending ? 'Estimated total' : 'Total'}</span>
                          <span>{formatMoney(o.totalAmount, store.currency)}</span>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '14px', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <InfoRow label="Contact" value={
                          <>
                            <div>{o.contactName || o.customerName || '-'}</div>
                            <div style={{ color: 'var(--text-secondary)' }}>{o.contactPhone || 'No phone'}</div>
                            {o.contactEmail && <div style={{ color: 'var(--text-secondary)' }}>{o.contactEmail}</div>}
                          </>
                        } />
                        <InfoRow label="Fulfilment" value={
                          <>
                            <div>{fulfilmentLabel(o.orderType)}</div>
                            {o.orderType === 'DELIVERY' && <div style={{ color: 'var(--text-secondary)' }}>{o.deliveryAddress || 'No address given'}</div>}
                          </>
                        } />
                        <InfoRow label="Payment" value={
                          <>
                            <div>{o.paymentMethod || '-'}</div>
                            {o.paymentReference && <div style={{ color: 'var(--text-secondary)' }}>Ref {o.paymentReference}</div>}
                          </>
                        } />
                        {o.notes && <InfoRow label="Notes" value={<span style={{ whiteSpace: 'pre-wrap' }}>{o.notes}</span>} />}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-medium)', padding: '16px' }}>
                      {(() => {
                        const waUrl = messageCustomerUrl(o);
                        return waUrl ? (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                              height: '40px', borderRadius: 'var(--radius-field)', background: '#25D366', color: 'white',
                              fontSize: '13px', fontWeight: 600, textDecoration: 'none', marginBottom: '16px',
                            }}
                          >
                            <MessageCircle size={16} /> Message customer on WhatsApp
                          </a>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                            No phone on file, so we can't message this customer.
                          </p>
                        );
                      })()}
                      {canEdit && onEditOrder && (
                        <div style={{ marginBottom: '16px' }}>
                          <Button variant="secondary" onClick={() => onEditOrder(o.id)}>
                            Edit Order Details
                          </Button>
                        </div>
                      )}
                      <p className="text-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>UPDATE STATUS</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {NEXT_STATUS[o.status].length === 0 && (
                          <p className="text-small" style={{ color: 'var(--text-muted)' }}>Order is {STATUS_LABEL[o.status].toLowerCase()}. No further steps.</p>
                        )}
                        {NEXT_STATUS[o.status].map((s) => (
                          <Button
                            key={s}
                            variant={s === 'CANCELLED' ? 'secondary' : 'primary'}
                            disabled={busy}
                            onClick={() => changeStatus(o, s)}
                          >
                            {s === 'CANCELLED' ? 'Cancel Order' : `Mark ${STATUS_LABEL[s]}`}
                          </Button>
                        ))}
                      </div>

                      <p className="text-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>PAYMENT</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(['UNPAID', 'PAID', 'REFUNDED'] as PaymentStatus[]).map((p) => (
                          <button
                            key={p}
                            disabled={busy}
                            onClick={() => changePayment(o, p)}
                            className="text-xs"
                            style={{
                              padding: '6px 12px', borderRadius: 'var(--radius-pill)', cursor: 'pointer', fontWeight: 600,
                              border: o.paymentStatus === p ? '2px solid var(--primary-solid)' : '1px solid var(--border-strong)',
                              background: PAYMENT_STYLE[p].bg, color: PAYMENT_STYLE[p].fg,
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <p className="text-small" style={{ color: 'var(--text-secondary)', marginTop: '16px' }}>
        Total {filtered.length} order{filtered.length === 1 ? '' : 's'}
      </p>

      <style>{`
        .m-label { display: none; }
        @media (max-width: 1024px) {
          .orders-head { display: none !important; }
          .orders-row {
            display: flex !important;
            flex-direction: column;
            align-items: stretch !important;
            gap: 6px !important;
            position: relative;
            padding-right: 44px !important;
          }
          .orders-row > span { display: flex; align-items: center; gap: 8px; }
          .orders-row .order-id { font-weight: 700; font-size: 14px; }
          .orders-row .m-label {
            display: inline-block;
            min-width: 84px;
            color: var(--text-secondary);
            font-weight: 600;
          }
          .orders-row .order-chevron {
            position: absolute;
            top: 16px;
            right: 20px;
          }
          .orders-detail { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
