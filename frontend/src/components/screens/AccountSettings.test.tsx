// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const meMock = vi.fn();
const updateMock = vi.fn();
const resendMock = vi.fn();
const refreshMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    accountApi: { ...actual.accountApi, me: () => meMock(), updateProfile: (p: unknown) => updateMock(p) },
    authApi: { ...actual.authApi, resendVerification: () => resendMock() },
  };
});

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ refreshUser: refreshMock }),
}));

import { AccountSettings } from './AccountSettings';

beforeEach(() => {
  cleanup();
  meMock.mockReset().mockResolvedValue({
    userId: 1, fullName: 'Mei', email: 'mei@shop.com', role: 'MERCHANT',
    verified: true, phone: '+6591234567', staffStoreId: null,
  });
  updateMock.mockReset().mockImplementation((p: { fullName: string; phone?: string }) =>
    Promise.resolve({ userId: 1, fullName: p.fullName, email: 'mei@shop.com', role: 'MERCHANT', verified: true, phone: p.phone || null, staffStoreId: null }));
  resendMock.mockReset().mockResolvedValue(undefined);
  refreshMock.mockClear();
});

describe('AccountSettings', () => {
  it('shows the account and saves name + phone, refreshing the session', async () => {
    const user = userEvent.setup();
    render(<AccountSettings />);

    // Loaded state: email read-only with the note, verified badge.
    expect(await screen.findByDisplayValue('mei@shop.com')).toBeTruthy();
    expect(screen.getByText("Changing your login email isn't available yet.")).toBeTruthy();
    expect(screen.getByText('Email verified')).toBeTruthy();

    const nameInput = screen.getByPlaceholderText('Your name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Mei Tan');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ fullName: 'Mei Tan', phone: '+6591234567' }));
    expect(refreshMock).toHaveBeenCalled(); // name propagates without re-login
    expect(await screen.findByText('Account updated.')).toBeTruthy();
  });

  it('offers Resend when the email is not verified', async () => {
    meMock.mockResolvedValue({
      userId: 1, fullName: 'Mei', email: 'mei@shop.com', role: 'MERCHANT',
      verified: false, phone: null, staffStoreId: null,
    });
    const user = userEvent.setup();
    render(<AccountSettings />);

    expect(await screen.findByText('Email not verified')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(resendMock).toHaveBeenCalled());
    expect(await screen.findByText('Verification email sent')).toBeTruthy();
  });
});
