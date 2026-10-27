// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const login = vi.fn();
const logout = vi.fn();
let authUser: { email: string } | null = null;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: authUser, login, loginWithGoogle: vi.fn(), logout }),
}));
// The Google button fetches /auth/config on mount; report no client id so it renders nothing.
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, authApi: { ...actual.authApi, config: () => Promise.resolve({ googleClientId: '' }) } };
});

import { SignIn } from './SignIn';
import { ApiError, setAuthNotice } from '../../lib/api';

function renderSignIn() {
  render(<MemoryRouter><SignIn /></MemoryRouter>);
}

beforeEach(() => { cleanup(); login.mockReset(); logout.mockReset(); authUser = null; sessionStorage.clear(); });

describe('SignIn', () => {
  it('marks the sign-in page noindex', () => {
    renderSignIn();
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toContain('noindex');
  });

  it('shows a Forgot password link beside the sign-in error', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new ApiError(401,
      "Invalid email or password. If you've tried several times, wait 15 minutes or reset your password."));
    renderSignIn();
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));
    await screen.findByText(/Invalid email or password/);
    expect(screen.getAllByRole('button', { name: 'Forgot password?' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders a suspended-account message with the support address as a mailto link', async () => {
    const user = userEvent.setup();
    // The backend 403 message carries the support address from its config.
    login.mockRejectedValue(new ApiError(403,
      'This account has been suspended. Please contact support at support@manyorder.app.'));
    renderSignIn();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'owner@store.test');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    const link = await screen.findByRole('link', { name: 'support@manyorder.app' });
    expect(link.getAttribute('href')).toBe('mailto:support@manyorder.app');
    // The address is rendered from the backend message, not hard-coded here.
    expect(screen.getByText(/This account has been suspended/)).toBeTruthy();
  });

  it('shows a plain message with no link when the error has no email', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderSignIn();

    await user.type(screen.getByPlaceholderText('you@example.com'), 'owner@store.test');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'nope');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows "You are already signed in" with Continue and Log out when a session exists', async () => {
    const user = userEvent.setup();
    authUser = { email: 'owner@store.test' };
    renderSignIn();

    expect(screen.getByText("You're signed in as owner@store.test")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeTruthy();
    // The sign-in form is not shown.
    expect(screen.queryByPlaceholderText('you@example.com')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalled();
  });

  it('shows the one-time sign-out notice left by an involuntary sign-out', async () => {
    setAuthNotice('You were signed out because your session changed. Please sign in again.');
    renderSignIn();
    expect(screen.getByText('You were signed out because your session changed. Please sign in again.')).toBeTruthy();
    // Shown in the signed-out form (fields present).
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
  });
});
