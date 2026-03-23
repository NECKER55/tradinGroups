export interface User {
  id_persona: number;
  username: string;
  photo_url?: string | null;
  is_superuser: boolean;
  is_banned?: boolean;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface ApiError {
  error?: string;
  message?: string;
}

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}
