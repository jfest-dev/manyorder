import { useState } from 'react';
import { FieldInput, FieldSelect } from '../Field';
import { Button } from '../Button';
import { Card } from '../Card';
import { Upload, LogIn } from 'lucide-react';
import { formatMoney } from '../../lib/currency';

interface CreateStoreProps {
  // Keep your UI fields, but App.tsx can still ignore the extra fields safely
  onComplete: (data: {
    name: string;
    category: string;
    color: string;
    logo?: string;

    // extra fields (optional)
    currency?: string;
    phone?: string;
    storeLink?: string;
  }) => void;

  // ✅ so CreateStore "Sign In to Store" can go to the same screen as AllStores
  onNavigate?: (screen: string) => void;
}

const slugify = (input: string) => {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const themeColors = [
  { name: 'Black', color: '#000000' },
  { name: 'Blue', color: '#3B82F6' },
  { name: 'Purple', color: '#8B5CF6' },
  { name: 'Pink', color: '#EC4899' },
  { name: 'Green', color: '#10B981' },
  { name: 'Orange', color: '#F97316' },
];

const categories = [
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'beauty', label: 'Beauty & Cosmetics' },
  { value: 'home', label: 'Home & Living' },
  { value: 'other', label: 'Other' },
];

const currencies = [
  { value: 'sgd', label: 'Singapore Dollar (SGD)' },
  { value: 'idr', label: 'Indonesian Rupiah (IDR)' },
];

const countryCodes = [
  { value: '+65', label: '+65 (Singapore)' },
  { value: '+62', label: '+62 (Indonesia)' },
];

export function CreateStore({ onComplete, onNavigate }: CreateStoreProps) {
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('food');
  const [currency, setCurrency] = useState('sgd');
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [logo, setLogo] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState('+65');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [storeLink, setStoreLink] = useState('');
  const [storeLinkTouched, setStoreLinkTouched] = useState(false);

  const handleCreateStore = () => {
    onComplete({
      name: storeName,
      category,
      color: selectedColor,
      logo: logo || undefined,

      // extra fields (won’t break App.tsx)
      currency,
      phone: `${countryCode}${phoneNumber}`,
      storeLink,
    });
  };

  const mockProducts = [
    { name: 'Iced White', desc: '250ml - Signature', basePrice: 5.5 },
    { name: 'Cold Brew', desc: '350ml - House blend', basePrice: 6.0 },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div></div>

          <Button
            variant="ghost"
            onClick={() => {
              // ✅ NEW: use the same navigation as AllStores button
              if (onNavigate) {
                onNavigate('stores-signin');
                return;
              }

              // fallback (if you didn’t pass onNavigate)
              const link = prompt('Enter your store link (e.g., kirikiri-brew):');
              if (link) alert(`Redirecting to sign in for ${link}...`);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <LogIn size={14} />
              Sign In to Store
            </div>
          </Button>
        </div>

        <h1 style={{ marginBottom: '8px' }}>Create your store</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Set up your storefront and start selling online
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
        {/* Left Column - Form */}
        <div>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Store Logo */}
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Store logo
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {/* Logo Preview */}
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: selectedColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '20px',
                      fontWeight: 600,
                      border: '2px solid var(--border-subtle)',
                      overflow: 'hidden',
                    }}
                  >
                    {logo ? (
                      <img src={logo} alt="Store Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      storeName.substring(0, 2).toUpperCase() || 'KB'
                    )}
                  </div>

                  {/* Upload Button */}
                  <label style={{ cursor: 'pointer' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setLogo(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-field)',
                        background: 'var(--bg-card)',
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      <Upload size={16} />
                      Upload logo
                    </div>
                  </label>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                  Optional, square images work best.
                </p>
              </div>

              <FieldInput
                label="Business Name"
                placeholder="e.g., Noodle House Delights"
                value={storeName}
                onChange={(value) => setStoreName(value)}
              />

              <FieldSelect
                label="Business type"
                placeholder="Select business type"
                options={categories}
                value={category}
                onChange={setCategory}
                helperText="Help us understand your business better"
              />

              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Phone *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    style={{
                      height: '40px',
                      padding: '0 32px 0 12px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-field)',
                      background: 'var(--bg-card)',
                      fontSize: '13px',
                      outline: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-primary)',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                    }}
                  >
                    {countryCodes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="tel"
                    placeholder="8123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    style={{
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
                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  This will be your WhatsApp / contact number.
                </p>
              </div>

              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Store link *
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}
                  >
                    manyorder.app/
                  </span>
                  <input
                    type="text"
                    placeholder="kirikiri-brew"
                    value={storeLink}
                    onChange={(e) => setStoreLink(e.target.value)}
                    style={{
                      width: '100%',
                      height: '40px',
                      paddingLeft: '140px',
                      paddingRight: '12px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-field)',
                      background: 'var(--bg-card)',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  This is the link you share with customers.
                </p>
              </div>

              <FieldSelect
                label="Currency"
                placeholder="Select currency"
                options={currencies}
                value={currency}
                onChange={setCurrency}
                helperText="Auto-selects from country, but you can change it anytime"
              />

              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Theme color
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {themeColors.map((theme) => (
                    <button
                      key={theme.color}
                      onClick={() => setSelectedColor(theme.color)}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: theme.color,
                        border: selectedColor === theme.color ? '3px solid var(--primary-solid)' : '2px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedColor === theme.color ? '0 0 0 4px rgba(15, 23, 42, 0.08)' : 'none',
                      }}
                      title={theme.name}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <Button fullWidth onClick={handleCreateStore}>
                  Create store
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Live Preview */}
        <div style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
          <div style={{ marginBottom: '12px', textAlign: 'center' }}>
            <h3 className="text-small" style={{ color: 'var(--text-secondary)' }}>Live preview</h3>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '280px', background: '#FFFFFF', borderRadius: '24px', overflow: 'hidden', border: '1px solid #D1D5DB' }}>
              <div style={{ height: '560px', display: 'flex', flexDirection: 'column', background: '#F3F4F6' }}>
                <div style={{ background: selectedColor, color: 'white', padding: '16px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: logo ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 10px',
                      fontSize: '16px',
                      fontWeight: 600,
                      overflow: 'hidden',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    {logo ? (
                      <img src={logo} alt="Store Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      storeName.substring(0, 2).toUpperCase() || 'KB'
                    )}
                  </div>

                  <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>{storeName || 'Your Store Name'}</h2>
                  <p style={{ fontSize: '11px', opacity: 0.9 }}>manyorder.app/{storeLink || 'your-store-link'}</p>
                </div>

                <div style={{ flex: 1, background: 'white', padding: '12px', overflowY: 'auto' }}>
                  {mockProducts.map((product, index) => (
                    <div
                      key={index}
                      style={{
                        padding: '10px',
                        background: '#F9FAFB',
                        borderRadius: '6px',
                        marginBottom: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '2px' }}>{product.name}</div>
                        <div style={{ fontSize: '10px', color: '#6B7280' }}>{product.desc}</div>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>{formatMoney(product.basePrice, currency)}</div>
                    </div>
                  ))}

                  <div style={{ marginTop: '12px', padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '11px' }}>
                    Your products will appear here.
                  </div>
                </div>

                <div style={{ background: 'white', padding: '12px', borderTop: '1px solid #E5E7EB' }}>
                  <button
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#000000',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'default',
                    }}
                  >
                    Order now
                  </button>
                  <div style={{ fontSize: '9px', textAlign: 'center', color: '#9CA3AF', marginTop: '6px' }}>
                    This is how your store link will look to customers.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          div[style*="grid-template-columns: 1fr 400px"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
