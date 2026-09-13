import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, RotateCcw, XCircle, Star, ChevronRight } from 'lucide-react';
import { Card } from '../Card';
import { ordersApi, OrderResponse, OrderStatus } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { computeOrderStats, ordersWithinRange, ordersInMonth, monthsWithSales, topProductsByUnits, type RangeKey } from '../../lib/orderStats';
import { Select } from '../Select';
import type { Store } from '../../App';

interface DashboardProps {
  store: Store;
  onNavigate: (screen: string) => void;
}

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'all', label: 'All time' },
];

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
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

const ALL_TIME = 'all';

const RECENT_LIMIT = 5;
const TOP_LIMIT = 5;

function StatCard({ icon, tint, label, value }: { icon: ReactNode; tint: string; label: string; value: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px', background: `${tint}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</p>
          <p style={{ fontSize: '20px', fontWeight: 600, overflowWrap: 'anywhere' }}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function Dashboard({ store, onNavigate }: DashboardProps) {
  const storeId = Number(store.id);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('30d');
  // Top products has its own picker: 'all' or a specific 'YYYY-MM' month.
  const [topMonth, setTopMonth] = useState<string>(ALL_TIME);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ordersApi
      .list(storeId)
      .then((res) => { if (!cancelled) setOrders(res); })
      .catch(() => { if (!cancelled) setError('Could not load your dashboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId]);

  // The tiles use the main 7/30/90/all toggle. Top products has its own separate
  // month/all control. Recent orders is a latest-activity glance, independent of
  // both (always the newest few overall).
  const windowed = useMemo(() => ordersWithinRange(orders, range), [orders, range]);
  const stats = useMemo(() => computeOrderStats(windowed), [windowed]);

  // Month picker options: "All time" plus every month that has fulfilled sales.
  const monthOptions = useMemo(() => monthsWithSales(orders), [orders]);
  const topSelectOptions = useMemo(
    () => [{ value: ALL_TIME, label: 'All time' }, ...monthOptions.map((m) => ({ value: m.key, label: m.label }))],
    [monthOptions],
  );
  // Guard against a selected month that is no longer in the list (defensive).
  const effectiveTopMonth = topMonth !== ALL_TIME && !monthOptions.some((m) => m.key === topMonth) ? ALL_TIME : topMonth;
  const topProducts = useMemo(
    () => topProductsByUnits(effectiveTopMonth === ALL_TIME ? orders : ordersInMonth(orders, effectiveTopMonth), TOP_LIMIT),
    [orders, effectiveTopMonth],
  );
  const recent = useMemo(
    () => [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, RECENT_LIMIT),
    [orders],
  );

  const rangeLabel = RANGE_OPTIONS.find((r) => r.key === range)!.label;
  const rangeSuffix = range === 'all' ? 'all time' : `last ${rangeLabel}`;
  const c = store.currency;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '6px' }}>Overview</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Your store at a glance, {rangeSuffix}.</p>
        </div>

        {/* Time-range presets */}
        <div role="group" aria-label="Time range" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)', overflow: 'hidden', background: 'var(--bg-card)' }}>
          {RANGE_OPTIONS.map((opt, i) => {
            const active = opt.key === range;
            return (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                aria-pressed={active}
                style={{
                  padding: '8px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                  background: active ? 'var(--primary-solid)' : 'transparent',
                  color: active ? 'white' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <Card><div style={{ padding: '32px', textAlign: 'center', color: 'var(--error-color)' }} className="text-small">{error}</div></Card>
      ) : loading ? (
        <Card><div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }} className="text-small">Loading your dashboard…</div></Card>
      ) : (
        <>
          {/* Stat tiles (windowed) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <StatCard icon={<DollarSign size={20} style={{ color: '#10B981' }} />} tint="#10B981" label="Total Revenue" value={formatMoney(stats.totalRevenue, c)} />
            <StatCard icon={<ShoppingCart size={20} style={{ color: '#3B82F6' }} />} tint="#3B82F6" label="Orders" value={String(stats.totalOrders)} />
            <StatCard icon={<RotateCcw size={20} style={{ color: '#D97706' }} />} tint="#D97706" label="Refunded" value={formatMoney(stats.refundedAmount, c)} />
            <StatCard icon={<XCircle size={20} style={{ color: '#DC2626' }} />} tint="#DC2626" label="Cancelled" value={String(stats.cancelledCount)} />
          </div>

          {stats.totalOrders === 0 && (
            <p className="text-small" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
              No orders in this period. Your totals appear here as orders come in.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '16px' }}>
            {/* Top products (windowed) */}
            <Card>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
                  <Star size={18} />
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Top products</div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>by units sold</span>
                  <div style={{ marginLeft: 'auto' }}>
                    <Select
                      value={effectiveTopMonth}
                      onChange={setTopMonth}
                      options={topSelectOptions}
                      ariaLabel="Top products period"
                      height={32}
                      triggerStyle={{ minWidth: 150 }}
                    />
                  </div>
                </div>
                {topProducts.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {effectiveTopMonth === ALL_TIME ? 'No completed sales yet.' : 'No completed sales in this month.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {topProducts.map((p, i) => (
                      <div key={p.productName} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ width: 20, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.productName}</span>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{p.units} sold</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Recent orders (latest activity, not windowed) */}
            <Card>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <TrendingUp size={18} />
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Recent orders</div>
                  {recent.length > 0 && (
                    <button
                      onClick={() => onNavigate('orders-all')}
                      style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-solid)', fontSize: 13, fontWeight: 600 }}
                    >
                      View all <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                {recent.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    No orders yet. New orders show up here as they arrive.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {recent.map((o) => {
                      const st = STATUS_STYLE[o.status];
                      return (
                        <button
                          key={o.id}
                          onClick={() => onNavigate('orders-all')}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', border: 'none', borderTop: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>#{o.id}{o.customerName ? ` · ${o.customerName}` : ''}</div>
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(o.createdAt)}</div>
                          </div>
                          <span className="text-xs" style={{ padding: '3px 8px', borderRadius: 6, background: st.bg, color: st.fg, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {STATUS_LABEL[o.status] ?? o.status}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatMoney(o.totalAmount, c)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
