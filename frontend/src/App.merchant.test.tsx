// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const logout = vi.fn();
let listImpl: () => Promise<unknown> = () => Promise.reject(new Error('not set'));

// A signed-in MERCHANT.
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 1, fullName: 'Owner', email: 'owner@store.test', role: 'MERCHANT', staffStoreId: null, verified: true },
    isAuthenticated: true,
    logout,
    refreshUser: vi.fn(),
  }),
}));

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>();
  return {
    ...actual,
    storesApi: { ...actual.storesApi, list: () => listImpl() },
    ordersApi: { ...actual.ordersApi, unseenCounts: () => Promise.resolve({}) },
  };
});

import App from './App';
import { ApiError } from './lib/api';
import { ConfirmProvider } from './components/ConfirmDialog';

function renderApp() {
  render(
    <MemoryRouter initialEntries={['/app']}>
      <ConfirmProvider><App /></ConfirmProvider>
    </MemoryRouter>,
  );
}

const SUSPENDED_STORE = {
  id: 1, name: 'Kiri Brew', slug: 'kiri', themeColor: '#000', logoUrl: null, currency: 'SGD',
  businessType: 'Cafe', email: 'hi@kiri.test', phone: '+6581234567', emailVerified: false,
  suspended: true, itemNotesEnabled: false, notifyNewOrderEmail: true, notifyLowStockEmail: false,
  notifyNewOrderWhatsapp: false, notifyUrgentWhatsapp: false, whatsappVerified: false,
  fulfilmentMode: 'BOTH', streetAddress: null, city: null, postalCode: null,
  deliveryFee: null, freeDeliveryThreshold: null, deliveryToBeConfirmedMessage: null,
  storeDescription: null, operatingHours: null, paymentInstruction: null, createdAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  cleanup();
  logout.mockReset();
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList));
});

describe('MerchantApp session/suspension states', () => {
  it('shows a Log out button on the "No store selected" state (store list failed) and signs out', async () => {
    const user = userEvent.setup();
    listImpl = () => Promise.reject(new ApiError(403, 'Merchant role required'));
    renderApp();
    expect(await screen.findByText('No store selected')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
  });

  it('shows the suspended message with the support mailto and a Log out button when the store is suspended', async () => {
    const user = userEvent.setup();
    listImpl = () => Promise.resolve({ stores: [SUSPENDED_STORE], count: 1, limit: 3, supportEmail: 'help@manyorder.test' });
    renderApp();
    expect(await screen.findByText(/Your store has been suspended\. Please contact support at/)).toBeTruthy();
    const link = screen.getByRole('link', { name: 'help@manyorder.test' });
    expect(link.getAttribute('href')).toBe('mailto:help@manyorder.test');
    expect(screen.queryByText('No store selected')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
  });
});
