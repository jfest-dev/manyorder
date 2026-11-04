// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Enforces the button colour rule's scope: the theme colour variable (--sf-accent)
 * may be read for styling by ONLY the Add to cart buttons (StorefrontView,
 * ProductDetailView) and the selected category bubble (StorefrontView). This test
 * fails if any other storefront component starts reading it, which would silently
 * widen the rule (e.g. re-theming Checkout, Place order or the View cart bar).
 */

const DIR = dirname(fileURLToPath(import.meta.url));

// Files allowed to mention --sf-accent: the definer, the root that applies it, the
// two reader components, and the tests. Everything else must not touch it.
const ALLOWED = new Set([
  'storefrontTheme.ts',       // defines the variable + fallback
  'StorefrontApp.tsx',        // sets it on the storefront root
  'StorefrontView.tsx',       // reads it: add buttons + selected category bubble
  'ProductDetailView.tsx',    // reads it: Add to cart
  'storefrontTheme.test.ts',
  'storefrontAccent.test.tsx',
  'storefrontThemeScope.test.ts',
]);

describe('button colour rule — --sf-accent scope', () => {
  it('only the Add to cart buttons and the selected bubble (plus infra/tests) read --sf-accent', () => {
    const offenders: string[] = [];
    for (const name of readdirSync(DIR)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      if (ALLOWED.has(name)) continue;
      const src = readFileSync(join(DIR, name), 'utf8');
      if (src.includes('--sf-accent')) offenders.push(name);
    }
    expect(offenders, `these components must not read --sf-accent: ${offenders.join(', ')}`).toEqual([]);
  });

  it('the two reader components do still read it (guards against an accidental removal)', () => {
    for (const name of ['StorefrontView.tsx', 'ProductDetailView.tsx']) {
      expect(readFileSync(join(DIR, name), 'utf8')).toContain('--sf-accent');
    }
  });
});
