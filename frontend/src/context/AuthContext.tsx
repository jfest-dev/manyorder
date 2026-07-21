import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, clearToken, getToken, setToken, LoginResponse } from '../lib/api';
import { registerSupabaseSignOut } from '../lib/supabase';

export interface AuthUser {
  userId: number;
  fullName: string;
  email: string;
  role: 'MERCHANT' | 'STAFF' | 'PLATFORM_ADMIN';
  staffStoreId: number | null;
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
    };
    setToken(response.token, remember);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    (remember ? localStorage : sessionStorage).setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
    // Screens live under /app; a hard redirect keeps legacy screens simple.
    window.location.href = '/signin';
  }, []);

  useEffect(() => {
    registerSupabaseSignOut(logout);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      login: async (email, password, remember) => applySession(await authApi.login(email, password), remember),
      register: async (payload) => applySession(await authApi.register(payload), true),
      loginWithGoogle: async (idToken) => applySession(await authApi.google(idToken), true),
      logout,
    }),
    [user, applySession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
