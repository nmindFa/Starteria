import { describe, expect, it, beforeEach, vi } from 'vitest';

vi.mock('../api', () => {
  const get = vi.fn();
  const post = vi.fn();
  return { default: { get, post } };
});

import api from '../api';
import { listReviews, getReview, submitReview } from '../mentorService';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe('mentorService', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
  });

  it('listReviews returns the data array', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          { id: 'r1', projectId: 'p1', status: 'pending' },
          { id: 'r2', projectId: 'p2', status: 'approved' },
        ],
      },
    });

    const result = await listReviews();
    expect(apiMock.get).toHaveBeenCalledWith('/mentor/reviews');
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('r1');
  });

  it('getReview fetches a single review by id', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'r1', projectId: 'p1', status: 'pending', stepNumber: 2 },
      },
    });

    const result = await getReview('r1');
    expect(apiMock.get).toHaveBeenCalledWith('/mentor/reviews/r1');
    expect(result.stepNumber).toBe(2);
  });

  it('submitReview posts decision payload and returns updated review', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'r1', projectId: 'p1', status: 'approved' },
      },
    });

    const body = { feedback: 'Great work', decision: 'approved' as const };
    const result = await submitReview('r1', body);

    expect(apiMock.post).toHaveBeenCalledWith('/mentor/reviews/r1', body);
    expect(result.status).toBe('approved');
  });

  it('submitReview supports rework decision', async () => {
    apiMock.post.mockResolvedValueOnce({
      data: { success: true, data: { id: 'r2', projectId: 'p2', status: 'rework' } },
    });
    const result = await submitReview('r2', { decision: 'rework' });
    expect(result.status).toBe('rework');
  });
});
