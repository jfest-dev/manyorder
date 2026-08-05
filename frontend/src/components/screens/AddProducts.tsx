import { useEffect, useMemo, useState } from 'react';
import { Plus, Upload, X, Check, Package } from 'lucide-react';
import { FieldInput, FieldSelect } from '../Field';
import { Button } from '../Button';
import { Card } from '../Card';
import { formatMoney, currencySymbol, priceLimits } from '../../lib/currency';
import { validateImageFile, IMAGE_RULE_TEXT, ALLOWED_IMAGE_ACCEPT } from '../../lib/image';
import { productsApi, categoriesApi, CreateProductPayload, CategoryResponse, ApiError } from '../../lib/api';

interface Product {
  id: string; // local form id
  name: string;
  price: string;
  description: string;
  categoryId: string; // selected category id as string; '' = no category
  quantity: string;
  sku: string;
  preOrder: boolean;
  readyDate: string;
  note: string;
  photoFile?: File;
  photoPreview?: string;
}

type FieldErrors = { name?: string; price?: string; quantity?: string };

interface AddProductsProps {
  /** Present in the dashboard: products are created on the backend. Absent in
   *  onboarding step 2, where products are drafted locally via onComplete. */
  storeId?: number;
  storeName?: string;
  storeLink?: string;
  storeColor?: string;
  currency?: string;
  showHeader?: boolean;
  onNavigate?: (screen: string) => void;
  onComplete?: (products: any[]) => void;
}

const blank = (id: string): Product => ({
  id, name: '', price: '', description: '', categoryId: '', quantity: '',
  sku: '', preOrder: false, readyDate: '', note: '', photoFile: undefined, photoPreview: undefined,
});

export function AddProducts({
  storeId,
  storeName = 'My Store',
  storeColor = '#000000',
  currency = 'sgd',
  showHeader = true,
  onNavigate,
  onComplete,
}: AddProductsProps) {
  const [products, setProducts] = useState<Product[]>([blank('1')]);
  const [saved, setSaved] = useState<Record<string, boolean>>({}); // form id -> created/added
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, FieldErrors>>({});
  const [formError, setFormError] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  // Categories are per-store; only available in the dashboard (storeId present).
  useEffect(() => {
    if (storeId == null) return;
    categoriesApi.list(storeId).then(setCategories).catch(() => setCategories([]));
  }, [storeId]);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories],
  );

  const limits = priceLimits(currency);

  const addProduct = () => setProducts((prev) => [...prev, blank(Date.now().toString())]);

  const removeProduct = (id: string) => {
    if (products.length <= 1) return;
    setProducts((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p?.photoPreview) URL.revokeObjectURL(p.photoPreview);
      return prev.filter((x) => x.id !== id);
    });
    setSaved((s) => { const n = { ...s }; delete n[id]; return n; });
    setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
    setFormError((e) => { const n = { ...e }; delete n[id]; return n; });
  };

  const validateProduct = (p: Product): FieldErrors => {
    const errs: FieldErrors = {};
    if (!p.name.trim()) errs.name = 'Product name is required.';
    const price = parseFloat(p.price.trim());
    if (p.price.trim() === '' || Number.isNaN(price)) errs.price = 'Price is required.';
    else if (price < limits.min) errs.price = 'Price must be greater than 0.';
    else if (price > limits.max) errs.price = `Price can't exceed ${formatMoney(limits.max, currency)}.`;
    if (p.quantity.trim() !== '') {
      const qty = Number(p.quantity);
      if (!Number.isInteger(qty) || qty < 0) errs.quantity = 'Stock must be a whole number of 0 or more.';
    }
    return errs;
  };

  const hasErrors = (e?: FieldErrors) => !!e && Object.keys(e).length > 0;

  const patch = (id: string, changes: Partial<Product>) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  const update = (id: string, field: keyof Product, value: string | boolean) => {
    patch(id, { [field]: value } as Partial<Product>);
  };

  const selectPhoto = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) { setFormError((s) => ({ ...s, [id]: invalid })); return; }
    setFormError((s) => { const n = { ...s }; delete n[id]; return n; });
    setProducts((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      if (p.photoPreview) URL.revokeObjectURL(p.photoPreview);
      return { ...p, photoFile: file, photoPreview: URL.createObjectURL(file) };
    }));
  };

  const removePhoto = (id: string) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      if (p.photoPreview) URL.revokeObjectURL(p.photoPreview);
      return { ...p, photoFile: undefined, photoPreview: undefined };
    }));
  };

  const saveProduct = async (product: Product) => {
    if (saved[product.id] || savingId) return;
    const errs = validateProduct(product);
    setErrors((prev) => ({ ...prev, [product.id]: errs }));
    if (hasErrors(errs)) return;

    // Onboarding (no storeId): keep the local draft behavior.
    if (storeId == null) {
      setSaved((s) => ({ ...s, [product.id]: true }));
      return;
    }

    setSavingId(product.id);
    setFormError((s) => { const n = { ...s }; delete n[product.id]; return n; });
    try {
      const payload: CreateProductPayload = {
        name: product.name.trim(),
        description: product.description.trim() || undefined,
        price: parseFloat(product.price),
        categoryId: product.categoryId ? Number(product.categoryId) : undefined,
        stock: product.quantity.trim() === '' ? 0 : parseInt(product.quantity, 10),
        sku: product.sku.trim() || undefined,
        preOrder: product.preOrder,
        preOrderReadyDate: product.preOrder && product.readyDate ? product.readyDate : undefined,
        preOrderNote: product.preOrder && product.note.trim() ? product.note.trim() : undefined,
      };
      const created = await productsApi.create(storeId, payload);

      // Deferred photo: upload to the new product's folder, then attach it.
      if (product.photoFile) {
        const { url } = await productsApi.uploadPhoto(storeId, created.id, product.photoFile);
        await productsApi.update(storeId, created.id, { photoUrl: url });
      }
      setSaved((s) => ({ ...s, [product.id]: true }));
    } catch (e: any) {
      setFormError((s) => ({ ...s, [product.id]: e instanceof ApiError ? e.message : 'Could not save product' }));
    } finally {
      setSavingId(null);
    }
  };

  const savedList = useMemo(() => products.filter((p) => saved[p.id]), [products, saved]);

  return (
    <div>
      {showHeader && (
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ marginBottom: '8px' }}>Add products to your store</h1>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Build your product catalog and start selling</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
        {/* Left: forms */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {products.map((product, index) => {
              const isSaved = !!saved[product.id];
              const isSaving = savingId === product.id;
              return (
                <Card key={product.id} title={`Product ${index + 1}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: isSaved ? 0.65 : 1 }}>
                    {/* Photo */}
                    <div>
                      <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>Product Photo (optional)</label>
                      <div style={{ position: 'relative' }}>
                        <label style={{ cursor: isSaved ? 'default' : 'pointer' }}>
                          <input type="file" accept={ALLOWED_IMAGE_ACCEPT} disabled={isSaved} onChange={(e) => selectPhoto(product.id, e)} style={{ display: 'none' }} />
                          <div style={{
                            height: '120px', borderRadius: 'var(--radius-field)', border: '2px dashed var(--border-strong)',
                            background: product.photoPreview ? 'transparent' : 'var(--bg-card-subtle)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            cursor: isSaved ? 'default' : 'pointer', overflow: 'hidden',
                          }}>
                            {product.photoPreview ? (
                              <img src={product.photoPreview} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <>
                                <Upload size={24} style={{ color: 'var(--text-muted)' }} />
                                <span className="text-small" style={{ color: 'var(--text-muted)' }}>Click to upload</span>
                              </>
                            )}
                          </div>
                        </label>
                        {product.photoPreview && !isSaved && (
                          <button type="button" aria-label="Remove image" onClick={() => removePhoto(product.id)}
                            style={{ position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px', borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{IMAGE_RULE_TEXT}</p>
                    </div>

                    <FieldInput label="Product Name" placeholder="Iced White" value={product.name} onChange={(v) => update(product.id, 'name', v)} maxLength={60} error={errors[product.id]?.name} />
                    <FieldInput label="Description" placeholder="250ml - Signature" value={product.description} onChange={(v) => update(product.id, 'description', v)} helperText="Brief description or variant info" maxLength={100} multiline />
                    {storeId != null && (
                      <div>
                        <FieldSelect
                          label="Category"
                          placeholder="No category"
                          options={categoryOptions}
                          value={product.categoryId}
                          onChange={(v) => update(product.id, 'categoryId', v)}
                        />
                        {categoryOptions.length === 0 && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
                            No categories yet.{' '}
                            {onNavigate && (
                              <button
                                type="button"
                                onClick={() => onNavigate('products-categories')}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)', textDecoration: 'underline', font: 'inherit' }}
                              >
                                Create one
                              </button>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <FieldInput label="Price" placeholder="5.50" prefix={currencySymbol(currency)} type="number" min={limits.min} max={limits.max} step={limits.step} value={product.price} onChange={(v) => update(product.id, 'price', v)} error={errors[product.id]?.price} />
                      <FieldInput label="Stock Quantity" placeholder="0" type="number" min={0} step={1} value={product.quantity} onChange={(v) => update(product.id, 'quantity', v)} helperText="Available inventory" error={errors[product.id]?.quantity} />
                    </div>

                    <FieldInput label="SKU" placeholder="e.g. ICW-001" value={product.sku} onChange={(v) => update(product.id, 'sku', v)} helperText="Optional stock-keeping unit" />

                    {/* Pre-order */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                      <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={product.preOrder} disabled={isSaved} onChange={(e) => update(product.id, 'preOrder', e.target.checked)} style={{ marginTop: '3px' }} />
                        <span>
                          <span className="text-small" style={{ fontWeight: 600, display: 'block' }}>Pre-order</span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sell before it's in stock, with a ready date.</span>
                        </span>
                      </label>
                      {product.preOrder && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', paddingLeft: '28px' }}>
                          <div>
                            <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Ready date</label>
                            <input type="date" value={product.readyDate} onChange={(e) => update(product.id, 'readyDate', e.target.value)}
                              style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)', background: 'var(--bg-card)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                          </div>
                          <FieldInput label="Pre-order note" placeholder="e.g. Ships early September" value={product.note} onChange={(v) => update(product.id, 'note', v)} />
                        </div>
                      )}
                    </div>

                    {formError[product.id] && <p className="text-small" style={{ color: 'var(--error-color)' }}>{formError[product.id]}</p>}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <Button variant="primary" onClick={() => saveProduct(product)} fullWidth disabled={isSaved || isSaving}>
                        {isSaved ? (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Check size={16} /> Added</span>) : isSaving ? 'Adding…' : 'Add Product'}
                      </Button>
                      {products.length > 1 && !isSaved && (
                        <Button variant="ghost" onClick={() => removeProduct(product.id)}><X size={16} /></Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}

            <Button variant="secondary" onClick={addProduct} fullWidth>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Plus size={16} /> Add Another Product
              </div>
            </Button>

            {onComplete ? (
              <Button fullWidth onClick={() => onComplete(savedList)}>
                Finish setup → Go to dashboard ({savedList.length} products)
              </Button>
            ) : (
              savedList.length > 0 && (
                <Button fullWidth onClick={() => onNavigate?.('products-all')}>
                  Done → View products ({savedList.length} added)
                </Button>
              )
            )}
          </div>
        </div>

        {/* Right: live preview */}
        <div style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
          <div style={{ marginBottom: '12px', textAlign: 'center' }}>
            <h3 className="text-small" style={{ color: 'var(--text-secondary)' }}>
              Live preview {savedList.length > 0 && `(${savedList.length} products)`}
            </h3>
          </div>
          <div style={{ width: '280px', margin: '0 auto', background: 'white', borderRadius: '28px', overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
            <div style={{ height: '560px', display: 'flex', flexDirection: 'column', background: '#F3F4F6' }}>
              <div style={{ background: storeColor, color: 'white', padding: '16px', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '16px', fontWeight: 600, border: '2px solid rgba(255,255,255,0.3)' }}>
                  {storeName.substring(0, 2).toUpperCase() || 'MS'}
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{storeName}</h2>
              </div>
              <div style={{ flex: 1, background: 'white', padding: '12px', overflowY: 'auto' }}>
                {savedList.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '11px' }}>
                    Added products will appear here.
                  </div>
                ) : (
                  savedList.map((p) => (
                    <div key={p.id} style={{ padding: '10px', background: '#F9FAFB', borderRadius: '6px', marginBottom: '6px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '4px', flexShrink: 0, overflow: 'hidden', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {p.photoPreview ? <img src={p.photoPreview} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Package size={16} style={{ color: '#9CA3AF' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{p.name}</div>
                        {p.preOrder && <div style={{ fontSize: '9px', color: '#92400E' }}>Pre-order{p.readyDate ? ` · ${p.readyDate}` : ''}</div>}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', flexShrink: 0 }}>{formatMoney(parseFloat(p.price) || 0, currency)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          div[style*="grid-template-columns: 1fr 400px"] { grid-template-columns: 1fr !important; }
          div[style*="position: sticky"] { position: static !important; }
        }
      `}</style>
    </div>
  );
}
