import type { ReactNode } from 'react';

interface NoteBlockProps {
  label: string;
  children: ReactNode;
  /** Muted/secondary body - use for supplementary instructions. */
  muted?: boolean;
  style?: React.CSSProperties;
}

/**
 * Consistent way to DISPLAY a note or message anywhere on the platform (order
 * notes, payment instructions, delivery message, etc.): a small label above
 * readable, wrapping body text - never cramped grey run-on text.
 */
export function NoteBlock({ label, children, muted, style }: NoteBlockProps) {
  return (
    <div style={style}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: muted ? 'var(--text-secondary)' : 'var(--text-primary)',
      }}>
        {children}
      </div>
    </div>
  );
}
