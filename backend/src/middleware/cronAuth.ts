import { Request, Response, NextFunction } from 'express';

export function requireCronKey(req: Request, res: Response, next: NextFunction): void {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const cronKey = req.header('x-cron-key')?.trim();

  if (!cronSecret || !cronKey || cronKey !== cronSecret) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid cron key.',
    });
    return;
  }

  next();
}
