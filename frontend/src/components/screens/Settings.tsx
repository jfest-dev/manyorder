import { useEffect, useRef, useState } from 'react';
import { Upload, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '../Button';
import { FieldInput, FieldSelect } from '../Field';
import { PasswordField } from '../PasswordField';
import { accountApi, storesApi, uploadsApi, StoreResponse, UpdateStorePayload, ApiError } from '../../lib/api';
import { validatePassword, PASSWORD_RULE_TEXT } from '../../lib/password';
import { validateImageFile, IMAGE_RULE_TEXT, ALLOWED_IMAGE_ACCEPT } from '../../lib/image';

interface SettingsProps {
  storeId: number;
  onSaved: () => void;
  /** Called after the store is archived, so the app can refresh + switch away. */
  onArchived: () => void;
}

const THEME_COLORS = ['#000000', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F97316'];

/** No success token in the design system; matches the weight of --error-color. */
const SUCCESS_GREEN = '#16a34a';

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

/** Per-card save button with an inline "Saved" confirmation (no popups). */
function SaveRow({ label, active, saved, error, disabled, onSave }: {
  label: string; active: boolean; saved: boolean; error: string; disabled?: boolean; onSave: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
      <Button variant="primary" onClick={onSave} disabled={active || disabled}>
        {active ? 'Saving…' : label}
      </Button>
      {saved && (
        <span className="text-small" style={{ color: SUCCESS_GREEN, fontWeight: 500 }}>Saved</span>
      )}
      {error && (
        <span className="text-small" style={{ color: 'var(--error-color)' }}>{error}</span>
      )}
    </div>
  );
}

// Fields each card owns — used for per-card dirty tracking.
const STORE_KEYS: (keyof UpdateStorePayload)[] =
  ['storeName', 'slug', 'storeEmail', 'storePhone', 'businessType', 'currency', 'themeColor', 'logoUrl', 'storeDescription'];
const PAYMENT_KEYS: (keyof UpdateStorePayload)[] = ['paymentInstruction'];
const ADDRESS_KEYS: (keyof UpdateStorePayload)[] = ['streetAddress', 'city', 'postalCode', 'operatingHours'];
const NOTIFICATION_KEYS: (keyof UpdateStorePayload)[] = ['notifyNewOrderEmail', 'notifyLowStockEmail'];

export function Settings({ storeId, onSaved, onArchived }: SettingsProps) {
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<UpdateStorePayload>({});
  // Last-saved baseline; a card's Save button enables only when its fields diverge from this.
  const [savedForm, setSavedForm] = useState<UpdateStorePayload>({});
  const [slugTouchedFrom, setSlugTouchedFrom] = useState('');
  const [savedCurrency, setSavedCurrency] = useState('');
  const [savedName, setSavedName] = useState('');

  // Per-card save status — one card saving/confirming at a time.
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<{ key: string; msg: string } | null>(null);

  // Change Password (Account card).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [pwError, setPwError] = useState('');

  // Store logo (Store Details card). A newly picked file is held locally and
  // previewed via an object URL; it's uploaded only when the card is saved, so a
  // discarded pick never reaches the image host. form.logoUrl holds the SAVED
  // hosted URL ('' when the saved logo is staged for removal).
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Danger Zone (delete store).
  const [showArchive, setShowArchive] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [archivePassword, setArchivePassword] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [archiving, setArchiving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const s: StoreResponse = await storesApi.get(storeId);
      const next: UpdateStorePayload = {
        storeName: s.name,
        slug: s.slug,
        storeEmail: s.email ?? '',
        storePhone: s.phone ?? '',
        businessType: s.businessType ?? 'Food & Beverage',
        currency: s.currency,
        themeColor: s.themeColor ?? '#000000',
        logoUrl: s.logoUrl ?? '',
        storeDescription: s.storeDescription ?? '',
        operatingHours: s.operatingHours ?? '',
        paymentInstruction: s.paymentInstruction ?? '',
        streetAddress: s.streetAddress ?? '',
        city: s.city ?? '',
        postalCode: s.postalCode ?? '',
        notifyNewOrderEmail: s.notifyNewOrderEmail,
        notifyLowStockEmail: s.notifyLowStockEmail,
      };
      setForm(next);
      setSavedForm(next);
      setSlugTouchedFrom(s.slug);
      setSavedCurrency(s.currency);
      setSavedName(s.name);
    } catch (e: any) {
      setErrorKey({ key: 'store', msg: e?.message || 'Could not load store settings' });
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

  /** Save one card's slice via a partial PATCH, then flash an inline "Saved". */
  const saveCard = async (key: string, payload: UpdateStorePayload, after?: () => void) => {
    setSavingKey(key);
    setErrorKey(null);
    setSavedKey((k) => (k === key ? null : k));
    try {
      await storesApi.update(storeId, payload);
      onSaved();
      after?.();
      // Advance the baseline so this card's button returns to disabled.
      setSavedForm((prev) => ({ ...prev, ...payload }));
      setSavedKey(key);
      window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 3000);
    } catch (e: any) {
      setErrorKey({ key, msg: e instanceof ApiError ? e.message : 'Could not save changes' });
    } finally {
      setSavingKey(null);
    }
  };

  const saveStore = async () => {
    if (!form.storeName?.trim()) {
      setErrorKey({ key: 'store', msg: 'Store name cannot be empty' });
      return;
    }
    // A store must always have a link. The backend silently ignores a blank slug
    // (leaving the old one), so block it here rather than let the clear vanish.
    if (!form.slug?.trim()) {
      setErrorKey({ key: 'store', msg: 'Store link is required' });
      return;
    }
    if (form.currency && form.currency !== savedCurrency) {
      const proceed = confirm(
        'Changing currency does not convert your existing product prices — you\'ll need to update them manually. Continue?',
      );
      if (!proceed) return;
    }

    // Deferred logo upload: a newly picked file reaches the image host only now,
    // as part of the save. If it fails, we stop before the PATCH so nothing is
    // half-applied. The old hosted logo (if any) is deleted server-side once the
    // new logoUrl is persisted.
    let logoUrl = form.logoUrl;
    if (pendingLogoFile) {
      setSavingKey('store');
      setErrorKey(null);
      try {
        logoUrl = (await uploadsApi.logo(pendingLogoFile)).url;
      } catch (err) {
        setErrorKey({ key: 'store', msg: err instanceof ApiError ? err.message : 'Couldn’t upload the image. Please try again.' });
        setSavingKey(null);
        return;
      }
    }

    const normalizedSlug = form.slug?.trim().toLowerCase();
    await saveCard('store', {
      storeName: form.storeName,
      slug: normalizedSlug,
      storeEmail: form.storeEmail,
      storePhone: form.storePhone,
      businessType: form.businessType,
      currency: form.currency,
      themeColor: form.themeColor,
      logoUrl,
      storeDescription: form.storeDescription,
    }, () => {
      setSavedName(form.storeName?.trim() || '');
      setSavedCurrency(form.currency || '');
      setSlugTouchedFrom(normalizedSlug || '');
      if (normalizedSlug) setForm((p) => ({ ...p, slug: normalizedSlug }));
      // Adopt the freshly uploaded logo as the saved value and drop the pending file.
      setForm((p) => ({ ...p, logoUrl }));
      setPendingLogoFile(null);
    });
  };

  const savePayment = () => saveCard('payment', { paymentInstruction: form.paymentInstruction });

  const saveAddress = () => saveCard('address', {
    streetAddress: form.streetAddress,
    city: form.city,
    postalCode: form.postalCode,
    operatingHours: form.operatingHours,
  });

  const saveNotifications = () => saveCard('notifications', {
    notifyNewOrderEmail: form.notifyNewOrderEmail ?? true,
    notifyLowStockEmail: form.notifyLowStockEmail ?? true,
  });

  // Live object-URL preview for a newly picked file (revokes the old one).
  useEffect(() => {
    if (!pendingLogoFile) {
      setLogoPreview('');
      return;
    }
    const url = URL.createObjectURL(pendingLogoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingLogoFile]);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (!file) return;

    const invalid = validateImageFile(file);
    if (invalid) {
      setLogoError(invalid);
      return;
    }
    setLogoError(null);
    setPendingLogoFile(file); // held locally; uploaded on Save
  };

  const removeLogo = () => {
    setLogoError(null);
    if (pendingLogoFile) {
      // Discard an unsaved pick — nothing was uploaded, so revert to the saved logo.
      setPendingLogoFile(null);
    } else {
      // Stage removal of the saved logo; Save persists '' and the server deletes the file.
      set('logoUrl', '');
    }
  };

  const canChangePassword =
    currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  const changePassword = async () => {
    setPwError('');
    setPwSaved(false);
    const strengthError = validatePassword(newPassword);
    if (strengthError) {
      setPwError(strengthError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await accountApi.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 4000);
    } catch (e: any) {
      let msg = 'Could not update password';
      if (e instanceof ApiError) msg = e.status === 403 ? 'Incorrect password.' : e.message;
      setPwError(msg);
    } finally {
      setPwSaving(false);
    }
  };

  // A card is dirty when any field it owns differs from the last-saved baseline
  // (null/undefined normalized to '' so untouched empty fields never read dirty).
  const norm = (v: unknown) => (v === undefined || v === null ? '' : v);
  const isDirty = (keys: (keyof UpdateStorePayload)[]) =>
    keys.some((k) => norm(form[k]) !== norm(savedForm[k]));

  const nameMatches = confirmText.trim() === savedName;
  const canArchive = nameMatches && archivePassword.length > 0;

  const closeArchive = () => {
    if (archiving) return;
    setShowArchive(false);
    setConfirmText('');
    setArchivePassword('');
    setArchiveError('');
  };

  const archive = async () => {
    if (!canArchive) return;
    setArchiving(true);
    setArchiveError('');
    try {
      await storesApi.archive(storeId, archivePassword);
      onArchived();
    } catch (e: any) {
      // Wrong password (403) and any other failure surface inline; the modal
      // stays open and nothing is deleted.
      let msg = 'Could not delete store';
      if (e instanceof ApiError) {
        msg = e.status === 403 ? 'Incorrect password.' : e.message;
      }
      setArchiveError(msg);
      setArchiving(false);
    }
  };

  const initials = (form.storeName || 'S')
    .split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const slugChanged = (form.slug || '').trim().toLowerCase() !== slugTouchedFrom;

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
                position: 'relative',
                width: '72px', height: '72px', borderRadius: '50%',
                background: (logoPreview || form.logoUrl) ? 'transparent' : (form.themeColor || '#000000'), color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 600, fontSize: '20px', overflow: 'hidden',
              }}
            >
              {logoPreview || form.logoUrl ? (
                <img src={logoPreview || form.logoUrl} alt="Store logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                initials
              )}
              {savingKey === 'store' && pendingLogoFile && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Loader2 size={22} color="white" style={{ animation: 'mo-spin 0.8s linear infinite' }} />
                </div>
              )}
            </div>
            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept={ALLOWED_IMAGE_ACCEPT}
                onChange={handleLogoSelect}
                style={{ display: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button variant="secondary" onClick={() => logoInputRef.current?.click()}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Upload size={15} /> {(logoPreview || form.logoUrl) ? 'Change logo' : 'Upload logo'}
                  </div>
                </Button>
                {(logoPreview || form.logoUrl) && (
                  <Button variant="ghost" onClick={removeLogo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <X size={14} /> Remove
                    </div>
                  </Button>
                )}
              </div>
              {logoError ? (
                <p className="text-xs" style={{ color: 'var(--error-color)', marginTop: '6px' }}>
                  {logoError}
                </p>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '6px' }}>
                  {IMAGE_RULE_TEXT} Square images work best.
                </p>
              )}
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
              helperText={
                slugChanged
                  ? `manyorder.app/${form.slug || 'your-store'} — changing your store link breaks links you've already shared`
                  : `manyorder.app/${form.slug || 'your-store'} — the link you share with customers`
              }
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
              <textarea
                style={textareaStyle}
                maxLength={200}
                value={form.storeDescription || ''}
                onChange={(e) => set('storeDescription', e.target.value.slice(0, 200))}
              />
              <p className="text-xs" style={{ color: (form.storeDescription || '').length >= 200 ? '#B91C1C' : 'var(--text-muted)', marginTop: '4px', textAlign: 'right' }}>
                {(form.storeDescription || '').length}/200
              </p>
            </div>
          </div>

          <SaveRow
            label="Save"
            active={savingKey === 'store'}
            saved={savedKey === 'store'}
            error={errorKey?.key === 'store' ? errorKey.msg : ''}
            disabled={!isDirty(STORE_KEYS) && !pendingLogoFile}
            onSave={saveStore}
          />
        </div>

        {/* Payment instruction */}
        <div style={sectionCard}>
          <h3 style={{ marginBottom: '4px' }}>Payment Instruction</h3>
          <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Shown to customers at checkout.
          </p>
          <textarea
            style={textareaStyle}
            placeholder="e.g. PayNow to +65 8123 4567 and upload the receipt, or pay cash on pickup."
            value={form.paymentInstruction || ''}
            onChange={(e) => set('paymentInstruction', e.target.value)}
          />
          <SaveRow
            label="Save"
            active={savingKey === 'payment'}
            saved={savedKey === 'payment'}
            error={errorKey?.key === 'payment' ? errorKey.msg : ''}
            disabled={!isDirty(PAYMENT_KEYS)}
            onSave={savePayment}
          />
        </div>

        {/* Address & hours */}
        <div style={sectionCard}>
          <h3 style={{ marginBottom: '20px' }}>Store Address & Hours</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FieldInput label="Street Address" placeholder="123 Main Street" value={form.streetAddress || ''} onChange={(v) => set('streetAddress', v)} helperText="Shown to customers on your storefront." />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <FieldInput label="City" placeholder="Singapore" value={form.city || ''} onChange={(v) => set('city', v)} />
              <FieldInput label="Postal Code" placeholder="123456" value={form.postalCode || ''} onChange={(v) => set('postalCode', v)} />
            </div>
            <FieldInput label="Operating hours" placeholder="e.g. Mon–Sat, 9am–6pm · Closed Sun" value={form.operatingHours || ''} onChange={(v) => set('operatingHours', v)} helperText="Free text — shown on your storefront." />
          </div>
          <SaveRow
            label="Save"
            active={savingKey === 'address'}
            saved={savedKey === 'address'}
            error={errorKey?.key === 'address' ? errorKey.msg : ''}
            disabled={!isDirty(ADDRESS_KEYS)}
            onSave={saveAddress}
          />
        </div>

        {/* Notifications */}
        <div style={sectionCard}>
          <h3 style={{ marginBottom: '4px' }}>Notifications</h3>
          <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Get notified via email when important events happen in your store
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

          <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
            Preferences are saved now; email delivery arrives in a later update.
          </p>

          <SaveRow
            label="Save"
            active={savingKey === 'notifications'}
            saved={savedKey === 'notifications'}
            error={errorKey?.key === 'notifications' ? errorKey.msg : ''}
            disabled={!isDirty(NOTIFICATION_KEYS)}
            onSave={saveNotifications}
          />
        </div>

        {/* Account — account-level actions that apply to you, not a specific store */}
        <div style={sectionCard}>
          <h3 style={{ marginBottom: '4px' }}>Account</h3>
          <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
            These settings apply to your account, not to any single store.
          </p>

          <p className="text-small" style={{ fontWeight: 600, marginBottom: '12px' }}>Change Password</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '420px' }}>
            <PasswordField
              label="Current Password"
              value={currentPassword}
              onChange={(v) => { setCurrentPassword(v); if (pwError) setPwError(''); }}
              placeholder="Your current password"
            />
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={(v) => { setNewPassword(v); if (pwError) setPwError(''); }}
              placeholder={PASSWORD_RULE_TEXT}
            />
            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChange={(v) => { setConfirmPassword(v); if (pwError) setPwError(''); }}
              placeholder="Repeat your password"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
            <Button variant="primary" onClick={changePassword} disabled={pwSaving || !canChangePassword}>
              {pwSaving ? 'Updating…' : 'Update password'}
            </Button>
            {pwSaved && (
              <span className="text-small" style={{ color: SUCCESS_GREEN, fontWeight: 500 }}>Password updated</span>
            )}
            {pwError && (
              <span className="text-small" style={{ color: 'var(--error-color)' }}>{pwError}</span>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div style={{ ...sectionCard, border: '1px solid var(--error-color)', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <AlertTriangle size={18} style={{ color: 'var(--error-color)' }} />
            <h3 style={{ color: 'var(--error-color)' }}>Danger Zone</h3>
          </div>
          <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            This permanently deletes the store, including all its orders, products, and customers.
            This action cannot be undone.
          </p>
          <Button variant="secondary" onClick={() => setShowArchive(true)}>
            <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>Delete this store</span>
          </Button>
        </div>
      </div>

      {showArchive && (
        <div
          onClick={closeArchive}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-card)',
              border: '1px solid var(--border-subtle)', padding: '24px',
              width: '100%', maxWidth: '440px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={20} style={{ color: 'var(--error-color)' }} />
              <h3>Delete “{savedName}”?</h3>
            </div>
            <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              This will permanently delete the store and everything in it. This action cannot be
              undone. To confirm, type the store name <strong>{savedName}</strong> and re-enter your
              password below.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FieldInput
                label="Store name"
                value={confirmText}
                onChange={setConfirmText}
                placeholder={savedName}
              />
              <PasswordField
                label="Confirm your password"
                value={archivePassword}
                onChange={(v) => {
                  setArchivePassword(v);
                  if (archiveError) setArchiveError('');
                }}
                placeholder="Your account password"
                error={archiveError || undefined}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <Button variant="secondary" onClick={closeArchive} disabled={archiving}>Cancel</Button>
              <Button
                variant="primary"
                onClick={archive}
                disabled={archiving || !canArchive}
              >
                {archiving ? 'Deleting…' : 'Delete store'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
