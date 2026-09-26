// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TAG_COLOR_KEYS } from '../TagChip';

// Mock the API module: keep the real types/ApiError, stub customersApi.
const listMock = vi.fn();
const updateMock = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...actual,
    customersApi: {
      list: (...args: unknown[]) => listMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { Customers } from './Customers';
import type { CustomerResponse } from '../../lib/api';

const CUSTOMER: CustomerResponse = {
  id: 1, fullName: 'Test Customer', email: '', phoneNumber: '+6590000000',
  createdAt: '2026-01-01T00:00:00Z', ordersCount: 0, totalSpent: 0,
  firstOrderAt: null, lastOrderAt: null, tags: [],
};

beforeEach(() => {
  listMock.mockReset().mockResolvedValue([{ ...CUSTOMER, tags: [] }]);
  updateMock.mockReset().mockImplementation((_s, _id, payload) =>
    Promise.resolve({ ...CUSTOMER, tags: payload.tags ?? [] }));
  cleanup();
});

/** Open the edit dialog for the seeded customer. */
async function openEditor(user: ReturnType<typeof userEvent.setup>) {
  render(<Customers storeId={1} currency="SGD" />);
  const editButtons = await screen.findAllByLabelText('Edit Test Customer');
  await user.click(editButtons[0]);
  return screen.getByPlaceholderText('Add a tag') as HTMLInputElement;
}

/** Add one tag using the exact sequence that regressed: type the name while the
 *  input is focused, THEN pick the armed color, THEN commit with Enter. Without
 *  the onMouseDown guard the swatch click blurs the input and commits early with
 *  the previously-armed color, so the picked color is lost. */
async function addTagPickingColorLast(
  user: ReturnType<typeof userEvent.setup>, input: HTMLInputElement, name: string, color: string,
) {
  await user.type(input, name);
  await user.click(screen.getByLabelText(`Use ${color} for the next tag`));
  await user.keyboard('{Enter}');
}

describe('Customer tag colors — armed color is applied at creation', () => {
  it('saves each of the 5 palette colors correctly across 6 tag additions', async () => {
    const user = userEvent.setup();
    const input = await openEditor(user);

    // One tag per palette color, plus a 6th that reuses a color.
    const additions: Array<[string, string]> = [
      ...TAG_COLOR_KEYS.map((c, i) => [`Tag${i}-${c}`, c] as [string, string]),
      ['Tag5-repeat', 'blue'],
    ];
    for (const [name, color] of additions) {
      await addTagPickingColorLast(user, input, name, color);
    }

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const savedTags = updateMock.mock.calls[0][2].tags as Array<{ name: string; color: string }>;

    // Every tag persisted, in order, with the exact color that was armed.
    expect(savedTags).toEqual(additions.map(([name, color]) => ({ name, color })));
    // And all 6 survived (no cap short of the 20 limit).
    expect(savedTags).toHaveLength(6);
  });

  it('applies the correct color for every individual palette key', async () => {
    // Each color proven independently so a single-color regression is caught.
    for (const color of TAG_COLOR_KEYS) {
      const user = userEvent.setup();
      const input = await openEditor(user);
      await addTagPickingColorLast(user, input, `Solo-${color}`, color);
      await user.click(screen.getByRole('button', { name: 'Save Changes' }));

      await waitFor(() => expect(updateMock).toHaveBeenCalled());
      const savedTags = updateMock.mock.calls.at(-1)![2].tags as Array<{ name: string; color: string }>;
      expect(savedTags).toEqual([{ name: `Solo-${color}`, color }]);

      updateMock.mockClear();
      cleanup();
    }
  });
});
