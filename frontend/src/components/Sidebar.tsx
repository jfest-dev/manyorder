import { Store, Package, LayoutDashboard, Settings, ShoppingCart, Users, ChevronDown, LogOut, Megaphone, Crown, Check, Truck } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
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
  const [triggerHover, setTriggerHover] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const dropdownOpenRef = useRef(showStoreDropdown);
  dropdownOpenRef.current = showStoreDropdown;
  const activeStore = stores.find(s => s.id === activeStoreId) || stores[0];

  // Which submenu sections are expanded. A set so multiple can stay open at
  // once - each toggles only via its own header (no click-outside close).
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Close the store switcher when clicking anywhere outside it. Always-on
  // listener (guarded by the ref) so it can't miss an already-open dropdown.
  useEffect(() => {
    const onDocPointerDown = (e: MouseEvent) => {
      if (dropdownOpenRef.current && switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowStoreDropdown(false);
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    return () => document.removeEventListener('mousedown', onDocPointerDown);
  }, []);

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
          <div ref={switcherRef} style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
            <button
              onClick={() => setShowStoreDropdown(!showStoreDropdown)}
              onMouseEnter={() => setTriggerHover(true)}
              onMouseLeave={() => setTriggerHover(false)}
              style={{
                width: '100%',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                background: triggerHover || showStoreDropdown ? 'var(--bg-card-subtle)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-field)',
                cursor: 'pointer',
                padding: '8px',
                transition: 'background 0.15s ease',
              }}
            >
              {/* Store Logo */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-field)',
                  background: activeStore.logo ? 'transparent' : activeStore.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '1px solid var(--border-subtle)',
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
                  top: '64px',
                  left: '12px',
                  right: '12px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
                  zIndex: 100,
                  overflow: 'hidden',
                  padding: '6px',
                }}
              >
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {stores.map((store) => {
                    const isActive = store.id === activeStoreId;
                    return (
                    <button
                      key={store.id}
                      onClick={() => {
                        onStoreChange(store.id);
                        setShowStoreDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        gap: '10px',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-field)',
                        background: isActive ? 'var(--bg-card-subtle)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'var(--bg-card-subtle)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: store.logo ? 'transparent' : store.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '11px',
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
                      <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                        <div
                          className="text-small"
                          style={{
                            fontWeight: isActive ? 600 : 500,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {store.name}
                        </div>
                      </div>
                      {isActive && (
                        <Check size={16} color="var(--primary-solid)" style={{ flexShrink: 0 }} />
                      )}
                    </button>
                    );
                  })}
                </div>
                
                {/* Sign Out Button */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '6px', paddingTop: '6px' }}>
                  <button
                    onClick={async () => {
                      if (confirm('Sign out of your account?')) {
                        await supabase.auth.signOut();
                        setShowStoreDropdown(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-field)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-card-subtle)';
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
          <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
              isExpanded={openSections.has('orders')}
              onToggleExpand={() => toggleSection('orders')}
            />

            <NavItem
              icon={Package}
              label="Products"
              active={activeItem.startsWith('products-')}
              onClick={() => {}}
              subItems={productSubItems}
              activeSubItem={activeItem}
              onSubItemClick={handleProductSubItem}
              isExpanded={openSections.has('products')}
              onToggleExpand={() => toggleSection('products')}
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
              icon={Truck}
              label="Delivery"
              active={activeItem === 'delivery'}
              onClick={() => onNavigate('delivery')}
            />

            <NavItem
              icon={Store}
              label="Stores"
              active={activeItem.startsWith('stores-')}
              onClick={() => {}}
              subItems={storeSubItems}
              activeSubItem={activeItem}
              onSubItemClick={handleStoreSubItem}
              isExpanded={openSections.has('stores')}
              onToggleExpand={() => toggleSection('stores')}
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