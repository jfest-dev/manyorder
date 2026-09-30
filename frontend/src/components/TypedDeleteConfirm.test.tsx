// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypedDeleteConfirm } from './TypedDeleteConfirm';

describe('TypedDeleteConfirm', () => {
  it('keeps the delete button disabled until the exact text is typed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <TypedDeleteConfirm title="Delete customer" message="This cannot be undone."
        confirmText="Ada Lovelace" onConfirm={onConfirm} onCancel={() => {}} />,
    );

    const del = screen.getByRole('button', { name: 'Delete' });
    expect((del as HTMLButtonElement).disabled).toBe(true);

    const input = screen.getByLabelText('Confirmation text');
    await user.type(input, 'Ada');                 // partial → still disabled
    expect((del as HTMLButtonElement).disabled).toBe(true);
    await user.click(del);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.clear(input);
    await user.type(input, 'Ada Lovelace');         // exact → enabled
    expect((del as HTMLButtonElement).disabled).toBe(false);
    await user.click(del);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    cleanup();
  });
});
