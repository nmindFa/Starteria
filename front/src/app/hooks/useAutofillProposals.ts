/* ------------------------------------------------------------------ */
/*  useAutofillProposals.ts - Field-level helper for AutofillField       */
/*                                                                       */
/*  Selects a single proposal from the AutofillContext and exposes the   */
/*  Confirm / Edit / Discard / Restore / ResolveConflict callbacks. Each */
/*  callback performs an optimistic dispatch followed by a backend       */
/*  persistence call; on failure the action is rolled back and the       */
/*  caller receives the parsed error.                                    */
/* ------------------------------------------------------------------ */

import { useCallback } from 'react';
import {
  selectProposal,
  useAutofillContext,
  type AutofillProposalState,
} from '../context/AutofillContext';
import {
  confirmProposal,
  discardProposal,
  editProposal,
  resolveConflict,
  restoreProposal,
} from '../services/pdfAutofillService';
import { trackAutofillEvent } from '../services/autofillTelemetry';

interface UseAutofillProposalsReturn {
  proposal: AutofillProposalState | null;
  confirm: () => Promise<void>;
  edit: (newValue: unknown) => Promise<void>;
  discard: () => Promise<void>;
  restore: () => Promise<void>;
  selectConflictSource: (chosenSourceId: string) => Promise<void>;
}

/**
 * Levenshtein-normalised "edit distance" between two strings. Used to flag
 * substantial edits (PRD-002 metric: editDistance > 0.30). For non-string
 * values we return 1.0 (treat as "fully different").
 */
function normalisedEditDistance(a: unknown, b: unknown): number {
  if (typeof a !== 'string' || typeof b !== 'string') return 1.0;
  if (a === b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 0;
  // Simple Levenshtein
  const matrix: number[][] = Array.from({ length: shorter.length + 1 }, () =>
    new Array(longer.length + 1).fill(0),
  );
  for (let i = 0; i <= shorter.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= longer.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[shorter.length][longer.length] / longer.length;
}

export function useAutofillProposals(
  initiativeId: string | undefined,
  fieldPath: string,
): UseAutofillProposalsReturn {
  const { state, dispatch } = useAutofillContext();
  const proposal = initiativeId ? selectProposal(state, initiativeId, fieldPath) : null;

  const confirm = useCallback(async () => {
    if (!initiativeId || !proposal) return;
    const previous = { ...proposal };
    dispatch({ type: 'CONFIRM', initiativeId, fieldPath });
    try {
      await confirmProposal(initiativeId, proposal.runId, fieldPath);
      trackAutofillEvent('field_autofill_confirmed', {
        initiativeId,
        fieldPath,
        confidenceBand: previous.confidenceBand,
        runId: previous.runId,
      });
    } catch (err) {
      // rollback by re-merging the prior state as unconfirmed
      dispatch({
        type: 'RESTORE',
        initiativeId,
        fieldPath,
      });
      throw err;
    }
  }, [initiativeId, proposal, fieldPath, dispatch]);

  const edit = useCallback(
    async (newValue: unknown) => {
      if (!initiativeId || !proposal) return;
      const distance = normalisedEditDistance(proposal.proposedValue, newValue);
      dispatch({ type: 'EDIT', initiativeId, fieldPath, finalValue: newValue });
      try {
        await editProposal(initiativeId, proposal.runId, fieldPath, newValue);
        trackAutofillEvent('field_autofill_edited', {
          initiativeId,
          fieldPath,
          confidenceBand: proposal.confidenceBand,
          runId: proposal.runId,
          editDistance: distance,
        });
      } catch (err) {
        dispatch({ type: 'RESTORE', initiativeId, fieldPath });
        throw err;
      }
    },
    [initiativeId, proposal, fieldPath, dispatch],
  );

  const discard = useCallback(async () => {
    if (!initiativeId || !proposal) return;
    dispatch({ type: 'DISCARD', initiativeId, fieldPath });
    try {
      await discardProposal(initiativeId, proposal.runId, fieldPath);
      trackAutofillEvent('field_autofill_discarded', {
        initiativeId,
        fieldPath,
        confidenceBand: proposal.confidenceBand,
        runId: proposal.runId,
      });
    } catch (err) {
      dispatch({ type: 'RESTORE', initiativeId, fieldPath });
      throw err;
    }
  }, [initiativeId, proposal, fieldPath, dispatch]);

  const restore = useCallback(async () => {
    if (!initiativeId || !proposal) return;
    dispatch({ type: 'RESTORE', initiativeId, fieldPath });
    try {
      await restoreProposal(initiativeId, proposal.runId, fieldPath);
      trackAutofillEvent('field_autofill_restored', {
        initiativeId,
        fieldPath,
        runId: proposal.runId,
      });
    } catch (err) {
      dispatch({ type: 'DISCARD', initiativeId, fieldPath });
      throw err;
    }
  }, [initiativeId, proposal, fieldPath, dispatch]);

  const selectConflictSource = useCallback(
    async (chosenSourceId: string) => {
      if (!initiativeId || !proposal) return;
      dispatch({
        type: 'RESOLVE_CONFLICT',
        initiativeId,
        fieldPath,
        chosenSourceId,
      });
      try {
        await resolveConflict(initiativeId, proposal.runId, fieldPath, chosenSourceId);
        trackAutofillEvent('field_autofill_conflict_resolved', {
          initiativeId,
          fieldPath,
          runId: proposal.runId,
          chosenSourceId,
        });
      } catch (err) {
        // No clean automatic rollback for conflict resolution; surface error.
        throw err;
      }
    },
    [initiativeId, proposal, fieldPath, dispatch],
  );

  return { proposal, confirm, edit, discard, restore, selectConflictSource };
}
