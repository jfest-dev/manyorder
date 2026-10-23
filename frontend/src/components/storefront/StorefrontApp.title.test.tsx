// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const getStore = vi.fn();

// Keep the test focused on the title effect, not the full storefront render.
vi.mock('./StorefrontView', () => ({ StorefrontView: () => null }));
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    storefrontApi: {
      ...actual.storefrontApi,
      getStore: (slug: string) => getStore(slug),
      getProducts: () => Promise.resolve([]),
      getOffers: () => Promise.resolve([]),
    },
  };
});

import { StorefrontApp } from './StorefrontApp';

const STORE = {
  id: 7, name: 'Kiri Brew', slug: 'kiri', storeDescription: null, address: null,
  operatingHours: null, currency: 'SGD', themeColor: null, logoUrl: null, phoneNumber: null,
  paymentInstruction: null, deliveryFee: null, deliveryFeeConfigured: false,
  freeDeliveryThreshold: null, deliveryToBeConfirmedMessage: null, fulfilmentMode: 'BOTH',
  itemNotesEnabled: false, totalItemsSold: 0,
} as unknown as Parameters<typeof getStore>[0];

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/${slug}`]}>
      <Routes>
        <Route path="/:slug/*" element={<StorefrontApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  getStore.mockReset().mockResolvedValue(STORE);
  document.title = 'ManyOrder';
});

describe('StorefrontApp document.title', () => {
  it('sets the title to the shop name then ManyOrder', async () => {
    renderAt('kiri');
    await waitFor(() => expect(document.title).toBe('Kiri Brew · ManyOrder'));
  });

  it('restores the default title when leaving the storefront', async () => {
    const view = renderAt('kiri');
    await waitFor(() => expect(document.title).toBe('Kiri Brew · ManyOrder'));
    view.unmount();
    expect(document.title).toBe('ManyOrder');
  });
});
