import { API_BASE_URL } from '../../../shared/config/env';
import { ROUTES } from '../../../shared/api/routes';
import type { ApiError, AuthResponse, LoginPayload, RegisterPayload, User } from '../types/auth';

let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
export const AUTH_TOKEN_EVENT = 'auth:token-updated';

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) {
    sessionStorage.setItem('access_token', token);
  } else {
    sessionStorage.removeItem('access_token');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<string | null>(AUTH_TOKEN_EVENT, { detail: token }));
  }
}

export function hydrateAccessTokenFromSession(): void {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    accessToken = token;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T;
  return data;
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_BASE_URL}${ROUTES.AUTH.REFRESH}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await parseJson<{ access_token?: string } | ApiError>(response);
      if (!response.ok || !('access_token' in data) || !data.access_token) {
        const errorPayload = data as ApiError;
        throw new Error(errorPayload.message ?? 'Session expired');
      }

      setAccessToken(data.access_token);
      return data.access_token;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function withAuthHeaders(init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return {
    ...init,
    headers,
    credentials: 'include',
  };
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, withAuthHeaders(init));
  const shouldAttemptRefresh = response.status === 401
    && path !== ROUTES.AUTH.REFRESH
    && path !== ROUTES.AUTH.LOGIN
    && path !== ROUTES.AUTH.REGISTER;

  if (shouldAttemptRefresh) {
    try {
      await refreshAccessToken();
    } catch {
      setAccessToken(null);
      throw new Error('Session expired. Please log in again.');
    }

    const retriedResponse = await fetch(`${API_BASE_URL}${path}`, withAuthHeaders(init));
    const retriedData = await parseJson<T | ApiError>(retriedResponse);

    if (!retriedResponse.ok) {
      const errorPayload = retriedData as ApiError;
      throw new Error(errorPayload.message ?? 'API error');
    }

    return retriedData as T;
  }

  const data = await parseJson<T | ApiError>(response);

  if (!response.ok) {
    const errorPayload = data as ApiError;
    throw new Error(errorPayload.message ?? 'API error');
  }

  return data as T;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>(ROUTES.AUTH.REGISTER, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>(ROUTES.AUTH.LOGIN, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function refresh(): Promise<{ access_token: string }> {
  return apiRequest<{ access_token: string }>(ROUTES.AUTH.REFRESH, {
    method: 'POST',
  });
}

export async function me(): Promise<User> {
  return apiRequest<User>(ROUTES.AUTH.ME, {
    method: 'GET',
  });
}

export async function logout(): Promise<void> {
  await apiRequest<{ message: string }>(ROUTES.AUTH.LOGOUT, {
    method: 'POST',
  });
}

export async function changeMyUsername(username: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>(ROUTES.AUTH.CHANGE_USERNAME, {
    method: 'PUT',
    body: JSON.stringify({ username }),
  });
}

export async function changeMyPassword(oldPassword: string, newPassword: string, confirmNewPassword: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.AUTH.CHANGE_PASSWORD, {
    method: 'PUT',
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword,
      confirm_new_password: confirmNewPassword,
    }),
  });
}

export async function changeMyPhoto(photoUrl: string | null): Promise<{ message: string; user: User }> {
  return apiRequest<{ message: string; user: User }>(ROUTES.AUTH.CHANGE_PHOTO, {
    method: 'PUT',
    body: JSON.stringify({ photo_url: photoUrl }),
  });
}

export async function changeMyEmail(email: string): Promise<{ message: string; email: string }> {
  return apiRequest<{ message: string; email: string }>(ROUTES.AUTH.CHANGE_EMAIL, {
    method: 'PUT',
    body: JSON.stringify({ email }),
  });
}

export async function deleteUserAccount(userId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.AUTH.DELETE_USER(userId), {
    method: 'DELETE',
  });
}
