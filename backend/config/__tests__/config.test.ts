import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

/**
 * Tests for backend/config/index.ts. The module evaluates `process.env`
 * eagerly at import time, so we use vi.resetModules() between cases to
 * load fresh copies under different env conditions.
 *
 * We mock `dotenv` so the real front/.env file (if present) does not leak
 * its DATABASE_URL/JWT_SECRET into the test env after we explicitly delete
 * them — dotenv.config() only sets keys that aren't already set, so on a
 * fresh module load it would re-populate them from disk.
 */

vi.mock('dotenv', () => ({
  default: { config: () => ({ parsed: {} }) },
  config: () => ({ parsed: {} }),
}));

describe('backend/config', () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    // Reset to a clean baseline before each test.
    process.env = { ...ORIGINAL };
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.JWT_EXPIRES_IN;
    delete process.env.JWT_REFRESH_EXPIRES_IN;
    delete process.env.CORS_ORIGIN;
    delete process.env.BODY_LIMIT;
    delete process.env.AI_SERVICE_URL;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('returns sensible development defaults when no env is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { config } = await import('../index');

    expect(config.port).toBe(3001);
    expect(config.nodeEnv).toBe('development');
    expect(config.logLevel).toBe('info');
    expect(config.jwtExpiresIn).toBe('15m');
    expect(config.jwtRefreshExpiresIn).toBe('7d');
    expect(config.corsOrigin).toBe('http://localhost:5173');
    expect(config.bodyLimit).toBe('1mb');
    expect(config.aiServiceUrl).toBe('http://localhost:8001');
    expect(config.databaseUrl).toBe('');
    expect(config.jwtSecret).toBe('dev-insecure-fallback-do-not-use-in-prod');

    // Two warnings: one for JWT_SECRET, one for DATABASE_URL.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('honours all overrides supplied via env', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.PORT = '4242';
    process.env.LOG_LEVEL = 'debug';
    process.env.JWT_SECRET = 'super-strong-secret';
    process.env.JWT_EXPIRES_IN = '30m';
    process.env.JWT_REFRESH_EXPIRES_IN = '14d';
    process.env.CORS_ORIGIN = 'https://app.example.com,https://admin.example.com';
    process.env.BODY_LIMIT = '5mb';
    process.env.AI_SERVICE_URL = 'http://ai.svc:9000';
    process.env.DATABASE_URL = 'postgres://x';

    const { config } = await import('../index');
    expect(config.nodeEnv).toBe('staging');
    expect(config.port).toBe(4242);
    expect(config.logLevel).toBe('debug');
    expect(config.jwtSecret).toBe('super-strong-secret');
    expect(config.jwtExpiresIn).toBe('30m');
    expect(config.jwtRefreshExpiresIn).toBe('14d');
    expect(config.corsOrigin).toBe('https://app.example.com,https://admin.example.com');
    expect(config.bodyLimit).toBe('5mb');
    expect(config.aiServiceUrl).toBe('http://ai.svc:9000');
    expect(config.databaseUrl).toBe('postgres://x');
  });

  it('parses PORT as base-10 integer', async () => {
    process.env.PORT = '08080';
    const { config } = await import('../index');
    expect(config.port).toBe(8080);
  });

  it('throws when JWT_SECRET is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://x';
    await expect(import('../index')).rejects.toThrow(/JWT_SECRET/);
  });

  it('throws when DATABASE_URL is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'whatever';
    await expect(import('../index')).rejects.toThrow(/DATABASE_URL/);
  });

  it('does NOT throw in production when both required vars are set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'whatever';
    process.env.DATABASE_URL = 'postgres://x';
    const { config } = await import('../index');
    expect(config.nodeEnv).toBe('production');
    expect(config.jwtSecret).toBe('whatever');
    expect(config.databaseUrl).toBe('postgres://x');
  });
});
