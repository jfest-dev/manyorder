import { useEffect, useState } from 'react';
import {
  adminApi, ApiError, AdminAnalytics as AdminAnalyticsData,
  AdminAnalyticsRange, AdminAnalyticsCurrencyValue,
} from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { ADMIN_FONT } from './adminTokens';
import { DatePicker } from '../DatePicker';

interface Props {
  onOpenStore: (id: number) => void;
}

const RANGE_OPTIONS: { key: AdminAnalyticsRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
const FUNNEL_LABELS: Record<string, string> = {
  signed_up: 'Signed up', verified: 'Verified', created_store: 'Created a store',
  added_product: 'Added a product', first_order: 'First order',
};

/** Range-scoped admin analytics with a time-range selector and a custom calendar.
 *  The server resolves all day boundaries in Asia/Singapore and echoes the window. */
export function AdminAnalytics({ onOpenStore }: Props) {
  const [range, setRange] = useState<AdminAnalyticsRange>('30d');
  const [compare, setCompare] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<AdminAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isCustom = range === 'custom';
  const customValid = !isCustom || (!!customStart && !!customEnd && customStart <= customEnd);
  const customInvalid = isCustom && !!customStart && !!customEnd && customStart > customEnd;

  useEffect(() => {
    if (!customValid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi
      .analytics(isCustom ? { range: 'custom', from: customStart, to: customEnd, compare } : { range, compare })
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof ApiError ? e.message : 'Could not load analytics'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [range, compare, customStart, customEnd, isCustom, customValid]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Controls
        range={range} setRange={setRange} compare={compare} setCompare={setCompare}
        customStart={customStart} setCustomStart={setCustomStart}
        customEnd={customEnd} setCustomEnd={setCustomEnd} customInvalid={customInvalid}
      />
      {data && <WindowCaption data={data} />}

      {error ? (
        <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
      ) : !data ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading analytics…</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.6 : 1 }}>
          <Tiles data={data} />
          <OrdersByDay days={data.orders.byDay} range={data.window.range} />
          <Breakdown orders={data.orders} />
          <TopStores stores={data.orders.topStores} onOpenStore={onOpenStore} />
          <Funnel steps={data.funnel.steps} />
          <StoresPanel stores={data.stores} compare={data.window.compare} snapshot={data.snapshot} />
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card)', padding: 16 }}>
      <h3 style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, margin: '0 0 12px' }}>{title}</h3>
      {children}
    </section>
  );
}

function Controls({
  range, setRange, compare, setCompare, customStart, setCustomStart, customEnd, setCustomEnd, customInvalid,
}: {
  range: AdminAnalyticsRange; setRange: (r: AdminAnalyticsRange) => void;
  compare: boolean; setCompare: (c: boolean) => void;
  customStart: string; setCustomStart: (s: string) => void;
  customEnd: string; setCustomEnd: (s: string) => void; customInvalid: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div role="group" aria-label="Time range" style={{ display: 'inline-flex', flexWrap: 'wrap', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)', overflow: 'hidden', background: 'var(--bg-card)' }}>
          {RANGE_OPTIONS.map((opt, i) => {
            const active = opt.key === range;
            return (
              <button key={opt.key} type="button" onClick={() => setRange(opt.key)} aria-pressed={active}
                style={{
                  padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                  background: active ? 'var(--primary-solid)' : 'transparent', color: active ? 'white' : 'var(--text-secondary)',
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          Compare with previous period
        </label>
      </div>

      {range === 'custom' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 160 }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Start date</label>
              <DatePicker value={customStart} onChange={setCustomStart} placeholder="Start date" ariaLabel="Custom range start date" />
            </div>
            <div style={{ minWidth: 160 }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>End date</label>
              <DatePicker value={customEnd} onChange={setCustomEnd} min={customStart || undefined} placeholder="End date" ariaLabel="Custom range end date" />
            </div>
          </div>
          {customInvalid && (
            <p className="text-small" style={{ color: 'var(--error-color)', margin: '8px 0 0' }}>Start date must be on or before the end date.</p>
          )}
        </div>
      )}
    </div>
  );
}

function WindowCaption({ data }: { data: AdminAnalyticsData }) {
  const w = data.window;
  const label = w.range === 'custom' ? `${w.fromDate} to ${w.toDate}` : rangeWord(w.range);
  return (
    <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>
      {label} · Singapore time{w.compare ? ' · compared with the previous period' : ''}
    </p>
  );
}

function rangeWord(r: string): string {
  return r === 'today' ? 'Today' : r === 'yesterday' ? 'Yesterday' : r === '7d' ? 'Last 7 days'
    : r === '30d' ? 'Last 30 days' : r === 'all' ? 'All time' : r;
}

/** A current value with an optional previous-period delta line. */
function deltaLine(current: number, previous: number | null | undefined): React.ReactNode {
  if (previous == null) return null;
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';
  const color = diff > 0 ? 'var(--success-color, #12805c)' : diff < 0 ? 'var(--error-color)' : 'var(--text-muted)';
  return (
    <div className="text-xs" style={{ color, marginTop: 3 }}>
      {sign}{diff} vs {previous} before
    </div>
  );
}

function Tiles({ data }: { data: AdminAnalyticsData }) {
  const o = data.orders;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <Tile label="Orders">
        <div style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{o.total}</div>
        {deltaLine(o.total, o.previousTotal)}
      </Tile>
      {o.byCurrency.map((c) => <ValueTile key={c.currency} v={c} />)}
      <Tile label="New stores">
        <div style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{data.stores.newInRange}</div>
        {deltaLine(data.stores.newInRange, data.stores.previousNewInRange)}
      </Tile>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 150, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card)', padding: 16 }}>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>{label}</div>
      {children}
    </div>
  );
}

function ValueTile({ v }: { v: AdminAnalyticsCurrencyValue }) {
  return (
    <Tile label={`Value · ${v.currency}`}>
      <div style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{formatMoney(v.value, v.currency)}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 3 }}>
        {v.orders} {v.orders === 1 ? 'order' : 'orders'} · avg {formatMoney(v.averageOrderValue, v.currency)}
      </div>
      {v.previousValue != null && deltaLine(Math.round(v.value), Math.round(v.previousValue))}
    </Tile>
  );
}

function OrdersByDay({ days, range }: { days: { date: string; count: number }[]; range: string }) {
  if (days.length === 0) {
    return <Panel title="Orders by day"><p className="text-small" style={{ color: 'var(--text-muted)' }}>A daily series is not shown for this range{range === 'all' ? ' (all time)' : ''}.</p></Panel>;
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  return (
    <Panel title={`${total} ${total === 1 ? 'order' : 'orders'} by day`}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
        {days.map((d) => (
          <div key={d.date} title={`${d.date}: ${d.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
            {d.count > 0
              ? <div style={{ height: `${Math.max(4, (d.count / max) * 100)}%`, background: 'var(--primary-solid)', borderRadius: '2px 2px 0 0' }} />
              : <div style={{ height: 2, background: 'var(--border-strong)' }} />}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{days[0]?.date}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{days[days.length - 1]?.date}</span>
      </div>
    </Panel>
  );
}

function Breakdown({ orders }: { orders: AdminAnalyticsData['orders'] }) {
  const statuses = STATUS_ORDER.filter((s) => (orders.byStatus[s] ?? 0) > 0);
  return (
    <Panel title="Order breakdown">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <Figures title="Fulfilment" rows={[['Delivery', orders.delivery], ['Pickup', orders.pickup]]} />
        <Figures title="Flags" rows={[['Storefront (guest)', orders.guest], ['Cancelled', orders.cancelled], ['With a discount', orders.withDiscount]]} />
        <Figures title="By status" rows={statuses.map((s) => [titleCase(s), orders.byStatus[s]])} />
      </div>
    </Panel>
  );
}

function Figures({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div style={{ flex: '1 1 200px', minWidth: 180 }}>
      <div className="text-xs" style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {rows.length === 0 ? <div className="text-xs" style={{ color: 'var(--text-muted)' }}>None</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span className="text-small" style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span className="text-small" style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopStores({ stores, onOpenStore }: { stores: AdminAnalyticsData['orders']['topStores']; onOpenStore: (id: number) => void }) {
  return (
    <Panel title="Top stores by orders">
      {stores.length === 0 ? <div className="text-small" style={{ color: 'var(--text-muted)' }}>No orders in this range.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stores.map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <button type="button" onClick={() => onOpenStore(s.id)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600, fontSize: ADMIN_FONT.body, textAlign: 'left' }}>
                {s.name}
              </button>
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

function Funnel({ steps }: { steps: AdminAnalyticsData['funnel']['steps'] }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <Panel title="Signup funnel (accounts that signed up in this range)">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((s) => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="text-small" style={{ width: 120, color: 'var(--text-secondary)' }}>{FUNNEL_LABELS[s.step] ?? s.step}</span>
            <div style={{ flex: 1, height: 18, background: 'var(--border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${(s.count / max) * 100}%`, height: '100%', background: 'var(--primary-solid)' }} />
            </div>
            <span className="text-small" style={{ width: 90, textAlign: 'right' }}>
              {s.count}{s.retentionFromPrev != null ? <span style={{ color: 'var(--text-muted)' }}> · {Math.round(s.retentionFromPrev * 100)}%</span> : null}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function StoresPanel({ stores, compare, snapshot }: { stores: AdminAnalyticsData['stores']; compare: boolean; snapshot: { outOfStockProducts: number } }) {
  return (
    <Panel title="Stores">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
        <Figures title="In this range" rows={[
          ['New stores', stores.newInRange],
          ['First product', stores.firstProductInRange],
          ['First order', stores.firstOrderInRange],
        ]} />
        <Figures title="Current state (all stores)" rows={[
          ['Active', stores.active], ['Suspended', stores.suspended], ['Archived', stores.archived],
        ]} />
        <Figures title="Snapshot (now, not range)" rows={[['Out of stock products', snapshot.outOfStockProducts]]} />
      </div>
      {compare && stores.previousNewInRange != null && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '12px 0 0' }}>
          New stores previous period: {stores.previousNewInRange}
        </p>
      )}
    </Panel>
  );
}

function titleCase(status: string): string {
  return status.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}
