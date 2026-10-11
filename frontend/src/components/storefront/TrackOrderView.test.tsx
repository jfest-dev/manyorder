// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const trackOrder = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, storefrontApi: { ...actual.storefrontApi, trackOrder: () => trackOrder() } };
});

import { TrackOrderView } from './TrackOrderView';
import { ApiError } from '../../lib/api';

const RESULT = {
  storeName: 'Kiri Brew', currency: 'SGD', storePhone: '+65 9123 4567',
  orderType: 'PICKUP', notes: null, orderNumbers: [12],
  subtotal: 10, deliveryFee: 0, deliveryFeePending: false, discount: 0, total: 10,
  orders: [{
    orderNumber: 12, kind: 'STANDARD', status: 'PREPARING',
    items: [{ name: 'Latte', quantity: 2, unitPrice: 5, lineSubtotal: 10, modifiers: [], notes: null }],
  }],
};

function renderAt(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/track/${token}`]}>
      <Routes><Route path="/track/:token" element={<TrackOrderView />} /></Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="robots"], meta[name="referrer"]').forEach((m) => m.remove());
  trackOrder.mockReset().mockResolvedValue(RESULT);
});

describe('TrackOrderView', () => {
  it('shows the order, status and total, and sets noindex + no-referrer', async () => {
    renderAt('tok123');

    expect(await screen.findByText('Order #12')).toBeTruthy();
    expect(screen.getByText('2 x Latte')).toBeTruthy();
    expect(screen.getByText('Kiri Brew')).toBeTruthy();

    // Privacy meta tags on the head.
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain('noindex');
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
  });

  it('shows a generic not-found for an unknown token', async () => {
    trackOrder.mockReset().mockRejectedValue(new ApiError(404, 'Order not found.'));
    renderAt('bogus');
    expect(await screen.findByText('Order not found')).toBeTruthy();
  });

  it('Contact opens a WhatsApp chat with the store number and prefilled text, no token', async () => {
    renderAt('tok123');
    const link = await screen.findByRole('link', { name: /Contact Kiri Brew on WhatsApp/i });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/6591234567')).toBe(true);
    expect(decodeURIComponent(href)).toContain("Hi Kiri Brew, I'm checking on order #12.");
    expect(href).not.toContain('tok123'); // never the tracking token
  });

  it('hides the Contact button when the store has no number', async () => {
    trackOrder.mockReset().mockResolvedValue({ ...RESULT, storePhone: null });
    renderAt('tok123');
    await screen.findByText('Order #12');
    expect(screen.queryByRole('link', { name: /on WhatsApp/i })).toBeNull();
  });

  it('shows "To be confirmed" for a pending delivery fee', async () => {
    trackOrder.mockReset().mockResolvedValue({ ...RESULT, orderType: 'DELIVERY', deliveryFee: 0, deliveryFeePending: true });
    renderAt('tok123');
    await screen.findByText('Order #12');
    expect(screen.getByText('To be confirmed')).toBeTruthy();
  });
});
