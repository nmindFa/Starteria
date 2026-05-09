import { describe, expect, it } from 'vitest';
import { StatusMapper } from '../status-mapper';

/**
 * Tests for the bidirectional StatusMapper between Spanish UI labels and
 * Prisma DB enum values. Pure data — no IO. Stable contract: any change
 * here cascades into seed data, the front, and the back, so we lock all
 * known mappings.
 */

describe('shared/utils/status-mapper', () => {
  describe('projectStatus', () => {
    it.each([
      ['Draft', 'DRAFT'],
      ['En progreso', 'IN_PROGRESS'],
      ['En revisión IA', 'AI_REVIEW'],
      ['Iteración', 'ITERATION'],
      ['Sesión experto pendiente', 'EXPERT_SESSION_PENDING'],
      ['Paso aprobado', 'STEP_APPROVED'],
      ['Finalizado', 'COMPLETED'],
    ])('toDb[%s] = %s', (frontend, db) => {
      expect((StatusMapper.projectStatus.toDb as Record<string, string>)[frontend]).toBe(db);
    });

    it('roundtrip toDb -> toFrontend is the identity for all keys', () => {
      for (const [frontend, db] of Object.entries(StatusMapper.projectStatus.toDb)) {
        expect(StatusMapper.projectStatus.toFrontend[db]).toBe(frontend);
      }
    });
  });

  describe('stepStatus', () => {
    it('contains the expected keys', () => {
      expect(Object.keys(StatusMapper.stepStatus.toDb)).toEqual([
        'No iniciado',
        'En progreso',
        'Enviado',
        'Feedback IA',
        'Ajustado',
        'Sesión experto pendiente',
        'Aprobado',
        'Bloqueado',
      ]);
    });
    it('roundtrip identity', () => {
      for (const [k, v] of Object.entries(StatusMapper.stepStatus.toDb)) {
        expect(StatusMapper.stepStatus.toFrontend[v]).toBe(k);
      }
    });
  });

  describe('moduleStatus', () => {
    it('roundtrip identity', () => {
      for (const [k, v] of Object.entries(StatusMapper.moduleStatus.toDb)) {
        expect(StatusMapper.moduleStatus.toFrontend[v]).toBe(k);
      }
    });
  });

  describe('step0Status', () => {
    it('maps the three values', () => {
      expect(StatusMapper.step0Status.toDb).toEqual({
        'No iniciado': 'NOT_STARTED',
        'En progreso': 'IN_PROGRESS',
        Completado: 'COMPLETED',
      });
    });
  });

  describe('runStatus', () => {
    it('roundtrip identity', () => {
      for (const [k, v] of Object.entries(StatusMapper.runStatus.toDb)) {
        expect(StatusMapper.runStatus.toFrontend[v]).toBe(k);
      }
    });
  });

  describe('evidenceStatus', () => {
    it('contains UPLOADED / VERIFIED / REJECTED', () => {
      expect(StatusMapper.evidenceStatus.toDb.Subida).toBe('UPLOADED');
      expect(StatusMapper.evidenceStatus.toDb.Verificada).toBe('VERIFIED');
      expect(StatusMapper.evidenceStatus.toDb.Rechazada).toBe('REJECTED');
    });
  });

  describe('evidenceType', () => {
    it('roundtrip identity', () => {
      for (const [k, v] of Object.entries(StatusMapper.evidenceType.toDb)) {
        expect(StatusMapper.evidenceType.toFrontend[v]).toBe(k);
      }
    });
  });

  describe('sessionStatus', () => {
    it('roundtrip identity', () => {
      for (const [k, v] of Object.entries(StatusMapper.sessionStatus.toDb)) {
        expect(StatusMapper.sessionStatus.toFrontend[v]).toBe(k);
      }
    });
  });

  describe('resultStatus', () => {
    it('maps Aprobado / Iterar / Bloqueado', () => {
      expect(StatusMapper.resultStatus.toDb).toEqual({
        Aprobado: 'APPROVED',
        Iterar: 'ITERATE',
        Bloqueado: 'BLOCKED',
      });
    });
  });

  describe('riskLevel', () => {
    it('maps Bajo/Medio/Alto', () => {
      expect(StatusMapper.riskLevel.toDb).toEqual({
        Bajo: 'LOW',
        Medio: 'MEDIUM',
        Alto: 'HIGH',
      });
    });
  });

  describe('teamRole', () => {
    it('maps Owner/Editor/Viewer', () => {
      expect(StatusMapper.teamRole.toDb).toEqual({
        Owner: 'OWNER',
        Editor: 'EDITOR',
        Viewer: 'VIEWER',
      });
    });
  });

  describe('teamMemberStatus', () => {
    it('maps Activo/Pendiente', () => {
      expect(StatusMapper.teamMemberStatus.toDb).toEqual({
        Activo: 'ACTIVE',
        Pendiente: 'PENDING',
      });
    });
  });
});
