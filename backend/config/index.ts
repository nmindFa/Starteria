import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET ?? '';
const databaseUrl = process.env.DATABASE_URL ?? '';

if (!jwtSecret) {
  if (nodeEnv === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[config] JWT_SECRET not set — using insecure fallback (development only)');
}

if (!databaseUrl) {
  if (nodeEnv === 'production') {
    throw new Error('DATABASE_URL is required in production');
  }
  // eslint-disable-next-line no-console
  console.warn('[config] DATABASE_URL not set');
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl,
  jwtSecret: jwtSecret || 'dev-insecure-fallback-do-not-use-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  bodyLimit: process.env.BODY_LIMIT || '1mb',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
} as const;
