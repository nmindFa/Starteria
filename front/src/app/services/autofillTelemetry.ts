/* ------------------------------------------------------------------ */
/*  autofillTelemetry.ts - Telemetry stubs for the PDF autofill feature  */
/*                                                                       */
/*  Stub implementation: logs to console with a stable shape so the      */
/*  events can be intercepted by tests and later swapped for a real      */
/*  sink (Posthog/Mixpanel/Segment).                                     */
/*                                                                       */
/*  Event vocabulary follows TASK-009 §15.                               */
/* ------------------------------------------------------------------ */

// TODO(observability): wire to real telemetry sink (TASK-009 follow-up).
//                      For now the events are console-logged so QA + tests
//                      can spy on them via `vi.spyOn(console, 'info')`.

export type AutofillEventName =
  | 'field_autofill_proposed'
  | 'field_autofill_confirmed'
  | 'field_autofill_edited'
  | 'field_autofill_discarded'
  | 'field_autofill_restored'
  | 'field_autofill_conflict_resolved'
  | 'approval_gate_blocked'
  | 'approval_gate_cleared'
  | 'pdf_upload_started'
  | 'pdf_upload_completed'
  | 'pdf_upload_failed'
  | 'autofill_run_started'
  | 'autofill_run_completed'
  | 'autofill_run_failed';

export interface AutofillEventDimensions {
  userId?: string;
  initiativeId?: string;
  fieldPath?: string;
  stepNumber?: number;
  confidenceBand?: 'high' | 'medium' | 'low';
  runId?: string;
  pdfId?: string;
  reason?: string;
  count?: number;
  editDistance?: number;
  chosenSourceId?: string;
}

export function trackAutofillEvent(
  event: AutofillEventName,
  dims: AutofillEventDimensions = {},
): void {
  // Console-only stub. Replace with sink call here.
  // eslint-disable-next-line no-console
  console.info('[autofill-telemetry]', event, dims);
}
