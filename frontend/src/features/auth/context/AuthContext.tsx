import { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hydrateAccessTokenFromSession();

    async function bootstrapAuth() {
      try {
        if (!getAccessToken()) {
          const refreshed = await refresh();
          setAccessToken(refreshed.access_token);
        }

        const profile = await me();
        setUser(profile);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    void bootstrapAuth();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function syncProfileFromToken(token: string | null) {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      void me()
        .then((profile) => setUser(profile))
        .catch(() => {
          setAccessToken(null);
          setUser(null);
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
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login: async (payload) => {
      const response = await loginApi(payload);
      setAccessToken(response.access_token);
      setUser(response.user);
    },
    register: async (payload) => {
      const response = await registerApi(payload);
      setAccessToken(response.access_token);
      setUser(response.user);
    },
    logout: async () => {
      // Clear local auth state first to prevent stale authenticated UI on refresh/race conditions.
      setAccessToken(null);
      setUser(null);
      try {
        await logoutApi();
      } catch {
        // Best effort server logout; local state is already cleared.
      }
    },
    refreshProfile: async () => {
      const profile = await me();
      setUser(profile);
    },
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
