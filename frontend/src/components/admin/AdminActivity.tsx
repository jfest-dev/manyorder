import { useEffect, useState } from 'react';
import { adminApi, AdminAuditLogEntry, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/adminDatetime';

/** Global admin audit feed, newest first. Store filter + paging are added in a later step. */
export function AdminActivity() {
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi.auditLog()
      .then((e) => { if (!cancelled) setEntries(e); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load activity'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Activity</h2>
      <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '0 0 14px' }}>Changes platform admins made across all stores.</p>

      {loading ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading activity…</p>
      ) : error ? (
        <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>No admin activity yet.</p>
      ) : (
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)' }}>
          {entries.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 14px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="text-small" style={{ fontWeight: 600 }}>{a.action}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a.targetType ? `${a.targetType}${a.targetId != null ? ` #${a.targetId}` : ''}` : '-'}
                  {a.merchantId != null ? ` · store #${a.merchantId}` : ''}
                  {a.detail ? ` · ${a.detail}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a.actorEmail}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(a.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
