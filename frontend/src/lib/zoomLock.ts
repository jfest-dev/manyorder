// Disable pinch and double-tap zoom app-wide. The viewport meta covers initial
// scale; iPhone Safari ignores it for pinch, so we also cancel the Safari gesture
// events. Registered once at app start (see main.tsx). Text stays in relative units
// elsewhere, so the phone's own font-size setting still applies.

export const VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

/**
 * Ensure the zoom-lock viewport meta and cancel Safari pinch-zoom gestures. Idempotent
 * at the meta level; returns a cleanup that removes the listeners.
 */
export function installZoomLock(): () => void {
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', VIEWPORT_CONTENT);

  // Non-passive so preventDefault actually blocks the pinch gesture on iOS Safari.
  const cancel = (e: Event) => e.preventDefault();
  const opts: AddEventListenerOptions = { passive: false };
  document.addEventListener('gesturestart', cancel, opts);
  document.addEventListener('gesturechange', cancel, opts);
  document.addEventListener('gestureend', cancel, opts);

  return () => {
    document.removeEventListener('gesturestart', cancel);
    document.removeEventListener('gesturechange', cancel);
    document.removeEventListener('gestureend', cancel);
  };
}
