'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { UserDto, RegisterInput, LoginInput } from '@wudly/shared';
import { api } from './api';
import { ApiError } from './api-client';

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const LEGACY_ACCESS_TOKEN_STORAGE_KEY = 'wudly_access_token';

/**
 * Client-side auth context. The API issues an HttpOnly cookie on login/register;
 * the browser then sends it automatically on subsequent same-credentials calls.
 * We hydrate the current user via /auth/me on mount.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await api.auth.me({ cache: 'no-store' });
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const legacyToken = getLegacyAccessToken();
        if (legacyToken) {
          try {
            const me = await api.auth.me({ token: legacyToken, cache: 'no-store' });
            clearLegacyAccessToken();
            setUser(me);
            return;
          } catch {
            clearLegacyAccessToken();
          }
        }
        setUser(null);
      } else {
        // Network/other error — treat as logged out but don't crash the app.
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const res = await api.auth.login(input);
    clearLegacyAccessToken();
    setUser(res.user);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const res = await api.auth.register(input);
    clearLegacyAccessToken();
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout().catch(() => undefined);
    clearLegacyAccessToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

function getLegacyAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearLegacyAccessToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore disabled storage; the cookie-based session is authoritative.
  }
}
