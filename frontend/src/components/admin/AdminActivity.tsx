import { useEffect, useMemo, useState } from 'react';
import { adminApi, AdminAuditLogEntry, AdminMerchantSummary, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/adminDatetime';
import { Select } from '../Select';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const PAGE_SIZE = 20;

/** Global admin audit feed: newest first, filterable by store, 20 per page. */
export function AdminActivity() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [stores, setStores] = useState<AdminMerchantSummary[]>([]);
  const [storeFilter, setStoreFilter] = useState(''); // '' = all stores
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stores for the filter dropdown (loaded once).
  useEffect(() => {
    let cancelled = false;
    adminApi.listMerchants()
      .then((list) => { if (!cancelled) setStores(list); })
      .catch(() => { /* non-fatal: the filter just has no store options */ });
    return () => { cancelled = true; };
  }, []);

  // Entries, re-fetched whenever the store filter changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);
    adminApi.auditLog(storeFilter ? Number(storeFilter) : undefined)
      .then((e) => { if (!cancelled) setEntries(e); })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load activity'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeFilter]);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => entries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [entries, currentPage],
  );

  const storeOptions = [
    { value: '', label: 'All stores' },
    ...stores.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <div>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Activity</h2>
      <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '0 0 14px' }}>Changes platform admins made across all stores.</p>

      <div style={{ maxWidth: isMobile ? '100%' : 280, marginBottom: 14 }}>
        <Select value={storeFilter} onChange={setStoreFilter} options={storeOptions} ariaLabel="Filter by store" />
      </div>

      {loading ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading activity…</p>
      ) : error ? (
        <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
      ) : entries.length === 0 ? (
        <p className="text-small" style={{ color: 'var(--text-muted)' }}>No admin activity yet.</p>
      ) : (
        <>
          <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)' }}>
            {pageItems.map((a) => (
              <div key={a.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', gap: isMobile ? 4 : 16, padding: '10px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="text-small" style={{ fontWeight: 600 }}>{a.action}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                    {a.targetType ? `${a.targetType}${a.targetId != null ? ` #${a.targetId}` : ''}` : '-'}
                    {a.merchantId != null ? ` · store #${a.merchantId}` : ''}
                    {a.detail ? ` · ${a.detail}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: isMobile ? 'left' : 'right', flexShrink: 0 }}>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{a.actorEmail}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, entries.length)} of {entries.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}
                style={pagerBtn(currentPage <= 1)}>Prev</button>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Page {currentPage} of {totalPages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                style={pagerBtn(currentPage >= totalPages)}>Next</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '8px 14px', minHeight: 40, borderRadius: 'var(--radius-field)', border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
  };
}
