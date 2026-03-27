"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGroup = createGroup;
exports.deleteGroup = deleteGroup;
exports.inviteToGroup = inviteToGroup;
exports.cancelSentGroupInvite = cancelSentGroupInvite;
exports.updateGroupBudget = updateGroupBudget;
exports.removeGroupMember = removeGroupMember;
exports.promoteMember = promoteMember;
exports.demoteMember = demoteMember;
exports.leaveGroup = leaveGroup;
exports.getMyPendingGroupInvites = getMyPendingGroupInvites;
exports.getMySentGroupInvites = getMySentGroupInvites;
exports.acceptGroupInvite = acceptGroupInvite;
exports.rejectGroupInvite = rejectGroupInvite;
exports.getGroupMembers = getGroupMembers;
exports.getGroupPublicProfile = getGroupPublicProfile;
exports.searchGroupsByName = searchGroupsByName;
exports.updateGroupPrivacy = updateGroupPrivacy;
exports.updateGroupName = updateGroupName;
exports.updateGroupDescription = updateGroupDescription;
exports.updateGroupPhoto = updateGroupPhoto;
exports.getMyGroups = getMyGroups;
exports.getGroupRanking = getGroupRanking;
exports.getMyGroupWorkspace = getMyGroupWorkspace;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const GroupIdParamsSchema = zod_1.z.object({
    id_gruppo: zod_1.z.coerce.number().int().positive(),
});
const MemberParamsSchema = zod_1.z.object({
    id_gruppo: zod_1.z.coerce.number().int().positive(),
    id_persona: zod_1.z.coerce.number().int().positive(),
});
const GroupInviteParamsSchema = zod_1.z.object({
    id_gruppo: zod_1.z.coerce.number().int().positive(),
});
const GroupSearchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().trim().min(1).max(100),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
const CreateGroupSchema = zod_1.z.object({
    nome: zod_1.z.string().trim().min(3).max(100),
    privacy: zod_1.z.enum(['Public', 'Private']).default('Private'),
    photo_url: zod_1.z.string().trim().url().max(255).optional(),
    descrizione: zod_1.z.string().trim().max(1000).optional(),
    budget_iniziale: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
});
const InviteToGroupSchema = zod_1.z.object({
    id_persona: zod_1.z.coerce.number().int().positive(),
});
const UpdateGroupBudgetSchema = zod_1.z.object({
    id_persona: zod_1.z.coerce.number().int().positive(),
    delta_budget: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]),
}).superRefine((data, ctx) => {
    const value = String(data.delta_budget).trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(value)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['delta_budget'],
            message: 'delta_budget non valido.',
        });
        return;
    }
    const delta = new client_1.Prisma.Decimal(value);
    if (delta.eq(0)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            path: ['delta_budget'],
            message: 'delta_budget non puo essere 0.',
        });
    }
});
const UpdateGroupPrivacySchema = zod_1.z.object({
    privacy: zod_1.z.enum(['Public', 'Private']),
});
const UpdateGroupNameSchema = zod_1.z.object({
    nome: zod_1.z.string().trim().min(3).max(100),
});
const UpdateGroupDescriptionSchema = zod_1.z.object({
    descrizione: zod_1.z.string().trim().max(1000).optional(),
});
const UpdateGroupPhotoSchema = zod_1.z.object({
    photo_url: zod_1.z.string().trim().url().max(255).nullable().optional(),
});
const LeaveGroupSchema = zod_1.z.object({
    new_owner_id: zod_1.z.coerce.number().int().positive().optional(),
});
function parsePositiveBudget(raw) {
    const value = String(raw ?? '0').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
        throw new Error('INVALID_BUDGET');
    }
    const budget = new client_1.Prisma.Decimal(value);
    if (budget.lt(0)) {
        throw new Error('INVALID_BUDGET');
    }
    return budget;
}
async function getMembershipOrNull(id_gruppo, id_persona) {
    return prisma_1.prisma.membro_Gruppo.findUnique({
        where: {
            id_persona_id_gruppo: {
                id_persona,
                id_gruppo,
            },
        },
    });
}
async function requireMembership(id_gruppo, id_persona, res) {
    const membership = await getMembershipOrNull(id_gruppo, id_persona);
    if (!membership) {
        res.status(403).json({
            error: 'GROUP_FORBIDDEN',
            message: 'Non fai parte di questo gruppo.',
        });
        return null;
    }
    return membership;
}
function getRequesterId(req) {
    return req.user?.sub ?? null;
}
function serializeTransactionForResponse(t) {
    return {
        id_transazione: t.id_transazione,
        id_portafoglio: t.id_portafoglio,
        id_stock: t.id_stock,
        tipo: t.tipo,
        stato: t.stato,
        prezzo_esecuzione: t.prezzo_esecuzione.toString(),
        importo_investito: t.importo_investito?.toString() ?? null,
        quantita_azioni: t.quantita_azioni?.toString() ?? null,
        created_at: t.created_at,
        approved_at: t.approved_at,
    };
}
async function getGroupReadContext(id_gruppo, requesterId) {
    const group = await prisma_1.prisma.gruppo.findUnique({
        where: { id_gruppo },
        select: {
            id_gruppo: true,
            nome: true,
            privacy: true,
            photo_url: true,
            descrizione: true,
            budget_iniziale: true,
        },
    });
    if (!group) {
        return {
            group: null,
            isMember: false,
            canRead: false,
        };
    }
    if (group.privacy === 'Public') {
        return {
            group,
            isMember: false,
            canRead: true,
        };
    }
    if (!requesterId) {
        return {
            group,
            isMember: false,
            canRead: false,
        };
    }
    const membership = await getMembershipOrNull(id_gruppo, requesterId);
    return {
        group,
        isMember: Boolean(membership),
        canRead: Boolean(membership),
    };
}
async function createGroup(req, res) {
    const parsed = CreateGroupSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const groupInitialBudget = (() => {
        try {
            return parsePositiveBudget(parsed.data.budget_iniziale);
        }
        catch {
            return null;
        }
    })();
    if (!groupInitialBudget) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'budget_iniziale non valido.',
        });
        return;
    }
    try {
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const group = await tx.gruppo.create({
                data: {
                    nome: parsed.data.nome,
                    privacy: parsed.data.privacy,
                    photo_url: parsed.data.photo_url,
                    descrizione: parsed.data.descrizione ? parsed.data.descrizione.trim() : null,
                    budget_iniziale: groupInitialBudget,
                },
            });
            const membership = await tx.membro_Gruppo.create({
                data: {
                    id_persona: sub,
                    id_gruppo: group.id_gruppo,
                    ruolo: 'Owner',
                    budget_iniziale: groupInitialBudget,
                },
            });
            return { group, membership };
        });
        res.status(201).json({
            message: 'Gruppo creato con successo.',
            group: result.group,
            membership: result.membership,
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002') {
            res.status(409).json({
                error: 'GROUP_NAME_ALREADY_EXISTS',
                message: 'Esiste gia un gruppo con questo nome.',
            });
            return;
        }
        res.status(500).json({
            error: 'GROUP_CREATION_FAILED',
            message: 'Impossibile creare il gruppo.',
        });
    }
}
async function deleteGroup(req, res) {
    const parsed = GroupIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_gruppo non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsed.data;
    const membership = await getMembershipOrNull(id_gruppo, sub);
    if (!membership || membership.ruolo !== 'Owner') {
        res.status(403).json({
            error: 'ONLY_OWNER_CAN_DELETE_GROUP',
            message: 'Solo l\'owner puo eliminare il gruppo.',
        });
        return;
    }
    const deleted = await prisma_1.prisma.gruppo.deleteMany({
        where: { id_gruppo },
    });
    if (deleted.count === 0) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    res.json({ message: 'Gruppo eliminato con tutti i dati associati.' });
}
async function inviteToGroup(req, res) {
    const parsedParams = GroupIdParamsSchema.safeParse(req.params);
    const parsedBody = InviteToGroupSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsedParams.error?.errors[0]?.message
                ?? parsedBody.error?.errors[0]?.message
                ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsedParams.data;
    const { id_persona } = parsedBody.data;
    if (id_persona === sub) {
        res.status(400).json({
            error: 'INVALID_INVITE',
            message: 'Non puoi invitare te stesso.',
        });
        return;
    }
    const actorMembership = await requireMembership(id_gruppo, sub, res);
    if (!actorMembership) {
        return;
    }
    if (!['Owner', 'Admin'].includes(actorMembership.ruolo)) {
        res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: 'Solo Owner o Admin possono invitare utenti.',
        });
        return;
    }
    const [invitee, existingMember, existingInvite] = await Promise.all([
        prisma_1.prisma.persona.findUnique({
            where: { id_persona },
            select: { id_persona: true },
        }),
        getMembershipOrNull(id_gruppo, id_persona),
        prisma_1.prisma.invito_Gruppo.findFirst({
            where: {
                id_gruppo,
                id_invitato: id_persona,
            },
        }),
    ]);
    if (!invitee) {
        res.status(404).json({
            error: 'USER_NOT_FOUND',
            message: 'Utente invitato non trovato.',
        });
        return;
    }
    if (existingMember) {
        res.status(409).json({
            error: 'ALREADY_MEMBER',
            message: 'L\'utente fa gia parte del gruppo.',
        });
        return;
    }
    if (existingInvite) {
        res.status(409).json({
            error: 'INVITE_ALREADY_PENDING',
            message: 'Esiste gia un invito pendente per questo utente nel gruppo.',
        });
        return;
    }
    const invite = await prisma_1.prisma.invito_Gruppo.create({
        data: {
            id_gruppo,
            id_invitato: id_persona,
            id_mittente: sub,
        },
    });
    res.status(201).json({
        message: 'Invito inviato con successo.',
        invite,
    });
}
async function cancelSentGroupInvite(req, res) {
    const parsed = MemberParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Parametri non validi.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo, id_persona } = parsed.data;
    const actorMembership = await requireMembership(id_gruppo, sub, res);
    if (!actorMembership) {
        return;
    }
    if (!['Owner', 'Admin'].includes(actorMembership.ruolo)) {
        res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: 'Solo Owner o Admin possono annullare inviti pendenti.',
        });
        return;
    }
    const deleted = await prisma_1.prisma.invito_Gruppo.deleteMany({
        where: {
            id_gruppo,
            id_invitato: id_persona,
            id_mittente: sub,
        },
    });
    if (deleted.count === 0) {
        res.status(404).json({
            error: 'INVITE_NOT_FOUND',
            message: 'Invito non trovato o non inviato da te.',
        });
        return;
    }
    res.json({
        message: 'Invito annullato con successo.',
    });
}
async function updateGroupBudget(req, res) {
    const parsedParams = GroupIdParamsSchema.safeParse(req.params);
    const parsedBody = UpdateGroupBudgetSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsedParams.error?.errors[0]?.message
                ?? parsedBody.error?.errors[0]?.message
                ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsedParams.data;
    const { id_persona } = parsedBody.data;
    const delta = new client_1.Prisma.Decimal(String(parsedBody.data.delta_budget));
    const actorMembership = await requireMembership(id_gruppo, sub, res);
    if (!actorMembership) {
        return;
    }
    if (!['Owner', 'Admin'].includes(actorMembership.ruolo)) {
        res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: 'Solo Owner o Admin possono modificare il budget.',
        });
        return;
    }
    const targetMembership = await getMembershipOrNull(id_gruppo, id_persona);
    if (!targetMembership) {
        res.status(404).json({
            error: 'MEMBER_NOT_FOUND',
            message: 'Membro non trovato nel gruppo.',
        });
        return;
    }
    try {
        const updatedPortfolio = await prisma_1.prisma.$transaction(async (tx) => {
            if (delta.gt(0)) {
                await tx.portafoglio.updateMany({
                    where: {
                        id_gruppo,
                        id_persona,
                    },
                    data: {
                        liquidita: { increment: delta },
                    },
                });
                await tx.membro_Gruppo.update({
                    where: {
                        id_persona_id_gruppo: {
                            id_persona,
                            id_gruppo,
                        },
                    },
                    data: {
                        budget_iniziale: { increment: delta },
                    },
                });
            }
            else {
                const absDelta = delta.abs();
                const updated = await tx.portafoglio.updateMany({
                    where: {
                        id_gruppo,
                        id_persona,
                        liquidita: { gte: absDelta },
                    },
                    data: {
                        liquidita: { decrement: absDelta },
                    },
                });
                if (updated.count === 0) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }
                await tx.membro_Gruppo.update({
                    where: {
                        id_persona_id_gruppo: {
                            id_persona,
                            id_gruppo,
                        },
                    },
                    data: {
                        budget_iniziale: { decrement: absDelta },
                    },
                });
            }
            return tx.portafoglio.findFirst({
                where: {
                    id_gruppo,
                    id_persona,
                },
                select: {
                    id_portafoglio: true,
                    liquidita: true,
                },
            });
        });
        res.json({
            message: 'Budget aggiornato con successo.',
            portfolio: updatedPortfolio
                ? {
                    id_portafoglio: updatedPortfolio.id_portafoglio,
                    liquidita: updatedPortfolio.liquidita.toString(),
                }
                : null,
        });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
            res.status(400).json({
                error: 'INSUFFICIENT_FUNDS',
                message: 'Liquidita insufficiente per rimuovere questo budget.',
            });
            return;
        }
        res.status(500).json({
            error: 'BUDGET_UPDATE_FAILED',
            message: 'Impossibile aggiornare il budget del membro.',
        });
    }
}
async function removeGroupMember(req, res) {
    const parsed = MemberParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Parametri non validi.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo, id_persona } = parsed.data;
    if (id_persona === sub) {
        res.status(400).json({
            error: 'INVALID_OPERATION',
            message: 'Per uscire dal gruppo usa l\'endpoint di abbandono.',
        });
        return;
    }
    const actorMembership = await requireMembership(id_gruppo, sub, res);
    if (!actorMembership) {
        return;
    }
    const targetMembership = await getMembershipOrNull(id_gruppo, id_persona);
    if (!targetMembership) {
        res.status(404).json({
            error: 'MEMBER_NOT_FOUND',
            message: 'Membro non trovato nel gruppo.',
        });
        return;
    }
    if (targetMembership.ruolo === 'Owner') {
        res.status(403).json({
            error: 'CANNOT_EXPEL_OWNER',
            message: 'L\'owner non puo essere espulso.',
        });
        return;
    }
    if (actorMembership.ruolo === 'Admin' && targetMembership.ruolo !== 'User') {
        res.status(403).json({
            error: 'ADMIN_CAN_EXPEL_ONLY_USER',
            message: 'Un admin puo espellere solo utenti con ruolo User.',
        });
        return;
    }
    if (actorMembership.ruolo === 'Owner' && !['Admin', 'User'].includes(targetMembership.ruolo)) {
        res.status(403).json({
            error: 'INVALID_TARGET_ROLE',
            message: 'L\'owner puo espellere solo Admin o User.',
        });
        return;
    }
    if (!['Owner', 'Admin'].includes(actorMembership.ruolo)) {
        res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: 'Solo Owner o Admin possono espellere membri.',
        });
        return;
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.portafoglio.deleteMany({
            where: {
                id_gruppo,
                id_persona,
            },
        });
        await tx.membro_Gruppo.delete({
            where: {
                id_persona_id_gruppo: {
                    id_persona,
                    id_gruppo,
                },
            },
        });
    });
    res.json({ message: 'Membro espulso dal gruppo.' });
}
async function promoteMember(req, res) {
    const parsed = MemberParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Parametri non validi.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo, id_persona } = parsed.data;
    const ownerMembership = await getMembershipOrNull(id_gruppo, sub);
    if (!ownerMembership || ownerMembership.ruolo !== 'Owner') {
        res.status(403).json({
            error: 'ONLY_OWNER_CAN_PROMOTE',
            message: 'Solo l\'owner puo promuovere i membri.',
        });
        return;
    }
    const targetMembership = await getMembershipOrNull(id_gruppo, id_persona);
    if (!targetMembership) {
        res.status(404).json({
            error: 'MEMBER_NOT_FOUND',
            message: 'Membro non trovato nel gruppo.',
        });
        return;
    }
    if (targetMembership.ruolo === 'User') {
        const updated = await prisma_1.prisma.membro_Gruppo.update({
            where: {
                id_persona_id_gruppo: {
                    id_persona,
                    id_gruppo,
                },
            },
            data: {
                ruolo: 'Admin',
            },
        });
        res.json({
            message: 'Utente promosso a Admin.',
            member: updated,
        });
        return;
    }
    if (targetMembership.ruolo === 'Admin') {
        if (id_persona === sub) {
            res.status(400).json({
                error: 'INVALID_OPERATION',
                message: 'Non puoi auto-promuoverti: sei gia Owner.',
            });
            return;
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.membro_Gruppo.update({
                where: {
                    id_persona_id_gruppo: {
                        id_persona: sub,
                        id_gruppo,
                    },
                },
                data: {
                    ruolo: 'Admin',
                },
            });
            return tx.membro_Gruppo.update({
                where: {
                    id_persona_id_gruppo: {
                        id_persona,
                        id_gruppo,
                    },
                },
                data: {
                    ruolo: 'Owner',
                },
            });
        });
        res.json({
            message: 'Ownership trasferita con successo.',
            new_owner: result,
        });
        return;
    }
    res.status(409).json({
        error: 'PROMOTION_NOT_ALLOWED',
        message: 'Puoi promuovere solo User->Admin o Admin->Owner.',
    });
}
async function demoteMember(req, res) {
    const parsed = MemberParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Parametri non validi.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo, id_persona } = parsed.data;
    const ownerMembership = await getMembershipOrNull(id_gruppo, sub);
    if (!ownerMembership || ownerMembership.ruolo !== 'Owner') {
        res.status(403).json({
            error: 'ONLY_OWNER_CAN_DEMOTE',
            message: 'Solo l\'owner puo declassare membri.',
        });
        return;
    }
    if (id_persona === sub) {
        res.status(400).json({
            error: 'OWNER_CANNOT_DEMOTE_SELF',
            message: 'L\'owner non puo declassare se stesso.',
        });
        return;
    }
    const targetMembership = await getMembershipOrNull(id_gruppo, id_persona);
    if (!targetMembership) {
        res.status(404).json({
            error: 'MEMBER_NOT_FOUND',
            message: 'Membro non trovato nel gruppo.',
        });
        return;
    }
    if (targetMembership.ruolo !== 'Admin') {
        res.status(409).json({
            error: 'DEMOTION_NOT_ALLOWED',
            message: 'Puoi declassare solo membri con ruolo Admin.',
        });
        return;
    }
    const updated = await prisma_1.prisma.membro_Gruppo.update({
        where: {
            id_persona_id_gruppo: {
                id_persona,
                id_gruppo,
            },
        },
        data: {
            ruolo: 'User',
        },
    });
    res.json({
        message: 'Admin declassato a User.',
        member: updated,
    });
}
async function leaveGroup(req, res) {
    const parsed = GroupIdParamsSchema.safeParse(req.params);
    const parsedBody = LeaveGroupSchema.safeParse(req.body ?? {});
    if (!parsed.success || !parsedBody.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error?.errors[0]?.message
                ?? parsedBody.error?.errors[0]?.message
                ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsed.data;
    const { new_owner_id } = parsedBody.data;
    const membership = await getMembershipOrNull(id_gruppo, sub);
    if (!membership) {
        res.status(403).json({
            error: 'GROUP_FORBIDDEN',
            message: 'Non fai parte di questo gruppo.',
        });
        return;
    }
    if (membership.ruolo === 'Owner') {
        const membersCount = await prisma_1.prisma.membro_Gruppo.count({
            where: { id_gruppo },
        });
        if (membersCount === 1) {
            await prisma_1.prisma.gruppo.deleteMany({ where: { id_gruppo } });
            res.json({ message: 'Owner unico: gruppo eliminato automaticamente.' });
            return;
        }
        if (!new_owner_id || new_owner_id === sub) {
            res.status(400).json({
                error: 'NEW_OWNER_REQUIRED',
                message: 'Devi selezionare un nuovo owner valido prima di abbandonare il gruppo.',
            });
            return;
        }
        const candidate = await getMembershipOrNull(id_gruppo, new_owner_id);
        if (!candidate) {
            res.status(404).json({
                error: 'NEW_OWNER_NOT_FOUND',
                message: 'Il nuovo owner selezionato non fa parte del gruppo.',
            });
            return;
        }
        if (candidate.ruolo === 'Owner') {
            res.status(400).json({
                error: 'INVALID_NEW_OWNER',
                message: 'Il nuovo owner selezionato e gia owner.',
            });
            return;
        }
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.invito_Gruppo.deleteMany({
                where: {
                    id_gruppo,
                    id_mittente: sub,
                },
            });
            await tx.portafoglio.deleteMany({
                where: {
                    id_gruppo,
                    id_persona: sub,
                },
            });
            await tx.membro_Gruppo.delete({
                where: {
                    id_persona_id_gruppo: {
                        id_persona: sub,
                        id_gruppo,
                    },
                },
            });
            await tx.membro_Gruppo.update({
                where: {
                    id_persona_id_gruppo: {
                        id_persona: new_owner_id,
                        id_gruppo,
                    },
                },
                data: {
                    ruolo: 'Owner',
                },
            });
        });
        res.json({ message: 'Ownership trasferita: hai abbandonato il gruppo con successo.' });
        return;
    }
    if (!['Admin', 'User'].includes(membership.ruolo)) {
        res.status(403).json({
            error: 'ROLE_CANNOT_LEAVE',
            message: 'Solo Admin o User possono abbandonare il gruppo con questa operazione.',
        });
        return;
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.invito_Gruppo.deleteMany({
            where: {
                id_gruppo,
                id_mittente: sub,
            },
        });
        await tx.portafoglio.deleteMany({
            where: {
                id_gruppo,
                id_persona: sub,
            },
        });
        await tx.membro_Gruppo.delete({
            where: {
                id_persona_id_gruppo: {
                    id_persona: sub,
                    id_gruppo,
                },
            },
        });
    });
    res.json({ message: 'Hai abbandonato il gruppo con successo.' });
}
async function getMyPendingGroupInvites(req, res) {
    const { sub } = req.user;
    const invites = await prisma_1.prisma.invito_Gruppo.findMany({
        where: {
            id_invitato: sub,
        },
        include: {
            gruppo: {
                select: {
                    id_gruppo: true,
                    nome: true,
                    privacy: true,
                    photo_url: true,
                    descrizione: true,
                    budget_iniziale: true,
                },
            },
            mittente: {
                select: {
                    id_persona: true,
                    username: true,
                    photo_url: true,
                },
            },
        },
        orderBy: {
            data_invito: 'desc',
        },
    });
    res.json({
        count: invites.length,
        invites: invites.map((invite) => ({
            id_gruppo: invite.id_gruppo,
            data_invito: invite.data_invito,
            gruppo: invite.gruppo,
            mittente: invite.mittente,
        })),
    });
}
async function getMySentGroupInvites(req, res) {
    const { sub } = req.user;
    const memberships = await prisma_1.prisma.membro_Gruppo.findMany({
        where: { id_persona: sub },
        select: { id_gruppo: true },
    });
    const memberGroupIds = memberships.map((row) => row.id_gruppo);
    if (memberGroupIds.length === 0) {
        res.json({
            count: 0,
            invites: [],
        });
        return;
    }
    const invites = await prisma_1.prisma.invito_Gruppo.findMany({
        where: {
            id_mittente: sub,
            id_gruppo: {
                in: memberGroupIds,
            },
        },
        include: {
            gruppo: {
                select: {
                    id_gruppo: true,
                    nome: true,
                    privacy: true,
                    photo_url: true,
                    descrizione: true,
                    budget_iniziale: true,
                },
            },
            invitato: {
                select: {
                    id_persona: true,
                    username: true,
                    photo_url: true,
                },
            },
        },
        orderBy: {
            data_invito: 'desc',
        },
    });
    res.json({
        count: invites.length,
        invites: invites.map((invite) => ({
            id_gruppo: invite.id_gruppo,
            data_invito: invite.data_invito,
            gruppo: invite.gruppo,
            invitato: invite.invitato,
        })),
    });
}
async function acceptGroupInvite(req, res) {
    const parsed = GroupInviteParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_gruppo non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsed.data;
    const existingMembership = await getMembershipOrNull(id_gruppo, sub);
    if (existingMembership) {
        res.status(409).json({
            error: 'ALREADY_MEMBER',
            message: 'Fai gia parte di questo gruppo.',
        });
        return;
    }
    const invite = await prisma_1.prisma.invito_Gruppo.findFirst({
        where: {
            id_invitato: sub,
            id_gruppo,
        },
        include: {
            gruppo: {
                select: {
                    id_gruppo: true,
                    budget_iniziale: true,
                },
            },
        },
    });
    if (!invite) {
        res.status(404).json({
            error: 'INVITE_NOT_FOUND',
            message: 'Invito non trovato.',
        });
        return;
    }
    const membership = await prisma_1.prisma.$transaction(async (tx) => {
        await tx.invito_Gruppo.deleteMany({
            where: {
                id_invitato: sub,
                id_gruppo,
            },
        });
        return tx.membro_Gruppo.create({
            data: {
                id_persona: sub,
                id_gruppo,
                ruolo: 'User',
                budget_iniziale: invite.gruppo.budget_iniziale,
            },
        });
    });
    res.json({
        message: 'Invito accettato. Sei entrato nel gruppo come User.',
        membership,
    });
}
async function rejectGroupInvite(req, res) {
    const parsed = GroupInviteParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_gruppo non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsed.data;
    const deleted = await prisma_1.prisma.invito_Gruppo.deleteMany({
        where: {
            id_invitato: sub,
            id_gruppo,
        },
    });
    if (deleted.count === 0) {
        res.status(404).json({
            error: 'INVITE_NOT_FOUND',
            message: 'Invito non trovato.',
        });
        return;
    }
    res.json({ message: 'Invito rifiutato e rimosso.' });
}
async function getGroupMembers(req, res) {
    const parsed = GroupIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_gruppo non valido.',
        });
        return;
    }
    const { id_gruppo } = parsed.data;
    const readContext = await getGroupReadContext(id_gruppo, getRequesterId(req));
    if (!readContext.group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    if (!readContext.canRead) {
        res.status(403).json({
            error: 'GROUP_PRIVATE',
            message: 'Questo gruppo e privato. Accesso consentito solo ai membri.',
        });
        return;
    }
    const members = await prisma_1.prisma.membro_Gruppo.findMany({
        where: { id_gruppo },
        include: {
            persona: {
                select: {
                    id_persona: true,
                    username: true,
                    photo_url: true,
                },
            },
        },
        orderBy: [
            { ruolo: 'asc' },
            { persona: { username: 'asc' } },
        ],
    });
    const portfolios = await prisma_1.prisma.portafoglio.findMany({
        where: { id_gruppo },
        select: {
            id_persona: true,
            id_portafoglio: true,
            liquidita: true,
        },
    });
    const portfolioByPerson = new Map();
    for (const row of portfolios) {
        portfolioByPerson.set(row.id_persona, {
            id_portafoglio: row.id_portafoglio,
            liquidita: row.liquidita,
        });
    }
    res.json({
        group: readContext.group,
        count: members.length,
        members: members.map((member) => ({
            id_persona: member.persona.id_persona,
            username: member.persona.username,
            photo_url: member.persona.photo_url,
            ruolo: member.ruolo,
            budget_iniziale: member.budget_iniziale.toString(),
            id_portafoglio: portfolioByPerson.get(member.persona.id_persona)?.id_portafoglio ?? null,
            portfolio_liquidita: portfolioByPerson.get(member.persona.id_persona)?.liquidita.toString() ?? null,
        })),
    });
}
async function getGroupPublicProfile(req, res) {
    const parsed = GroupIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_gruppo non valido.',
        });
        return;
    }
    const { id_gruppo } = parsed.data;
    const readContext = await getGroupReadContext(id_gruppo, getRequesterId(req));
    if (!readContext.group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    if (!readContext.canRead) {
        res.status(403).json({
            error: 'GROUP_PRIVATE',
            message: 'Questo gruppo e privato. Accesso consentito solo ai membri.',
        });
        return;
    }
    res.json({
        group: {
            id_gruppo: readContext.group.id_gruppo,
            nome: readContext.group.nome,
            photo_url: readContext.group.photo_url,
            privacy: readContext.group.privacy,
            descrizione: readContext.group.descrizione,
            budget_iniziale: readContext.group.budget_iniziale.toString(),
        },
    });
}
async function searchGroupsByName(req, res) {
    const parsed = GroupSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Query di ricerca non valida.',
        });
        return;
    }
    const requesterId = getRequesterId(req);
    const term = parsed.data.q.toLowerCase();
    const limit = parsed.data.limit;
    const isMemberSelect = requesterId
        ? client_1.Prisma.sql `
        EXISTS (
          SELECT 1
          FROM membro_gruppo mg
          WHERE mg.id_gruppo = g.id_gruppo
            AND mg.id_persona = ${requesterId}
        )
      `
        : client_1.Prisma.sql `false`;
    const visibilityFilter = requesterId
        ? client_1.Prisma.sql `
        (
          g.privacy = 'Public'
          OR EXISTS (
            SELECT 1
            FROM membro_gruppo mgv
            WHERE mgv.id_gruppo = g.id_gruppo
              AND mgv.id_persona = ${requesterId}
          )
        )
      `
        : client_1.Prisma.sql `g.privacy = 'Public'`;
    const groups = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
    SELECT
      g.id_gruppo,
      g.nome,
      g.privacy,
      g.photo_url,
      g.descrizione,
      g.budget_iniziale,
      ${isMemberSelect} AS is_member
    FROM gruppo g
    WHERE lower(g.nome) LIKE ${`${term}%`}
      AND ${visibilityFilter}
    ORDER BY g.nome ASC
    LIMIT ${limit}
  `);
    res.json({
        q: parsed.data.q,
        count: groups.length,
        results: groups.map((group) => ({
            ...group,
            budget_iniziale: group.budget_iniziale.toString(),
        })),
    });
}
async function updateGroupPrivacy(req, res) {
    const parsedParams = GroupIdParamsSchema.safeParse(req.params);
    const parsedBody = UpdateGroupPrivacySchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsedParams.error?.errors[0]?.message
                ?? parsedBody.error?.errors[0]?.message
                ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsedParams.data;
    const { privacy } = parsedBody.data;
    const group = await prisma_1.prisma.gruppo.findUnique({
        where: { id_gruppo },
        select: { id_gruppo: true, privacy: true },
    });
    if (!group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    const membership = await getMembershipOrNull(id_gruppo, sub);
    if (!membership || membership.ruolo !== 'Owner') {
        res.status(403).json({
            error: 'ONLY_OWNER_CAN_UPDATE_GROUP',
            message: 'Solo l\'owner puo modificare la privacy del gruppo.',
        });
        return;
    }
    if (group.privacy === privacy) {
        res.json({
            message: 'Privacy invariata.',
            group,
        });
        return;
    }
    const updated = await prisma_1.prisma.gruppo.update({
        where: { id_gruppo },
        data: { privacy },
        select: {
            id_gruppo: true,
            nome: true,
            privacy: true,
            photo_url: true,
            descrizione: true,
            budget_iniziale: true,
        },
    });
    res.json({
        message: 'Privacy gruppo aggiornata con successo.',
        group: updated,
    });
}
async function updateGroupName(req, res) {
    const parsedParams = GroupIdParamsSchema.safeParse(req.params);
    const parsedBody = UpdateGroupNameSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsedParams.error?.errors[0]?.message
                ?? parsedBody.error?.errors[0]?.message
                ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsedParams.data;
    const { nome } = parsedBody.data;
    const group = await prisma_1.prisma.gruppo.findUnique({
        where: { id_gruppo },
        select: { id_gruppo: true, nome: true },
    });
    if (!group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    const membership = await getMembershipOrNull(id_gruppo, sub);
    if (!membership || !['Owner', 'Admin'].includes(membership.ruolo)) {
        res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: 'Solo Owner o Admin possono modificare il nome del gruppo.',
        });
        return;
    }
    if (group.nome === nome) {
        res.json({
            message: 'Nome invariato.',
            group,
        });
        return;
    }
    try {
        const updated = await prisma_1.prisma.gruppo.update({
            where: { id_gruppo },
            data: { nome },
            select: {
                id_gruppo: true,
                nome: true,
                privacy: true,
                photo_url: true,
                descrizione: true,
                budget_iniziale: true,
            },
        });
        res.json({
            message: 'Nome gruppo aggiornato con successo.',
            group: updated,
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002') {
            res.status(409).json({
                error: 'GROUP_NAME_ALREADY_EXISTS',
                message: 'Esiste gia un gruppo con questo nome.',
            });
            return;
        }
        res.status(500).json({
            error: 'GROUP_NAME_UPDATE_FAILED',
            message: 'Impossibile aggiornare il nome del gruppo.',
        });
    }
}
async function updateGroupDescription(req, res) {
    const parsedParams = GroupIdParamsSchema.safeParse(req.params);
    const parsedBody = UpdateGroupDescriptionSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsedParams.error?.errors[0]?.message
                ?? parsedBody.error?.errors[0]?.message
                ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsedParams.data;
    const descrizione = parsedBody.data.descrizione?.trim() || null;
    const group = await prisma_1.prisma.gruppo.findUnique({
        where: { id_gruppo },
        select: { id_gruppo: true },
    });
    if (!group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    const membership = await getMembershipOrNull(id_gruppo, sub);
    if (!membership || !['Owner', 'Admin'].includes(membership.ruolo)) {
        res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: 'Solo Owner o Admin possono modificare la descrizione del gruppo.',
        });
        return;
    }
    const updated = await prisma_1.prisma.gruppo.update({
        where: { id_gruppo },
        data: { descrizione },
        select: {
            id_gruppo: true,
            nome: true,
            privacy: true,
            photo_url: true,
            descrizione: true,
            budget_iniziale: true,
        },
    });
    res.json({
        message: 'Descrizione gruppo aggiornata con successo.',
        group: {
            ...updated,
            budget_iniziale: updated.budget_iniziale.toString(),
        },
    });
}
async function updateGroupPhoto(req, res) {
    const parsedParams = GroupIdParamsSchema.safeParse(req.params);
    const parsedBody = UpdateGroupPhotoSchema.safeParse(req.body);
    if (!parsedParams.success || !parsedBody.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsedParams.error?.errors[0]?.message
                ?? parsedBody.error?.errors[0]?.message
                ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsedParams.data;
    const photo_url = parsedBody.data.photo_url?.trim() || null;
    const group = await prisma_1.prisma.gruppo.findUnique({
        where: { id_gruppo },
        select: { id_gruppo: true },
    });
    if (!group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    const membership = await getMembershipOrNull(id_gruppo, sub);
    if (!membership || !['Owner', 'Admin'].includes(membership.ruolo)) {
        res.status(403).json({
            error: 'INSUFFICIENT_ROLE',
            message: 'Solo Owner o Admin possono modificare la foto del gruppo.',
        });
        return;
    }
    const updated = await prisma_1.prisma.gruppo.update({
        where: { id_gruppo },
        data: { photo_url },
        select: {
            id_gruppo: true,
            nome: true,
            privacy: true,
            photo_url: true,
            descrizione: true,
            budget_iniziale: true,
        },
    });
    res.json({
        message: 'Foto gruppo aggiornata con successo.',
        group: {
            ...updated,
            budget_iniziale: updated.budget_iniziale.toString(),
        },
    });
}
async function getMyGroups(req, res) {
    const { sub } = req.user;
    const rows = await prisma_1.prisma.membro_Gruppo.findMany({
        where: {
            id_persona: sub,
        },
        include: {
            gruppo: {
                select: {
                    id_gruppo: true,
                    nome: true,
                    privacy: true,
                    photo_url: true,
                    descrizione: true,
                    budget_iniziale: true,
                },
            },
        },
        orderBy: {
            gruppo: {
                nome: 'asc',
            },
        },
    });
    res.json({
        count: rows.length,
        groups: rows.map((row) => ({
            id_gruppo: row.gruppo.id_gruppo,
            nome: row.gruppo.nome,
            privacy: row.gruppo.privacy,
            photo_url: row.gruppo.photo_url,
            descrizione: row.gruppo.descrizione,
            budget_iniziale: row.gruppo.budget_iniziale.toString(),
            ruolo: row.ruolo,
        })),
    });
}
async function getGroupRanking(req, res) {
    const parsed = GroupIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_gruppo non valido.',
        });
        return;
    }
    const { id_gruppo } = parsed.data;
    const readContext = await getGroupReadContext(id_gruppo, getRequesterId(req));
    if (!readContext.group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    if (!readContext.canRead) {
        res.status(403).json({
            error: 'GROUP_PRIVATE',
            message: 'Questo gruppo e privato. Accesso consentito solo ai membri.',
        });
        return;
    }
    const [members, portfolios, latestSnapshot] = await Promise.all([
        prisma_1.prisma.membro_Gruppo.findMany({
            where: { id_gruppo },
            include: {
                persona: {
                    select: {
                        id_persona: true,
                        username: true,
                        photo_url: true,
                    },
                },
            },
        }),
        prisma_1.prisma.portafoglio.findMany({
            where: { id_gruppo },
            select: {
                id_persona: true,
                liquidita: true,
            },
        }),
        prisma_1.prisma.storico_Portafoglio.aggregate({
            where: { id_gruppo },
            _max: { data: true },
        }),
    ]);
    const portfolioMap = new Map();
    for (const portfolio of portfolios) {
        portfolioMap.set(portfolio.id_persona, portfolio.liquidita);
    }
    const snapshotDate = latestSnapshot._max.data ?? null;
    const snapshotMap = new Map();
    if (snapshotDate) {
        const snapshots = await prisma_1.prisma.storico_Portafoglio.findMany({
            where: {
                id_gruppo,
                data: snapshotDate,
            },
            select: {
                id_persona: true,
                valore_totale: true,
            },
        });
        for (const snapshot of snapshots) {
            snapshotMap.set(snapshot.id_persona, snapshot.valore_totale);
        }
    }
    const ranking = members
        .map((member) => {
        const total = snapshotMap.get(member.id_persona)
            ?? portfolioMap.get(member.id_persona)
            ?? new client_1.Prisma.Decimal(0);
        return {
            id_persona: member.id_persona,
            username: member.persona.username,
            photo_url: member.persona.photo_url,
            ruolo: member.ruolo,
            valore_totale: total,
        };
    })
        .sort((a, b) => Number(b.valore_totale.toString()) - Number(a.valore_totale.toString()))
        .map((row, index) => ({
        posizione: index + 1,
        id_persona: row.id_persona,
        username: row.username,
        photo_url: row.photo_url,
        ruolo: row.ruolo,
        valore_totale: row.valore_totale.toString(),
    }));
    res.json({
        group: readContext.group,
        snapshot_date: snapshotDate ? snapshotDate.toISOString().slice(0, 10) : null,
        count: ranking.length,
        ranking,
    });
}
async function getMyGroupWorkspace(req, res) {
    const parsed = GroupIdParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_gruppo non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_gruppo } = parsed.data;
    const membership = await getMembershipOrNull(id_gruppo, sub);
    if (!membership) {
        res.status(403).json({
            error: 'GROUP_FORBIDDEN',
            message: 'Non fai parte di questo gruppo.',
        });
        return;
    }
    const [group, portfolio] = await Promise.all([
        prisma_1.prisma.gruppo.findUnique({
            where: { id_gruppo },
            select: {
                id_gruppo: true,
                nome: true,
                photo_url: true,
                privacy: true,
                descrizione: true,
                budget_iniziale: true,
            },
        }),
        prisma_1.prisma.portafoglio.findFirst({
            where: {
                id_gruppo,
                id_persona: sub,
            },
            select: {
                id_portafoglio: true,
                liquidita: true,
                id_persona: true,
                id_gruppo: true,
            },
        }),
    ]);
    if (!group) {
        res.status(404).json({
            error: 'GROUP_NOT_FOUND',
            message: 'Gruppo non trovato.',
        });
        return;
    }
    if (!portfolio) {
        res.status(404).json({
            error: 'GROUP_PORTFOLIO_NOT_FOUND',
            message: 'Portafoglio gruppo non trovato per questo utente.',
        });
        return;
    }
    const [holdings, history, transactions, watchlist] = await Promise.all([
        prisma_1.prisma.azioni_in_possesso.findMany({
            where: { id_portafoglio: portfolio.id_portafoglio },
            include: {
                stock: {
                    select: {
                        nome_societa: true,
                        settore: true,
                    },
                },
            },
            orderBy: { id_stock: 'asc' },
        }),
        prisma_1.prisma.storico_Portafoglio.findMany({
            where: {
                id_persona: sub,
                id_gruppo,
            },
            orderBy: { data: 'asc' },
        }),
        prisma_1.prisma.transazione.findMany({
            where: {
                id_portafoglio: portfolio.id_portafoglio,
            },
            orderBy: { created_at: 'desc' },
        }),
        prisma_1.prisma.watchlist.findMany({
            where: {
                id_persona: sub,
            },
            include: {
                stock: {
                    select: {
                        nome_societa: true,
                        settore: true,
                    },
                },
            },
            orderBy: { id_stock: 'asc' },
        }),
    ]);
    res.json({
        group: {
            id_gruppo: group.id_gruppo,
            nome: group.nome,
            photo_url: group.photo_url,
            privacy: group.privacy,
            descrizione: group.descrizione,
            budget_iniziale: group.budget_iniziale.toString(),
            ruolo: membership.ruolo,
        },
        portfolio: {
            id_portafoglio: portfolio.id_portafoglio,
            liquidita: portfolio.liquidita.toString(),
            id_persona: portfolio.id_persona,
            id_gruppo: portfolio.id_gruppo,
        },
        holdings: holdings.map((h) => ({
            id_stock: h.id_stock,
            nome_societa: h.stock.nome_societa,
            settore: h.stock.settore,
            numero: h.numero.toString(),
            prezzo_medio_acquisto: h.prezzo_medio_acquisto.toString(),
        })),
        history: history.map((row) => ({
            data: row.data.toISOString().slice(0, 10),
            valore_totale: row.valore_totale.toString(),
        })),
        transactions: transactions.map((t) => serializeTransactionForResponse(t)),
        watchlist: watchlist.map((w) => ({
            id_stock: w.id_stock,
            nome_societa: w.stock.nome_societa,
            settore: w.stock.settore,
        })),
    });
}
