import { useEffect, useState } from 'react';
import { adminApi, AdminMerchantPage, AdminMerchantSummary, ApiError } from '../../lib/api';
import { Select } from '../Select';

const PAGE_SIZE = 20;

const STATUS_STYLE: Record<AdminMerchantSummary['status'], { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#ECFDF5', color: '#047857', label: 'Active' },
  SUSPENDED: { bg: '#FEE2E2', color: '#B91C1C', label: 'Suspended' },
  ARCHIVED: { bg: '#F3F4F6', color: '#4B5563', label: 'Archived' },
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'ARCHIVED', label: 'Archived' },
];
const CURRENCY_OPTIONS = [
  { value: '', label: 'All currencies' },
  { value: 'SGD', label: 'SGD' },
  { value: 'IDR', label: 'IDR' },
];
const BUSINESS_TYPE_OPTIONS = [
  { value: '', label: 'All business types' },
  { value: 'Food & Beverage', label: 'Food & Beverage' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Services', label: 'Services' },
  { value: 'Other', label: 'Other' },
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'orders', label: 'Most orders' },
  { value: 'latest', label: 'Latest order' },
  { value: 'name', label: 'Name' },
];

interface Props {
  onView: (m: AdminMerchantSummary) => void;
  onToggleSuspend: (m: AdminMerchantSummary) => void;
  busyId: number | null;
  /** Bump to force a re-fetch (e.g. after a suspend/unsuspend elsewhere). */
  reloadToken: number;
}

/** Admin Merchants screen: server-side search, filters, sort and paging. */
export function MerchantsList({ onView, onToggleSuspend, busyId, reloadToken }: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [currency, setCurrency] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminMerchantPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search box so we don't fire a request per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => { setQ(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    adminApi.searchMerchants({ q, status, currency, businessType, sort, page, size: PAGE_SIZE })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load merchants'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, status, currency, businessType, sort, page, reloadToken]);

  // Filter/sort changes always return to the first page.
  const onFilter = (set: (v: string) => void) => (v: string) => { set(v); setPage(1); };

  const total = data?.totalElements ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;
  const rows = data?.content ?? [];

  return (
    <>
      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 12px' }}>Merchants</h2>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search name, slug or owner"
          aria-label="Search merchants"
          style={{ flex: '1 1 220px', minWidth: 200, height: 32, padding: '0 12px', fontSize: 13,
            border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)',
            background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }}
        />
        <div style={{ width: 150 }}>
          <Select value={status} onChange={onFilter(setStatus)} options={STATUS_OPTIONS} ariaLabel="Filter by status" height={32} />
        </div>
        <div style={{ width: 140 }}>
          <Select value={currency} onChange={onFilter(setCurrency)} options={CURRENCY_OPTIONS} ariaLabel="Filter by currency" height={32} />
        </div>
        <div style={{ width: 170 }}>
          <Select value={businessType} onChange={onFilter(setBusinessType)} options={BUSINESS_TYPE_OPTIONS} ariaLabel="Filter by business type" height={32} />
        </div>
        <div style={{ width: 150 }}>
          <Select value={sort} onChange={onFilter(setSort)} options={SORT_OPTIONS} ariaLabel="Sort by" height={32} />
        </div>
      </div>

      {error ? (
        <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
      ) : loading && !data ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card-subtle)' }}>
                  {['Store', 'Owner', 'Status', 'Products', 'Orders', 'Customers', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 500, color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const s = STATUS_STYLE[m.status];
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600 }}>{m.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>/{m.slug}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{m.ownerEmail}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color, fontSize: 11, fontWeight: 600 }}>{s.label}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>{m.productCount}</td>
                      <td style={{ padding: '10px 14px' }}>{m.orderCount}</td>
                      <td style={{ padding: '10px 14px' }}>{m.customerCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => onView(m)} aria-label={`View ${m.name}`}
                          style={{ marginRight: 12, background: 'none', border: 'none', color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600 }}>
                          View
                        </button>
                        <button type="button" onClick={() => onToggleSuspend(m)} disabled={busyId === m.id || m.status === 'ARCHIVED'}
                          aria-label={`${m.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'} ${m.name}`}
                          style={{ background: 'none', border: 'none', cursor: m.status === 'ARCHIVED' ? 'not-allowed' : 'pointer',
                            color: m.status === 'SUSPENDED' ? '#047857' : '#B91C1C', fontWeight: 600, opacity: busyId === m.id ? 0.5 : 1 }}>
                          {m.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: '16px', color: 'var(--text-secondary)' }}>No stores match your search</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12 }}>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, total)} of {total}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}
                  style={pagerBtn(currentPage <= 1)}>Prev</button>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Page {currentPage} of {totalPages}</span>
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}
                  style={pagerBtn(currentPage >= totalPages)}>Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function pagerBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 'var(--radius-field)', border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
  };
}
