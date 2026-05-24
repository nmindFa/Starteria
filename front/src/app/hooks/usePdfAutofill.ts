/* ------------------------------------------------------------------ */
/*  usePdfAutofill.ts - Hook that drives a PDF extraction run            */
/*                                                                       */
/*  Lifecycle (TASK-009 §6):                                             */
/*    1. startExtraction(pdfId)                                         */
/*       → POST /initiatives/:id/pdfs/:pdfId/extract                     */
/*       → returns { runId }                                            */
/*    2. Polls GET /initiatives/:id/pdfs/runs/:runId with truncated      */
/*       exponential backoff: 500ms → 1s → 2s → 4s → 5s (capped),       */
/*       max 120s total.                                                 */
/*    3. On `completed`, fetches proposals and dispatches MERGE_FROM_RUN.*/
/*    4. Cleans up the timer on unmount or on `cancel()`.                */
/*                                                                       */
/*  4xx errors abort the poll (per TASK-009 §6 error table).            */
/* ------------------------------------------------------------------ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { parseApiError } from '../services/api';
import {
  getExtractionRunStatus,
  listProposals,
  startExtractionRun,
  type AutofillProposalDto,
  type ExtractionRunStatus,
} from '../services/pdfAutofillService';
import { useAutofillContext } from '../context/AutofillContext';
import { trackAutofillEvent } from '../services/autofillTelemetry';

export type AutofillHookStatus =
  | 'idle'
  | 'running'
  | 'done'
  | 'failed'
  | 'timeout';

export interface AutofillHookError {
  code:
    | 'AUTOFILL_TIMEOUT'
    | 'AUTOFILL_RUN_NOT_FOUND'
    | 'AUTOFILL_UNAUTHORIZED'
    | 'AUTOFILL_COST_CEILING'
    | 'AUTOFILL_UNKNOWN';
  message: string;
}

export interface UsePdfAutofillReturn {
  status: AutofillHookStatus;
  proposals: AutofillProposalDto[];
  error: AutofillHookError | null;
  startExtraction: (
    pdfId: string,
    scope?: 'step0' | 'step1' | 'step2' | 'step3' | 'step4' | 'all',
  ) => Promise<{ runId: string } | null>;
  cancel: () => void;
}

// Truncated exponential backoff. Capped at 5000ms after the 5th attempt.
// Total: 500 + 1000 + 2000 + 4000 + (5000 × N) → 120_000ms budget.
export const BACKOFF_INTERVALS_MS = [500, 1000, 2000, 4000, 5000] as const;
// Real PDF extraction (DeepSeek, 14pp PDF, 5 step prompts) takes ~5min.
// 120s was too short — the hook timed out before the backend persisted proposals,
// leaving the data committed to DB but the user no longer polling. 600s = 10min
// covers the p95 measured in production for a typical Starteria initiative PDF.
export const MAX_POLL_DURATION_MS = 600_000;

function getBackoffDelay(attempt: number): number {
  if (attempt < BACKOFF_INTERVALS_MS.length) {
    return BACKOFF_INTERVALS_MS[attempt];
  }
  return BACKOFF_INTERVALS_MS[BACKOFF_INTERVALS_MS.length - 1];
}

function mapHttpErrorToHookError(err: unknown): AutofillHookError {
  const parsed = parseApiError(err);
  const code = parsed.code;
  if (code === 'AUTOFILL_COST_CEILING' || code === 'COST_CEILING') {
    return { code: 'AUTOFILL_COST_CEILING', message: parsed.message };
  }
  if (code === 'AUTOFILL_RUN_NOT_FOUND' || code === 'NOT_FOUND') {
    return { code: 'AUTOFILL_RUN_NOT_FOUND', message: parsed.message };
  }
  if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
    return { code: 'AUTOFILL_UNAUTHORIZED', message: parsed.message };
  }
  return { code: 'AUTOFILL_UNKNOWN', message: parsed.message };
}

export function usePdfAutofill(initiativeId: string | undefined): UsePdfAutofillReturn {
  const { dispatch } = useAutofillContext();

  const [status, setStatus] = useState<AutofillHookStatus>('idle');
  const [proposals, setProposals] = useState<AutofillProposalDto[]>([]);
  const [error, setError] = useState<AutofillHookError | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stopPolling();
    if (mountedRef.current) setStatus('idle');
  }, [stopPolling]);

  const finalizeRun = useCallback(
    async (runId: string) => {
      if (!initiativeId) return;
      try {
        const list = await listProposals(initiativeId, runId);
        if (!mountedRef.current || cancelledRef.current) return;
        setProposals(list);
        dispatch({ type: 'MERGE_FROM_RUN', initiativeId, proposals: list });
        setStatus('done');
        trackAutofillEvent('autofill_run_completed', {
          initiativeId,
          runId,
          count: list.length,
        });
      } catch (err) {
        if (!mountedRef.current) return;
        setError(mapHttpErrorToHookError(err));
        setStatus('failed');
        trackAutofillEvent('autofill_run_failed', { initiativeId, runId });
      }
    },
    [initiativeId, dispatch],
  );

  const poll = useCallback(
    (runId: string, attempt: number, startedAt: number) => {
      if (!initiativeId) return;
      if (cancelledRef.current || !mountedRef.current) return;

      if (Date.now() - startedAt >= MAX_POLL_DURATION_MS) {
        setStatus('timeout');
        setError({
          code: 'AUTOFILL_TIMEOUT',
          message:
            'La extracción tarda más de lo normal. Puedes reintentarlo o continuar manualmente.',
        });
        trackAutofillEvent('autofill_run_failed', {
          initiativeId,
          runId,
          reason: 'timeout',
        });
        return;
      }

      timerRef.current = setTimeout(async () => {
        if (cancelledRef.current || !mountedRef.current) return;
        try {
          const response = await getExtractionRunStatus(initiativeId, runId);
          if (cancelledRef.current || !mountedRef.current) return;

          const runStatus: ExtractionRunStatus = response.status;
          if (runStatus === 'completed') {
            await finalizeRun(runId);
            return;
          }
          if (runStatus === 'failed' || runStatus === 'cancelled') {
            setStatus('failed');
            setError({
              code: 'AUTOFILL_UNKNOWN',
              message:
                response.errorMessage ??
                'La extracción no pudo completarse. Reintenta más tarde.',
            });
            trackAutofillEvent('autofill_run_failed', { initiativeId, runId });
            return;
          }
          // queued / running / partial → keep polling
          poll(runId, attempt + 1, startedAt);
        } catch (err) {
          // 5xx → retry; 4xx → abort
          const hookError = mapHttpErrorToHookError(err);
          if (hookError.code === 'AUTOFILL_UNKNOWN') {
            // Could be a transient 5xx — retry with next backoff interval.
            poll(runId, attempt + 1, startedAt);
          } else {
            setError(hookError);
            setStatus('failed');
            trackAutofillEvent('autofill_run_failed', { initiativeId, runId });
          }
        }
      }, getBackoffDelay(attempt));
    },
    [initiativeId, finalizeRun],
  );

  const startExtraction = useCallback(
    async (
      pdfId: string,
      scope: 'step0' | 'step1' | 'step2' | 'step3' | 'step4' | 'all' = 'all',
    ): Promise<{ runId: string } | null> => {
      if (!initiativeId) return null;
      cancelledRef.current = false;
      stopPolling();
      setError(null);
      setProposals([]);
      setStatus('running');

      try {
        const { runId } = await startExtractionRun(initiativeId, pdfId, scope);
        trackAutofillEvent('autofill_run_started', {
          initiativeId,
          pdfId,
          runId,
        });
        poll(runId, 0, Date.now());
        return { runId };
      } catch (err) {
        const hookError = mapHttpErrorToHookError(err);
        setError(hookError);
        setStatus('failed');
        trackAutofillEvent('autofill_run_failed', { initiativeId, pdfId });
        return null;
      }
    },
    [initiativeId, poll, stopPolling],
  );

  return { status, proposals, error, startExtraction, cancel };
}
