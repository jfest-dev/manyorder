// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, waitFor, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

/**
 * Proves the store accent is wired only where the rule allows: the Add to cart
 * button carries --sf-accent (the exact saved colour, no gate), while the offer/
 * voucher text and the header keep their original colour. The maths is covered by
 * storefrontTheme.test.ts and the allowed-reader list by storefrontThemeScope.test.ts;
 * this guards the wiring in the real storefront render.
 */

const getStore = vi.fn();
const getProducts = vi.fn();
const getOffers = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    storefrontApi: {
      ...actual.storefrontApi,
      getStore: (slug: string) => getStore(slug),
      getProducts: () => getProducts(),
      getOffers: () => getOffers(),
    },
  };
});

import { StorefrontApp } from './StorefrontApp';

const baseStore = {
  id: 7, name: 'Kiri Brew', slug: 'kiri', storeDescription: null, address: null,
  operatingHours: null, currency: 'SGD', themeColor: null as string | null, logoUrl: null, phoneNumber: null,
  paymentInstruction: null, deliveryFee: null, deliveryFeeConfigured: false,
  freeDeliveryThreshold: null, deliveryToBeConfirmedMessage: null, fulfilmentMode: 'BOTH',
  itemNotesEnabled: false, totalItemsSold: 0,
};

const PRODUCT = {
  id: 1, merchantId: 7, name: 'Latte', description: null, price: 6, salePrice: null,
  saleStartsAt: null, saleEndsAt: null, onSale: false, effectivePrice: 6, isActive: true,
  categoryId: null, categoryName: null, categoryDisplayOrder: null, stock: 10, sku: null,
  photoUrl: null, preOrder: false, preOrderReadyDate: null, preOrderReadyTimeStart: null,
  preOrderReadyTimeEnd: null, preOrderNote: null, modifierGroups: [], unitsSold: 0,
  createdAt: '2026-01-01T00:00:00',
};

const OFFER = {
  code: 'SAVE10', name: 'Ten off', type: 'PERCENTAGE' as const, value: 10, minSpend: null,
  firstOrderOnly: false, appliesToDelivery: false, storeWide: true, productIds: [],
  scopeLabel: 'All products', endsAt: null,
};

function renderAt(themeColor: string | null) {
  getStore.mockResolvedValue({ ...baseStore, themeColor });
  return render(
    <MemoryRouter initialEntries={['/kiri']}>
      <Routes>
        <Route path="/:slug/*" element={<StorefrontApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

/** The storefront root is the mobile-width panel; read the --sf-accent it sets. */
function rootAccent(container: HTMLElement): string {
  const root = container.querySelector('[style*="--sf-accent"]') as HTMLElement | null;
  return root?.style.getPropertyValue('--sf-accent').trim() ?? '';
}

beforeEach(() => {
  cleanup();
  getStore.mockReset();
  getProducts.mockReset().mockResolvedValue([PRODUCT]);
  getOffers.mockReset().mockResolvedValue([OFFER]);
});

describe('storefront accent wiring', () => {
  it('a valid saved colour becomes the root accent exactly; the add button uses it, the offer text does not', async () => {
    const { container } = renderAt('#1D4ED8');
    await screen.findByText('Latte');

    // Root carries the exact saved colour, not a darkened/remapped one.
    expect(rootAccent(container)).toBe('#1D4ED8');

    // The add (+) button background reads the accent variable.
    const addBtn = screen.getByRole('button', { name: /add/i });
    expect(addBtn.style.background).toContain('var(--sf-accent');

    // The offer headline (voucher text) keeps the brand colour, never the accent.
    const offerLabel = screen.getByText('10% off');
    expect(offerLabel.style.color).toBe('var(--primary-solid)');
    expect(offerLabel.style.color).not.toContain('sf-accent');

    // The header uses the raw theme colour directly (unchanged behaviour).
    const header = container.querySelector('[style*="background: rgb(29, 78, 216)"], [style*="#1D4ED8"]');
    expect(header).toBeTruthy();
  });

  it('a mid-bright saved colour is used exactly, with no gate (no fallback to black)', async () => {
    const { container } = renderAt('#EC4899'); // the old gate would have sent this to black
    await screen.findByText('Latte');
    expect(rootAccent(container)).toBe('#EC4899');
    // Offer text still untouched.
    expect(screen.getByText('10% off').style.color).toBe('var(--primary-solid)');
  });

  it('no saved colour (or invalid) falls back to the no-theme black at the root', async () => {
    const { container } = renderAt(null);
    await screen.findByText('Latte');
    expect(rootAccent(container)).toBe('var(--primary-solid)');
  });
});
