import { Store } from 'lucide-react';

interface AuthLayoutProps {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Centered auth card matching the ManyOrder design system (24px card, dark tile). */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-subtle)',
            padding: '40px 32px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'var(--primary-solid)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Store size={28} color="white" />
            </div>
            <h1 style={{ textAlign: 'center', marginBottom: '6px' }}>{title}</h1>
            {subtitle && (
              <div className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                {subtitle}
              </div>
            )}
          </div>

          {children}
        </div>

        {footer && <div style={{ marginTop: '16px' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function SecurityFooter() {
  return (
    <div
      className="text-xs"
      style={{
        background: 'var(--bg-card-subtle)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-medium)',
        padding: '12px 16px',
        color: 'var(--text-secondary)',
        textAlign: 'center',
      }}
    >
      🔒 Your connection is secure. We use industry-standard encryption to protect your data.
    </div>
  );
}
