import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AUTH_TOKEN_EVENT,
  getAccessToken,
  hydrateAccessTokenFromSession,
  login as loginApi,
  logout as logoutApi,
  me,
  refresh,
  register as registerApi,
  setAccessToken,
} from '../api/authApi';
import type { LoginPayload, RegisterPayload, User } from '../types/auth';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function areUsersEquivalent(a: User | null, b: User | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return a.id_persona === b.id_persona
    && a.username === b.username
    && (a.email ?? null) === (b.email ?? null)
    && (a.photo_url ?? null) === (b.photo_url ?? null)
    && a.is_superuser === b.is_superuser
    && (a.is_banned ?? null) === (b.is_banned ?? null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const setUserIfChanged = useCallback((nextUser: User | null) => {
    setUser((prev) => (areUsersEquivalent(prev, nextUser) ? prev : nextUser));
  }, []);

  useEffect(() => {
    hydrateAccessTokenFromSession();

    async function bootstrapAuth() {
      try {
        if (!getAccessToken()) {
          const refreshed = await refresh();
          setAccessToken(refreshed.access_token);
        }

        const profile = await me();
        setUserIfChanged(profile);
      } catch {
        setAccessToken(null);
        setUserIfChanged(null);
      } finally {
        setLoading(false);
      }
    }

    void bootstrapAuth();
  }, [setUserIfChanged]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function syncProfileFromToken(token: string | null) {
      if (!token) {
        setUserIfChanged(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      void me()
        .then((profile) => setUserIfChanged(profile))
        .catch(() => {
          setAccessToken(null);
          setUserIfChanged(null);
        })
        .finally(() => setLoading(false));
    }

    const onTokenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<string | null>;
      syncProfileFromToken(customEvent.detail ?? null);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'access_token') return;
      syncProfileFromToken(event.newValue);
    };

    window.addEventListener(AUTH_TOKEN_EVENT, onTokenUpdate as EventListener);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(AUTH_TOKEN_EVENT, onTokenUpdate as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, [setUserIfChanged]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginApi(payload);
    setAccessToken(response.access_token);
    setUserIfChanged(response.user);
  }, [setUserIfChanged]);

  const register = useCallback(async (payload: RegisterPayload) => {
    const response = await registerApi(payload);
    setAccessToken(response.access_token);
    setUserIfChanged(response.user);
  }, [setUserIfChanged]);

  const logout = useCallback(async () => {
    // Clear local auth state first to prevent stale authenticated UI on refresh/race conditions.
    setAccessToken(null);
    setUserIfChanged(null);
    try {
      await logoutApi();
    } catch {
      // Best effort server logout; local state is already cleared.
    }
  }, [setUserIfChanged]);

  const refreshProfile = useCallback(async () => {
    const profile = await me();
    setUserIfChanged(profile);
  }, [setUserIfChanged]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    register,
    logout,
    refreshProfile,
  }), [loading, user, login, register, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
