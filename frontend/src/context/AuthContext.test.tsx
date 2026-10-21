// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const me = vi.fn();
const login = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    authApi: { ...actual.authApi, me: () => me(), login: (...a: unknown[]) => login(...a) },
  };
});

import { AuthProvider, useAuth } from './AuthContext';
import { getToken, takeAuthNotice } from '../lib/api';

function Probe() {
  const { user, login: doLogin } = useAuth();
  return (
    <div>
      <span data-testid="who">{user ? `${user.role}:${user.verified ? 'verified' : 'unverified'}` : 'anon'}</span>
      <button onClick={() => doLogin('a@x.com', 'pw', true)}>login-remember</button>
    </div>
  );
}

const MERCHANT = { userId: 1, fullName: 'Alex', email: 'a@x.com', role: 'MERCHANT', staffStoreId: null };

beforeEach(() => {
  cleanup();
  me.mockReset();
  login.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/', href: '' } });
});

function seed(storage: Storage, user: Record<string, unknown>, token: string) {
  storage.setItem('manyorder_token', token);
  storage.setItem('manyorder_user', JSON.stringify(user));
}

describe('AuthContext session reconcile', () => {
  it('rebuilds from /auth/me on mount, keeps a matching role, clears a stale verified flag', async () => {
    seed(localStorage, { ...MERCHANT, verified: false }, 'merchant-tok');
    me.mockResolvedValue({ ...MERCHANT, verified: true, token: 'merchant-tok' });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('MERCHANT:verified')).toBeTruthy();
  });

  it('signs out when the token role disagrees with the stored user (admin token, merchant stored user)', async () => {
    seed(localStorage, { ...MERCHANT, verified: true }, 'merchant-tok');
    me.mockResolvedValue({ userId: 9, fullName: 'Admin', email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN', staffStoreId: null, verified: true, token: 'x' });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('anon'));
    expect(getToken()).toBeNull();
    expect(takeAuthNotice()).toBe('You were signed out because your session changed. Please sign in again.');
  });

  it('does not call /auth/me on focus when there is no session', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByTestId('who').textContent).toBe('anon');
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(me).not.toHaveBeenCalled();
  });
});

describe('AuthContext two-tab isolation', () => {
  // /auth/me reflects the token the tab actually sends.
  const meByToken = () =>
    getToken() === 'admin-tok'
      ? Promise.resolve({ userId: 9, fullName: 'Admin', email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN', staffStoreId: null, verified: true, token: 'admin-tok' })
      : Promise.resolve({ ...MERCHANT, verified: true, token: 'merchant-tok' });

  it('a session-only admin tab keeps admin even though a remembered merchant login is in localStorage, across focus', async () => {
    // Tab B: its own sessionStorage admin login; localStorage holds tab A's remembered merchant login.
    seed(localStorage, { ...MERCHANT, verified: true }, 'merchant-tok');
    seed(sessionStorage, { userId: 9, fullName: 'Admin', email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN', staffStoreId: null, verified: true }, 'admin-tok');
    me.mockImplementation(meByToken);

    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('PLATFORM_ADMIN:verified')).toBeTruthy();
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(me.mock.calls.length).toBeGreaterThan(0));
    expect(screen.getByTestId('who').textContent).toBe('PLATFORM_ADMIN:verified'); // not flipped to merchant
  });

  it('a remembered-only merchant tab keeps merchant across focus', async () => {
    // Tab A: no session of its own; the remembered merchant login lives in localStorage.
    seed(localStorage, { ...MERCHANT, verified: true }, 'merchant-tok');
    me.mockImplementation(meByToken);

    render(<AuthProvider><Probe /></AuthProvider>);
    expect(await screen.findByText('MERCHANT:verified')).toBeTruthy();
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(me.mock.calls.length).toBeGreaterThan(0));
    expect(screen.getByTestId('who').textContent).toBe('MERCHANT:verified');
  });

  it('a platform admin login is never written to localStorage, even with Remember me ticked', async () => {
    login.mockResolvedValue({ userId: 9, fullName: 'Admin', email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN', staffStoreId: null, verified: true, token: 'admin-tok' });
    me.mockResolvedValue({ userId: 9, fullName: 'Admin', email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN', staffStoreId: null, verified: true, token: 'admin-tok' });
    const user = userEvent.setup();

    render(<AuthProvider><Probe /></AuthProvider>);
    await user.click(screen.getByText('login-remember')); // remember = true

    await waitFor(() => expect(screen.getByTestId('who').textContent).toBe('PLATFORM_ADMIN:verified'));
    expect(sessionStorage.getItem('manyorder_token')).toBe('admin-tok');
    expect(localStorage.getItem('manyorder_token')).toBeNull(); // never remembered
  });
});
