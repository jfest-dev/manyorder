import { useState } from 'react';
import { Upload, X, Check, ArrowLeft } from 'lucide-react';
import { FieldInput } from '../Field';
import { Button } from '../Button';
import { Card } from '../Card';
import { formatMoney, currencySymbol } from '../../lib/currency';

interface EditProductProps {
  productId?: string;
  storeName?: string;
  storeColor?: string;
  currency?: string;
  onNavigate?: (screen: string) => void;
}

export function EditProduct({ 
  productId = '1', 
  storeName = 'My Store', 
  storeColor = '#000000', 
  currency = 'sgd',
  onNavigate 
}: EditProductProps) {
  // Pre-fill with existing product data (in real app, fetch from database)
  const [name, setName] = useState('Wireless Headphones');
  const [price, setPrice] = useState('89.99');
  const [description, setDescription] = useState('Premium noise-cancelling headphones');
  const [category, setCategory] = useState('electronics');
  const [quantity, setQuantity] = useState('45');
  const [status, setStatus] = useState('active');
  const [image, setImage] = useState<string | undefined>(undefined);
  
  const [categories, setCategories] = useState([
    { value: 'electronics', label: 'Electronics' },
    { value: 'fashion', label: 'Fashion' },
    { value: 'home', label: 'Home' },
    { value: 'sports', label: 'Sports' },
    { value: 'other', label: 'Other' },
  ]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const newValue = newCategoryName.toLowerCase().replace(/\s+/g, '-');
      setCategories([...categories, { value: newValue, label: newCategoryName.trim() }]);
      setNewCategoryName('');
      setShowAddCategory(false);
    }
  };

  const handleSaveChanges = () => {
    if (name && price) {
      alert('Product updated successfully!');
      onNavigate?.('products');
    } else {
      alert('Please fill in product name and price');
    }
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      alert('Product deleted successfully!');
      onNavigate?.('products');
    }
  };

  const formatPrice = (price: string) => {
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) return '';
    return formatMoney(numPrice, currency);
  };

  const previewProduct = {
    name: name || 'Product Name',
    desc: description || 'No description',
    category: category,
    price: formatPrice(price),
    image: image
  };

  return (
    <div>
      {/* Header with Back Button */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => onNavigate?.('products')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: '12px',
          }}
        >
          <ArrowLeft size={16} />
          Back to Products
        </button>
        <h1 style={{ marginBottom: '8px' }}>Edit Product</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Update product details and inventory
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
        {/* Left: Product Form */}
        <div>
          <Card title="Product Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Image Upload Area */}
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Product Image
                </label>
                <label style={{ cursor: 'pointer' }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImage(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <div
                    style={{
                      height: '200px',
                      borderRadius: 'var(--radius-field)',
                      border: '2px dashed var(--border-strong)',
                      background: image ? 'transparent' : 'var(--bg-card-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    {image ? (
                      <>
                        <img
                          src={image}
                          alt="Product preview"
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            padding: '6px',
                            background: 'rgba(0, 0, 0, 0.6)',
                            borderRadius: '4px',
                            color: 'white',
                            fontSize: '11px',
                          }}
                        >
                          Click to change
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload size={32} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-small" style={{ color: 'var(--text-muted)' }}>
                          Click to upload image
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Recommended: Square image, at least 500x500px
                        </span>
                      </>
                    )}
                  </div>
                </label>
              </div>

              <FieldInput
                label="Product Name"
                placeholder="Wireless Headphones"
                value={name}
                onChange={setName}
              />

              <FieldInput
                label="Description"
                placeholder="Premium noise-cancelling headphones"
                value={description}
                onChange={setDescription}
                helperText="Brief description or variant info"
              />

              {/* Category with Quick Add */}
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Category
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={{
                      flex: 1,
                      height: '40px',
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
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowAddCategory(!showAddCategory)}
                    style={{
                      height: '40px',
                      padding: '0 12px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-field)',
                      background: 'var(--bg-card)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    Add
                  </button>
                </div>

                {/* Quick Add Category Input */}
                {showAddCategory && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="New category name"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddCategory()}
                      style={{
                        flex: 1,
                        height: '32px',
                        padding: '0 10px',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-field)',
                        background: 'var(--bg-card)',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleAddCategory}
                      style={{
                        height: '32px',
                        padding: '0 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-field)',
                        background: 'var(--primary-solid)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Check size={14} />
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <FieldInput
                  label="Price"
                  placeholder="89.99"
                  prefix={currencySymbol(currency)}
                  type="number"
                  value={price}
                  onChange={setPrice}
                />

                <FieldInput
                  label="Stock Quantity"
                  placeholder="45"
                  type="number"
                  value={quantity}
                  onChange={setQuantity}
                  helperText="Available inventory"
                />
              </div>

              {/* Product Status */}
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Product Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
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
                  <option value="active">Active - Visible to customers</option>
                  <option value="draft">Draft - Hidden from customers</option>
                  <option value="outofstock">Out of Stock</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                marginTop: '24px',
                paddingTop: '24px',
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <Button 
                  variant="primary"
                  onClick={handleSaveChanges}
                  fullWidth
                >
                  Save Changes
                </Button>
                
                <Button 
                  variant="ghost"
                  onClick={() => onNavigate?.('products')}
                >
                  Cancel
                </Button>
              </div>

              {/* Delete Button */}
              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={handleDelete}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: 'transparent',
                    border: '1px solid #DC2626',
                    borderRadius: 'var(--radius-field)',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#DC2626';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#DC2626';
                  }}
                >
                  Delete Product
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Live Preview */}
        <div style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
          <div style={{ marginBottom: '12px', textAlign: 'center' }}>
            <h3 className="text-small" style={{ color: 'var(--text-secondary)' }}>
              Live preview
            </h3>
          </div>

          {/* Phone Mockup */}
          <div 
            style={{
              width: '280px',
              margin: '0 auto',
              background: 'white',
              borderRadius: '28px',
              overflow: 'hidden',
              border: '1px solid var(--border-strong)',
            }}
          >
            <div 
              style={{
                height: '560px',
                display: 'flex',
                flexDirection: 'column',
                background: '#F3F4F6',
              }}
            >
              {/* Store Header with Brand Color */}
              <div 
                style={{
                  background: storeColor,
                  color: 'white',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                {/* Logo */}
                <div 
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 10px',
                    fontSize: '16px',
                    fontWeight: 600,
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {storeName.substring(0, 2).toUpperCase() || 'MS'}
                </div>
                
                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>
                  {storeName}
                </h2>
                <p style={{ fontSize: '11px', opacity: 0.9 }}>
                  manyorder.app/{storeName.toLowerCase().replace(/\s+/g, '-')}
                </p>
              </div>

              {/* Product Preview */}
              <div style={{ flex: 1, background: 'white', padding: '12px', overflowY: 'auto' }}>
                <div 
                  style={{
                    padding: '10px',
                    background: '#F9FAFB',
                    borderRadius: '6px',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                  }}
                >
                  {previewProduct.image && (
                    <img
                      src={previewProduct.image}
                      alt={previewProduct.name}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '4px',
                        objectFit: 'cover',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '2px' }}>
                      {previewProduct.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6B7280', marginBottom: '4px' }}>
                      {previewProduct.desc}
                    </div>
                    {previewProduct.category && (
                      <div style={{ 
                        display: 'inline-block',
                        padding: '2px 6px',
                        background: '#E5E7EB',
                        borderRadius: '3px',
                        fontSize: '9px',
                        color: '#4B5563',
                        fontWeight: 500,
                        textTransform: 'capitalize'
                      }}>
                        {previewProduct.category}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', flexShrink: 0 }}>
                    {previewProduct.price}
                  </div>
                </div>

                {status !== 'active' && (
                  <div style={{ 
                    marginTop: '12px',
                    padding: '12px',
                    background: status === 'draft' ? '#FEF3C7' : '#FEE2E2',
                    borderRadius: '6px',
                    fontSize: '11px',
                    color: status === 'draft' ? '#92400E' : '#991B1B',
                    textAlign: 'center'
                  }}>
                    {status === 'draft' ? '⚠️ Draft - Not visible to customers' : '❌ Out of Stock'}
                  </div>
                )}
              </div>

              {/* Footer */}
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Styles */}
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