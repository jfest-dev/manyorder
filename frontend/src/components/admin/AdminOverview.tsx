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
  return (
    <Panel title="Recent admin actions">
      {actions.length === 0 ? (
        <div style={{ fontSize: ADMIN_FONT.small, color: 'var(--text-muted)' }}>No admin activity yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {actions.map((a) => {
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
