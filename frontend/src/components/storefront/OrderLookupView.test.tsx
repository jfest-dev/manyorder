// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const lookupOrder = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    storefrontApi: { ...actual.storefrontApi, lookupOrder: (slug: string, p: unknown) => lookupOrder(slug, p) },
  };
});

import { OrderLookupView } from './OrderLookupView';
import { ApiError } from '../../lib/api';
import type { PublicStoreResponse } from '../../lib/api';

const STORE = { id: 1, name: 'Kiri Brew', slug: 'kiri', currency: 'SGD' } as unknown as PublicStoreResponse;
const MESSAGE = "We couldn't find that order";

async function submitLookup() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('e.g. 42'), '42');
  await user.type(screen.getByPlaceholderText('8123 4567'), '91234567');
  await user.click(screen.getByRole('button', { name: /Find order/i }));
  return user;
}

beforeEach(() => { cleanup(); lookupOrder.mockReset(); });

describe('OrderLookupView failure', () => {
  it('shows the unified not-found message + Shop now on a 404', async () => {
    const onBackToShop = vi.fn();
    lookupOrder.mockRejectedValue(new ApiError(404, 'Order not found.'));
    render(<OrderLookupView store={STORE} onBack={() => {}} onBackToShop={onBackToShop} />);

    const user = await submitLookup();
    expect(await screen.findByText(MESSAGE)).toBeTruthy();
    expect(screen.getByText('Check your order number and phone number, or use the tracking link from your confirmation page.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Shop now' }));
    expect(onBackToShop).toHaveBeenCalled();
  });

  it('shows the same message for a server error (never reveals which detail was wrong)', async () => {
    lookupOrder.mockRejectedValue(new Error('boom'));
    render(<OrderLookupView store={STORE} onBack={() => {}} onBackToShop={() => {}} />);

    await submitLookup();
    expect(await screen.findByText(MESSAGE)).toBeTruthy();
    // No wording that singles out the order number or the phone as the wrong one.
    expect(screen.queryByText(/double-check|number and phone\. Please/i)).toBeNull();
  });
});
