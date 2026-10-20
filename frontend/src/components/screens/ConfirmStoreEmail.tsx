import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AuthLayout, SecurityFooter } from '../auth/AuthLayout';
import { Button } from '../Button';
import { storesApi } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

type Phase = 'confirming' | 'success' | 'error';

/**
 * Confirm a store's contact email from the link in the confirmation mail
 * (/confirm-store-email?token=…). Submits the token automatically on mount.
 * An invalid, expired or used token shows a generic error with a way to resend
 * (from the store's Settings).
 */
export function ConfirmStoreEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const token = searchParams.get('token') || '';
  // The confirmed value is the store's contact email, which often differs from the
  // owner's login email, so it can't reliably tell us whether the right person is
  // signed in. We fall back to the session role: a store dashboard is only useful
  // to a MERCHANT or STAFF session, never to a platform admin or a signed-out tab.
  const canDashboard = user?.role === 'MERCHANT' || user?.role === 'STAFF';

  const [phase, setPhase] = useState<Phase>(token ? 'confirming' : 'error');
  const [storeName, setStoreName] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!token || attempted.current === token) return;
    attempted.current = token;
    setPhase('confirming');
    (async () => {
      try {
        const res = await storesApi.confirmEmail(token);
        setStoreName(res.storeName);
        setConfirmedEmail(res.email);
        setPhase('success');
      } catch {
        setPhase('error');
      }
    })();
  }, [token]);

  if (phase === 'confirming') {
    return (
      <AuthLayout title="Confirming your store email" footer={<SecurityFooter />}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Loader2 size={36} color="var(--text-secondary)" style={{ animation: 'spin 1s linear infinite' }} />
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
            {confirmedEmail && storeName
              ? `${confirmedEmail} will now receive notifications for ${storeName}.`
              : 'Your store email is confirmed.'}
          </p>
          <Button variant="primary" fullWidth onClick={() => navigate(canDashboard ? '/app' : '/signin')}>
            {canDashboard ? 'Go to dashboard' : 'Go to sign in'}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="This link didn't work" footer={<SecurityFooter />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        <XCircle size={40} color="var(--error-color)" />
        <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          It may have expired or already been used. Send a new confirmation from Settings.
        </p>
        <Button variant="primary" fullWidth onClick={() => navigate(canDashboard ? '/app' : '/signin')}>
          {canDashboard ? 'Go to settings' : 'Go to sign in'}
        </Button>
      </div>
    </AuthLayout>
  );
}
