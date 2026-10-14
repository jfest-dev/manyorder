/**
 * Test helper: stub window.matchMedia (jsdom has none) so components using
 * useMediaQuery render. Pass true to emulate a phone: max-width queries then
 * match and min-width queries do not.
 */
export function mockMatchMedia(isMobile: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: isMobile ? /max-width/.test(query) : /min-width/.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
