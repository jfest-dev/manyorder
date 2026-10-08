// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PasswordField } from './PasswordField';

/** Controlled wrapper so the field behaves exactly as it does in the real screens. */
function Harness() {
  const [v, setV] = useState('');
  return (
    <>
      <PasswordField label="Password" placeholder="Your password" value={v} onChange={setV} />
      <output data-testid="val">{v}</output>
    </>
  );
}

const MESSAGE = "Spaces aren't allowed in passwords.";

beforeEach(() => cleanup());

describe('PasswordField space handling', () => {
  it('ignores a typed space and shows the message', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText('Your password');

    await user.type(input, 'abc');
    expect(screen.getByTestId('val').textContent).toBe('abc');
    expect(screen.queryByText(MESSAGE)).toBeNull();

    // A space keystroke is dropped: the value is unchanged and the message appears.
    await user.type(input, ' ');
    expect(screen.getByTestId('val').textContent).toBe('abc');
    expect(screen.getByText(MESSAGE)).toBeTruthy();

    // A following valid keystroke clears the message.
    await user.type(input, 'd');
    expect(screen.getByTestId('val').textContent).toBe('abcd');
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });

  it('strips spaces from pasted text and shows the message', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText('Your password');

    await user.click(input);
    await user.paste('a b c d');
    expect(screen.getByTestId('val').textContent).toBe('abcd');
    expect(screen.getByText(MESSAGE)).toBeTruthy();
  });

  it('leaves space-free input untouched', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByPlaceholderText('Your password');

    await user.type(input, 'Sw0rdfish!');
    expect(screen.getByTestId('val').textContent).toBe('Sw0rdfish!');
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
