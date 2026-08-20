import { useEffect, useRef, useState } from 'react';
import { FieldInput, FieldSelect } from '../Field';
import { Button } from '../Button';
import { Card } from '../Card';
import { Upload, LogOut, Store, X, Loader2 } from 'lucide-react';
import { storeInitials } from '../../lib/initials';
import { styledSelect } from '../../lib/selectStyle';
import { validateImageFile, IMAGE_RULE_TEXT, ALLOWED_IMAGE_ACCEPT } from '../../lib/image';

interface CreateStoreProps {
  // Keep your UI fields, but App.tsx can still ignore the extra fields safely
  onComplete: (data: {
    name: string;
    category: string;
    color: string;
    // The chosen logo file, if any. Uploaded to the image host by the caller
    // only when the store is actually created - never on select - so an
    // abandoned or replaced pick never leaves an orphan behind.
    logoFile?: File | null;

    // extra fields (optional)
    currency?: string;
    phone?: string;
    storeLink?: string;
    storeLinkTouched?: boolean;
    streetAddress?: string;
    city?: string;
    postalCode?: string;
    operatingHours?: string;
  }) => void;

  onNavigate?: (screen: string) => void;

  // Onboarding (first store) passes this so the header shows a "Sign out"
  // button - a brand-new merchant with no store yet always has a way out.
  onSignOut?: () => void;

  // The logo pick held by the caller across onboarding steps, so a Back to
  // step 1 restores the preview. (A File can't live in the localStorage draft,
  // so a full refresh still clears it - an accepted trade-off.)
  initialLogoFile?: File | null;

  // Prefill the form when returning to this step (e.g. onboarding "Back"),
  // so nothing the merchant already typed is lost.
  initialData?: {
    name?: string;
    category?: string;
    color?: string;
    currency?: string;
    phone?: string;
    storeLink?: string;
    storeLinkTouched?: boolean;
    streetAddress?: string;
    city?: string;
    postalCode?: string;
    operatingHours?: string;
  };
}

const COUNTRY_CODES = ['+65', '+62'];

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

export function CreateStore({ onComplete, onNavigate, onSignOut, initialLogoFile, initialData }: CreateStoreProps) {
  // Split a saved combined phone (e.g. "+65 9123") back into code + number.
  const initialCode = COUNTRY_CODES.find((c) => initialData?.phone?.startsWith(c)) || '+65';
  const initialPhone = initialData?.phone ? initialData.phone.slice(initialCode.length) : '';

  const [storeName, setStoreName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || 'food');
  const [currency, setCurrency] = useState(initialData?.currency || 'sgd');
  const [selectedColor, setSelectedColor] = useState(initialData?.color || '#000000');
  const [countryCode, setCountryCode] = useState(initialCode);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [storeLink, setStoreLink] = useState(initialData?.storeLink || '');
  // Only a direct edit to the link field stops auto-follow. We persist this
  // flag into the draft so it survives a Back round-trip - an auto-derived
  // link must NOT be mistaken for a user-customized one.
  const [storeLinkTouched, setStoreLinkTouched] = useState(!!initialData?.storeLinkTouched);
  const [streetAddress, setStreetAddress] = useState(initialData?.streetAddress || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [postalCode, setPostalCode] = useState(initialData?.postalCode || '');
  const [operatingHours, setOperatingHours] = useState(initialData?.operatingHours || '');

  // Logo: held locally as a File and previewed via an object URL. Nothing is
  // uploaded here - the caller uploads it only when the store is created, so a
  // discarded or replaced pick never reaches the image host.
  const [logoFile, setLogoFile] = useState<File | null>(initialLogoFile ?? null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Business Name is the one required field (matches the backend's @NotBlank).
  const [nameError, setNameError] = useState<string | null>(null);

  // Submit state - the logo re-encode + upload happens during this, so we show a
  // clear "Uploading…" cue rather than letting it feel stuck.
  const [submitting, setSubmitting] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Keep a live object-URL preview for the current File, revoking the old one.
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview('');
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

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
    setLogoFile(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoError(null);
  };

  const handleCreateStore = async () => {
    if (!storeName.trim()) {
      setNameError('Business name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await onComplete({
        name: storeName,
        category,
        color: selectedColor,
        logoFile,

        // extra fields (won’t break App.tsx)
        currency,
        phone: `${countryCode}${phoneNumber}`,
        storeLink,
        storeLinkTouched,
        streetAddress,
        city,
        postalCode,
        operatingHours,
      });
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div></div>

          {onSignOut && (
            <Button variant="ghost" onClick={onSignOut}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LogOut size={14} />
                Sign out
              </div>
            </Button>
          )}
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
                  {/* Avatar preview - the picked logo when set, else initials/colour. */}
                  <div
                    style={{
                      position: 'relative',
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: logoPreview ? 'transparent' : selectedColor,
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
                    {logoPreview ? (
                      <img src={logoPreview} alt="Store logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : storeInitials(storeName) ? (
                      storeInitials(storeName)
                    ) : (
                      <Store size={26} color="white" />
                    )}
                    {submitting && logoFile && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 size={20} color="white" style={{ animation: 'mo-spin 0.8s linear infinite' }} />
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_IMAGE_ACCEPT}
                    onChange={handleLogoSelect}
                    style={{ display: 'none' }}
                  />
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <Upload size={15} /> {logoPreview ? 'Change logo' : 'Upload logo'}
                    </span>
                  </Button>
                  {logoPreview && (
                    <Button variant="ghost" onClick={removeLogo}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <X size={14} /> Remove
                      </span>
                    </Button>
                  )}
                </div>
                {logoError ? (
                  <p className="text-xs" style={{ color: 'var(--error-color)', marginTop: '8px' }}>
                    {logoError}
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
                    {IMAGE_RULE_TEXT} Square images work best.
                  </p>
                )}
              </div>

              <FieldInput
                label="Business Name"
                placeholder="e.g., Noodle House Delights"
                value={storeName}
                required
                error={nameError ?? undefined}
                onChange={(value) => {
                  setStoreName(value);
                  if (value.trim() !== '') setNameError(null);
                  if (value.trim() === '') {
                    // Clearing the name blanks the link and re-arms auto-follow,
                    // so auto and manual modes end in the same clean state.
                    setStoreLink('');
                    setStoreLinkTouched(false);
                  } else if (!storeLinkTouched) {
                    // Auto-track the store link from the name until the user edits it directly.
                    setStoreLink(slugify(value));
                  }
                }}
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
                  Phone
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '12px' }}>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    style={styledSelect}
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
                      border: '1px solid var(--border-strong)',
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
                  Store link
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
                    placeholder="your-store-name"
                    value={storeLink}
                    onChange={(e) => {
                      const next = slugify(e.target.value);
                      setStoreLink(next);
                      // Emptying the field re-arms auto-follow; any non-empty
                      // edit marks the link as user-owned.
                      setStoreLinkTouched(next !== '');
                    }}
                    style={{
                      width: '100%',
                      height: '40px',
                      paddingLeft: '140px',
                      paddingRight: '12px',
                      border: '1px solid var(--border-strong)',
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

              {/* Address & hours - shown on the storefront; editable later in Settings. */}
              <FieldInput
                label="Street address"
                placeholder="123 Main Street"
                value={streetAddress}
                onChange={setStreetAddress}
                helperText="Shown to customers on your storefront (optional)."
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FieldInput label="City" placeholder="Singapore" value={city} onChange={setCity} />
                <FieldInput label="Postal code" placeholder="123456" value={postalCode} onChange={setPostalCode} />
              </div>
              <FieldInput
                label="Operating hours"
                placeholder="e.g. Mon–Sat, 9am–6pm · Closed Sun"
                value={operatingHours}
                onChange={setOperatingHours}
                helperText="Free text, shown on your storefront (optional)."
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
                      }}
                      title={theme.name}
                    />
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '8px' }}>
                <Button fullWidth onClick={handleCreateStore} disabled={submitting}>
                  {submitting ? (logoFile ? 'Uploading…' : 'Creating store…') : 'Create store'}
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
                      background: 'rgba(255, 255, 255, 0.2)',
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
                    {logoPreview ? (
                      <img src={logoPreview} alt="Store logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : storeInitials(storeName) ? (
                      storeInitials(storeName)
                    ) : (
                      <Store size={20} color="white" />
                    )}
                  </div>

                  <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '2px' }}>{storeName || 'Your Store Name'}</h2>
                  <p style={{ fontSize: '11px', opacity: 0.9 }}>manyorder.app/{storeLink || 'your-store-name'}</p>
                </div>

                <div style={{ flex: 1, background: 'white', padding: '12px', overflowY: 'auto' }}>
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
