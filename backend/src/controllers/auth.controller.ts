// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { resolveStoredProfilePhotoUrl, uploadProfileImage } from '../lib/cloudinary';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { AuthRequest } from '../types';

// ─── Schemi di validazione ────────────────────────────────────

const RegisterSchema = z.object({
  email:            z.string().email('Invalid email.'),
  username:         z.string().min(3).max(50),
  password:         z.string().min(8, 'Password must be at least 8 characters long.'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match.',
  path:    ['confirm_password'],
});

const LoginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string(),
});

const ChangePasswordSchema = z.object({
  old_password: z.string().min(1, 'Old password is required.'),
  new_password: z.string().min(8, 'New password must be at least 8 characters long.'),
  confirm_new_password: z.string(),
}).refine((d) => d.new_password === d.confirm_new_password, {
  message: 'New passwords do not match.',
  path: ['confirm_new_password'],
});

const ChangeUsernameSchema = z.object({
  username: z.string().trim().min(3).max(50),
});

const ChangeEmailSchema = z.object({
  email: z.string().trim().email('Invalid email.').max(100),
});

const DeleteUserParamsSchema = z.object({
  id_persona: z.coerce.number().int().positive(),
});

const BanUserParamsSchema = z.object({
  id_persona: z.coerce.number().int().positive(),
});

const BanUserBodySchema = z.object({
  is_banned: z.boolean().optional(),
});

const AdminListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  include_all: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

const REFRESH_COOKIE_PATH = '/api/auth/refresh';

async function detachMemberFromGroup(
  tx: Prisma.TransactionClient,
  id_gruppo: number,
  id_persona: number,
): Promise<void> {
  await tx.invito_Gruppo.deleteMany({
    where: {
      id_gruppo,
      id_mittente: id_persona,
    },
  });

  await tx.portafoglio.deleteMany({
    where: {
      id_gruppo,
      id_persona,
    },
  });

  await tx.membro_Gruppo.deleteMany({
    where: {
      id_gruppo,
      id_persona,
    },
  });
}

async function autoLeaveAllGroupsForPersona(
  tx: Prisma.TransactionClient,
  id_persona: number,
): Promise<void> {
  const memberships = await tx.membro_Gruppo.findMany({
    where: { id_persona },
    select: {
      id_gruppo: true,
      ruolo: true,
    },
  });

  for (const membership of memberships) {
    if (membership.ruolo === 'Owner') {
      const otherMembers = await tx.membro_Gruppo.findMany({
        where: {
          id_gruppo: membership.id_gruppo,
          id_persona: { not: id_persona },
        },
        select: {
          id_persona: true,
          ruolo: true,
        },
      });

      if (otherMembers.length === 0) {
        await tx.gruppo.deleteMany({ where: { id_gruppo: membership.id_gruppo } });
        continue;
      }

      const newOwner = otherMembers.find((m) => m.ruolo === 'Admin')
        ?? otherMembers.find((m) => m.ruolo === 'User')
        ?? otherMembers[0];

      await tx.membro_Gruppo.update({
        where: {
          id_persona_id_gruppo: {
            id_persona: newOwner.id_persona,
            id_gruppo: membership.id_gruppo,
          },
        },
        data: { ruolo: 'Owner' },
      });
    }

    await detachMemberFromGroup(tx, membership.id_gruppo, id_persona);
  }
}

// ─── POST /api/auth/register ──────────────────────────────────

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0].message });
    return;
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const username = parsed.data.username.trim();
  const { password } = parsed.data;

  const [existingByEmailRecord, existingByUsername] = await Promise.all([
    prisma.credenziali.findUnique({
      where: { email: normalizedEmail },
      select: {
        password: true,
        persona: {
          select: {
            id_persona: true,
            username: true,
            is_banned: true,
            is_deleted: true,
            is_superuser: true,
          },
        },
      },
    }),
    prisma.persona.findUnique({
      where: { username },
      select: {
        id_persona: true,
        is_banned: true,
        is_deleted: true,
      },
    }),
  ]);

  const existingByEmail = existingByEmailRecord
    ? {
        ...existingByEmailRecord.persona,
        password: existingByEmailRecord.password,
      }
    : null;

  if (existingByEmail?.is_banned) {
    res.status(403).json({
      error: 'USER_BANNED',
      message: 'This account is banned and cannot be re-registered.',
    });
    return;
  }

  if (existingByUsername && existingByUsername.is_banned && existingByUsername.id_persona !== existingByEmail?.id_persona) {
    res.status(403).json({
      error: 'USER_BANNED',
      message: 'This username belongs to a banned account and cannot be used.',
    });
    return;
  }

  if (existingByEmail && !existingByEmail.is_deleted) {
    res.status(409).json({ error: 'EMAIL_IN_USE', message: 'Email is already in use.' });
    return;
  }

  // Se l'account e soft-deleted, la registrazione riattiva lo stesso account.
  // Lo username inserito viene ignorato e resta quello originale.
  if (existingByEmail && existingByEmail.is_deleted) {
    const isSamePassword = await bcrypt.compare(password, existingByEmail.password);
    const nextHash = isSamePassword ? existingByEmail.password : await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      await autoLeaveAllGroupsForPersona(tx, existingByEmail.id_persona);

      await tx.persona.update({
        where: { id_persona: existingByEmail.id_persona },
        data: {
          is_deleted: false,
          photo_url: null,
        },
      });

      if (!isSamePassword) {
        await tx.credenziali.update({
          where: { id_persona: existingByEmail.id_persona },
          data: { password: nextHash },
        });
      }
    });

    const reactivated = await prisma.persona.findUnique({
      where: { id_persona: existingByEmail.id_persona },
      select: { id_persona: true, username: true, is_superuser: true },
    });

    if (!reactivated) {
      res.status(500).json({ error: 'REGISTER_FAILED', message: 'Unable to reactivate account.' });
      return;
    }

    const accessToken = signAccessToken({
      sub: reactivated.id_persona,
      username: reactivated.username,
      is_superuser: reactivated.is_superuser,
    });
    const refreshToken = signRefreshToken({
      sub: reactivated.id_persona,
      username: reactivated.username,
      is_superuser: reactivated.is_superuser,
    });

    setRefreshCookie(res, refreshToken);

    res.status(200).json({
      message: 'Deleted account reactivated successfully.',
      access_token: accessToken,
      user: {
        id_persona: reactivated.id_persona,
        username: reactivated.username,
        is_superuser: reactivated.is_superuser,
      },
    });
    return;
  }

  if (existingByUsername) {
    res.status(409).json({ error: 'USERNAME_IN_USE', message: 'Username is already in use.' });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);

  async function createPersonaWithCredentials() {
    return prisma.$transaction(async (tx) => {
      const p = await tx.persona.create({
        data: {
          username,
          credenziali: { create: { email: normalizedEmail, password: hashed } },
          portafogli:  { create: { liquidita: 0 } }, // portafoglio personale
        },
        select: { id_persona: true, username: true, is_superuser: true },
      });
      return p;
    });
  }

  // Crea Persona + Credenziali + Portafoglio personale in un'unica transazione.
  // In caso di DB restore, la sequence di id_persona puo restare indietro:
  // riallineiamo e riproviamo una sola volta.
  let persona;
  try {
    persona = await createPersonaWithCredentials();
  } catch (error: unknown) {
    const isPersonaIdUniqueViolation = (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
      && Array.isArray(error.meta?.target)
      && error.meta.target.includes('id_persona')
    );

    if (!isPersonaIdUniqueViolation) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        res.status(409).json({
          error: 'USERNAME_IN_USE',
          message: 'Username is already in use.',
        });
        return;
      }

      res.status(500).json({
        error: 'REGISTER_FAILED',
        message: 'Unable to complete registration.',
      });
      return;
    }

    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('"persona"', 'id_persona'),
        COALESCE((SELECT MAX(id_persona) FROM "persona"), 0) + 1,
        false
      )
    `);

    try {
      persona = await createPersonaWithCredentials();
    } catch {
      res.status(500).json({
        error: 'REGISTER_FAILED',
        message: 'Registration failed because persona id sequence is out of sync. Please contact support.',
      });
      return;
    }
  }

  const accessToken  = signAccessToken({ sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser });
  const refreshToken = signRefreshToken({ sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser });

  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    message:      'Registration completed successfully.',
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
    res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid email or password.' });
    return;
  }

  const identifier = parsed.data.identifier.trim();
  const password = parsed.data.password;

  let creds: {
    id_persona: number;
    username: string;
    is_banned: boolean;
    is_deleted: boolean;
    is_superuser: boolean;
    password: string;
  } | null = null;

  if (identifier.includes('@')) {
    const foundByEmail = await prisma.credenziali.findUnique({
      where: { email: identifier.toLowerCase() },
      select: {
        password: true,
        persona: {
          select: {
            id_persona: true,
            username: true,
            is_banned: true,
            is_deleted: true,
            is_superuser: true,
          },
        },
      },
    });

    if (foundByEmail) {
      creds = {
        ...foundByEmail.persona,
        password: foundByEmail.password,
      };
    }
  } else {
    const foundByUsername = await prisma.persona.findFirst({
      where: {
        username: {
          equals: identifier,
          mode: 'insensitive',
        },
      },
      select: {
        id_persona: true,
        username: true,
        is_banned: true,
        is_deleted: true,
        is_superuser: true,
        credenziali: {
          select: {
            password: true,
          },
        },
      },
    });

    if (foundByUsername?.credenziali) {
      creds = {
        id_persona: foundByUsername.id_persona,
        username: foundByUsername.username,
        is_banned: foundByUsername.is_banned,
        is_deleted: foundByUsername.is_deleted,
        is_superuser: foundByUsername.is_superuser,
        password: foundByUsername.credenziali.password,
      };
    }
  }

  // Generic message for security (do not disclose whether email or password is wrong)
  const invalid = () =>
    res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });

  if (!creds) { invalid(); return; }

  const match = await bcrypt.compare(password, creds.password);
  if (!match) { invalid(); return; }

  if (creds.is_banned) {
    await prisma.$transaction(async (tx) => {
      await autoLeaveAllGroupsForPersona(tx, creds.id_persona);
    });

    res.status(403).json({ error: 'USER_BANNED', message: 'Account suspended. Contact support.' });
    return;
  }

  if (creds.is_deleted) {
    await prisma.$transaction(async (tx) => {
      await autoLeaveAllGroupsForPersona(tx, creds.id_persona);
    });

    res.status(403).json({
      error: 'ACCOUNT_DELETED',
      message: 'Account is deleted. Register again with the same email to reactivate it.',
    });
    return;
  }

  const payload = {
    sub:          creds.id_persona,
    username:     creds.username,
    is_superuser: creds.is_superuser,
  };

  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  setRefreshCookie(res, refreshToken);

  res.json({
    access_token: accessToken,
    user: {
      id_persona:   creds.id_persona,
      username:     creds.username,
      is_superuser: creds.is_superuser,
    },
  });
}

// ─── POST /api/auth/refresh ───────────────────────────────────
// Rilascia un nuovo access token usando il refresh token in cookie.

export async function refresh(req: Request, res: Response): Promise<void> {
  // Compatibilità: accetta sia il cookie legacy `refreshToken` sia quello corrente `refresh_token`.
  const token = (req.cookies?.refresh_token ?? req.cookies?.refreshToken) as string | undefined;

  if (!token) {
    res.status(401).json({ error: 'NO_REFRESH_TOKEN', message: 'Missing refresh token.' });
    return;
  }

  try {
    const payload = verifyRefreshToken(token);

    // Verifica che l'utente esista ancora e non sia bannato
    const persona = await prisma.persona.findUnique({
      where: { id_persona: payload.sub },
      select: {
        id_persona: true,
        username: true,
        is_banned: true,
        is_deleted: true,
        is_superuser: true,
      },
    });

    if (!persona || persona.is_banned || persona.is_deleted) {
      if (persona?.id_persona) {
        await prisma.$transaction(async (tx) => {
          await autoLeaveAllGroupsForPersona(tx, persona.id_persona);
        });
      }

      clearRefreshCookies(res);
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid session.' });
      return;
    }

    const newPayload = { sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser };
    const accessToken  = signAccessToken(newPayload);
    const refreshToken = signRefreshToken(newPayload);

    setRefreshCookie(res, refreshToken);
    res.json({ access_token: accessToken });
  } catch {
    clearRefreshCookies(res);
    res.status(401).json({ error: 'REFRESH_TOKEN_INVALID', message: 'Refresh token is invalid or expired.' });
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────

export async function logout(_req: Request, res: Response): Promise<void> {
  clearRefreshCookies(res);
  res.json({ message: 'Logged out successfully.' });
}

// ─── GET /api/auth/me ─────────────────────────────────────────

export async function me(req: Request, res: Response): Promise<void> {
  const { sub } = (req as AuthRequest).user;

  const persona = await prisma.persona.findUnique({
    where: { id_persona: sub },
    select: {
      id_persona: true,
      username: true,
      photo_url: true,
      is_superuser: true,
      is_banned: true,
      is_deleted: true,
      credenziali: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!persona) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    return;
  }

  if (persona.is_banned || persona.is_deleted) {
    await prisma.$transaction(async (tx) => {
      await autoLeaveAllGroupsForPersona(tx, persona.id_persona);
    });

    res.status(403).json({
      error: persona.is_banned ? 'USER_BANNED' : 'ACCOUNT_DELETED',
      message: persona.is_banned
        ? 'Account suspended. Contact support.'
        : 'Account is deleted. Register again with the same email to reactivate it.',
    });
    return;
  }

  res.json({
    id_persona: persona.id_persona,
    username: persona.username,
    photo_url: resolveStoredProfilePhotoUrl(persona.photo_url),
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
      message: parsed.error.errors[0]?.message ?? 'Invalid payload.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const { old_password, new_password } = parsed.data;

  if (old_password === new_password) {
    res.status(400).json({
      error: 'PASSWORD_UNCHANGED',
      message: 'New password must be different from the current password.',
    });
    return;
  }

  const creds = await prisma.credenziali.findUnique({
    where: { id_persona: sub },
  });

  if (!creds) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
    return;
  }

  const matches = await bcrypt.compare(old_password, creds.password);
  if (!matches) {
    res.status(400).json({
      error: 'INVALID_OLD_PASSWORD',
      message: 'Current password is incorrect.',
    });
    return;
  }

  const hashed = await bcrypt.hash(new_password, 12);
  await prisma.credenziali.update({
    where: { id_persona: sub },
    data: { password: hashed },
  });

  res.json({ message: 'Password updated successfully.' });
}

export async function deleteUserAccount(req: Request, res: Response): Promise<void> {
  const parsedParams = DeleteUserParamsSchema.safeParse(req.params);

  if (!parsedParams.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsedParams.error.errors[0]?.message ?? 'Invalid user id.',
    });
    return;
  }

  const requester = (req as AuthRequest).user;
  const targetUserId = parsedParams.data.id_persona;
  const isSelf = requester.sub === targetUserId;

  if (!isSelf && !requester.is_superuser) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'You can only delete your own account unless you are a superuser.',
    });
    return;
  }

  const targetUser = await prisma.persona.findUnique({
    where: { id_persona: targetUserId },
    select: {
      id_persona: true,
      username: true,
      is_banned: true,
      is_deleted: true,
      credenziali: {
        select: {
          email: true,
        },
      },
    },
  });

  if (!targetUser) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
    return;
  }

  if (!targetUser.credenziali?.email) {
    res.status(409).json({
      error: 'ACCOUNT_ALREADY_DELETED',
      message: 'This account has already been removed.',
    });
    return;
  }

  if (targetUser.is_deleted) {
    res.status(409).json({
      error: 'ACCOUNT_ALREADY_DELETED',
      message: 'This account is already marked as deleted.',
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await autoLeaveAllGroupsForPersona(tx, targetUserId);

    await tx.persona.update({
      where: { id_persona: targetUserId },
      data: {
        is_deleted: true,
        photo_url: null,
      },
    });
  });

  if (isSelf) {
    clearRefreshCookies(res);
  }

  res.json({
    message: isSelf
      ? 'Your account has been marked as deleted.'
      : `User ${targetUserId} account has been marked as deleted.`,
  });
}

export async function changeMyUsername(req: Request, res: Response): Promise<void> {
  const parsed = ChangeUsernameSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Invalid payload.',
    });
    return;
  }

  const { sub, is_superuser } = (req as AuthRequest).user;
  const newUsername = parsed.data.username;

  const persona = await prisma.persona.findUnique({
    where: { id_persona: sub },
    select: {
      id_persona: true,
      username: true,
      username_changed_at: true,
    },
  });

  if (!persona) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
    return;
  }

  if (persona.username === newUsername) {
    res.status(409).json({
      error: 'USERNAME_UNCHANGED',
      message: 'New username matches the current one.',
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
        message: `You can change your username again in ${remainingDays} day(s).`,
      });
      return;
    }
  }

  try {
    const updated = await prisma.persona.update({
      where: { id_persona: sub },
      data: {
        username: newUsername,
        username_changed_at: new Date(),
      },
      select: {
        id_persona: true,
        username: true,
        photo_url: true,
        is_superuser: true,
        is_banned: true,
      },
    });

    const payload = {
      sub: updated.id_persona,
      username: updated.username,
      is_superuser,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    setRefreshCookie(res, refreshToken);

    res.json({
      message: 'Username updated successfully.',
      access_token: accessToken,
      user: {
        id_persona: updated.id_persona,
        username: updated.username,
        photo_url: resolveStoredProfilePhotoUrl(updated.photo_url),
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
        message: 'Username is already in use.',
      });
      return;
    }

    res.status(500).json({
      error: 'USERNAME_UPDATE_FAILED',
      message: 'Unable to update username.',
    });
  }
}

export async function changeMyPhoto(req: Request, res: Response): Promise<void> {
  const file = req.file;

  if (!file) {
    res.status(400).json({
      error: 'PHOTO_FILE_REQUIRED',
      message: 'Profile image file is required.',
    });
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    res.status(413).json({
      error: 'PHOTO_TOO_LARGE',
      message: 'Profile image must be 2MB or smaller.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;

  try {
    const uploaded = await uploadProfileImage({
      userId: sub,
      buffer: file.buffer,
    });

    const updated = await prisma.persona.update({
      where: { id_persona: sub },
      data: {
        photo_url: uploaded.public_id,
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
      message: 'Profile photo updated successfully.',
      user: {
        ...updated,
        photo_url: resolveStoredProfilePhotoUrl(updated.photo_url),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';

    if (errorMessage.startsWith('CLOUDINARY_NOT_CONFIGURED')) {
      res.status(503).json({
        error: 'PHOTO_UPLOAD_UNAVAILABLE',
        message: 'Profile photo upload is temporarily unavailable. Cloudinary is not configured on the server.',
      });
      return;
    }

    console.error('[changeMyPhoto] upload failed:', error);
    res.status(500).json({
      error: 'PHOTO_UPDATE_FAILED',
      message: process.env.NODE_ENV === 'development'
        ? `Unable to update profile photo: ${errorMessage}`
        : 'Unable to update profile photo.',
    });
  }
}

export async function removeMyPhoto(req: Request, res: Response): Promise<void> {
  const { sub } = (req as AuthRequest).user;

  try {
    const persona = await prisma.persona.findUnique({ where: { id_persona: sub }, select: { photo_url: true, id_persona: true, username: true, is_superuser: true, is_banned: true } });

    if (!persona) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found.' });
      return;
    }

    const prev = persona.photo_url ?? null;

    const updated = await prisma.persona.update({ where: { id_persona: sub }, data: { photo_url: null }, select: { id_persona: true, username: true, photo_url: true, is_superuser: true, is_banned: true } });

    if (prev) {
      try {
        // lazy delete from cloudinary if configured
        const { deleteImage } = await import('../lib/cloudinary');
        await deleteImage(prev);
      } catch (err) {
        // log and continue
        // eslint-disable-next-line no-console
        console.warn('[removeMyPhoto] cloudinary deletion failed', err);
      }
    }

    res.json({ message: 'Profile photo removed.', user: { ...updated, photo_url: null } });
  } catch (error) {
    res.status(500).json({ error: 'PHOTO_REMOVE_FAILED', message: 'Unable to remove profile photo.' });
  }
}

export async function changeMyEmail(req: Request, res: Response): Promise<void> {
  const parsed = ChangeEmailSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Invalid payload.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const nextEmail = parsed.data.email.trim().toLowerCase();

  const currentCreds = await prisma.credenziali.findUnique({
    where: { id_persona: sub },
    select: { email: true },
  });

  if (!currentCreds) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
    return;
  }

  if (currentCreds.email === nextEmail) {
    res.status(409).json({
      error: 'EMAIL_UNCHANGED',
      message: 'New email matches the current one.',
    });
    return;
  }

  try {
    await prisma.credenziali.update({
      where: { id_persona: sub },
      data: { email: nextEmail },
    });

    res.json({
      message: 'Email updated successfully.',
      email: nextEmail,
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
      res.status(409).json({
        error: 'EMAIL_IN_USE',
        message: 'Email is already in use.',
      });
      return;
    }

    res.status(500).json({
      error: 'EMAIL_UPDATE_FAILED',
      message: 'Unable to update email.',
    });
  }
}

export async function adminListUsers(req: Request, res: Response): Promise<void> {
  const requester = (req as AuthRequest).user;

  if (!requester.is_superuser) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Superuser access required.',
    });
    return;
  }

  const parsed = AdminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Invalid query params.',
    });
    return;
  }

  const queryText = parsed.data.q?.trim() ?? '';
  const includeAll = Boolean(parsed.data.include_all);
  const limit = includeAll ? 500 : (parsed.data.limit ?? 20);

  const where: Prisma.PersonaWhereInput | undefined = queryText
    ? {
        OR: [
          {
            username: {
              startsWith: queryText,
              mode: 'insensitive',
            },
          },
          {
            credenziali: {
              is: {
                email: {
                  startsWith: queryText,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      }
    : undefined;

  const [rows, total] = await Promise.all([
    prisma.persona.findMany({
      where,
      select: {
        id_persona: true,
        username: true,
        photo_url: true,
        is_superuser: true,
        is_banned: true,
        is_deleted: true,
        credenziali: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        id_persona: 'desc',
      },
      take: limit,
    }),
    prisma.persona.count({ where }),
  ]);

  res.json({
    total,
    returned: rows.length,
    users: rows.map((row) => ({
      id_persona: row.id_persona,
      username: row.username,
      email: row.credenziali?.email ?? null,
      photo_url: resolveStoredProfilePhotoUrl(row.photo_url),
      is_superuser: row.is_superuser,
      is_banned: row.is_banned,
      is_deleted: row.is_deleted,
    })),
  });
}

export async function adminListGroups(req: Request, res: Response): Promise<void> {
  const requester = (req as AuthRequest).user;

  if (!requester.is_superuser) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Superuser access required.',
    });
    return;
  }

  const parsed = AdminListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Invalid query params.',
    });
    return;
  }

  const queryText = parsed.data.q?.trim() ?? '';
  const includeAll = Boolean(parsed.data.include_all);
  const limit = includeAll ? 500 : (parsed.data.limit ?? 20);

  const where: Prisma.GruppoWhereInput | undefined = queryText
    ? {
        OR: [
          {
            nome: {
              startsWith: queryText,
              mode: 'insensitive',
            },
          },
          {
            descrizione: {
              startsWith: queryText,
              mode: 'insensitive',
            },
          },
        ],
      }
    : undefined;

  const [rows, total] = await Promise.all([
    prisma.gruppo.findMany({
      where,
      select: {
        id_gruppo: true,
        nome: true,
        privacy: true,
        descrizione: true,
        photo_url: true,
        budget_iniziale: true,
        _count: {
          select: {
            membri: true,
          },
        },
      },
      orderBy: {
        id_gruppo: 'desc',
      },
      take: limit,
    }),
    prisma.gruppo.count({ where }),
  ]);

  res.json({
    total,
    returned: rows.length,
    groups: rows.map((row) => ({
      id_gruppo: row.id_gruppo,
      nome: row.nome,
      privacy: row.privacy,
      descrizione: row.descrizione,
      photo_url: resolveStoredProfilePhotoUrl(row.photo_url),
      budget_iniziale: row.budget_iniziale.toString(),
      members_count: row._count.membri,
    })),
  });
}

export async function adminSetUserBan(req: Request, res: Response): Promise<void> {
  const requester = (req as AuthRequest).user;

  if (!requester.is_superuser) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Superuser access required.',
    });
    return;
  }

  const parsedParams = BanUserParamsSchema.safeParse(req.params);
  const parsedBody = BanUserBodySchema.safeParse(req.body ?? {});

  if (!parsedParams.success) {
    const firstError = parsedParams.error.errors[0]?.message;

    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: firstError ?? 'Invalid payload.',
    });
    return;
  }

  if (!parsedBody.success) {
    const firstError = parsedBody.error.errors[0]?.message;

    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: firstError ?? 'Invalid payload.',
    });
    return;
  }

  const targetUserId = parsedParams.data.id_persona;

  if (targetUserId === requester.sub) {
    res.status(400).json({
      error: 'INVALID_OPERATION',
      message: 'You cannot ban your own account.',
    });
    return;
  }

  const target = await prisma.persona.findUnique({
    where: { id_persona: targetUserId },
    select: {
      id_persona: true,
      username: true,
      is_superuser: true,
      is_banned: true,
      is_deleted: true,
    },
  });

  if (!target) {
    res.status(404).json({
      error: 'USER_NOT_FOUND',
      message: 'User not found.',
    });
    return;
  }

  if (target.is_superuser) {
    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Cannot ban a superuser account.',
    });
    return;
  }

  if (target.is_deleted) {
    res.status(409).json({
      error: 'ACCOUNT_DELETED',
      message: 'Cannot update ban state for a deleted account.',
    });
    return;
  }

  const desiredBanState = parsedBody.data.is_banned ?? !target.is_banned;

  await prisma.persona.update({
    where: { id_persona: targetUserId },
    data: { is_banned: desiredBanState },
  });

  res.json({
    message: desiredBanState ? 'User banned successfully.' : 'User unbanned successfully.',
    user: {
      id_persona: target.id_persona,
      username: target.username,
      is_banned: desiredBanState,
    },
  });
}

// ─── Utility ──────────────────────────────────────────────────

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 giorni in ms
    path:     REFRESH_COOKIE_PATH,
  });
}

function clearRefreshCookies(res: Response): void {
  const baseOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
  };

  res.clearCookie('refresh_token', { ...baseOptions, path: REFRESH_COOKIE_PATH });
  res.clearCookie('refreshToken', { ...baseOptions, path: REFRESH_COOKIE_PATH });

  // Backward compatibility in case older cookies were issued at '/'.
  res.clearCookie('refresh_token', { ...baseOptions, path: '/' });
  res.clearCookie('refreshToken', { ...baseOptions, path: '/' });
}