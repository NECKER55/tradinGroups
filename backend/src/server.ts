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
import { startDailyPortfolioValuationJob } from './jobs/portfolioValuation';

const app  = express();
// Fondamentale per Render e per express-rate-limit
app.set('trust proxy', 1);
const PORT = parseInt(process.env.PORT ?? '3000');

const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    ...(process.env.FRONTEND_URLS ?? '').split(','),
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin)),
);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS_ORIGIN_NOT_ALLOWED:${origin}`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

// ─── Security ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'", 'https:', "'unsafe-inline'", "'unsafe-eval'", 'https://s3.tradingview.com', 'https://*.tradingview.com', 'https://www.tradingview.com'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      connectSrc: ["'self'", 'https://*.tradingview.com', 'https://www.tradingview-widget.com', 'wss://*.tradingview.com'],
      frameSrc: ["'self'", 'https://*.tradingview.com', 'https://www.tradingview.com', 'https://www.tradingview-widget.com', 'https://*.tradingview-widget.com'],
      upgradeInsecureRequests: [],
    },
  },
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── Rate limiting globale ────────────────────────────────────
const methodAwareRateLimitMessage = {
  error: 'TOO_MANY_REQUESTS',
  message: 'Troppe richieste. Riprova tra poco.',
};

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 1200,
  message: methodAwareRateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !['GET', 'HEAD'].includes(req.method),
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 300,
  message: methodAwareRateLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/api/jobs/'), // Escludi jobs da rate limit globale, hanno limiti specifici più stretti
});

app.use(readLimiter);
app.use(writeLimiter);

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

  // In produzione i job vengono invocati da endpoint sicuri (/api/jobs/*).
  // L'esecuzione automatica rimane disponibile solo in ambienti non-prod quando esplicitamente abilitata.
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_CRON === 'true') {
    startCronJobs();
    startDailyPortfolioValuationJob();
  }
});

export default app;