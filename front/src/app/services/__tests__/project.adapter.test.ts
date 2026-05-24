import { describe, expect, it } from 'vitest';
import {
  adaptProjectStatus,
  adaptProjectStatusToBackend,
  adaptStepStatus,
  adaptStepStatusToBackend,
  adaptModuleStatus,
  adaptModuleStatusToBackend,
  adaptStep0Status,
  adaptStep0StatusToBackend,
  adaptProject,
  adaptProjectToBackend,
  adaptStep,
  type BackendProject,
  type BackendStep,
} from '../project.adapter';

describe('project.adapter — status maps', () => {
  it('translates project status backend -> frontend for known keys', () => {
    expect(adaptProjectStatus('DRAFT')).toBe('Draft');
    expect(adaptProjectStatus('IN_PROGRESS')).toBe('En progreso');
    expect(adaptProjectStatus('AI_REVIEW')).toBe('En revision IA');
    expect(adaptProjectStatus('ITERATION')).toBe('Iteracion');
    expect(adaptProjectStatus('EXPERT_SESSION_PENDING')).toBe('Sesion experto pendiente');
    expect(adaptProjectStatus('STEP_APPROVED')).toBe('Paso aprobado');
    expect(adaptProjectStatus('COMPLETED')).toBe('Finalizado');
  });

  it('falls back to the original value for unknown project status keys', () => {
    expect(adaptProjectStatus('UNKNOWN_STATE')).toBe('UNKNOWN_STATE');
  });

  it('translates project status frontend -> backend and is reversible', () => {
    expect(adaptProjectStatusToBackend('Draft')).toBe('DRAFT');
    expect(adaptProjectStatusToBackend('En progreso')).toBe('IN_PROGRESS');
    expect(adaptProjectStatusToBackend('Finalizado')).toBe('COMPLETED');
    // Unknown -> identity
    expect(adaptProjectStatusToBackend('Algo raro')).toBe('Algo raro');
  });

  it('translates step status both directions', () => {
    expect(adaptStepStatus('NOT_STARTED')).toBe('No iniciado');
    expect(adaptStepStatus('SUBMITTED')).toBe('Enviado');
    expect(adaptStepStatus('AI_FEEDBACK')).toBe('Feedback IA');
    expect(adaptStepStatus('APPROVED')).toBe('Aprobado');
    expect(adaptStepStatus('BLOCKED')).toBe('Bloqueado');
    expect(adaptStepStatusToBackend('No iniciado')).toBe('NOT_STARTED');
    expect(adaptStepStatusToBackend('Aprobado')).toBe('APPROVED');
    expect(adaptStepStatusToBackend('Bloqueado')).toBe('BLOCKED');
    // Unknown identity
    expect(adaptStepStatus('FOO')).toBe('FOO');
    expect(adaptStepStatusToBackend('Foo')).toBe('Foo');
  });

  it('translates module status both directions', () => {
    expect(adaptModuleStatus('DRAFT')).toBe('Draft');
    expect(adaptModuleStatus('COMPLETED')).toBe('Completado');
    expect(adaptModuleStatus('SUBMITTED')).toBe('Enviado');
    expect(adaptModuleStatus('AI_FEEDBACK')).toBe('Feedback IA');
    expect(adaptModuleStatus('ADJUSTED')).toBe('Ajustado');
    expect(adaptModuleStatus('APPROVED')).toBe('Aprobado');
    expect(adaptModuleStatus('BLOCKED')).toBe('Bloqueado');
    expect(adaptModuleStatusToBackend('Draft')).toBe('DRAFT');
    expect(adaptModuleStatusToBackend('Completado')).toBe('COMPLETED');
    // Unknown identity
    expect(adaptModuleStatus('XYZ')).toBe('XYZ');
    expect(adaptModuleStatusToBackend('xyz')).toBe('xyz');
  });

  it('translates step0 status both directions', () => {
    expect(adaptStep0Status('NOT_STARTED')).toBe('No iniciado');
    expect(adaptStep0Status('IN_PROGRESS')).toBe('En progreso');
    expect(adaptStep0Status('COMPLETED')).toBe('Completado');
    expect(adaptStep0StatusToBackend('No iniciado')).toBe('NOT_STARTED');
    expect(adaptStep0StatusToBackend('Completado')).toBe('COMPLETED');
    // Unknown identity
    expect(adaptStep0Status('OTHER')).toBe('OTHER');
    expect(adaptStep0StatusToBackend('Otro')).toBe('Otro');
  });
});

describe('project.adapter — entity adapters', () => {
  it('adapts a full project including steps and nested modules', () => {
    const backend: BackendProject = {
      id: 'p1',
      name: 'Project 1',
      status: 'IN_PROGRESS',
      currentStep: 1,
      steps: [
        {
          id: 's1',
          stepNumber: 1,
          title: 'Step 1',
          status: 'AI_FEEDBACK',
          modules: [
            { id: 'm1', title: 'Mod 1', status: 'APPROVED' },
            { id: 'm2', title: 'Mod 2', status: 'BLOCKED' },
          ],
        },
      ],
      modules: [{ id: 'mp1', title: 'Project Mod', status: 'DRAFT' }],
      createdAt: '2025-01-01T00:00:00Z',
    };

    const adapted = adaptProject(backend);

    expect(adapted.status).toBe('En progreso');
    expect(adapted.steps?.[0].status).toBe('Feedback IA');
    expect(adapted.steps?.[0].modules?.[0].status).toBe('Aprobado');
    expect(adapted.steps?.[0].modules?.[1].status).toBe('Bloqueado');
    expect(adapted.modules?.[0].status).toBe('Draft');
    // Original fields preserved
    expect(adapted.id).toBe('p1');
    expect(adapted.currentStep).toBe(1);
    expect(adapted.createdAt).toBe('2025-01-01T00:00:00Z');
  });

  it('handles a project without steps or modules', () => {
    const backend: BackendProject = { id: 'p2', name: 'Empty', status: 'DRAFT' };
    const adapted = adaptProject(backend);
    expect(adapted.steps).toBeUndefined();
    expect(adapted.modules).toBeUndefined();
    expect(adapted.status).toBe('Draft');
  });

  it('adapts a single step with its modules', () => {
    const backendStep: BackendStep = {
      id: 's3',
      stepNumber: 2,
      title: 'Step 2',
      status: 'SUBMITTED',
      modules: [{ id: 'm3', title: 'M', status: 'IN_PROGRESS' }],
    };
    const adapted = adaptStep(backendStep);
    expect(adapted.status).toBe('Enviado');
    expect(adapted.modules?.[0].status).toBe('En progreso');
  });

  it('adapts a step without modules', () => {
    const backendStep: BackendStep = {
      id: 's4',
      stepNumber: 3,
      status: 'NOT_STARTED',
    };
    const adapted = adaptStep(backendStep);
    expect(adapted.status).toBe('No iniciado');
    expect(adapted.modules).toBeUndefined();
  });

  it('adaptProjectToBackend translates status and preserves other fields', () => {
    const result = adaptProjectToBackend({
      id: 'p9',
      name: 'X',
      status: 'En progreso',
      currentStep: 2,
    });
    expect(result.status).toBe('IN_PROGRESS');
    expect(result.id).toBe('p9');
    expect(result.name).toBe('X');
    expect(result.currentStep).toBe(2);
  });

  it('adaptProjectToBackend leaves status untouched when not provided', () => {
    const result = adaptProjectToBackend({ id: 'p10', name: 'X' });
    expect(result.status).toBeUndefined();
    expect(result.id).toBe('p10');
  });
});
