// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { AuthRequest, JwtPayload } from '../types';

/**
 * Middleware: verifica il Bearer token nell'header Authorization.
 * Se valido, inietta `req.user` con il payload decodificato.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token mancante o malformato.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    (req as AuthRequest).user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'TOKEN_INVALID', message: 'Token non valido o scaduto.' });
  }
}

/**
 * Middleware opzionale: non blocca se il token manca,
 * ma lo decodifica se presente (utile per endpoint ibridi Guest/User).
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = verifyAccessToken(authHeader.slice(7));
      (req as AuthRequest).user = payload;
    } catch {
      // token invalido → ignora silenziosamente
    }
  }
  next();
}