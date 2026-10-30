// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { installZoomLock, VIEWPORT_CONTENT } from './zoomLock';

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
  document.head.querySelectorAll('meta[name="viewport"]').forEach((m) => m.remove());
});

describe('installZoomLock', () => {
  it('sets the zoom-lock viewport meta content', () => {
    cleanup = installZoomLock();
    const meta = document.querySelector('meta[name="viewport"]');
    expect(meta?.getAttribute('content')).toBe(VIEWPORT_CONTENT);
    expect(VIEWPORT_CONTENT).toContain('maximum-scale=1');
    expect(VIEWPORT_CONTENT).toContain('user-scalable=no');
    expect(VIEWPORT_CONTENT).toContain('viewport-fit=cover');
  });

  it('cancels pinch-zoom gesture events while installed, and stops after cleanup', () => {
    cleanup = installZoomLock();
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
      const e = new Event(type, { cancelable: true });
      document.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(true);
    }
    cleanup();
    cleanup = null;
    const after = new Event('gesturestart', { cancelable: true });
    document.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
});
