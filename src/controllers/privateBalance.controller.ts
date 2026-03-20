import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { PrivatePortfolioRequest } from '../middleware/privatePortfolio';

const BalanceDeltaSchema = z.object({
  delta_liquidita: z
    .union([z.number(), z.string()])
    .transform((value) => String(value).trim())
    .refine((value) => /^-?\d+(\.\d{1,2})?$/.test(value), {
      message: 'delta_liquidita deve essere un valore numerico con massimo 2 decimali.',
    })
    .transform((value) => new Prisma.Decimal(value))
    .refine((value) => !value.isZero(), {
      message: 'delta_liquidita non puo essere 0.',
    }),
});

async function getPrivatePortfolioSnapshot(id_portafoglio: number) {
  return prisma.portafoglio.findUnique({
    where: { id_portafoglio },
    select: {
      id_portafoglio: true,
      liquidita: true,
      id_persona: true,
      id_gruppo: true,
    },
  });
}

export async function getPrivateBalance(
  req: Request,
  res: Response
): Promise<void> {
  const { id_portafoglio } = (req as PrivatePortfolioRequest).privatePortfolio;

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

export async function updatePrivateBalance(
  req: Request,
  res: Response
): Promise<void> {
  const parsed = BalanceDeltaSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors[0]?.message ?? 'Payload non valido.',
    });
    return;
  }

  const { id_portafoglio } = (req as PrivatePortfolioRequest).privatePortfolio;
  const { delta_liquidita } = parsed.data;

  if (delta_liquidita.isNegative()) {
    const amountToWithdraw = delta_liquidita.abs();

    const updated = await prisma.portafoglio.updateMany({
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
  } else {
    await prisma.portafoglio.update({
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
