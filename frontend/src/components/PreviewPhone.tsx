import { Card } from './Card';

interface ProductPreview {
  name: string;
  price: string;
  image?: string;
}

interface PreviewPhoneProps {
  storeName?: string;
  storeColor?: string;
  products?: ProductPreview[];
}

export function PreviewPhone({ 
  storeName = 'My Store', 
  storeColor = '#000000',
  products = []
}: PreviewPhoneProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Convert hex to rgba for opacity
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div
      style={{
        width: '320px',
        height: '640px',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--border-strong)',
        background: 'var(--bg-card)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          height: '40px',
          background: storeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-on-dark)',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        {storeName}
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-app)' }}>
        {/* Header Banner */}
        <div
          style={{
            height: '96px',
            background: hexToRgba(storeColor, 0.12),
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: '28px',
            position: 'relative',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: 'var(--radius-pill)',
              background: storeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-on-dark)',
              fontSize: '16px',
              fontWeight: 600,
              position: 'absolute',
              bottom: '-28px',
              border: '3px solid var(--bg-card)',
            }}
          >
            {getInitials(storeName)}
          </div>
        </div>

        {/* Store Info Section */}
        <div style={{ padding: '36px 16px 16px', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '4px' }}>{storeName}</h2>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Welcome to our store
          </p>
        </div>

        {/* Product List */}
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {products.length === 0 ? (
            <div style={{ 
              padding: '32px 16px', 
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}>
              No products yet
            </div>
          ) : (
            products.map((product, index) => (
              <div
                key={index}
                style={{
                  borderRadius: '12px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-card)',
                  padding: '12px',
                  display: 'flex',
                  gap: '12px',
                }}
              >
                {product.image && (
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '8px',
                      background: 'var(--bg-card-subtle)',
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-small" style={{ fontWeight: 500, marginBottom: '2px' }}>
                    {product.name}
                  </div>
                  <div className="text-small" style={{ color: storeColor, fontWeight: 600 }}>
                    {product.price}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom Bar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          style={{
            width: '100%',
            height: '40px',
            borderRadius: 'var(--radius-pill)',
            background: storeColor,
            color: 'var(--text-on-dark)',
            border: 'none',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Order now
        </button>
      </div>
    </div>
  );
}
