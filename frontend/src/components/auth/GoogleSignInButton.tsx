import { memo, useEffect, useRef, useState } from 'react';
import { authApi } from '../../lib/api';

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
}

// Fixed button box: full width up to 356, fixed height, clipped so a (re)draw can
// never spill out of the card.
const MAX_WIDTH = 356;
const HEIGHT = 44;
// Google renderButton width is clamped to this range and never exceeds the container.
const MIN_W = 200;
const MAX_W = 400;
// Only a container width change larger than this triggers a (single, debounced) redraw.
const REDRAW_THRESHOLD = 40;
const REDRAW_DEBOUNCE_MS = 150;

/** The width handed to Google's renderButton: the measured container width, clamped
 *  to [200, 400] and never wider than the container itself. */
function buttonWidth(containerWidth: number): number {
  const clamped = Math.min(MAX_W, Math.max(MIN_W, Math.round(containerWidth)));
  return Math.min(clamped, Math.round(containerWidth));
}

/**
 * Google Identity Services button, shown only when GOOGLE_CLIENT_ID is configured.
 *
 * Drawn exactly once per page load, at a width measured from its fixed container and
 * clamped to [200, 400]. The render effect depends only on the client id (never on
 * form state or callback identity: the latest callback lives in a ref), so typing or
 * focus never redraws it. A ResizeObserver redraws at most once (debounced) when the
 * container width changes by more than 40px. Memoized so a parent re-render with a
 * stable callback does not re-render it.
 */
function GoogleSignInButtonInner({ onCredential }: GoogleSignInButtonProps) {
  const [clientId, setClientId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;
  const drawnWidthRef = useRef<number | null>(null);
  const redrawTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    authApi
      .config()
      .then((config) => setClientId(config.googleClientId || null))
      .catch(() => setClientId(null));
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let observer: ResizeObserver | null = null;

    const draw = () => {
      const google = (window as any).google;
      const el = containerRef.current;
      if (!google?.accounts?.id || !el) return;
      const measured = el.getBoundingClientRect().width || MAX_WIDTH;
      const width = buttonWidth(measured);
      drawnWidthRef.current = measured;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onCredentialRef.current(response.credential),
      });
      el.innerHTML = ''; // clear any prior button before a redraw
      google.accounts.id.renderButton(el, {
        theme: 'outline',
        size: 'large',
        width,
        text: 'continue_with',
      });
    };

    const start = () => {
      draw();
      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        observer = new ResizeObserver(() => {
          const el = containerRef.current;
          if (!el || drawnWidthRef.current == null) return;
          const measured = el.getBoundingClientRect().width || MAX_WIDTH;
          if (Math.abs(measured - drawnWidthRef.current) > REDRAW_THRESHOLD) {
            if (redrawTimer.current) clearTimeout(redrawTimer.current);
            redrawTimer.current = setTimeout(draw, REDRAW_DEBOUNCE_MS);
          }
        });
        observer.observe(containerRef.current);
      }
    };

    if ((window as any).google?.accounts?.id) {
      start();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = start;
      document.head.appendChild(script);
    }

    return () => {
      observer?.disconnect();
      if (redrawTimer.current) clearTimeout(redrawTimer.current);
    };
  }, [clientId]);

  if (!clientId) return null;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          ref={containerRef}
          style={{ width: '100%', maxWidth: MAX_WIDTH, height: HEIGHT, overflow: 'hidden', margin: '0 auto' }}
        />
      </div>
    </div>
  );
}

export const GoogleSignInButton = memo(GoogleSignInButtonInner);
