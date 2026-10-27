// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const checkSlug = vi.fn();

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, checkStoreSlugAvailable: (s: string) => checkSlug(s) };
});

import { CreateStore } from './CreateStore';

function renderCreate() {
  render(<CreateStore onComplete={vi.fn()} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
}

beforeEach(() => {
  cleanup();
  checkSlug.mockReset();
});

describe('CreateStore slug availability', () => {
  it('shows the available message for a free link', async () => {
    checkSlug.mockResolvedValue(true);
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByPlaceholderText('your-store-name'), 'freeslug');
    // Debounced check (~350 ms); findByText waits it out.
    expect(await screen.findByText('This link is available', {}, { timeout: 2000 })).toBeTruthy();
    expect(checkSlug).toHaveBeenCalledWith('freeslug');
  });

  it('shows the unavailable message and suggestions for a taken link', async () => {
    checkSlug.mockResolvedValue(false);
    const user = userEvent.setup();
    renderCreate();

    await user.type(screen.getByPlaceholderText('your-store-name'), 'taken');
    expect(await screen.findByText("That link isn't available, try another", {}, { timeout: 2000 })).toBeTruthy();
    // One or two client-side alternatives are offered.
    expect(screen.getByRole('button', { name: 'taken-2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'taken-sg' })).toBeTruthy();
  });
});
