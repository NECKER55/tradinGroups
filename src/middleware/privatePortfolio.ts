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
  const requestedRaw = req.query.id_portafoglio;

  if (requestedRaw !== undefined) {
    const requestedId = Number.parseInt(String(requestedRaw), 10);

    if (!Number.isInteger(requestedId) || requestedId <= 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'id_portafoglio query non valido.',
      });
      return;
    }

    const explicitPortfolio = await prisma.portafoglio.findFirst({
      where: {
        id_portafoglio: requestedId,
        id_persona: sub,
        id_gruppo: null,
      },
      select: {
        id_portafoglio: true,
      },
    });

    if (!explicitPortfolio) {
      res.status(404).json({
        error: 'PRIVATE_PORTFOLIO_NOT_FOUND',
        message: 'Portafoglio personale richiesto non trovato o non autorizzato.',
      });
      return;
    }

    (req as PrivatePortfolioRequest).privatePortfolio = explicitPortfolio;
    next();
    return;
  }

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
