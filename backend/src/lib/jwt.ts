
// src/lib/jwt.ts
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
 
const ACCESS_SECRET  = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXP     = process.env.JWT_EXPIRES_IN  ?? '15m';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
 
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXP } as jwt.SignOptions);
}
 
export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP } as jwt.SignOptions);
}
 
export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, ACCESS_SECRET);
  return assertAppJwtPayload(decoded);
}
 
export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, REFRESH_SECRET);
  return assertAppJwtPayload(decoded);
}

function assertAppJwtPayload(decoded: string | jwt.JwtPayload): JwtPayload {
  if (
    typeof decoded === 'object' &&
    decoded !== null &&
    typeof decoded.sub === 'number' &&
    typeof decoded.username === 'string' &&
    typeof decoded.is_superuser === 'boolean'
  ) {
    return decoded as unknown as JwtPayload;
  }

  throw new Error('TOKEN_PAYLOAD_INVALID');
}
 