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

const PortfolioHoldingsParamsSchema = z.object({
  id_portafoglio: z.coerce.number().int().positive(),
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
