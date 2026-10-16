import { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { adminApi, AdminMerchantPage, AdminMerchantSummary, ApiError } from '../../lib/api';
import { Select, SelectOption } from '../Select';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { ADMIN_FONT, ADMIN_SIZE } from './adminTokens';
import { BUSINESS_TYPES } from '../../lib/storeFields';

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
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [showFilters, setShowFilters] = useState(false);
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
  const [extraTypes, setExtraTypes] = useState<string[]>([]);

  // The filter offers the shared six, then any other values found in stores
  // (legacy types), grouped under an "Other values" header.
  const businessTypeFilterOptions = useMemo<SelectOption[]>(() => {
    const six = BUSINESS_TYPES.map((o) => o.value);
    const others = extraTypes.filter((v) => !six.includes(v));
    const opts: SelectOption[] = [
      { value: '', label: 'All business types' },
      ...BUSINESS_TYPES,
    ];
    if (others.length > 0) {
      opts.push({ value: '__other_header__', label: 'Other values', disabled: true });
      others.forEach((v) => opts.push({ value: v, label: v }));
    }
    return opts;
  }, [extraTypes]);

  // Load the distinct business-type values once, for the filter's "Other values".
  useEffect(() => {
    let cancelled = false;
    adminApi.businessTypes()
      .then((list) => { if (!cancelled) setExtraTypes(list); })
      .catch(() => { /* non-fatal: the filter just shows the shared six */ });
    return () => { cancelled = true; };
  }, []);

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
      <h2 style={{ fontSize: ADMIN_FONT.heading, fontWeight: 700, margin: '0 0 12px' }}>Merchants</h2>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, slug or owner"
            aria-label="Search merchants"
            style={{ flex: 1, minWidth: 0, height: isMobile ? ADMIN_SIZE.tapTarget : ADMIN_SIZE.controlHeight, padding: '0 12px', fontSize: ADMIN_FONT.body,
              border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)',
              background: 'var(--bg-card)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }}
          />
          {isMobile && (
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-label="Filters"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: ADMIN_SIZE.tapTarget, padding: '0 12px', flexShrink: 0,
                border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)', background: 'var(--bg-card)',
                color: 'var(--text-primary)', fontSize: ADMIN_FONT.body, fontWeight: 600, cursor: 'pointer' }}>
              <SlidersHorizontal size={15} /> Filters
            </button>
          )}
        </div>

        {(!isMobile || showFilters) && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
            <div style={{ width: isMobile ? 'auto' : 150 }}>
              <Select value={status} onChange={onFilter(setStatus)} options={STATUS_OPTIONS} ariaLabel="Filter by status" height={isMobile ? ADMIN_SIZE.tapTarget : ADMIN_SIZE.controlHeight} />
            </div>
            <div style={{ width: isMobile ? 'auto' : 140 }}>
              <Select value={currency} onChange={onFilter(setCurrency)} options={CURRENCY_OPTIONS} ariaLabel="Filter by currency" height={isMobile ? ADMIN_SIZE.tapTarget : ADMIN_SIZE.controlHeight} />
            </div>
            <div style={{ width: isMobile ? 'auto' : 170 }}>
              <Select value={businessType} onChange={onFilter(setBusinessType)} options={businessTypeFilterOptions} ariaLabel="Filter by business type" height={isMobile ? ADMIN_SIZE.tapTarget : ADMIN_SIZE.controlHeight} />
            </div>
            <div style={{ width: isMobile ? 'auto' : 150 }}>
              <Select value={sort} onChange={onFilter(setSort)} options={SORT_OPTIONS} ariaLabel="Sort by" height={isMobile ? ADMIN_SIZE.tapTarget : ADMIN_SIZE.controlHeight} />
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
      ) : loading && !data ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
      ) : (
        <>
          {rows.length === 0 ? (
            <p className="text-small" style={{ color: 'var(--text-secondary)', padding: '8px 0' }}>No stores match your search</p>
          ) : isMobile ? (
            <div>
              {rows.map((m) => {
                const s = STATUS_STYLE[m.status];
                const archived = m.status === 'ARCHIVED';
                return (
                  <div key={m.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{m.name}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)', wordBreak: 'break-all' }}>/{m.slug}</div>
                      </div>
                      <span style={{ flexShrink: 0, padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color, fontSize: ADMIN_FONT.caption, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)', wordBreak: 'break-all', marginTop: 6 }}>{m.ownerEmail}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 6 }}>
                      {m.productCount} products · {m.orderCount} orders · {m.customerCount} customers
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button type="button" onClick={() => onView(m)} aria-label={`View ${m.name}`}
                        style={{ flex: 1, minHeight: 44, borderRadius: 'var(--radius-field)', border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-card)', color: 'var(--primary-solid)', fontWeight: 600, cursor: 'pointer' }}>
                        View
                      </button>
                      <button type="button" onClick={() => onToggleSuspend(m)} disabled={busyId === m.id || archived}
                        aria-label={`${m.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'} ${m.name}`}
                        style={{ flex: 1, minHeight: 44, borderRadius: 'var(--radius-field)', border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-card)', cursor: archived ? 'not-allowed' : 'pointer',
                          color: m.status === 'SUSPENDED' ? '#047857' : '#B91C1C', fontWeight: 600, opacity: busyId === m.id ? 0.5 : 1 }}>
                        {m.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: ADMIN_FONT.body }}>
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
                          <span style={{ padding: '2px 8px', borderRadius: 999, background: s.bg, color: s.color, fontSize: ADMIN_FONT.caption, fontWeight: 600 }}>{s.label}</span>
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
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
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
    padding: '8px 14px', minHeight: 40, borderRadius: 'var(--radius-field)', border: '1px solid var(--border-subtle)',
    background: 'var(--bg-card)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    fontSize: ADMIN_FONT.body, fontWeight: 600, color: 'var(--text-primary)',
  };
}
