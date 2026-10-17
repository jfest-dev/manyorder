import {
  createContext, useCallback, useContext, useEffect, useState,
  type CSSProperties, type ReactNode,
} from 'react';
import { Checkbox } from './Checkbox';

/**
 * App-wide dialog styling and helpers. One rounded-card look, shared by the
 * promise-based confirm (replacing native window.confirm) and the three-button
 * unsaved-changes dialog, so every popup matches.
 */

export const dialogOverlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
  // Let a tall dialog scroll rather than clip when the on-screen keyboard is open.
  overflowY: 'auto',
};
export const dialogCardStyle: CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 'var(--radius-medium)', padding: '20px',
  width: '100%', maxWidth: '380px', border: '1px solid var(--border-strong)',
  boxShadow: 'var(--shadow-overlay)',
  // Keep the card within the viewport (keyboard-safe); its own content scrolls.
  maxHeight: '90vh', overflowY: 'auto',
};

const btnBase: CSSProperties = {
  padding: '8px 16px', borderRadius: 'var(--radius-field)', fontSize: '13px', fontWeight: 600,
  cursor: 'pointer', border: '1px solid transparent',
};
export const dialogGhostBtn: CSSProperties = {
  ...btnBase, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-secondary)',
};
export const dialogPrimaryBtn: CSSProperties = { ...btnBase, background: 'var(--primary-solid)', color: 'white' };
export const dialogDangerBtn: CSSProperties = { ...btnBase, background: '#DC2626', color: 'white' };
export const dialogDangerOutlineBtn: CSSProperties = {
  ...btnBase, background: 'transparent', border: '1px solid #DC2626', color: '#DC2626',
};

/** The shared card + backdrop. Esc and a backdrop click both dismiss. */
function DialogShell({ title, onDismiss, children }: {
  title?: string; onDismiss: () => void; children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);
  return (
    <div role="dialog" aria-modal="true" style={dialogOverlayStyle} onClick={onDismiss}>
      <div onClick={(e) => e.stopPropagation()} style={dialogCardStyle}>
        {title && <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px' }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
}

const bodyStyle: CSSProperties = { color: 'var(--text-secondary)', margin: '0 0 20px', lineHeight: 1.5 };
const actionsStyle: CSSProperties = { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' };

/**
 * Three-button unsaved-changes dialog (Save / Discard / Cancel). Rendered by a
 * screen that owns the save; `open` toggles it.
 */
export function UnsavedChangesDialog({ open, saving, message, onSave, onDiscard, onCancel }: {
  open: boolean; saving?: boolean; message?: string;
  onSave: () => void; onDiscard: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <DialogShell title="Unsaved changes" onDismiss={onCancel}>
      <p className="text-small" style={bodyStyle}>
        {message ?? 'You have unsaved changes. Save them before leaving?'}
      </p>
      <div style={actionsStyle}>
        <button type="button" onClick={onCancel} disabled={saving} style={dialogGhostBtn}>Cancel</button>
        <button type="button" onClick={onDiscard} disabled={saving} style={dialogDangerOutlineBtn}>Discard</button>
        <button type="button" onClick={onSave} disabled={saving} style={dialogPrimaryBtn}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </DialogShell>
  );
}

// --- Promise-based confirm, replacing native window.confirm ---

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

/** Options for a confirm that also collects a written reason. */
export interface ConfirmReasonOptions extends ConfirmOptions {
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonMaxLength?: number;
  /** When true, the reason may be left blank (restoring actions). */
  reasonOptional?: boolean;
  /** When set, show an "Email the owner" checkbox starting at this value (restoring actions). */
  emailOwnerDefault?: boolean;
}

/** Result of a reason confirm. emailOwner is true unless an unticked checkbox was shown. */
export interface ConfirmReasonResult { reason: string; emailOwner: boolean; }

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
/** Resolves with the reason + email choice, or null if cancelled. */
type ConfirmReasonFn = (opts: ConfirmReasonOptions) => Promise<ConfirmReasonResult | null>;

interface ConfirmApi { confirm: ConfirmFn; confirmReason: ConfirmReasonFn; }

const ConfirmContext = createContext<ConfirmApi>({
  confirm: () => Promise.resolve(false),
  confirmReason: () => Promise.resolve(null),
});

const DEFAULT_REASON_MAX = 300;

type PendingBool = { kind: 'bool'; opts: ConfirmOptions; resolve: (v: boolean) => void };
type PendingReason = { kind: 'reason'; opts: ConfirmReasonOptions; resolve: (v: ConfirmReasonResult | null) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PendingBool | PendingReason | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [emailOwner, setEmailOwner] = useState(true);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => { setState({ kind: 'bool', opts, resolve }); }),
    [],
  );
  const confirmReason = useCallback<ConfirmReasonFn>(
    (opts) => new Promise<ConfirmReasonResult | null>((resolve) => {
      setReason(''); setTouched(false); setEmailOwner(opts.emailOwnerDefault ?? true);
      setState({ kind: 'reason', opts, resolve });
    }),
    [],
  );

  const closeBool = (value: boolean) => {
    setState((s) => { if (s?.kind === 'bool') s.resolve(value); return null; });
  };
  const cancelReason = () => {
    setState((s) => { if (s?.kind === 'reason') s.resolve(null); return null; });
  };
  const submitReason = () => {
    const trimmed = reason.trim();
    const optional = state?.kind === 'reason' && state.opts.reasonOptional;
    if (!trimmed && !optional) { setTouched(true); return; }
    setState((s) => { if (s?.kind === 'reason') s.resolve({ reason: trimmed, emailOwner }); return null; });
  };

  return (
    <ConfirmContext.Provider value={{ confirm, confirmReason }}>
      {children}
      {state?.kind === 'bool' && (
        <DialogShell title={state.opts.title} onDismiss={() => closeBool(false)}>
          <p className="text-small" style={bodyStyle}>{state.opts.message}</p>
          <div style={actionsStyle}>
            <button type="button" onClick={() => closeBool(false)} style={dialogGhostBtn}>
              {state.opts.cancelLabel ?? 'Cancel'}
            </button>
            <button type="button" onClick={() => closeBool(true)}
              style={state.opts.tone === 'danger' ? dialogDangerBtn : dialogPrimaryBtn}>
              {state.opts.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </DialogShell>
      )}
      {state?.kind === 'reason' && (() => {
        const max = state.opts.reasonMaxLength ?? DEFAULT_REASON_MAX;
        const optional = !!state.opts.reasonOptional;
        const showEmailChoice = state.opts.emailOwnerDefault !== undefined;
        const invalid = !optional && touched && reason.trim().length === 0;
        const blocked = !optional && reason.trim().length === 0;
        return (
          <DialogShell title={state.opts.title} onDismiss={cancelReason}>
            <p className="text-small" style={{ ...bodyStyle, marginBottom: 12 }}>{state.opts.message}</p>
            <label className="text-xs" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>
              {state.opts.reasonLabel ?? 'Reason'}{optional ? ' (optional)' : ''}
            </label>
            <textarea
              value={reason}
              maxLength={max}
              autoFocus
              onChange={(e) => setReason(e.target.value)}
              placeholder={state.opts.reasonPlaceholder ?? 'The owner will see this.'}
              aria-label={state.opts.reasonLabel ?? 'Reason'}
              style={{
                width: '100%', minHeight: 72, resize: 'vertical', padding: '8px 10px', fontSize: 13,
                fontFamily: 'inherit', border: `1px solid ${invalid ? '#DC2626' : 'var(--border-strong)'}`,
                borderRadius: 'var(--radius-field)', background: 'var(--bg-card)', color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0 12px' }}>
              <span className="text-xs" style={{ color: '#DC2626' }}>{invalid ? 'A reason is required.' : ''}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{reason.length}/{max}</span>
            </div>
            {showEmailChoice && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
                <Checkbox checked={emailOwner} onChange={setEmailOwner} ariaLabel="Email the owner" />
                <span className="text-small">Email the owner</span>
              </label>
            )}
            <div style={actionsStyle}>
              <button type="button" onClick={cancelReason} style={dialogGhostBtn}>
                {state.opts.cancelLabel ?? 'Cancel'}
              </button>
              <button type="button" onClick={submitReason} disabled={blocked}
                style={{ ...(state.opts.tone === 'danger' ? dialogDangerBtn : dialogPrimaryBtn),
                  opacity: blocked ? 0.5 : 1, cursor: blocked ? 'not-allowed' : 'pointer' }}>
                {state.opts.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </DialogShell>
        );
      })()}
    </ConfirmContext.Provider>
  );
}

/** Returns `confirm(opts) => Promise<boolean>`. Use in place of window.confirm. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext).confirm;
}

/** Returns `confirmReason(opts) => Promise<string | null>` (null = cancelled). */
export function useConfirmReason(): ConfirmReasonFn {
  return useContext(ConfirmContext).confirmReason;
}
