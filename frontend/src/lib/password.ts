// The single password rule for the app, kept identical to the backend so the two
// layers can never disagree. The backend enforces the same four checks with the
// same messages: @ValidPassword (length + digit), Passwords.requireNoWhitespace,
// and Passwords.requireWithinMaxLength (72-byte UTF-8 cap). Applied everywhere a
// password is set (register, reset, change).

export const PASSWORD_MIN_LENGTH = 8;
// bcrypt only hashes the first 72 bytes; the backend caps new passwords here.
export const PASSWORD_MAX_BYTES = 72;

// Copy for placeholders / helper text next to a password field.
export const PASSWORD_RULE_TEXT = 'At least 8 characters, including a number.';

// Exact backend messages, mirrored so the UI shows the same text the server would.
const STRENGTH_MESSAGE = 'Password must be at least 8 characters and include at least one number.';
const WHITESPACE_MESSAGE = "Password can't contain spaces.";
const TOO_LONG_MESSAGE = 'Password must be 72 bytes or fewer.';

/**
 * Returns a human-readable error, or null when the password satisfies every rule.
 * Checks run in the same order the backend reports them: strength (length + digit),
 * then whitespace, then the 72-byte UTF-8 limit.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH || !/[0-9]/.test(password)) {
    return STRENGTH_MESSAGE;
  }
  if (/\s/.test(password)) {
    return WHITESPACE_MESSAGE;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return TOO_LONG_MESSAGE;
  }
  return null;
}
