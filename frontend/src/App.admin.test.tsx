// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// A signed-in PLATFORM_ADMIN.
vi.mock('./context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 1, email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN' },
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

vi.mock('./lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/api')>();
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      metrics: () => Promise.resolve({
        totalMerchants: 0, activeMerchants: 0, suspendedMerchants: 0, archivedMerchants: 0,
        totalOrders: 0, totalCustomers: 0, newMerchantsLast30Days: 0,
      }),
      listMerchants: () => Promise.resolve([]),
    },
  };
});

import App from './App';
import { ConfirmProvider } from './components/ConfirmDialog';

beforeEach(() => {
  cleanup();
  window.matchMedia = window.matchMedia || ((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  } as unknown as MediaQueryList));
});

describe('App routing — PLATFORM_ADMIN at /app', () => {
  it('renders the admin dashboard, not the merchant shell', async () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <ConfirmProvider><App /></ConfirmProvider>
      </MemoryRouter>,
    );
    // Admin console chrome is present...
    expect(await screen.findByText('Platform Admin')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy();
    // ...and the merchant "no store" shell is not.
    expect(screen.queryByText(/No store selected/i)).toBeNull();
    expect(screen.queryByText(/Preview store/i)).toBeNull();
  });
});
