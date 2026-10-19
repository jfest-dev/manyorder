// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const getStore = vi.fn();
const updateStore = vi.fn();
const listOrders = vi.fn();
const sendConfirmation = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    storesApi: {
      ...actual.storesApi,
      get: (id: number) => getStore(id),
      update: (id: number, p: unknown) => updateStore(id, p),
      sendEmailConfirmation: (id: number) => sendConfirmation(id),
    },
    ordersApi: { ...actual.ordersApi, list: (id: number) => listOrders(id) },
  };
});

import { Settings } from './Settings';
import { ConfirmProvider } from '../ConfirmDialog';

const STORE = {
  id: 1, name: 'Kiri Brew', slug: 'kiri', email: 'hi@kiri.test', phone: '+6598887777',
  businessType: 'Retail', currency: 'SGD', themeColor: '#000000', logoUrl: null,
  storeDescription: '', operatingHours: '', paymentInstruction: null,
  deliveryFee: null, freeDeliveryThreshold: null, deliveryToBeConfirmedMessage: null,
  fulfilmentMode: 'BOTH', whatsappVerified: false, streetAddress: '', city: '', postalCode: '',
  notifyNewOrderEmail: true, notifyLowStockEmail: false, notifyNewOrderWhatsapp: false,
  notifyUrgentWhatsapp: false, itemNotesEnabled: false, emailVerified: false, createdAt: '2026-01-01T00:00:00Z',
} as Record<string, unknown>;

function renderSettings() {
  render(<ConfirmProvider><Settings storeId={1} onSaved={vi.fn()} onArchived={vi.fn()} /></ConfirmProvider>);
}

beforeEach(() => {
  cleanup();
  getStore.mockReset().mockResolvedValue(STORE);
  updateStore.mockReset().mockResolvedValue(STORE);
  listOrders.mockReset().mockResolvedValue([]); // no orders by default
  sendConfirmation.mockReset().mockResolvedValue(undefined);
});

describe('Settings store fields', () => {
  it('shows a legacy business type as-is and the shared currency label', async () => {
    renderSettings();
    expect(await screen.findByDisplayValue('Kiri Brew')).toBeTruthy();
    expect(screen.getByText('Retail')).toBeTruthy(); // legacy value shown, not dropped
    expect(screen.getByText('SGD - Singapore dollar')).toBeTruthy();
    expect(screen.getByText('You can change this until your first order.')).toBeTruthy();
  });

  it('store email: not verified prompts to confirm, then shows sent copy with a resend countdown', async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByDisplayValue('Kiri Brew');
    expect(screen.getByText('Confirm this email to receive store notifications here.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Send confirmation' }));
    await waitFor(() => expect(sendConfirmation).toHaveBeenCalledWith(1));
    expect(await screen.findByText('Confirmation sent to hi@kiri.test. Check your inbox.')).toBeTruthy();
    // The resend button is disabled during the cooldown.
    const resend = screen.getByRole('button', { name: /Resend in \d+s/ });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });

  it('store email: shows Verified and no send button when verified', async () => {
    getStore.mockResolvedValue({ ...STORE, emailVerified: true });
    renderSettings();
    await screen.findByDisplayValue('Kiri Brew');
    expect(screen.getByText('Verified')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send confirmation' })).toBeNull();
  });

  it('store email: saving an address that the backend reports verified shows Verified at once', async () => {
    const user = userEvent.setup();
    // Saved as not-verified, but the save response reports it verified (equals the
    // verified login email), so the badge must flip without a refresh.
    updateStore.mockResolvedValue({ ...STORE, email: 'owner@login.test', emailVerified: true });
    renderSettings();
    await screen.findByDisplayValue('Kiri Brew');

    const email = screen.getByDisplayValue('hi@kiri.test');
    await user.clear(email);
    await user.type(email, 'owner@login.test');
    const save = screen.getAllByRole('button', { name: 'Save' }).find((b) => !(b as HTMLButtonElement).disabled)!;
    await user.click(save);

    await waitFor(() => expect(updateStore).toHaveBeenCalled());
    expect(await screen.findByText('Verified')).toBeTruthy();
    expect(screen.queryByText(/Confirmation sent to/)).toBeNull();
  });

  it('store email: prompts to add one when blank', async () => {
    getStore.mockResolvedValue({ ...STORE, email: '', emailVerified: false });
    renderSettings();
    await screen.findByDisplayValue('Kiri Brew');
    expect(screen.getByText('Add a store email for store notifications.')).toBeTruthy();
  });

  it('locks currency read-only once the store has orders', async () => {
    listOrders.mockResolvedValue([{ id: 9 }]);
    renderSettings();
    await screen.findByDisplayValue('Kiri Brew');
    await waitFor(() => expect(screen.getByText("Currency can't change after the first order.")).toBeTruthy());
    expect((screen.getByLabelText('Currency') as HTMLInputElement).readOnly).toBe(true);
  });

  it('opening does not rewrite the phone, and saving after a name edit keeps it unchanged', async () => {
    const user = userEvent.setup();
    renderSettings();
    await screen.findByDisplayValue('Kiri Brew');

    // Phone split for display but the form is not dirty on open (nothing rewritten).
    expect((screen.getByLabelText('Phone number') as HTMLInputElement).value).toBe('98887777');
    const saveButtons = () => screen.getAllByRole('button', { name: 'Save' });
    expect(saveButtons().every((b) => (b as HTMLButtonElement).disabled)).toBe(true);

    // Edit only the name, then save the store card.
    const name = screen.getByDisplayValue('Kiri Brew');
    await user.clear(name);
    await user.type(name, 'Kiri Coffee');
    const enabled = saveButtons().find((b) => !(b as HTMLButtonElement).disabled)!;
    await user.click(enabled);

    await waitFor(() => expect(updateStore).toHaveBeenCalled());
    const payload = updateStore.mock.calls[0][1] as { storePhone: string; businessType: string; storeName: string };
    expect(payload.storeName).toBe('Kiri Coffee');
    expect(payload.storePhone).toBe('+6598887777'); // phone never rewritten
    expect(payload.businessType).toBe('Retail');    // legacy type preserved
  });
});
