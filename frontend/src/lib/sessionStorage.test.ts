// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { getToken, getStoredUserJson, persistSession, clearSession } from './api';

const T = 'manyorder_token';
const U = 'manyorder_user';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('session storage resolution (two-tab isolation)', () => {
  it('reads sessionStorage before localStorage, as a token+user pair', () => {
    // A remembered login sits in the shared localStorage (left by another tab)...
    localStorage.setItem(T, 'merchant-tok');
    localStorage.setItem(U, JSON.stringify({ role: 'MERCHANT', email: 'm@x.com' }));
    // ...but THIS tab has its own session-only login.
    sessionStorage.setItem(T, 'admin-tok');
    sessionStorage.setItem(U, JSON.stringify({ role: 'PLATFORM_ADMIN', email: 'a@x.com' }));

    expect(getToken()).toBe('admin-tok');
    expect(JSON.parse(getStoredUserJson()!).role).toBe('PLATFORM_ADMIN');
  });

  it('falls back to localStorage when the tab has no session of its own', () => {
    localStorage.setItem(T, 'merchant-tok');
    localStorage.setItem(U, JSON.stringify({ role: 'MERCHANT' }));
    expect(getToken()).toBe('merchant-tok');
    expect(JSON.parse(getStoredUserJson()!).role).toBe('MERCHANT');
  });

  it('a session-only login never clears another tab\'s remembered localStorage login', () => {
    localStorage.setItem(T, 'merchant-tok');           // another tab's remembered login
    localStorage.setItem(U, JSON.stringify({ role: 'MERCHANT' }));

    persistSession('admin-tok', JSON.stringify({ role: 'PLATFORM_ADMIN' }), false); // this tab, session only

    expect(localStorage.getItem(T)).toBe('merchant-tok'); // untouched
    expect(sessionStorage.getItem(T)).toBe('admin-tok');
  });

  it('a remembered login clears this tab\'s session copy so it does not shadow', () => {
    sessionStorage.setItem(T, 'old-session-tok');
    sessionStorage.setItem(U, JSON.stringify({ role: 'STAFF' }));

    persistSession('merchant-tok', JSON.stringify({ role: 'MERCHANT' }), true); // remembered

    expect(sessionStorage.getItem(T)).toBeNull();
    expect(localStorage.getItem(T)).toBe('merchant-tok');
    expect(getToken()).toBe('merchant-tok');
  });

  it('clearing a session-only tab leaves a remembered login in localStorage intact', () => {
    localStorage.setItem(T, 'merchant-tok');           // remembered (another tab)
    localStorage.setItem(U, JSON.stringify({ role: 'MERCHANT' }));
    sessionStorage.setItem(T, 'admin-tok');            // this tab's session
    sessionStorage.setItem(U, JSON.stringify({ role: 'PLATFORM_ADMIN' }));

    clearSession(); // log out THIS (session) tab

    expect(sessionStorage.getItem(T)).toBeNull();
    expect(localStorage.getItem(T)).toBe('merchant-tok'); // the other tab is safe
  });
});
