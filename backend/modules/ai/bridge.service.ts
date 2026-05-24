/**
 * bridge.service.ts — Single entrypoint from Express to ai-service.
 *
 * V1 bridge (TASK-007 scope: simple shared-secret only).
 *   - Injects X-Internal-Token, X-Request-Id, X-User-Claims, X-Cost-Cap-USD headers
 *   - 30s timeout
 *   - 3 retries with backoff 200ms / 600ms / 1.4s on 5xx
 *   - Per-endpoint circuit breaker: open after 5 failures in 60s, stays open 30s
 *   - Errors mapped to AppError envelope (ADR-010)
 *
 * TODO(ADR-011): replace V1 shared-secret auth with HMAC-SHA256 signing,
 * timestamp + replay protection (LRU 10K, ±60s window), claims double-firma
 * and 11-endpoint dual-accept migration per TASK-007 full spec.
 *
 * IMPORTANT: This module MUST be the only place in backend/ that issues HTTP
 * requests to AI_SERVICE_URL. The eslint rule in backend/.eslintrc.cjs blocks
 * direct fetch/axios calls to the ai-service URL from any other file. If you
 * need to add a caller, route through callAiService() here.
 */
import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { AppError } from '../../shared/errors/AppError';
import { logger } from '../../shared/utils/logger';

// ───── Types ──────────────────────────────────────────────────────────────────

export interface BridgeUserClaims {
  userId: string;
  role: string;
  /** Optional list of project ids the user has access to. */
  projectScope?: string[];
}

export interface CallAiServiceOptions {
  /** Authenticated user claims to propagate to ai-service. */
  userClaims?: BridgeUserClaims;
  /** Cost cap in USD with 4-digit precision (e.g. "0.0500"). */
  costCapUsd?: string;
  /** Optional request id; if not provided, one is generated. */
  requestId?: string;
  /** Override default 30s timeout. */
  timeoutMs?: number;
  /** Override default retry attempts (3). */
  maxRetries?: number;
}

export interface BridgeErrorPayload {
  code: string;
  message: string;
  hint?: string;
  retryAfterSeconds?: number;
  /** Echo of the X-Request-Id used. */
  requestId: string;
  /** Upstream HTTP status when applicable. */
  upstreamStatus?: number;
}

/**
 * BridgeError — thrown when the bridge cannot complete the request.
 *
 * Carries ADR-010-compatible fields. Caller code (pdf.service, mentor.service,
 * etc.) can either catch and re-throw as a domain AppError or let the express
 * error-handler serialize it via toAppError().
 */
export class BridgeError extends Error {
  public readonly code: string;
  public readonly hint?: string;
  public readonly retryAfterSeconds?: number;
  public readonly requestId: string;
  public readonly upstreamStatus?: number;
  public readonly statusCode: number;

  constructor(payload: BridgeErrorPayload, statusCode = 502) {
    super(payload.message);
    this.code = payload.code;
    this.hint = payload.hint;
    this.retryAfterSeconds = payload.retryAfterSeconds;
    this.requestId = payload.requestId;
    this.upstreamStatus = payload.upstreamStatus;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, BridgeError.prototype);
  }

  /** Map this BridgeError to an AppError so the express error-handler can emit the V1 envelope. */
  toAppError(): AppError {
    return new AppError(this.statusCode, this.message, this.code, true, {
      hint: this.hint,
      retryAfterSeconds: this.retryAfterSeconds,
    });
  }
}

// ───── Fetch indirection (test-only override) ─────────────────────────────────

/**
 * Indirection layer over the global `fetch`. Tests swap this with a mock so
 * we don't have to rely on nock intercepting undici's native fetch (which it
 * cannot in Node 18+). Production code always uses the real `fetch`.
 */
type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
let fetchImpl: FetchImpl = (input, init) => fetch(input as RequestInfo, init);

/** Test/maintenance utility — replace the fetch implementation. */
export function __setFetchImpl(impl: FetchImpl | null): void {
  fetchImpl = impl ?? ((input, init) => fetch(input as RequestInfo, init));
}

// ───── Circuit breaker (in-memory, per-endpoint) ──────────────────────────────

interface BreakerState {
  failures: { ts: number }[];
  openedAt?: number;
}

const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_FAILURE_WINDOW_MS = 60_000;
const BREAKER_OPEN_DURATION_MS = 30_000;

const breakers = new Map<string, BreakerState>();

function getBreaker(key: string): BreakerState {
  let b = breakers.get(key);
  if (!b) {
    b = { failures: [] };
    breakers.set(key, b);
  }
  return b;
}

function isBreakerOpen(key: string, now: number): boolean {
  const b = breakers.get(key);
  if (!b || b.openedAt === undefined) return false;
  if (now - b.openedAt >= BREAKER_OPEN_DURATION_MS) {
    // Half-open: clear state, let next request through
    b.openedAt = undefined;
    b.failures = [];
    return false;
  }
  return true;
}

function recordFailure(key: string, now: number): void {
  const b = getBreaker(key);
  b.failures = b.failures.filter((f) => now - f.ts < BREAKER_FAILURE_WINDOW_MS);
  b.failures.push({ ts: now });
  if (b.failures.length >= BREAKER_FAILURE_THRESHOLD) {
    b.openedAt = now;
  }
}

function recordSuccess(key: string): void {
  const b = breakers.get(key);
  if (b) {
    b.failures = [];
    b.openedAt = undefined;
  }
}

/** Test/maintenance utility — reset the breaker state for one key or all keys. */
export function __resetBreaker(key?: string): void {
  if (key) breakers.delete(key);
  else breakers.clear();
}

// ───── Helpers ────────────────────────────────────────────────────────────────

function buildHeaders(
  requestId: string,
  options: CallAiServiceOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // TODO(ADR-011): replace shared-secret with HMAC-SHA256 signing + timestamp
    // + replay protection (LRU 10K, ±60s window) + X-User-Claims-Signature per
    // TASK-007 §6-§9. V1 below ships the secret in clear over the internal
    // network as a stop-gap. `aiServiceToken` and `bridgeSharedSecret` are
    // aliased in backend/config; prefer the explicit AI_SERVICE_TOKEN when set
    // (TASK-006 wired it under that name), fall back to BRIDGE_SHARED_SECRET.
    'X-Internal-Token': config.aiServiceToken ?? config.bridgeSharedSecret,
    'X-Request-Id': requestId,
  };

  if (options.userClaims) {
    // Only propagate explicit allow-listed claims. Never pass refresh tokens,
    // password hashes, full access tokens, email or IP — see TASK-007 §7.
    const safe: BridgeUserClaims = {
      userId: options.userClaims.userId,
      role: options.userClaims.role,
      ...(options.userClaims.projectScope
        ? { projectScope: options.userClaims.projectScope }
        : {}),
    };
    headers['X-User-Claims'] = JSON.stringify(safe);
  }

  if (options.costCapUsd) {
    headers['X-Cost-Cap-USD'] = options.costCapUsd;
  }

  return headers;
}

function shouldRetry(status: number | undefined, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  // Retry only on 5xx; 4xx are deterministic errors.
  return status === undefined || status >= 500;
}

const BACKOFF_DELAYS_MS = [200, 600, 1400];

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ───── Public API ─────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Invoke an ai-service endpoint through the trust boundary.
 *
 * @param method HTTP method
 * @param path Absolute path on ai-service (e.g. '/ai/pdf-extract' or '/ai/pdf-extract/runs/abc')
 * @param body JSON-serializable body (ignored for GET/DELETE)
 * @param options User claims, cost cap, request id, overrides
 * @returns Parsed JSON response from ai-service
 * @throws BridgeError on circuit breaker open, network failure, timeout, or non-2xx upstream
 */
export async function callAiService(
  method: HttpMethod,
  path: string,
  body: unknown,
  options: CallAiServiceOptions = {},
): Promise<unknown> {
  const requestId = options.requestId ?? randomUUID();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxRetries = options.maxRetries ?? 3;
  const breakerKey = `${method} ${path}`;
  const now = Date.now();

  if (isBreakerOpen(breakerKey, now)) {
    const retryAfter = Math.ceil(BREAKER_OPEN_DURATION_MS / 1000);
    logger.warn(
      { requestId, breakerKey, retryAfterSeconds: retryAfter },
      'ai-service circuit breaker open — short-circuiting request',
    );
    throw new BridgeError(
      {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'El servicio de IA no está disponible.',
        hint: 'Intenta nuevamente en unos segundos.',
        retryAfterSeconds: retryAfter,
        requestId,
      },
      503,
    );
  }

  const url = `${config.aiServiceUrl}${path}`;
  const headers = buildHeaders(requestId, options);
  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (method !== 'GET' && method !== 'DELETE') {
    init.body = JSON.stringify(body ?? {});
  }

  let lastError: BridgeError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = BACKOFF_DELAYS_MS[Math.min(attempt - 1, BACKOFF_DELAYS_MS.length - 1)];
      await sleep(delay);
    }

    try {
      const response = await fetchImpl(url, init);

      if (response.ok) {
        recordSuccess(breakerKey);
        // ai-service is expected to honor X-Cost-Cap-USD (enforcement is TASK-008).
        try {
          return await response.json();
        } catch (_jsonErr) {
          // Body wasn't valid JSON — treat as upstream contract violation.
          throw new BridgeError(
            {
              code: 'AI_SERVICE_INTERNAL',
              message: 'Respuesta inválida del servicio de IA.',
              requestId,
              upstreamStatus: response.status,
            },
            502,
          );
        }
      }

      // Non-2xx: map status to a BridgeError. If 5xx and retries remain, loop.
      const errBody = await response.json().catch(() => ({}));
      const upstreamCode = (errBody && typeof errBody === 'object' && 'code' in errBody)
        ? String((errBody as Record<string, unknown>).code)
        : undefined;

      if (response.status >= 500 && shouldRetry(response.status, attempt, maxRetries)) {
        recordFailure(breakerKey, Date.now());
        lastError = new BridgeError(
          {
            code: 'AI_SERVICE_INTERNAL',
            message: 'El servicio de IA falló temporalmente.',
            requestId,
            upstreamStatus: response.status,
          },
          502,
        );
        continue;
      }

      // Deterministic error or out of retries — translate and throw.
      recordFailure(breakerKey, Date.now());
      throw mapUpstreamError(response.status, upstreamCode, requestId);
    } catch (err) {
      if (err instanceof BridgeError) {
        // If this came from a retry-eligible 5xx loop branch above, we'd have
        // continue'd. Reaching here means it was thrown directly — propagate.
        throw err;
      }

      // Network/timeout failures: classify and decide whether to retry.
      const isAbort = err instanceof Error && err.name === 'AbortError';
      const code = isAbort ? 'AI_UPSTREAM_TIMEOUT' : 'AI_SERVICE_UNAVAILABLE';
      const msg = isAbort
        ? 'El servicio de IA tardó demasiado en responder.'
        : 'No se pudo contactar al servicio de IA.';

      lastError = new BridgeError(
        {
          code,
          message: msg,
          requestId,
        },
        isAbort ? 504 : 502,
      );

      if (shouldRetry(undefined, attempt, maxRetries)) {
        recordFailure(breakerKey, Date.now());
        continue;
      }
      recordFailure(breakerKey, Date.now());
      throw lastError;
    }
  }

  // Exhausted retries
  throw (
    lastError ??
    new BridgeError(
      {
        code: 'AI_SERVICE_INTERNAL',
        message: 'El servicio de IA no completó la solicitud.',
        requestId,
      },
      502,
    )
  );
}

function mapUpstreamError(
  status: number,
  upstreamCode: string | undefined,
  requestId: string,
): BridgeError {
  // Mapping aligned with TASK-007 §5 "Mapeo de errores".
  switch (status) {
    case 400:
      return new BridgeError(
        { code: 'AI_INVALID_INPUT', message: 'Solicitud inválida al servicio de IA.', requestId, upstreamStatus: status },
        400,
      );
    case 401:
    case 403:
      return new BridgeError(
        { code: 'AI_SERVICE_INTERNAL', message: 'Error interno del servicio de IA.', requestId, upstreamStatus: status },
        502,
      );
    case 402:
      return new BridgeError(
        {
          code: 'AI_COST_CAP_EXCEEDED',
          message: 'El costo proyectado excede el límite permitido.',
          hint: 'Reduce el tamaño del prompt o solicita un cap mayor.',
          requestId,
          upstreamStatus: status,
        },
        402,
      );
    case 422:
      return new BridgeError(
        { code: 'AI_INVALID_INPUT', message: 'Datos inválidos para el servicio de IA.', requestId, upstreamStatus: status },
        422,
      );
    case 504:
      return new BridgeError(
        { code: 'AI_UPSTREAM_TIMEOUT', message: 'El proveedor de IA superó el tiempo de espera.', requestId, upstreamStatus: status },
        504,
      );
    case 503:
      return new BridgeError(
        { code: 'AI_UPSTREAM_UNAVAILABLE', message: 'El proveedor de IA no está disponible.', requestId, upstreamStatus: status },
        503,
      );
    default:
      return new BridgeError(
        {
          code: upstreamCode === 'BRIDGE_REPLAY_DETECTED' ? 'BRIDGE_REPLAY_DETECTED' : 'AI_SERVICE_INTERNAL',
          message: 'Error del servicio de IA.',
          requestId,
          upstreamStatus: status,
        },
        status >= 500 ? 502 : status,
      );
  }
}

// ───── Injectable contract for callers (e.g. TASK-006 pdf.service) ───────────

/**
 * Bridge contract callers depend on. TASK-006 (initiative-pdfs) and any future
 * caller (mentor, feedback, research) MUST accept this shape via constructor
 * injection so tests can swap it for a stub:
 *
 *   constructor(private bridge: AiBridge = defaultAiBridge) {}
 *
 * Then in tests:
 *
 *   const fakeBridge: AiBridge = { callAiService: vi.fn().mockResolvedValue({ runId: 'x' }) };
 *   const service = new PdfService(fakeBridge);
 */
export interface AiBridge {
  callAiService: typeof callAiService;
}

export const defaultAiBridge: AiBridge = { callAiService };
