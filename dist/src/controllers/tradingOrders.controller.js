"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.cancelPendingOrder = cancelPendingOrder;
exports.getProfileTransactions = getProfileTransactions;
exports.searchStocksByPrefix = searchStocksByPrefix;
exports.searchPeopleByUsernameOrId = searchPeopleByUsernameOrId;
exports.getPortfolioHoldings = getPortfolioHoldings;
exports.getPortfolioBalanceHistory = getPortfolioBalanceHistory;
exports.addStockToWatchlist = addStockToWatchlist;
exports.removeStockFromWatchlist = removeStockFromWatchlist;
exports.getMyWatchlist = getMyWatchlist;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const CreateOrderSchema = zod_1.z.object({
    id_portafoglio: zod_1.z.number().int().positive(),
    id_stock: zod_1.z.string().trim().toUpperCase().min(1).max(10),
    tipo: zod_1.z.enum(['Buy', 'Sell']),
    importo_investito: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
    quantita_azioni: zod_1.z.union([zod_1.z.number(), zod_1.z.string()]).optional(),
}).superRefine((data, ctx) => {
    if (data.tipo === 'Buy') {
        const value = String(data.importo_investito ?? '').trim();
        if (!/^\d+(\.\d{1,2})?$/.test(value) || new client_1.Prisma.Decimal(value).lte(0)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['importo_investito'],
                message: 'Importo Buy non valido.',
            });
        }
    }
    if (data.tipo === 'Sell') {
        const value = String(data.quantita_azioni ?? '').trim();
        if (!/^\d+(\.\d{1,6})?$/.test(value) || new client_1.Prisma.Decimal(value).lte(0)) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ['quantita_azioni'],
                message: 'Quantita Sell non valida.',
            });
        }
    }
});
const ProfileTransactionsQuerySchema = zod_1.z.object({
    id_persona: zod_1.z.coerce.number().int().positive(),
    days: zod_1.z.coerce.number().int().positive().max(365).default(10),
});
const PrefixSearchQuerySchema = zod_1.z.object({
    q: zod_1.z.string().trim().min(1).max(50),
    limit: zod_1.z.coerce.number().int().positive().max(100).default(50),
});
const PortfolioHoldingsParamsSchema = zod_1.z.object({
    id_portafoglio: zod_1.z.coerce.number().int().positive(),
});
const PortfolioHistoryParamsSchema = zod_1.z.object({
    id_portafoglio: zod_1.z.coerce.number().int().positive(),
});
const WatchlistBodySchema = zod_1.z.object({
    id_stock: zod_1.z.string().trim().toUpperCase().min(1).max(10),
});
const WatchlistParamsSchema = zod_1.z.object({
    id_stock: zod_1.z.string().trim().toUpperCase().min(1).max(10),
});
const PENDING_PRICE = new client_1.Prisma.Decimal(0);
function serializeTransaction(t) {
    return {
        ...t,
        importo_investito: t.importo_investito?.toString() ?? null,
        prezzo_esecuzione: t.prezzo_esecuzione.toString(),
        quantita_azioni: t.quantita_azioni?.toString() ?? null,
    };
}
async function createOrder(req, res) {
    const parsed = CreateOrderSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_portafoglio, id_stock, tipo } = parsed.data;
    // Verifica proprietà portafoglio ed esistenza stock
    const [stock, portfolio] = await Promise.all([
        prisma_1.prisma.stock.findUnique({ where: { id_stock } }),
        prisma_1.prisma.portafoglio.findFirst({ where: { id_portafoglio, id_persona: sub } }),
    ]);
    if (!stock || !portfolio) {
        res.status(404).json({
            error: 'NOT_FOUND',
            message: 'Stock o Portafoglio non validi.',
        });
        return;
    }
    try {
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            if (tipo === 'Buy') {
                const importo = new client_1.Prisma.Decimal(String(parsed.data.importo_investito));
                const updated = await tx.portafoglio.updateMany({
                    where: {
                        id_portafoglio,
                        liquidita: { gte: importo },
                    },
                    data: {
                        liquidita: { decrement: importo },
                    },
                });
                if (updated.count === 0) {
                    throw new Error('INSUFFICIENT_FUNDS');
                }
                return tx.transazione.create({
                    data: {
                        id_portafoglio,
                        id_stock,
                        tipo: 'Buy',
                        importo_investito: importo,
                        stato: 'Pending',
                        prezzo_esecuzione: PENDING_PRICE,
                    },
                });
            }
            const quantity = new client_1.Prisma.Decimal(String(parsed.data.quantita_azioni));
            const holding = await tx.azioni_in_possesso.findUnique({
                where: {
                    id_portafoglio_id_stock: {
                        id_portafoglio,
                        id_stock,
                    },
                },
            });
            if (!holding || holding.numero.lt(quantity)) {
                throw new Error('INSUFFICIENT_SHARES');
            }
            await tx.azioni_in_possesso.update({
                where: {
                    id_portafoglio_id_stock: {
                        id_portafoglio,
                        id_stock,
                    },
                },
                data: {
                    numero: { decrement: quantity },
                },
            });
            await tx.azioni_in_possesso.deleteMany({
                where: {
                    id_portafoglio,
                    id_stock,
                    numero: { lte: 0 },
                },
            });
            return tx.transazione.create({
                data: {
                    id_portafoglio,
                    id_stock,
                    tipo: 'Sell',
                    stato: 'Pending',
                    quantita_azioni: quantity,
                    // Salva il prezzo medio corrente per un eventuale rollback preciso in cancellazione.
                    prezzo_esecuzione: holding.prezzo_medio_acquisto,
                },
            });
        });
        res.status(201).json({
            message: 'Ordine creato con successo',
            transaction: serializeTransaction(result),
        });
    }
    catch (error) {
        const code = error instanceof Error ? error.message : 'ORDER_CREATION_FAILED';
        if (code === 'INSUFFICIENT_FUNDS') {
            res.status(400).json({
                error: 'INSUFFICIENT_FUNDS',
                message: 'Fondi insufficienti per completare questa operazione.',
            });
            return;
        }
        if (code === 'INSUFFICIENT_SHARES') {
            res.status(400).json({
                error: 'INSUFFICIENT_SHARES',
                message: 'Non possiedi abbastanza azioni di questo titolo per la vendita.',
            });
            return;
        }
        res.status(500).json({
            error: 'ORDER_CREATION_FAILED',
            message: 'Impossibile creare l\'ordine.',
        });
    }
}
async function cancelPendingOrder(req, res) {
    const { sub } = req.user;
    const orderId = Number.parseInt(req.params.id_transazione, 10);
    if (!Number.isInteger(orderId) || orderId <= 0) {
        res.status(400).json({
            error: 'INVALID_ID',
            message: 'id_transazione non valido.',
        });
        return;
    }
    const order = await prisma_1.prisma.transazione.findFirst({
        where: {
            id_transazione: orderId,
            portafoglio: { id_persona: sub },
        },
    });
    if (!order) {
        res.status(404).json({
            error: 'ORDER_NOT_FOUND',
            message: 'Ordine non trovato.',
        });
        return;
    }
    if (order.stato !== 'Pending') {
        res.status(409).json({
            error: 'ORDER_NOT_PENDING',
            message: 'Ordine gia eseguito o annullato.',
        });
        return;
    }
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            const deleted = await tx.transazione.deleteMany({
                where: {
                    id_transazione: orderId,
                    stato: 'Pending',
                },
            });
            if (deleted.count === 0) {
                throw new Error('ALREADY_PROCESSED');
            }
            if (order.tipo === 'Buy') {
                if (!order.importo_investito) {
                    throw new Error('INVALID_PENDING_BUY');
                }
                await tx.portafoglio.update({
                    where: { id_portafoglio: order.id_portafoglio },
                    data: {
                        liquidita: { increment: order.importo_investito },
                    },
                });
                return;
            }
            if (!order.quantita_azioni) {
                throw new Error('INVALID_PENDING_SELL');
            }
            const existing = await tx.azioni_in_possesso.findUnique({
                where: {
                    id_portafoglio_id_stock: {
                        id_portafoglio: order.id_portafoglio,
                        id_stock: order.id_stock,
                    },
                },
            });
            if (!existing) {
                await tx.azioni_in_possesso.create({
                    data: {
                        id_portafoglio: order.id_portafoglio,
                        id_stock: order.id_stock,
                        numero: order.quantita_azioni,
                        prezzo_medio_acquisto: order.prezzo_esecuzione,
                    },
                });
                return;
            }
            const newNumber = existing.numero.add(order.quantita_azioni);
            const weightedTotal = existing.numero.mul(existing.prezzo_medio_acquisto)
                .add(order.quantita_azioni.mul(order.prezzo_esecuzione));
            const newAverage = weightedTotal.div(newNumber);
            await tx.azioni_in_possesso.update({
                where: {
                    id_portafoglio_id_stock: {
                        id_portafoglio: order.id_portafoglio,
                        id_stock: order.id_stock,
                    },
                },
                data: {
                    numero: newNumber,
                    prezzo_medio_acquisto: newAverage,
                },
            });
        });
        res.json({ message: 'Ordine annullato e fondi/azioni ripristinati.' });
    }
    catch {
        res.status(409).json({
            error: 'ORDER_NOT_PENDING',
            message: 'Impossibile revocare l\'ordine: transazione gia in lavorazione o completata.',
        });
    }
}
async function getProfileTransactions(req, res) {
    const parsed = ProfileTransactionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Parametri query non validi.',
        });
        return;
    }
    const { id_persona, days } = parsed.data;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const transactions = await prisma_1.prisma.transazione.findMany({
        where: {
            portafoglio: {
                id_persona,
            },
            created_at: {
                gte: since,
            },
        },
        orderBy: {
            created_at: 'desc',
        },
    });
    res.json({
        id_persona,
        days,
        count: transactions.length,
        transactions: transactions.map((t) => serializeTransaction(t)),
    });
}
async function searchStocksByPrefix(req, res) {
    const parsed = PrefixSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Query di ricerca non valida.',
        });
        return;
    }
    const term = parsed.data.q.toLowerCase();
    const limit = parsed.data.limit;
    const rows = await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
    SELECT id_stock, nome_societa, settore
    FROM stock
    WHERE lower(nome_societa) LIKE ${`${term}%`}
    ORDER BY nome_societa ASC
    LIMIT ${limit}
  `);
    res.json({
        q: parsed.data.q,
        count: rows.length,
        results: rows,
    });
}
async function searchPeopleByUsernameOrId(req, res) {
    const parsed = PrefixSearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Query di ricerca non valida.',
        });
        return;
    }
    const rawTerm = parsed.data.q.trim();
    const term = rawTerm.toLowerCase();
    const limit = parsed.data.limit;
    const isNumericPrefix = /^\d+$/.test(rawTerm);
    const requesterId = req.user?.sub ?? null;
    const requesterBlockedFilter = requesterId
        ? client_1.Prisma.sql `
        AND NOT EXISTS (
          SELECT 1
          FROM amicizia a
          WHERE (
            (a.id_persona_1 = p.id_persona AND a.id_persona_2 = ${requesterId})
            OR (a.id_persona_2 = p.id_persona AND a.id_persona_1 = ${requesterId})
          )
          AND a.user_block = p.id_persona
        )
      `
        : client_1.Prisma.empty;
    const friendshipSelect = requesterId
        ? client_1.Prisma.sql `
        EXISTS (
          SELECT 1
          FROM amicizia af
          WHERE (
            (af.id_persona_1 = p.id_persona AND af.id_persona_2 = ${requesterId})
            OR (af.id_persona_2 = p.id_persona AND af.id_persona_1 = ${requesterId})
          )
          AND af.status = 'Accepted'
          AND af.user_block IS NULL
        ) AS is_friend
      `
        : client_1.Prisma.sql `false AS is_friend`;
    const rows = isNumericPrefix
        ? await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT p.id_persona, p.username, p.photo_url, ${friendshipSelect}
        FROM persona p
        WHERE (
          lower(p.username) LIKE ${`${term}%`}
          OR (p.id_persona::text) LIKE ${`${rawTerm}%`}
        )
        ${requesterBlockedFilter}
        ORDER BY p.username ASC
        LIMIT ${limit}
      `)
        : await prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT p.id_persona, p.username, p.photo_url, ${friendshipSelect}
        FROM persona p
        WHERE lower(p.username) LIKE ${`${term}%`}
        ${requesterBlockedFilter}
        ORDER BY p.username ASC
        LIMIT ${limit}
      `);
    res.json({
        q: parsed.data.q,
        count: rows.length,
        results: rows,
    });
}
async function getPortfolioHoldings(req, res) {
    const parsed = PortfolioHoldingsParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_portafoglio non valido.',
        });
        return;
    }
    const { id_portafoglio } = parsed.data;
    const portfolio = await prisma_1.prisma.portafoglio.findUnique({
        where: { id_portafoglio },
        select: { id_portafoglio: true },
    });
    if (!portfolio) {
        res.status(404).json({
            error: 'PORTFOLIO_NOT_FOUND',
            message: 'Portafoglio non trovato.',
        });
        return;
    }
    const holdings = await prisma_1.prisma.azioni_in_possesso.findMany({
        where: { id_portafoglio },
        orderBy: { id_stock: 'asc' },
        include: {
            stock: {
                select: {
                    nome_societa: true,
                    settore: true,
                },
            },
        },
    });
    res.json({
        id_portafoglio,
        count: holdings.length,
        holdings: holdings.map((h) => ({
            id_stock: h.id_stock,
            nome_societa: h.stock.nome_societa,
            settore: h.stock.settore,
            numero: h.numero.toString(),
            prezzo_medio_acquisto: h.prezzo_medio_acquisto.toString(),
        })),
    });
}
async function getPortfolioBalanceHistory(req, res) {
    const parsed = PortfolioHistoryParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_portafoglio non valido.',
        });
        return;
    }
    const { id_portafoglio } = parsed.data;
    const portfolio = await prisma_1.prisma.portafoglio.findUnique({
        where: { id_portafoglio },
        select: {
            id_portafoglio: true,
            id_persona: true,
            id_gruppo: true,
        },
    });
    if (!portfolio) {
        res.status(404).json({
            error: 'PORTFOLIO_NOT_FOUND',
            message: 'Portafoglio non trovato.',
        });
        return;
    }
    const history = await prisma_1.prisma.storico_Portafoglio.findMany({
        where: {
            id_persona: portfolio.id_persona,
            id_gruppo: portfolio.id_gruppo,
        },
        orderBy: {
            data: 'asc',
        },
    });
    res.json({
        id_portafoglio,
        count: history.length,
        history: history.map((row) => ({
            data: row.data.toISOString().slice(0, 10),
            valore_totale: row.valore_totale.toString(),
        })),
    });
}
async function addStockToWatchlist(req, res) {
    const parsed = WatchlistBodySchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_stock } = parsed.data;
    const stock = await prisma_1.prisma.stock.findUnique({
        where: { id_stock },
        select: { id_stock: true },
    });
    if (!stock) {
        res.status(404).json({
            error: 'STOCK_NOT_FOUND',
            message: 'Titolo non trovato.',
        });
        return;
    }
    try {
        await prisma_1.prisma.watchlist.create({
            data: {
                id_persona: sub,
                id_stock,
            },
        });
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError
            && error.code === 'P2002') {
            res.status(409).json({
                error: 'WATCHLIST_ALREADY_EXISTS',
                message: 'Questo titolo e gia presente nella tua watchlist.',
            });
            return;
        }
        throw error;
    }
    res.status(201).json({
        message: 'Titolo aggiunto alla watchlist.',
        id_stock,
    });
}
async function removeStockFromWatchlist(req, res) {
    const parsed = WatchlistParamsSchema.safeParse(req.params);
    if (!parsed.success) {
        res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: parsed.error.errors[0]?.message ?? 'id_stock non valido.',
        });
        return;
    }
    const { sub } = req.user;
    const { id_stock } = parsed.data;
    const deleted = await prisma_1.prisma.watchlist.deleteMany({
        where: {
            id_persona: sub,
            id_stock,
        },
    });
    if (deleted.count === 0) {
        res.status(404).json({
            error: 'WATCHLIST_ENTRY_NOT_FOUND',
            message: 'Questo titolo non e presente nella tua watchlist.',
        });
        return;
    }
    res.json({
        message: 'Titolo rimosso dalla watchlist.',
        id_stock,
    });
}
async function getMyWatchlist(req, res) {
    const { sub } = req.user;
    const rows = await prisma_1.prisma.watchlist.findMany({
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
        orderBy: {
            id_stock: 'asc',
        },
    });
    res.json({
        count: rows.length,
        results: rows.map((row) => ({
            id_stock: row.id_stock,
            nome_societa: row.stock.nome_societa,
            settore: row.stock.settore,
        })),
    });
}
