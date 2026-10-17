// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirmReason, type ConfirmReasonOptions, type ConfirmReasonResult } from './ConfirmDialog';

function Harness({ opts }: { opts: ConfirmReasonOptions }) {
  const confirmReason = useConfirmReason();
  const [result, setResult] = useState('none');
  return (
    <>
      <button onClick={async () => {
        const r: ConfirmReasonResult | null = await confirmReason(opts);
        setResult(r == null ? 'null' : `${r.reason}|${r.emailOwner}`);
      }}>open</button>
      <div data-testid="result">{result}</div>
    </>
  );
}

const RESTRICTING: ConfirmReasonOptions = {
  title: 'Suspend store?', message: 'The owner will be emailed.',
  confirmLabel: 'Suspend', reasonLabel: 'Reason (shown to the owner)',
};
const RESTORING: ConfirmReasonOptions = {
  title: 'Unsuspend store?', message: 'The store comes back.',
  confirmLabel: 'Unsuspend', reasonLabel: 'Reason (shown to the owner)',
  reasonOptional: true, emailOwnerDefault: true,
};

beforeEach(() => cleanup());

describe('confirmReason dialog', () => {
  it('requires a reason before confirming, then resolves with it (emailOwner defaults true)', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><Harness opts={RESTRICTING} /></ConfirmProvider>);

    await user.click(screen.getByRole('button', { name: 'open' }));
    const confirmBtn = await screen.findByRole('button', { name: 'Suspend' });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true); // nothing typed yet
    expect(screen.queryByLabelText('Email the owner')).toBeNull(); // no checkbox on restricting

    await user.type(screen.getByLabelText('Reason (shown to the owner)'), 'Spam listings');
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);

    await user.click(confirmBtn);
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('Spam listings|true'));
  });

  it('resolves null when cancelled', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><Harness opts={RESTRICTING} /></ConfirmProvider>);

    await user.click(screen.getByRole('button', { name: 'open' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('null'));
  });

  it('restoring: confirms with no reason and lets the Email-the-owner box be unticked', async () => {
    const user = userEvent.setup();
    render(<ConfirmProvider><Harness opts={RESTORING} /></ConfirmProvider>);

    await user.click(screen.getByRole('button', { name: 'open' }));
    const confirmBtn = await screen.findByRole('button', { name: 'Unsuspend' });
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(false); // optional reason: enabled immediately

    await user.click(screen.getByLabelText('Email the owner')); // untick
    await user.click(confirmBtn);
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('|false'));
  });
});
