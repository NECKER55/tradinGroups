// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { AuthRequest } from '../types';

// ─── Schemi di validazione ────────────────────────────────────

const RegisterSchema = z.object({
  email:            z.string().email('Email non valida.'),
  username:         z.string().min(3).max(50),
  password:         z.string().min(8, 'La password deve avere almeno 8 caratteri.'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Le password non corrispondono.',
  path:    ['confirm_password'],
});

const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

// ─── POST /api/auth/register ──────────────────────────────────

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0].message });
    return;
  }

  const { email, username, password } = parsed.data;

  // Unicità email e username
  const [existingEmail, existingUsername] = await Promise.all([
    prisma.credenziali.findUnique({ where: { email } }),
    prisma.persona.findUnique({ where: { username } }),
  ]);

  if (existingEmail) {
    res.status(409).json({ error: 'EMAIL_IN_USE', message: 'Email già in uso.' });
    return;
  }
  if (existingUsername) {
    res.status(409).json({ error: 'USERNAME_IN_USE', message: 'Nome utente già in uso.' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  // Crea Persona + Credenziali + Portafoglio personale in un'unica transazione
  const persona = await prisma.$transaction(async (tx) => {
    const p = await tx.persona.create({
      data: {
        username,
        credenziali: { create: { email, password: hashed } },
        portafogli:  { create: { liquidita: 0 } }, // portafoglio personale
      },
      select: { id_persona: true, username: true, is_superuser: true },
    });
    return p;
  });

  const accessToken  = signAccessToken({ sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser });
  const refreshToken = signRefreshToken({ sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser });

  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    message:      'Registrazione completata.',
    access_token: accessToken,
    user: {
      id_persona:   persona.id_persona,
      username:     persona.username,
      is_superuser: persona.is_superuser,
    },
  });
}

// ─── POST /api/auth/login ─────────────────────────────────────

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email o password mancanti.' });
    return;
  }

  const { email, password } = parsed.data;

  const creds = await prisma.credenziali.findUnique({
    where:   { email },
    include: { persona: { select: { id_persona: true, username: true, is_banned: true, is_superuser: true } } },
  });

  // Messaggio generico per sicurezza (no distinzione email/password)
  const invalid = () =>
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Credenziali non valide. Riprova.' });

  if (!creds) { invalid(); return; }

  const match = await bcrypt.compare(password, creds.password);
  if (!match) { invalid(); return; }

  if (creds.persona.is_banned) {
    res.status(403).json({ error: 'USER_BANNED', message: 'Account sospeso. Contatta il supporto.' });
    return;
  }

  const payload = {
    sub:          creds.persona.id_persona,
    username:     creds.persona.username,
    is_superuser: creds.persona.is_superuser,
  };

  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  setRefreshCookie(res, refreshToken);

  res.json({
    access_token: accessToken,
    user: {
      id_persona:   creds.persona.id_persona,
      username:     creds.persona.username,
      is_superuser: creds.persona.is_superuser,
    },
  });
}

// ─── POST /api/auth/refresh ───────────────────────────────────
// Rilascia un nuovo access token usando il refresh token in cookie.

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.refresh_token as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'NO_REFRESH_TOKEN', message: 'Refresh token mancante.' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);

    // Verifica che l'utente esista ancora e non sia bannato
    const persona = await prisma.persona.findUnique({
      where:  { id_persona: payload.sub },
      select: { id_persona: true, username: true, is_banned: true, is_superuser: true },
    });

    if (!persona || persona.is_banned) {
      res.clearCookie('refresh_token');
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Sessione non valida.' });
      return;
    }

    const newPayload = { sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser };
    const accessToken  = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    setRefreshCookie(res, refreshToken);
    res.json({ access_token: accessToken });
  } catch {
    res.clearCookie('refresh_token');
    res.status(401).json({ error: 'REFRESH_TOKEN_INVALID', message: 'Refresh token non valido o scaduto.' });
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('refresh_token', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logout effettuato.' });
}

// ─── GET /api/auth/me ─────────────────────────────────────────

export async function me(req: Request, res: Response): Promise<void> {
  const { sub } = (req as AuthRequest).user;

  const persona = await prisma.persona.findUnique({
    where:  { id_persona: sub },
    select: { id_persona: true, username: true, photo_url: true, is_superuser: true, is_banned: true },
  });

  if (!persona) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Utente non trovato.' });
    return;
  }

  res.json(persona);
}

// ─── Utility ──────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 giorni in ms
    path:     '/api/auth/refresh',
  });
}