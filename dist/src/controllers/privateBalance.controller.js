"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrivateBalance = getPrivateBalance;
exports.updatePrivateBalance = updatePrivateBalance;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const BalanceDeltaSchema = zod_1.z.object({
    delta_liquidita: zod_1.z
        .union([zod_1.z.number(), zod_1.z.string()])
        .transform((value) => String(value).trim())
        .refine((value) => /^-?\d+(\.\d{1,2})?$/.test(value), {
        message: 'delta_liquidita deve essere un valore numerico con massimo 2 decimali.',
    })
        .transform((value) => new client_1.Prisma.Decimal(value))
        .refine((value) => !value.isZero(), {
        message: 'delta_liquidita non puo essere 0.',
    }),
});
async function getPrivatePortfolioSnapshot(id_portafoglio) {
    return prisma_1.prisma.portafoglio.findUnique({
        where: { id_portafoglio },
        select: {
            id_portafoglio: true,
            liquidita: true,
            id_persona: true,
            id_gruppo: true,
        },
    });
}
async function getPrivateBalance(req, res) {
    const { id_portafoglio } = req.privatePortfolio;
    const portfolio = await getPrivatePortfolioSnapshot(id_portafoglio);
    if (!portfolio) {
        res.status(404).json({
            error: 'PRIVATE_PORTFOLIO_NOT_FOUND',
            message: 'Portafoglio personale non trovato.',
        });
        return;
    }
    res.json({
        portfolio: {
            ...portfolio,
            liquidita: portfolio.liquidita.toString(),
        },
    });
}
async function updatePrivateBalance(req, res) {
    const parsed = BalanceDeltaSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
        });
        return;
    }
    const { id_portafoglio } = req.privatePortfolio;
    const { delta_liquidita } = parsed.data;
    if (delta_liquidita.isNegative()) {
        const amountToWithdraw = delta_liquidita.abs();
        const updated = await prisma_1.prisma.portafoglio.updateMany({
            where: {
                id_portafoglio,
                liquidita: {
                    gte: amountToWithdraw,
                },
            },
            data: {
                liquidita: {
                    decrement: amountToWithdraw,
                },
            },
        });
        if (updated.count === 0) {
            res.status(400).json({
                error: 'INSUFFICIENT_FUNDS',
                message: 'Fondi insufficienti per completare questa operazione.',
            });
            return;
        }
    }
    else {
        await prisma_1.prisma.portafoglio.update({
            where: { id_portafoglio },
            data: {
                liquidita: {
                    increment: delta_liquidita,
                },
            },
        });
    }
    const portfolio = await getPrivatePortfolioSnapshot(id_portafoglio);
    if (!portfolio) {
        res.status(404).json({
            error: 'PRIVATE_PORTFOLIO_NOT_FOUND',
            message: 'Portafoglio personale non trovato.',
        });
        return;
    }
    res.json({
        message: 'Saldo aggiornato con successo.',
        delta_liquidita: delta_liquidita.toString(),
        portfolio: {
            ...portfolio,
            liquidita: portfolio.liquidita.toString(),
        },
    });
}
