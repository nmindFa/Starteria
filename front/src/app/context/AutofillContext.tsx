/* ------------------------------------------------------------------ */
/*  AutofillContext.tsx - Frontend slice for PDF autofill proposals      */
/*                                                                       */
/*  Implements the `autofillProposals` slice spec'd in TASK-009 §7 and    */
/*  ADR-005. Kept in its own context (rather than bolted onto AppContext) */
/*  because the lifecycle is per-initiative and feature-flagged.          */
/*                                                                       */
/*  Reducer actions (matched 1:1 to TASK-009 §7):                         */
/*    MERGE_FROM_RUN | CONFIRM | EDIT | DISCARD | RESTORE                 */
/*    RESOLVE_CONFLICT | CLEAR_FOR_INITIATIVE                             */
/*                                                                       */
/*  Note: actions are pure state transitions. The backend persistence    */
/*  calls are issued from `useAutofillProposals`, which dispatches an    */
/*  optimistic action, awaits the HTTP response, and rolls back on       */
/*  failure.                                                              */
/* ------------------------------------------------------------------ */

import React, { createContext, useContext, useReducer, ReactNode, Dispatch } from 'react';
import type {
  AutofillProposalDto,
  ConflictOption,
  ConfidenceBand,
  ProvenanceEntry,
  ProposalStatus,
} from '../services/pdfAutofillService';

// ---------- State shapes ----------

export interface AutofillProposalState {
  fieldPath: string;
  state: ProposalStatus;
  proposedValue: unknown;
  finalValue?: unknown;
  provenance: ProvenanceEntry;
  secondarySources: ProvenanceEntry[];
  conflictWith?: ConflictOption[];
  confidence: number;
  confidenceBand: ConfidenceBand;
  runId: string;
}

export interface AutofillState {
  /** keyed by initiativeId → fieldPath → state */
  byInitiative: Record<string, Record<string, AutofillProposalState>>;
}

const INITIAL_STATE: AutofillState = { byInitiative: {} };

// ---------- Actions ----------

export type AutofillAction =
  | {
      type: 'MERGE_FROM_RUN';
      initiativeId: string;
      proposals: AutofillProposalDto[];
    }
  | { type: 'CONFIRM'; initiativeId: string; fieldPath: string }
  | { type: 'EDIT'; initiativeId: string; fieldPath: string; finalValue: unknown }
  | { type: 'DISCARD'; initiativeId: string; fieldPath: string }
  | { type: 'RESTORE'; initiativeId: string; fieldPath: string }
  | {
      type: 'RESOLVE_CONFLICT';
      initiativeId: string;
      fieldPath: string;
      chosenSourceId: string;
    }
  | { type: 'CLEAR_FOR_INITIATIVE'; initiativeId: string };

// ---------- Reducer ----------

function fromDto(dto: AutofillProposalDto): AutofillProposalState {
  return {
    fieldPath: dto.fieldPath,
    state: dto.status,
    proposedValue: dto.proposedValue,
    finalValue: dto.finalValue,
    provenance: dto.provenance,
    secondarySources: dto.secondarySources ?? [],
    conflictWith: dto.conflict?.competingValues,
    confidence: dto.confidenceScore,
    confidenceBand: dto.confidenceBand,
    runId: dto.runId,
  };
}

export function autofillReducer(
  state: AutofillState,
  action: AutofillAction,
): AutofillState {
  switch (action.type) {
    case 'MERGE_FROM_RUN': {
      const existing = state.byInitiative[action.initiativeId] ?? {};
      const next = { ...existing };

      for (const proposalDto of action.proposals) {
        const proposal = fromDto(proposalDto);
        const current = next[proposal.fieldPath];

        if (!current) {
          // brand new field → insert as unconfirmed
          next[proposal.fieldPath] = { ...proposal, state: 'unconfirmed' };
          continue;
        }

        // confirmed/edited: never silently overwrite (ADR-005). Accumulate
        // the new provenance as a secondary source.
        if (current.state === 'confirmed' || current.state === 'edited') {
          next[proposal.fieldPath] = {
            ...current,
            secondarySources: [
              ...current.secondarySources,
              proposal.provenance,
            ],
          };
          continue;
        }

        // discarded: ignore new propositions for this field
        if (current.state === 'discarded') {
          continue;
        }

        // unconfirmed: replace only when new confidence beats by ≥ 0.10
        if (proposal.confidence >= current.confidence + 0.1) {
          next[proposal.fieldPath] = { ...proposal, state: 'unconfirmed' };
        } else {
          // otherwise keep the dominant one but record the alt as secondary
          next[proposal.fieldPath] = {
            ...current,
            secondarySources: [
              ...current.secondarySources,
              proposal.provenance,
            ],
          };
        }
      }

      return {
        ...state,
        byInitiative: { ...state.byInitiative, [action.initiativeId]: next },
      };
    }

    case 'CONFIRM': {
      const existing = state.byInitiative[action.initiativeId];
      if (!existing) return state;
      const current = existing[action.fieldPath];
      if (!current) return state;
      return {
        ...state,
        byInitiative: {
          ...state.byInitiative,
          [action.initiativeId]: {
            ...existing,
            [action.fieldPath]: {
              ...current,
              state: 'confirmed',
              finalValue: current.proposedValue,
            },
          },
        },
      };
    }

    case 'EDIT': {
      const existing = state.byInitiative[action.initiativeId];
      if (!existing) return state;
      const current = existing[action.fieldPath];
      if (!current) return state;
      return {
        ...state,
        byInitiative: {
          ...state.byInitiative,
          [action.initiativeId]: {
            ...existing,
            [action.fieldPath]: {
              ...current,
              state: 'edited',
              finalValue: action.finalValue,
            },
          },
        },
      };
    }

    case 'DISCARD': {
      const existing = state.byInitiative[action.initiativeId];
      if (!existing) return state;
      const current = existing[action.fieldPath];
      if (!current) return state;
      return {
        ...state,
        byInitiative: {
          ...state.byInitiative,
          [action.initiativeId]: {
            ...existing,
            [action.fieldPath]: { ...current, state: 'discarded' },
          },
        },
      };
    }

    case 'RESTORE': {
      const existing = state.byInitiative[action.initiativeId];
      if (!existing) return state;
      const current = existing[action.fieldPath];
      if (!current || current.state !== 'discarded') return state;
      return {
        ...state,
        byInitiative: {
          ...state.byInitiative,
          [action.initiativeId]: {
            ...existing,
            [action.fieldPath]: { ...current, state: 'unconfirmed' },
          },
        },
      };
    }

    case 'RESOLVE_CONFLICT': {
      const existing = state.byInitiative[action.initiativeId];
      if (!existing) return state;
      const current = existing[action.fieldPath];
      if (!current || !current.conflictWith) return state;
      const chosen = current.conflictWith.find(c => c.sourceId === action.chosenSourceId);
      if (!chosen) return state;
      return {
        ...state,
        byInitiative: {
          ...state.byInitiative,
          [action.initiativeId]: {
            ...existing,
            [action.fieldPath]: {
              ...current,
              state: 'unconfirmed',
              proposedValue: chosen.proposedValue,
              provenance: chosen.provenance,
              confidence: chosen.provenance.confidenceScore,
              confidenceBand: chosen.provenance.confidenceBand,
              conflictWith: undefined,
            },
          },
        },
      };
    }

    case 'CLEAR_FOR_INITIATIVE': {
      const { [action.initiativeId]: _removed, ...rest } = state.byInitiative;
      return { ...state, byInitiative: rest };
    }

    default:
      return state;
  }
}

// ---------- Selectors ----------

export function selectProposal(
  state: AutofillState,
  initiativeId: string,
  fieldPath: string,
): AutofillProposalState | null {
  return state.byInitiative[initiativeId]?.[fieldPath] ?? null;
}

export function selectUnconfirmedCount(
  state: AutofillState,
  initiativeId: string,
): number {
  const map = state.byInitiative[initiativeId];
  if (!map) return 0;
  return Object.values(map).filter(p => p.state === 'unconfirmed').length;
}

export function selectUnconfirmedList(
  state: AutofillState,
  initiativeId: string,
): AutofillProposalState[] {
  const map = state.byInitiative[initiativeId];
  if (!map) return [];
  return Object.values(map)
    .filter(p => p.state === 'unconfirmed')
    .sort((a, b) => a.fieldPath.localeCompare(b.fieldPath));
}

export function selectConflicts(
  state: AutofillState,
  initiativeId: string,
): AutofillProposalState[] {
  const map = state.byInitiative[initiativeId];
  if (!map) return [];
  return Object.values(map).filter(p => !!p.conflictWith && p.conflictWith.length > 0);
}

// ---------- React context ----------

interface AutofillContextValue {
  state: AutofillState;
  dispatch: Dispatch<AutofillAction>;
}

const AutofillContext = createContext<AutofillContextValue | null>(null);

export function AutofillProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(autofillReducer, INITIAL_STATE);
  return (
    <AutofillContext.Provider value={{ state, dispatch }}>
      {children}
    </AutofillContext.Provider>
  );
}

export function useAutofillContext(): AutofillContextValue {
  const ctx = useContext(AutofillContext);
  if (!ctx) {
    // Returning a no-op context lets pages render even when the provider is
    // absent (e.g. when the feature flag is off and the provider was not
    // mounted). All selectors degrade gracefully.
    return { state: INITIAL_STATE, dispatch: () => undefined };
  }
  return ctx;
}
