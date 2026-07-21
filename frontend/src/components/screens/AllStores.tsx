import { Button } from '../Button';
import { Plus, ExternalLink, Check, LogIn } from 'lucide-react';

interface Store {
  id: string;
  name: string;
  color: string;
  logo?: string;
}

interface AllStoresProps {
  stores: Store[];
  activeStoreId: string;
  onStoreChange: (storeId: string) => void;
  onNavigate: (screen: string) => void;
  storeLimit?: number;
}

export function AllStores({ stores, activeStoreId, onStoreChange, onNavigate, storeLimit = 3 }: AllStoresProps) {
  const atLimit = stores.length >= storeLimit;
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ marginBottom: '8px' }}>All Stores</h1>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Manage and switch between your stores
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
            {stores.length} / {storeLimit} stores used
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={() => onNavigate('stores-signin')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LogIn size={16} />
              Sign In to Store
            </div>
          </Button>
          <Button variant="primary" disabled={atLimit} onClick={() => onNavigate('stores-create')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} />
              {atLimit ? 'Store limit reached' : 'Create Store'}
            </div>
          </Button>
        </div>
      </div>

      {/* Store List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {stores.map((store) => (
          <div
            key={store.id}
            style={{
              background: 'var(--bg-card)',
              border: store.id === activeStoreId ? '2px solid #000000' : '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-medium)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              transition: 'all 0.15s ease',
              cursor: store.id !== activeStoreId ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (store.id !== activeStoreId) {
                onStoreChange(store.id);
              }
            }}
            onMouseEnter={(e) => {
              if (store.id !== activeStoreId) {
                e.currentTarget.style.borderColor = 'var(--border-strong)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (store.id !== activeStoreId) {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {/* Store Logo/Avatar */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '8px',
                background: store.logo ? 'transparent' : store.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
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

            {/* Store Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ fontWeight: 600, fontSize: '15px' }}>{store.name}</h3>
                {store.id === activeStoreId && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      background: '#ECFDF5',
                      color: '#059669',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    <Check size={12} />
                    Active
                  </span>
                )}
              </div>
              <p className="text-small" style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                manyorder.app/{store.name.toLowerCase().replace(/\s+/g, '-')}
              </p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`https://manyorder.app/${store.name.toLowerCase().replace(/\s+/g, '-')}`, '_blank');
                }}
                style={{
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-app)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <ExternalLink size={16} />
                <span className="button-text">Visit Store</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Responsive Styles */}
      <style>{`
        @media (max-width: 768px) {
          .button-text {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}