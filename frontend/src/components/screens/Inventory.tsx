import { useState } from 'react';
import { Search, AlertTriangle, Package, TrendingUp } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  lowStockThreshold: number;
  category: string;
  price: string;
}

export function Inventory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const mockInventory: InventoryItem[] = [
    { id: '1', name: 'Wireless Headphones', sku: 'WH-001', stock: 45, lowStockThreshold: 5, category: 'Electronics', price: '$89.99' },
    { id: '2', name: 'Leather Wallet', sku: 'LW-002', stock: 8, lowStockThreshold: 5, category: 'Fashion', price: '$45.00' },
    { id: '3', name: 'Smart Watch', sku: 'SW-003', stock: 0, lowStockThreshold: 5, category: 'Electronics', price: '$299.00' },
    { id: '4', name: 'Coffee Mug Set', sku: 'CM-004', stock: 120, lowStockThreshold: 5, category: 'Home', price: '$24.99' },
    { id: '5', name: 'Yoga Mat', sku: 'YM-005', stock: 3, lowStockThreshold: 5, category: 'Sports', price: '$35.00' },
    { id: '6', name: 'Desk Lamp', sku: 'DL-006', stock: 28, lowStockThreshold: 5, category: 'Home', price: '$56.50' },
  ];

  const filteredInventory = mockInventory.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = 
      stockFilter === 'all' ||
      (stockFilter === 'low' && item.stock > 0 && item.stock <= item.lowStockThreshold) ||
      (stockFilter === 'out' && item.stock === 0);
    
    return matchesSearch && matchesFilter;
  });

  const getStockStatus = (item: InventoryItem) => {
    if (item.stock === 0) return { label: 'Out of Stock', color: '#DC2626' };
    if (item.stock <= item.lowStockThreshold) return { label: 'Low Stock', color: '#F59E0B' };
    return { label: 'In Stock', color: '#10B981' };
  };

  const lowStockCount = mockInventory.filter(item => item.stock > 0 && item.stock <= item.lowStockThreshold).length;
  const outOfStockCount = mockInventory.filter(item => item.stock === 0).length;
  const totalValue = mockInventory.reduce((sum, item) => sum + (item.stock * parseFloat(item.price.replace('$', ''))), 0);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Inventory</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Track stock levels and inventory
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#3B82F620',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Package size={20} style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Total Products
              </p>
              <p style={{ fontSize: '20px', fontWeight: 600 }}>{mockInventory.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#F59E0B20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={20} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Low Stock
              </p>
              <p style={{ fontSize: '20px', fontWeight: 600 }}>{lowStockCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#DC262620',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <AlertTriangle size={20} style={{ color: '#DC2626' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Out of Stock
              </p>
              <p style={{ fontSize: '20px', fontWeight: 600 }}>{outOfStockCount}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: '#10B98120',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <TrendingUp size={20} style={{ color: '#10B981' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Inventory Value
              </p>
              <p style={{ fontSize: '20px', fontWeight: 600 }}>${totalValue.toFixed(2)}</p>
            </div>
          </div>
        </Card>
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
            placeholder="Search by product name, SKU, category..."
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

        {/* Filter Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setStockFilter('all')}
            style={{
              padding: '8px 16px',
              height: '40px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-field)',
              background: stockFilter === 'all' ? 'var(--primary-solid)' : 'var(--bg-card)',
              color: stockFilter === 'all' ? 'var(--text-on-dark)' : 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          <button
            onClick={() => setStockFilter('low')}
            style={{
              padding: '8px 16px',
              height: '40px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-field)',
              background: stockFilter === 'low' ? 'var(--primary-solid)' : 'var(--bg-card)',
              color: stockFilter === 'low' ? 'var(--text-on-dark)' : 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Low Stock
          </button>
          <button
            onClick={() => setStockFilter('out')}
            style={{
              padding: '8px 16px',
              height: '40px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-field)',
              background: stockFilter === 'out' ? 'var(--primary-solid)' : 'var(--bg-card)',
              color: stockFilter === 'out' ? 'var(--text-on-dark)' : 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Out of Stock
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card-subtle)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Product</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>SKU</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Category</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Stock</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => {
                const status = getStockStatus(item);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{item.sku}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{item.category}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{item.stock}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span 
                        className="text-tag"
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: `${status.color}20`,
                          color: status.color,
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{item.price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredInventory.length === 0 && (
            <div style={{ 
              padding: '48px 24px', 
              textAlign: 'center', 
              color: 'var(--text-muted)' 
            }}>
              No inventory items found
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}