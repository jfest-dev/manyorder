import { memo, useEffect, useRef, useState } from 'react';
import { authApi } from '../../lib/api';

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

// Fixed button box so a render never reflows the form. Width matches the GSI
// renderButton width; height is the "large" button height.
const BUTTON_WIDTH = 356;
const BUTTON_HEIGHT = 44;

/**
 * Renders the Google Identity Services button only when the backend reports a
 * configured GOOGLE_CLIENT_ID (GET /auth/config). Unset -> renders nothing.
 *
 * The button is initialized and drawn exactly once per page load. The render effect
 * depends only on the client id, never on form state or on the callback identity: the
 * latest callback is kept in a ref, so a new inline callback on each parent render can
 * never re-run initialize/renderButton (which is what made the button flicker/resize
 * while typing). The component is memoized so typing in the fields does not re-render it
 * (given a stable onCredential from the parent).
 */
function GoogleSignInButtonInner({ onCredential }: GoogleSignInButtonProps) {
  const [clientId, setClientId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Latest callback, read by the GSI callback without being an effect dependency.
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    authApi
      .config()
      .then((config) => setClientId(config.googleClientId || null))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId) return;

    const render = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !containerRef.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onCredentialRef.current(response.credential),
      });
      google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        width: BUTTON_WIDTH,
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
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
      </div>
      {/* Fixed-size box reserves the space, so (re)drawing the button never shifts layout. */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div ref={containerRef} style={{ width: BUTTON_WIDTH, height: BUTTON_HEIGHT }} />
      </div>
    </div>
  );
}

export const GoogleSignInButton = memo(GoogleSignInButtonInner);
