// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { OrderConfirmationView } from './OrderConfirmationView';
import type { GuestCheckoutResult, PublicStoreResponse } from '../../lib/api';

const TOKEN = 'tracktok123';

const result = {
  deliveryFeePending: false, orderGroupId: null, orderId: 12, storeName: 'Kiri Brew', storePhone: '+6591234567',
  paymentInstruction: null, paymentMethod: null, customerName: 'Guest', fulfilmentMethod: 'PICKUP',
  deliveryAddress: null, notes: null, orderStatus: 'PENDING', paymentStatus: 'UNPAID',
  subtotal: 10, deliveryFee: 0, discountAmount: 0, deliveryDiscount: 0, freeDelivery: false, discountCode: null,
  totalAmount: 10, createdAt: '2026-10-09T10:00:00',
  items: [{ productName: 'Latte', quantity: 2, unitPrice: 5, subtotal: 10, modifiers: [], notes: null }],
  orders: [{
    orderId: 12, kind: 'STANDARD', orderStatus: 'PENDING', paymentStatus: 'UNPAID',
    subtotal: 10, deliveryFee: 0, discountAmount: 0, deliveryDiscount: 0, freeDelivery: false, totalAmount: 10,
    items: [{ productName: 'Latte', quantity: 2, unitPrice: 5, subtotal: 10, modifiers: [], notes: null }],
  }],
  trackingToken: TOKEN,
} as unknown as GuestCheckoutResult;

const store = { currency: 'SGD', phoneNumber: '+6591234567', name: 'Kiri Brew', slug: 'kiri' } as unknown as PublicStoreResponse;

beforeEach(() => cleanup());

describe('OrderConfirmationView tracking link', () => {
  it('shows a copyable tracking link and the save/screenshot copy', () => {
    render(<OrderConfirmationView result={result} store={store} onBackToShop={() => {}} />);

    expect(screen.getByLabelText('Copy tracking link')).toBeTruthy();
    expect(screen.getByText(new RegExp(`/track/${TOKEN}`))).toBeTruthy();
    expect(screen.getByText('Save or screenshot this page. Use this link to check your order status anytime.')).toBeTruthy();
  });

  it('does not put the tracking link in the WhatsApp message', () => {
    render(<OrderConfirmationView result={result} store={store} onBackToShop={() => {}} />);
    const wa = screen.getByRole('link', { name: /Message on WhatsApp/ });
    const href = wa.getAttribute('href') ?? '';
    expect(href).not.toContain(TOKEN);
    expect(href).not.toContain('/track/');
  });
});
