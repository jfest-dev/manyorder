// The single password-strength rule for the app, mirrored on the backend by
// the @ValidPassword constraint: at least 8 characters and at least one number.
// Applied everywhere a password is set (register, reset, change) so the two
// layers can never disagree about what "strong enough" means.

export const PASSWORD_MIN_LENGTH = 8;

// Copy for placeholders / helper text next to a password field.
export const PASSWORD_RULE_TEXT = 'At least 8 characters, including a number.';

/** Returns a human-readable error, or null when the password satisfies the rule. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include at least one number.';
  }
  return null;
}
