"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const tradingEngine_1 = require("./jobs/tradingEngine");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT ?? '3000');
// ─── Security ─────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true, // necessario per i cookie HttpOnly del refresh token
}));
// ─── Rate limiting globale ────────────────────────────────────
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minuti
    max: 200,
    message: { error: 'TOO_MANY_REQUESTS', message: 'Troppe richieste. Riprova tra poco.' },
    standardHeaders: true,
    legacyHeaders: false,
}));
// Rate limiting più stretto per gli endpoint di auth
app.use('/api/auth/login', (0, express_rate_limit_1.default)({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use('/api/auth/register', (0, express_rate_limit_1.default)({ windowMs: 60 * 60 * 1000, max: 5 }));
// ─── Parsing ──────────────────────────────────────────────────
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
// ─── Logging ──────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
    app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
// ─── Healthcheck ──────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
// ─── API Routes ───────────────────────────────────────────────
app.use('/api', routes_1.default);
// ─── 404 catch-all ────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint non trovato.' });
});
// ─── Global error handler ─────────────────────────────────────
app.use(errorHandler_1.errorHandler);
// ─── Avvio ────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Server avviato su http://localhost:${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV ?? 'development'}\n`);
    // Avvia i cron job solo in produzione o se esplicitamente abilitati.
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_CRON === 'true') {
        (0, tradingEngine_1.startCronJobs)();
    }
});
exports.default = app;
