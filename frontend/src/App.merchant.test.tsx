// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const logout = vi.fn();

// A signed-in MERCHANT.
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 1, fullName: 'Owner', email: 'owner@store.test', role: 'MERCHANT', staffStoreId: null, verified: true },
    isAuthenticated: true,
    logout,
    refreshUser: vi.fn(),
  }),
}));

// The store list fails to load (e.g. a 403 from an admin token, or a 500), so the
// merchant shell falls back to the "No store selected" placeholder.
vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>();
  return {
    ...actual,
    storesApi: { ...actual.storesApi, list: () => Promise.reject(new actual.ApiError(403, 'Merchant role required')) },
    ordersApi: { ...actual.ordersApi, unseenCounts: () => Promise.resolve({}) },
  };
});

import App from './App';
import { ConfirmProvider } from './components/ConfirmDialog';

beforeEach(() => {
  cleanup();
  logout.mockReset();
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList));
});

describe('MerchantApp — no store selected', () => {
  it('shows a Log out button on the "No store selected" state and signs out', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/app']}>
        <ConfirmProvider><App /></ConfirmProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText('No store selected')).toBeTruthy();
    const logoutBtn = await screen.findByRole('button', { name: 'Log out' });
    await user.click(logoutBtn);
    expect(logout).toHaveBeenCalled();
  });
});
