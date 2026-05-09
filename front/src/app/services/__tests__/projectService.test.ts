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
  list,
  getById,
  create,
  update,
  archive,
  getStep0,
  updateStep0,
  updatePosition,
} from '../projectService';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('projectService', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.delete.mockReset();
  });

  it('list returns adapted projects', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { id: 'p1', name: 'P1', status: 'IN_PROGRESS' },
          { id: 'p2', name: 'P2', status: 'COMPLETED' },
        ],
      },
    });
    const result = await list();
    expect(apiMock.get).toHaveBeenCalledWith('/projects');
    expect(result[0].status).toBe('En progreso');
    expect(result[1].status).toBe('Finalizado');
  });

  it('getById returns adapted single project', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { success: true, data: { id: 'p1', name: 'P', status: 'AI_REVIEW' } },
    });
    const result = await getById('p1');
    expect(apiMock.get).toHaveBeenCalledWith('/projects/p1');
    expect(result.status).toBe('En revision IA');
  });

  it('create posts body and adapts response', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: { success: true, data: { id: 'p99', name: 'New', status: 'DRAFT' } },
    });
    const body = { name: 'New' };
    const result = await create(body);
    expect(apiMock.post).toHaveBeenCalledWith('/projects', body);
    expect(result.status).toBe('Draft');
  });

  it('update converts frontend status to backend before sending and adapts response', async () => {
    apiMock.patch.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'p1', name: 'P', status: 'COMPLETED' },
      },
    });
    const result = await update('p1', { status: 'Finalizado', name: 'P' });
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/projects/p1',
      expect.objectContaining({ status: 'COMPLETED', name: 'P' }),
    );
    expect(result.status).toBe('Finalizado');
  });

  it('archive sends DELETE to the project endpoint', async () => {
    apiMock.delete.mockResolvedValueOnce({ data: { success: true } });
    await archive('p1');
    expect(apiMock.delete).toHaveBeenCalledWith('/projects/p1');
  });

  it('getStep0 returns the data blob', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: { success: true, data: { foo: 'bar', n: 1 } },
    });
    const result = await getStep0('p1');
    expect(apiMock.get).toHaveBeenCalledWith('/projects/p1/step0');
    expect(result.foo).toBe('bar');
  });

  it('updateStep0 merges status into payload', async () => {
    apiMock.patch.mockResolvedValueOnce({
      data: { success: true, data: { foo: 'bar', status: 'COMPLETED' } },
    });
    const result = await updateStep0('p1', { foo: 'bar' }, 'COMPLETED');
    expect(apiMock.patch).toHaveBeenCalledWith(
      '/projects/p1/step0',
      { foo: 'bar', status: 'COMPLETED' },
    );
    expect(result.status).toBe('COMPLETED');
  });

  it('updatePosition sends position and adapts response', async () => {
    apiMock.patch.mockResolvedValueOnce({
      data: { success: true, data: { id: 'p1', name: 'P', status: 'DRAFT', position: 3 } },
    });
    const result = await updatePosition('p1', 3);
    expect(apiMock.patch).toHaveBeenCalledWith('/projects/p1/position', { position: 3 });
    expect(result.position).toBe(3);
  });
});
