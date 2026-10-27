import { useEffect, useRef, useState } from 'react';
import { checkStoreSlugAvailable } from './api';

export type SlugStatus = 'idle' | 'checking' | 'available' | 'unavailable';

export interface SlugAvailability {
  status: SlugStatus;
  message: string;
  /** Client-side alternatives to offer when the typed link is unavailable. */
  suggestions: string[];
}

const DEBOUNCE_MS = 350;
const AVAILABLE = 'This link is available';
const UNAVAILABLE = "That link isn't available, try another";

/**
 * Debounced store-slug availability for the Create Store and Settings forms.
 * Waits ~350 ms after the last keystroke, then asks the public endpoint. Pass
 * {@code ignore} with the store's current slug in Settings so an unchanged link
 * is not reported as taken by the store itself. The result is advisory only; the
 * server re-checks (and reserves) on save.
 */
export function useSlugAvailability(slug: string, ignore?: string): SlugAvailability {
  const [state, setState] = useState<SlugAvailability>({ status: 'idle', message: '', suggestions: [] });
  const seq = useRef(0);

  const trimmed = (slug || '').trim().toLowerCase();
  const ignoreTrimmed = (ignore || '').trim().toLowerCase();

  useEffect(() => {
    if (!trimmed || trimmed === ignoreTrimmed) {
      setState({ status: 'idle', message: '', suggestions: [] });
      return;
    }
    setState((s) => ({ status: 'checking', message: '', suggestions: s.suggestions }));
    const mySeq = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const available = await checkStoreSlugAvailable(trimmed);
        if (mySeq !== seq.current) return; // a newer keystroke superseded this one
        setState(available
          ? { status: 'available', message: AVAILABLE, suggestions: [] }
          : { status: 'unavailable', message: UNAVAILABLE, suggestions: suggest(trimmed) });
      } catch {
        if (mySeq !== seq.current) return;
        setState({ status: 'idle', message: '', suggestions: [] }); // network hiccup: stay quiet
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, ignoreTrimmed]);

  return state;
}

/** One or two simple alternatives, derived from what was typed. */
function suggest(slug: string): string[] {
  const base = slug.replace(/-+$/, '');
  return [`${base}-2`, `${base}-sg`];
}
