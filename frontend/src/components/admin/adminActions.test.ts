// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ACTION_LABEL, AUDIT_ACTIONS, readableAction } from './adminActions';

describe('every audit action has a readable label', () => {
  it('has no audit action code without a plain-words label', () => {
    const missing = AUDIT_ACTIONS.filter((code) => !ACTION_LABEL[code]);
    expect(missing, `these audit actions have no readable label: ${missing.join(', ')}`).toEqual([]);
  });

  it('turns a known code into words and falls back to the raw code otherwise', () => {
    expect(readableAction('PROTECT_STORE')).toBe('Protected store');
    expect(readableAction('RESTORE_STORE')).toBe('Restored store');
    expect(readableAction('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});
