import type { ReactNode } from 'react';
import { Button } from '../Button';

export function OnboardingStep2({
  children,
  onSkip,
}: {
  children: ReactNode;
  onSkip: () => void;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              Onboarding 2/2
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Add products
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              You can add products now or later.
            </div>
          </div>

          <Button variant="secondary" onClick={onSkip}>
            I’ll add products later
          </Button>
        </div>

        {children}
      </div>
    </div>
  );
}
