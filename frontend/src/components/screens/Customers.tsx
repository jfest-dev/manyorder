import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Download, Plus, X, Filter, Trash2, Pencil } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { FieldInput } from '../Field';
import { Select } from '../Select';
import { Toast } from '../Toast';
import { useConfirm } from '../ConfirmDialog';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { customersApi, CustomerResponse, type CustomerTag, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { TagChip, TAG_COLOR_KEYS, tagColor, DEFAULT_TAG_COLOR } from '../TagChip';

interface CustomersProps {
  storeId: number;
  currency: string;
}

// A customer counts as "active" if they've ordered within this window.
const ACTIVE_WINDOW_DAYS = 90;

// How many customers to show per page in the list.
const PAGE_SIZE = 20;

function isActive(c: CustomerResponse): boolean {
  if (!c.lastOrderAt) return false;
  return Date.now() - new Date(c.lastOrderAt).getTime() <= ACTIVE_WINDOW_DAYS * 86400000;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatusTag({ active }: { active: boolean }) {
  const color = active ? '#10B981' : '#6B7280';
  return (
    <span className="text-tag" style={{
      padding: '4px 8px', borderRadius: '4px', background: `${color}20`, color,
      fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

/** Read-only tag chips shown under a customer's name in the list. */
function TagChips({ tags }: { tags: CustomerTag[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
      {tags.map((t) => <TagChip key={t.name} tag={t} />)}
    </div>
  );
}

export function Customers({ storeId, currency }: CustomersProps) {
  const confirm = useConfirm();
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2200);
  };
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOrders, setFilterOrders] = useState('all');
  const [filterColor, setFilterColor] = useState('all'); // 'all' or a palette key
  const [page, setPage] = useState(1);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ fullName: '', phoneNumber: '', email: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Editing an existing customer (null = closed). Same fields as Add, pre-filled.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phoneNumber: '', email: '', tags: [] as CustomerTag[] });
  const [tagInput, setTagInput] = useState(''); // the in-progress tag being typed in the editor
  const [armedColor, setArmedColor] = useState(DEFAULT_TAG_COLOR); // color the next added tag will take
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null); // tag name whose recolor popover is open
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    customersApi
      .list(storeId)
      .then((res) => { if (!cancelled) setCustomers(res); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load customers'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  };
  useEffect(load, [storeId]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch = q === '' ||
        [c.fullName, c.email, c.phoneNumber ?? ''].some((f) => f.toLowerCase().includes(q));
      const matchesStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && isActive(c)) ||
        (filterStatus === 'inactive' && !isActive(c));
      const n = c.ordersCount;
      const matchesOrders =
        filterOrders === 'all' ||
        (filterOrders === '10+' && n >= 10) ||
        (filterOrders === '5-9' && n >= 5 && n < 10) ||
        (filterOrders === '1-4' && n >= 1 && n < 5);
      const matchesColor =
        filterColor === 'all' || c.tags.some((t) => t.color === filterColor);
      return matchesSearch && matchesStatus && matchesOrders && matchesColor;
    });
  }, [customers, searchQuery, filterStatus, filterOrders, filterColor]);

  // Client-side pagination over the filtered set. Reset to page 1 whenever the
  // search or filters change, and clamp so a shrinking list (e.g. after a
  // delete on the last page) never strands us on an empty page.
  useEffect(() => { setPage(1); }, [searchQuery, filterStatus, filterOrders, filterColor]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Status', 'First Order', 'Joined'];
    const rows = customers.map((c) => [
      c.fullName, c.email, c.phoneNumber ?? '', c.ordersCount, c.totalSpent,
      isActive(c) ? 'Active' : 'Inactive', fmtDate(c.firstOrderAt), fmtDate(c.createdAt),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleAddCustomer = async () => {
    setAddError(null);
    if (!newCustomer.fullName.trim()) { setAddError('Name is required.'); return; }
    if (!newCustomer.phoneNumber.trim()) { setAddError('Phone number is required.'); return; }
    setAdding(true);
    try {
      await customersApi.create(storeId, {
        fullName: newCustomer.fullName.trim(),
        phoneNumber: newCustomer.phoneNumber.trim(),
        email: newCustomer.email.trim() || undefined,
      });
      setShowAddForm(false);
      setNewCustomer({ fullName: '', phoneNumber: '', email: '' });
      load();
    } catch (e: any) {
      setAddError(e instanceof ApiError ? e.message : 'Could not add customer');
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (c: CustomerResponse) => {
    setEditError(null);
    setTagInput('');
    setArmedColor(DEFAULT_TAG_COLOR);
    setColorPickerFor(null);
    setEditingId(c.id);
    setEditForm({ fullName: c.fullName, phoneNumber: c.phoneNumber ?? '', email: c.email ?? '', tags: c.tags ?? [] });
  };

  // Add the typed tag (deduped case-insensitively, trimmed) in the currently armed color.
  const commitTag = () => {
    const name = tagInput.trim();
    if (!name) return;
    setEditForm((s) => (
      s.tags.some((x) => x.name.toLowerCase() === name.toLowerCase())
        ? s
        : { ...s, tags: [...s.tags, { name, color: armedColor }] }
    ));
    setTagInput('');
  };
  const removeTag = (name: string) =>
    setEditForm((s) => ({ ...s, tags: s.tags.filter((x) => x.name !== name) }));
  const setTagColor = (name: string, color: string) => {
    setEditForm((s) => ({ ...s, tags: s.tags.map((x) => (x.name === name ? { ...x, color } : x)) }));
    setColorPickerFor(null);
  };

  const handleUpdateCustomer = async () => {
    if (editingId == null) return;
    setEditError(null);
    if (!editForm.fullName.trim()) { setEditError('Name is required.'); return; }
    if (!editForm.phoneNumber.trim()) { setEditError('Phone number is required.'); return; }
    setSavingEdit(true);
    try {
      const updated = await customersApi.update(storeId, editingId, {
        fullName: editForm.fullName.trim(),
        phoneNumber: editForm.phoneNumber.trim(),
        email: editForm.email.trim() || undefined,
        tags: editForm.tags,
      });
      setCustomers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditingId(null);
      showNotice('Customer updated.');
    } catch (e) {
      setEditError(e instanceof ApiError ? e.message : 'Could not update customer');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (c: CustomerResponse) => {
    const ok = await confirm({
      title: 'Delete customer',
      message: `Permanently delete ${c.fullName} and their personal details? This cannot be undone. Past orders are kept, with the name and contact recorded at the time of each order.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await customersApi.delete(storeId, c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      showNotice('Customer deleted.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not delete customer');
    }
  };

  const waLink = (phone: string | null) => `https://wa.me/${(phone ?? '').replace(/\D/g, '')}`;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Customers</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Everyone who has ordered from this store, plus anyone you add
        </p>
      </div>

      {/* Actions bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by name, phone, or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: '40px', borderRadius: 'var(--radius-field)',
              border: '1px solid var(--border-strong)', background: 'var(--bg-card)',
              paddingLeft: '40px', paddingRight: '12px', fontSize: '13px', outline: 'none', color: 'var(--text-primary)',
            }}
          />
        </div>
        <Button variant="secondary" onClick={() => setShowFilters((v) => !v)}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Filter size={16} /> Filters</span>
        </Button>
        <Button variant="secondary" onClick={handleExport}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Download size={16} /> Export</span>
        </Button>
        <Button variant="primary" onClick={() => { setAddError(null); setShowAddForm(true); }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Plus size={16} /> Add Customer</span>
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '180px' }}>
            <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Status</label>
            <Select value={filterStatus} onChange={setFilterStatus} ariaLabel="Status filter" options={[
              { value: 'all', label: 'All Statuses' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Orders</label>
            <Select value={filterOrders} onChange={setFilterOrders} ariaLabel="Orders filter" options={[
              { value: 'all', label: 'All Orders' },
              { value: '10+', label: '10+ orders' },
              { value: '5-9', label: '5-9 orders' },
              { value: '1-4', label: '1-4 orders' },
            ]} />
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tag color</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: 40 }}>
              <button type="button" onClick={() => setFilterColor('all')} aria-label="Any tag color" aria-pressed={filterColor === 'all'}
                style={{ height: 28, padding: '0 10px', borderRadius: '999px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: 'var(--bg-card)', color: 'var(--text-secondary)',
                  border: filterColor === 'all' ? '2px solid var(--text-primary)' : '1px solid var(--border-strong)' }}>
                All
              </button>
              {TAG_COLOR_KEYS.map((key) => (
                <button key={key} type="button" onClick={() => setFilterColor((cur) => (cur === key ? 'all' : key))}
                  aria-label={`Filter by ${key} tags`} aria-pressed={filterColor === key}
                  style={{ width: 24, height: 24, borderRadius: '50%', background: tagColor(key).text, cursor: 'pointer', padding: 0,
                    border: filterColor === key ? '2px solid var(--text-primary)' : '1px solid rgba(0,0,0,0.15)' }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <Card>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }} className="text-small">Loading customers…</div>
        ) : error ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--error-color)' }} className="text-small">{error}</div>
        ) : customers.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No customers yet. They appear here once someone orders, or add one manually.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No customers match your search or filters.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="desktop-table" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card-subtle)' }}>
                    {['Customer', 'Contact', 'Orders', 'Total Spent', 'Status', 'Joined', ''].map((h, i) => (
                      <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>
                        {c.fullName}
                        <TagChips tags={c.tags} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <div>{c.phoneNumber || '—'}</div>
                        {c.email ? <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.email}</div> : null}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{c.ordersCount}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{formatMoney(c.totalSpent, currency)}</td>
                      <td style={{ padding: '12px 16px' }}><StatusTag active={isActive(c)} /></td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtDate(c.createdAt)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                          {c.phoneNumber && (
                            <a href={waLink(c.phoneNumber)} target="_blank" rel="noopener noreferrer" aria-label={`Message ${c.fullName} on WhatsApp`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                              <WhatsAppIcon size={16} color="#6B7280" /> Message
                            </a>
                          )}
                          <button onClick={() => openEdit(c)} aria-label={`Edit ${c.fullName}`} title="Edit customer"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'inline-flex' }}>
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDelete(c)} aria-label={`Delete ${c.fullName}`} title="Delete customer"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'inline-flex' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-cards" style={{ display: 'none' }}>
              {pageItems.map((c) => (
                <div key={c.id} style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-subtle)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="text-small" style={{ fontWeight: 500, marginBottom: '4px' }}>{c.fullName}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.phoneNumber || '—'}{c.email ? ` · ${c.email}` : ''}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '2px' }}>Joined {fmtDate(c.createdAt)}</div>
                      <TagChips tags={c.tags} />
                    </div>
                    <StatusTag active={isActive(c)} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.ordersCount} orders · {formatMoney(c.totalSpent, currency)}</span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '16px' }}>
                      {c.phoneNumber && (
                        <a href={waLink(c.phoneNumber)} target="_blank" rel="noopener noreferrer" aria-label={`Message ${c.fullName} on WhatsApp`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                          <WhatsAppIcon size={16} color="#6B7280" /> Message
                        </a>
                      )}
                      <button onClick={() => openEdit(c)} aria-label={`Edit ${c.fullName}`} title="Edit customer"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'inline-flex' }}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(c)} aria-label={`Delete ${c.fullName}`} title="Delete customer"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'inline-flex' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <style>{`
              @media (max-width: 768px) {
                .desktop-table { display: none !important; }
                .mobile-cards { display: block !important; }
              }
            `}</style>
          </>
        )}
      </Card>

      {/* Total count + pagination (mirrors the Products/Orders footer). */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Total {filtered.length} customer{filtered.length === 1 ? '' : 's'}
          </span>
          {totalPages > 1 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
              <Button variant="secondary" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1}>Prev</Button>
              <span className="text-small" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Page {currentPage} of {totalPages}</span>
              <Button variant="secondary" onClick={() => setPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages}>Next</Button>
            </div>
          )}
        </div>
      )}

      {/* Add Customer modal */}
      {showAddForm && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !adding && setShowAddForm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-medium)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-overlay)', width: '100%', maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Add Customer</h3>
              <button onClick={() => !adding && setShowAddForm(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FieldInput label="Name" value={newCustomer.fullName} onChange={(v) => setNewCustomer((s) => ({ ...s, fullName: v }))} maxLength={255} required />
              <FieldInput label="Phone" placeholder="+65 8123 4567" value={newCustomer.phoneNumber} onChange={(v) => setNewCustomer((s) => ({ ...s, phoneNumber: v }))} maxLength={255} helperText="Used to reach the customer on WhatsApp, and to avoid duplicates." required />
              <FieldInput label="Email" type="email" value={newCustomer.email} onChange={(v) => setNewCustomer((s) => ({ ...s, email: v }))} maxLength={255} helperText="Optional." />
              {addError && <p className="text-small" style={{ color: 'var(--error-color)', margin: 0 }}>{addError}</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <Button variant="ghost" onClick={() => setShowAddForm(false)} disabled={adding}>Cancel</Button>
              <Button variant="primary" onClick={handleAddCustomer} disabled={adding}>{adding ? 'Adding…' : 'Add Customer'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer modal */}
      {editingId != null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => !savingEdit && setEditingId(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-medium)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-overlay)', width: '100%', maxWidth: '420px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Edit Customer</h3>
              <button onClick={() => !savingEdit && setEditingId(null)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <FieldInput label="Name" value={editForm.fullName} onChange={(v) => setEditForm((s) => ({ ...s, fullName: v }))} maxLength={255} required />
              <FieldInput label="Phone" placeholder="+65 8123 4567" value={editForm.phoneNumber} onChange={(v) => setEditForm((s) => ({ ...s, phoneNumber: v }))} maxLength={255} required />
              <FieldInput label="Email (optional)" type="email" value={editForm.email} onChange={(v) => setEditForm((s) => ({ ...s, email: v }))} maxLength={255} />

              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Tags</label>
                {editForm.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {editForm.tags.map((t) => {
                      const c = tagColor(t.color);
                      return (
                        <span key={t.name} style={{
                          position: 'relative', display: 'inline-flex', alignItems: 'center',
                          borderRadius: '999px', background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                          fontSize: '12px', fontWeight: 600,
                        }}>
                          <button type="button" onClick={() => setColorPickerFor((cur) => (cur === t.name ? null : t.name))} aria-label={`Change color of ${t.name}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: '3px 4px 3px 9px' }}>
                            {t.name}
                          </button>
                          <button type="button" onClick={() => removeTag(t.name)} aria-label={`Remove ${t.name}`}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.text, padding: '3px 8px 3px 2px', display: 'inline-flex', alignItems: 'center', opacity: 0.7 }}>
                            <X size={13} />
                          </button>
                          {colorPickerFor === t.name && (
                            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10, display: 'flex', gap: '6px', padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: '10px', boxShadow: 'var(--shadow-overlay)' }}>
                              {TAG_COLOR_KEYS.map((key) => (
                                <button key={key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setTagColor(t.name, key)} aria-label={key}
                                  style={{ width: 18, height: 18, borderRadius: '50%', background: tagColor(key).text, cursor: 'pointer', padding: 0, border: t.color === key ? '2px solid var(--text-primary)' : '1px solid rgba(0,0,0,0.15)' }} />
                              ))}
                            </div>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  {TAG_COLOR_KEYS.map((key) => (
                    <button key={key} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setArmedColor(key)} aria-label={`Use ${key} for the next tag`} aria-pressed={armedColor === key}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: tagColor(key).text, cursor: 'pointer', padding: 0, border: armedColor === key ? '2px solid var(--text-primary)' : '1px solid rgba(0,0,0,0.15)' }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTag(); }
                      else if (e.key === 'Backspace' && tagInput === '' && editForm.tags.length > 0) {
                        removeTag(editForm.tags[editForm.tags.length - 1].name);
                      }
                    }}
                    onBlur={commitTag}
                    maxLength={30}
                    placeholder="Add a tag"
                    style={{
                      flex: 1, minWidth: 0, height: 40, padding: '0 12px', boxSizing: 'border-box',
                      border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)',
                      background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                    }}
                  />
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={commitTag} disabled={!tagInput.trim()} aria-label="Add tag"
                    style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--radius-field)', border: '1px solid var(--border-strong)', background: 'var(--bg-card)', cursor: tagInput.trim() ? 'pointer' : 'not-allowed', color: tagInput.trim() ? 'var(--text-primary)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              <p className="text-xs" style={{ color: 'var(--text-muted)', margin: 0 }}>Changes apply going forward.</p>
              {editError && <p className="text-small" style={{ color: 'var(--error-color)', margin: 0 }}>{editError}</p>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <Button variant="ghost" onClick={() => setEditingId(null)} disabled={savingEdit}>Cancel</Button>
              <Button variant="primary" onClick={handleUpdateCustomer} disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save Changes'}</Button>
            </div>
          </div>
        </div>
      )}

      {notice && <Toast message={notice} />}
    </div>
  );
}
