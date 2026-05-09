import { describe, expect, it } from 'vitest';
import { registerSchema, loginSchema } from '../auth.schemas';

/**
 * Tests for auth Zod schemas. These schemas are part of the canonical
 * auth contract — their issue messages are inspected by the central
 * errorHandler to assign Envelope V1 codes (AUTH_PASSWORD_NO_UPPER, etc).
 * Don't change them without updating error-handler.ts.
 */

describe('modules/auth/auth.schemas', () => {
  describe('registerSchema', () => {
    const valid = {
      email: 'a@b.com',
      password: 'StrongPass1',
      name: 'Alice Doe',
      role: 'participante' as const,
    };

    it('accepts a valid registration', () => {
      const r = registerSchema.safeParse(valid);
      expect(r.success).toBe(true);
    });

    it('trims the name and exposes it as data', () => {
      const r = registerSchema.safeParse({ ...valid, name: '  Alice Doe  ' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.name).toBe('Alice Doe');
    });

    it('defaults role to participante when omitted', () => {
      const { role, ...without } = valid; void role;
      const r = registerSchema.safeParse(without);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.role).toBe('participante');
    });

    it.each([
      'mentor',
      'admin',
      'sponsor',
      'colaborador',
      'viewer',
    ])('accepts role=%s', (role) => {
      const r = registerSchema.safeParse({ ...valid, role });
      expect(r.success).toBe(true);
    });

    it('rejects unknown roles', () => {
      const r = registerSchema.safeParse({ ...valid, role: 'super-admin' });
      expect(r.success).toBe(false);
    });

    it('rejects an invalid email', () => {
      const r = registerSchema.safeParse({ ...valid, email: 'not-an-email' });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.errors[0].path[0]).toBe('email');
      }
    });

    it('rejects passwords < 8 chars with the canonical message', () => {
      const r = registerSchema.safeParse({ ...valid, password: 'A1bc' });
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.errors.find((i) => i.path[0] === 'password');
        expect(issue?.message).toContain('8 caracteres');
      }
    });

    it('rejects passwords without uppercase using the mayuscula message', () => {
      const r = registerSchema.safeParse({ ...valid, password: 'lowercase1' });
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.errors.find(
          (i) => i.path[0] === 'password' && i.message.toLowerCase().includes('mayuscula'),
        );
        expect(issue).toBeTruthy();
      }
    });

    it('rejects passwords without lowercase using the minuscula message', () => {
      const r = registerSchema.safeParse({ ...valid, password: 'UPPERCASE1' });
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.errors.find(
          (i) => i.path[0] === 'password' && i.message.toLowerCase().includes('minuscula'),
        );
        expect(issue).toBeTruthy();
      }
    });

    it('rejects passwords without a digit using the numero message', () => {
      const r = registerSchema.safeParse({ ...valid, password: 'NoDigitsAB' });
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.errors.find(
          (i) => i.path[0] === 'password' && i.message.toLowerCase().includes('numero'),
        );
        expect(issue).toBeTruthy();
      }
    });

    it('rejects names < 2 chars and > 100 chars', () => {
      expect(registerSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false);
      expect(registerSchema.safeParse({ ...valid, name: 'A'.repeat(101) }).success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts a valid email + password', () => {
      const r = loginSchema.safeParse({ email: 'a@b.com', password: 'x' });
      expect(r.success).toBe(true);
    });

    it('rejects an invalid email', () => {
      const r = loginSchema.safeParse({ email: 'no', password: 'x' });
      expect(r.success).toBe(false);
    });

    it('requires a non-empty password', () => {
      const r = loginSchema.safeParse({ email: 'a@b.com', password: '' });
      expect(r.success).toBe(false);
    });
  });
});
