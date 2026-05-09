import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../api', () => {
  const get = vi.fn();
  const post = vi.fn();
  const put = vi.fn();
  const patch = vi.fn();
  const del = vi.fn();
  return {
    default: { get, post, put, patch, delete: del },
  };
});

import api from '../api';
import { listCohorts, getCohortProjects } from '../cohortService';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
};

describe('cohortService.listCohorts', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  it('returns the data array as-is', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { id: 'c1', code: 'C1', name: 'Cohort 1' },
          { id: 'c2', name: 'Cohort 2' },
        ],
      },
    });
    const cohorts = await listCohorts();
    expect(apiMock.get).toHaveBeenCalledWith('/admin/cohorts');
    expect(cohorts).toHaveLength(2);
    expect(cohorts[0].code).toBe('C1');
  });
});

describe('cohortService.getCohortProjects', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
  });

  it('adapts plain array projects', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [{ id: 'p1', name: 'P1', status: 'IN_PROGRESS' }],
      },
    });
    const result = await getCohortProjects('cohort-1');
    expect(apiMock.get).toHaveBeenCalledWith('/admin/cohorts/cohort-1/projects');
    expect(result[0].status).toBe('En progreso');
  });

  it('adapts paginated { items: [] } shape', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          items: [
            { id: 'p2', name: 'P2', status: 'COMPLETED' },
            { id: 'p3', name: 'P3', status: 'DRAFT' },
          ],
        },
      },
    });
    const result = await getCohortProjects('cohort-2');
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('Finalizado');
    expect(result[1].status).toBe('Draft');
  });
});
