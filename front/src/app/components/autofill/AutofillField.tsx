/* ------------------------------------------------------------------ */
/*  AutofillField.tsx - Visual wrapper for an auto-rellenado input       */
/*                                                                       */
/*  Implements the contract from ADR-005:                                */
/*    - 4 visual states (empty | manual | ai-proposed-unconfirmed |     */
/*      ai-proposed-confirmed)                                          */
/*    - conflict variant delegated to AutofillConflictField              */
/*    - 3 perceptual channels per state (icon + border + label)         */
/*    - keyboard shortcuts: Enter (confirm), E (edit), Del/Backspace    */
/*      (discard)                                                       */
/*    - aria-live announcements                                         */
/*    - feature-flag passthrough mode when disabled                     */
/*                                                                       */
/*  Render strategy: when `feature.pdfAutofill` is off or no proposal    */
/*  exists, AutofillField renders the children unchanged. When a        */
/*  proposal exists, it wraps the children with the appropriate visual  */
/*  cues and action toolbar.                                            */
/* ------------------------------------------------------------------ */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useAutofillProposals } from '../../hooks/useAutofillProposals';
import { isPdfAutofillEnabled } from '../../services/featureFlags';
import { ProvenancePopover } from './ProvenancePopover';
import { AutofillConflictField } from './AutofillConflictField';

type FieldVisualState =
  | 'empty'
  | 'manual'
  | 'ai-proposed-unconfirmed'
  | 'ai-proposed-confirmed'
  | 'conflict';

export interface AutofillFieldProps {
  /** Dotted field path (e.g. `step0.nombreParticipante`). */
  fieldPath: string;
  /** Initiative this field belongs to (used to read the slice). */
  initiativeId: string | undefined;
  /** Current manual value (when no proposal applies). */
  value: unknown;
  /** Called when the user edits or accepts a new value. */
  onChange: (value: unknown) => void;
  /** Human-readable label (used in toolbar aria-labels). */
  label?: string;
  /** Render-prop: receives the current effective value + change handler. */
  children: (api: {
    value: unknown;
    onChange: (v: unknown) => void;
    readOnly: boolean;
  }) => React.ReactNode;
  /** When true, Confirm shows an inline confirmation step. */
  highImpact?: boolean;
}

const BAND_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export function AutofillField(props: AutofillFieldProps) {
  const { fieldPath, initiativeId, value, onChange, label, children, highImpact } = props;

  const featureOn = isPdfAutofillEnabled();
  const { proposal, confirm, edit, discard, restore, selectConflictSource } =
    useAutofillProposals(initiativeId, fieldPath);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [confirmingHighImpact, setConfirmingHighImpact] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState<unknown>(value);
  const [liveMessage, setLiveMessage] = useState('');
  const [undoVisible, setUndoVisible] = useState(false);

  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverId = `provenance-${fieldPath.replace(/[.[\]]/g, '-')}`;

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (popoverHoverTimerRef.current) clearTimeout(popoverHoverTimerRef.current);
    };
  }, []);

  // ── Resolve visual state ─────────────────────────────────────────────────
  let visualState: FieldVisualState = 'empty';
  if (!featureOn || !proposal) {
    visualState = isFilled(value) ? 'manual' : 'empty';
  } else if (proposal.conflictWith && proposal.conflictWith.length > 0) {
    visualState = 'conflict';
  } else if (proposal.state === 'unconfirmed') {
    visualState = 'ai-proposed-unconfirmed';
  } else if (proposal.state === 'confirmed') {
    visualState = 'ai-proposed-confirmed';
  } else {
    visualState = isFilled(value) ? 'manual' : 'empty';
  }

  // ── Effective value (proposal overrides local value while unconfirmed) ───
  const effectiveValue =
    featureOn && proposal && visualState === 'ai-proposed-unconfirmed' && !editing
      ? proposal.proposedValue
      : value;

  // ── Conflict variant short-circuits everything ──────────────────────────
  if (visualState === 'conflict' && proposal?.conflictWith) {
    return (
      <AutofillConflictField
        fieldPath={fieldPath}
        label={label}
        competingValues={proposal.conflictWith}
        onResolve={async (sourceId) => {
          await selectConflictSource(sourceId);
          setLiveMessage('Fuente seleccionada. Confirma para aplicar el valor.');
        }}
        onDiscardAll={async () => {
          await discard();
          setLiveMessage('Conflicto descartado. Campo vacío.');
        }}
      />
    );
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!proposal) return;
    if (highImpact && !confirmingHighImpact) {
      setConfirmingHighImpact(true);
      return;
    }
    await confirm();
    onChange(proposal.proposedValue);
    setLiveMessage('Campo confirmado.');
    setConfirmingHighImpact(false);
  }, [proposal, confirm, onChange, highImpact, confirmingHighImpact]);

  const handleStartEdit = useCallback(() => {
    if (!proposal) return;
    setEditBuffer(proposal.proposedValue);
    setEditing(true);
    setLiveMessage('Modo edición activado.');
  }, [proposal]);

  const handleEditCommit = useCallback(async () => {
    if (!proposal) return;
    await edit(editBuffer);
    onChange(editBuffer);
    setEditing(false);
    setLiveMessage('Campo editado y guardado.');
  }, [proposal, edit, editBuffer, onChange]);

  const handleDiscardRequest = useCallback(() => {
    if (!confirmingDiscard) {
      setConfirmingDiscard(true);
      return;
    }
    void (async () => {
      await discard();
      setConfirmingDiscard(false);
      setUndoVisible(true);
      setLiveMessage(
        'Listo, propuesta descartada. Puedes deshacer durante los próximos 8 segundos.',
      );
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = setTimeout(() => {
        setUndoVisible(false);
      }, 8000);
    })();
  }, [confirmingDiscard, discard]);

  const handleUndo = useCallback(async () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoVisible(false);
    await restore();
    setLiveMessage('Propuesta restaurada.');
  }, [restore]);

  // ── Keyboard shortcuts on the toolbar ───────────────────────────────────
  const onToolbarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleConfirm();
    } else if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      handleStartEdit();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleDiscardRequest();
    }
  };

  // ── Popover triggers ────────────────────────────────────────────────────
  const onPopoverMouseEnter = () => {
    if (popoverHoverTimerRef.current) clearTimeout(popoverHoverTimerRef.current);
    popoverHoverTimerRef.current = setTimeout(() => setPopoverOpen(true), 200);
  };
  const onPopoverMouseLeave = () => {
    if (popoverHoverTimerRef.current) clearTimeout(popoverHoverTimerRef.current);
    popoverHoverTimerRef.current = setTimeout(() => setPopoverOpen(false), 500);
  };

  // ── Border + background classes per state ───────────────────────────────
  const borderClass = (() => {
    switch (visualState) {
      case 'ai-proposed-unconfirmed':
        return 'border-2 border-dashed border-violet-400 bg-violet-50/30';
      case 'ai-proposed-confirmed':
        return 'border border-emerald-300 bg-white';
      case 'manual':
        return '';
      case 'empty':
      default:
        return '';
    }
  })();

  const wrapperLabel = (() => {
    switch (visualState) {
      case 'ai-proposed-unconfirmed':
        return `Valor propuesto por inteligencia artificial, sin confirmar. Confianza ${
          BAND_LABEL[proposal?.confidenceBand ?? 'medium'] ?? 'Media'
        }. Tres acciones disponibles: Confirmar, Editar, Descartar.`;
      case 'ai-proposed-confirmed':
        return 'Campo confirmado por el founder. Origen: propuesta IA verificada.';
      case 'manual':
        return 'Campo ingresado manualmente.';
      case 'empty':
        return 'Campo vacío.';
      default:
        return '';
    }
  })();

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative rounded-xl ${borderClass} ${
        visualState === 'ai-proposed-unconfirmed' ? 'p-2 -m-2' : ''
      }`}
      data-field-path={fieldPath}
      data-autofill-state={visualState}
      aria-label={wrapperLabel}
    >
      {/* Top badges (unconfirmed only) */}
      {visualState === 'ai-proposed-unconfirmed' && proposal && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-800"
            style={{ fontWeight: 600 }}
          >
            <Sparkles size={11} /> Propuesto por IA
          </span>
          <span
            className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
            style={{ fontWeight: 500 }}
            aria-label={`Confianza ${BAND_LABEL[proposal.confidenceBand] ?? 'Media'}`}
          >
            Confianza {BAND_LABEL[proposal.confidenceBand] ?? 'Media'}
          </span>
          <button
            type="button"
            onClick={() => setPopoverOpen((s) => !s)}
            onMouseEnter={onPopoverMouseEnter}
            onMouseLeave={onPopoverMouseLeave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setPopoverOpen(true);
              }
            }}
            aria-label="Ver origen de la propuesta"
            aria-controls={popoverId}
            aria-expanded={popoverOpen}
            className="text-xs text-violet-700 hover:text-violet-900 underline"
          >
            Ver origen
          </button>
        </div>
      )}

      {/* Confirmed-state subtle marker */}
      {visualState === 'ai-proposed-confirmed' && (
        <div className="flex items-center gap-1.5 mb-1 text-xs text-emerald-700">
          <CheckCircle2 size={12} />
          <Sparkles size={10} className="text-violet-400" />
          <span className="sr-only">Confirmado desde PDF</span>
        </div>
      )}

      {/* The actual input (render prop) */}
      {children({
        value: editing ? editBuffer : effectiveValue,
        onChange: editing ? setEditBuffer : onChange,
        readOnly: visualState === 'ai-proposed-unconfirmed' && !editing,
      })}

      {/* Toolbar for unconfirmed state */}
      {visualState === 'ai-proposed-unconfirmed' && proposal && (
        <div
          role="toolbar"
          aria-orientation="horizontal"
          aria-label={`Acciones de propuesta IA para ${label ?? fieldPath}`}
          onKeyDown={onToolbarKeyDown}
          tabIndex={0}
          className="mt-2 flex flex-wrap items-center gap-2"
        >
          {!editing && (
            <>
              <button
                type="button"
                onClick={handleConfirm}
                className="inline-flex items-center gap-1.5 bg-violet-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-violet-700"
                style={{ fontWeight: 500 }}
                aria-keyshortcuts="Enter"
              >
                <CheckCircle2 size={12} /> Confirmar
              </button>
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-50"
                style={{ fontWeight: 500 }}
                aria-keyshortcuts="e"
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                type="button"
                onClick={handleDiscardRequest}
                className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border ${
                  confirmingDiscard
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                aria-keyshortcuts="Delete Backspace"
              >
                <Trash2 size={12} />{' '}
                {confirmingDiscard ? 'Descartar definitivamente' : 'Descartar'}
              </button>
              {confirmingHighImpact && (
                <span className="text-xs text-amber-700">
                  Confirma de nuevo para aplicar este valor.
                </span>
              )}
            </>
          )}

          {editing && (
            <>
              <button
                type="button"
                onClick={handleEditCommit}
                className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                style={{ fontWeight: 500 }}
              >
                <CheckCircle2 size={12} /> Guardar edición
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditBuffer(proposal.proposedValue);
                }}
                className="inline-flex items-center gap-1.5 bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5 rounded-lg hover:bg-slate-50"
              >
                Cancelar
              </button>
            </>
          )}

          {undoVisible && (
            <button
              type="button"
              onClick={handleUndo}
              className="inline-flex items-center gap-1.5 text-xs text-violet-700 underline"
            >
              <Undo2 size={12} /> Deshacer
            </button>
          )}
        </div>
      )}

      {/* Popover */}
      {visualState === 'ai-proposed-unconfirmed' && proposal && popoverOpen && (
        <ProvenancePopover
          open={popoverOpen}
          onClose={() => setPopoverOpen(false)}
          provenance={proposal.provenance}
          secondarySources={proposal.secondarySources}
          popoverId={popoverId}
        />
      )}

      {/* Live region for screen-reader announcements */}
      <span aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </div>
  );
}

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
