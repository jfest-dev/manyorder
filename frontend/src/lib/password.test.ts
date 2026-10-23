import { describe, it, expect } from 'vitest';
import { validatePassword } from './password';

// These messages must stay byte-identical to the backend (@ValidPassword,
// Passwords.requireNoWhitespace, Passwords.requireWithinMaxLength).
const STRENGTH = 'Password must be at least 8 characters and include at least one number.';
const WHITESPACE = "Password can't contain spaces.";
const TOO_LONG = 'Password must be 72 bytes or fewer.';

describe('validatePassword', () => {
  it('accepts a valid password', () => {
    expect(validatePassword('password1')).toBeNull();
  });

  it('rejects a too-short password with the strength message', () => {
    expect(validatePassword('pass1')).toBe(STRENGTH);
  });

  it('rejects a password with no digit with the same strength message', () => {
    expect(validatePassword('passwordonly')).toBe(STRENGTH);
  });

  it('rejects whitespace (internal space or tab)', () => {
    expect(validatePassword('pass word1')).toBe(WHITESPACE);
    expect(validatePassword('password\t1')).toBe(WHITESPACE);
  });

  it('allows exactly 72 bytes and rejects 73 bytes', () => {
    expect(validatePassword('a'.repeat(71) + '1')).toBeNull(); // 72 bytes, has digit
    expect(validatePassword('a'.repeat(72) + '1')).toBe(TOO_LONG); // 73 bytes
  });

  it('counts multi-byte characters by their UTF-8 byte size', () => {
    // "1" + 19 emoji = 1 + 76 = 77 bytes (each U+1F600 is 4 bytes).
    expect(validatePassword('1' + '\u{1F600}'.repeat(19))).toBe(TOO_LONG);
  });

  it('applies checks in backend order: strength before whitespace', () => {
    // Too short AND has a space: the strength message wins, as on the backend.
    expect(validatePassword('a b1')).toBe(STRENGTH);
  });
});
