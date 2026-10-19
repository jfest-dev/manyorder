// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const confirmEmail = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, storesApi: { ...actual.storesApi, confirmEmail: (t: string) => confirmEmail(t) } };
});
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));

import { ConfirmStoreEmail } from './ConfirmStoreEmail';

function renderAt(token: string) {
  render(<MemoryRouter initialEntries={[`/confirm-store-email?token=${token}`]}><ConfirmStoreEmail /></MemoryRouter>);
}

beforeEach(() => {
  cleanup();
  confirmEmail.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe('ConfirmStoreEmail page', () => {
  it('confirms a valid token and names the address and store', async () => {
    confirmEmail.mockResolvedValue({ storeName: 'Kiri Brew', email: 'hi@kiri.test' });
    renderAt('good-token');
    expect(await screen.findByText('Email confirmed')).toBeTruthy();
    expect(screen.getByText('hi@kiri.test will now receive notifications for Kiri Brew.')).toBeTruthy();
    expect(confirmEmail).toHaveBeenCalledWith('good-token');
  });

  it('offers "Go to dashboard" when this tab has a session', async () => {
    localStorage.setItem('manyorder_token', 'tok'); // a signed-in tab
    confirmEmail.mockResolvedValue({ storeName: 'Kiri Brew', email: 'hi@kiri.test' });
    renderAt('good-token');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to sign in' })).toBeNull();
  });

  it('offers "Go to sign in" when this tab has no session (new tab, Remember me off)', async () => {
    confirmEmail.mockResolvedValue({ storeName: 'Kiri Brew', email: 'hi@kiri.test' });
    renderAt('good-token');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to sign in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to dashboard' })).toBeNull();
  });

  it('shows a generic failure that points to Settings for a bad token', async () => {
    confirmEmail.mockRejectedValue(new Error('invalid'));
    renderAt('bad-token');
    expect(await screen.findByText("This link didn't work")).toBeTruthy();
    expect(screen.getByText(/Send a new confirmation from Settings/)).toBeTruthy();
  });
});
