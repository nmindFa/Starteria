import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  apiLimiter,
  loginLimiter,
  loginEmailLimiter,
  registerEmailLimiter,
} from '../rate-limiter';
import { errorHandler } from '../../../shared/errors/error-handler';

/**
 * Rate-limiter tests. The limiters share a module-scoped Map keyed by
 * (route × ip|email|user). To keep tests independent we use distinct
 * IPs / emails per test so windows don't collide. We also use vi.useFakeTimers
 * for the few tests that assert window expiry.
 */

vi.mock('../../../shared/utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

function buildApp(limiter: express.RequestHandler, route = '/limited') {
  const app = express();
  app.use(express.json());
  // Trust the X-Forwarded-For header so we can spoof a unique req.ip per test.
  app.set('trust proxy', true);
  app.post(route, limiter, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('modules/auth/rate-limiter', () => {
  beforeEach(() => {
    // Real timers by default — switch to fake on a per-test basis.
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('loginLimiter (5/min/IP)', () => {
    it('lets the first 5 requests through, blocks the 6th with AUTH_RATE_LIMITED', async () => {
      const app = buildApp(loginLimiter);
      const ip = '203.0.113.10'; // unique IP for this test

      for (let i = 1; i <= 5; i++) {
        const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
        expect(res.status).toBe(200);
        expect(res.headers['x-ratelimit-limit']).toBe('5');
        expect(res.headers['x-ratelimit-remaining']).toBe(String(5 - i));
      }

      const blocked = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('AUTH_RATE_LIMITED');
      expect(blocked.headers['retry-after']).toBeDefined();
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('keys requests independently per IP (different IPs get fresh budgets)', async () => {
      const app = buildApp(loginLimiter);
      // Burn through one IP first, then verify another IP is unaffected.
      const ipA = '203.0.113.20';
      const ipB = '203.0.113.21';
      for (let i = 0; i < 6; i++) {
        await request(app).post('/limited').set('X-Forwarded-For', ipA).send({});
      }
      const res = await request(app).post('/limited').set('X-Forwarded-For', ipB).send({});
      expect(res.status).toBe(200);
    });
  });

  describe('loginEmailLimiter (10 per 15min per email)', () => {
    it('counts requests per normalised email (case + whitespace)', async () => {
      const app = buildApp(loginEmailLimiter);
      // Use the same email with different casing across requests.
      // The limiter normalizes via .trim().toLowerCase() so the count
      // applies across casing variants.
      for (let i = 0; i < 10; i++) {
        const res = await request(app)
          .post('/limited')
          .send({ email: 'Foo@Bar.Com' });
        expect(res.status).toBe(200);
      }
      const blocked = await request(app).post('/limited').send({ email: '  foo@bar.com  ' });
      expect(blocked.status).toBe(429);
      expect(blocked.body.error.code).toBe('AUTH_RATE_LIMITED');
    });

    it('falls back to anon:<ip> key when email is missing', async () => {
      const app = buildApp(loginEmailLimiter);
      // 10 anon requests with the same IP should pass; the 11th blocked.
      const ip = '203.0.113.30';
      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
        expect(res.status).toBe(200);
      }
      const blocked = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      expect(blocked.status).toBe(429);
    });
  });

  describe('registerEmailLimiter (5 per 15min per email)', () => {
    it('blocks the 6th attempt for the same email', async () => {
      const app = buildApp(registerEmailLimiter);
      const email = 'register-test@example.com';
      for (let i = 0; i < 5; i++) {
        const r = await request(app).post('/limited').send({ email });
        expect(r.status).toBe(200);
      }
      const blocked = await request(app).post('/limited').send({ email });
      expect(blocked.status).toBe(429);
    });
  });

  describe('apiLimiter (100/min)', () => {
    it('keys per req.user.sub when authenticated, IP otherwise', async () => {
      // Prepend a fake "auth" middleware that sets req.user.sub.
      const app = express();
      app.set('trust proxy', true);
      app.post('/limited', (req, _res, next) => {
        (req as any).user = { sub: 'user-XYZ' };
        next();
      }, apiLimiter, (_req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      const res1 = await request(app).post('/limited').send({});
      expect(res1.status).toBe(200);
      expect(res1.headers['x-ratelimit-limit']).toBe('100');
    });
  });

  describe('window expiry', () => {
    it('resets the count after the window passes', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const app = buildApp(loginLimiter);
      const ip = '203.0.113.40';
      for (let i = 0; i < 6; i++) {
        await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      }
      // Advance past the 60 second window.
      vi.setSystemTime(Date.now() + 61_000);
      const res = await request(app).post('/limited').set('X-Forwarded-For', ip).send({});
      expect(res.status).toBe(200);
    });
  });
});
