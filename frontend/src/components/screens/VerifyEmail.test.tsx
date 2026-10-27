// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const verifyEmail = vi.fn();
const refreshUser = vi.fn();
let authUser: { role: string; email: string } | null = null;

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, authApi: { ...actual.authApi, verifyEmail: (t: string) => verifyEmail(t) } };
});
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: authUser, refreshUser }) }));

import { VerifyEmail } from './VerifyEmail';

function renderAt(token: string) {
  render(<MemoryRouter initialEntries={[`/verify-email?token=${token}`]}><VerifyEmail /></MemoryRouter>);
}

beforeEach(() => {
  cleanup();
  verifyEmail.mockReset().mockResolvedValue({ email: 'owner@login.test' });
  refreshUser.mockReset();
  authUser = null;
});

describe('VerifyEmail page', () => {
  it('offers "Go to dashboard" when the confirmed email is the signed-in account', async () => {
    authUser = { role: 'MERCHANT', email: 'owner@login.test' };
    renderAt('good');
    expect(await screen.findByText('Email confirmed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeTruthy();
    expect(screen.queryByText(/different account/)).toBeNull();
  });

  it('matches case-insensitively', async () => {
    verifyEmail.mockResolvedValue({ email: 'Owner@Login.test' });
    authUser = { role: 'MERCHANT', email: 'owner@login.test' };
    renderAt('good');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeTruthy();
  });

  it('shows the different-account note and "Go to sign in" when a different user is signed in', async () => {
    verifyEmail.mockResolvedValue({ email: 'someone-else@test.com' });
    authUser = { role: 'MERCHANT', email: 'owner@login.test' };
    renderAt('good');
    await screen.findByText('Email confirmed');
    expect(screen.getByText("You're signed in as owner@login.test. This confirmation was for a different account.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to sign in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to dashboard' })).toBeNull();
  });

  it('offers "Go to sign in" with no note when there is no session', async () => {
    authUser = null;
    renderAt('good');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to sign in' })).toBeTruthy();
    expect(screen.queryByText(/different account/)).toBeNull();
  });

  it('shows the shared failure copy for a bad token', async () => {
    verifyEmail.mockRejectedValue(new Error('invalid'));
    renderAt('bad');
    expect(await screen.findByText("This link didn't work")).toBeTruthy();
    expect(screen.getByText('It may have expired, or you may have already confirmed this email. If not, send a new confirmation from Settings.')).toBeTruthy();
  });
});
