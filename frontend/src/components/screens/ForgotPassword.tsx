import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { AuthLayout, SecurityFooter } from '../auth/AuthLayout';
import { FieldInput } from '../Field';
import { Button } from '../Button';
import { authApi } from '../../lib/api';

// Simple, permissive email shape check — enough to catch obviously invalid
// input client-side so we show one friendly message instead of the backend's
// validation text (and never fire both at once).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The server returns this same message whether or not the account exists — we
// mirror it here so the confirmation screen reads identically regardless.
const GENERIC_MESSAGE = "If an account exists with that email, we've sent a reset link.";

/**
 * Request a password reset (?route /forgot-password). Enter an email → the
 * server sends a link if the account exists. We never reveal existence: on
 * success the form is replaced by a generic confirmation.
 */
export function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!EMAIL_RE.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    try {
      await authApi.forgotPassword(trimmedEmail);
      setSent(true);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email and we'll send you a reset link"
      footer={<SecurityFooter />}
    >
      {sent ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: 'var(--bg-card-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-medium)',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
              {GENERIC_MESSAGE}
            </p>
          </div>
          <Button variant="secondary" fullWidth onClick={() => navigate('/signin')}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FieldInput
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={setEmail}
            required
          />

          {error && <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>}

          <Button variant="primary" fullWidth onClick={submit} disabled={busy || !email}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <Mail size={14} /> {busy ? 'Sending…' : 'Send reset link'}
            </span>
          </Button>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="text-small"
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Back to sign in
            </button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
