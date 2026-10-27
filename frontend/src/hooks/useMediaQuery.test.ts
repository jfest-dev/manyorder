// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

type Listener = (e: { matches: boolean }) => void;

/** Controllable window.matchMedia stub (jsdom has none) that can emit changes. */
function installMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: initial,
    media: '',
    onchange: null,
    addEventListener: (_: string, l: Listener) => listeners.add(l),
    removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    addListener: (l: Listener) => listeners.add(l),
    removeListener: (l: Listener) => listeners.delete(l),
    dispatchEvent: () => false,
  };
  window.matchMedia = ((q: string) => { mql.media = q; return mql; }) as unknown as typeof window.matchMedia;
  return {
    emit(next: boolean) {
      mql.matches = next;
      listeners.forEach((l) => l({ matches: next }));
    },
  };
}

describe('useMediaQuery', () => {
  it('returns true when the query matches initially', () => {
    installMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(true);
  });

  it('returns false when the query does not match', () => {
    installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);
  });

  it('updates when the match state changes', () => {
    const ctl = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
    expect(result.current).toBe(false);
    act(() => ctl.emit(true));
    expect(result.current).toBe(true);
  });
});
