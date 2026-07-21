import { Search, Plus, Filter, Download, Edit } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { useState } from 'react';

interface Product {
  id: string;
  name: string;
  category: string;
  price: string;
  inventory: number;
  status: 'active' | 'draft' | 'outofstock';
}

interface ProductsListProps {
  onNavigate?: (screen: string) => void;
}

export function ProductsList({ onNavigate }: ProductsListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const mockProducts: Product[] = [
    { id: '1', name: 'Wireless Headphones', category: 'Electronics', price: '$89.99', inventory: 45, status: 'active' },
    { id: '2', name: 'Leather Wallet', category: 'Fashion', price: '$45.00', inventory: 120, status: 'active' },
    { id: '3', name: 'Smart Watch', category: 'Electronics', price: '$299.00', inventory: 0, status: 'outofstock' },
    { id: '4', name: 'Coffee Mug Set', category: 'Home', price: '$24.99', inventory: 78, status: 'active' },
    { id: '5', name: 'Yoga Mat', category: 'Sports', price: '$35.00', inventory: 34, status: 'active' },
    { id: '6', name: 'Desk Lamp', category: 'Home', price: '$56.50', inventory: 12, status: 'draft' },
  ];

  const filteredProducts = mockProducts.filter(product => 
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'draft':
        return '#6B7280';
      case 'outofstock':
        return '#DC2626';
      default:
        return 'var(--text-muted)';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'draft':
        return 'Draft';
      case 'outofstock':
        return 'Out of Stock';
      default:
        return status;
    }
  };

  const handleExportProducts = () => {
    // Create CSV content
    const headers = ['Product ID', 'Name', 'Category', 'Price', 'Inventory', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredProducts.map(product => 
        [
          product.id,
          product.name,
          product.category,
          product.price,
          product.inventory,
          getStatusLabel(product.status)
        ].join(',')
      )
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
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

      {/* Actions Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Search */}
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)' 
            }} 
          />
          <input
            type="text"
            placeholder="Search by product, variant names or SKU"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              paddingLeft: '40px',
              paddingRight: '12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-field)',
              background: 'var(--bg-card)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <Button onClick={() => onNavigate?.('products-add')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Add Product
          </div>
        </Button>

        <Button onClick={handleExportProducts}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} />
            Export Products
          </div>
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        {/* Desktop Table */}
        <div className="desktop-table" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card-subtle)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Product</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Price</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Inventory</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '8px',
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-subtle)',
                          flexShrink: 0,
                        }}
                      />
                      <span className="text-small" style={{ fontWeight: 500 }}>{product.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{product.category}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{product.price}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                    <span style={{ color: product.inventory === 0 ? '#DC2626' : 'var(--text-primary)' }}>
                      {product.inventory} in stock
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span 
                      className="text-tag"
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: `${getStatusColor(product.status)}20`,
                        color: getStatusColor(product.status),
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {getStatusLabel(product.status)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => onNavigate?.('products-edit')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: 'var(--bg-card-subtle)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-field)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-app)';
                        e.currentTarget.style.borderColor = 'var(--border-primary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-card-subtle)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      }}
                    >
                      <Edit size={16} />
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div style={{ 
              padding: '48px 24px', 
              textAlign: 'center', 
              color: 'var(--text-muted)' 
            }}>
              No products found
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="mobile-cards" style={{ display: 'none' }}>
          {filteredProducts.map((product) => (
            <div 
              key={product.id}
              style={{ 
                padding: '16px',
                borderRadius: '8px',
                background: 'var(--bg-card-subtle)',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div className="text-small" style={{ fontWeight: 500, marginBottom: '4px' }}>{product.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{product.category}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span className="text-small" style={{ fontWeight: 500 }}>{product.price}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {product.inventory} in stock
                  </span>
                </div>
                <span 
                  className="text-tag"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: `${getStatusColor(product.status)}20`,
                    color: getStatusColor(product.status),
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                >
                  {getStatusLabel(product.status)}
                </span>
              </div>
              <button
                onClick={() => onNavigate?.('products-edit')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
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
            .desktop-table {
              display: none !important;
            }
            .mobile-cards {
              display: block !important;
            }
          }
        `}</style>
      </Card>

      {/* Pagination */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginTop: '16px',
        padding: '0 8px'
      }}>
        <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Total {filteredProducts.length} products
        </span>
      </div>
    </div>
  );
}