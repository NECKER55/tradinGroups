"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendFriendRequest = sendFriendRequest;
exports.getMyFriendships = getMyFriendships;
exports.acceptFriendRequest = acceptFriendRequest;
exports.rejectFriendRequest = rejectFriendRequest;
exports.cancelSentFriendRequest = cancelSentFriendRequest;
exports.removeFriendship = removeFriendship;
exports.blockUser = blockUser;
exports.unblockUser = unblockUser;
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const SendFriendRequestSchema = zod_1.z.object({
    id_persona: zod_1.z.coerce.number().int().positive(),
});
const FriendshipActionParamsSchema = zod_1.z.object({
    id_persona: zod_1.z.coerce.number().int().positive(),
});
async function findFriendshipBetween(userA, userB) {
    return prisma_1.prisma.amicizia.findFirst({
        where: {
            OR: [
                { id_persona_1: userA, id_persona_2: userB },
                { id_persona_1: userB, id_persona_2: userA },
            ],
        },
    });
}
function parseOtherUserId(req, res) {
    const parsed = FriendshipActionParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Parametri non validi.',
        });
        return null;
    }
    return parsed.data.id_persona;
}
async function sendFriendRequest(req, res) {
    const parsed = SendFriendRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const receiverId = parsed.data.id_persona;
    if (receiverId === sub) {
        res.status(400).json({
            error: 'SELF_FRIENDSHIP_NOT_ALLOWED',
            message: 'Non puoi inviare una richiesta di amicizia a te stesso.',
        });
        return;
    }
    const receiver = await prisma_1.prisma.persona.findUnique({
        where: { id_persona: receiverId },
        select: { id_persona: true },
    });
    if (!receiver) {
        res.status(404).json({
            error: 'USER_NOT_FOUND',
            message: 'Utente destinatario non trovato.',
        });
        return;
    }
    try {
        const friendship = await prisma_1.prisma.$transaction(async (tx) => {
            const lockA = Math.min(sub, receiverId);
            const lockB = Math.max(sub, receiverId);
            // Lock deterministico per coppia utenti: evita race condition su richieste incrociate.
            await tx.$executeRaw `SELECT pg_advisory_xact_lock(${lockA}::int, ${lockB}::int)`;
            const existing = await tx.amicizia.findFirst({
                where: {
                    OR: [
                        { id_persona_1: sub, id_persona_2: receiverId },
                        { id_persona_1: receiverId, id_persona_2: sub },
                    ],
                },
            });
            if (existing) {
                if (existing.user_block === receiverId) {
                    throw new Error('BLOCKED_BY_USER');
                }
                if (existing.user_block === sub) {
                    throw new Error('YOU_BLOCKED_USER');
                }
                if (existing.status === 'Accepted') {
                    throw new Error('ALREADY_FRIENDS');
                }
                if (existing.id_persona_1 === sub) {
                    throw new Error('REQUEST_ALREADY_SENT');
                }
                throw new Error('REQUEST_ALREADY_RECEIVED');
            }
            return tx.amicizia.create({
                data: {
                    id_persona_1: sub,
                    id_persona_2: receiverId,
                    status: 'Pending',
                    user_block: null,
                },
            });
        });
        res.status(201).json({
            message: 'Richiesta di amicizia inviata.',
            friendship,
        });
    }
    catch (error) {
        const code = error instanceof Error ? error.message : 'FRIENDSHIP_CONFLICT';
        if (code === 'BLOCKED_BY_USER') {
            res.status(403).json({
                error: 'BLOCKED_BY_USER',
                message: 'Non puoi inviare richieste a questo utente.',
            });
            return;
        }
        if (code === 'YOU_BLOCKED_USER') {
            res.status(409).json({
                error: 'YOU_BLOCKED_USER',
                message: 'Hai bloccato questo utente. Sbloccalo prima di inviare richieste.',
            });
            return;
        }
        if (code === 'ALREADY_FRIENDS') {
            res.status(409).json({
                error: 'ALREADY_FRIENDS',
                message: 'Siete gia amici.',
            });
            return;
        }
        if (code === 'REQUEST_ALREADY_SENT') {
            res.status(409).json({
                error: 'REQUEST_ALREADY_SENT',
                message: 'Hai gia inviato una richiesta pendente a questo utente.',
            });
            return;
        }
        if (code === 'REQUEST_ALREADY_RECEIVED') {
            res.status(409).json({
                error: 'REQUEST_ALREADY_RECEIVED',
                message: 'Hai gia una richiesta pendente da questo utente.',
            });
            return;
        }
        res.status(409).json({
            error: 'FRIENDSHIP_CONFLICT',
            message: 'Esiste gia una relazione tra questi due utenti.',
        });
    }
}
async function getMyFriendships(req, res) {
    const { sub } = req.user;
    const rows = await prisma_1.prisma.amicizia.findMany({
        where: {
            OR: [
                { id_persona_1: sub },
                { id_persona_2: sub },
            ],
        },
        include: {
            persona1: {
                select: {
                    id_persona: true,
                    username: true,
                    photo_url: true,
                },
            },
            persona2: {
                select: {
                    id_persona: true,
                    username: true,
                    photo_url: true,
                },
            },
        },
        orderBy: {
            data_inizio: 'desc',
        },
    });
    const results = rows
        .filter((row) => {
        const counterpartId = row.id_persona_1 === sub ? row.id_persona_2 : row.id_persona_1;
        // Se chi cerca e stato bloccato dalla controparte, la riga non deve comparire.
        return row.user_block !== counterpartId;
    })
        .map((row) => {
        const isSender = row.id_persona_1 === sub;
        const counterpart = isSender ? row.persona2 : row.persona1;
        return {
            id_persona: counterpart.id_persona,
            username: counterpart.username,
            photo_url: counterpart.photo_url,
            status: row.status,
            direction: row.status === 'Pending' ? (isSender ? 'outgoing' : 'incoming') : 'friend',
            blocked_by_me: row.user_block === sub,
        };
    });
    res.json({
        count: results.length,
        results,
    });
}
async function acceptFriendRequest(req, res) {
    const { sub } = req.user;
    const otherUserId = parseOtherUserId(req, res);
    if (otherUserId === null) {
        return;
    }
    if (otherUserId === sub) {
        res.status(400).json({
            error: 'SELF_ACTION_NOT_ALLOWED',
            message: 'Operazione non valida su te stesso.',
        });
        return;
    }
    const friendship = await findFriendshipBetween(sub, otherUserId);
    if (!friendship) {
        res.status(404).json({
            error: 'FRIENDSHIP_NOT_FOUND',
            message: 'Nessuna relazione trovata con questo utente.',
        });
        return;
    }
    if (friendship.status !== 'Pending') {
        res.status(409).json({
            error: 'NOT_PENDING',
            message: 'Questa relazione non e in stato Pending.',
        });
        return;
    }
    if (friendship.id_persona_2 !== sub) {
        res.status(403).json({
            error: 'ONLY_RECEIVER_CAN_RESPOND',
            message: 'Solo il destinatario della richiesta puo accettare o rifiutare.',
        });
        return;
    }
    const updated = await prisma_1.prisma.amicizia.update({
        where: {
            id_persona_1_id_persona_2: {
                id_persona_1: friendship.id_persona_1,
                id_persona_2: friendship.id_persona_2,
            },
        },
        data: {
            status: 'Accepted',
            user_block: null,
        },
    });
    res.json({
        message: 'Richiesta di amicizia accettata.',
        friendship: updated,
    });
}
async function rejectFriendRequest(req, res) {
    const { sub } = req.user;
    const otherUserId = parseOtherUserId(req, res);
    if (otherUserId === null) {
        return;
    }
    if (otherUserId === sub) {
        res.status(400).json({
            error: 'SELF_ACTION_NOT_ALLOWED',
            message: 'Operazione non valida su te stesso.',
        });
        return;
    }
    const friendship = await findFriendshipBetween(sub, otherUserId);
    if (!friendship) {
        res.status(404).json({
            error: 'FRIENDSHIP_NOT_FOUND',
            message: 'Nessuna relazione trovata con questo utente.',
        });
        return;
    }
    if (friendship.status !== 'Pending') {
        res.status(409).json({
            error: 'NOT_PENDING',
            message: 'Questa relazione non e in stato Pending.',
        });
        return;
    }
    if (friendship.id_persona_2 !== sub) {
        res.status(403).json({
            error: 'ONLY_RECEIVER_CAN_RESPOND',
            message: 'Solo il destinatario della richiesta puo accettare o rifiutare.',
        });
        return;
    }
    await prisma_1.prisma.amicizia.delete({
        where: {
            id_persona_1_id_persona_2: {
                id_persona_1: friendship.id_persona_1,
                id_persona_2: friendship.id_persona_2,
            },
        },
    });
    res.json({ message: 'Richiesta di amicizia rifiutata e rimossa.' });
}
async function cancelSentFriendRequest(req, res) {
    const { sub } = req.user;
    const otherUserId = parseOtherUserId(req, res);
    if (otherUserId === null) {
        return;
    }
    if (otherUserId === sub) {
        res.status(400).json({
            error: 'SELF_ACTION_NOT_ALLOWED',
            message: 'Operazione non valida su te stesso.',
        });
        return;
    }
    const friendship = await findFriendshipBetween(sub, otherUserId);
    if (!friendship) {
        res.status(404).json({
            error: 'FRIENDSHIP_NOT_FOUND',
            message: 'Nessuna relazione trovata con questo utente.',
        });
        return;
    }
    if (friendship.status !== 'Pending') {
        res.status(409).json({
            error: 'NOT_PENDING',
            message: 'La richiesta non e in stato Pending.',
        });
        return;
    }
    await prisma_1.prisma.amicizia.delete({
        where: {
            id_persona_1_id_persona_2: {
                id_persona_1: friendship.id_persona_1,
                id_persona_2: friendship.id_persona_2,
            },
        },
    });
    res.json({ message: 'Richiesta di amicizia revocata e rimossa.' });
}
async function removeFriendship(req, res) {
    const { sub } = req.user;
    const otherUserId = parseOtherUserId(req, res);
    if (otherUserId === null) {
        return;
    }
    if (otherUserId === sub) {
        res.status(400).json({
            error: 'SELF_ACTION_NOT_ALLOWED',
            message: 'Operazione non valida su te stesso.',
        });
        return;
    }
    const friendship = await findFriendshipBetween(sub, otherUserId);
    if (!friendship) {
        res.status(404).json({
            error: 'FRIENDSHIP_NOT_FOUND',
            message: 'Nessuna relazione trovata con questo utente.',
        });
        return;
    }
    if (friendship.status !== 'Accepted') {
        res.status(409).json({
            error: 'NOT_FRIENDS',
            message: 'Non esiste un\'amicizia accettata da rimuovere.',
        });
        return;
    }
    await prisma_1.prisma.amicizia.delete({
        where: {
            id_persona_1_id_persona_2: {
                id_persona_1: friendship.id_persona_1,
                id_persona_2: friendship.id_persona_2,
            },
        },
    });
    res.json({ message: 'Amicizia rimossa con successo.' });
}
async function blockUser(req, res) {
    const { sub } = req.user;
    const otherUserId = parseOtherUserId(req, res);
    if (otherUserId === null) {
        return;
    }
    if (otherUserId === sub) {
        res.status(400).json({
            error: 'SELF_ACTION_NOT_ALLOWED',
            message: 'Operazione non valida su te stesso.',
        });
        return;
    }
    const friendship = await findFriendshipBetween(sub, otherUserId);
    if (!friendship) {
        res.status(404).json({
            error: 'FRIENDSHIP_NOT_FOUND',
            message: 'Nessuna relazione trovata con questo utente.',
        });
        return;
    }
    const updated = await prisma_1.prisma.amicizia.update({
        where: {
            id_persona_1_id_persona_2: {
                id_persona_1: friendship.id_persona_1,
                id_persona_2: friendship.id_persona_2,
            },
        },
        data: {
            user_block: sub,
        },
    });
    res.json({
        message: 'Utente bloccato con successo.',
        friendship: updated,
    });
}
async function unblockUser(req, res) {
    const { sub } = req.user;
    const otherUserId = parseOtherUserId(req, res);
    if (otherUserId === null) {
        return;
    }
    if (otherUserId === sub) {
        res.status(400).json({
            error: 'SELF_ACTION_NOT_ALLOWED',
            message: 'Operazione non valida su te stesso.',
        });
        return;
    }
    const friendship = await findFriendshipBetween(sub, otherUserId);
    if (!friendship) {
        res.status(404).json({
            error: 'FRIENDSHIP_NOT_FOUND',
            message: 'Nessuna relazione trovata con questo utente.',
        });
        return;
    }
    if (friendship.user_block !== sub) {
        res.status(409).json({
            error: 'NOT_BLOCKED_BY_YOU',
            message: 'Questo utente non e bloccato da te.',
        });
        return;
    }
    const updated = await prisma_1.prisma.amicizia.update({
        where: {
            id_persona_1_id_persona_2: {
                id_persona_1: friendship.id_persona_1,
                id_persona_2: friendship.id_persona_2,
            },
        },
        data: {
            user_block: null,
        },
    });
    res.json({
        message: 'Utente sbloccato con successo.',
        friendship: updated,
    });
}
