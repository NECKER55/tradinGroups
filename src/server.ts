// src/server.ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import router from './routes';
import { errorHandler } from './middleware/errorHandler';
import { startCronJobs } from './jobs/tradingEngine';

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3000');

// ─── Security ─────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true, // necessario per i cookie HttpOnly del refresh token
}));

// ─── Rate limiting globale ────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max:      200,
  message:  { error: 'TOO_MANY_REQUESTS', message: 'Troppe richieste. Riprova tra poco.' },
  standardHeaders: true,
  legacyHeaders:   false,
}));

// Rate limiting più stretto per gli endpoint di auth
app.use('/api/auth/login',    rateLimit({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }));

// ─── Parsing ──────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ─── Logging ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ─── Healthcheck ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── API Routes ───────────────────────────────────────────────
app.use('/api', router);

// ─── 404 catch-all ────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint non trovato.' });
});

// ─── Global error handler ─────────────────────────────────────
app.use(errorHandler);

// ─── Avvio ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Server avviato su http://localhost:${PORT}`);
  console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}\n`);

  // Avvia i cron job solo in produzione o se esplicitamente abilitati.
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
    startCronJobs();
  }
});

export default app;