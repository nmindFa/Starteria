import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { AutofillProvider, useAutofillContext } from '../../../context/AutofillContext';
import type { AutofillProposalDto } from '../../../services/pdfAutofillService';
import { AutofillField } from '../AutofillField';

// Force the feature flag on for these tests.
vi.mock('../../../services/featureFlags', () => ({
  isEnabled: () => true,
  isPdfAutofillEnabled: () => true,
}));

// Stub the service so confirm/edit/discard don't try real HTTP.
vi.mock('../../../services/pdfAutofillService', async () => {
  const actual = await vi.importActual<
    typeof import('../../../services/pdfAutofillService')
  >('../../../services/pdfAutofillService');
  return {
    ...actual,
    confirmProposal: vi.fn().mockResolvedValue(undefined),
    editProposal: vi.fn().mockResolvedValue(undefined),
    discardProposal: vi.fn().mockResolvedValue(undefined),
    restoreProposal: vi.fn().mockResolvedValue(undefined),
    resolveConflict: vi.fn().mockResolvedValue(undefined),
  };
});

function makeDto(overrides: Partial<AutofillProposalDto> = {}): AutofillProposalDto {
  return {
    fieldPath: 'step0.x',
    proposedValue: 'Hola Nancy',
    status: 'unconfirmed',
    provenance: {
      sourcePdfId: 'pdf-1',
      sourcePdfName: 'iniciativa.pdf',
      pageNumbers: [3, 4],
      quotedExcerpt: 'Nancy Andrade — Sub Gerente',
      confidenceScore: 0.87,
      confidenceBand: 'high',
    },
    confidenceScore: 0.87,
    confidenceBand: 'high',
    runId: 'run-1',
    ...overrides,
  };
}

// Helper that seeds a proposal into the context before rendering the children.
function SeededHarness({
  proposal,
  children,
}: {
  proposal: AutofillProposalDto;
  children: React.ReactNode;
}) {
  const { dispatch } = useAutofillContext();
  React.useEffect(() => {
    dispatch({
      type: 'MERGE_FROM_RUN',
      initiativeId: 'init-1',
      proposals: [proposal],
    });
  }, [dispatch, proposal]);
  return <>{children}</>;
}

function renderField(proposal: AutofillProposalDto) {
  const onChange = vi.fn();
  const utils = render(
    <AutofillProvider>
      <SeededHarness proposal={proposal}>
        <AutofillField
          fieldPath={proposal.fieldPath}
          initiativeId="init-1"
          value=""
          onChange={onChange}
          label="Test field"
        >
          {({ value, onChange: localChange, readOnly }) => (
            <input
              aria-label="field-input"
              value={String(value ?? '')}
              onChange={(e) => localChange(e.target.value)}
              readOnly={readOnly}
            />
          )}
        </AutofillField>
      </SeededHarness>
    </AutofillProvider>,
  );
  return { ...utils, onChange };
}

describe('AutofillField — visual states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the unconfirmed visual treatment with "Propuesto por IA" chip', async () => {
    renderField(makeDto());

    // The "Propuesto por IA" chip is mandatory per ADR-005.
    expect(await screen.findByText('Propuesto por IA')).toBeInTheDocument();

    // Confidence chip must include text, not just color.
    expect(screen.getByText(/Confianza Alta/i)).toBeInTheDocument();

    // The wrapper exposes the data-attribute so QA can scrape it.
    const wrapper = screen
      .getByLabelText(/Valor propuesto por inteligencia artificial/i);
    expect(wrapper.getAttribute('data-autofill-state')).toBe(
      'ai-proposed-unconfirmed',
    );
  });

  it('exposes the three action buttons Confirm / Edit / Discard', async () => {
    renderField(makeDto());

    expect(await screen.findByRole('button', { name: /Confirmar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Editar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Descartar$/i })).toBeInTheDocument();
  });

  it('Confirm transitions the field to ai-proposed-confirmed', async () => {
    const { onChange } = renderField(makeDto());

    const confirm = await screen.findByRole('button', { name: /Confirmar/i });
    fireEvent.click(confirm);

    // The render-prop calls onChange with the proposed value
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange).toHaveBeenCalledWith('Hola Nancy');
  });
});
