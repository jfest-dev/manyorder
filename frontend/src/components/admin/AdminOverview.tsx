import { useEffect, useState } from 'react';
import {
  adminApi, ApiError, AdminOverview as AdminOverviewData,
  AdminOverviewAttentionGroup,
} from '../../lib/api';
import { ADMIN_FONT } from './adminTokens';
import { readableAction } from './adminActions';
import { formatDate, formatDateTime } from '../../lib/adminDatetime';
import { AdminAnalytics } from './AdminAnalytics';

interface Props {
  /** Open a store's drill-down from any link in the Overview. */
  onOpenStore: (id: number) => void;
}

/** Admin Overview: range-scoped analytics plus current-state attention, newest, recent actions. */
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
      {/* Range-scoped analytics (value, orders-by-day, breakdown, funnel, stores) with its
          own range selector; everything below is current-state operational context. */}
      <AdminAnalytics onOpenStore={onOpenStore} />
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
