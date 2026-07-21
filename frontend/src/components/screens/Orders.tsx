import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Plus, Search } from 'lucide-react';
import { Button } from '../Button';
import { ordersApi, OrderResponse, OrderStatus, PaymentStatus } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import type { Store } from '../../App';

interface OrdersProps {
  store: Store;
  onNavigate: (screen: string) => void;
  initialStatus?: OrderStatus | 'ALL';
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

export function Orders({ store, onNavigate, initialStatus = 'ALL' }: OrdersProps) {
  const storeId = Number(store.id);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<OrderStatus | 'ALL'>(initialStatus);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<number | null>(null);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (tab !== 'ALL' && o.status !== tab) return false;
      if (!q) return true;
      return (
        String(o.id).includes(q) ||
        (o.contactName || '').toLowerCase().includes(q) ||
        (o.contactPhone || '').toLowerCase().includes(q) ||
        o.items.some((i) => i.productName.toLowerCase().includes(q))
      );
    });
  }, [orders, tab, query]);

  const applyUpdated = (updated: OrderResponse) =>
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  const changeStatus = async (order: OrderResponse, status: OrderStatus) => {
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
            placeholder="Search by customer, product, order number..."
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
          className="text-xs"
          style={{
            display: 'grid', gridTemplateColumns: '90px 1.4fr 110px 130px 70px 150px 1fr 40px',
            gap: '12px', padding: '14px 20px', background: 'var(--bg-card-subtle)',
            color: 'var(--text-secondary)', fontWeight: 600,
          }}
        >
          <span>Order</span><span>Customer</span><span>Total</span><span>Payment</span>
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
            const expanded = expandedId === o.id;
            const busy = busyOrderId === o.id;
            return (
              <div key={o.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div
                  onClick={() => setExpandedId(expanded ? null : o.id)}
                  style={{
                    display: 'grid', gridTemplateColumns: '90px 1.4fr 110px 130px 70px 150px 1fr 40px',
                    gap: '12px', padding: '16px 20px', alignItems: 'center', cursor: 'pointer',
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  <span className="text-small" style={{ fontWeight: 600 }}>#{o.id}</span>
                  <span className="text-small">{o.contactName || o.customerName || '—'}</span>
                  <span className="text-small" style={{ fontWeight: 600 }}>{formatMoney(o.totalAmount, store.currency)}</span>
                  <span><Badge text={o.paymentStatus} {...PAYMENT_STYLE[o.paymentStatus]} /></span>
                  <span className="text-small">{o.items.reduce((n, i) => n + i.quantity, 0)}</span>
                  <span><Badge text={STATUS_LABEL[o.status]} {...STATUS_STYLE[o.status]} /></span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(o.createdAt)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                </div>

                {expanded && (
                  <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px' }}>
                    {/* Items + contact */}
                    <div style={{ background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-medium)', padding: '16px' }}>
                      <p className="text-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>ITEMS</p>
                      {o.items.length === 0 && <p className="text-small" style={{ color: 'var(--text-muted)' }}>No line items recorded.</p>}
                      {o.items.map((i) => (
                        <div key={i.productId} className="text-small" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span>{i.productName} × {i.quantity}</span>
                          <span>{formatMoney(i.price * i.quantity, store.currency)}</span>
                        </div>
                      ))}
                      <div className="text-small" style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', marginTop: '8px', paddingTop: '8px', fontWeight: 600 }}>
                        <span>Total</span>
                        <span>{formatMoney(o.totalAmount, store.currency)}</span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
                        {o.contactPhone || 'no phone'} · {o.contactEmail || 'no email'} · {o.orderType}
                        {o.deliveryAddress ? ` · ${o.deliveryAddress}` : ''}
                      </p>
                      {(o.paymentMethod || o.paymentReference) && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                          Payment: {o.paymentMethod || '—'}{o.paymentReference ? ` · Ref ${o.paymentReference}` : ''}
                        </p>
                      )}
                      {o.notes && <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Notes: {o.notes}</p>}
                    </div>

                    {/* Actions */}
                    <div style={{ background: 'var(--bg-card-subtle)', borderRadius: 'var(--radius-medium)', padding: '16px' }}>
                      <p className="text-xs" style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>UPDATE STATUS</p>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {NEXT_STATUS[o.status].length === 0 && (
                          <p className="text-small" style={{ color: 'var(--text-muted)' }}>Order is {STATUS_LABEL[o.status].toLowerCase()} — no further steps.</p>
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
    </div>
  );
}
