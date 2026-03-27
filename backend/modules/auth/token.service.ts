// Dependencies: jsonwebtoken, @types/jsonwebtoken
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config';
import { AppError } from '../../shared/errors/AppError';
import { Role } from '../../shared/types/user.types';

export interface TokenPayload {
  sub: string;
  role: Role;
  email: string;
  cohort?: string;
}

/**
 * Generate a JWT access token (HS256 for MVP, upgrade to RS256 per ADR-003).
 * Expiry: 15 minutes.
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
    issuer: 'starteria-api',
    audience: 'starteria-dashboard',
  });
}

/**
 * Generate a cryptographically secure opaque refresh token (128 hex chars).
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Verify and decode a JWT access token.
 * Throws AppError(401) on invalid or expired token.
 */
export function verifyAccessToken(token: string): TokenPayload & jwt.JwtPayload {
  try {
    return jwt.verify(token, config.jwtSecret, {
      issuer: 'starteria-api',
      audience: 'starteria-dashboard',
    }) as TokenPayload & jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'Token expirado', 'TOKEN_EXPIRED');
    }
    throw new AppError(401, 'Token invalido', 'TOKEN_INVALID');
  }
}

/**
 * Hash a refresh token with SHA-256 for secure storage.
 * Never store plaintext refresh tokens.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
