// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingStep2 } from './OnboardingStep2';

beforeEach(() => cleanup());

describe('OnboardingStep2', () => {
  it('shows a Log out button that calls onSignOut', async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();
    render(
      <OnboardingStep2 onSkip={vi.fn()} onBack={vi.fn()} onSignOut={onSignOut}>
        <div>products</div>
      </OnboardingStep2>,
    );
    const btn = screen.getByRole('button', { name: 'Log out' });
    await user.click(btn);
    expect(onSignOut).toHaveBeenCalled();
  });

  it('omits the Log out button when no handler is given', () => {
    render(
      <OnboardingStep2 onSkip={vi.fn()} onBack={vi.fn()}>
        <div>products</div>
      </OnboardingStep2>,
    );
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });
});
