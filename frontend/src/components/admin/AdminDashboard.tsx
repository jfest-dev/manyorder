import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  adminApi, ApiError, AdminDashboard as DashboardData, AdminDashboardRange,
  AdminDashboardTrend, AdminDashboardActionItem, AdminDashboardDropStep,
} from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { formatDateTime } from '../../lib/adminDatetime';
import { ADMIN_FONT } from './adminTokens';
import { ADMIN_STRINGS as S } from './adminStrings';
import { DatePicker } from '../DatePicker';
import { AdminAnalytics } from './AdminAnalytics';

interface Props { onOpenStore: (id: number) => void; }

const RANGE_CHIPS: { key: AdminDashboardRange; label: string }[] = [
  { key: 'today', label: S.dates.today },
  { key: 'yesterday', label: S.dates.yesterday },
  { key: '7d', label: S.dates.last7 },
  { key: '30d', label: S.dates.last30 },
  { key: 'month', label: S.dates.thisMonth },
  { key: 'custom', label: S.dates.custom },
];
const MAX_DAYS = 366;

/** The redesigned admin dashboard: what happened, what needs action, where people drop
 *  off, the right-now box, and the full details collapsed. Opens on Today. */
export function AdminDashboard({ onOpenStore }: Props) {
  // The date range lives in the URL query string (?range=.., &from=.., &to=..) so Back
  // returns to the same dashboard with the same dates and the screen can be linked.
  const [searchParams, setSearchParams] = useSearchParams();
  const RANGES: AdminDashboardRange[] = ['today', 'yesterday', '7d', '30d', 'month', 'custom'];
  const range: AdminDashboardRange = RANGES.includes(searchParams.get('range') as AdminDashboardRange)
    ? (searchParams.get('range') as AdminDashboardRange) : 'today';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const setRange = (r: AdminDashboardRange) => setSearchParams((prev) => {
    const p = new URLSearchParams(prev); p.set('range', r);
    if (r !== 'custom') { p.delete('from'); p.delete('to'); }
    return p;
  }, { replace: false });
  const setFrom = (v: string) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('from', v); return p; }, { replace: true });
  const setTo = (v: string) => setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set('to', v); return p; }, { replace: true });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isCustom = range === 'custom';
  const days = isCustom && from && to ? Math.floor((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1 : 0;
  const customMsg = isCustom && from && to && from > to ? S.dates.startAfterEnd : isCustom && days > MAX_DAYS ? S.dates.tooLong : '';
  const valid = !isCustom || (!!from && !!to && from <= to && days <= MAX_DAYS);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    setLoading(true); setError(null);
    adminApi.dashboard(isCustom ? { range: 'custom', from, to } : { range })
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e instanceof ApiError ? e.message : S.loadError); setLoading(false); } });
    return () => { cancelled = true; };
  }, [range, from, to, isCustom, valid]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
      <Dates range={range} setRange={setRange} from={from} setFrom={setFrom} to={to} setTo={setTo} customMsg={customMsg} />
      {error ? <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
        : !data ? <p className="text-small" style={{ color: 'var(--text-secondary)' }}>{S.loading}</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.6 : 1 }}>
            <WhatHappened data={data} onOpenStore={onOpenStore} />
            <NeedsAction items={data.needsAction} onOpenStore={onOpenStore} />
            <DropOff steps={data.dropOff} onOpenStore={onOpenStore} />
            <RightNow r={data.rightNow} />
            <MoreDetails onOpenStore={onOpenStore} />
          </div>
        )}
    </div>
  );
}

function Panel({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card)', padding: 16 }}>
      <h3 style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, margin: 0 }}>{title}</h3>
      {help && <p className="text-xs" style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{help}</p>}
      {!help && <div style={{ height: 12 }} />}
      {children}
    </section>
  );
}

function Dates({ range, setRange, from, setFrom, to, setTo, customMsg }: {
  range: AdminDashboardRange; setRange: (r: AdminDashboardRange) => void;
  from: string; setFrom: (s: string) => void; to: string; setTo: (s: string) => void; customMsg: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div role="group" aria-label="Dates" style={{ display: 'inline-flex', flexWrap: 'wrap', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)', overflow: 'hidden', background: 'var(--bg-card)', alignSelf: 'flex-start' }}>
        {RANGE_CHIPS.map((c, i) => {
          const on = c.key === range;
          return (
            <button key={c.key} type="button" onClick={() => setRange(c.key)} aria-pressed={on}
              style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                borderLeft: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                background: on ? 'var(--primary-solid)' : 'transparent', color: on ? 'white' : 'var(--text-secondary)' }}>
              {c.label}
            </button>
          );
        })}
      </div>
      <span className="text-xs" title="Singapore time" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{S.dates.sgt}</span>
      </div>
      {range === 'custom' && (
        <div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <div style={{ minWidth: 150 }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{S.dates.from}</label>
              <DatePicker value={from} onChange={setFrom} placeholder={S.dates.from} ariaLabel="Start date" />
            </div>
            <div style={{ minWidth: 150 }}>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{S.dates.to}</label>
              <DatePicker value={to} onChange={setTo} min={from || undefined} placeholder={S.dates.to} ariaLabel="End date" />
            </div>
          </div>
          {customMsg && <p className="text-small" style={{ color: 'var(--error-color)', margin: '8px 0 0' }}>{customMsg}</p>}
        </div>
      )}
    </div>
  );
}

function Arrow({ t }: { t: AdminDashboardTrend }) {
  if (t.previous == null) return null;
  const diff = t.current - t.previous;
  if (diff === 0) return <span className="text-xs" style={{ color: 'var(--text-muted)' }}> · no change {S.happened.vsBefore}</span>;
  const up = diff > 0;
  return <span className="text-xs" style={{ color: up ? 'var(--success-color, #12805c)' : 'var(--error-color)' }}> · {up ? '▲' : '▼'} {Math.abs(diff)} {S.happened.vsBefore}</span>;
}

function Tile({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: '1 1 180px', minWidth: 160, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card)', padding: 14 }}>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
      <div style={{ margin: '6px 0' }}>{children}</div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{help}</div>
    </div>
  );
}

function WhatHappened({ data, onOpenStore }: { data: DashboardData; onOpenStore: (id: number) => void }) {
  const h = data.happened;
  return (
    <Panel title={S.happened.title}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <Tile label={S.happened.orders} help={S.happened.ordersHelp}>
          <span style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{h.orders.current}</span><Arrow t={h.orders} />
        </Tile>
        <Tile label={S.happened.sales} help={S.happened.salesHelp}>
          {h.sales.length === 0 ? <span style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>—</span>
            : h.sales.map((s) => <div key={s.currency} style={{ fontSize: ADMIN_FONT.body, fontWeight: 700 }}>{formatMoney(s.value, s.currency)}</div>)}
        </Tile>
        <Tile label={S.happened.signUps} help={S.happened.signUpsHelp}>
          <span style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{h.signUps.current}</span><Arrow t={h.signUps} />
        </Tile>
        <Tile label={S.happened.signIns} help={S.happened.signInsHelp}>
          <span style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{h.signIns.current}</span><Arrow t={h.signIns} />
        </Tile>
      </div>

      <h4 style={{ fontSize: ADMIN_FONT.body, fontWeight: 700, margin: '18px 0 2px' }}>{S.happened.storesTitle}</h4>
      <p className="text-xs" style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>{S.happened.storesHelp}</p>
      {h.stores.length === 0 ? <div className="text-small" style={{ color: 'var(--text-muted)' }}>{S.happened.noStores}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: ADMIN_FONT.small }}>
            <thead><tr style={{ textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '4px 8px 4px 0' }}>{S.happened.colStore}</th>
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>{S.happened.colOrders}</th>
              <th style={{ padding: '4px 8px', textAlign: 'right' }}>{S.happened.colSales}</th>
              <th style={{ padding: '4px 0 4px 8px' }}>{S.happened.colLastOrder}</th>
            </tr></thead>
            <tbody>
              {h.stores.map((s) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '6px 8px 6px 0' }}>
                    <button type="button" onClick={() => onOpenStore(s.id)} style={linkBtn}>{s.name}</button>
                  </td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{s.orders}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{formatMoney(s.sales, s.currency)}</td>
                  <td style={{ padding: '6px 0 6px 8px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{s.lastOrderAt ? formatDateTime(s.lastOrderAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ fontSize: ADMIN_FONT.body, fontWeight: 700, margin: '18px 0 2px' }}>{S.happened.latestTitle}</h4>
      <p className="text-xs" style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>{S.happened.latestHelp}</p>
      {h.latestOrders.length === 0 ? <div className="text-small" style={{ color: 'var(--text-muted)' }}>{S.happened.noOrders}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {h.latestOrders.map((o) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
              <button type="button" onClick={() => onOpenStore(o.storeId)} style={linkBtn}>{o.storeName}</button>
              <span className="text-xs" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {formatMoney(o.amount, o.currency)} · {titleCase(o.status)} · {formatDateTime(o.at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function NeedsAction({ items, onOpenStore }: { items: AdminDashboardActionItem[]; onOpenStore: (id: number) => void }) {
  return (
    <Panel title={S.needsAction.title} help={S.needsAction.help}>
      {items.length === 0 ? <div className="text-small" style={{ color: 'var(--text-secondary)' }}>{S.needsAction.none}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((a, i) => {
            const rule = S.needsAction.rules[a.kind];
            const problem = (rule?.problem ?? '{name}').replace('{name}', a.name);
            return (
              <div key={`${a.kind}-${a.storeId ?? a.userId}-${i}`} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', paddingTop: i === 0 ? 0 : 8 }}>
                <div style={{ fontSize: ADMIN_FONT.body }}>{problem}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  {rule && <span>{rule.action}</span>}
                  {a.storeId != null && <button type="button" onClick={() => onOpenStore(a.storeId!)} style={{ ...linkBtn, fontSize: ADMIN_FONT.caption }}>Open store</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function DropOff({ steps, onOpenStore }: { steps: AdminDashboardDropStep[]; onOpenStore: (id: number) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <Panel title={S.dropOff.title} help={S.dropOff.help}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {steps.map((s, idx) => {
          const prev = idx > 0 ? steps[idx - 1].count : null;
          const dropped = prev != null ? prev - s.count : 0;
          const expanded = open === s.step;
          return (
            <div key={s.step}>
              <button type="button" onClick={() => setOpen(expanded ? null : s.step)}
                style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                <span className="text-small" style={{ width: 130, color: 'var(--text-secondary)' }}>{S.dropOff.steps[s.step] ?? s.step}</span>
                <span style={{ flex: 1, height: 18, background: 'var(--border-subtle)', borderRadius: 4, overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${(s.count / max) * 100}%`, height: '100%', background: 'var(--primary-solid)' }} />
                </span>
                <span className="text-small" style={{ width: 150, textAlign: 'right' }}>
                  {s.count}{prev != null && dropped > 0 ? <span style={{ color: 'var(--text-muted)' }}> · {dropped} {S.dropOff.dropped}</span> : null}
                </span>
              </button>
              {expanded && (
                <div style={{ margin: '6px 0 6px 142px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {s.stuck.length === 0 ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{S.dropOff.stuckEmpty}</span>
                    : s.stuck.map((e) => e.kind === 'store'
                      ? <button key={`s${e.id}`} type="button" onClick={() => onOpenStore(e.id)} style={{ ...linkBtn, fontSize: ADMIN_FONT.small }}>{e.name}</button>
                      : <span key={`p${e.id}`} className="text-small" style={{ color: 'var(--text-secondary)' }}>{e.name}</span>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function RightNow({ r }: { r: DashboardData['rightNow'] }) {
  const rows: [string, number][] = [
    [S.rightNow.activeStores, r.activeStores],
    [S.rightNow.suspendedStores, r.suspendedStores],
    [S.rightNow.protectedStores, r.protectedStores],
    [S.rightNow.ownersActive7, r.ownersActive7Days],
    [S.rightNow.ownersActive30, r.ownersActive30Days],
  ];
  return (
    <section style={{ border: '2px solid var(--border-strong)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card-subtle, #fafafa)', padding: 16 }}>
      <h3 style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, margin: 0 }}>{S.rightNow.title}</h3>
      <p className="text-xs" style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{S.rightNow.help}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
        {rows.map(([label, n]) => (
          <div key={label} style={{ flex: '1 1 150px', minWidth: 140 }}>
            <div style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{n}</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MoreDetails({ onOpenStore }: { onOpenStore: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card)', padding: 16 }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span><span style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700 }}>{S.moreDetails.title}</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{S.moreDetails.help}</span></span>
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}><AdminAnalytics onOpenStore={onOpenStore} /></div>}
    </section>
  );
}

const linkBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, color: 'var(--primary-solid)', cursor: 'pointer',
  fontWeight: 600, fontSize: 'inherit', textAlign: 'left',
};

function titleCase(status: string): string {
  return status.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}
