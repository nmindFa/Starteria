import { describe, expect, it } from 'vitest';
import { fakeAiResponse, fakeJwt, fakeProject, fakeUser } from '../index';

describe('test factories', () => {
  describe('fakeProject', () => {
    it('generates a project with all required fields', () => {
      const project = fakeProject();
      expect(project.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(typeof project.name).toBe('string');
      expect(project.name.length).toBeGreaterThan(0);
      expect(typeof project.description).toBe('string');
      expect(['draft', 'active', 'archived']).toContain(project.status);
      expect(project.createdAt).toBeInstanceOf(Date);
      expect(project.updatedAt).toBeInstanceOf(Date);
    });

    it('honors overrides', () => {
      const project = fakeProject({ name: 'My Project', status: 'active' });
      expect(project.name).toBe('My Project');
      expect(project.status).toBe('active');
    });
  });

  describe('fakeUser', () => {
    it('generates a user with all required fields', () => {
      const user = fakeUser();
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(user.email).toMatch(/@/);
      expect(['founder', 'mentor', 'admin', 'sponsor']).toContain(user.role);
    });

    it('honors overrides', () => {
      const user = fakeUser({ role: 'mentor', email: 'a@b.com' });
      expect(user.role).toBe('mentor');
      expect(user.email).toBe('a@b.com');
    });
  });

  describe('fakeJwt', () => {
    it('returns a 3-segment jwt string', () => {
      const token = fakeJwt(fakeUser());
      expect(token.split('.').length).toBe(3);
    });
  });

  describe('fakeAiResponse', () => {
    it('wraps data in the standard envelope', () => {
      const res = fakeAiResponse({ message: 'hi' });
      expect(res.ok).toBe(true);
      expect(res.data).toEqual({ message: 'hi' });
      expect(res.meta.agent).toBe('mentor');
      expect(res.meta.tokensIn).toBe(200);
      expect(res.meta.tokensOut).toBe(300);
      expect(res.meta.latencyMs).toBe(1200);
      expect(res.meta.costUsd).toBeCloseTo(0.001);
      expect(res.meta.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('honors meta overrides', () => {
      const res = fakeAiResponse({ x: 1 }, { agent: 'judge', model: 'sonnet' });
      expect(res.meta.agent).toBe('judge');
      expect(res.meta.model).toBe('sonnet');
    });
  });
});
