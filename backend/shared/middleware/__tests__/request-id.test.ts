import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from '../request-id';

/**
 * Unit tests for requestId middleware. The hello-world health.test.ts
 * already covers it lightly; this suite locks the contract directly:
 *   - generates a UUID v4-shaped id when the client doesn't send one
 *   - preserves the client-provided id verbatim
 *   - mirrors the id back in the response header
 *   - attaches the id to req.requestId
 */

describe('shared/middleware/request-id', () => {
  it('generates a UUID-shaped id when no header is supplied', async () => {
    const app = express();
    app.use(requestId);
    app.get('/', (req, res) => res.json({ rid: req.requestId }));

    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    const headerId = res.headers['x-request-id'];
    expect(headerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(res.body.rid).toBe(headerId);
  });

  it('preserves the client-supplied x-request-id', async () => {
    const app = express();
    app.use(requestId);
    app.get('/', (req, res) => res.json({ rid: req.requestId }));

    const res = await request(app).get('/').set('x-request-id', 'client-trace-9');
    expect(res.headers['x-request-id']).toBe('client-trace-9');
    expect(res.body.rid).toBe('client-trace-9');
  });

  it('calls next() exactly once with no error', () => {
    const next = vi.fn();
    const req = {
      headers: {},
    } as unknown as express.Request;
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
    } as unknown as express.Response;

    requestId(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(headers['x-request-id']).toBeDefined();
    expect((req as any).requestId).toBe(headers['x-request-id']);
  });
});
