import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, clearToken, getToken, setToken, setAuthNotice, LoginResponse } from '../lib/api';

export interface AuthUser {
  userId: number;
  fullName: string;
  email: string;
  role: 'MERCHANT' | 'STAFF' | 'PLATFORM_ADMIN';
  staffStoreId: number | null;
  verified: boolean;
}

const USER_KEY = 'manyorder_user';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<AuthUser>;
  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    role: 'MERCHANT' | 'STAFF';
    storeSlug?: string;
  }) => Promise<AuthUser>;
  loginWithGoogle: (idToken: string) => Promise<AuthUser>;
  /** Re-fetch the current account from the server (notably the verified flag). */
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  if (!getToken()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const applySession = useCallback((response: LoginResponse, remember: boolean): AuthUser => {
    const nextUser: AuthUser = {
      userId: response.userId,
      fullName: response.fullName,
      email: response.email,
      role: response.role,
      staffStoreId: response.staffStoreId,
      verified: response.verified,
    };
    setToken(response.token, remember);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  }, []);

  // Clear the session and bounce to /signin, leaving a one-time message to show
  // there. Used when the stored session can no longer be trusted.
  const signOutWithReason = useCallback((reason: string) => {
    setAuthNotice(reason);
    clearToken();
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
    if (window.location.pathname !== '/signin') window.location.href = '/signin';
  }, []);

  // Rebuild the signed-in user from /auth/me using the token, so the role is always
  // the server's, never a stale stored value. If the token is missing we do nothing
  // (not signed in); if it is invalid the API layer clears the session and redirects
  // with "Your session has expired."; if /auth/me reports a DIFFERENT role than the
  // stored user, the token and the stored user disagree, so we sign out rather than
  // keep a mismatched session. A transient network error leaves the session alone.
  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    let me: LoginResponse;
    try {
      me = await authApi.me();
    } catch (e) {
      // 401 is already handled by the API layer (clears + redirects + notice);
      // anything else is transient, so keep the cached user.
      void e;
      return;
    }
    const rebuilt: AuthUser = {
      userId: me.userId,
      fullName: me.fullName,
      email: me.email,
      role: me.role,
      staffStoreId: me.staffStoreId,
      verified: me.verified,
    };
    const stored = readStoredUser();
    if (stored && stored.role !== rebuilt.role) {
      signOutWithReason('You were signed out because your session changed. Please sign in again.');
      return;
    }
    // Persist the rebuilt user to whichever storage currently holds the session.
    const store = localStorage.getItem(USER_KEY) !== null ? localStorage : sessionStorage;
    try { store.setItem(USER_KEY, JSON.stringify(rebuilt)); } catch { /* storage unavailable */ }
    setUser(rebuilt);
  }, [signOutWithReason]);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
    // Screens live under /app; a hard redirect keeps legacy screens simple.
    window.location.href = '/signin';
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login: async (email, password, remember) => applySession(await authApi.login(email, password, remember), remember),
      register: async (payload) => applySession(await authApi.register(payload), true),
      loginWithGoogle: async (idToken) => applySession(await authApi.google(idToken), true),
      refreshUser,
      logout,
    }),
    [user, applySession, refreshUser, logout],
  );

  // On load, rebuild the user (including the role) from the token, so a stored user
  // that disagrees with the token is caught immediately and a verified-elsewhere
  // flag is picked up.
  useEffect(() => {
    if (getToken()) void refreshUser();
    // Run once on mount; refreshUser is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild again whenever the window regains focus, so a role change or a sign-in
  // as a different account in another tab is reconciled without a manual reload.
  useEffect(() => {
    const onFocus = () => { if (getToken()) void refreshUser(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
