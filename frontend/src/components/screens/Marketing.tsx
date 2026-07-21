import { useState } from 'react';
import { Plus, Percent, Tag, X, Edit2, Trash2, Users, Package } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { FieldInput } from '../Field';

interface Promotion {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  target: 'all' | 'products' | 'customers';
  targetItems: string[];
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount: number;
  status: 'active' | 'inactive' | 'expired';
  isPremium?: boolean;
}

export function Marketing() {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  
  const [newPromo, setNewPromo] = useState({
    name: '',
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    target: 'all' as 'all' | 'products' | 'customers',
    targetItems: [] as string[],
    startDate: '',
    endDate: '',
    usageLimit: '',
  });

  const [editPromoData, setEditPromoData] = useState({
    name: '',
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: '',
    target: 'all' as 'all' | 'products' | 'customers',
    targetItems: [] as string[],
    startDate: '',
    endDate: '',
    usageLimit: '',
  });

  const mockPromotions: Promotion[] = [
    {
      id: '1',
      name: 'New Customer Discount',
      code: 'WELCOME10',
      type: 'percentage',
      value: 10,
      target: 'all',
      targetItems: [],
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      usageLimit: 100,
      usedCount: 23,
      status: 'active',
    },
    {
      id: '2',
      name: 'Flash Sale - Coffee',
      code: 'COFFEE20',
      type: 'percentage',
      value: 20,
      target: 'products',
      targetItems: ['Iced White', 'Cold Brew', 'Americano'],
      startDate: '2025-12-01',
      endDate: '2025-12-31',
      usageLimit: 50,
      usedCount: 45,
      status: 'active',
    },
    {
      id: '3',
      name: 'VIP Customer Bonus',
      code: 'VIP15',
      type: 'percentage',
      value: 15,
      target: 'customers',
      targetItems: ['John Doe', 'Sarah Wilson', 'Emily Davis'],
      startDate: '2025-11-01',
      endDate: '2025-11-30',
      usedCount: 12,
      status: 'expired',
      isPremium: true,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'inactive':
        return '#6B7280';
      case 'expired':
        return '#DC2626';
      default:
        return 'var(--text-muted)';
    }
  };

  const handleCreatePromo = () => {
    if (!newPromo.name || !newPromo.code || !newPromo.value) {
      alert('Please fill in all required fields');
      return;
    }

    if (newPromo.target !== 'all' && mockPromotions.length >= 2) {
      alert('🔒 Upgrade to Premium to create targeted promotions for specific products or customers!');
      return;
    }

    alert(`Promotion "${newPromo.name}" created successfully!`);
    setShowAddForm(false);
    setNewPromo({
      name: '',
      code: '',
      type: 'percentage',
      value: '',
      target: 'all',
      targetItems: [],
      startDate: '',
      endDate: '',
      usageLimit: '',
    });
  };

  const handleEditPromo = () => {
    if (!editPromoData.name || !editPromoData.code || !editPromoData.value) {
      alert('Please fill in all required fields');
      return;
    }

    if (editPromoData.target !== 'all' && mockPromotions.length >= 2) {
      alert('🔒 Upgrade to Premium to create targeted promotions for specific products or customers!');
      return;
    }

    alert(`Promotion "${editPromoData.name}" updated successfully!`);
    setShowEditForm(false);
    setEditPromoData({
      name: '',
      code: '',
      type: 'percentage',
      value: '',
      target: 'all',
      targetItems: [],
      startDate: '',
      endDate: '',
      usageLimit: '',
    });
  };

  const activePromos = mockPromotions.filter(p => p.status === 'active');
  const expiredPromos = mockPromotions.filter(p => p.status === 'expired');

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>Marketing & Promotions</h1>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Create discount codes and manage promotional campaigns
          </p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Create Promotion
          </div>
        </Button>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px',
        marginBottom: '24px'
      }}>
        <Card>
          <div className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Active Promotions
          </div>
          <h2 style={{ marginBottom: '4px' }}>{activePromos.length}</h2>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Running campaigns
          </div>
        </Card>

        <Card>
          <div className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Total Redemptions
          </div>
          <h2 style={{ marginBottom: '4px' }}>
            {mockPromotions.reduce((sum, p) => sum + p.usedCount, 0)}
          </h2>
          <div className="text-xs" style={{ color: '#10B981' }}>
            +12% vs last month
          </div>
        </Card>

        <Card>
          <div className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Discount Revenue
          </div>
          <h2 style={{ marginBottom: '4px' }}>S$1,234</h2>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Total discounts given
          </div>
        </Card>
      </div>

      {/* Add Promotion Form */}
      {showAddForm && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500 }}>Create New Promotion</h2>
            <X size={16} style={{ cursor: 'pointer' }} onClick={() => setShowAddForm(false)} />
          </div>

          <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <FieldInput
                label="Promotion Name *"
                placeholder="New Customer Discount"
                value={newPromo.name}
                onChange={(value) => setNewPromo({ ...newPromo, name: value })}
              />
            </div>
            <div>
              <FieldInput
                label="Promo Code *"
                placeholder="WELCOME10"
                value={newPromo.code}
                onChange={(value) => setNewPromo({ ...newPromo, code: value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="form-row-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Discount Type *
              </label>
              <select
                value={newPromo.type}
                onChange={(e) => setNewPromo({ ...newPromo, type: e.target.value as 'percentage' | 'fixed' })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <FieldInput
                label="Value *"
                placeholder={newPromo.type === 'percentage' ? '10' : '5.00'}
                type="number"
                value={newPromo.value}
                onChange={(value) => setNewPromo({ ...newPromo, value: value })}
                prefix={newPromo.type === 'percentage' ? '%' : '$'}
              />
            </div>

            <div>
              <FieldInput
                label="Usage Limit"
                placeholder="100"
                type="number"
                value={newPromo.usageLimit}
                onChange={(value) => setNewPromo({ ...newPromo, usageLimit: value })}
                helperText="Leave empty for unlimited"
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Apply To
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setNewPromo({ ...newPromo, target: 'all' })}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: newPromo.target === 'all' ? '2px solid #000' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: newPromo.target === 'all' ? 'var(--bg-app)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                All Products
              </button>
              <button
                onClick={() => {
                  if (mockPromotions.length >= 2) {
                    alert('🔒 Premium Feature: Upgrade to create product-specific promotions');
                  } else {
                    setNewPromo({ ...newPromo, target: 'products' });
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: newPromo.target === 'products' ? '2px solid #000' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: newPromo.target === 'products' ? 'var(--bg-app)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  <Package size={14} />
                  Specific Products
                  <span style={{ 
                    fontSize: '10px', 
                    background: '#000', 
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: 600
                  }}>PRO</span>
                </div>
              </button>
              <button
                onClick={() => {
                  if (mockPromotions.length >= 2) {
                    alert('🔒 Premium Feature: Upgrade to create customer-specific promotions');
                  } else {
                    setNewPromo({ ...newPromo, target: 'customers' });
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: newPromo.target === 'customers' ? '2px solid #000' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: newPromo.target === 'customers' ? 'var(--bg-app)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  <Users size={14} />
                  Specific Customers
                  <span style={{ 
                    fontSize: '10px', 
                    background: '#000', 
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: 600
                  }}>PRO</span>
                </div>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Start Date
              </label>
              <input
                type="date"
                value={newPromo.startDate}
                onChange={(e) => setNewPromo({ ...newPromo, startDate: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                End Date
              </label>
              <input
                type="date"
                value={newPromo.endDate}
                onChange={(e) => setNewPromo({ ...newPromo, endDate: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <Button onClick={handleCreatePromo} fullWidth>
            Create Promotion
          </Button>
        </Card>
      )}

      {/* Edit Promotion Form */}
      {showEditForm && editingPromo && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500 }}>Edit Promotion</h2>
            <X size={16} style={{ cursor: 'pointer' }} onClick={() => setShowEditForm(false)} />
          </div>

          <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <FieldInput
                label="Promotion Name *"
                placeholder="New Customer Discount"
                value={editPromoData.name}
                onChange={(value) => setEditPromoData({ ...editPromoData, name: value })}
              />
            </div>
            <div>
              <FieldInput
                label="Promo Code *"
                placeholder="WELCOME10"
                value={editPromoData.code}
                onChange={(value) => setEditPromoData({ ...editPromoData, code: value.toUpperCase() })}
              />
            </div>
          </div>

          <div className="form-row-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Discount Type *
              </label>
              <select
                value={editPromoData.type}
                onChange={(e) => setEditPromoData({ ...editPromoData, type: e.target.value as 'percentage' | 'fixed' })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>

            <div>
              <FieldInput
                label="Value *"
                placeholder={editPromoData.type === 'percentage' ? '10' : '5.00'}
                type="number"
                value={editPromoData.value}
                onChange={(value) => setEditPromoData({ ...editPromoData, value: value })}
                prefix={editPromoData.type === 'percentage' ? '%' : '$'}
              />
            </div>

            <div>
              <FieldInput
                label="Usage Limit"
                placeholder="100"
                type="number"
                value={editPromoData.usageLimit}
                onChange={(value) => setEditPromoData({ ...editPromoData, usageLimit: value })}
                helperText="Leave empty for unlimited"
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Apply To
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setEditPromoData({ ...editPromoData, target: 'all' })}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: editPromoData.target === 'all' ? '2px solid #000' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: editPromoData.target === 'all' ? 'var(--bg-app)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                All Products
              </button>
              <button
                onClick={() => {
                  if (mockPromotions.length >= 2) {
                    alert('🔒 Premium Feature: Upgrade to create product-specific promotions');
                  } else {
                    setEditPromoData({ ...editPromoData, target: 'products' });
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: editPromoData.target === 'products' ? '2px solid #000' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: editPromoData.target === 'products' ? 'var(--bg-app)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  <Package size={14} />
                  Specific Products
                  <span style={{ 
                    fontSize: '10px', 
                    background: '#000', 
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: 600
                  }}>PRO</span>
                </div>
              </button>
              <button
                onClick={() => {
                  if (mockPromotions.length >= 2) {
                    alert('🔒 Premium Feature: Upgrade to create customer-specific promotions');
                  } else {
                    setEditPromoData({ ...editPromoData, target: 'customers' });
                  }
                }}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: editPromoData.target === 'customers' ? '2px solid #000' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: editPromoData.target === 'customers' ? 'var(--bg-app)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  <Users size={14} />
                  Specific Customers
                  <span style={{ 
                    fontSize: '10px', 
                    background: '#000', 
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: 600
                  }}>PRO</span>
                </div>
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Start Date
              </label>
              <input
                type="date"
                value={editPromoData.startDate}
                onChange={(e) => setEditPromoData({ ...editPromoData, startDate: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                End Date
              </label>
              <input
                type="date"
                value={editPromoData.endDate}
                onChange={(e) => setEditPromoData({ ...editPromoData, endDate: e.target.value })}
                style={{
                  width: '100%',
                  height: '40px',
                  padding: '0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <Button onClick={handleEditPromo} fullWidth>
            Update Promotion
          </Button>
        </Card>
      )}

      {/* Active Promotions */}
      <Card title="Active Promotions" style={{ marginBottom: '16px' }}>
        {activePromos.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Percent size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>No active promotions. Create one to start attracting customers!</p>
          </div>
        ) : (
          <div style={{ marginTop: '16px' }}>
            {activePromos.map((promo) => (
              <div
                key={promo.id}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: 'var(--bg-card-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Percent size={24} style={{ color: 'var(--text-secondary)' }} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <h3 className="text-small" style={{ fontWeight: 600 }}>
                      {promo.name}
                    </h3>
                    {promo.isPremium && (
                      <span style={{ 
                        fontSize: '10px', 
                        background: '#000', 
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontWeight: 600
                      }}>
                        PRO
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <code
                      style={{
                        padding: '4px 8px',
                        background: '#000',
                        color: '#fff',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {promo.code}
                    </code>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {promo.type === 'percentage' ? `${promo.value}%` : `S$${promo.value}`} off
                    </span>
                    {promo.target !== 'all' && (
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        • {promo.target === 'products' ? 'Products' : 'Customers'}: {promo.targetItems.join(', ')}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span>Used: {promo.usedCount}{promo.usageLimit ? `/${promo.usageLimit}` : ''}</span>
                    <span>Valid: {new Date(promo.startDate).toLocaleDateString()} - {new Date(promo.endDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    style={{
                      padding: '8px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                    }}
                    onClick={() => {
                      setEditingPromo(promo);
                      setEditPromoData({
                        name: promo.name,
                        code: promo.code,
                        type: promo.type,
                        value: promo.value.toString(),
                        target: promo.target,
                        targetItems: promo.targetItems,
                        startDate: promo.startDate,
                        endDate: promo.endDate,
                        usageLimit: promo.usageLimit ? promo.usageLimit.toString() : '',
                      });
                      setShowEditForm(true);
                    }}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    style={{
                      padding: '8px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: '#DC2626',
                    }}
                    onClick={() => {
                      if (confirm('Delete this promotion?')) {
                        alert('Promotion deleted');
                      }
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Expired Promotions */}
      {expiredPromos.length > 0 && (
        <Card title="Expired Promotions">
          <div style={{ marginTop: '16px' }}>
            {expiredPromos.map((promo) => (
              <div
                key={promo.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  opacity: 0.6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="text-small" style={{ fontWeight: 500, marginBottom: '4px' }}>
                      {promo.name} - <code style={{ fontSize: '11px' }}>{promo.code}</code>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Ended: {new Date(promo.endDate).toLocaleDateString()} • {promo.usedCount} redemptions
                    </div>
                  </div>
                  <span
                    className="text-tag"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: '#FEE2E2',
                      color: '#DC2626',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    Expired
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: 1fr 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}