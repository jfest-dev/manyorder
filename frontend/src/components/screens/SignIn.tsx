import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Checkbox } from '../Checkbox';
import { AuthLayout } from '../auth/AuthLayout';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';
import { FieldInput } from '../Field';
import { PasswordField } from '../PasswordField';
import { Button } from '../Button';
import { takeAuthNotice } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useNoindex } from '../../lib/useNoindex';

// Simple, permissive email shape check - enough to catch obviously invalid
// input client-side so we show one friendly message instead of the backend's
// validation text (and never fire both at once).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Match an email inside a longer message so we can turn it into a mailto link.
const EMAIL_IN_TEXT = /[^\s@]+@[^\s@]+\.[^\s@]+/;

/**
 * Render an error message, turning any email address it contains into a mailto
 * link. The suspended-account message carries the support address from the
 * backend config, so the address is never hard-coded here.
 */
function renderError(message: string): React.ReactNode {
  const match = EMAIL_IN_TEXT.exec(message);
  if (!match) return message;
  const email = match[0].replace(/[.,;:]+$/, ''); // drop trailing punctuation
  const start = match.index;
  return (
    <>
      {message.slice(0, start)}
      <a href={`mailto:${email}`} style={{ color: 'inherit' }}>{email}</a>
      {message.slice(start + email.length)}
    </>
  );
}

export function SignIn() {
  const { user, login, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  useNoindex(); // the sign-in page must not be indexed

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A one-time message left by an involuntary sign-out (expired token, or a
  // token/stored-user role disagreement). Read once on mount so it shows just here.
  const [notice] = useState<string | null>(() => takeAuthNotice());

  // Already signed in: don't silently bounce to the app. Offer to continue or to
  // sign out, so a stale or wrong-account session is visible and escapable.
  if (user) {
    return (
      <AuthLayout title="You're already signed in" subtitle={`You're signed in as ${user.email}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button variant="primary" fullWidth onClick={() => navigate('/app')}>Continue</Button>
          <Button variant="secondary" fullWidth onClick={logout}>Log out</Button>
        </div>
      </AuthLayout>
    );
  }

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await login(trimmedEmail, password.trim(), remember);
      navigate('/app');
    } catch (e: any) {
      // Two fixed sign-in messages: 429 once the email is throttled, 401 for a wrong
      // password or unknown email. Other errors (e.g. a suspended account) keep the
      // backend message, which may carry the support address.
      if (e?.status === 429) {
        setError('Too many attempts. Try again in 15 minutes, or reset your password.');
      } else if (e?.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(e?.message || 'Sign in failed');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to ManyOrder"
      subtitle="Create your online order page in minutes"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {notice && (
          <p role="status" className="text-small"
            style={{ background: '#FEF3C7', border: '1px solid #FCD34D', color: '#92400E', borderRadius: '10px', padding: '10px 12px', margin: 0 }}>
            {notice}
          </p>
        )}
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
            <Checkbox checked={remember} onChange={setRemember} ariaLabel="Remember me" />
            Remember me
          </label>
          <button
            type="button"
            className="text-small"
            onClick={() => navigate('/forgot-password')}
            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <div className="text-small" style={{ color: 'var(--error-color)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            <span>{renderError(error)}</span>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Forgot password?
            </button>
          </div>
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

      </div>
    </AuthLayout>
  );
}
