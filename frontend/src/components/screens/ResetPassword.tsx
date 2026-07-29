import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle2 } from 'lucide-react';
import { AuthLayout, SecurityFooter } from '../auth/AuthLayout';
import { PasswordField } from '../PasswordField';
import { Button } from '../Button';
import { authApi } from '../../lib/api';

/**
 * Set a new password from an emailed link (?route /reset-password?token=…).
 * Reads the one-time token from the query string, applies the same min-length
 * and match checks as registration, and redirects to sign in on success. An
 * invalid/expired/used token (400) or a missing token shows a recovery path
 * back to /forgot-password.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      window.setTimeout(() => navigate('/signin'), 1800);
    } catch (e: any) {
      setError(e?.message || 'This reset link is invalid or has expired.');
    } finally {
      setBusy(false);
    }
  };

  // No token in the URL → the link was malformed or opened directly.
  if (!token) {
    return (
      <AuthLayout title="Reset your password" footer={<SecurityFooter />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="text-small" style={{ color: 'var(--error-color)', textAlign: 'center' }}>
            This reset link is invalid or has expired.
          </p>
          <Button variant="primary" fullWidth onClick={() => navigate('/forgot-password')}>
            Request a new link
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a new password for your account"
      footer={<SecurityFooter />}
    >
      {done ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <CheckCircle2 size={40} color="var(--success-color, #16a34a)" />
          <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Password updated. Redirecting you to sign in…
          </p>
          <Button variant="secondary" fullWidth onClick={() => navigate('/signin')}>
            Go to sign in
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <PasswordField
            label="New Password"
            placeholder="At least 6 characters"
            value={password}
            onChange={setPassword}
            required
          />
          <PasswordField
            label="Confirm New Password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={setConfirm}
            required
          />

          {error && <p className="text-small" style={{ color: 'var(--error-color)' }}>{error}</p>}

          <Button variant="primary" fullWidth onClick={submit} disabled={busy || !password || !confirm}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <Lock size={14} /> {busy ? 'Updating…' : 'Update password'}
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
