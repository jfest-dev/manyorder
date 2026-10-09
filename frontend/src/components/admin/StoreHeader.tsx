import { useEffect, useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { adminApi, AdminMerchantSummary } from '../../lib/api';

const STATUS_STYLE: Record<AdminMerchantSummary['status'], { bg: string; color: string; label: string }> = {
  ACTIVE: { bg: '#ECFDF5', color: '#047857', label: 'Active' },
  SUSPENDED: { bg: '#FEE2E2', color: '#B91C1C', label: 'Suspended' },
  ARCHIVED: { bg: '#F3F4F6', color: '#4B5563', label: 'Archived' },
};

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: leave the value visible to copy by hand */
    }
  };
  return (
    <button type="button" onClick={onCopy} aria-label={label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
        cursor: 'pointer', color: copied ? '#047857' : 'var(--text-muted)', padding: 2, fontSize: 12 }}>
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

const linkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  color: 'var(--primary-solid)', textDecoration: 'none', fontWeight: 600,
};

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '5px 0' }}>
      <span className="text-xs" style={{ width: 120, flexShrink: 0, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** Labeled context header for the Platform Admin store drill-down (replaces the old
 *  dot-separated line). Shows the store page link, owner, contact number and status. */
export function StoreHeader({ summary }: { summary: AdminMerchantSummary }) {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhone(null);
    adminApi.storeDetail(summary.id)
      .then((d) => { if (!cancelled) setPhone(d.profile.phoneNumber); })
      .catch(() => { /* non-fatal: the contact row simply shows no number */ });
    return () => { cancelled = true; };
  }, [summary.id]);

  const status = STATUS_STYLE[summary.status];
  const hidden = summary.status !== 'ACTIVE'; // suspended or archived: no public page
  // Build from the current site address, so it works on localhost and on the live site.
  const storeUrl = `${window.location.origin}/${summary.slug}`;
  const waDigits = phone ? phone.replace(/\D/g, '') : '';

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)',
      background: 'var(--bg-card)', padding: '12px 14px', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <span className="text-xs" style={{ padding: '2px 10px', borderRadius: 999, fontWeight: 600,
          background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Platform admin view
        </span>
        <span style={{ padding: '2px 10px', borderRadius: 999, background: status.bg, color: status.color, fontSize: 11, fontWeight: 600 }}>
          {status.label}
        </span>
      </div>

      <LabeledRow label="Store page">
        {hidden ? (
          <span className="text-small" style={{ color: 'var(--text-muted)' }}>Hidden from customers</span>
        ) : (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            /{summary.slug} <ExternalLink size={13} />
          </a>
        )}
      </LabeledRow>

      <LabeledRow label="Owner">
        <span className="text-small" style={{ color: 'var(--text-primary)' }}>{summary.ownerName}</span>
        <span className="text-small" style={{ color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{summary.ownerEmail}</span>
        <CopyButton value={summary.ownerEmail} label="Copy owner email" />
      </LabeledRow>

      <LabeledRow label="Contact number">
        {phone && phone.trim() !== '' ? (
          <>
            <span className="text-small" style={{ color: 'var(--text-primary)' }}>{phone}</span>
            <CopyButton value={phone} label="Copy contact number" />
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Open in WhatsApp <ExternalLink size={13} />
            </a>
          </>
        ) : (
          <span className="text-small" style={{ color: 'var(--text-muted)' }}>-</span>
        )}
      </LabeledRow>
    </div>
  );
}
