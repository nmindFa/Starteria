import { describe, expect, it } from 'vitest';
import { AppError } from '../AppError';

/**
 * Unit tests for the typed AppError factories (Error Envelope V1, ADR-010).
 *
 * These factories are part of the canonical error contract — they MUST
 * preserve their codes, statusCodes and option fields so the central
 * errorHandler can serialise them deterministically.
 */
describe('shared/errors/AppError', () => {
  describe('constructor + base behaviour', () => {
    it('is an Error subclass with a code and statusCode', () => {
      const err = new AppError(418, "I'm a teapot", 'TEAPOT');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(418);
      expect(err.code).toBe('TEAPOT');
      expect(err.message).toBe("I'm a teapot");
      expect(err.isOperational).toBe(true);
    });

    it('preserves prototype chain (so instanceof checks work after thrown/caught)', () => {
      try {
        throw new AppError(400, 'bad', 'BAD_REQUEST');
      } catch (caught) {
        expect(caught instanceof AppError).toBe(true);
      }
    });

    it('accepts optional fields (field, hint, retryAfterSeconds, details)', () => {
      const err = new AppError(400, 'oops', 'X', true, {
        field: 'email',
        hint: 'try again',
        retryAfterSeconds: 30,
        details: [{ field: 'email', code: 'INVALID', message: 'no good' }],
      });
      expect(err.field).toBe('email');
      expect(err.hint).toBe('try again');
      expect(err.retryAfterSeconds).toBe(30);
      expect(err.details).toEqual([
        { field: 'email', code: 'INVALID', message: 'no good' },
      ]);
    });

    it('isOperational defaults to true and is settable via constructor', () => {
      const op = new AppError(400, 'm', 'C');
      const programmer = new AppError(500, 'm', 'C', false);
      expect(op.isOperational).toBe(true);
      expect(programmer.isOperational).toBe(false);
    });
  });

  describe('generic factories', () => {
    it('badRequest defaults to status 400', () => {
      const err = AppError.badRequest('nope', 'BAD');
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('BAD');
    });

    it('unauthorized defaults to 401 and code UNAUTHORIZED', () => {
      const err = AppError.unauthorized();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.message).toBe('No autorizado.');
    });

    it('forbidden defaults to 403 and code FORBIDDEN', () => {
      const err = AppError.forbidden();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });

    it('notFound builds resource-aware message and defaults to NOT_FOUND', () => {
      const err = AppError.notFound('Proyecto');
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
      expect(err.message).toBe('Proyecto no encontrado.');
    });

    it('notFound accepts a domain code override', () => {
      const err = AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
      expect(err.code).toBe('PROJECT_NOT_FOUND');
    });

    it('conflict defaults to 409', () => {
      const err = AppError.conflict('dup');
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });

    it('internal sets statusCode 500 and isOperational=false', () => {
      const err = AppError.internal();
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL_ERROR');
      expect(err.isOperational).toBe(false);
    });
  });

  describe('auth-specific factories (Envelope V1)', () => {
    it('invalidCredentials returns 401 + AUTH_INVALID_CREDENTIALS + hint', () => {
      const err = AppError.invalidCredentials();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(err.hint).toBeDefined();
    });

    it('emailTaken returns 409 + AUTH_EMAIL_TAKEN + field=email', () => {
      const err = AppError.emailTaken();
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('AUTH_EMAIL_TAKEN');
      expect(err.field).toBe('email');
    });

    it('accountLocked returns 423 with ceil-rounded retryAfterSeconds (>=1)', () => {
      const err = AppError.accountLocked(0);
      expect(err.statusCode).toBe(423);
      expect(err.code).toBe('AUTH_ACCOUNT_LOCKED');
      expect(err.retryAfterSeconds).toBe(1); // floored at 1

      const err2 = AppError.accountLocked(31.4);
      expect(err2.retryAfterSeconds).toBe(32); // ceil
    });

    it('accountLocked computes minutes inside hint message', () => {
      const err = AppError.accountLocked(120);
      expect(err.hint).toContain('2 minutos');
    });

    it('rateLimited returns 429 + AUTH_RATE_LIMITED + retryAfterSeconds', () => {
      const err = AppError.rateLimited(45);
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('AUTH_RATE_LIMITED');
      expect(err.retryAfterSeconds).toBe(45);
      expect(err.hint).toContain('45');
    });

    it('rateLimited floors retryAfterSeconds at 1', () => {
      const err = AppError.rateLimited(0);
      expect(err.retryAfterSeconds).toBe(1);
    });

    it('registerRoleForbidden returns 403 + AUTH_REGISTER_ROLE_FORBIDDEN', () => {
      const err = AppError.registerRoleForbidden();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('AUTH_REGISTER_ROLE_FORBIDDEN');
    });

    it('refreshInvalid / refreshExpired / refreshReused all return 401 with their codes', () => {
      expect(AppError.refreshInvalid().code).toBe('AUTH_REFRESH_TOKEN_INVALID');
      expect(AppError.refreshExpired().code).toBe('AUTH_REFRESH_TOKEN_EXPIRED');
      expect(AppError.refreshReused().code).toBe('AUTH_REFRESH_TOKEN_REUSED');
      expect(AppError.refreshInvalid().statusCode).toBe(401);
      expect(AppError.refreshExpired().statusCode).toBe(401);
      expect(AppError.refreshReused().statusCode).toBe(401);
    });

    it('validation returns 400 + VALIDATION_ERROR + details', () => {
      const details = [
        { field: 'email', code: 'AUTH_EMAIL_INVALID', message: 'bad email' },
      ];
      const err = AppError.validation(details);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual(details);
    });
  });
});
