import { describe, expect, it } from 'vitest';
import {
  autofillReducer,
  selectProposal,
  selectUnconfirmedCount,
  selectUnconfirmedList,
  type AutofillState,
} from '../AutofillContext';
import type { AutofillProposalDto } from '../../services/pdfAutofillService';

function makeDto(
  fieldPath: string,
  overrides: Partial<AutofillProposalDto> = {},
): AutofillProposalDto {
  return {
    fieldPath,
    proposedValue: 'value-' + fieldPath,
    status: 'unconfirmed',
    provenance: {
      sourcePdfId: 'pdf-1',
      sourcePdfName: 'iniciativa.pdf',
      pageNumbers: [3],
      quotedExcerpt: 'fragmento citado',
      confidenceScore: 0.85,
      confidenceBand: 'high',
    },
    confidenceScore: 0.85,
    confidenceBand: 'high',
    runId: 'run-1',
    ...overrides,
  };
}

const EMPTY_STATE: AutofillState = { byInitiative: {} };

describe('autofillReducer', () => {
  it('MERGE_FROM_RUN inserts new fields as unconfirmed', () => {
    const state = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.nombreParticipante')],
    });
    const p = selectProposal(state, 'init-1', 'step0.nombreParticipante');
    expect(p).not.toBeNull();
    expect(p?.state).toBe('unconfirmed');
    expect(p?.confidence).toBe(0.85);
  });

  it('MERGE_FROM_RUN ignores discarded fields', () => {
    const base = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x')],
    });
    const discarded = autofillReducer(base, {
      type: 'DISCARD',
      initiativeId: 'init-1',
      fieldPath: 'step0.x',
    });
    const merged = autofillReducer(discarded, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x', { proposedValue: 'NEW' })],
    });
    const p = selectProposal(merged, 'init-1', 'step0.x');
    expect(p?.state).toBe('discarded');
  });

  it('MERGE_FROM_RUN replaces unconfirmed only when confidence improves by ≥0.10', () => {
    const base = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [
        makeDto('step0.x', { confidenceScore: 0.7, proposedValue: 'OLD' }),
      ],
    });
    const closeMerge = autofillReducer(base, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [
        makeDto('step0.x', { confidenceScore: 0.75, proposedValue: 'NEW' }),
      ],
    });
    expect(selectProposal(closeMerge, 'init-1', 'step0.x')?.proposedValue).toBe('OLD');

    const strongMerge = autofillReducer(base, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [
        makeDto('step0.x', { confidenceScore: 0.95, proposedValue: 'NEW' }),
      ],
    });
    expect(selectProposal(strongMerge, 'init-1', 'step0.x')?.proposedValue).toBe('NEW');
  });

  it('MERGE_FROM_RUN preserves confirmed/edited fields and pushes new sources as secondary', () => {
    const base = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x')],
    });
    const confirmed = autofillReducer(base, {
      type: 'CONFIRM',
      initiativeId: 'init-1',
      fieldPath: 'step0.x',
    });
    const merged = autofillReducer(confirmed, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x', { proposedValue: 'IGNORED' })],
    });
    const p = selectProposal(merged, 'init-1', 'step0.x');
    expect(p?.state).toBe('confirmed');
    expect(p?.secondarySources.length).toBe(1);
  });

  it('CONFIRM transitions to confirmed and copies proposedValue → finalValue', () => {
    const base = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x', { proposedValue: 'hello' })],
    });
    const confirmed = autofillReducer(base, {
      type: 'CONFIRM',
      initiativeId: 'init-1',
      fieldPath: 'step0.x',
    });
    const p = selectProposal(confirmed, 'init-1', 'step0.x');
    expect(p?.state).toBe('confirmed');
    expect(p?.finalValue).toBe('hello');
  });

  it('EDIT marks edited and stores the new finalValue', () => {
    const base = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x')],
    });
    const edited = autofillReducer(base, {
      type: 'EDIT',
      initiativeId: 'init-1',
      fieldPath: 'step0.x',
      finalValue: 'corrected',
    });
    const p = selectProposal(edited, 'init-1', 'step0.x');
    expect(p?.state).toBe('edited');
    expect(p?.finalValue).toBe('corrected');
  });

  it('DISCARD then RESTORE round-trips back to unconfirmed', () => {
    let state = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x')],
    });
    state = autofillReducer(state, {
      type: 'DISCARD',
      initiativeId: 'init-1',
      fieldPath: 'step0.x',
    });
    expect(selectProposal(state, 'init-1', 'step0.x')?.state).toBe('discarded');
    state = autofillReducer(state, {
      type: 'RESTORE',
      initiativeId: 'init-1',
      fieldPath: 'step0.x',
    });
    expect(selectProposal(state, 'init-1', 'step0.x')?.state).toBe('unconfirmed');
  });

  it('RESOLVE_CONFLICT picks the chosen source and clears conflictWith', () => {
    const dto: AutofillProposalDto = {
      ...makeDto('step0.x'),
      conflict: {
        competingValues: [
          {
            sourceId: 'src-A',
            proposedValue: 'A',
            provenance: {
              sourcePdfId: 'pdf-A',
              sourcePdfName: 'A.pdf',
              pageNumbers: [1],
              quotedExcerpt: 'A excerpt',
              confidenceScore: 0.82,
              confidenceBand: 'high',
            },
          },
          {
            sourceId: 'src-B',
            proposedValue: 'B',
            provenance: {
              sourcePdfId: 'pdf-B',
              sourcePdfName: 'B.pdf',
              pageNumbers: [4],
              quotedExcerpt: 'B excerpt',
              confidenceScore: 0.81,
              confidenceBand: 'high',
            },
          },
        ],
      },
    };
    const base = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [dto],
    });
    const resolved = autofillReducer(base, {
      type: 'RESOLVE_CONFLICT',
      initiativeId: 'init-1',
      fieldPath: 'step0.x',
      chosenSourceId: 'src-B',
    });
    const p = selectProposal(resolved, 'init-1', 'step0.x');
    expect(p?.proposedValue).toBe('B');
    expect(p?.conflictWith).toBeUndefined();
    expect(p?.state).toBe('unconfirmed');
  });

  it('CLEAR_FOR_INITIATIVE removes the initiative slice', () => {
    const base = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [makeDto('step0.x')],
    });
    const cleared = autofillReducer(base, {
      type: 'CLEAR_FOR_INITIATIVE',
      initiativeId: 'init-1',
    });
    expect(selectProposal(cleared, 'init-1', 'step0.x')).toBeNull();
  });

  it('selectUnconfirmedCount counts only unconfirmed entries', () => {
    let state = autofillReducer(EMPTY_STATE, {
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [
        makeDto('step0.a'),
        makeDto('step0.b'),
        makeDto('step0.c'),
      ],
    });
    state = autofillReducer(state, {
      type: 'CONFIRM',
      initiativeId: 'init-1',
      fieldPath: 'step0.a',
    });
    state = autofillReducer(state, {
      type: 'DISCARD',
      initiativeId: 'init-1',
      fieldPath: 'step0.b',
    });
    expect(selectUnconfirmedCount(state, 'init-1')).toBe(1);
    expect(selectUnconfirmedList(state, 'init-1').map(p => p.fieldPath)).toEqual([
      'step0.c',
    ]);
  });
});
