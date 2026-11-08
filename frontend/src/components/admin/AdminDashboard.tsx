import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  adminApi, ApiError, AdminDashboard as DashboardData, AdminDashboardRange,
  AdminDashboardTrend, AdminDashboardActionItem, AdminDashboardDropStep, AdminDashboardEntity,
} from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { formatDateTime } from '../../lib/adminDatetime';
import { ADMIN_FONT } from './adminTokens';
import { ADMIN_STRINGS as S } from './adminStrings';
import { DatePicker } from '../DatePicker';
import { waLink } from '../../lib/whatsapp';
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
  const [detailsOpen, setDetailsOpen] = useState(false);

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
      {/* Date-independent live counts, at the top, with More details at the top right. */}
      {data && <RightNow r={data.rightNow} onOpenStore={onOpenStore} detailsOpen={detailsOpen} onToggleDetails={() => setDetailsOpen((v) => !v)} />}
      <Dates range={range} setRange={setRange} from={from} setFrom={setFrom} to={to} setTo={setTo} customMsg={customMsg} />
      {error ? <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
        : !data ? <p className="text-small" style={{ color: 'var(--text-secondary)' }}>{S.loading}</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, opacity: loading ? 0.6 : 1 }}>
            <WhatHappened data={data} onOpenStore={onOpenStore} />
            <NeedsAction items={data.needsAction} onOpenStore={onOpenStore} />
            <DropOff steps={data.dropOff} onOpenStore={onOpenStore} />
            {detailsOpen && (
              <section style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card)', padding: 16 }}>
                <div style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, marginBottom: 12 }}>{S.moreDetails.title}</div>
                <AdminAnalytics onOpenStore={onOpenStore} />
              </section>
            )}
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

/** "Reminded N days ago" from an ISO timestamp (server local time). */
function remindedAgo(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Reminded today';
  return days === 1 ? 'Reminded 1 day ago' : `Reminded ${days} days ago`;
}

export function NeedsAction({ items, onOpenStore }: { items: AdminDashboardActionItem[]; onOpenStore: (id: number) => void }) {
  // Per-store reminder state (set by the Email reminder button). The admin is otherwise
  // read-only: these two buttons are the only writes, and WhatsApp makes no server call.
  const [remind, setRemind] = useState<Record<number, { at?: string; busy?: boolean; msg?: string }>>({});

  const sendEmailReminder = async (storeId: number) => {
    setRemind((p) => ({ ...p, [storeId]: { ...p[storeId], busy: true, msg: undefined } }));
    try {
      const res = await adminApi.remindOwner(storeId);
      setRemind((p) => ({ ...p, [storeId]: { at: res.remindedAt, busy: false, msg: res.emailSent ? 'Reminder emailed.' : 'Recorded (email not configured here).' } }));
    } catch (e) {
      setRemind((p) => ({ ...p, [storeId]: { ...p[storeId], busy: false, msg: e instanceof ApiError ? e.message : 'Could not send the reminder.' } }));
    }
  };
  const openWhatsappReminder = (name: string, phone: string) => {
    const url = waLink(phone, `Hi! A quick reminder from ManyOrder about your store ${name}: open it to add your first product and start taking orders.`);
    if (url) window.open(url, '_blank', 'noopener');
  };

  return (
    <Panel title={S.needsAction.title} help={S.needsAction.help}>
      {items.length === 0 ? <div className="text-small" style={{ color: 'var(--text-secondary)' }}>{S.needsAction.none}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((a, i) => {
            const rule = S.needsAction.rules[a.kind];
            const problem = (rule?.problem ?? '{name}').replace('{name}', a.name);
            const local = a.storeId != null ? remind[a.storeId] : undefined;
            const remindedAt = local?.at ?? a.lastRemindedAt;
            return (
              <div key={`${a.kind}-${a.storeId ?? a.userId}-${i}`} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', paddingTop: i === 0 ? 0 : 8 }}>
                <div style={{ fontSize: ADMIN_FONT.body }}>{problem}</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  {rule && <span>{rule.action}</span>}
                  {a.storeId != null && <button type="button" onClick={() => onOpenStore(a.storeId!)} style={{ ...linkBtn, fontSize: ADMIN_FONT.caption }}>Open store</button>}
                  {a.storeId != null && a.ownerEmail && (
                    <button type="button" disabled={local?.busy} onClick={() => sendEmailReminder(a.storeId!)} style={{ ...linkBtn, fontSize: ADMIN_FONT.caption }}>
                      {local?.busy ? 'Sending…' : 'Email reminder'}
                    </button>
                  )}
                  {a.ownerPhone && (
                    <button type="button" onClick={() => openWhatsappReminder(a.name, a.ownerPhone!)} style={{ ...linkBtn, fontSize: ADMIN_FONT.caption }}>WhatsApp reminder</button>
                  )}
                  {remindedAt && <span style={{ color: 'var(--text-muted)' }}>{remindedAgo(remindedAt)}</span>}
                  {local?.msg && <span style={{ color: 'var(--text-muted)' }}>{local.msg}</span>}
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

/** Date-independent live counts as a row of tiles at the top of the dashboard. Each
 *  tile opens the list of names behind its number; "More details" sits at the top right. */
function RightNow({ r, onOpenStore, detailsOpen, onToggleDetails }: {
  r: DashboardData['rightNow']; onOpenStore: (id: number) => void; detailsOpen: boolean; onToggleDetails: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const tiles: { key: string; label: string; n: number; list: AdminDashboardEntity[] }[] = [
    { key: 'active', label: S.rightNow.activeStores, n: r.activeStores, list: r.activeStoreList },
    { key: 'suspended', label: S.rightNow.suspendedStores, n: r.suspendedStores, list: r.suspendedStoreList },
    { key: 'protected', label: S.rightNow.protectedStores, n: r.protectedStores, list: r.protectedStoreList },
    { key: 'o7', label: S.rightNow.ownersActive7, n: r.ownersActive7Days, list: r.ownersActive7List },
    { key: 'o30', label: S.rightNow.ownersActive30, n: r.ownersActive30Days, list: r.ownersActive30List },
  ];
  const current = tiles.find((t) => t.key === open);
  return (
    <section style={{ border: '2px solid var(--border-strong)', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card-subtle, #fafafa)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <h3 style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, margin: 0 }}>{S.rightNow.title}</h3>
        <button type="button" onClick={onToggleDetails} aria-expanded={detailsOpen} style={{ ...linkBtn, fontSize: ADMIN_FONT.body, whiteSpace: 'nowrap' }}>
          {S.moreDetails.title} <span aria-hidden>{detailsOpen ? '▴' : '▾'}</span>
        </button>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-secondary)', margin: '4px 0 12px' }}>{S.rightNow.help}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {tiles.map((t) => {
          const on = open === t.key;
          return (
            <button key={t.key} type="button" aria-expanded={on} aria-label={`${t.label}: ${t.n}`} onClick={() => setOpen(on ? null : t.key)}
              style={{ flex: '1 1 150px', minWidth: 140, textAlign: 'left', cursor: 'pointer',
                background: on ? 'var(--bg-card)' : 'transparent',
                border: on ? '1px solid var(--primary-solid)' : '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-field)', padding: 12 }}>
              <div style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800 }}>{t.n}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.label}</div>
            </button>
          );
        })}
      </div>
      {current && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
          {current.list.length === 0 ? (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No names to show.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
              {current.list.map((e) => e.kind === 'store'
                ? <button key={`s-${e.id}`} type="button" onClick={() => onOpenStore(e.id)} style={{ ...linkBtn, fontSize: ADMIN_FONT.caption }}>{e.name}</button>
                : <span key={`u-${e.id}`} className="text-xs" style={{ color: 'var(--text-secondary)' }}>{e.name}</span>)}
            </div>
          )}
          {current.n > current.list.length && (
            <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 6 }}>+{current.n - current.list.length} more</div>
          )}
        </div>
      )}
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
