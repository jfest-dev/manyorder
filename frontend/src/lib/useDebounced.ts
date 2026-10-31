import { useEffect, useState } from 'react';

/**
 * The value, but only after it has stopped changing for {@code delayMs}. Rapid
 * changes collapse into one settled value, so an effect keyed on the result fires
 * once at the end of a burst rather than on every intermediate change. Used to keep
 * the checkout from sending a discount-evaluate request on every quick cart or
 * fulfilment change.
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
