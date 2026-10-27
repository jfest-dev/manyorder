import type { ReactNode } from 'react';
import { Button } from '../Button';

export function OnboardingStep1({
  children,
  canExit,
  onExit,
}: {
  children: ReactNode;
  canExit: boolean;
  onExit: () => void;
}) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-app)', padding: '24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              Onboarding 1/2
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Create your store
            </div>
          </div>

          {canExit && (
            <Button variant="ghost" onClick={onExit}>
              Exit setup
            </Button>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
