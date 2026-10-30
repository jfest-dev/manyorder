// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { installZoomLock, VIEWPORT_CONTENT } from './zoomLock';

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
  document.head.querySelectorAll('meta[name="viewport"]').forEach((m) => m.remove());
  delete (window as any).visualViewport;
});

function touch(type: string, fingers: number): Event {
  const e = new Event(type, { cancelable: true, bubbles: true });
  Object.defineProperty(e, 'touches', { value: Array.from({ length: fingers }, () => ({})) });
  return e;
}

describe('installZoomLock', () => {
  it('sets the zoom-lock viewport meta content', () => {
    cleanup = installZoomLock();
    expect(document.querySelector('meta[name="viewport"]')?.getAttribute('content')).toBe(VIEWPORT_CONTENT);
    expect(VIEWPORT_CONTENT).toContain('maximum-scale=1');
    expect(VIEWPORT_CONTENT).toContain('user-scalable=no');
  });

  it('cancels multi-finger touches (pinch) but leaves a one-finger touch alone', () => {
    cleanup = installZoomLock();
    for (const type of ['touchstart', 'touchmove']) {
      const two = touch(type, 2);
      document.dispatchEvent(two);
      expect(two.defaultPrevented).toBe(true);

      const one = touch(type, 1);
      document.dispatchEvent(one);
      expect(one.defaultPrevented).toBe(false); // scrolling/taps still work
    }
  });

  it('cancels Safari pinch gesture events, and stops after cleanup', () => {
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

  it('re-asserts the viewport when visualViewport scale slips above 1', () => {
    let resizeHandler: (() => void) | null = null;
    (window as any).visualViewport = {
      scale: 2,
      addEventListener: (_t: string, cb: () => void) => { resizeHandler = cb; },
      removeEventListener: () => {},
    };
    cleanup = installZoomLock();
    const meta = document.querySelector('meta[name="viewport"]')!;
    meta.setAttribute('content', 'tampered');
    resizeHandler?.();
    expect(meta.getAttribute('content')).toBe(VIEWPORT_CONTENT); // snapped back
  });
});

describe('zoom-lock CSS', () => {
  const css = readFileSync(join(import.meta.dirname, '../index.css'), 'utf8');
  it('uses touch-action pan-x pan-y (which blocks pinch), not manipulation', () => {
    expect(css).toContain('touch-action: pan-x pan-y');
    expect(css).not.toContain('touch-action: manipulation');
  });
  it('sets 16px form controls on phones without !important', () => {
    const block = css.slice(css.indexOf('@media (max-width: 767px)'));
    expect(block).toContain('font-size: 16px');
    const inputRule = block.slice(0, block.indexOf('}') + 1);
    expect(inputRule).not.toContain('!important');
  });
});
