import { TrendingUp, ShoppingCart, DollarSign, Eye, Star } from 'lucide-react';
import { Card } from '../Card';

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: 'up' | 'down';
  icon: React.ReactNode;
}

function StatCard({ title, value, change, trend, icon }: StatCardProps) {
  const isEmpty = !change;
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
            {title}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
          {isEmpty ? (
            <div className="text-xs" style={{ color: 'var(--text-muted)', marginTop: 6 }}>
              No data yet
            </div>
          ) : (
            <div
              className="text-xs"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: trend === 'down' ? '#ef4444' : '#22c55e',
                marginTop: 6,
              }}
            >
              {change}
            </div>
          )}
        </div>

        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: 'var(--bg-card-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function Dashboard() {
  // v1: no analytics yet → show empty state (no fake numbers)
  const stats = [
    { title: 'Total Revenue', value: '—', icon: <DollarSign size={18} /> },
    { title: 'Orders', value: '—', icon: <ShoppingCart size={18} /> },
    { title: 'Store Views', value: '—', icon: <Eye size={18} /> },
    { title: 'Conversion Rate', value: '—', icon: <TrendingUp size={18} /> },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '6px' }}>Dashboard Overview</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
        Your analytics will appear here after you start receiving orders.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
        {stats.map((s) => (
          <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} />
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Star size={18} />
              <div style={{ fontSize: 18, fontWeight: 700 }}>Best Sellers</div>
            </div>

            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              No sales yet. Once customers start ordering, your best sellers will appear here.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
