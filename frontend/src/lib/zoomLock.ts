// Disable pinch and double-tap zoom app-wide while keeping one-finger scrolling,
// taps, text selection and inputs working. The viewport meta covers initial scale;
// CSS touch-action: pan-x pan-y disables the zoom gestures; and because iPhone Safari
// still allows pinch, one guard (installed once at app start) cancels any touch with
// two or more fingers and the Safari gesture events. If a zoom still slips through
// (visualViewport.scale > 1), the viewport tag is re-asserted to snap back to 1.
// Text elsewhere stays in relative units, so the phone's own font-size still applies.

export const VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

function viewportMeta(): HTMLMetaElement {
  let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'viewport');
    document.head.appendChild(meta);
  }
  return meta;
}

/**
 * Install the zoom guard. Idempotent at the meta level; returns a cleanup that
 * removes every listener it added.
 */
export function installZoomLock(): () => void {
  const meta = viewportMeta();
  meta.setAttribute('content', VIEWPORT_CONTENT);

  // Cancel multi-finger touches (pinch) without touching single-finger gestures, so
  // scrolling, taps, selection and inputs are unaffected. Non-passive so
  // preventDefault actually blocks the gesture.
  const cancelMultiTouch = (e: Event) => {
    const touches = (e as TouchEvent).touches;
    if (touches && touches.length >= 2) e.preventDefault();
  };
  // Safari fires gesture* for pinch and never sets touches; cancel those outright.
  const cancelGesture = (e: Event) => e.preventDefault();
  const opts: AddEventListenerOptions = { passive: false };

  document.addEventListener('touchstart', cancelMultiTouch, opts);
  document.addEventListener('touchmove', cancelMultiTouch, opts);
  document.addEventListener('gesturestart', cancelGesture, opts);
  document.addEventListener('gesturechange', cancelGesture, opts);
  document.addEventListener('gestureend', cancelGesture, opts);

  // Reset: if the page ever ends up zoomed in, re-assert the viewport to return to 1.
  const vv = window.visualViewport;
  const onViewportResize = () => {
    if (vv && vv.scale > 1) {
      meta.setAttribute('content', VIEWPORT_CONTENT + ', initial-scale=1');
      meta.setAttribute('content', VIEWPORT_CONTENT);
    }
  };
  vv?.addEventListener('resize', onViewportResize);

  return () => {
    document.removeEventListener('touchstart', cancelMultiTouch);
    document.removeEventListener('touchmove', cancelMultiTouch);
    document.removeEventListener('gesturestart', cancelGesture);
    document.removeEventListener('gesturechange', cancelGesture);
    document.removeEventListener('gestureend', cancelGesture);
    vv?.removeEventListener('resize', onViewportResize);
  };
}
