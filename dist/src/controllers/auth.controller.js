"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.me = me;
exports.changeMyPassword = changeMyPassword;
exports.deleteUserAccount = deleteUserAccount;
exports.changeMyUsername = changeMyUsername;
exports.changeMyPhoto = changeMyPhoto;
exports.changeMyEmail = changeMyEmail;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const jwt_1 = require("../lib/jwt");
// ─── Schemi di validazione ────────────────────────────────────
const RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email.'),
    username: zod_1.z.string().min(3).max(50),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters long.'),
    confirm_password: zod_1.z.string(),
}).refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match.',
    path: ['confirm_password'],
});
const LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const ChangePasswordSchema = zod_1.z.object({
    old_password: zod_1.z.string().min(1, 'Old password is required.'),
    new_password: zod_1.z.string().min(8, 'New password must be at least 8 characters long.'),
    confirm_new_password: zod_1.z.string(),
}).refine((d) => d.new_password === d.confirm_new_password, {
    message: 'New passwords do not match.',
    path: ['confirm_new_password'],
});
const ChangeUsernameSchema = zod_1.z.object({
    username: zod_1.z.string().trim().min(3).max(50),
});
const ChangePhotoSchema = zod_1.z.object({
    photo_url: zod_1.z.union([
        zod_1.z.string().trim().url().max(255),
        zod_1.z.literal(''),
        zod_1.z.null(),
    ]).optional(),
});
const ChangeEmailSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Invalid email.').max(100),
});
const DeleteUserParamsSchema = zod_1.z.object({
    id_persona: zod_1.z.coerce.number().int().positive(),
});
const REFRESH_COOKIE_PATH = '/api/auth/refresh';
// ─── POST /api/auth/register ──────────────────────────────────
async function register(req, res) {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0].message });
        return;
    }
    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const username = parsed.data.username.trim();
    const { password } = parsed.data;
    // Unicità email e username
    const [existingEmail, existingUsername] = await Promise.all([
        prisma_1.prisma.credenziali.findUnique({ where: { email: normalizedEmail } }),
        prisma_1.prisma.persona.findUnique({ where: { username } }),
    ]);
    if (existingEmail) {
        res.status(409).json({ error: 'EMAIL_IN_USE', message: 'Email is already in use.' });
        return;
    }
    if (existingUsername) {
        res.status(409).json({ error: 'USERNAME_IN_USE', message: 'Username is already in use.' });
        return;
    }
    const hashed = await bcryptjs_1.default.hash(password, 12);
    // Crea Persona + Credenziali + Portafoglio personale in un'unica transazione
    const persona = await prisma_1.prisma.$transaction(async (tx) => {
        const p = await tx.persona.create({
            data: {
                username,
                credenziali: { create: { email: normalizedEmail, password: hashed } },
                portafogli: { create: { liquidita: 0 } }, // portafoglio personale
            },
            select: { id_persona: true, username: true, is_superuser: true },
        });
        return p;
    });
    const accessToken = (0, jwt_1.signAccessToken)({ sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser });
    const refreshToken = (0, jwt_1.signRefreshToken)({ sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser });
    setRefreshCookie(res, refreshToken);
    res.status(201).json({
        message: 'Registration completed successfully.',
        access_token: accessToken,
        user: {
            id_persona: persona.id_persona,
            username: persona.username,
            is_superuser: persona.is_superuser,
        },
    });
}
// ─── POST /api/auth/login ─────────────────────────────────────
async function login(req, res) {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Invalid email or password.' });
        return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    const password = parsed.data.password;
    const creds = await prisma_1.prisma.credenziali.findUnique({
        where: { email },
        include: { persona: { select: { id_persona: true, username: true, is_banned: true, is_superuser: true } } },
    });
    // Generic message for security (do not disclose whether email or password is wrong)
    const invalid = () => res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    if (!creds) {
        invalid();
        return;
    }
    const match = await bcryptjs_1.default.compare(password, creds.password);
    if (!match) {
        invalid();
        return;
    }
    if (creds.persona.is_banned) {
        res.status(403).json({ error: 'USER_BANNED', message: 'Account suspended. Contact support.' });
        return;
    }
    const payload = {
        sub: creds.persona.id_persona,
        username: creds.persona.username,
        is_superuser: creds.persona.is_superuser,
    };
    const accessToken = (0, jwt_1.signAccessToken)(payload);
    const refreshToken = (0, jwt_1.signRefreshToken)(payload);
    setRefreshCookie(res, refreshToken);
    res.json({
        access_token: accessToken,
        user: {
            id_persona: creds.persona.id_persona,
            username: creds.persona.username,
            is_superuser: creds.persona.is_superuser,
        },
    });
}
// ─── POST /api/auth/refresh ───────────────────────────────────
// Rilascia un nuovo access token usando il refresh token in cookie.
async function refresh(req, res) {
    // Compatibilità: accetta sia il cookie legacy `refreshToken` sia quello corrente `refresh_token`.
    const token = (req.cookies?.refresh_token ?? req.cookies?.refreshToken);
    if (!token) {
        res.status(401).json({ error: 'NO_REFRESH_TOKEN', message: 'Missing refresh token.' });
        return;
    }
    try {
        const payload = (0, jwt_1.verifyRefreshToken)(token);
        // Verifica che l'utente esista ancora e non sia bannato
        const persona = await prisma_1.prisma.persona.findUnique({
            where: { id_persona: payload.sub },
            select: { id_persona: true, username: true, is_banned: true, is_superuser: true },
        });
        if (!persona || persona.is_banned) {
            clearRefreshCookies(res);
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid session.' });
            return;
        }
        const newPayload = { sub: persona.id_persona, username: persona.username, is_superuser: persona.is_superuser };
        const accessToken = (0, jwt_1.signAccessToken)(newPayload);
        const refreshToken = (0, jwt_1.signRefreshToken)(newPayload);
        setRefreshCookie(res, refreshToken);
        res.json({ access_token: accessToken });
    }
    catch {
        clearRefreshCookies(res);
        res.status(401).json({ error: 'REFRESH_TOKEN_INVALID', message: 'Refresh token is invalid or expired.' });
    }
}
// ─── POST /api/auth/logout ────────────────────────────────────
async function logout(_req, res) {
    clearRefreshCookies(res);
    res.json({ message: 'Logged out successfully.' });
}
// ─── GET /api/auth/me ─────────────────────────────────────────
async function me(req, res) {
    const { sub } = req.user;
    const persona = await prisma_1.prisma.persona.findUnique({
        where: { id_persona: sub },
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
        res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
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
async function changeMyPassword(req, res) {
    const parsed = ChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Invalid payload.',
        });
        return;
    }
    const { sub } = req.user;
    const { old_password, new_password } = parsed.data;
    if (old_password === new_password) {
        res.status(400).json({
            error: 'PASSWORD_UNCHANGED',
            message: 'New password must be different from the current password.',
        });
        return;
    }
    const creds = await prisma_1.prisma.credenziali.findUnique({
        where: { id_persona: sub },
    });
    if (!creds) {
        res.status(404).json({
            error: 'USER_NOT_FOUND',
            message: 'User not found.',
        });
        return;
    }
    const matches = await bcryptjs_1.default.compare(old_password, creds.password);
    if (!matches) {
        res.status(400).json({
            error: 'INVALID_OLD_PASSWORD',
            message: 'Current password is incorrect.',
        });
        return;
    }
    const hashed = await bcryptjs_1.default.hash(new_password, 12);
    await prisma_1.prisma.credenziali.update({
        where: { id_persona: sub },
        data: { password: hashed },
    });
    res.json({ message: 'Password updated successfully.' });
}
async function deleteUserAccount(req, res) {
    const parsedParams = DeleteUserParamsSchema.safeParse(req.params);
    if (!parsedParams.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsedParams.error.errors[0]?.message ?? 'Invalid user id.',
        });
        return;
    }
    const requester = req.user;
    const targetUserId = parsedParams.data.id_persona;
    const isSelf = requester.sub === targetUserId;
    if (!isSelf && !requester.is_superuser) {
        res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You can only delete your own account unless you are a superuser.',
        });
        return;
    }
    const targetUser = await prisma_1.prisma.persona.findUnique({
        where: { id_persona: targetUserId },
        select: {
            id_persona: true,
            username: true,
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
    if (!targetUser.credenziali) {
        res.status(409).json({
            error: 'ACCOUNT_ALREADY_DELETED',
            message: 'This account has already been removed.',
        });
        return;
    }
    let anonymizedUsername = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const suffix = `${Date.now().toString(36)}${attempt}`;
        const candidate = `deleted_user_${targetUserId}_${suffix}`.slice(0, 50);
        const exists = await prisma_1.prisma.persona.findUnique({
            where: { username: candidate },
            select: { id_persona: true },
        });
        if (!exists) {
            anonymizedUsername = candidate;
            break;
        }
    }
    if (!anonymizedUsername) {
        res.status(500).json({
            error: 'ACCOUNT_DELETE_FAILED',
            message: 'Unable to generate anonymized profile identifier.',
        });
        return;
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.credenziali.delete({
            where: { id_persona: targetUserId },
        });
        await tx.persona.update({
            where: { id_persona: targetUserId },
            data: {
                username: anonymizedUsername,
                photo_url: null,
                is_banned: true,
            },
        });
    });
    if (isSelf) {
        clearRefreshCookies(res);
    }
    res.json({
        message: isSelf
            ? 'Your account has been deleted successfully.'
            : `User ${targetUserId} account has been deleted successfully.`,
    });
}
async function changeMyUsername(req, res) {
    const parsed = ChangeUsernameSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Invalid payload.',
        });
        return;
    }
    const { sub, is_superuser } = req.user;
    const newUsername = parsed.data.username;
    const rows = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
    SELECT id_persona, username, username_changed_at
    FROM persona
    WHERE id_persona = ${sub}
    LIMIT 1
  `);
    const persona = rows[0] ?? null;
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
        const updated = await prisma_1.prisma.persona.update({
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
        await prisma_1.prisma.$executeRaw(client_1.Prisma.sql `
      UPDATE persona
      SET username_changed_at = NOW()
      WHERE id_persona = ${sub}
    `);
        const payload = {
            sub: updated.id_persona,
            username: updated.username,
            is_superuser,
        };
        const accessToken = (0, jwt_1.signAccessToken)(payload);
        const refreshToken = (0, jwt_1.signRefreshToken)(payload);
        setRefreshCookie(res, refreshToken);
        res.json({
            message: 'Username updated successfully.',
            access_token: accessToken,
            user: {
                id_persona: updated.id_persona,
                username: updated.username,
                photo_url: updated.photo_url,
                is_superuser: updated.is_superuser,
                is_banned: updated.is_banned,
            },
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002') {
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
async function changeMyPhoto(req, res) {
    const parsed = ChangePhotoSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Invalid payload.',
        });
        return;
    }
    const { sub } = req.user;
    const photoUrl = (() => {
        const raw = parsed.data.photo_url;
        if (raw === undefined || raw === null)
            return null;
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : null;
    })();
    try {
        const updated = await prisma_1.prisma.persona.update({
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
            message: 'Profile photo updated successfully.',
            user: updated,
        });
    }
    catch {
        res.status(500).json({
            error: 'PHOTO_UPDATE_FAILED',
            message: 'Unable to update profile photo.',
        });
    }
}
async function changeMyEmail(req, res) {
    const parsed = ChangeEmailSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Invalid payload.',
        });
        return;
    }
    const { sub } = req.user;
    const nextEmail = parsed.data.email.trim().toLowerCase();
    const currentCreds = await prisma_1.prisma.credenziali.findUnique({
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
        await prisma_1.prisma.credenziali.update({
            where: { id_persona: sub },
            data: { email: nextEmail },
        });
        res.json({
            message: 'Email updated successfully.',
            email: nextEmail,
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002') {
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
// ─── Utility ──────────────────────────────────────────────────
function setRefreshCookie(res, token) {
    res.cookie('refresh_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni in ms
        path: REFRESH_COOKIE_PATH,
    });
}
function clearRefreshCookies(res) {
    const baseOptions = {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
    };
    res.clearCookie('refresh_token', { ...baseOptions, path: REFRESH_COOKIE_PATH });
    res.clearCookie('refreshToken', { ...baseOptions, path: REFRESH_COOKIE_PATH });
    // Backward compatibility in case older cookies were issued at '/'.
    res.clearCookie('refresh_token', { ...baseOptions, path: '/' });
    res.clearCookie('refreshToken', { ...baseOptions, path: '/' });
}
