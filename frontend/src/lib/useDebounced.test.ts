// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounced } from './useDebounced';

describe('useDebounced', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounced('a', 300));
    expect(result.current).toBe('a');
  });

  it('collapses a burst of changes into one settled value', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    rerender({ v: 'c' });
    rerender({ v: 'd' });
    // Still the old value until the delay elapses with no further change.
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('d');
  });

  it('restarts the timer on each change (no update mid-burst)', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: 'c' });
    act(() => { vi.advanceTimersByTime(200); }); // 400ms total, but only 200ms since last change
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe('c');
  });
});
