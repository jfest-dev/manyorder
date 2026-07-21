import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout, SecurityFooter } from '../auth/AuthLayout';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { FieldInput } from '../Field';
import { Button } from '../Button';
import { useAuth } from '../../context/AuthContext';

type AccountRole = 'MERCHANT' | 'STAFF';

export function CreateAccount() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<AccountRole>('MERCHANT');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (role === 'STAFF' && !storeSlug.trim()) {
      setError('Enter the store code your owner shared with you');
      return;
    }
    setBusy(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
        storeSlug: role === 'STAFF' ? storeSlug.trim().toLowerCase() : undefined,
      });
      navigate('/app');
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  const rolePill = (value: AccountRole, label: string) => {
    const active = role === value;
    return (
      <button
        type="button"
        onClick={() => setRole(value)}
        className="text-small"
        style={{
          flex: 1,
          padding: '10px 12px',
          borderRadius: 'var(--radius-pill)',
          border: active ? '1px solid var(--primary-solid)' : '1px solid var(--border-strong)',
          background: active ? 'var(--primary-solid)' : 'var(--bg-card)',
          color: active ? 'var(--text-on-dark)' : 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your account first — your store comes next"
      footer={<SecurityFooter />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {rolePill('MERCHANT', "I'm a store owner")}
          {rolePill('STAFF', "I'm joining as staff")}
        </div>

        {role === 'STAFF' && (
          <FieldInput
            label="Store code"
            placeholder="e.g. kirikiri-brew"
            value={storeSlug}
            onChange={setStoreSlug}
            helperText="Ask the store owner for their store link — the part after manyorder.app/"
            required
          />
        )}

        <FieldInput label="Full Name" placeholder="Jane Tan" value={fullName} onChange={setFullName} required />
        <FieldInput label="Email Address" type="email" placeholder="you@example.com" value={email} onChange={setEmail} required />
        <FieldInput label="Password" type="password" placeholder="At least 6 characters" value={password} onChange={setPassword} required />
        <FieldInput label="Confirm Password" type="password" placeholder="Repeat your password" value={confirm} onChange={setConfirm} required />

        {error && <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>}

        <Button
          variant="primary"
          fullWidth
          onClick={submit}
          disabled={busy || !fullName || !email || !password || !confirm}
        >
          {busy ? 'Creating account…' : 'Create Account'}
        </Button>

        {role === 'MERCHANT' && (
          <GoogleSignInButton
            onCredential={async (idToken) => {
              try {
                await loginWithGoogle(idToken);
                navigate('/app');
              } catch (e: any) {
                setError(e?.message || 'Google sign-in failed');
              }
            }}
          />
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', textAlign: 'center' }}>
          <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="text-small"
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
