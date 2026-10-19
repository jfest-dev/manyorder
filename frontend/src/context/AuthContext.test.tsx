// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';

const me = vi.fn();

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, authApi: { ...actual.authApi, me: () => me() } };
});

import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const { user } = useAuth();
  return <span>{user ? (user.verified ? 'verified' : 'unverified') : 'anon'}</span>;
}

beforeEach(() => {
  cleanup();
  me.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe('AuthContext focus re-sync', () => {
  it('re-fetches /auth/me when the window regains focus, clearing the stale verified flag', async () => {
    // A signed-in tab whose cached user is still unverified.
    localStorage.setItem('manyorder_token', 'tok');
    localStorage.setItem('manyorder_user', JSON.stringify({
      userId: 1, fullName: 'Alex', email: 'a@x.com', role: 'MERCHANT', staffStoreId: null, verified: false,
    }));
    me.mockResolvedValue({ verified: true, fullName: 'Alex' });

    render(<AuthProvider><Probe /></AuthProvider>);

    // The mount re-sync flips it to verified.
    expect(await screen.findByText('verified')).toBeTruthy();
    const afterMount = me.mock.calls.length;
    expect(afterMount).toBeGreaterThanOrEqual(1);

    // Focus triggers another /auth/me.
    act(() => { window.dispatchEvent(new Event('focus')); });
    await waitFor(() => expect(me.mock.calls.length).toBeGreaterThan(afterMount));
  });

  it('does not call /auth/me on focus when there is no session', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText('anon')).toBeTruthy();
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(me).not.toHaveBeenCalled();
  });
});
