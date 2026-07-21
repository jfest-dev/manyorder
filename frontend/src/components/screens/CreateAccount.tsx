import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout, SecurityFooter } from '../auth/AuthLayout';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { FieldInput } from '../Field';
import { Button } from '../Button';
import { useAuth } from '../../context/AuthContext';

export function CreateAccount() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role: 'MERCHANT',
      });
      navigate('/app');
    } catch (e: any) {
      setError(e?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up your account first — your store comes next"
      footer={<SecurityFooter />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
