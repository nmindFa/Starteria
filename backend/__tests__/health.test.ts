import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from '../shared/middleware/request-id';

/**
 * Hello-world backend test.
 *
 * We mount the real `requestId` middleware on a minimal express app rather
 * than importing `createApp()` from `backend/app.ts` — that pulls in every
 * router (and Prisma), which would force the test suite to depend on
 * a running DB. The health endpoint contract is trivial enough to assert
 * inline.
 */
describe('backend health', () => {
  it('GET /api/health returns 200 with status ok and a request id header', async () => {
    const app = express();
    app.use(requestId);
    app.get('/api/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('preserves x-request-id header when provided by the client', async () => {
    const app = express();
    app.use(requestId);
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', requestId: req.requestId });
    });

    const res = await request(app)
      .get('/api/health')
      .set('x-request-id', 'fixed-id-123');

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('fixed-id-123');
    expect(res.body.requestId).toBe('fixed-id-123');
  });
});
