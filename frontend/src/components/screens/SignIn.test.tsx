// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const login = vi.fn();
const logout = vi.fn();
const loginWithGoogle = vi.fn(); // stable across renders (module-level)
let authUser: { email: string } | null = null;

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: authUser, login, loginWithGoogle, logout }),
}));
// The Google button fetches /auth/config on mount; configMock drives the client id
// (empty by default so the button renders nothing).
const configMock = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, authApi: { ...actual.authApi, config: () => configMock() } };
});

import { SignIn } from './SignIn';
import { ApiError, setAuthNotice } from '../../lib/api';

function renderSignIn() {
  render(<MemoryRouter><SignIn /></MemoryRouter>);
}

beforeEach(() => {
  cleanup();
  login.mockReset(); logout.mockReset(); loginWithGoogle.mockReset();
  configMock.mockReset().mockResolvedValue({ googleClientId: '' });
  authUser = null; sessionStorage.clear();
});

describe('SignIn', () => {
  it('marks the sign-in page noindex', () => {
    renderSignIn();
    const robots = document.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toContain('noindex');
  });

  it('shows the plain 401 message and a Forgot password link beside the error', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new ApiError(401, 'Invalid email or password'));
    renderSignIn();
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));
    await screen.findByText('Invalid email or password.');
    expect(screen.getAllByRole('button', { name: 'Forgot password?' }).length).toBeGreaterThanOrEqual(1);
  });

  it('shows the too-many-attempts message on a 429, keeping the Forgot password link', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new ApiError(429, 'Too many attempts. Try again in 15 minutes, or reset your password.'));
    renderSignIn();
    await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In/i }));
    await screen.findByText('Too many attempts. Try again in 15 minutes, or reset your password.');
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

    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
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

  it('draws the Google button once and never re-draws or resizes it while typing', async () => {
    const user = userEvent.setup();
    configMock.mockResolvedValue({ googleClientId: 'test-client-id' });
    const renderButton = vi.fn();
    (window as any).google = { accounts: { id: { initialize: vi.fn(), renderButton } } };
    try {
      renderSignIn();
      // Drawn exactly once, after the client id resolves.
      await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(1));
      const container = renderButton.mock.calls[0][0] as HTMLElement;
      // Fixed box: full width capped at 356, so a draw never reflows the card.
      expect(container.style.maxWidth).toBe('356px');
      expect(container.style.height).toBe('44px');
      const boxBefore = { width: container.style.width, maxWidth: container.style.maxWidth, height: container.style.height };

      await user.type(screen.getByPlaceholderText('you@example.com'), 'a@b.com');
      await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');

      // Typing never re-initializes/redraws the button, and its box never resizes.
      expect(renderButton).toHaveBeenCalledTimes(1);
      expect({ width: container.style.width, maxWidth: container.style.maxWidth, height: container.style.height }).toEqual(boxBefore);
    } finally {
      delete (window as any).google;
    }
  });

  it('gives the email and password fields standard autocomplete attributes', async () => {
    renderSignIn();
    const email = await screen.findByPlaceholderText('you@example.com');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(screen.getByPlaceholderText('Enter your password').getAttribute('autocomplete')).toBe('current-password');
  });
});
