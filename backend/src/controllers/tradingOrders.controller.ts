import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';

const CreateOrderSchema = z.object({
  id_portafoglio: z.number().int().positive(),
  id_stock: z.string().trim().toUpperCase().min(1).max(10),
  tipo: z.enum(['Buy', 'Sell']),
  importo_investito: z.union([z.number(), z.string()]).optional(),
  quantita_azioni: z.union([z.number(), z.string()]).optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'Buy') {
    const value = String(data.importo_investito ?? '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(value) || new Prisma.Decimal(value).lte(0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['importo_investito'],
        message: 'Importo Buy non valido.',
      });
    }
  }

  if (data.tipo === 'Sell') {
    const value = String(data.quantita_azioni ?? '').trim();
    if (!/^\d+(\.\d{1,6})?$/.test(value) || new Prisma.Decimal(value).lte(0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['quantita_azioni'],
        message: 'Quantita Sell non valida.',
      });
    }
  }
});

const ProfileTransactionsQuerySchema = z.object({
  id_persona: z.coerce.number().int().positive(),
  days: z.coerce.number().int().positive().max(365).default(10),
});

const PrefixSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(50),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const CurrentPricesQuerySchema = z.object({
  ids: z.string().trim().min(1).max(2000),
});

const PortfolioHoldingsParamsSchema = z.object({
  id_portafoglio: z.coerce.number().int().positive(),
});

const PortfolioHistoryParamsSchema = z.object({
  id_portafoglio: z.coerce.number().int().positive(),
});

const WatchlistBodySchema = z.object({
  id_stock: z.string().trim().toUpperCase().min(1).max(10),
});

const WatchlistParamsSchema = z.object({
  id_stock: z.string().trim().toUpperCase().min(1).max(10),
});

const PENDING_PRICE = new Prisma.Decimal(0);

function serializeTransaction(t: {
  importo_investito: Prisma.Decimal | null;
  prezzo_esecuzione: Prisma.Decimal;
  quantita_azioni: Prisma.Decimal | null;
  [key: string]: unknown;
}) {
  return {
    ...t,
    importo_investito: t.importo_investito?.toString() ?? null,
    prezzo_esecuzione: t.prezzo_esecuzione.toString(),
    quantita_azioni: t.quantita_azioni?.toString() ?? null,
  };
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  const parsed = CreateOrderSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const { id_portafoglio, id_stock, tipo } = parsed.data;

  // Verifica proprietà portafoglio ed esistenza stock
  const [stock, portfolio] = await Promise.all([
    prisma.stock.findUnique({ where: { id_stock } }),
    prisma.portafoglio.findFirst({ where: { id_portafoglio, id_persona: sub } }),
  ]);

  if (!stock || !portfolio) {
    res.status(404).json({
      error: 'NOT_FOUND',
      message: 'Stock o Portafoglio non validi.',
    });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (tipo === 'Buy') {
        const importo = new Prisma.Decimal(String(parsed.data.importo_investito));

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

      const quantity = new Prisma.Decimal(String(parsed.data.quantita_azioni));
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
  } catch (error: unknown) {
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

export async function cancelPendingOrder(req: Request, res: Response): Promise<void> {
  const { sub } = (req as AuthRequest).user;
  const orderId = Number.parseInt(req.params.id_transazione, 10);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    res.status(400).json({
      error: 'INVALID_ID',
      message: 'id_transazione non valido.',
    });
    return;
  }

  const order = await prisma.transazione.findFirst({
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
    await prisma.$transaction(async (tx) => {
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
  } catch {
    res.status(409).json({
      error: 'ORDER_NOT_PENDING',
      message: 'Impossibile revocare l\'ordine: transazione gia in lavorazione o completata.',
    });
  }
}

export async function getProfileTransactions(req: Request, res: Response): Promise<void> {
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

  const transactions = await prisma.transazione.findMany({
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

export async function searchStocksByPrefix(req: Request, res: Response): Promise<void> {
  const parsed = PrefixSearchQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Query di ricerca non valida.',
    });
    return;
  }

  const term = parsed.data.q;
  const limit = parsed.data.limit;

  const rows = await prisma.stock.findMany({
    where: {
      nome_societa: {
        startsWith: term,
        mode: 'insensitive',
      },
    },
    select: {
      id_stock: true,
      nome_societa: true,
      settore: true,
    },
    orderBy: {
      nome_societa: 'asc',
    },
    take: limit,
  });

  res.json({
    q: parsed.data.q,
    count: rows.length,
    results: rows,
  });
}

export async function getStocksCurrentPrices(req: Request, res: Response): Promise<void> {
  const parsed = CurrentPricesQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Query prezzi non valida.',
    });
    return;
  }

  const ids = [...new Set(
    parsed.data.ids
      .split(',')
      .map((id) => id.trim().toUpperCase())
      .filter((id) => id.length > 0 && id.length <= 10),
  )];

  if (ids.length === 0) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Nessun ticker valido specificato.',
    });
    return;
  }

  const rows = await prisma.stock.findMany({
    where: { id_stock: { in: ids } },
    select: {
      id_stock: true,
      prezzo_attuale: true,
    },
    orderBy: { id_stock: 'asc' },
  });

  res.json({
    count: rows.length,
    prices: rows.map((row) => ({
      id_stock: row.id_stock,
      prezzo_attuale: row.prezzo_attuale?.toString() ?? null,
    })),
  });
}

export async function searchPeopleByUsernameOrId(req: Request, res: Response): Promise<void> {
  const parsed = PrefixSearchQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Query di ricerca non valida.',
    });
    return;
  }

  const rawTerm = parsed.data.q.trim();
  const limit = parsed.data.limit;
  const isNumericPrefix = /^\d+$/.test(rawTerm);
  const requesterId = (req as Partial<AuthRequest>).user?.sub ?? null;

  const whereClauses: Prisma.PersonaWhereInput[] = [
    {
      username: {
        startsWith: rawTerm,
        mode: 'insensitive',
      },
    },
  ];

  if (isNumericPrefix) {
    const maxIdResult = await prisma.persona.aggregate({ _max: { id_persona: true } });
    const maxId = maxIdResult._max.id_persona ?? 0;
    const maxDigits = String(Math.max(maxId, Number(rawTerm))).length;
    const prefixLength = rawTerm.length;
    const prefixAsNumber = Number(rawTerm);

    const idRanges: Prisma.IntFilter[] = [];

    for (let extraDigits = 0; extraDigits <= Math.max(0, maxDigits - prefixLength); extraDigits += 1) {
      const factor = 10 ** extraDigits;
      idRanges.push({
        gte: prefixAsNumber * factor,
        lte: (prefixAsNumber + 1) * factor - 1,
      });
    }

    if (idRanges.length > 0) {
      whereClauses.push({
        OR: idRanges.map((range) => ({ id_persona: range })),
      });
    }
  }

  const candidateTake = requesterId ? limit * 4 : limit;
  const candidates = await prisma.persona.findMany({
    where: {
      OR: whereClauses,
    },
    select: {
      id_persona: true,
      username: true,
      photo_url: true,
    },
    orderBy: {
      username: 'asc',
    },
    take: candidateTake,
  });

  let rows: Array<{
    id_persona: number;
    username: string;
    photo_url: string | null;
    is_friend: boolean;
  }> = candidates.map((candidate) => ({
    ...candidate,
    is_friend: false,
  }));

  if (requesterId && candidates.length > 0) {
    const candidateIds = candidates.map((candidate) => candidate.id_persona);

    const links = await prisma.amicizia.findMany({
      where: {
        OR: [
          {
            id_persona_1: requesterId,
            id_persona_2: { in: candidateIds },
          },
          {
            id_persona_2: requesterId,
            id_persona_1: { in: candidateIds },
          },
        ],
      },
      select: {
        id_persona_1: true,
        id_persona_2: true,
        status: true,
        user_block: true,
      },
    });

    const blockedByCandidate = new Set<number>();
    const acceptedFriendships = new Set<number>();

    for (const link of links) {
      const candidateId = link.id_persona_1 === requesterId ? link.id_persona_2 : link.id_persona_1;

      if (link.user_block === candidateId) {
        blockedByCandidate.add(candidateId);
      }

      if (link.status === 'Accepted' && link.user_block == null) {
        acceptedFriendships.add(candidateId);
      }
    }

    rows = candidates
      .filter((candidate) => !blockedByCandidate.has(candidate.id_persona))
      .map((candidate) => ({
        ...candidate,
        is_friend: acceptedFriendships.has(candidate.id_persona),
      }));
  }

  rows = rows.slice(0, limit);

  res.json({
    q: parsed.data.q,
    count: rows.length,
    results: rows,
  });
}

export async function getPortfolioHoldings(req: Request, res: Response): Promise<void> {
  const parsed = PortfolioHoldingsParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'id_portafoglio non valido.',
    });
    return;
  }

  const { id_portafoglio } = parsed.data;

  const portfolio = await prisma.portafoglio.findUnique({
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

  const holdings = await prisma.azioni_in_possesso.findMany({
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

export async function getPortfolioBalanceHistory(req: Request, res: Response): Promise<void> {
  const parsed = PortfolioHistoryParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'id_portafoglio non valido.',
    });
    return;
  }

  const { id_portafoglio } = parsed.data;

  const portfolio = await prisma.portafoglio.findUnique({
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

  const history = await prisma.storico_Portafoglio.findMany({
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

export async function addStockToWatchlist(req: Request, res: Response): Promise<void> {
  const parsed = WatchlistBodySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const { id_stock } = parsed.data;

  const stock = await prisma.stock.findUnique({
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
    await prisma.watchlist.create({
      data: {
        id_persona: sub,
        id_stock,
      },
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
    ) {
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

export async function removeStockFromWatchlist(req: Request, res: Response): Promise<void> {
  const parsed = WatchlistParamsSchema.safeParse(req.params);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'id_stock non valido.',
    });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const { id_stock } = parsed.data;

  const deleted = await prisma.watchlist.deleteMany({
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

export async function getMyWatchlist(req: Request, res: Response): Promise<void> {
  const { sub } = (req as AuthRequest).user;

  const rows = await prisma.watchlist.findMany({
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
