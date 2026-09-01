import { useEffect, useMemo, useState } from 'react';
import { Search, Download, Plus, X, Filter } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { FieldInput } from '../Field';
import { Select } from '../Select';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
import { customersApi, CustomerResponse, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';

interface CustomersProps {
  storeId: number;
  currency: string;
}

// A customer counts as "active" if they've ordered within this window.
const ACTIVE_WINDOW_DAYS = 90;

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

export function Customers({ storeId, currency }: CustomersProps) {
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOrders, setFilterOrders] = useState('all');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ fullName: '', phoneNumber: '', email: '' });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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
      return matchesSearch && matchesStatus && matchesOrders;
    });
  }, [customers, searchQuery, filterStatus, filterOrders]);

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
                  {filtered.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{c.fullName}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <div>{c.phoneNumber || '—'}</div>
                        {c.email ? <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.email}</div> : null}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{c.ordersCount}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{formatMoney(c.totalSpent, currency)}</td>
                      <td style={{ padding: '12px 16px' }}><StatusTag active={isActive(c)} /></td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtDate(c.createdAt)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {c.phoneNumber && (
                          <a href={waLink(c.phoneNumber)} target="_blank" rel="noopener noreferrer" aria-label={`Message ${c.fullName} on WhatsApp`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                            <WhatsAppIcon size={16} color="#6B7280" /> Message
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mobile-cards" style={{ display: 'none' }}>
              {filtered.map((c) => (
                <div key={c.id} style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-subtle)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="text-small" style={{ fontWeight: 500, marginBottom: '4px' }}>{c.fullName}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.phoneNumber || '—'}{c.email ? ` · ${c.email}` : ''}</div>
                    </div>
                    <StatusTag active={isActive(c)} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.ordersCount} orders · {formatMoney(c.totalSpent, currency)}</span>
                    {c.phoneNumber && (
                      <a href={waLink(c.phoneNumber)} target="_blank" rel="noopener noreferrer" aria-label={`Message ${c.fullName} on WhatsApp`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}>
                        <WhatsAppIcon size={16} color="#6B7280" /> Message
                      </a>
                    )}
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
    </div>
  );
}
