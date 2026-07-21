import { Search, Download, Plus, X, MessageSquare, Filter, CheckSquare, Square } from 'lucide-react';
import { Card } from '../Card';
import { Button } from '../Button';
import { useState } from 'react';
import { FieldInput } from '../Field';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  totalSpent: string;
  status: 'active' | 'inactive';
  firstOrder: string;
}

export function Customers() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterOrders, setFilterOrders] = useState<string>('all');
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [broadcastMessage, setBroadcastMessage] = useState('');

  const mockCustomers: Customer[] = [
    { id: '1', name: 'John Doe', email: 'john@example.com', phone: '+65 8123 4567', orders: 12, totalSpent: 'S$1,245.00', status: 'active', firstOrder: 'Jan 15, 2025' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '+65 9234 5678', orders: 8, totalSpent: 'S$890.50', status: 'active', firstOrder: 'Feb 3, 2025' },
    { id: '3', name: 'Mike Johnson', email: 'mike@example.com', phone: '+62 812 3456 7890', orders: 5, totalSpent: 'Rp456,000', status: 'active', firstOrder: 'Mar 12, 2025' },
    { id: '4', name: 'Sarah Wilson', email: 'sarah@example.com', phone: '+65 8765 4321', orders: 15, totalSpent: 'S$2,340.00', status: 'active', firstOrder: 'Jan 8, 2025' },
    { id: '5', name: 'David Brown', email: 'david@example.com', phone: '+62 821 9876 5432', orders: 3, totalSpent: 'Rp234,500', status: 'inactive', firstOrder: 'Apr 20, 2025' },
    { id: '6', name: 'Emily Davis', email: 'emily@example.com', phone: '+65 9876 5432', orders: 20, totalSpent: 'S$3,450.00', status: 'active', firstOrder: 'Dec 1, 2024' },
  ];

  const filteredCustomers = mockCustomers.filter(customer => 
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.includes(searchQuery)
  ).filter(customer => 
    filterStatus === 'all' || customer.status === filterStatus
  ).filter(customer => {
    if (filterOrders === 'all') return true;
    if (filterOrders === '10+') return customer.orders >= 10;
    if (filterOrders === '5-9') return customer.orders >= 5 && customer.orders < 10;
    if (filterOrders === '1-4') return customer.orders >= 1 && customer.orders < 5;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'inactive':
        return '#6B7280';
      default:
        return 'var(--text-muted)';
    }
  };

  const handleExportCustomers = () => {
    const headers = ['Name', 'Email', 'Phone', 'Orders', 'Total Spent', 'Status', 'First Order'];
    const csvContent = [
      headers.join(','),
      ...mockCustomers.map(customer => 
        [
          customer.name,
          customer.email,
          customer.phone,
          customer.orders,
          customer.totalSpent,
          customer.status,
          customer.firstOrder
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleBroadcast = () => {
    const customersToContact = selectedCustomers.length > 0 
      ? filteredCustomers.filter(c => selectedCustomers.includes(c.id))
      : filteredCustomers;

    if (customersToContact.length === 0) {
      alert('Please select at least one customer');
      return;
    }

    // Build WhatsApp broadcast URL
    const phones = customersToContact.map(c => c.phone.replace(/\s+/g, '')).join(',');
    const message = encodeURIComponent(broadcastMessage || 'Hello from ManyOrder!');
    
    alert(`Broadcasting to ${customersToContact.length} customer(s):\n\n${customersToContact.map(c => `${c.name} (${c.phone})`).join('\n')}\n\nMessage: ${broadcastMessage}`);
    setShowBroadcast(false);
    setBroadcastMessage('');
    setSelectedCustomers([]);
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomers(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Customers</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Manage your customer relationships and send broadcasts
        </p>
      </div>

      {/* Actions Bar */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>\n        {/* Search */}
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>\n          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }} 
          />
          <input
            type="text"
            placeholder="Search by customer name, phone, or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '40px',
              borderRadius: 'var(--radius-field)',
              border: '1px solid var(--border-strong)',
              background: 'var(--bg-card)',
              paddingLeft: '40px',
              paddingRight: '12px',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} />
            Filters
          </div>
        </Button>

        <Button variant="secondary" onClick={() => setShowBroadcast(!showBroadcast)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MessageSquare size={16} />
            Broadcast ({selectedCustomers.length || filteredCustomers.length})
          </div>
        </Button>

        <Button variant="secondary" onClick={handleExportCustomers}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Download size={16} />
            Export
          </div>
        </Button>

        <Button onClick={() => setShowAddForm(true)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} />
            Add Customer
          </div>
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                Orders
              </label>
              <select
                value={filterOrders}
                onChange={(e) => setFilterOrders(e.target.value)}
                style={{
                  height: '36px',
                  padding: '0 32px 0 12px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-field)',
                  background: 'var(--bg-card)',
                  fontSize: '13px',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                }}
              >
                <option value="all">All Orders</option>
                <option value="10+">10+ orders</option>
                <option value="5-9">5-9 orders</option>
                <option value="1-4">1-4 orders</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto' }}>
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterOrders('all');
                }}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear filters
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Broadcast Panel */}
      {showBroadcast && (
        <Card style={{ marginBottom: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>WhatsApp Broadcast</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {selectedCustomers.length > 0 
                ? `Broadcasting to ${selectedCustomers.length} selected customer(s)` 
                : `Broadcasting to all ${filteredCustomers.length} filtered customer(s)`}
            </p>
          </div>
          <textarea
            placeholder="Enter your broadcast message here..."
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-field)',
              background: 'var(--bg-card)',
              fontSize: '13px',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <Button onClick={handleBroadcast}>
              Send Broadcast via WhatsApp
            </Button>
            <Button variant="ghost" onClick={() => setShowBroadcast(false)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Add Customer Form */}
      {showAddForm && (
        <Card style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500 }}>Add Customer</h2>
            <X size={16} style={{ cursor: 'pointer' }} onClick={() => setShowAddForm(false)} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <FieldInput
              label="Name"
              value={newCustomer.name}
              onChange={(value) => setNewCustomer({ ...newCustomer, name: value })}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <FieldInput
              label="Email"
              value={newCustomer.email}
              onChange={(value) => setNewCustomer({ ...newCustomer, email: value })}
              style={{ flex: 1, minWidth: '200px' }}
            />
            <FieldInput
              label="Phone"
              value={newCustomer.phone}
              onChange={(value) => setNewCustomer({ ...newCustomer, phone: value })}
              style={{ flex: 1, minWidth: '200px' }}
            />
          </div>
          <Button
            onClick={() => {
              alert(`Customer "${newCustomer.name}" added successfully!`);
              setShowAddForm(false);
              setNewCustomer({ name: '', email: '', phone: '' });
            }}
          >
            Add Customer
          </Button>
        </Card>
      )}

      {/* Customers Table */}
      <Card>
        {/* Desktop Table */}
        <div className="desktop-table" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-card-subtle)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', width: '40px' }}>
                  <button
                    onClick={toggleSelectAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {selectedCustomers.length === filteredCustomers.length ? (
                      <CheckSquare size={18} style={{ color: 'var(--primary-solid)' }} />
                    ) : (
                      <Square size={18} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </button>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Customer</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Email</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Phone</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Orders</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Spent</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Status
                  <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, marginTop: '2px' }}>(ordered in last 30 days)</span>
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>First Order</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => toggleSelectCustomer(customer.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {selectedCustomers.includes(customer.id) ? (
                        <CheckSquare size={18} style={{ color: 'var(--primary-solid)' }} />
                      ) : (
                        <Square size={18} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'var(--primary-solid)',
                          color: 'var(--text-on-dark)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '13px',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </div>
                      <span className="text-small" style={{ fontWeight: 500 }}>{customer.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{customer.email}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{customer.phone}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{customer.orders}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{customer.totalSpent}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span 
                      className="text-tag"
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: `${getStatusColor(customer.status)}20`,
                        color: getStatusColor(customer.status),
                        textTransform: 'capitalize',
                        fontSize: '12px',
                        fontWeight: 500,
                      }}
                    >
                      {customer.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--text-muted)' }}>{customer.firstOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredCustomers.length === 0 && (
            <div style={{ 
              padding: '48px 24px', 
              textAlign: 'center', 
              color: 'var(--text-muted)' 
            }}>
              No customers found
            </div>
          )}
        </div>

        {/* Mobile Cards */}
        <div className="mobile-cards" style={{ display: 'none' }}>
          {filteredCustomers.map((customer) => (
            <div 
              key={customer.id}
              style={{ 
                padding: '16px',
                borderRadius: 'var(--radius-field)',
                background: 'var(--bg-card-subtle)',
                marginBottom: '12px',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <button
                  onClick={() => toggleSelectCustomer(customer.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {selectedCustomers.includes(customer.id) ? (
                    <CheckSquare size={20} style={{ color: 'var(--primary-solid)' }} />
                  ) : (
                    <Square size={20} style={{ color: 'var(--text-muted)' }} />
                  )}
                </button>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'var(--primary-solid)',
                    color: 'var(--text-on-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="text-small" style={{ fontWeight: 500, marginBottom: '4px' }}>{customer.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{customer.email}</div>
                </div>
                <span 
                  className="text-tag"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: `${getStatusColor(customer.status)}20`,
                    color: getStatusColor(customer.status),
                    textTransform: 'capitalize',
                    fontSize: '12px',
                    fontWeight: 500,
                    height: 'fit-content',
                  }}
                >
                  {customer.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{customer.phone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{customer.orders} orders</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', margin: '0 4px' }}>•</span>
                  <span className="text-small" style={{ fontWeight: 500 }}>{customer.totalSpent}</span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>First: {customer.firstOrder}</span>
              </div>
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

      {/* Footer */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginTop: '16px',
        padding: '0 8px'
      }}>
        <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
          {selectedCustomers.length > 0 && `${selectedCustomers.length} selected • `}
          Total {filteredCustomers.length} customers
        </span>
      </div>
    </div>
  );
}
