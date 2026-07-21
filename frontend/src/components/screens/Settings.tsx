import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '../Button';
import { FieldInput, FieldSelect } from '../Field';
import { storesApi, StoreResponse, UpdateStorePayload, ApiError } from '../../lib/api';

interface SettingsProps {
  storeId: number;
  onSaved: () => void;
}

const THEME_COLORS = ['#000000', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F97316'];

const sectionCard: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-card)',
  border: '1px solid var(--border-subtle)',
  padding: '24px',
};

const textareaStyle: React.CSSProperties = {
  width: '100%', minHeight: '88px', padding: '10px 14px', resize: 'vertical',
  borderRadius: 'var(--radius-field)', border: '1px solid var(--border-strong)',
  background: 'var(--bg-card)', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
};

function Toggle({ title, description, checked, onChange }: {
  title: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer', padding: '10px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: '3px' }} />
      <span>
        <span className="text-small" style={{ fontWeight: 600, display: 'block' }}>{title}</span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{description}</span>
      </span>
    </label>
  );
}

export function Settings({ storeId, onSaved }: SettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<UpdateStorePayload>({});
  const [slugTouchedFrom, setSlugTouchedFrom] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const s: StoreResponse = await storesApi.get(storeId);
      setForm({
        storeName: s.name,
        slug: s.slug,
        storeEmail: s.email ?? '',
        storePhone: s.phone ?? '',
        businessType: s.businessType ?? 'Food & Beverage',
        currency: s.currency,
        themeColor: s.themeColor ?? '#000000',
        storeDescription: s.storeDescription ?? '',
        paymentInstruction: s.paymentInstruction ?? '',
        streetAddress: s.streetAddress ?? '',
        city: s.city ?? '',
        postalCode: s.postalCode ?? '',
        notifyNewOrderEmail: s.notifyNewOrderEmail,
        notifyLowStockEmail: s.notifyLowStockEmail,
        notifyNewOrderWhatsapp: s.notifyNewOrderWhatsapp,
        notifyUrgentWhatsapp: s.notifyUrgentWhatsapp,
      });
      setSlugTouchedFrom(s.slug);
    } catch (e: any) {
      alert(e?.message || 'Could not load store settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const set = <K extends keyof UpdateStorePayload>(key: K, value: UpdateStorePayload[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!form.storeName?.trim()) {
      alert('Store name cannot be empty');
      return;
    }
    setSaving(true);
    try {
      await storesApi.update(storeId, {
        ...form,
        slug: form.slug?.trim().toLowerCase(),
      });
      alert('Settings saved');
      if (form.slug && form.slug !== slugTouchedFrom) {
        alert('Heads up: you changed the store link — staff use it as the store code, and shared links to the old address stop working.');
      }
      onSaved();
      load();
    } catch (e: any) {
      alert(e instanceof ApiError ? e.message : 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.storeName || 'S')
    .split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading settings…</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Settings</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Manage your store settings and preferences
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '820px' }}>
        {/* Store details */}
        <div style={sectionCard}>
          <h3 style={{ marginBottom: '20px' }}>Store Details</h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
            <div
              style={{
                width: '72px', height: '72px', borderRadius: '50%',
                background: form.themeColor || '#000000', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: '20px',
              }}
            >
              {initials}
            </div>
            <div>
              <Button variant="secondary" onClick={() => alert('Logo upload arrives with the photo-upload update (Cloudinary).')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Upload size={15} /> Upload logo
                </div>
              </Button>
              <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
                Optional, square images work best.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FieldInput label="Store Name" value={form.storeName || ''} onChange={(v) => set('storeName', v)} required />
            <FieldSelect
              label="Business Type"
              options={[
                { value: 'Food & Beverage', label: 'Food & Beverage' },
                { value: 'Retail', label: 'Retail' },
                { value: 'Services', label: 'Services' },
                { value: 'Other', label: 'Other' },
              ]}
              value={form.businessType || 'Food & Beverage'}
              onChange={(v) => set('businessType', v)}
              helperText="Help us understand your business better"
            />
            <FieldInput
              label="Email Address"
              type="email"
              value={form.storeEmail || ''}
              onChange={(v) => set('storeEmail', v)}
              helperText="Customer support and notifications email"
            />
            <FieldInput
              label="Phone"
              value={form.storePhone || ''}
              onChange={(v) => set('storePhone', v)}
              helperText="This will be your contact number."
            />
            <FieldInput
              label="Store Link"
              value={form.slug || ''}
              onChange={(v) => set('slug', v)}
              helperText={`manyorder.app/${form.slug || 'your-store'} — the link you share; staff also use it as the store code`}
            />
            <FieldSelect
              label="Currency"
              options={[
                { value: 'SGD', label: 'Singapore Dollar (SGD)' },
                { value: 'IDR', label: 'Indonesian Rupiah (IDR)' },
              ]}
              value={form.currency || 'SGD'}
              onChange={(v) => set('currency', v)}
              helperText="Auto-selects from country, but you can change it anytime"
            />
            <div>
              <p className="text-small" style={{ fontWeight: 500, marginBottom: '8px' }}>Theme Color</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => set('themeColor', c)}
                    style={{
                      width: '40px', height: '40px', borderRadius: '50%', background: c, cursor: 'pointer',
                      border: form.themeColor === c ? '3px solid var(--primary-solid)' : '3px solid transparent',
                      outline: form.themeColor === c ? '2px solid white' : 'none', outlineOffset: '-5px',
                    }}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-small" style={{ fontWeight: 500, marginBottom: '6px' }}>Store Description</p>
              <textarea style={textareaStyle} value={form.storeDescription || ''} onChange={(e) => set('storeDescription', e.target.value)} />
            </div>
            <div>
              <p className="text-small" style={{ fontWeight: 500, marginBottom: '6px' }}>Payment Instruction</p>
              <textarea
                style={textareaStyle}
                placeholder="e.g. PayNow to +65 8123 4567 and upload the receipt, or pay cash on pickup."
                value={form.paymentInstruction || ''}
                onChange={(e) => set('paymentInstruction', e.target.value)}
              />
              <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                Shown to customers at checkout.
              </p>
            </div>
          </div>
        </div>

        {/* Address */}
        <div style={sectionCard}>
          <h3 style={{ marginBottom: '20px' }}>Store Address</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FieldInput label="Street Address" placeholder="123 Main Street" value={form.streetAddress || ''} onChange={(v) => set('streetAddress', v)} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <FieldInput label="City" placeholder="Singapore" value={form.city || ''} onChange={(v) => set('city', v)} />
              <FieldInput label="Postal Code" placeholder="123456" value={form.postalCode || ''} onChange={(v) => set('postalCode', v)} />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div style={sectionCard}>
          <h3 style={{ marginBottom: '4px' }}>Notifications</h3>
          <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Get notified via email and WhatsApp when important events happen in your store
          </p>

          <p className="text-small" style={{ fontWeight: 600, marginBottom: '4px' }}>Email Notifications</p>
          <Toggle
            title="New orders"
            description="Email me when a customer places an order"
            checked={form.notifyNewOrderEmail ?? true}
            onChange={(v) => set('notifyNewOrderEmail', v)}
          />
          <Toggle
            title="Low inventory alerts"
            description="Email me when products are running low"
            checked={form.notifyLowStockEmail ?? true}
            onChange={(v) => set('notifyLowStockEmail', v)}
          />

          <p className="text-small" style={{ fontWeight: 600, margin: '16px 0 4px' }}>WhatsApp Notifications</p>
          <Toggle
            title="New orders"
            description="Send me a WhatsApp message when a customer places an order"
            checked={form.notifyNewOrderWhatsapp ?? true}
            onChange={(v) => set('notifyNewOrderWhatsapp', v)}
          />
          <Toggle
            title="Urgent alerts"
            description="Send me critical alerts (payment issues, out of stock items)"
            checked={form.notifyUrgentWhatsapp ?? true}
            onChange={(v) => set('notifyUrgentWhatsapp', v)}
          />

          <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
            Preferences are saved now; the email/WhatsApp senders arrive in a later update.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingBottom: '24px' }}>
          <Button variant="secondary" onClick={load} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}
