import { Search, Plus, Download, Edit, Package } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { ToggleSwitch } from '../ToggleSwitch';
import { useEffect, useMemo, useState } from 'react';
import { productsApi, storesApi, ProductResponse, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';

interface ProductsListProps {
  storeId: number;
  currency: string;
  onNavigate?: (screen: string) => void;
  onEditProduct?: (productId: number) => void;
}

type DisplayStatus = 'active' | 'draft' | 'outofstock' | 'preorder';

function statusOf(p: ProductResponse): DisplayStatus {
  if (p.preOrder) return 'preorder';
  if (p.stock === 0) return 'outofstock';
  return p.isActive ? 'active' : 'draft';
}

const STATUS_COLOR: Record<DisplayStatus, string> = {
  active: '#10B981',
  draft: '#6B7280',
  outofstock: '#DC2626',
  preorder: '#D97706',
};
const STATUS_LABEL: Record<DisplayStatus, string> = {
  active: 'Active',
  draft: 'Draft',
  outofstock: 'Out of Stock',
  preorder: 'Pre-order',
};

export function ProductsList({ storeId, currency, onNavigate, onEditProduct }: ProductsListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Store-level item-customization setting, managed here alongside modifiers
  // (which live on each product's Add/Edit form). null until loaded.
  const [itemNotesEnabled, setItemNotesEnabled] = useState<boolean | null>(null);
  const [notesSaving, setNotesSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    productsApi
      .list(storeId)
      .then((res) => { if (!cancelled) setProducts(res); })
      .catch((e) => { if (!cancelled) setError(e instanceof ApiError ? e.message : 'Could not load products'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    storesApi.get(storeId)
      .then((s) => { if (!cancelled) setItemNotesEnabled(s.itemNotesEnabled); })
      .catch(() => { /* leave the toggle hidden if the store fetch fails */ });
    return () => { cancelled = true; };
  }, [storeId]);

  // Optimistic toggle; revert on failure so the switch never lies.
  const toggleItemNotes = async (next: boolean) => {
    const prev = itemNotesEnabled;
    setItemNotesEnabled(next);
    setNotesSaving(true);
    try {
      await storesApi.update(storeId, { itemNotesEnabled: next });
    } catch {
      setItemNotesEnabled(prev);
    } finally {
      setNotesSaving(false);
    }
  };

  // Search across every human-visible field: name, category, SKU, and the
  // derived status label (Active / Draft / Out of Stock / Pre-order). The
  // status is included both as-shown and collapsed, so "pre-order" and
  // "preorder" (or "out of stock" / "outofstock") both match.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const status = STATUS_LABEL[statusOf(p)];
      const haystack = [p.name, p.categoryName, p.sku, status, status.replace(/[\s-]/g, '')]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase());
      return haystack.some((h) => h.includes(q));
    });
  }, [products, searchQuery]);

  const handleExportProducts = () => {
    const headers = ['Product ID', 'Name', 'SKU', 'Category', 'Price', 'Stock', 'Units Sold', 'Status'];
    const csv = [
      headers.join(','),
      ...filtered.map((p) =>
        [p.id, p.name, p.sku || '', p.categoryName || '', p.price, p.stock, p.unitsSold, STATUS_LABEL[statusOf(p)]]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const Thumb = ({ p, size }: { p: ProductResponse; size: number }) => (
    <div
      style={{
        width: size, height: size, borderRadius: '8px', flexShrink: 0, overflow: 'hidden',
        background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {p.photoUrl ? (
        <img src={p.photoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Package size={18} style={{ color: 'var(--text-muted)' }} />
      )}
    </div>
  );

  const StatusTag = ({ p }: { p: ProductResponse }) => {
    const s = statusOf(p);
    return (
      <span
        className="text-tag"
        style={{
          padding: '4px 8px', borderRadius: '4px',
          background: `${STATUS_COLOR[s]}20`, color: STATUS_COLOR[s],
          fontSize: '12px', fontWeight: 500,
        }}
      >
        {STATUS_LABEL[s]}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Products</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Manage your product catalog
        </p>
      </div>

      {/* Item customization: store-level notes toggle (add-ons/modifiers are set
          per product on each Add/Edit Product form). */}
      {itemNotesEnabled !== null && (
        <div style={{ marginBottom: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-card)', padding: '16px 20px', opacity: notesSaving ? 0.7 : 1 }}>
          <p className="text-xs" style={{ fontWeight: 700, letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px' }}>Item customization</p>
          <ToggleSwitch
            checked={itemNotesEnabled}
            disabled={notesSaving}
            onChange={toggleItemNotes}
            label="Per-item notes"
            description="Let customers add a note to each item on the product page. Turn off if you don't take special requests. Applies to every product."
          />
        </div>
      )}

      {/* Actions Bar */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by product, category, SKU or status"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', height: '40px', paddingLeft: '40px', paddingRight: '12px',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-field)',
              background: 'var(--bg-card)', fontSize: '13px', outline: 'none',
            }}
          />
        </div>

        <Button onClick={() => onNavigate?.('products-add')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Add Product
          </div>
        </Button>

        <Button variant="secondary" onClick={handleExportProducts}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} />
            Export Products
          </div>
        </Button>
      </div>

      <Card>
        {loading ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading products…</div>
        ) : error ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--error-color)' }}>{error}</div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="desktop-table" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card-subtle)' }}>
                    {['Product', 'Category', 'Price', 'Stock', 'Units Sold', 'Status'].map((h) => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{h}</th>
                    ))}
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Thumb p={p} size={40} />
                          <div>
                            <div className="text-small" style={{ fontWeight: 500 }}>{p.name}</div>
                            {p.sku && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>SKU: {p.sku}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{p.categoryName || '-'}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{formatMoney(p.price, currency)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                        <span style={{ color: p.stock === 0 && !p.preOrder ? '#DC2626' : 'var(--text-primary)' }}>{p.stock} in stock</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{p.unitsSold}</td>
                      <td style={{ padding: '12px 16px' }}><StatusTag p={p} /></td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => onEditProduct?.(p.id)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                            background: 'var(--bg-card-subtle)', border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-field)', color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-app)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-card-subtle)'; }}
                        >
                          <Edit size={16} />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filtered.length === 0 && (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {products.length === 0 ? 'No products yet. Add your first one.' : 'No products match your search.'}
                </div>
              )}
            </div>

            {/* Mobile Cards */}
            <div className="mobile-cards" style={{ display: 'none' }}>
              {filtered.map((p) => (
                <div key={p.id} style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg-card-subtle)', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <Thumb p={p} size={48} />
                    <div style={{ flex: 1 }}>
                      <div className="text-small" style={{ fontWeight: 500, marginBottom: '4px' }}>{p.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {p.categoryName || '-'}{p.sku ? ` · SKU: ${p.sku}` : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div>
                      <span className="text-small" style={{ fontWeight: 500 }}>{formatMoney(p.price, currency)}</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>{p.stock} in stock · {p.unitsSold} sold</span>
                    </div>
                    <StatusTag p={p} />
                  </div>
                  <button
                    onClick={() => onEditProduct?.(p.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px',
                      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-field)',
                      color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
                    }}
                  >
                    <Edit size={16} />
                    Edit Product
                  </button>
                </div>
              ))}
            </div>

            <style>{`
              @media (max-width: 767px) {
                .desktop-table { display: none !important; }
                .mobile-cards { display: block !important; }
              }
            `}</style>
          </>
        )}
      </Card>

      {!loading && !error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '0 8px' }}>
          <span className="text-small" style={{ color: 'var(--text-secondary)' }}>Total {filtered.length} products</span>
        </div>
      )}
    </div>
  );
}
