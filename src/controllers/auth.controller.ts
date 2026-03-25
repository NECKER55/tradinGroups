// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
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

const ChangePasswordSchema = z.object({
  old_password: z.string().min(1, 'old_password obbligatoria.'),
  new_password: z.string().min(8, 'La nuova password deve avere almeno 8 caratteri.'),
  confirm_new_password: z.string(),
}).refine((d) => d.new_password === d.confirm_new_password, {
  message: 'Le nuove password non corrispondono.',
  path: ['confirm_new_password'],
});

const ChangeUsernameSchema = z.object({
  username: z.string().trim().min(3).max(50),
});

const ChangePhotoSchema = z.object({
  photo_url: z.union([
    z.string().trim().url().max(255),
    z.literal(''),
    z.null(),
  ]).optional(),
});

const ChangeEmailSchema = z.object({
  email: z.string().trim().email('Email non valida.').max(100),
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
  // Compatibilità: accetta sia il cookie legacy `refreshToken` sia quello corrente `refresh_token`.
  const token = (req.cookies?.refresh_token ?? req.cookies?.refreshToken) as string | undefined;

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
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
  res.json({ message: 'Logout effettuato.' });
}

// ─── GET /api/auth/me ─────────────────────────────────────────

export async function me(req: Request, res: Response): Promise<void> {
  const { sub } = (req as AuthRequest).user;

  const persona = await prisma.persona.findUnique({
    where:  { id_persona: sub },
    select: {
      id_persona: true,
      username: true,
      photo_url: true,
      is_superuser: true,
      is_banned: true,
      credenziali: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!persona) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Utente non trovato.' });
    return;
  }

  res.json({
    id_persona: persona.id_persona,
    username: persona.username,
    photo_url: persona.photo_url,
    is_superuser: persona.is_superuser,
    is_banned: persona.is_banned,
    email: persona.credenziali?.email ?? null,
  });
}

export async function changeMyPassword(req: Request, res: Response): Promise<void> {
  const parsed = ChangePasswordSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const { old_password, new_password } = parsed.data;

  if (old_password === new_password) {
    res.status(400).json({
      error: 'PASSWORD_UNCHANGED',
      message: 'La nuova password deve essere diversa da quella attuale.',
    });
    return;
  }

  const creds = await prisma.credenziali.findUnique({
    where: { id_persona: sub },
  });

  if (!creds) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'Utente non trovato.',
    });
    return;
  }

  const matches = await bcrypt.compare(old_password, creds.password);
  if (!matches) {
    res.status(401).json({
      error: 'INVALID_OLD_PASSWORD',
      message: 'La password attuale non e corretta.',
    });
    return;
  }

  const hashed = await bcrypt.hash(new_password, 12);
  await prisma.credenziali.update({
    where: { id_persona: sub },
    data: { password: hashed },
  });

  res.json({ message: 'Password aggiornata con successo.' });
}

export async function changeMyUsername(req: Request, res: Response): Promise<void> {
  const parsed = ChangeUsernameSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
    });
    return;
  }

  const { sub, is_superuser } = (req as AuthRequest).user;
  const newUsername = parsed.data.username;

  const rows = await prisma.$queryRaw<Array<{
    id_persona: number;
    username: string;
    username_changed_at: Date | null;
  }>>(Prisma.sql`
    SELECT id_persona, username, username_changed_at
    FROM persona
    WHERE id_persona = ${sub}
    LIMIT 1
  `);

  const persona = rows[0] ?? null;

  if (!persona) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'Utente non trovato.',
    });
    return;
  }

  if (persona.username === newUsername) {
    res.status(409).json({
      error: 'USERNAME_UNCHANGED',
      message: 'Il nuovo nome utente coincide con quello attuale.',
    });
    return;
  }

  if (persona.username_changed_at) {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - persona.username_changed_at.getTime();

    if (elapsed < sevenDaysMs) {
      const remainingDays = Math.ceil((sevenDaysMs - elapsed) / (24 * 60 * 60 * 1000));
      res.status(429).json({
        error: 'USERNAME_CHANGE_COOLDOWN',
        message: `Puoi cambiare username di nuovo tra ${remainingDays} giorno/i.`,
      });
      return;
    }
  }

  try {
    const updated = await prisma.persona.update({
      where: { id_persona: sub },
      data: {
        username: newUsername,
      },
      select: {
        id_persona: true,
        username: true,
        photo_url: true,
        is_superuser: true,
        is_banned: true,
      },
    });

    await prisma.$executeRaw(Prisma.sql`
      UPDATE persona
      SET username_changed_at = NOW()
      WHERE id_persona = ${sub}
    `);

    const payload = {
      sub: updated.id_persona,
      username: updated.username,
      is_superuser,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    setRefreshCookie(res, refreshToken);

    res.json({
      message: 'Username aggiornato con successo.',
      access_token: accessToken,
      user: {
        id_persona: updated.id_persona,
        username: updated.username,
        photo_url: updated.photo_url,
        is_superuser: updated.is_superuser,
        is_banned: updated.is_banned,
      },
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      res.status(409).json({
        error: 'USERNAME_IN_USE',
        message: 'Nome utente gia in uso.',
      });
      return;
    }

    res.status(500).json({
      error: 'USERNAME_UPDATE_FAILED',
      message: 'Impossibile aggiornare il nome utente.',
    });
  }
}

export async function changeMyPhoto(req: Request, res: Response): Promise<void> {
  const parsed = ChangePhotoSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const photoUrl = (() => {
    const raw = parsed.data.photo_url;
    if (raw === undefined || raw === null) return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  })();

  try {
    const updated = await prisma.persona.update({
      where: { id_persona: sub },
      data: {
        photo_url: photoUrl,
      },
      select: {
        id_persona: true,
        username: true,
        photo_url: true,
        is_superuser: true,
        is_banned: true,
      },
    });

    res.json({
      message: 'Foto profilo aggiornata con successo.',
      user: updated,
    });
  } catch {
    res.status(500).json({
      error: 'PHOTO_UPDATE_FAILED',
      message: 'Impossibile aggiornare la foto profilo.',
    });
  }
}

export async function changeMyEmail(req: Request, res: Response): Promise<void> {
  const parsed = ChangeEmailSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const nextEmail = parsed.data.email;

  const currentCreds = await prisma.credenziali.findUnique({
    where: { id_persona: sub },
    select: { email: true },
  });

  if (!currentCreds) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'Utente non trovato.',
    });
    return;
  }

  if (currentCreds.email === nextEmail) {
    res.status(409).json({
      error: 'EMAIL_UNCHANGED',
      message: 'La nuova email coincide con quella attuale.',
    });
    return;
  }

  try {
    await prisma.credenziali.update({
      where: { id_persona: sub },
      data: { email: nextEmail },
    });

    res.json({
      message: 'Email aggiornata con successo.',
      email: nextEmail,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      res.status(409).json({
        error: 'EMAIL_IN_USE',
        message: 'Email gia in uso.',
      });
      return;
    }

    res.status(500).json({
      error: 'EMAIL_UPDATE_FAILED',
      message: 'Impossibile aggiornare la email.',
    });
  }
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