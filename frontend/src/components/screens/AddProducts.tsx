import { useEffect, useMemo, useState } from 'react';
import { Plus, Upload, X, Check, Store } from 'lucide-react';
import { FieldInput } from '../Field';
import { Button } from '../Button';
import { Card } from '../Card';
import { formatMoney, currencySymbol, priceLimits } from '../../lib/currency';
import { storeInitials } from '../../lib/initials';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

interface Product {
  id: string;
  name: string;
  price: string;
  description: string;
  category: string;
  quantity: string;
  image?: string;
}

type FieldErrors = { name?: string; price?: string; quantity?: string };

interface AddProductsProps {
  storeName?: string;
  storeLink?: string;
  storeColor?: string;
  currency?: string;
  showHeader?: boolean; // ✅ new
  onComplete?: (products: any[]) => void;
}


export function AddProducts({
  storeName = 'My Store',
  storeLink = '',
  storeColor = '#000000',
  currency = 'sgd',
  showHeader = true,
  onComplete,
}: AddProductsProps) {
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: '', price: '', description: '', category: '', quantity: '', image: undefined },
  ]);

  // Saved products (preview) - must be unique by id
  const [savedProducts, setSavedProducts] = useState<Product[]>([]);

  // Lock a form once "Add Product" is clicked
  const [savedFormIds, setSavedFormIds] = useState<Record<string, boolean>>({});

  // Inline validation errors, keyed by product id.
  const [errors, setErrors] = useState<Record<string, FieldErrors>>({});

  const [categories, setCategories] = useState([
    { value: 'coffee', label: 'Coffee' },
    { value: 'tea', label: 'Tea' },
    { value: 'pastries', label: 'Pastries' },
    { value: 'merchandise', label: 'Merchandise' },
    { value: 'other', label: 'Other' },
  ]);

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  const limits = priceLimits(currency);

  const addProduct = () => {
    const newId = Date.now().toString();
    setProducts((prev) => [
      ...prev,
      { id: newId, name: '', price: '', description: '', category: '', quantity: '', image: undefined },
    ]);
  };

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      // optional: if user removes a form, also remove from preview
      setSavedProducts((prev) => prev.filter((p) => p.id !== id));
      setSavedFormIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  // Single source of truth for product validity — used both when adding and
  // when editing an already-saved form. Returns a per-field error map; an empty
  // object means the product is valid.
  const validateProduct = (product: Product): FieldErrors => {
    const errs: FieldErrors = {};

    if (!product.name.trim()) errs.name = 'Product name is required.';

    const priceStr = product.price.trim();
    const price = parseFloat(priceStr);
    if (priceStr === '' || Number.isNaN(price)) {
      errs.price = 'Price is required.';
    } else if (price < limits.min) {
      errs.price = 'Price must be greater than 0.';
    } else if (price > limits.max) {
      errs.price = `Price can't exceed ${formatMoney(limits.max, currency)}.`;
    }

    if (product.quantity.trim() !== '') {
      const qty = Number(product.quantity);
      if (!Number.isInteger(qty) || qty < 0) {
        errs.quantity = 'Stock must be a whole number of 0 or more.';
      }
    }

    return errs;
  };

  const hasErrors = (errs?: FieldErrors) => !!errs && Object.keys(errs).length > 0;

  const updateProduct = (id: string, field: keyof Product, value: string) => {
    const nextProducts = products.map((p) => (p.id === id ? { ...p, [field]: value } : p));
    setProducts(nextProducts);

    const updated = nextProducts.find((p) => p.id === id);
    if (!updated) return;

    const isSaved = !!savedFormIds[id];
    const wasShowingErrors = hasErrors(errors[id]);
    const errs = validateProduct(updated);

    // Surface errors live only once the product is saved or has already failed a
    // save attempt — a fresh, untouched form shouldn't flash errors while typing.
    if (isSaved || wasShowingErrors) {
      setErrors((prev) => ({ ...prev, [id]: errs }));
    }

    // A saved product always stays visible in the preview. Only push valid edits
    // through; invalid edits leave the last valid version showing.
    if (isSaved && !hasErrors(errs)) {
      setSavedProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...updated, name: updated.name.trim() } : p))
      );
    }
  };

  const saveProduct = (product: Product) => {
    // ✅ if already saved -> do nothing (prevents double click duplicates)
    if (savedFormIds[product.id]) return;

    const errs = validateProduct(product);
    setErrors((prev) => ({ ...prev, [product.id]: errs }));
    if (hasErrors(errs)) return;

    const clean = { ...product, name: product.name.trim() };

    // add or update by id (safe)
    setSavedProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) return prev.map((p) => (p.id === product.id ? { ...clean } : p));
      return [...prev, { ...clean }];
    });

    // lock this form so button becomes "Added" and disabled
    setSavedFormIds((prev) => ({ ...prev, [product.id]: true }));
  };

  const handleImageSelect = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      alert('Please upload a JPG, PNG, or WebP image.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      alert('Image must be under 5 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => updateProduct(id, 'image', reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      const newValue = newCategoryName.toLowerCase().replace(/\s+/g, '-');
      setCategories((prev) => [...prev, { value: newValue, label: newCategoryName.trim() }]);
      setNewCategoryName('');
      setShowAddCategory(false);
    }
  };

  const formatPrice = (price: string) => {
    const numPrice = parseFloat(price);
    if (Number.isNaN(numPrice)) return '';
    return formatMoney(numPrice, currency);
  };

  const previewProducts = useMemo(
    () =>
      savedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        desc: p.description || 'No description',
        category: p.category,
        price: formatPrice(p.price),
        image: p.image,
      })),
    [savedProducts, currency]
  );

  const groupedProducts = useMemo(() => {
    return previewProducts.reduce((acc, product) => {
      const category = product.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(product);
      return acc;
    }, {} as Record<string, typeof previewProducts>);
  }, [previewProducts]);

  return (
    <div>
      {/* Header (optional) */}
      {showHeader && (
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ marginBottom: '8px' }}>Add products to your store</h1>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Build your product catalog and start selling
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
        {/* Left: Product Forms */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {products.map((product, index) => (
              <Card key={product.id} title={`Product ${index + 1}`}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Image Upload Area */}
                  <div>
                    <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                      Product Image (Optional)
                    </label>

                    <div style={{ position: 'relative' }}>
                      <label style={{ cursor: 'pointer' }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => handleImageSelect(product.id, e)}
                          style={{ display: 'none' }}
                        />

                        <div
                          style={{
                            height: '120px',
                            borderRadius: 'var(--radius-field)',
                            border: '2px dashed var(--border-strong)',
                            background: product.image ? 'transparent' : 'var(--bg-card-subtle)',
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
                          {product.image ? (
                            <img
                              src={product.image}
                              alt="Product preview"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <>
                              <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                              <span className="text-small" style={{ color: 'var(--text-muted)' }}>
                                Click to upload image
                              </span>
                            </>
                          )}
                        </div>
                      </label>

                      {product.image && (
                        <button
                          type="button"
                          aria-label="Remove image"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateProduct(product.id, 'image', '');
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: 'none',
                            background: 'rgba(0, 0, 0, 0.55)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <FieldInput
                    label="Product Name"
                    placeholder="Iced White"
                    value={product.name}
                    onChange={(value) => updateProduct(product.id, 'name', value)}
                    maxLength={60}
                    error={errors[product.id]?.name}
                  />

                  <FieldInput
                    label="Description"
                    placeholder="250ml - Signature"
                    value={product.description}
                    onChange={(value) => updateProduct(product.id, 'description', value)}
                    helperText="Brief description or variant info"
                    maxLength={100}
                    multiline
                  />

                  {/* Category with Quick Add */}
                  <div>
                    <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                      Category
                    </label>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={product.category}
                        onChange={(e) => updateProduct(product.id, 'category', e.target.value)}
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
                        title="Add new category"
                      >
                        <Plus size={16} />
                        Add
                      </button>
                    </div>

                    {showAddCategory && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="New category name"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
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

                    <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                      Help customers find your products
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <FieldInput
                      label="Price"
                      placeholder="5.50"
                      prefix={currencySymbol(currency)}
                      type="number"
                      min={limits.min}
                      max={limits.max}
                      step={limits.step}
                      value={product.price}
                      onChange={(value) => updateProduct(product.id, 'price', value)}
                      error={errors[product.id]?.price}
                    />

                    <FieldInput
                      label="Stock Quantity"
                      placeholder="100"
                      type="number"
                      min={0}
                      step={1}
                      value={product.quantity}
                      onChange={(value) => updateProduct(product.id, 'quantity', value)}
                      helperText="Available inventory"
                      error={errors[product.id]?.quantity}
                    />
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <Button
                      variant="primary"
                      onClick={() => saveProduct(product)}
                      fullWidth
                      disabled={!!savedFormIds[product.id]}
                    >
                      {savedFormIds[product.id]
                        ? hasErrors(errors[product.id])
                          ? 'Fix errors to update'
                          : 'Added'
                        : 'Add Product'}
                    </Button>

                    {products.length > 1 && (
                      <Button variant="ghost" onClick={() => removeProduct(product.id)}>
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            <Button variant="secondary" onClick={addProduct} fullWidth>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Plus size={16} />
                Add Another Product
              </div>
            </Button>

            {onComplete && (
              <Button fullWidth onClick={() => onComplete(savedProducts)}>
                Finish setup → Go to dashboard ({savedProducts.length} products)
              </Button>
            )}
          </div>
        </div>

        {/* Right: Live Preview */}
        <div style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
          <div style={{ marginBottom: '12px', textAlign: 'center' }}>
            <h3 className="text-small" style={{ color: 'var(--text-secondary)' }}>
              Live preview {savedProducts.length > 0 && `(${savedProducts.length} products)`}
            </h3>
          </div>

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
            <div style={{ height: '560px', display: 'flex', flexDirection: 'column', background: '#F3F4F6' }}>
              <div style={{ background: storeColor, color: 'white', padding: '16px', textAlign: 'center' }}>
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
                  {storeInitials(storeName) || <Store size={20} color="white" />}
                </div>

                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>{storeName || 'Your Store Name'}</h2>
                <p style={{ fontSize: '11px', opacity: 0.9 }}>
                  manyorder.app/{storeLink || 'your-store-name'}
                </p>
              </div>

              <div style={{ flex: 1, background: 'white', padding: '12px', overflowY: 'auto' }}>
                {previewProducts.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '11px' }}>
                    Click "Add Product" to see products here.
                  </div>
                ) : (
                  <>
                    {Object.keys(groupedProducts).length > 1 && (
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
                        <button
                          onClick={() => setSelectedCategoryFilter('all')}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '12px',
                            border: 'none',
                            background: selectedCategoryFilter === 'all' ? '#111827' : '#F3F4F6',
                            color: selectedCategoryFilter === 'all' ? 'white' : '#6B7280',
                            fontSize: '11px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          All
                        </button>

                        {Object.keys(groupedProducts).map((category) => {
                          const categoryLabel = categories.find((c) => c.value === category)?.label || category;
                          return (
                            <button
                              key={category}
                              onClick={() => setSelectedCategoryFilter(category)}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '12px',
                                border: 'none',
                                background: selectedCategoryFilter === category ? '#111827' : '#F3F4F6',
                                color: selectedCategoryFilter === category ? 'white' : '#6B7280',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {categoryLabel}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {Object.entries(groupedProducts)
                      .filter(([category]) => selectedCategoryFilter === 'all' || selectedCategoryFilter === category)
                      .map(([category, items]: [string, any[]]) => {
                        const categoryLabel = categories.find((c) => c.value === category)?.label || category;
                        return (
                          <div key={category} style={{ marginBottom: '12px' }}>
                            <div
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: '#6B7280',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                marginBottom: '8px',
                                paddingLeft: '4px',
                              }}
                            >
                              {categoryLabel}
                            </div>

                            {items.map((product) => (
                              <div
                                key={product.id}
                                style={{
                                  padding: '10px',
                                  background: '#F9FAFB',
                                  borderRadius: '6px',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  gap: '10px',
                                  alignItems: 'center',
                                }}
                              >
                                {product.image && (
                                  <img
                                    src={product.image}
                                    alt={product.name}
                                    style={{
                                      width: '48px',
                                      height: '48px',
                                      borderRadius: '4px',
                                      objectFit: 'cover',
                                      flexShrink: 0,
                                    }}
                                  />
                                )}

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 500,
                                      color: '#111827',
                                      marginBottom: '2px',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {product.name}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: '10px',
                                      color: '#6B7280',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {product.desc}
                                  </div>
                                </div>

                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', flexShrink: 0 }}>
                                  {product.price}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                  </>
                )}
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
        @media (max-width: 640px) {
          div[style*="width: 320px"] {
            width: 100% !important;
            max-width: 320px;
          }
        }
      `}</style>
    </div>
  );
}
