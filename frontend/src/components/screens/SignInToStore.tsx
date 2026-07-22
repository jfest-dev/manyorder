import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Store as StoreIcon } from 'lucide-react';
import { FieldInput } from '../Field';
import { PasswordField } from '../PasswordField';
import { Button } from '../Button';
import { SecurityFooter } from '../auth/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { publicApi } from '../../lib/api';

const PREFER_STORE_KEY = 'manyorder_prefer_store';

interface StoreBranding {
  name: string;
  slug: string;
  themeColor: string | null;
}

/**
 * Sign in to Store (?store=<slug>). Same credentials as the main sign-in —
 * this screen only adds the store branding and lands the user inside that
 * store after login.
 */
export function SignInToStore() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const slug = (searchParams.get('store') || '').toLowerCase();

  const [branding, setBranding] = useState<StoreBranding | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!slug) return;
    publicApi
      .storeBySlug(slug)
      .then((store) => setBranding({ name: store.name, slug: store.slug, themeColor: store.themeColor }))
      .catch(() => setBranding(null));
  }, [slug]);

  const initials = (name: string) =>
    name.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
      if (slug) sessionStorage.setItem(PREFER_STORE_KEY, slug);
      navigate('/app');
    } catch (e: any) {
      setError(e?.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div
          style={{
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-subtle)',
            padding: '40px 32px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: branding?.themeColor || 'var(--primary-solid)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: 'white',
                fontWeight: 600,
              }}
            >
              {branding ? initials(branding.name) : <StoreIcon size={28} color="white" />}
            </div>
            <h1 style={{ marginBottom: '6px' }}>Sign in to Store</h1>
            {branding ? (
              <>
                <p className="text-small" style={{ color: 'var(--text-secondary)' }}>{branding.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>manyorder.app/{branding.slug}</p>
              </>
            ) : (
              <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
                {slug ? 'Store not found — you can still sign in.' : 'Sign in with your ManyOrder account.'}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FieldInput label="Email Address" type="email" placeholder="you@example.com" value={email} onChange={setEmail} required />
            <PasswordField label="Password" placeholder="Enter your password" value={password} onChange={setPassword} required />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="text-small" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
              <button
                type="button"
                className="text-small"
                onClick={() => alert('Password reset is not included in this demo build.')}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}
              >
                Forgot password?
              </button>
            </div>

            {error && <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>}

            <Button variant="primary" fullWidth onClick={submit} disabled={busy || !email || !password}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <Lock size={14} /> {busy ? 'Signing in…' : 'Sign In'}
              </span>
            </Button>

            <Button
              variant="secondary"
              fullWidth
              onClick={() => (isAuthenticated ? navigate('/app?screen=stores-all') : navigate('/signin'))}
            >
              Back to All Stores
            </Button>
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <SecurityFooter />
        </div>
      </div>
    </div>
  );
}
