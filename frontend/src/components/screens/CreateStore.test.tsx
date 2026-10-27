// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateStore } from './CreateStore';

function renderCreate(onComplete = vi.fn()) {
  render(<CreateStore onComplete={onComplete} onNavigate={vi.fn()} onSignOut={vi.fn()} />);
  return onComplete;
}

beforeEach(() => cleanup());

describe('CreateStore shared fields', () => {
  it('uses the shared currency label and the six business types (defaults shown)', () => {
    renderCreate();
    // Shared currency label, not the old "Singapore Dollar (SGD)".
    expect(screen.getByText('SGD - Singapore dollar')).toBeTruthy();
    // Business type default (code "food") shows its shared label.
    expect(screen.getByText('Food & Beverage')).toBeTruthy();
    // Shared phone input (country code + number).
    expect(screen.getByLabelText('Country code')).toBeTruthy();
    expect(screen.getByLabelText('Phone number')).toBeTruthy();
  });

  it('submits the combined phone, business-type code and uppercase currency', async () => {
    const user = userEvent.setup();
    const onComplete = renderCreate();

    // Business name is the first text field.
    await user.type(screen.getAllByRole('textbox')[0], 'Kiri Brew');
    await user.type(screen.getByLabelText('Phone number'), '98887777');
    await user.click(screen.getByRole('button', { name: 'Create store' }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Kiri Brew', category: 'food', currency: 'SGD', phone: '+6598887777',
    }));
  });
});
