import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { adminApi, AdminMetrics, AdminMerchantSummary, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useConfirmReason } from '../ConfirmDialog';
import { Button } from '../Button';
import { Toast } from '../Toast';
import { Customers } from '../screens/Customers';
import { ProductsList } from '../screens/ProductsList';
import { Marketing } from '../screens/Marketing';
import { Orders } from '../screens/Orders';
import { Dashboard } from '../screens/Dashboard';
import { StoreDetail } from './StoreDetail';
import { StoreHeader } from './StoreHeader';
import { AdminActivity } from './AdminActivity';
import { AdminOverview } from './AdminOverview';
import { MerchantsList } from './MerchantsList';

type Section = 'overview' | 'merchants' | 'activity';
const NAV: { key: Section; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'merchants', label: 'Merchants' },
  { key: 'activity', label: 'Activity' },
];

/** One left-nav / drawer entry. Shared so the sidebar and the mobile drawer match. */
function navButton(n: { key: Section; label: string }, active: boolean, onClick: () => void) {
  return (
    <button key={n.key} type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
      style={{ textAlign: 'left', padding: '10px 12px', minHeight: 44, borderRadius: 'var(--radius-field)', border: 'none', cursor: 'pointer',
        fontSize: 14, fontWeight: active ? 700 : 500,
        background: active ? 'var(--bg-card-subtle)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
      {n.label}
    </button>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 140, padding: '16px', borderRadius: 'var(--radius-medium)',
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Platform Admin console: left nav (Overview / Merchants / Activity), with a store
 *  drill-down opened from Merchants. Reached only when the user's role is PLATFORM_ADMIN. */
export function AdminApp() {
  const { user, logout } = useAuth();
  const confirmReason = useConfirmReason();

  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [selected, setSelected] = useState<AdminMerchantSummary | null>(null);
  const [tab, setTab] = useState<'overview' | 'dashboard' | 'customers' | 'products' | 'orders' | 'marketing'>('overview');
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [merchantsReload, setMerchantsReload] = useState(0);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const loadMetrics = () =>
    adminApi.metrics()
      .then((m) => setMetrics(m))
      .catch((e) => setError((prev) => prev ?? (e instanceof ApiError ? e.message : 'Could not load admin data')));

  useEffect(() => {
    setLoading(true);
    adminApi.metrics()
      .then((m) => setMetrics(m))
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load admin data'))
      .finally(() => setLoading(false));
  }, []);

  // Silent background refresh (60s + on focus); keep last good data on failure.
  useEffect(() => {
    const refresh = () => { adminApi.metrics().then((m) => setMetrics(m)).catch(() => { /* keep last good */ }); };
    const id = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(id); window.removeEventListener('focus', refresh); };
  }, []);

  const showNotice = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 2400); };
  const goSection = (s: Section) => { setSelected(null); setSection(s); };

  // Open a store drill-down by id (from any Overview link); fetches its summary first.
  const openStore = (id: number) => {
    adminApi.getMerchant(id)
      .then((m) => { setSelected(m); setTab('overview'); setSection('merchants'); })
      .catch((e) => showNotice(e instanceof ApiError ? e.message : 'Could not open store'));
  };

  const toggleSuspend = async (m: AdminMerchantSummary) => {
    const suspend = m.status !== 'SUSPENDED';
    const reason = await confirmReason({
      title: suspend ? `Suspend ${m.name}?` : `Unsuspend ${m.name}?`,
      message: suspend
        ? 'This hides their storefront and blocks the owner (and staff) from signing in until you lift it. The owner will be emailed with your reason.'
        : 'This restores their storefront and lets the owner sign in again. The owner will be emailed with your reason.',
      confirmLabel: suspend ? 'Suspend' : 'Unsuspend',
      tone: suspend ? 'danger' : 'default',
      reasonLabel: 'Reason (shown to the owner)',
    });
    if (reason == null) return;
    setBusyId(m.id);
    try {
      await (suspend ? adminApi.suspend(m.id, reason) : adminApi.unsuspend(m.id, reason));
      showNotice(suspend ? `${m.name} suspended.` : `${m.name} unsuspended.`);
      loadMetrics();
      setMerchantsReload((n) => n + 1);
    } catch (e) {
      showNotice(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {isMobile && (
            <button type="button" aria-label="Open menu" onClick={() => setDrawerOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44,
                margin: '-10px 0', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <Menu size={22} />
            </button>
          )}
          <strong style={{ fontSize: 16 }}>Platform Admin</strong>
          {!isMobile && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cross-store administration</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          {!isMobile && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user?.email}</span>}
          <Button variant="secondary" onClick={logout}>Log out</Button>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'flex-start', maxWidth: 1200, margin: '0 auto' }}>
        {!isMobile && (
          <nav aria-label="Admin sections" style={{ width: 180, flexShrink: 0, padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map((n) => navButton(n, !selected && section === n.key, () => goSection(n.key)))}
          </nav>
        )}

        <main style={{ flex: 1, minWidth: 0, padding: isMobile ? '16px' : '20px' }}>
          {loading && <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading…</p>}
          {error && <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>}

          {!loading && !error && selected && (
            <div>
              <button type="button" onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', color: 'var(--primary-solid)', cursor: 'pointer', fontWeight: 600, padding: 0, marginBottom: 10 }}>
                ← All merchants
              </button>
              <h2 style={{ margin: '0 0 12px', fontSize: 16, lineHeight: 1.3 }}>{selected.name}</h2>

              <StoreHeader summary={selected} />

              <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--border-subtle)', marginBottom: 20,
                overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch' }}>
                {(['overview', 'dashboard', 'customers', 'products', 'orders', 'marketing'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)}
                    ref={tab === t ? (el) => { try { el?.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch { /* jsdom: no-op */ } } : undefined}
                    style={{ padding: '10px 14px', minHeight: 44, flexShrink: 0, whiteSpace: 'nowrap', background: 'none', border: 'none',
                      cursor: 'pointer', fontSize: 13, fontWeight: 600, textTransform: 'capitalize',
                      color: tab === t ? 'var(--text-primary)' : 'var(--text-secondary)',
                      borderBottom: tab === t ? '2px solid var(--primary-solid)' : '2px solid transparent' }}>
                    {t}
                  </button>
                ))}
              </div>

              {tab === 'overview' && <StoreDetail merchantId={selected.id} />}
              {tab === 'dashboard' && (
                <Dashboard
                  store={{ id: String(selected.id), name: selected.name, slug: selected.slug, color: '#000000', currency: selected.currency }}
                  onNavigate={() => setTab('orders')}
                  adminMerchantId={selected.id}
                />
              )}
              {tab === 'customers' && <Customers storeId={selected.id} currency={selected.currency} adminMerchantId={selected.id} readOnly />}
              {tab === 'products' && <ProductsList storeId={selected.id} currency={selected.currency} adminMerchantId={selected.id} readOnly />}
              {tab === 'marketing' && <Marketing storeId={selected.id} currency={selected.currency} adminMerchantId={selected.id} readOnly />}
              {tab === 'orders' && (
                <Orders
                  store={{ id: String(selected.id), name: selected.name, slug: selected.slug, color: '#000000', currency: selected.currency }}
                  onNavigate={() => {}}
                  adminMerchantId={selected.id}
                  readOnly
                />
              )}
            </div>
          )}

          {!loading && !error && !selected && section === 'overview' && metrics && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <Tile label="Merchants" value={metrics.totalMerchants} />
                <Tile label="Active" value={metrics.activeMerchants} />
                <Tile label="Suspended" value={metrics.suspendedMerchants} />
                <Tile label="Archived" value={metrics.archivedMerchants} />
                <Tile label="Orders" value={metrics.totalOrders} />
                <Tile label="Customers" value={metrics.totalCustomers} />
                <Tile label="New (30d)" value={metrics.newMerchantsLast30Days} />
              </div>
              <AdminOverview onOpenStore={openStore} />
            </>
          )}

          {!loading && !error && !selected && section === 'merchants' && (
            <MerchantsList
              onView={(m) => { setSelected(m); setTab('overview'); }}
              onToggleSuspend={toggleSuspend}
              busyId={busyId}
              reloadToken={merchantsReload}
            />
          )}

          {!loading && !error && !selected && section === 'activity' && <AdminActivity />}
        </main>
      </div>

      {isMobile && drawerOpen && (
        <div role="dialog" aria-label="Menu" aria-modal="true" onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ width: 240, maxWidth: '80%', height: '100%', background: 'var(--bg-card)', padding: '16px 12px',
              display: 'flex', flexDirection: 'column', gap: 4, boxShadow: 'var(--shadow-overlay)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 8px' }}>
              <strong style={{ fontSize: 15 }}>Menu</strong>
              <button type="button" aria-label="Close menu" onClick={() => setDrawerOpen(false)}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44,
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            {NAV.map((n) => navButton(n, !selected && section === n.key, () => { goSection(n.key); setDrawerOpen(false); }))}
          </div>
        </div>
      )}

      {notice && <Toast message={notice} />}
    </div>
  );
}
