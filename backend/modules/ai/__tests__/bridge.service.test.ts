/**
 * bridge.service.test.ts — V1 trust-boundary tests for TASK-007.
 *
 * Covers:
 *   1. Required headers attached on every call
 *   2. 5xx triggers retry up to 3 attempts (200/600/1400ms backoff)
 *   3. Circuit breaker opens after 5 failures in 60s
 *   4. BridgeError carries ADR-010-shaped envelope fields
 *
 * NOTE: We can't use nock here — nock 13 doesn't intercept Node 18+'s native
 * undici-based `fetch`. Instead, we inject a fake fetch via __setFetchImpl().
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  callAiService,
  BridgeError,
  __resetBreaker,
  __setFetchImpl,
} from '../bridge.service';
import { config } from '../../../config';

const AI_BASE = config.aiServiceUrl;
const PATH = '/ai/pdf-extract';

interface FakeResponseSpec {
  status: number;
  body?: unknown;
  delayMs?: number;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeFetchStub(responses: FakeResponseSpec[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const stub: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = async (
    input,
    init,
  ) => {
    calls.push({ url: String(input), init: init ?? {} });
    const spec = responses[Math.min(i++, responses.length - 1)];
    if (spec.delayMs) {
      // Honor AbortSignal so AbortSignal.timeout(...) can trigger a real abort.
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, spec.delayMs);
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          if (signal.aborted) {
            clearTimeout(t);
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
            return;
          }
          signal.addEventListener('abort', () => {
            clearTimeout(t);
            const err = new Error('Aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    }
    return jsonResponse(spec.body ?? {}, spec.status);
  };
  return { stub, calls };
}

describe('bridge.service (V1 — shared-secret)', () => {
  beforeEach(() => {
    __resetBreaker();
  });

  afterEach(() => {
    __setFetchImpl(null);
    __resetBreaker();
    vi.useRealTimers();
  });

  describe('header injection', () => {
    it('attaches X-Internal-Token, X-Request-Id, X-User-Claims and X-Cost-Cap-USD headers', async () => {
      const { stub, calls } = makeFetchStub([{ status: 200, body: { runId: 'r-1' } }]);
      __setFetchImpl(stub);

      const result = await callAiService(
        'POST',
        PATH,
        { foo: 'bar' },
        {
          userClaims: { userId: 'u-1', role: 'participante', projectScope: ['p-1'] },
          costCapUsd: '0.0500',
          requestId: 'req-abc',
        },
      );

      expect(result).toEqual({ runId: 'r-1' });
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(`${AI_BASE}${PATH}`);
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers['X-Internal-Token']).toBe(
        config.aiServiceToken ?? config.bridgeSharedSecret,
      );
      expect(headers['X-Request-Id']).toBe('req-abc');
      expect(headers['X-Cost-Cap-USD']).toBe('0.0500');
      const claims = JSON.parse(headers['X-User-Claims']);
      expect(claims).toEqual({ userId: 'u-1', role: 'participante', projectScope: ['p-1'] });
    });

    it('generates a request id when caller omits one', async () => {
      const { stub, calls } = makeFetchStub([{ status: 200, body: {} }]);
      __setFetchImpl(stub);

      await callAiService('POST', PATH, {});
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers['X-Request-Id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('omits X-User-Claims when no claims are supplied', async () => {
      const { stub, calls } = makeFetchStub([{ status: 200, body: {} }]);
      __setFetchImpl(stub);

      await callAiService('POST', PATH, {});
      const headers = calls[0].init.headers as Record<string, string>;
      expect(headers['X-User-Claims']).toBeUndefined();
    });
  });

  describe('retry on 5xx', () => {
    it('retries up to 3 times on 5xx then returns success', async () => {
      const { stub, calls } = makeFetchStub([
        { status: 500, body: { error: 'boom' } },
        { status: 503, body: { error: 'boom' } },
        { status: 200, body: { ok: true } },
      ]);
      __setFetchImpl(stub);

      const result = await callAiService('POST', PATH, {});
      expect(result).toEqual({ ok: true });
      expect(calls).toHaveLength(3);
    });

    it('throws BridgeError after exhausting all retries', async () => {
      const { stub } = makeFetchStub([
        { status: 500, body: { error: 'boom' } },
        { status: 500, body: { error: 'boom' } },
        { status: 500, body: { error: 'boom' } },
        { status: 500, body: { error: 'boom' } },
      ]);
      __setFetchImpl(stub);

      await expect(
        callAiService('POST', PATH, {}, { maxRetries: 3 }),
      ).rejects.toBeInstanceOf(BridgeError);
    });

    it('does NOT retry on 4xx errors', async () => {
      const { stub, calls } = makeFetchStub([{ status: 400, body: { code: 'INVALID' } }]);
      __setFetchImpl(stub);

      const err = (await callAiService('POST', PATH, {}).catch((e) => e)) as BridgeError;
      expect(err).toBeInstanceOf(BridgeError);
      expect(err.code).toBe('AI_INVALID_INPUT');
      expect(calls).toHaveLength(1);
    });
  });

  describe('circuit breaker', () => {
    it('opens after 5 failures in 60s and short-circuits subsequent calls', async () => {
      // Always respond 500. With maxRetries:0 each call counts as exactly one failure.
      const { stub, calls } = makeFetchStub([{ status: 500, body: { error: 'boom' } }]);
      __setFetchImpl(stub);

      for (let i = 0; i < 5; i++) {
        await expect(
          callAiService('POST', PATH, {}, { maxRetries: 0 }),
        ).rejects.toBeInstanceOf(BridgeError);
      }
      // Five upstream calls observed, breaker now open.
      expect(calls).toHaveLength(5);

      const sixthErr = (await callAiService('POST', PATH, {}, { maxRetries: 0 }).catch(
        (e) => e,
      )) as BridgeError;
      expect(sixthErr).toBeInstanceOf(BridgeError);
      expect(sixthErr.code).toBe('AI_SERVICE_UNAVAILABLE');
      expect(sixthErr.retryAfterSeconds).toBeGreaterThan(0);
      // No new upstream calls — breaker short-circuited the sixth.
      expect(calls).toHaveLength(5);
    });
  });

  describe('BridgeError envelope (ADR-010)', () => {
    it('on upstream 402, returns BridgeError mapped to AI_COST_CAP_EXCEEDED with statusCode 402', async () => {
      const { stub } = makeFetchStub([{ status: 402, body: { code: 'COST_CAP_EXCEEDED' } }]);
      __setFetchImpl(stub);

      const err = (await callAiService('POST', PATH, {}, { maxRetries: 0 }).catch(
        (e) => e,
      )) as BridgeError;

      expect(err).toBeInstanceOf(BridgeError);
      expect(err.code).toBe('AI_COST_CAP_EXCEEDED');
      expect(err.statusCode).toBe(402);
      expect(err.requestId).toBeDefined();

      const appErr = err.toAppError();
      expect(appErr.code).toBe('AI_COST_CAP_EXCEEDED');
      expect(appErr.statusCode).toBe(402);
      expect(appErr.hint).toBeDefined();
    });

    it('on timeout, returns BridgeError with code AI_UPSTREAM_TIMEOUT', async () => {
      // 200ms delay vs 30ms timeout → abort fires.
      const { stub } = makeFetchStub([{ status: 200, body: { ok: true }, delayMs: 200 }]);
      __setFetchImpl(stub);

      const err = (await callAiService('POST', PATH, {}, {
        timeoutMs: 30,
        maxRetries: 0,
      }).catch((e) => e)) as BridgeError;

      expect(err).toBeInstanceOf(BridgeError);
      expect(err.code).toBe('AI_UPSTREAM_TIMEOUT');
      expect(err.statusCode).toBe(504);
    });
  });
});
