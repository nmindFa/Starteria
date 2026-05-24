import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { AutofillProvider } from '../../context/AutofillContext';
import {
  BACKOFF_INTERVALS_MS,
  usePdfAutofill,
} from '../usePdfAutofill';

// Hoist the mock so usePdfAutofill picks it up at import-time.
vi.mock('../../services/pdfAutofillService', () => {
  return {
    startExtractionRun: vi.fn(),
    getExtractionRunStatus: vi.fn(),
    listProposals: vi.fn(),
  };
});

import * as svc from '../../services/pdfAutofillService';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AutofillProvider>{children}</AutofillProvider>;
}

describe('usePdfAutofill', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle and transitions through running → done when status becomes completed', async () => {
    (svc.startExtractionRun as ReturnType<typeof vi.fn>).mockResolvedValue({
      runId: 'run-123',
    });
    (svc.getExtractionRunStatus as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ runId: 'run-123', status: 'running' })
      .mockResolvedValueOnce({ runId: 'run-123', status: 'completed' });
    (svc.listProposals as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const { result } = renderHook(() => usePdfAutofill('init-1'), { wrapper });

    expect(result.current.status).toBe('idle');

    await act(async () => {
      await result.current.startExtraction('pdf-1', 'all');
    });
    expect(result.current.status).toBe('running');

    // First poll fires after 500ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKOFF_INTERVALS_MS[0] + 10);
    });
    // Second poll fires after the second backoff interval
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKOFF_INTERVALS_MS[1] + 10);
    });

    expect(result.current.status).toBe('done');
    expect(svc.getExtractionRunStatus).toHaveBeenCalledTimes(2);
    expect(svc.listProposals).toHaveBeenCalledWith('init-1', 'run-123');
  });

  it('uses the documented backoff sequence (500, 1000, 2000, 4000, 5000, capped at 5000)', () => {
    expect(BACKOFF_INTERVALS_MS).toEqual([500, 1000, 2000, 4000, 5000]);
  });

  it('emits AUTOFILL_TIMEOUT when polling exceeds 120s', async () => {
    (svc.startExtractionRun as ReturnType<typeof vi.fn>).mockResolvedValue({
      runId: 'run-timeout',
    });
    (svc.getExtractionRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      runId: 'run-timeout',
      status: 'running',
    });

    const { result } = renderHook(() => usePdfAutofill('init-1'), { wrapper });

    await act(async () => {
      await result.current.startExtraction('pdf-1');
    });

    // Advance well past the 600s budget (MAX_POLL_DURATION_MS was bumped from
    // 120s → 600s; see comment in usePdfAutofill.ts). Each tick is capped at
    // 5s after the 5th retry, so 130 × 5s = 650s comfortably exceeds it.
    for (let i = 0; i < 130; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      if (result.current.status === 'timeout') break;
    }

    expect(result.current.status).toBe('timeout');
    expect(result.current.error?.code).toBe('AUTOFILL_TIMEOUT');
  });

  it('cancel() stops the poll and returns to idle', async () => {
    (svc.startExtractionRun as ReturnType<typeof vi.fn>).mockResolvedValue({
      runId: 'run-cancel',
    });
    (svc.getExtractionRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
      runId: 'run-cancel',
      status: 'running',
    });

    const { result } = renderHook(() => usePdfAutofill('init-1'), { wrapper });

    await act(async () => {
      await result.current.startExtraction('pdf-1');
    });
    expect(result.current.status).toBe('running');

    act(() => {
      result.current.cancel();
    });

    expect(result.current.status).toBe('idle');
  });
});
