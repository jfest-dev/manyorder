import { useState } from 'react';

/**
 * A high-friction confirmation for irreversible admin deletes: the destructive
 * button stays disabled until the operator types the exact `confirmText` (e.g.
 * the record's name). Distinct danger styling, and the confirm button is never
 * the default action. Render conditionally; the caller owns open/close.
 */
export function TypedDeleteConfirm({
  title,
  message,
  confirmText,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmText: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim() === confirmText.trim();

  return (
    <div role="dialog" aria-label={title} onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-medium)',
          border: '1px solid #FCA5A5', width: '100%', maxWidth: 440, padding: 20 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#B91C1C' }}>{title}</h3>
        <p className="text-small" style={{ color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>{message}</p>
        <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
          Type <strong>{confirmText}</strong> to confirm
        </label>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label="Confirmation text"
          autoFocus
          style={{ width: '100%', height: 40, padding: '0 12px', boxSizing: 'border-box', marginBottom: 16,
            border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)',
            background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onCancel} disabled={busy}
            style={{ height: 40, padding: '0 16px', borderRadius: 'var(--radius-field)', border: '1px solid var(--border-strong)',
              background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={!matches || busy}
            aria-label={confirmLabel}
            style={{ height: 40, padding: '0 16px', borderRadius: 'var(--radius-field)', border: 'none',
              background: matches && !busy ? '#DC2626' : '#FCA5A5', color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: matches && !busy ? 'pointer' : 'not-allowed' }}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
