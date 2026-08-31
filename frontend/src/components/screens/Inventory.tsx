import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Search, AlertTriangle, Package, TrendingUp } from 'lucide-react';
import { Card } from '../Card';
import { productsApi, ProductResponse, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';

interface InventoryProps {
  storeId: number;
  currency: string;
  onEditProduct?: (productId: number) => void;
}

/**
 * Products at or below this on-hand quantity are flagged "Low Stock". The data
 * model has no per-product threshold yet, so one shared value is used store-wide.
 */
const LOW_STOCK_AT = 5;

type StockStatus = 'draft' | 'preorder' | 'out' | 'low' | 'in';

/**
 * Stock status, ordered so it stays honest: a draft isn't sellable and a
 * pre-order sits at 0 stock on purpose, so neither is reported as "Out of Stock".
 */
function statusOf(p: ProductResponse): StockStatus {
  if (!p.isActive) return 'draft';
  if (p.preOrder) return 'preorder';
  if (p.stock === 0) return 'out';
  if (p.stock <= LOW_STOCK_AT) return 'low';
  return 'in';
}

const STATUS_META: Record<StockStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: '#6B7280' },
  preorder: { label: 'Pre-order', color: '#7C3AED' },
  out: { label: 'Out of Stock', color: '#DC2626' },
  low: { label: 'Low Stock', color: '#F59E0B' },
  in: { label: 'In Stock', color: '#10B981' },
};

function StatCard({ icon, tint, label, value }: { icon: ReactNode; tint: string; label: string; value: string }) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '8px', background: `${tint}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</p>
          <p style={{ fontSize: '20px', fontWeight: 600 }}>{value}</p>
        </div>
      </div>
    </Card>
  );
}

function StatusTag({ status }: { status: StockStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="text-tag" style={{
      padding: '4px 8px', borderRadius: '4px', background: `${meta.color}20`, color: meta.color,
      fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap',
    }}>
      {meta.label}
    </span>
  );
}

export function Inventory({ storeId, currency, onEditProduct }: InventoryProps) {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    productsApi
      .list(storeId)
      .then((res) => { if (!cancelled) setProducts(res); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load inventory'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesSearch = q === '' ||
        [p.name, p.sku ?? '', p.categoryName ?? ''].some((f) => f.toLowerCase().includes(q));
      const s = statusOf(p);
      const matchesFilter =
        stockFilter === 'all' ||
        (stockFilter === 'low' && s === 'low') ||
        (stockFilter === 'out' && s === 'out');
      return matchesSearch && matchesFilter;
    });
  }, [products, searchQuery, stockFilter]);

  // Stats reflect every product, not the current filter/search.
  const lowStockCount = useMemo(() => products.filter((p) => statusOf(p) === 'low').length, [products]);
  const outOfStockCount = useMemo(() => products.filter((p) => statusOf(p) === 'out').length, [products]);
  const inventoryValue = useMemo(() => products.reduce((sum, p) => sum + p.stock * p.price, 0), [products]);

  const filterBtn = (value: 'all' | 'low' | 'out', label: string) => (
    <button
      onClick={() => setStockFilter(value)}
      style={{
        padding: '8px 16px', height: '40px', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-field)',
        background: stockFilter === value ? 'var(--primary-solid)' : 'var(--bg-card)',
        color: stockFilter === value ? 'var(--text-on-dark)' : 'var(--text-primary)',
        fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Inventory</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Track stock levels and inventory</p>
      </div>

      {loading ? (
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading inventory…</p>
      ) : error ? (
        <Card>
          <div className="text-small" style={{ padding: '24px', color: 'var(--error-color)' }}>{error}</div>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <StatCard icon={<Package size={20} style={{ color: '#3B82F6' }} />} tint="#3B82F6" label="Total Products" value={String(products.length)} />
            <StatCard icon={<AlertTriangle size={20} style={{ color: '#F59E0B' }} />} tint="#F59E0B" label="Low Stock" value={String(lowStockCount)} />
            <StatCard icon={<AlertTriangle size={20} style={{ color: '#DC2626' }} />} tint="#DC2626" label="Out of Stock" value={String(outOfStockCount)} />
            <StatCard icon={<TrendingUp size={20} style={{ color: '#10B981' }} />} tint="#10B981" label="Inventory Value" value={formatMoney(inventoryValue, currency)} />
          </div>

          {/* Search + filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by product name, SKU, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', height: '40px', paddingLeft: '40px', paddingRight: '12px',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)', fontSize: '13px', outline: 'none', color: 'var(--text-primary)',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {filterBtn('all', 'All')}
              {filterBtn('low', 'Low Stock')}
              {filterBtn('out', 'Out of Stock')}
            </div>
          </div>

          {/* Table / cards */}
          <Card>
            {products.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No products yet. Add products to start tracking inventory.
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No inventory items match your search or filter.
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="desktop-table" style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-card-subtle)' }}>
                        {['Product', 'SKU', 'Category', 'Stock', 'Sold', 'Status', 'Price'].map((h) => (
                          <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p) => (
                        <tr
                          key={p.id}
                          onClick={onEditProduct ? () => onEditProduct(p.id) : undefined}
                          style={{ borderBottom: '1px solid var(--border-subtle)', cursor: onEditProduct ? 'pointer' : 'default' }}
                        >
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{p.name}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{p.sku || '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>{p.categoryName || '—'}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{p.stock}</td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{p.unitsSold}</td>
                          <td style={{ padding: '12px 16px' }}><StatusTag status={statusOf(p)} /></td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{formatMoney(p.price, currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="mobile-cards" style={{ display: 'none' }}>
                  {filtered.map((p) => (
                    <div
                      key={p.id}
                      onClick={onEditProduct ? () => onEditProduct(p.id) : undefined}
                      style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-subtle)', marginBottom: '12px', cursor: onEditProduct ? 'pointer' : 'default' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="text-small" style={{ fontWeight: 500, marginBottom: '4px' }}>{p.name}</div>
                          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {p.categoryName || 'Uncategorised'}{p.sku ? ` · SKU: ${p.sku}` : ''}
                          </div>
                        </div>
                        <StatusTag status={statusOf(p)} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-small" style={{ fontWeight: 500 }}>{formatMoney(p.price, currency)}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.stock} in stock · {p.unitsSold} sold</span>
                      </div>
                    </div>
                  ))}
                </div>

                <style>{`
                  @media (max-width: 768px) {
                    .desktop-table { display: none !important; }
                    .mobile-cards { display: block !important; }
                  }
                `}</style>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
