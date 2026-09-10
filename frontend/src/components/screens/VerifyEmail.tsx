import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AuthLayout, SecurityFooter } from '../auth/AuthLayout';
import { Button } from '../Button';
import { authApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type Phase = 'verifying' | 'success' | 'error';

/**
 * Confirm an email from the link in the verification mail
 * (/verify-email?token=…). The link is a single-tap action, so we submit the
 * token automatically on mount. On success we refresh the current session (if
 * any) so the dashboard nag banner clears, then offer a way onward. An
 * invalid, expired, or already-used token shows a clear recovery path.
 */
export function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, refreshUser } = useAuth();
  const token = searchParams.get('token') || '';

  const [phase, setPhase] = useState<Phase>(token ? 'verifying' : 'error');
  // Remember which token we've already submitted, so StrictMode's double-invoke
  // is deduped but a genuinely new token still triggers a fresh attempt.
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!token || attempted.current === token) return;
    attempted.current = token;
    setPhase('verifying');
    (async () => {
      try {
        await authApi.verifyEmail(token);
        setPhase('success');
        void refreshUser();
      } catch {
        setPhase('error');
      }
    })();
  }, [token, refreshUser]);

  if (phase === 'verifying') {
    return (
      <AuthLayout title="Confirming your email" footer={<SecurityFooter />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <Loader2 size={36} color="var(--text-secondary)" style={{ animation: 'spin 1s linear infinite' }} />
          <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Just a moment while we confirm your email address.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (phase === 'success') {
    return (
      <AuthLayout title="Email confirmed" footer={<SecurityFooter />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <CheckCircle2 size={40} color="var(--success-color, #16a34a)" />
          <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Thanks, your email is verified. You are all set.
          </p>
          <Button variant="primary" fullWidth onClick={() => navigate(isAuthenticated ? '/app' : '/signin')}>
            {isAuthenticated ? 'Go to dashboard' : 'Go to sign in'}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // error (bad/expired/used token, or no token at all)
  return (
    <AuthLayout title="Verification failed" footer={<SecurityFooter />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        <XCircle size={40} color="var(--error-color)" />
        <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          This verification link is invalid or has expired. Sign in and use the
          banner at the top of your dashboard to send a fresh link.
        </p>
        <Button variant="primary" fullWidth onClick={() => navigate(isAuthenticated ? '/app' : '/signin')}>
          {isAuthenticated ? 'Go to dashboard' : 'Go to sign in'}
        </Button>
      </div>
    </AuthLayout>
  );
}
