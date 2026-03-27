import { RequestHandler, Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function createRateLimiter(
  windowMs: number,
  maxRequests: number,
  keyFn: (req: Request) => string,
  message: string,
): RequestHandler {
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent unbounded memory growth
  const CLEANUP_INTERVAL = 60_000;
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn(req);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, maxRequests - entry.count);
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', retryAfter);
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    next();
  };
}

/**
 * Login rate limiter: 5 attempts per minute per IP.
 */
export const loginLimiter: RequestHandler = createRateLimiter(
  60_000,
  5,
  (req) => req.ip || req.socket.remoteAddress || 'unknown',
  'Demasiados intentos de inicio de sesion. Intenta en un minuto.',
);

/**
 * API rate limiter: 100 requests per minute per user (or IP if unauthenticated).
 */
export const apiLimiter: RequestHandler = createRateLimiter(
  60_000,
  100,
  (req) => (req as any).user?.sub || req.ip || req.socket.remoteAddress || 'unknown',
  'Demasiadas solicitudes. Intenta en un momento.',
);
