import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from '../types';
import { prisma } from '../lib/prisma';

export interface PrivatePortfolioRequest extends AuthRequest {
  privatePortfolio: {
    id_portafoglio: number;
  };
}

/**
 * Recupera il portafoglio personale dell'utente autenticato (id_gruppo = null)
 * e lo allega alla request per i controller successivi.
 */
export async function requirePrivatePortfolio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { sub } = (req as AuthRequest).user;

  const portfolio = await prisma.portafoglio.findFirst({
    where: {
      id_persona: sub,
      id_gruppo: null,
    },
    select: {
      id_portafoglio: true,
    },
  });

  if (!portfolio) {
    res.status(404).json({
      error: 'PRIVATE_PORTFOLIO_NOT_FOUND',
      message: 'Portafoglio personale non trovato.',
    });
    return;
  }

  (req as PrivatePortfolioRequest).privatePortfolio = portfolio;
  next();
}
