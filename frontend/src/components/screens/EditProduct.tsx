import { useEffect, useRef, useState } from 'react';
import { Upload, X, ArrowLeft } from 'lucide-react';
import { FieldInput } from '../Field';
import { MoneyField } from '../MoneyField';
import { TimeField } from '../TimeField';
import { Button } from '../Button';
import { Card } from '../Card';
import { CategorySelect } from '../CategorySelect';
import { formatMoney, priceLimits } from '../../lib/currency';
import { formatPreorderReady } from '../../lib/datetime';
import { ToggleSwitch } from '../ToggleSwitch';
import { validateImageFile, IMAGE_RULE_TEXT, ALLOWED_IMAGE_ACCEPT } from '../../lib/image';
import { productsApi, UpdateProductPayload, ApiError } from '../../lib/api';

interface EditProductProps {
  storeId: number;
  productId: number;
  storeName?: string;
  storeSlug?: string;
  storeColor?: string;
  currency?: string;
  onNavigate?: (screen: string) => void;
}

export function EditProduct({
  storeId,
  productId,
  storeName = 'My Store',
  storeSlug = 'my-store',
  storeColor = '#000000',
  currency = 'sgd',
  onNavigate,
}: EditProductProps) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [price, setPrice] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(''); // '' = no category
  const [categoryName, setCategoryName] = useState(''); // resolved name, for the preview badge
  const [stock, setStock] = useState('');
  const [sku, setSku] = useState('');
  const [status, setStatus] = useState<'active' | 'draft'>('active');

  // Photo: current saved URL ('' = none) + a newly picked file previewed locally.
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-order.
  const [preOrder, setPreOrder] = useState(false);
  const [preOrderReadyDate, setPreOrderReadyDate] = useState('');
  const [preOrderReadyTimeStart, setPreOrderReadyTimeStart] = useState('');
  const [preOrderReadyTimeEnd, setPreOrderReadyTimeEnd] = useState('');
  const [preOrderNote, setPreOrderNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draft persistence: in-progress edits survive a refresh / accidental nav and
  // restore automatically, cleared once the product saves. Photo (a File) isn't
  // persisted — only the text/schedule fields. `hydrated` gates the save effect
  // so we don't persist the blank pre-load state over a real draft.
  const draftKey = `manyorder_editdraft_${storeId}_${productId}`;
  const [hydrated, setHydrated] = useState(false);

  const backToList = () => onNavigate?.('products-all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    productsApi
      .get(storeId, productId)
      .then((p) => {
        if (cancelled) return;
        setName(p.name);
        setPrice(p.price);
        setDescription(p.description ?? '');
        setCategoryId(p.categoryId != null ? String(p.categoryId) : '');
        setStock(String(p.stock ?? 0));
        setSku(p.sku ?? '');
        setStatus(p.isActive ? 'active' : 'draft');
        setPhotoUrl(p.photoUrl ?? '');
        setPreOrder(p.preOrder);
        setPreOrderReadyDate(p.preOrderReadyDate ?? '');
        setPreOrderReadyTimeStart((p.preOrderReadyTimeStart ?? '').slice(0, 5)); // HH:mm for <input type=time>
        setPreOrderReadyTimeEnd((p.preOrderReadyTimeEnd ?? '').slice(0, 5));
        setPreOrderNote(p.preOrderNote ?? '');

        // Overlay any unsaved draft on top of the freshly-loaded values.
        try {
          const raw = sessionStorage.getItem(draftKey);
          if (raw) {
            const d = JSON.parse(raw);
            if (d.name !== undefined) setName(d.name);
            if (d.price !== undefined) setPrice(d.price);
            if (d.description !== undefined) setDescription(d.description);
            if (d.categoryId !== undefined) setCategoryId(d.categoryId);
            if (d.stock !== undefined) setStock(d.stock);
            if (d.sku !== undefined) setSku(d.sku);
            if (d.status !== undefined) setStatus(d.status);
            if (d.preOrder !== undefined) setPreOrder(d.preOrder);
            if (d.preOrderReadyDate !== undefined) setPreOrderReadyDate(d.preOrderReadyDate);
            if (d.preOrderReadyTimeStart !== undefined) setPreOrderReadyTimeStart(d.preOrderReadyTimeStart);
            if (d.preOrderReadyTimeEnd !== undefined) setPreOrderReadyTimeEnd(d.preOrderReadyTimeEnd);
            if (d.preOrderNote !== undefined) setPreOrderNote(d.preOrderNote);
          }
        } catch { /* ignore a malformed draft */ }
        setHydrated(true);
      })
      .catch((e) => { if (!cancelled) setLoadError(e instanceof ApiError ? e.message : 'Could not load product'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId, productId, draftKey]);

  // Persist in-progress edits (text/schedule fields) once the form is hydrated.
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({
        name, price, description, categoryId, stock, sku, status,
        preOrder, preOrderReadyDate, preOrderReadyTimeStart, preOrderReadyTimeEnd, preOrderNote,
      }));
    } catch { /* storage full — draft is best-effort */ }
  }, [hydrated, draftKey, name, price, description, categoryId, stock, sku, status,
      preOrder, preOrderReadyDate, preOrderReadyTimeStart, preOrderReadyTimeEnd, preOrderNote]);

  // Live object-URL preview for a newly picked file.
  useEffect(() => {
    if (!photoFile) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) { setPhotoError(invalid); return; }
    setPhotoError(null);
    setPhotoFile(file);
  };

  const removePhoto = () => {
    setPhotoError(null);
    setPhotoFile(null);
    setPhotoUrl(''); // cleared; the save sends photoUrl:'' so the server deletes it
  };


  const handleSave = async () => {
    setError(null);
    if (!name.trim()) { setError('Product name is required.'); return; }
    const priceNum = price;
    if (priceNum === null || priceNum <= 0) { setError('Enter a valid price.'); return; }
    const stockNum = stock.trim() === '' ? 0 : parseInt(stock, 10);
    if (Number.isNaN(stockNum) || stockNum < 0) { setError('Stock must be 0 or more.'); return; }

    setSaving(true);
    try {
      // Deferred photo upload: a newly picked file reaches the host only now.
      let finalPhotoUrl = photoUrl;
      if (photoFile) {
        finalPhotoUrl = (await productsApi.uploadPhoto(storeId, productId, photoFile)).url;
      }

      const payload: UpdateProductPayload = {
        name: name.trim(),
        description: description.trim(),
        price: priceNum,
        categoryId: categoryId ? Number(categoryId) : 0, // 0 clears to no category
        stock: stockNum,
        sku: sku.trim(),
        photoUrl: finalPhotoUrl, // '' clears; unchanged is a no-op server-side
        preOrder,
        preOrderReadyDate: preOrder && preOrderReadyDate ? preOrderReadyDate : undefined,
        preOrderReadyTimeStart: preOrder && preOrderReadyTimeStart ? preOrderReadyTimeStart : undefined,
        preOrderReadyTimeEnd: preOrder && preOrderReadyTimeEnd ? preOrderReadyTimeEnd : undefined,
        preOrderNote: preOrder ? preOrderNote.trim() : undefined,
      };
      // Status maps to isActive via a dedicated call when it changes to draft/active.
      await productsApi.update(storeId, productId, payload);
      if (status === 'draft') {
        await productsApi.deactivate(storeId, productId);
      }
      sessionStorage.removeItem(draftKey); // saved — drop the draft
      backToList();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Hide this product from your store? You can re-add it later.')) return;
    setSaving(true);
    try {
      await productsApi.deactivate(storeId, productId);
      sessionStorage.removeItem(draftKey); // product hidden — drop the draft
      backToList();
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Could not delete product');
      setSaving(false);
    }
  };

  const shownPhoto = photoPreview || photoUrl;
  const previewPrice = price === null ? '' : formatMoney(price, currency);

  if (loading) {
    return <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading product…</p>;
  }
  if (loadError) {
    return (
      <div>
        <button onClick={backToList} style={backBtnStyle}><ArrowLeft size={16} /> Back to Products</button>
        <p className="text-small" style={{ color: 'var(--error-color)' }}>{loadError}</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={backToList} style={backBtnStyle}><ArrowLeft size={16} /> Back to Products</button>
        <h1 style={{ marginBottom: '8px' }}>Edit Product</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Update product details and inventory</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '32px' }}>
        {/* Left: form */}
        <div>
          <Card title="Product Details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Photo */}
              <div>
                <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Product Photo
                </label>
                <input ref={fileInputRef} type="file" accept={ALLOWED_IMAGE_ACCEPT} onChange={handlePhotoSelect} style={{ display: 'none' }} />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    height: '200px', borderRadius: 'var(--radius-field)', border: '2px dashed var(--border-strong)',
                    background: shownPhoto ? 'transparent' : 'var(--bg-card-subtle)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    cursor: 'pointer', overflow: 'hidden', position: 'relative',
                  }}
                >
                  {shownPhoto ? (
                    <>
                      <img src={shownPhoto} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhoto(); }}
                        style={{ position: 'absolute', top: '8px', right: '8px', padding: '6px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', display: 'inline-flex' }}
                        aria-label="Remove photo"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload size={32} style={{ color: 'var(--text-muted)' }} />
                      <span className="text-small" style={{ color: 'var(--text-muted)' }}>Click to upload a photo</span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{IMAGE_RULE_TEXT} Square works best.</span>
                    </>
                  )}
                </div>
                {photoError && <p className="text-xs" style={{ color: 'var(--error-color)', marginTop: '6px' }}>{photoError}</p>}
              </div>

              <FieldInput label="Product Name" placeholder="Wireless Headphones" value={name} onChange={setName} required />
              <FieldInput label="Description" placeholder="Short description" value={description} onChange={setDescription} helperText="Brief description or variant info" />
              <CategorySelect
                storeId={storeId}
                value={categoryId}
                onChange={setCategoryId}
                onCategoryName={(n) => setCategoryName(n ?? '')}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <MoneyField label="Price" currency={currency} value={price} onChange={setPrice} min={priceLimits(currency).min} max={priceLimits(currency).max} required />
                <FieldInput label="Stock Quantity" placeholder="0" type="number" value={stock} onChange={setStock} helperText="Available inventory" />
              </div>

              <FieldInput label="SKU" placeholder="e.g. HDPH-001" value={sku} onChange={setSku} helperText="Optional stock-keeping unit" />

              {/* Status */}
              <div>
                <ToggleSwitch
                  checked={status === 'active'}
                  onChange={(c) => setStatus(c ? 'active' : 'draft')}
                  label="Visible to customers"
                  description={status === 'active' ? 'Active — shown on your storefront.' : 'Draft — hidden from customers.'}
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>Out of stock shows automatically when stock reaches 0.</p>
              </div>

              {/* Pre-order */}
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                <ToggleSwitch
                  checked={preOrder}
                  onChange={setPreOrder}
                  label="Pre-order"
                  description="Sell before it's in stock, with a ready date."
                />
                {preOrder && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', paddingLeft: '28px' }}>
                    <div>
                      <label className="text-xs" style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Ready date</label>
                      <input type="date" value={preOrderReadyDate} onChange={(e) => setPreOrderReadyDate(e.target.value)}
                        style={{ height: '40px', padding: '0 12px', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-field)', background: 'var(--bg-card)', fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ready time (optional)</label>
                        {(preOrderReadyTimeStart || preOrderReadyTimeEnd) && (
                          <button type="button" onClick={() => { setPreOrderReadyTimeStart(''); setPreOrderReadyTimeEnd(''); }}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textDecoration: 'underline' }}>
                            Clear
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>From</div>
                          <TimeField value={preOrderReadyTimeStart} onChange={setPreOrderReadyTimeStart} ariaLabel="Ready from time" />
                        </div>
                        <div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Until</div>
                          <TimeField value={preOrderReadyTimeEnd} onChange={setPreOrderReadyTimeEnd} ariaLabel="Ready until time" />
                        </div>
                      </div>
                    </div>
                    <FieldInput label="Pre-order note" placeholder="e.g. Ships early September" value={preOrderNote} onChange={setPreOrderNote} />
                  </div>
                )}
              </div>

              {error && <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <Button variant="primary" onClick={handleSave} disabled={saving} fullWidth>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
                <Button variant="ghost" onClick={backToList} disabled={saving}>Cancel</Button>
              </div>

              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <button onClick={handleDelete} disabled={saving} style={deleteBtnStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#DC2626'; e.currentTarget.style.color = 'white'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#DC2626'; }}
                >
                  Delete Product
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Right: live preview */}
        <div style={{ position: 'sticky', top: '24px', alignSelf: 'start' }}>
          <div style={{ marginBottom: '12px', textAlign: 'center' }}>
            <h3 className="text-small" style={{ color: 'var(--text-secondary)' }}>Live preview</h3>
          </div>
          <div style={{ width: '280px', margin: '0 auto', background: 'white', borderRadius: '28px', overflow: 'hidden', border: '1px solid var(--border-strong)' }}>
            <div style={{ height: '560px', display: 'flex', flexDirection: 'column', background: '#F3F4F6' }}>
              <div style={{ background: storeColor, color: 'white', padding: '16px', textAlign: 'center' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '16px', fontWeight: 600, border: '2px solid rgba(255,255,255,0.3)' }}>
                  {storeName.substring(0, 2).toUpperCase() || 'MS'}
                </div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>{storeName}</h2>
                <p style={{ fontSize: '11px', opacity: 0.9 }}>manyorder.app/{storeSlug}</p>
              </div>
              <div style={{ flex: 1, background: 'white', padding: '12px', overflowY: 'auto' }}>
                <div style={{ padding: '10px', background: '#F9FAFB', borderRadius: '6px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {shownPhoto && <img src={shownPhoto} alt={name} style={{ width: '60px', height: '60px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', marginBottom: '2px' }}>{name || 'Product Name'}</div>
                    <div style={{ fontSize: '10px', color: '#6B7280', marginBottom: '4px' }}>{description || 'No description'}</div>
                    {categoryName && <div style={{ display: 'inline-block', padding: '2px 6px', background: '#E5E7EB', borderRadius: '3px', fontSize: '9px', color: '#4B5563', fontWeight: 500 }}>{categoryName}</div>}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', flexShrink: 0 }}>{previewPrice}</div>
                </div>
                {preOrder && (() => {
                  const ready = formatPreorderReady(preOrderReadyDate, preOrderReadyTimeStart, preOrderReadyTimeEnd);
                  return (
                    <div style={{ marginTop: '12px', padding: '10px', background: '#FEF3C7', borderRadius: '6px', fontSize: '11px', color: '#92400E' }}>
                      🕒 Pre-order{ready ? ` — ready ${ready}` : ''}{preOrderNote ? `. ${preOrderNote}` : ''}
                    </div>
                  );
                })()}
                {!preOrder && status === 'draft' && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#FEF3C7', borderRadius: '6px', fontSize: '11px', color: '#92400E', textAlign: 'center' }}>
                    ⚠️ Draft — not visible to customers
                  </div>
                )}
                {!preOrder && status === 'active' && (stock.trim() === '0') && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#FEE2E2', borderRadius: '6px', fontSize: '11px', color: '#991B1B', textAlign: 'center' }}>
                    ❌ Out of stock
                  </div>
                )}
              </div>
              <div style={{ background: 'white', padding: '12px', borderTop: '1px solid #E5E7EB' }}>
                <button style={{ width: '100%', padding: '10px', background: '#000000', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'default' }}>Order now</button>
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

const backBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none',
  color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: '4px 0', marginBottom: '12px',
};

const deleteBtnStyle: React.CSSProperties = {
  width: '100%', padding: '10px', background: 'transparent', border: '1px solid #DC2626',
  borderRadius: 'var(--radius-field)', color: '#DC2626', fontSize: '13px', fontWeight: 500,
  cursor: 'pointer', transition: 'all 0.15s ease',
};
