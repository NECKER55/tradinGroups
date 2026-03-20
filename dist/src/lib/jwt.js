"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
// src/lib/jwt.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const ACCESS_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXP = process.env.JWT_EXPIRES_IN ?? '15m';
const REFRESH_EXP = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
function signAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP });
}
function signRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}
function verifyAccessToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
    return assertAppJwtPayload(decoded);
}
function verifyRefreshToken(token) {
    const decoded = jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
    return assertAppJwtPayload(decoded);
}
function assertAppJwtPayload(decoded) {
    if (typeof decoded === 'object' &&
        decoded !== null &&
        typeof decoded.sub === 'number' &&
        typeof decoded.username === 'string' &&
        typeof decoded.is_superuser === 'boolean') {
        return decoded;
    }
    throw new Error('TOKEN_PAYLOAD_INVALID');
}
