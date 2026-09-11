/**
 * A brief success confirmation pill, fixed at the bottom-centre of the screen.
 * Extracted from the store-switch confirmation so any screen can reuse the same
 * look (e.g. "Discount created."). Render it conditionally; the caller owns the
 * auto-dismiss timing.
 */
export function Toast({ message }: { message: string }) {
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: 'fixed', bottom: '24px', left: '50%', zIndex: 2000,
          transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--text-primary)', color: 'var(--bg-card)',
          padding: '10px 16px', borderRadius: '10px', boxShadow: 'var(--shadow-overlay)',
          fontSize: '13px', fontWeight: 600, animation: 'mo-toast-in 0.18s ease-out',
        }}
      >
        <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700 }}>✓</span>
        {message}
      </div>
      <style>{`@keyframes mo-toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
    </>
  );
}
