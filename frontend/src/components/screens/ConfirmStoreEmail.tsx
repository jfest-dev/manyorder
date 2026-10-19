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
  const { isAuthenticated } = useAuth();
  const token = searchParams.get('token') || '';

  const [phase, setPhase] = useState<Phase>(token ? 'confirming' : 'error');
  const [storeName, setStoreName] = useState('');
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!token || attempted.current === token) return;
    attempted.current = token;
    setPhase('confirming');
    (async () => {
      try {
        const res = await storesApi.confirmEmail(token);
        setStoreName(res.storeName);
        setPhase('success');
      } catch {
        setPhase('error');
      }
    })();
  }, [token]);

  if (phase === 'confirming') {
    return (
      <AuthLayout title="Confirming your store email" footer={<SecurityFooter />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <Loader2 size={36} color="var(--text-secondary)" style={{ animation: 'spin 1s linear infinite' }} />
          <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Just a moment while we confirm this address.
          </p>
        </div>
      </AuthLayout>
    );
  }

  if (phase === 'success') {
    return (
      <AuthLayout title="Store email confirmed" footer={<SecurityFooter />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <CheckCircle2 size={40} color="var(--success-color, #16a34a)" />
          <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            {storeName ? `Thanks, the contact email for ${storeName} is confirmed. Order and low-stock alerts will reach this inbox.`
              : 'Thanks, your store email is confirmed.'}
          </p>
          <Button variant="primary" fullWidth onClick={() => navigate(isAuthenticated ? '/app' : '/signin')}>
            {isAuthenticated ? 'Go to dashboard' : 'Go to sign in'}
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Confirmation failed" footer={<SecurityFooter />}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        <XCircle size={40} color="var(--error-color)" />
        <p className="text-small" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          This confirmation link is invalid or has expired. Open your store Settings and use "Send confirmation" to get a fresh link.
        </p>
        <Button variant="primary" fullWidth onClick={() => navigate(isAuthenticated ? '/app' : '/signin')}>
          {isAuthenticated ? 'Go to settings' : 'Go to sign in'}
        </Button>
      </div>
    </AuthLayout>
  );
}
