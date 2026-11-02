import { useEffect, useState } from 'react';
import { adminApi, ApiError, AdminOverview as AdminOverviewData } from '../../lib/api';
import { ADMIN_FONT } from './adminTokens';
import { readableAction } from './adminActions';
import { formatDateTime } from '../../lib/adminDatetime';
import { AdminDashboard } from './AdminDashboard';

interface Props {
  /** Open a store's drill-down from any link in the Overview. */
  onOpenStore: (id: number) => void;
}

/** Admin Overview: the plain-words dashboard, plus the recent admin actions list. */
export function AdminOverview({ onOpenStore }: Props) {
  const [data, setData] = useState<AdminOverviewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi.overview()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { /* the dashboard below is the primary surface; recent actions are optional */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 20 }}>
      <AdminDashboard onOpenStore={onOpenStore} />
      {data && <RecentActions actions={data.recentActions} />}
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

function RecentActions({ actions }: { actions: AdminOverviewData['recentActions'] }) {
  // Show a store id only when two different stores share a name in this list.
  const idsByName = new Map<string, Set<number>>();
  for (const a of actions) {
    const name = storeNameOf(a);
    if (name && a.merchantId != null) {
      if (!idsByName.has(name)) idsByName.set(name, new Set());
      idsByName.get(name)!.add(a.merchantId);
    }
  }
  return (
    <Panel title="Recent admin actions">
      {actions.length === 0 ? (
        <div style={{ fontSize: ADMIN_FONT.small, color: 'var(--text-muted)' }}>No admin activity yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {actions.map((a) => {
            const name = storeNameOf(a);
            const ambiguous = !!name && (idsByName.get(name)?.size ?? 0) > 1;
            const storePart = name ? `${name}${ambiguous && a.merchantId != null ? ` #${a.merchantId}` : ''}` : null;
            return (
              <div key={a.id} style={{ minWidth: 0 }}>
                {/* Line 1: plain-words action and the store it was done to. */}
                <div style={{ fontSize: ADMIN_FONT.body }}>
                  {readableAction(a.action)}
                  {storePart ? <span style={{ color: 'var(--text-secondary)' }}> · {storePart}</span> : null}
                </div>
                {/* Line 2: who did it and when. */}
                <div style={{ fontSize: ADMIN_FONT.caption, color: 'var(--text-muted)' }}>
                  {(a.actorName || 'Platform Admin')} · {formatDateTime(a.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function storeNameOf(a: AdminOverviewData['recentActions'][number]): string | null {
  const n = (a.storeName && a.storeName.trim()) || (a.targetLabel && a.targetLabel.trim()) || '';
  return n || null;
}
