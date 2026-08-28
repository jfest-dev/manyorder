import {
  createContext, useCallback, useContext, useEffect, useState,
  type CSSProperties, type ReactNode,
} from 'react';

/**
 * App-wide dialog styling and helpers. One rounded-card look, shared by the
 * promise-based confirm (replacing native window.confirm) and the three-button
 * unsaved-changes dialog, so every popup matches.
 */

export const dialogOverlayStyle: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
};
export const dialogCardStyle: CSSProperties = {
  background: 'var(--bg-card)', borderRadius: 'var(--radius-medium)', padding: '20px',
  width: '100%', maxWidth: '380px', border: '1px solid var(--border-strong)',
  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
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

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    [],
  );
  const close = (value: boolean) => {
    setState((s) => { s?.resolve(value); return null; });
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <DialogShell title={state.opts.title} onDismiss={() => close(false)}>
          <p className="text-small" style={bodyStyle}>{state.opts.message}</p>
          <div style={actionsStyle}>
            <button type="button" onClick={() => close(false)} style={dialogGhostBtn}>
              {state.opts.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => close(true)}
              style={state.opts.tone === 'danger' ? dialogDangerBtn : dialogPrimaryBtn}
            >
              {state.opts.confirmLabel ?? 'Confirm'}
            </button>
          </div>
        </DialogShell>
      )}
    </ConfirmContext.Provider>
  );
}

/** Returns `confirm(opts) => Promise<boolean>`. Use in place of window.confirm. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}
