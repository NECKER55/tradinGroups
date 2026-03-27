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
        const explicitPortfolio = await prisma_1.prisma.portafoglio.findFirst({
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
        req.privatePortfolio = explicitPortfolio;
        next();
        return;
    }
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
