import { useEffect, useRef, useState } from 'react';
import { authApi } from '../../lib/api';

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

/**
 * Renders the Google Identity Services button only when the backend reports a
 * configured GOOGLE_CLIENT_ID (GET /auth/config). Unset -> renders nothing.
 */
export function GoogleSignInButton({ onCredential }: GoogleSignInButtonProps) {
  const [clientId, setClientId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authApi
      .config()
      .then((config) => setClientId(config.googleClientId || null))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    const render = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !containerRef.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onCredential(response.credential),
      });
      google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width: 356,
        text: 'continue_with',
      });
    };

    if ((window as any).google?.accounts?.id) {
      render();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [clientId, onCredential]);

  if (!clientId) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
      </div>
      <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}
