"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuth = optionalAuth;
const jwt_1 = require("../lib/jwt");
/**
 * Middleware: verifica il Bearer token nell'header Authorization.
 * Se valido, inietta `req.user` con il payload decodificato.
 */
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'Token mancante o malformato.' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const payload = (0, jwt_1.verifyAccessToken)(token);
        req.user = payload;
        next();
    }
    catch {
        res.status(401).json({ error: 'TOKEN_INVALID', message: 'Token non valido o scaduto.' });
    }
}
/**
 * Middleware opzionale: non blocca se il token manca,
 * ma lo decodifica se presente (utile per endpoint ibridi Guest/User).
 */
function optionalAuth(req, _res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        try {
            const payload = (0, jwt_1.verifyAccessToken)(authHeader.slice(7));
            req.user = payload;
        }
        catch {
            // token invalido → ignora silenziosamente
        }
    }
    next();
}
