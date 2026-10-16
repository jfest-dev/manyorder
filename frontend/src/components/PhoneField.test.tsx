// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneField } from './PhoneField';

function Harness({ initial }: { initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <>
      <PhoneField value={v} onChange={setV} label="Phone" />
      <div data-testid="val">{v}</div>
    </>
  );
}

beforeEach(() => cleanup());

describe('PhoneField', () => {
  it('splits a +65 phone into code and number and does not rewrite it on mount', () => {
    const onChange = vi.fn();
    render(<PhoneField value="+6598887777" onChange={onChange} />);
    expect((screen.getByLabelText('Phone number') as HTMLInputElement).value).toBe('98887777');
    expect(screen.getByLabelText('Country code').textContent).toContain('+65');
    expect(onChange).not.toHaveBeenCalled(); // untouched phone is never rewritten
  });

  it('shows a legacy value unchanged in the number box with no code selected', () => {
    const onChange = vi.fn();
    render(<PhoneField value="12345" onChange={onChange} />);
    expect((screen.getByLabelText('Phone number') as HTMLInputElement).value).toBe('12345');
    const code = screen.getByLabelText('Country code').textContent ?? '';
    expect(code).not.toContain('+65'); // no code selected
    expect(code).not.toContain('+62');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a compact flag + code in the closed dropdown, not the full country name', () => {
    render(<PhoneField value="+6598887777" onChange={vi.fn()} />);
    const code = screen.getByLabelText('Country code').textContent ?? '';
    expect(code).toContain('+65');          // code always present, never cut off
    expect(code).not.toContain('Singapore'); // full name stays in the open list only
  });

  it('emits the combined value when the number is edited', async () => {
    const user = userEvent.setup();
    render(<Harness initial="+6591112222" />);
    const input = screen.getByLabelText('Phone number');
    await user.clear(input);
    await user.type(input, '93334444');
    await waitFor(() => expect(screen.getByTestId('val').textContent).toBe('+6593334444'));
  });
});
