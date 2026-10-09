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
  storeName: 'Kiri Brew', currency: 'SGD', contactLink: 'http://localhost:3000/kiri',
  orderType: 'PICKUP', notes: null, orderNumbers: [12],
  subtotal: 10, deliveryFee: 0, discount: 0, total: 10,
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
});
