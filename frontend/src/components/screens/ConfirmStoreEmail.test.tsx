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

beforeEach(() => { cleanup(); confirmEmail.mockReset(); });

describe('ConfirmStoreEmail page', () => {
  it('confirms a valid token and shows the store name', async () => {
    confirmEmail.mockResolvedValue({ storeName: 'Kiri Brew' });
    renderAt('good-token');
    expect(await screen.findByText('Store email confirmed')).toBeTruthy();
    expect(screen.getByText(/Kiri Brew/)).toBeTruthy();
    expect(confirmEmail).toHaveBeenCalledWith('good-token');
  });

  it('shows a generic failure with a way to resend for a bad token', async () => {
    confirmEmail.mockRejectedValue(new Error('invalid'));
    renderAt('bad-token');
    expect(await screen.findByText('Confirmation failed')).toBeTruthy();
    expect(screen.getByText(/Send confirmation/)).toBeTruthy();
  });
});
