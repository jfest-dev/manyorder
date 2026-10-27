// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const listMock = vi.fn();
const createMock = vi.fn().mockResolvedValue({});

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    customersApi: {
      ...actual.customersApi,
      list: () => listMock(),
      create: (storeId: number, payload: unknown) => createMock(storeId, payload),
    },
  };
});

import { Customers } from './Customers';

beforeEach(() => {
  cleanup();
  listMock.mockReset().mockResolvedValue([]);
  createMock.mockClear();
});

describe('Add Customer with tags', () => {
  it('adds a gray-by-default tag and sends it in the create payload', async () => {
    const user = userEvent.setup();
    render(<Customers storeId={1} currency="SGD" />);

    // Open the Add modal (the first "Add Customer" is the toolbar trigger).
    await user.click(screen.getAllByRole('button', { name: /Add Customer/i })[0]);
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getAllByRole('textbox')[0], 'Ada'); // Name
    await user.type(within(dialog).getByPlaceholderText('+65 8123 4567'), '+6590001111');

    // The shared tag editor: type a tag and commit with Enter.
    await user.type(within(dialog).getByPlaceholderText('Add a tag'), 'VIP{Enter}');
    expect(within(dialog).getByText('VIP')).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Add Customer' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const payload = createMock.mock.calls[0][1] as { tags: { name: string; color: string }[] };
    expect(payload.tags).toEqual([{ name: 'VIP', color: 'gray' }]);
  });

  it('adds a customer with no tags (tags empty)', async () => {
    const user = userEvent.setup();
    render(<Customers storeId={1} currency="SGD" />);

    await user.click(screen.getAllByRole('button', { name: /Add Customer/i })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getAllByRole('textbox')[0], 'Bob'); // Name
    await user.type(within(dialog).getByPlaceholderText('+65 8123 4567'), '+6590002222');
    await user.click(within(dialog).getByRole('button', { name: 'Add Customer' }));

    await waitFor(() => expect(createMock).toHaveBeenCalled());
    const payload = createMock.mock.calls[0][1] as { tags: unknown[] };
    expect(payload.tags).toEqual([]);
  });
});
