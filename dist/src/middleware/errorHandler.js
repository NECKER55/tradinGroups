"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, _req, res, _next) {
    console.error('[Error]', err);
    if (res.headersSent)
        return;
    res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Errore interno del server.',
    });
}
