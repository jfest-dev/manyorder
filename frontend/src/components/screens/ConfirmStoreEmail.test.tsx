// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const confirmEmail = vi.fn();
let authUser: { role: string; email: string } | null = null;

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, storesApi: { ...actual.storesApi, confirmEmail: (t: string) => confirmEmail(t) } };
});
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: authUser }) }));

import { ConfirmStoreEmail } from './ConfirmStoreEmail';

function renderAt(token: string) {
  render(<MemoryRouter initialEntries={[`/confirm-store-email?token=${token}`]}><ConfirmStoreEmail /></MemoryRouter>);
}

beforeEach(() => {
  cleanup();
  confirmEmail.mockReset().mockResolvedValue({ storeName: 'Kiri Brew', email: 'hi@kiri.test' });
  authUser = null;
});

describe('ConfirmStoreEmail page', () => {
  it('confirms a valid token and names the address and store', async () => {
    renderAt('good-token');
    expect(await screen.findByText('Email confirmed')).toBeTruthy();
    expect(screen.getByText('hi@kiri.test will now receive notifications for Kiri Brew.')).toBeTruthy();
    expect(confirmEmail).toHaveBeenCalledWith('good-token');
  });

  it('offers "Go to dashboard" for a MERCHANT session', async () => {
    authUser = { role: 'MERCHANT', email: 'owner@login.test' };
    renderAt('good-token');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to sign in' })).toBeNull();
  });

  it('offers "Go to dashboard" for a STAFF session', async () => {
    authUser = { role: 'STAFF', email: 'staff@login.test' };
    renderAt('good-token');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to dashboard' })).toBeTruthy();
  });

  it('never offers the dashboard to a platform admin (shows Go to sign in)', async () => {
    authUser = { role: 'PLATFORM_ADMIN', email: 'admin@manyorder.app' };
    renderAt('good-token');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to sign in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to dashboard' })).toBeNull();
  });

  it('offers "Go to sign in" when there is no session', async () => {
    renderAt('good-token');
    await screen.findByText('Email confirmed');
    expect(screen.getByRole('button', { name: 'Go to sign in' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to dashboard' })).toBeNull();
  });

  it('shows a generic failure that points to Settings for a bad token', async () => {
    confirmEmail.mockReset().mockRejectedValue(new Error('invalid'));
    renderAt('bad-token');
    expect(await screen.findByText("This link didn't work")).toBeTruthy();
    expect(screen.getByText('It may have expired, or you may have already confirmed this email. If not, send a new confirmation from Settings.')).toBeTruthy();
  });
});
