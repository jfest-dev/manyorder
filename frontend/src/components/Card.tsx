interface CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({ children, title, className = '', style }: CardProps) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 'var(--radius-medium)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-card)',
        padding: '16px',
        ...style,
      }}
    >
      {title && <h2 style={{ marginBottom: '12px' }}>{title}</h2>}
      {children}
    </div>
  );
}