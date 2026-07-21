import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { AuthLayout, SecurityFooter } from '../auth/AuthLayout';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { FieldInput } from '../Field';
import { PasswordField } from '../PasswordField';
import { Button } from '../Button';
import { useAuth } from '../../context/AuthContext';

export function SignIn() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
      navigate('/app');
    } catch (e: any) {
      setError(e?.message || 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to ManyOrder"
      subtitle="Create your online order page in minutes"
      footer={<SecurityFooter />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <FieldInput
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          required
        />

        <PasswordField
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChange={setPassword}
          required
        />

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

        {error && (
          <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>
        )}

        <Button variant="primary" fullWidth onClick={submit} disabled={busy || !email || !password}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Lock size={14} /> {busy ? 'Signing in…' : 'Sign In'}
          </span>
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
          <p className="text-small" style={{ color: 'var(--text-secondary)', marginBottom: '10px' }}>
            New to ManyOrder?
          </p>
          <Button variant="secondary" fullWidth onClick={() => navigate('/register')}>
            Create Store
          </Button>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
          Demo account: hello@manyorder.com / password123
        </p>
      </div>
    </AuthLayout>
  );
}
