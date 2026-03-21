"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePrivatePortfolio = requirePrivatePortfolio;
const prisma_1 = require("../lib/prisma");
/**
 * Recupera il portafoglio personale dell'utente autenticato (id_gruppo = null)
 * e lo allega alla request per i controller successivi.
 */
async function requirePrivatePortfolio(req, res, next) {
    const { sub } = req.user;
    const portfolio = await prisma_1.prisma.portafoglio.findFirst({
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
    req.privatePortfolio = portfolio;
    next();
}
