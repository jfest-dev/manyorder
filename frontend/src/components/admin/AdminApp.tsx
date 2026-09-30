import { useEffect, useState } from 'react';
import { adminApi, AdminMetrics, AdminMerchantSummary, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../ConfirmDialog';
import { Button } from '../Button';
import { Toast } from '../Toast';
import { Customers } from '../screens/Customers';
import { ProductsList } from '../screens/ProductsList';

const STATUS_STYLE: Record<AdminMerchantSummary['status'], { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#ECFDF5', color: '#047857', label: 'Active' },
  SUSPENDED: { bg: '#FEE2E2', color: '#B91C1C', label: 'Suspended' },
  ARCHIVED: { bg: '#F3F4F6', color: '#4B5563', label: 'Archived' },
};

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 140, padding: '16px', borderRadius: 'var(--radius-medium)',
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Platform Admin console: cross-merchant metrics + merchant list with suspend/unsuspend
 *  and drill-down. Reached only when the authenticated user's role is PLATFORM_ADMIN. */
export function AdminApp() {
  const { user, logout } = useAuth();
  const confirm = useConfirm();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [merchants, setMerchants] = useState<AdminMerchantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminMerchantSummary | null>(null);
  const [tab, setTab] = useState<'customers' | 'products' | 'orders' | 'marketing'>('customers');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([adminApi.metrics(), adminApi.listMerchants()])
      .then(([m, list]) => { setMetrics(m); setMerchants(list); })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load admin data'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const showNotice = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 2400); };

  const toggleSuspend = async (m: AdminMerchantSummary) => {
    const suspend = m.status !== 'SUSPENDED';
    const ok = await confirm({
      title: suspend ? `Suspend ${m.name}?` : `Unsuspend ${m.name}?`,
      message: suspend
        ? 'This hides their storefront and blocks the owner (and staff) from signing in until you lift it.'
        : 'This restores their storefront and lets the owner sign in again.',
      confirmLabel: suspend ? 'Suspend' : 'Unsuspend',
      tone: suspend ? 'danger' : 'default',
    });
    if (!ok) return;
    setBusyId(m.id);
    try {
      await (suspend ? adminApi.suspend(m.id) : adminApi.unsuspend(m.id));
      showNotice(suspend ? `${m.name} suspended.` : `${m.name} unsuspended.`);
      load();
    } catch (e) {
      showNotice(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 16 }}>Platform Admin</strong>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cross-store administration</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user?.email}</span>
          <Button variant="secondary" onClick={logout}>Log out</Button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px' }}>
        {loading && <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
        {error && <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>}

        {!selected && !loading && !error && metrics && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <Tile label="Merchants" value={metrics.totalMerchants} />
              <Tile label="Active" value={metrics.activeMerchants} />
              <Tile label="Suspended" value={metrics.suspendedMerchants} />
              <Tile label="Archived" value={metrics.archivedMerchants} />
              <Tile label="Orders" value={metrics.totalOrders} />
              <Tile label="Customers" value={metrics.totalCustomers} />
              <Tile label="New (30d)" value={metrics.newMerchantsLast30Days} />
            </div>

            <h2 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 10px' }}>Merchants</h2>
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
                  {merchants.map((m) => {
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
                          <button type="button" onClick={() => setSelected(m)} aria-label={`View ${m.name}`}
                            style={{ marginRight: 12, background: 'none', border: 'none', color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600 }}>
                            View
                          </button>
                          <button type="button" onClick={() => toggleSuspend(m)} disabled={busyId === m.id || m.status === 'ARCHIVED'}
                            aria-label={`${m.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'} ${m.name}`}
                            style={{ background: 'none', border: 'none', cursor: m.status === 'ARCHIVED' ? 'not-allowed' : 'pointer',
                              color: m.status === 'SUSPENDED' ? '#047857' : '#B91C1C', fontWeight: 600, opacity: busyId === m.id ? 0.5 : 1 }}>
                            {m.status === 'SUSPENDED' ? 'Unsuspend' : 'Suspend'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {merchants.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '16px', color: 'var(--text-secondary)' }}>No merchants yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selected && (
          <div>
            {/* "Acting as Platform Admin on {store}" context bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <button type="button" onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600, padding: 0, marginBottom: 4 }}>
                  ← All merchants
                </button>
                <h2 style={{ margin: 0, fontSize: 16 }}>{selected.name}</h2>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Acting as Platform Admin · /{selected.slug} · owner {selected.ownerEmail}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)', marginBottom: 16 }}>
              {(['customers', 'products', 'orders', 'marketing'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  style={{ padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                    textTransform: 'capitalize', color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderBottom: tab === t ? '2px solid var(--primary-solid)' : '2px solid transparent' }}>
                  {t}
                </button>
              ))}
            </div>

            {tab === 'customers' && (
              <Customers storeId={selected.id} currency={selected.currency} adminMerchantId={selected.id} />
            )}
            {tab === 'products' && (
              <ProductsList storeId={selected.id} currency={selected.currency} adminMerchantId={selected.id} />
            )}
            {(tab === 'orders' || tab === 'marketing') && (
              <p className="text-small" style={{ color: 'var(--text-muted)' }}>
                {tab[0].toUpperCase() + tab.slice(1)} management is wired up in the next slice.
              </p>
            )}
          </div>
        )}
      </main>

      {notice && <Toast message={notice} />}
    </div>
  );
}
