import { Store, Package, LayoutDashboard, Settings, ShoppingCart, Users, ChevronDown, LogOut, Megaphone, Crown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { NavItem } from './NavItem';
import logoImage from 'figma:asset/656d97789c4d3f72628639902518b8fbf366d5ba.png';
import { supabase } from '../lib/supabase';

interface StoreData {
  id: string;
  name: string;
  color: string;
  logo?: string;
}

interface SidebarProps {
  activeItem: string;
  onNavigate: (item: string) => void;
  stores: StoreData[];
  activeStoreId: string;
  onStoreChange: (storeId: string) => void;
  isOpen?: boolean;
}

export function Sidebar({ 
  activeItem, 
  onNavigate, 
  stores,
  activeStoreId,
  onStoreChange,
  isOpen = true 
}: SidebarProps) {
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const activeStore = stores.find(s => s.id === activeStoreId) || stores[0];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const productSubItems = [
    { label: 'All Products', id: 'products-all' },
    { label: 'Add Product', id: 'products-add' },
    { label: 'Categories', id: 'products-categories' },
    { label: 'Inventory', id: 'products-inventory' },
  ];

  const storeSubItems = [
    { label: 'All Stores', id: 'stores-all' },
    { label: 'Create Store', id: 'stores-create' },
  ];

  const orderSubItems = [
    { label: 'All Orders', id: 'orders-all' },
    { label: 'Add Order', id: 'orders-add' },
  ];

  const handleProductSubItem = (subItemId: string) => {
    onNavigate(subItemId);
  };

  const handleStoreSubItem = (subItemId: string) => {
    onNavigate(subItemId);
  };

  const handleOrderSubItem = (subItemId: string) => {
    onNavigate(subItemId);
  };

  return (
    <div
      style={{
        width: isOpen ? '256px' : '0',
        height: '100%',
        background: 'var(--bg-card)',
        borderRight: isOpen ? '1px solid var(--border-subtle)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        transition: 'width 0.3s ease',
        flexShrink: 0,
      }}
    >
      {isOpen && stores.length > 0 && (
        <>
          {/* //Store Switcher */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
            <button
              onClick={() => setShowStoreDropdown(!showStoreDropdown)}
              style={{
                width: '100%',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {/* Store Logo */}
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: activeStore.logo ? 'transparent' : activeStore.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid var(--border-subtle)',
                }}
              >
                {activeStore.logo ? (
                  <img
                    src={activeStore.logo}
                    alt={activeStore.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  getInitials(activeStore.name)
                )}
              </div>

              <div style={{ flex: 1, textAlign: 'left' }}>
                <div
                  className="text-small"
                  style={{
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {activeStore.name}
                </div>
                <div
                  className="text-xs"
                  style={{
                    color: 'var(--text-muted)',
                  }}
                >
                  Switch store
                </div>
              </div>

              <ChevronDown 
                size={16} 
                style={{ 
                  color: 'var(--text-muted)',
                  transform: showStoreDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }} 
              />
            </button>

            {/* Store Dropdown */}
            {showStoreDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '72px',
                  left: '16px',
                  right: '16px',
                  width: '224px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-medium)',
                  boxShadow: 'var(--shadow-card)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {stores.map((store) => (
                    <button
                      key={store.id}
                      onClick={() => {
                        onStoreChange(store.id);
                        setShowStoreDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'center',
                        padding: '12px',
                        background: store.id === activeStoreId ? 'var(--bg-app)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (store.id !== activeStoreId) {
                          e.currentTarget.style.background = 'var(--bg-app)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (store.id !== activeStoreId) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: store.logo ? 'transparent' : store.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 600,
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {store.logo ? (
                          <img
                            src={store.logo}
                            alt={store.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        ) : (
                          getInitials(store.name)
                        )}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div className="text-small" style={{ fontWeight: store.id === activeStoreId ? 600 : 500 }}>
                          {store.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Sign Out Button */}
                <div style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={async () => {
                      if (confirm(`Sign out from ${activeStore.name}?`)) {
                        await supabase.auth.signOut();
                        setShowStoreDropdown(false);
                        onNavigate('onboarding-1');
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-app)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav style={{ flex: 1, padding: '12px 8px' }}>
            <NavItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={activeItem === 'dashboard'}
              onClick={() => onNavigate('dashboard')}
            />

            <NavItem
              icon={ShoppingCart}
              label="Orders"
              active={activeItem.startsWith('orders-')}
              onClick={() => {}}
              subItems={orderSubItems}
              activeSubItem={activeItem}
              onSubItemClick={handleOrderSubItem}
            />

            <NavItem
              icon={Package}
              label="Products"
              active={activeItem.startsWith('products-')}
              onClick={() => {}}
              subItems={productSubItems}
              activeSubItem={activeItem}
              onSubItemClick={handleProductSubItem}
            />

            <NavItem
              icon={Users}
              label="Customers"
              active={activeItem === 'customers'}
              onClick={() => onNavigate('customers')}
            />

            <NavItem
              icon={Megaphone}
              label="Marketing"
              active={activeItem === 'marketing'}
              onClick={() => onNavigate('marketing')}
            />

            <NavItem
              icon={Store}
              label="Stores"
              active={activeItem.startsWith('stores-')}
              onClick={() => {}}
              subItems={storeSubItems}
              activeSubItem={activeItem}
              onSubItemClick={handleStoreSubItem}
            />

            <div style={{ margin: '16px 0', borderTop: '1px solid var(--border-subtle)' }} />

            <NavItem
              icon={Settings}
              label="Settings"
              active={activeItem === 'settings'}
              onClick={() => onNavigate('settings')}
            />
          </nav>

          {/*
          // Upgrade to Pro Button (hidden for mvp launch)
          <div style={{ padding: '8px' }}>
            <button
              onClick={() => onNavigate('upgrade-pro')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                background: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Crown size={16} />
              Upgrade to Pro
            </button>
          </div>
          */}

        </>
      )}
    </div>
  );
}