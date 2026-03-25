import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
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
      try {
        await logoutApi();
      } finally {
        setAccessToken(null);
        setUser(null);
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
    throw new Error('useAuth deve essere usato dentro AuthProvider');
  }
  return context;
}
