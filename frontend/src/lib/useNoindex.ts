import { useEffect } from 'react';

/**
 * Adds <meta name="robots" content="noindex, nofollow"> to the head for the
 * component's lifetime, then removes it on unmount. For private or app-only pages
 * (sign-in, the signed-in app) that must stay out of search engines.
 */
export function useNoindex() {
  useEffect(() => {
    const el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    el.setAttribute('content', 'noindex, nofollow');
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, []);
}
