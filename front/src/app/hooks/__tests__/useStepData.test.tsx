import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../../services/stepService', () => ({
  getStepData: vi.fn(),
}));

import { getStepData } from '../../services/stepService';
import { useStepData } from '../useStepData';

const getStepDataMock = getStepData as unknown as ReturnType<typeof vi.fn>;

describe('useStepData', () => {
  beforeEach(() => {
    getStepDataMock.mockReset();
  });

  it('does not fetch when projectId is undefined', () => {
    const { result } = renderHook(() => useStepData(undefined, 1));
    expect(getStepDataMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('loads data, exposes loading state, and stores the result', async () => {
    getStepDataMock.mockResolvedValueOnce({ foo: 'bar' });
    const { result } = renderHook(() => useStepData<{ foo: string }>('p1', 1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getStepDataMock).toHaveBeenCalledWith('p1', 1);
    expect(result.current.data).toEqual({ foo: 'bar' });
    expect(result.current.error).toBeNull();
  });

  it('captures errors when fetch fails', async () => {
    getStepDataMock.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useStepData('p1', 2));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  it('refetch triggers another fetch', async () => {
    getStepDataMock.mockResolvedValue({ n: 1 });
    const { result } = renderHook(() => useStepData('p1', 1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getStepDataMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(getStepDataMock).toHaveBeenCalledTimes(2));
  });

  it('refetches when projectId or stepNumber changes', async () => {
    getStepDataMock.mockResolvedValue({ n: 1 });
    const { result, rerender } = renderHook(
      ({ pid, step }: { pid: string; step: number }) => useStepData(pid, step),
      { initialProps: { pid: 'p1', step: 1 } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getStepDataMock).toHaveBeenCalledTimes(1);

    rerender({ pid: 'p1', step: 2 });
    await waitFor(() => expect(getStepDataMock).toHaveBeenCalledTimes(2));

    rerender({ pid: 'p2', step: 2 });
    await waitFor(() => expect(getStepDataMock).toHaveBeenCalledTimes(3));
  });

  it('wraps non-Error rejections into Error objects', async () => {
    getStepDataMock.mockRejectedValueOnce('plain string failure');
    const { result } = renderHook(() => useStepData('p1', 1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('plain string failure');
  });
});
