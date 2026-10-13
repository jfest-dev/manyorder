import { useEffect, useState } from 'react';
import {
  adminApi, ApiError, AdminOverview as AdminOverviewData,
  AdminOverviewAttentionGroup, AdminOverviewCurrencyValue,
} from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { formatDate, formatDateTime } from '../../lib/adminDatetime';

interface Props {
  /** Open a store's drill-down from any link in the Overview. */
  onOpenStore: (id: number) => void;
}

const PAYMENT_NOTE = "Order value recorded by merchants. ManyOrder doesn't process payments.";

/** Admin Overview: order value, orders-per-day bars, top stores, attention, newest, recent actions. */
export function AdminOverview({ onOpenStore }: Props) {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi.overview()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load overview'); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>;
  if (!data) return <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading overview…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
      <OrderValue last30={data.valueLast30Days} allTime={data.valueAllTime} />
      <OrdersPerDay days={data.ordersPerDay} />
      <TopStores stores={data.topStores} onOpenStore={onOpenStore} />
      <NeedsAttention attention={data.needsAttention} onOpenStore={onOpenStore} />
      <NewestStores stores={data.newestStores} onOpenStore={onOpenStore} />
      <RecentActions actions={data.recentActions} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card)', padding: '16px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>{title}</h3>
      {children}
    </section>
  );
}

function StoreLink({ id, name, onOpenStore }: { id: number; name: string; onOpenStore: (id: number) => void }) {
  return (
    <button type="button" onClick={() => onOpenStore(id)}
      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600, fontSize: 13, textAlign: 'left' }}>
      {name}
    </button>
  );
}

function OrderValue({ last30, allTime }: { last30: AdminOverviewCurrencyValue[]; allTime: AdminOverviewCurrencyValue[] }) {
  const block = (label: string, rows: AdminOverviewCurrencyValue[]) => (
    <div style={{ flex: '1 1 220px', minWidth: 200 }}>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {rows.length === 0 ? (
        <div className="text-small" style={{ color: 'var(--text-muted)' }}>No recorded value yet.</div>
      ) : rows.map((r) => (
        <div key={r.currency} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, padding: '4px 0' }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{formatMoney(r.total, r.currency)}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.currency} · {r.orders} {r.orders === 1 ? 'order' : 'orders'}</span>
        </div>
      ))}
    </div>
  );
  return (
    <Panel title="Order value">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        {block('Last 30 days', last30)}
        {block('All time', allTime)}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '12px 0 0' }}>{PAYMENT_NOTE}</p>
    </Panel>
  );
}

function OrdersPerDay({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  return (
    <Panel title="Orders per day (last 30 days)">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
        {days.map((d) => (
          <div key={d.date} title={`${formatDate(d.date)}: ${d.count}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            <div style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 2 : 0,
              background: 'var(--primary-solid)', borderRadius: '2px 2px 0 0' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(days[0]?.date)}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{total} in 30 days</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(days[days.length - 1]?.date)}</span>
      </div>
    </Panel>
  );
}

function TopStores({ stores, onOpenStore }: { stores: AdminOverviewData['topStores']; onOpenStore: (id: number) => void }) {
  return (
    <Panel title="Top stores by orders (last 30 days)">
      {stores.length === 0 ? (
        <div className="text-small" style={{ color: 'var(--text-muted)' }}>No orders in the last 30 days.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stores.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <StoreLink id={s.id} name={s.name} onOpenStore={onOpenStore} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {s.orders} {s.orders === 1 ? 'order' : 'orders'} · {formatMoney(s.value, s.currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AttentionList({ label, group, onOpenStore }: { label: string; group: AdminOverviewAttentionGroup; onOpenStore: (id: number) => void }) {
  return (
    <div style={{ flex: '1 1 220px', minWidth: 200 }}>
      <div className="text-xs" style={{ fontWeight: 700, marginBottom: 6 }}>{label} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({group.count})</span></div>
      {group.count === 0 ? (
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>None</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {group.items.map((s) => <StoreLink key={s.id} id={s.id} name={s.name} onOpenStore={onOpenStore} />)}
          {group.count > group.items.length && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>and {group.count - group.items.length} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function NeedsAttention({ attention, onOpenStore }: { attention: AdminOverviewData['needsAttention']; onOpenStore: (id: number) => void }) {
  return (
    <Panel title="Needs attention">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        <AttentionList label="Owners not verified" group={attention.unverifiedOwners} onOpenStore={onOpenStore} />
        <AttentionList label="No products" group={attention.noProducts} onOpenStore={onOpenStore} />
        <AttentionList label="No orders in 30 days" group={attention.noOrders30Days} onOpenStore={onOpenStore} />
        <AttentionList label="Suspended" group={attention.suspended} onOpenStore={onOpenStore} />
      </div>
    </Panel>
  );
}

function NewestStores({ stores, onOpenStore }: { stores: AdminOverviewData['newestStores']; onOpenStore: (id: number) => void }) {
  return (
    <Panel title="Newest stores">
      {stores.length === 0 ? (
        <div className="text-small" style={{ color: 'var(--text-muted)' }}>No stores yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stores.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <StoreLink id={s.id} name={s.name} onOpenStore={onOpenStore} />
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.ownerName}</div>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(s.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecentActions({ actions }: { actions: AdminOverviewData['recentActions'] }) {
  return (
    <Panel title="Recent admin actions">
      {actions.length === 0 ? (
        <div className="text-small" style={{ color: 'var(--text-muted)' }}>No admin activity yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((a) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div className="text-small" style={{ fontWeight: 600 }}>{a.action}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a.actorEmail}{a.merchantId != null ? ` · store #${a.merchantId}` : ''}
                </div>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
