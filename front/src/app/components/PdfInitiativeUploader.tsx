/* ------------------------------------------------------------------ */
/*  PdfInitiativeUploader.tsx - Drag & drop PDFs for an initiative       */
/*                                                                       */
/*  Replaces the stub EvidenceUploader ONLY for the PDF-of-iniciativa    */
/*  flow used by the autofill feature (TASK-009 §5). The legacy          */
/*  EvidenceUploader is preserved unchanged for the evidence-by-module   */
/*  flow.                                                                */
/*                                                                       */
/*  Constraints (TASK-009 §3):                                          */
/*    - ≤ 10 files per initiative                                       */
/*    - ≤ 50 MB per file                                                */
/*    - PDF only                                                        */
/*    - Real upload (multipart POST) via pdfAutofillService              */
/*                                                                       */
/*  After a successful upload the consumer may auto-trigger an          */
/*  extraction via the `onUploadComplete` callback.                     */
/* ------------------------------------------------------------------ */

import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { uploadPdf } from '../services/pdfAutofillService';
import { parseApiError } from '../services/api';
import { trackAutofillEvent } from '../services/autofillTelemetry';

export type PdfFileState = 'queued' | 'uploading' | 'ready' | 'failed';

export interface UploadedPdf {
  id: string;
  pdfId?: string;
  name: string;
  sizeBytes: number;
  state: PdfFileState;
  progress: number;
  error?: string;
}

interface PdfInitiativeUploaderProps {
  initiativeId: string;
  /** Called when a single file finishes uploading successfully. */
  onUploadComplete?: (pdfId: string, file: UploadedPdf) => void;
  /** Optional: fired once every queued file is ready. */
  onAllReady?: (files: UploadedPdf[]) => void;
  /** Disable the whole control (e.g. when feature flag is off). */
  disabled?: boolean;
  /** Hard caps — defaults follow TASK-009 §3. */
  maxFiles?: number;
  maxSizeMB?: number;
}

export function PdfInitiativeUploader({
  initiativeId,
  onUploadComplete,
  onAllReady,
  disabled = false,
  maxFiles = 10,
  maxSizeMB = 50,
}: PdfInitiativeUploaderProps) {
  const [files, setFiles] = useState<UploadedPdf[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext !== 'pdf' && file.type !== 'application/pdf') {
      return 'Solo aceptamos archivos PDF. Si necesitas subir otro formato, conviértelo primero.';
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Este archivo supera los ${maxSizeMB} MB. Reduce su tamaño o divídelo antes de subirlo.`;
    }
    return null;
  };

  const enqueueAndUpload = async (incoming: File[]) => {
    setGlobalError(null);

    // Enforce max-files cap counting current ready/uploading entries
    const room = maxFiles - files.length;
    if (incoming.length > room) {
      setGlobalError(
        `Solo puedes subir ${maxFiles} PDFs por iniciativa. Elimina alguno para continuar.`,
      );
      return;
    }

    const toUpload: UploadedPdf[] = [];
    for (const file of incoming) {
      const err = validate(file);
      const entry: UploadedPdf = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        sizeBytes: file.size,
        state: err ? 'failed' : 'queued',
        progress: 0,
        error: err ?? undefined,
      };
      toUpload.push(entry);
    }

    setFiles((prev) => [...prev, ...toUpload]);

    // Sequential upload to avoid hammering the backend; can be parallelised
    // when we're confident the server can absorb it.
    for (let i = 0; i < toUpload.length; i++) {
      const entry = toUpload[i];
      if (entry.state === 'failed') continue;

      setFiles((prev) =>
        prev.map((f) => (f.id === entry.id ? { ...f, state: 'uploading', progress: 0 } : f)),
      );
      trackAutofillEvent('pdf_upload_started', {
        initiativeId,
      });

      try {
        const result = await uploadPdf(initiativeId, incoming[i], (pct) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === entry.id ? { ...f, progress: pct } : f)),
          );
        });
        const finalEntry: UploadedPdf = {
          ...entry,
          pdfId: result.pdfId,
          state: 'ready',
          progress: 100,
        };
        setFiles((prev) => prev.map((f) => (f.id === entry.id ? finalEntry : f)));
        trackAutofillEvent('pdf_upload_completed', {
          initiativeId,
          pdfId: result.pdfId,
        });
        onUploadComplete?.(result.pdfId, finalEntry);
      } catch (err) {
        const parsed = parseApiError(err);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === entry.id ? { ...f, state: 'failed', error: parsed.message } : f,
          ),
        );
        trackAutofillEvent('pdf_upload_failed', {
          initiativeId,
          reason: parsed.code,
        });
      }
    }

    // Notify when every entry is settled
    setFiles((prev) => {
      const allSettled = prev.every((f) => f.state === 'ready' || f.state === 'failed');
      if (allSettled && onAllReady) onAllReady(prev);
      return prev;
    });
  };

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return;
    const arr = Array.from(fileList);
    void enqueueAndUpload(arr);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-3" aria-disabled={disabled}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Cargar PDFs de la iniciativa"
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          disabled
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
            : dragOver
              ? 'border-violet-400 bg-violet-50 cursor-pointer'
              : 'border-slate-200 bg-slate-50 hover:border-slate-300 cursor-pointer'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="application/pdf,.pdf"
          multiple
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Upload size={20} className="text-slate-400 mx-auto mb-2" />
        <p className="text-xs text-slate-600" style={{ fontWeight: 500 }}>
          Arrastra tus PDFs o haz clic para seleccionarlos.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Hasta {maxFiles} archivos · Máx. {maxSizeMB} MB por archivo · Solo PDF
        </p>
      </div>

      {globalError && (
        <div
          role="alert"
          className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700"
        >
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          {globalError}
        </div>
      )}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white"
            >
              <FileText size={16} className="text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 truncate" style={{ fontWeight: 500 }}>
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(file.sizeBytes / 1024 / 1024).toFixed(1)} MB · {labelFor(file.state)}
                  {file.error ? ` — ${file.error}` : ''}
                </p>
                {file.state === 'uploading' && (
                  <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-1 bg-violet-500 transition-all"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {file.state === 'uploading' && (
                <Loader2 size={14} className="text-violet-500 animate-spin" />
              )}
              {file.state === 'ready' && (
                <CheckCircle2 size={14} className="text-emerald-500" />
              )}
              {file.state === 'failed' && (
                <AlertCircle size={14} className="text-red-500" />
              )}
              <button
                type="button"
                onClick={() => removeFile(file.id)}
                aria-label={`Quitar ${file.name} de la lista`}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function labelFor(state: PdfFileState): string {
  switch (state) {
    case 'queued':
      return 'En cola';
    case 'uploading':
      return 'Subiendo…';
    case 'ready':
      return 'Listo';
    case 'failed':
      return 'No se pudo subir';
  }
}
