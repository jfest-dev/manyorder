// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirmReason } from './ConfirmDialog';

function Harness() {
  const confirmReason = useConfirmReason();
  const [result, setResult] = useState('none');
  return (
    <>
      <button onClick={async () => setResult(String(await confirmReason({
        title: 'Suspend store?', message: 'The owner will be emailed.',
        confirmLabel: 'Suspend', reasonLabel: 'Reason (shown to the owner)',
      })))}>open</button>
      <div data-testid="result">{result}</div>
    </>
  );
}

beforeEach(() => cleanup());

describe('confirmReason dialog', () => {
  it('requires a reason before confirming, then resolves with it', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><Harness /></ConfirmProvider>);

    await user.click(screen.getByRole('button', { name: 'open' }));
    const confirmBtn = await screen.findByRole('button', { name: 'Suspend' });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true); // nothing typed yet

    await user.type(screen.getByLabelText('Reason (shown to the owner)'), 'Spam listings');
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);

    await user.click(confirmBtn);
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('Spam listings'));
  });

  it('resolves null when cancelled', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><Harness /></ConfirmProvider>);

    await user.click(screen.getByRole('button', { name: 'open' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('null'));
  });
});
