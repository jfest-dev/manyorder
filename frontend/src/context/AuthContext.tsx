import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, clearToken, getToken, setToken, LoginResponse } from '../lib/api';

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

  // Pull the latest account state from the server (e.g. after the user clicks
  // their verification link in another tab or device). Writes back to whichever
  // storage currently holds the session so the flag survives a reload. Silent on
  // failure - a transient /auth/me error should never disturb the session.
  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      const me = await authApi.me();
      setUser((prev) => {
        if (!prev) return prev;
        const merged: AuthUser = { ...prev, verified: me.verified, fullName: me.fullName };
        const store = localStorage.getItem(USER_KEY) !== null ? localStorage : sessionStorage;
        store.setItem(USER_KEY, JSON.stringify(merged));
        return merged;
      });
    } catch {
      // ignore - keep the cached user
    }
  }, []);

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
      login: async (email, password, remember) => applySession(await authApi.login(email, password), remember),
      register: async (payload) => applySession(await authApi.register(payload), true),
      loginWithGoogle: async (idToken) => applySession(await authApi.google(idToken), true),
      refreshUser,
      logout,
    }),
    [user, applySession, refreshUser, logout],
  );

  // On load, reconcile the cached verified flag with the server once, so a user
  // who verified elsewhere sees the banner clear on their next dashboard visit.
  useEffect(() => {
    if (getToken()) void refreshUser();
    // Run once on mount; refreshUser is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
