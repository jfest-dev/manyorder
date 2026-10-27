/**
 * The one store-email verification badge, shared by Settings and the Platform
 * Admin store page so both read identically: "✓ Verified" (green) or
 * "Not verified" (amber). Callers pass className/style for sizing.
 */
export function VerifiedBadge({ verified, className, style }: {
  verified: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{ fontWeight: 600, color: verified ? '#16a34a' : '#B45309', whiteSpace: 'nowrap', ...style }}
    >
      {verified ? '✓ Verified' : 'Not verified'}
    </span>
  );
}
