// src/types/index.ts

import { Request } from 'express';

// ─── JWT Payload ───────────────────────────────────────────────
export interface JwtPayload {
  sub: number;        // id_persona
  username: string;
  is_superuser: boolean;
  iat?: number;
  exp?: number;
}

// ─── Request autenticata ───────────────────────────────────────
export interface AuthRequest extends Request {
  user: JwtPayload;
}

// ─── Risposta errore standardizzata ───────────────────────────
export interface ApiError {
  error: string;      // codice errore machine-readable
  message: string;    // messaggio human-readable
}

// ─── Risposta paginata ─────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total_items: number;
  current_page: number;
  total_pages: number;
  limit: number;
}

// ─── Ruoli gruppo ──────────────────────────────────────────────
export type RuoloGruppo = 'Owner' | 'Admin' | 'User' | 'Guest' | 'Spectator';
export const RUOLI_TRADING: RuoloGruppo[] = ['Owner', 'Admin', 'User'];
export const RUOLI_ADMIN: RuoloGruppo[]   = ['Owner', 'Admin'];