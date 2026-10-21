// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';

const me = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, authApi: { ...actual.authApi, me: () => me() } };
});

import { AuthProvider, useAuth } from './AuthContext';
import { getToken, takeAuthNotice } from '../lib/api';

function Probe() {
  const { user } = useAuth();
  return <span>{user ? `${user.role}:${user.verified ? 'verified' : 'unverified'}` : 'anon'}</span>;
}

const MERCHANT = { userId: 1, fullName: 'Alex', email: 'a@x.com', role: 'MERCHANT', staffStoreId: null };

beforeEach(() => {
  cleanup();
  me.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  // jsdom throws on real navigation; make location a plain settable object.
  Object.defineProperty(window, 'location', { configurable: true, value: { pathname: '/', href: '' } });
});

function signIn(storage: Storage, user: Record<string, unknown>) {
  storage.setItem('manyorder_token', 'tok');
  storage.setItem('manyorder_user', JSON.stringify(user));
}

describe('AuthContext session reconcile', () => {
  it('rebuilds from /auth/me on mount and keeps a matching role, clearing a stale verified flag', async () => {
    signIn(localStorage, { ...MERCHANT, verified: false });
    me.mockResolvedValue({ ...MERCHANT, verified: true, token: 'tok' });

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(await screen.findByText('MERCHANT:verified')).toBeTruthy();
    expect(me.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('re-syncs on window focus', async () => {
    signIn(localStorage, { ...MERCHANT, verified: true });
    me.mockResolvedValue({ ...MERCHANT, verified: true, token: 'tok' });
    render(<AuthProvider><Probe /></AuthProvider>);
    await screen.findByText('MERCHANT:verified');
    const afterMount = me.mock.calls.length;
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(me.mock.calls.length).toBeGreaterThan(afterMount));
  });

  it('signs out when the token role disagrees with the stored user (admin token, merchant stored user)', async () => {
    // Stored user says MERCHANT, but /auth/me (driven by the token) says PLATFORM_ADMIN.
    signIn(localStorage, { ...MERCHANT, verified: true });
    me.mockResolvedValue({ userId: 9, fullName: 'Admin', email: 'admin@manyorder.app', role: 'PLATFORM_ADMIN', staffStoreId: null, verified: true, token: 'tok' });

    render(<AuthProvider><Probe /></AuthProvider>);

    // The session is cleared, not switched to the admin app.
    await waitFor(() => expect(screen.getByText('anon')).toBeTruthy());
    expect(getToken()).toBeNull();
    expect(localStorage.getItem('manyorder_user')).toBeNull();
    expect(takeAuthNotice()).toBe('You were signed out because your session changed. Please sign in again.');
  });

  it('does not call /auth/me on focus when there is no session', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('anon')).toBeTruthy();
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(me).not.toHaveBeenCalled();
  });
});
