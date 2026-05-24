/* ------------------------------------------------------------------ */
/*  AutofillConflictField.tsx - US-011 variant of the autofill field     */
/*                                                                       */
/*  Used when the slice marks a proposal as having `conflictWith`. The   */
/*  founder must explicitly select one of the competing sources before   */
/*  the field becomes a normal `ai-proposed-unconfirmed` field.          */
/* ------------------------------------------------------------------ */

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ConflictOption } from '../../services/pdfAutofillService';

interface AutofillConflictFieldProps {
  fieldPath: string;
  label?: string;
  competingValues: ConflictOption[];
  onResolve: (chosenSourceId: string) => Promise<void> | void;
  onDiscardAll?: () => Promise<void> | void;
}

const BAND_LABEL: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export function AutofillConflictField({
  fieldPath,
  label,
  competingValues,
  onResolve,
  onDiscardAll,
}: AutofillConflictFieldProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async (sourceId: string) => {
    setSubmitting(true);
    try {
      await onResolve(sourceId);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/30 p-4 space-y-3"
      data-field-path={fieldPath}
      role="group"
      aria-labelledby={`${fieldPath}-conflict-title`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-amber-600" />
        <span
          id={`${fieldPath}-conflict-title`}
          className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800"
          style={{ fontWeight: 600 }}
        >
          Conflicto entre fuentes
        </span>
        {label && <span className="text-xs text-slate-500">— {label}</span>}
      </div>

      <p className="text-sm text-slate-700" role="alert">
        Dos documentos proponen valores distintos para este campo. Selecciona la fuente
        correcta antes de continuar.
      </p>

      <div className="space-y-2">
        {competingValues.map((option) => {
          const isSelected = selected === option.sourceId;
          return (
            <div
              key={option.sourceId}
              className={`rounded-lg border p-3 transition-colors ${
                isSelected
                  ? 'border-amber-400 bg-white'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={`conflict-${fieldPath}`}
                  value={option.sourceId}
                  checked={isSelected}
                  onChange={() => setSelected(option.sourceId)}
                  className="mt-1 shrink-0"
                  aria-label={`Seleccionar fuente ${option.provenance.sourcePdfName}`}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-slate-900" style={{ fontWeight: 500 }}>
                    {String(option.proposedValue)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {option.provenance.sourcePdfName} · p.{' '}
                    {option.provenance.pageNumbers.join(', ')}
                  </p>
                  <blockquote className="text-xs italic text-slate-600 border-l-2 border-slate-200 pl-2">
                    “{option.provenance.quotedExcerpt.slice(0, 280)}”
                  </blockquote>
                  <p className="text-xs text-slate-500">
                    Confianza{' '}
                    <span className="text-slate-700" style={{ fontWeight: 600 }}>
                      {BAND_LABEL[option.provenance.confidenceBand] ?? 'Media'}
                    </span>
                  </p>
                </div>
              </label>
              {isSelected && (
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleConfirm(option.sourceId)}
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 bg-amber-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-60"
                    style={{ fontWeight: 500 }}
                  >
                    <CheckCircle2 size={12} /> Confirmar esta fuente
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {onDiscardAll && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onDiscardAll?.()}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Descartar todas
          </button>
        </div>
      )}
    </div>
  );
}
