import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

/**
 * cors.ts builds a CorsOptions from `config.corsOrigin`. Since both modules
 * read process.env at load time, we reset modules between tests. We also
 * stub dotenv so the front/.env on disk doesn't override our deletions.
 */

vi.mock('dotenv', () => ({
  default: { config: () => ({ parsed: {} }) },
  config: () => ({ parsed: {} }),
}));

describe('backend/config/cors', () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL };
    delete process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('exposes the canonical methods + headers', async () => {
    const { corsOptions } = await import('../cors');
    expect(corsOptions.methods).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);
    expect(corsOptions.allowedHeaders).toEqual(['Content-Type', 'Authorization', 'X-Request-ID']);
    expect(corsOptions.exposedHeaders).toEqual(['X-Request-ID']);
    expect(corsOptions.credentials).toBe(true);
    expect(corsOptions.maxAge).toBe(86400);
  });

  it('splits CORS_ORIGIN by comma and trims whitespace', async () => {
    process.env.CORS_ORIGIN = 'https://a.com,  https://b.com  ,https://c.com';
    process.env.JWT_SECRET = 'x';
    const { corsOptions } = await import('../cors');
    expect(corsOptions.origin).toEqual(['https://a.com', 'https://b.com', 'https://c.com']);
  });

  it('defaults to a single origin when CORS_ORIGIN is unset', async () => {
    const { corsOptions } = await import('../cors');
    expect(corsOptions.origin).toEqual(['http://localhost:5173']);
  });
});
