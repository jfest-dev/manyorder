import { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { adminApi, AdminStoreDetail, AdminAuditLogEntry, ProductResponse, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { formatDate, formatDateTime } from '../../lib/adminDatetime';
import { ADMIN_FONT } from './adminTokens';
import { VerifiedBadge } from '../VerifiedBadge';
import { Checkbox } from '../Checkbox';
import { Button } from '../Button';
import { useConfirmReason } from '../ConfirmDialog';

const EMPTY = '-';
function text(v: string | null | undefined): string {
  return v && v.trim() !== '' ? v : EMPTY;
}

/** A value with a small copy button, or a plain dash when there is nothing to copy. */
function CopyableValue({ value }: { value: string | null | undefined }) {
  const [copied, setCopied] = useState(false);
  if (!value || value.trim() === '') return <>{EMPTY}</>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked - the value is on screen to copy manually */ }
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      {value}
      <button type="button" onClick={copy} aria-label={copied ? 'Copied' : `Copy ${value}`}
        style={{ display: 'inline-flex', background: 'none', border: 'none', padding: 2, cursor: 'pointer',
          color: copied ? '#047857' : 'var(--text-muted)' }}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)',
  background: 'var(--bg-card)', padding: '16px', marginBottom: '16px',
};
const titleStyle: React.CSSProperties = {
  fontSize: ADMIN_FONT.small, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
  color: 'var(--text-muted)', margin: '0 0 12px',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderTop: '1px solid var(--border-subtle)' }}>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-small" style={{ textAlign: 'right', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: '1 1 120px', minWidth: 120, padding: '12px', borderRadius: 'var(--radius-medium)', background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: ADMIN_FONT.title, fontWeight: 700 }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Read-only Platform Admin store overview: activity first, then owner, profile, admin
 *  activity, and the admin store-administration panel (protect, restore). `onChanged`
 *  lets the parent refresh the selected-store summary after an action. */
export function StoreDetail({ merchantId, onChanged }: { merchantId: number; onChanged?: () => void }) {
  const confirmReason = useConfirmReason();
  const [detail, setDetail] = useState<AdminStoreDetail | null>(null);
  const [actions, setActions] = useState<AdminAuditLogEntry[]>([]);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      adminApi.storeDetail(merchantId),
      adminApi.auditLog(merchantId),
      adminApi.productsFor(merchantId).list(),
    ])
      .then(([d, log, prods]) => { if (!cancelled) { setDetail(d); setActions(log); setProducts(prods); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load store detail'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [merchantId, reloadToken]);

  const reload = () => setReloadToken((n) => n + 1);

  const toggleProtect = async (next: boolean) => {
    setBusy(true);
    setAdminError(null);
    try {
      await (next ? adminApi.protect(merchantId) : adminApi.unprotect(merchantId));
      reload();
      onChanged?.();
    } catch (e) {
      setAdminError(e instanceof ApiError ? e.message : 'Could not update protection');
    } finally {
      setBusy(false);
    }
  };

  const doRestore = async () => {
    const result = await confirmReason({
      title: `Restore ${detail?.name ?? 'this store'}?`,
      message: 'This makes the store available to customers again and lets the owner use it.',
      confirmLabel: 'Restore',
      reasonOptional: true,
      emailOwnerDefault: true,
    });
    if (result == null) return;
    setBusy(true);
    setAdminError(null);
    try {
      await adminApi.restore(merchantId, result.reason, result.emailOwner);
      reload();
      onChanged?.();
    } catch (e) {
      setAdminError(e instanceof ApiError ? e.message : 'Could not restore the store');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading store detail…</p>;
  if (error) return <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>;
  if (!detail) return null;

  const { owner, profile, activity } = detail;
  const currency = activity.revenueCurrency || detail.currency;
  const money = (n: number) => formatMoney(n, currency);

  const bestSellers = [...products]
    .filter((p) => p.unitsSold > 0)
    .sort((a, b) => b.unitsSold - a.unitsSold)
    .slice(0, 5);

  return (
    <div>
      {/* Activity (first) */}
      <div style={cardStyle}>
        <p style={titleStyle}>Activity</p>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: ADMIN_FONT.metric, fontWeight: 800, lineHeight: 1.1 }}>{money(activity.revenue)}</div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>Revenue (completed and delivered)</div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <Stat label="Orders" value={String(activity.orderCount)} />
          <Stat label="Customers" value={String(activity.customerCount)} />
          <Stat label="Products" value={String(activity.productCount)} />
          <Stat label="Low stock" value={String(activity.lowStockCount)} />
        </div>
        <Row label="Last order" value={formatDateTime(activity.lastOrderAt)} />

        <div style={{ marginTop: 14 }}>
          <div className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>Best sellers (by units sold)</div>
          {bestSellers.length === 0 ? (
            <p className="text-small" style={{ color: 'var(--text-muted)', margin: 0 }}>No sales yet.</p>
          ) : (
            bestSellers.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '6px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                <span className="text-small" style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span className="text-small" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{p.unitsSold} sold</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Owner */}
      <div style={cardStyle}>
        <p style={titleStyle}>Owner</p>
        <Row label="Name" value={text(owner.name)} />
        <Row label="Email" value={<CopyableValue value={owner.email} />} />
        <Row label="Phone" value={<CopyableValue value={owner.phone} />} />
        <Row label="Email verified" value={owner.verified ? 'Yes' : 'No'} />
        <Row label="Owner since" value={formatDate(owner.createdAt)} />
      </div>

      {/* Store profile */}
      <div style={cardStyle}>
        <p style={titleStyle}>Store profile</p>
        <Row label="Status" value={detail.status} />
        <Row label="Slug" value={`/${detail.slug}`} />
        <Row label="Currency" value={detail.currency} />
        <Row label="Contact email" value={
          profile.email && profile.email.trim() !== '' ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <span>{profile.email}</span>
              <VerifiedBadge verified={profile.emailVerified} style={{ fontSize: ADMIN_FONT.caption }} />
            </span>
          ) : EMPTY
        } />
        <Row label="Phone" value={text(profile.phoneNumber)} />
        <Row label="Business type" value={text(profile.businessType)} />
        <Row label="Address" value={[profile.streetAddress, profile.city, profile.postalCode].filter((p) => p && p.trim() !== '').join(', ') || EMPTY} />
        <Row label="Fulfilment" value={text(profile.fulfilmentMode)} />
        <Row label="Delivery fee" value={profile.deliveryFee != null ? money(profile.deliveryFee) : EMPTY} />
        <Row label="Free delivery over" value={profile.freeDeliveryThreshold != null ? money(profile.freeDeliveryThreshold) : EMPTY} />
        <Row label="New-order email" value={profile.notifyNewOrderEmail ? 'On' : 'Off'} />
        <Row label="Low-stock email" value={profile.notifyLowStockEmail ? 'On' : 'Off'} />
        <Row label="Item notes" value={profile.itemNotesEnabled ? 'On' : 'Off'} />
        <Row label="Created" value={formatDateTime(profile.createdAt)} />
        <Row label="Last viewed orders" value={formatDateTime(profile.lastOrdersViewedAt)} />
        <Row label="Suspended" value={formatDateTime(profile.suspendedAt)} />
        <Row label="Deleted by owner" value={formatDateTime(profile.archivedAt)} />
      </div>

      {/* Admin activity on this store */}
      <div style={cardStyle}>
        <p style={{ ...titleStyle, marginBottom: 4 }}>Admin activity on this store</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)', margin: '0 0 12px' }}>Changes platform admins made to this store.</p>
        {actions.length === 0 ? (
          <p className="text-small" style={{ color: 'var(--text-muted)', margin: 0 }}>No admin actions on this store yet.</p>
        ) : (
          actions.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ minWidth: 0 }}>
                <div className="text-small" style={{ fontWeight: 600 }}>{a.action}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a.targetType ? `${a.targetType}${a.targetId != null ? ` #${a.targetId}` : ''}` : EMPTY}
                  {a.detail ? ` · ${a.detail}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{a.actorEmail}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatDateTime(a.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Store administration (platform admin) */}
      <div style={cardStyle}>
        <p style={titleStyle}>Store administration</p>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: busy ? 'default' : 'pointer', padding: '4px 0' }}>
          <Checkbox checked={profile.protectedFromDeletion} onChange={toggleProtect} disabled={busy} ariaLabel="Protected from deletion" style={{ marginTop: 2 }} />
          <span>
            <span className="text-small" style={{ fontWeight: 600, display: 'block' }}>Protected from deletion</span>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>A protected store can't be deleted by an admin or the cleanup job.</span>
          </span>
        </label>

        {detail.status === 'ARCHIVED' && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
            <div className="text-small" style={{ fontWeight: 600, marginBottom: 2 }}>Deleted by owner</div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>
              Restore it to make the storefront available again and let the owner back in.
            </p>
            <Button variant="secondary" onClick={doRestore} disabled={busy}>Restore store</Button>
          </div>
        )}

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" disabled>
              <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>Delete now</span>
            </Button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Not available yet</span>
          </div>
        </div>

        {adminError && <p className="text-xs" style={{ color: 'var(--error-color)', marginTop: 10 }}>{adminError}</p>}
      </div>
    </div>
  );
}
