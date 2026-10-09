import { useEffect, useState } from 'react';
import { adminApi, AdminStoreDetail, AdminAuditLogEntry, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';

const EMPTY = '-';
function dt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString() : EMPTY;
}
function text(v: string | null | undefined): string {
  return v && v.trim() !== '' ? v : EMPTY;
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)',
  background: 'var(--bg-card)', padding: '16px', marginBottom: '16px',
};
const titleStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase',
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
      <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

/** Read-only Platform Admin store overview: owner, stored profile, activity, recent admin actions. */
export function StoreDetail({ merchantId }: { merchantId: number }) {
  const [detail, setDetail] = useState<AdminStoreDetail | null>(null);
  const [actions, setActions] = useState<AdminAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([adminApi.storeDetail(merchantId), adminApi.auditLog(merchantId)])
      .then(([d, log]) => { if (!cancelled) { setDetail(d); setActions(log); } })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load store detail'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [merchantId]);

  if (loading) return <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading store detail…</p>;
  if (error) return <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>;
  if (!detail) return null;

  const { owner, profile, activity } = detail;
  const money = (n: number) => formatMoney(n, activity.revenueCurrency || detail.currency);

  return (
    <div>
      {/* Owner */}
      <div style={cardStyle}>
        <p style={titleStyle}>Owner</p>
        <Row label="Name" value={text(owner.name)} />
        <Row label="Email" value={text(owner.email)} />
        <Row label="Email verified" value={owner.verified ? 'Yes' : 'No'} />
        <Row label="Owner since" value={dt(owner.createdAt)} />
      </div>

      {/* Store profile */}
      <div style={cardStyle}>
        <p style={titleStyle}>Store profile</p>
        <Row label="Status" value={detail.status} />
        <Row label="Slug" value={`/${detail.slug}`} />
        <Row label="Currency" value={detail.currency} />
        <Row label="Contact email" value={text(profile.email)} />
        <Row label="Phone" value={text(profile.phoneNumber)} />
        <Row label="Business type" value={text(profile.businessType)} />
        <Row label="Address" value={[profile.streetAddress, profile.city, profile.postalCode].filter((p) => p && p.trim() !== '').join(', ') || EMPTY} />
        <Row label="Fulfilment" value={text(profile.fulfilmentMode)} />
        <Row label="Delivery fee" value={profile.deliveryFee != null ? money(profile.deliveryFee) : EMPTY} />
        <Row label="Free delivery over" value={profile.freeDeliveryThreshold != null ? money(profile.freeDeliveryThreshold) : EMPTY} />
        <Row label="WhatsApp verified" value={profile.whatsappVerified ? 'Yes' : 'No'} />
        <Row label="New-order email" value={profile.notifyNewOrderEmail ? 'On' : 'Off'} />
        <Row label="Low-stock email" value={profile.notifyLowStockEmail ? 'On' : 'Off'} />
        <Row label="Item notes" value={profile.itemNotesEnabled ? 'On' : 'Off'} />
        <Row label="Created" value={dt(profile.createdAt)} />
        <Row label="Last viewed orders" value={dt(profile.lastOrdersViewedAt)} />
      </div>

      {/* Activity */}
      <div style={cardStyle}>
        <p style={titleStyle}>Activity</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
          <Stat label="Products" value={String(activity.productCount)} />
          <Stat label="Orders" value={String(activity.orderCount)} />
          <Stat label="Customers" value={String(activity.customerCount)} />
          <Stat label="Low stock" value={String(activity.lowStockCount)} />
        </div>
        <Row label="Revenue (completed + delivered)" value={money(activity.revenue)} />
        <Row label="Last order" value={dt(activity.lastOrderAt)} />
      </div>

      {/* Recent admin actions */}
      <div style={cardStyle}>
        <p style={titleStyle}>Recent admin actions</p>
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
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{dt(a.createdAt)}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
