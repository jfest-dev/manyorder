import { useEffect, useState } from 'react';
import {
  adminApi, ApiError, AdminOverview as AdminOverviewData,
  AdminOverviewAttentionGroup, AdminOverviewCurrencyValue,
} from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { ADMIN_FONT } from './adminTokens';
import { readableAction } from './adminActions';
import { formatDate, formatDateTime, formatShortDate } from '../../lib/adminDatetime';

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
      <h3 style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, margin: '0 0 12px' }}>{title}</h3>
      {children}
    </section>
  );
}

function StoreLink({ id, name, onOpenStore }: { id: number; name: string; onOpenStore: (id: number) => void }) {
  return (
    <button type="button" onClick={() => onOpenStore(id)}
      style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600, fontSize: ADMIN_FONT.body, textAlign: 'left' }}>
      {name}
    </button>
  );
}

function OrderValue({ last30, allTime }: { last30: AdminOverviewCurrencyValue[]; allTime: AdminOverviewCurrencyValue[] }) {
  const block = (label: string, rows: AdminOverviewCurrencyValue[]) => (
    <div style={{ flex: '1 1 220px', minWidth: 200 }}>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 10 }}>{label}</div>
      {rows.length === 0 ? (
        <div className="text-small" style={{ color: 'var(--text-muted)' }}>No recorded value yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => (
            <div key={r.currency}>
              {/* Symbol-only amount, large; the currency code lives in the muted line below. */}
              <div style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800, lineHeight: 1.15 }}>{formatMoney(r.total, r.currency)}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 3 }}>
                {r.orders} {r.orders === 1 ? 'order' : 'orders'} - {r.currency}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <Panel title="Order value">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32 }}>
        {block('Last 30 days', last30)}
        {block('All time', allTime)}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '16px 0 0' }}>{PAYMENT_NOTE}</p>
    </Panel>
  );
}

function OrdersPerDay({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const peak = days.reduce((p, d) => (d.count > p ? d.count : p), 0);
  // Label only the first day that hits the peak, so one count floats above the chart.
  const peakIndex = peak > 0 ? days.findIndex((d) => d.count === peak) : -1;
  return (
    <Panel title={`${total} ${total === 1 ? 'order' : 'orders'} in the last 30 days`}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 128 }}>
        {days.map((d, i) => (
          <div key={d.date} title={`${formatShortDate(d.date)}: ${d.count} ${d.count === 1 ? 'order' : 'orders'}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end', height: '100%' }}>
            {i === peakIndex && (
              <div className="text-xs" style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 2 }}>{d.count}</div>
            )}
            {d.count > 0 ? (
              <div style={{ height: `${Math.max(4, (d.count / max) * 100)}%`, background: 'var(--primary-solid)', borderRadius: '2px 2px 0 0' }} />
            ) : (
              // Zero days still get a thin baseline marker so the row never looks broken.
              <div style={{ height: 2, background: 'var(--border-strong)' }} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatShortDate(days[0]?.date)}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatShortDate(days[days.length - 1]?.date)}</span>
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
        <div style={{ fontSize: ADMIN_FONT.small, color: 'var(--text-muted)' }}>No admin activity yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((a) => {
            // Readable action name (shared with the Activity page), and the store's
            // name beside its id. Body text stays normal weight and sentence case.
            const storeName = a.storeName && a.storeName.trim() !== '' ? a.storeName : 'Store';
            return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: ADMIN_FONT.body }}>
                  {readableAction(a.action)}
                  {a.targetLabel ? <span style={{ color: 'var(--text-secondary)' }}> · {a.targetLabel}</span> : null}
                </div>
                <div style={{ fontSize: ADMIN_FONT.caption, color: 'var(--text-muted)' }}>
                  {(a.actorName || 'Platform admin')}{a.merchantId != null ? ` · ${storeName} #${a.merchantId}` : ''}
                </div>
              </div>
              <span style={{ fontSize: ADMIN_FONT.caption, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDateTime(a.createdAt)}</span>
            </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
