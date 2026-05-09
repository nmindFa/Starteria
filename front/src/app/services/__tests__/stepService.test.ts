import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../api', () => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return { default: { get, post, put, patch, delete: del } };
});

import api from '../api';
import {
  listSteps,
  getStep,
  getStepData,
  saveStepData,
  updateStepStatus,
  updateModuleStatus,
  requestMentorSession,
  adaptStepStatus,
  adaptModuleStatus,
} from '../stepService';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

describe('stepService — stable surface (no AI review)', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.patch.mockReset();
  });

  it('listSteps returns adapted steps with adapted module statuses', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 's1',
            stepNumber: 1,
            status: 'AI_FEEDBACK',
            modules: [{ id: 'm1', status: 'APPROVED' }],
          },
        ],
      },
    });

    const result = await listSteps('proj-1');
    expect(apiMock.get).toHaveBeenCalledWith('/projects/proj-1/steps');
    expect(result[0].status).toBe('Feedback IA');
    expect(result[0].modules?.[0].status).toBe('Aprobado');
  });

  it('getStep adapts a single step', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { success: true, data: { id: 's1', stepNumber: 2, status: 'SUBMITTED' } },
    });
    const result = await getStep('proj-1', 2);
    expect(apiMock.get).toHaveBeenCalledWith('/projects/proj-1/steps/2');
    expect(result.status).toBe('Enviado');
  });

  it('getStepData returns the raw blob', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { success: true, data: { foo: 1, bar: 'b' } },
    });
    const result = await getStepData('proj-1', 1);
    expect(apiMock.get).toHaveBeenCalledWith('/projects/proj-1/steps/1/data');
    expect(result.foo).toBe(1);
  });

  it('saveStepData puts the entire blob', async () => {
    apiMock.put.mockResolvedValueOnce({
      data: { success: true, data: { foo: 1 } },
    });
    const result = await saveStepData('proj-1', 1, { foo: 1 });
    expect(apiMock.put).toHaveBeenCalledWith('/projects/proj-1/steps/1/data', { foo: 1 });
    expect(result.foo).toBe(1);
  });

  it('updateStepStatus converts frontend status to backend, adapts response', async () => {
    apiMock.patch.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 's1', stepNumber: 1, status: 'APPROVED' },
      },
    });
    const result = await updateStepStatus('proj-1', 1, 'Aprobado');
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/projects/proj-1/steps/1',
      { status: 'APPROVED' },
    );
    expect(result.status).toBe('Aprobado');
  });

  it('updateModuleStatus converts frontend module status and adapts response', async () => {
    apiMock.patch.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'mod-1', status: 'APPROVED' },
      },
    });
    const result = await updateModuleStatus('proj-1', 1, 'mod-1', 'Aprobado');
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/projects/proj-1/steps/1/modules/mod-1',
      { status: 'APPROVED' },
    );
    expect(result.id).toBe('mod-1');
    expect(result.status).toBe('Aprobado');
  });

  it('requestMentorSession posts to session endpoint', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: { success: true, data: { sessionId: 'sess-1' } },
    });
    const result = await requestMentorSession('proj-1', 2);
    expect(apiMock.post).toHaveBeenCalledWith('/projects/proj-1/steps/2/session');
    expect(result.sessionId).toBe('sess-1');
  });

  it('re-exports adaptStepStatus and adaptModuleStatus helpers', () => {
    expect(adaptStepStatus('NOT_STARTED')).toBe('No iniciado');
    expect(adaptModuleStatus('COMPLETED')).toBe('Completado');
  });
});
