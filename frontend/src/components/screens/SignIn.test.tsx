// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const login = vi.fn();

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login, loginWithGoogle: vi.fn() }),
}));
// The Google button fetches /auth/config on mount; report no client id so it renders nothing.
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, authApi: { ...actual.authApi, config: () => Promise.resolve({ googleClientId: '' }) } };
});

import { SignIn } from './SignIn';
import { ApiError } from '../../lib/api';

function renderSignIn() {
  render(<MemoryRouter><SignIn /></MemoryRouter>);
}

beforeEach(() => { cleanup(); login.mockReset(); });

describe('SignIn', () => {
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
});
