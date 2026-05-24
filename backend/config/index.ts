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
  // TODO(ADR-011): Replace shared-secret with HMAC-SHA256 signing + timestamp + replay protection per TASK-007 full spec.
  // V1 bridge auth: simple shared secret exchanged via X-Internal-Token header.
  bridgeSharedSecret: process.env.BRIDGE_SHARED_SECRET || 'dev-bridge-secret-do-not-use-in-prod',
  // TASK-006: alias used by the initiative-pdfs module for the ai-service hand-off
  // (the AI client sends this in `X-Internal-Token` until TASK-007 swaps to HMAC).
  aiServiceToken: process.env.AI_SERVICE_TOKEN || process.env.BRIDGE_SHARED_SECRET || 'dev-shared-secret-change-me',
  // TASK-006 / SPEC-002 V1: PDFs are persisted on the local filesystem under this directory.
  // TODO(ADR-007): swap LocalDiskPdfStorage for an S3PresignedStorage implementation.
  localStorageDir: process.env.LOCAL_STORAGE_DIR || './storage',
} as const;
