import { useEffect, useMemo, useState } from 'react';
import { adminApi, AdminAuditLogEntry, AdminMerchantSummary, ApiError } from '../../lib/api';
import { formatDateTime } from '../../lib/adminDatetime';
import { Select } from '../Select';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ADMIN_FONT } from './adminTokens';

const PAGE_SIZE = 20;

/** Readable names for the audit action codes. Unknown codes fall back to the raw code. */
const ACTION_LABEL: Record<string, string> = {
  SUSPEND_MERCHANT: 'Suspended store',
  UNSUSPEND_MERCHANT: 'Reinstated store',
  DEACTIVATE_PRODUCT: 'Hid product',
  ACTIVATE_PRODUCT: 'Unhid product',
  DEACTIVATE_DISCOUNT: 'Switched off discount',
  ACTIVATE_DISCOUNT: 'Switched on discount',
  CREATE_PRODUCT: 'Added product',
  UPDATE_PRODUCT: 'Edited product',
  DELETE_PRODUCT: 'Deleted product',
  REORDER_PRODUCTS: 'Reordered products',
  CREATE_CUSTOMER: 'Added customer',
  UPDATE_CUSTOMER: 'Edited customer',
  DELETE_CUSTOMER: 'Deleted customer',
  CREATE_DISCOUNT: 'Created discount',
  UPDATE_DISCOUNT: 'Edited discount',
  DELETE_DISCOUNT: 'Deleted discount',
  REORDER_DISCOUNTS: 'Reordered discounts',
};
const readableAction = (code: string) => ACTION_LABEL[code] ?? code;

interface Props {
  /** Open a store's drill-down from an Activity row. */
  onOpenStore: (id: number) => void;
}

/** Global admin audit feed: newest first, filterable by store, 20 per page, readable. */
export function AdminActivity({ onOpenStore }: Props) {
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

  // Current store name by id, to fill in old rows that have no snapshot.
  const storeNameById = useMemo(() => {
    const m = new Map<number, string>();
    stores.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [stores]);

  const storeNameFor = (a: AdminAuditLogEntry): string | null => {
    if (a.storeName && a.storeName.trim() !== '') return a.storeName;
    if (a.merchantId != null) return storeNameById.get(a.merchantId) ?? `Store #${a.merchantId}`;
    return null;
  };

  return (
    <div>
      <h2 style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, margin: '0 0 4px' }}>Activity</h2>
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
            {pageItems.map((a) => {
              const storeName = storeNameFor(a);
              return (
              <div key={a.id} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                justifyContent: 'space-between', gap: isMobile ? 4 : 16, padding: '10px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="text-small" style={{ fontWeight: 600 }}>
                    {readableAction(a.action)}
                    {a.targetLabel ? <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}> · {a.targetLabel}</span> : null}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)', wordBreak: 'break-word' }}>
                    {storeName && a.merchantId != null ? (
                      <button type="button" onClick={() => onOpenStore(a.merchantId!)}
                        style={{ background: 'none', border: 'none', padding: 0, color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600, fontSize: 'inherit' }}>
                        {storeName}
                      </button>
                    ) : (storeName ?? '-')}
                    {a.detail ? <span> · {a.detail}</span> : null}
                  </div>
                </div>
                <div style={{ textAlign: isMobile ? 'left' : 'right', flexShrink: 0 }}>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{a.actorEmail}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatDateTime(a.createdAt)}
                    {a.emailSent === true ? ' · emailed owner' : a.emailSent === false ? ' · no email' : ''}
                  </div>
                </div>
              </div>
              );
            })}
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
    fontSize: ADMIN_FONT.body, fontWeight: 600, color: 'var(--text-primary)',
  };
}
