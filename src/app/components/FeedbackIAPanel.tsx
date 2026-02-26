import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, Sparkles, ArrowRight } from 'lucide-react';
import type { FeedbackIA } from '../context/AppContext';

interface FeedbackIAPanelProps {
  feedback: FeedbackIA;
  onIterate?: () => void;
}

export function FeedbackIAPanel({ feedback, onIterate }: FeedbackIAPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const statusConfig = {
    'Aprobado':  { icon: <CheckCircle2 size={16} className="text-emerald-600" />, bg: 'bg-emerald-50 border-emerald-200', title: 'text-emerald-800', label: 'bg-emerald-100 text-emerald-700' },
    'Iterar':    { icon: <AlertTriangle size={16} className="text-amber-600" />,  bg: 'bg-amber-50 border-amber-200',   title: 'text-amber-800',   label: 'bg-amber-100 text-amber-700' },
    'Bloqueado': { icon: <XCircle size={16} className="text-red-600" />,          bg: 'bg-red-50 border-red-200',        title: 'text-red-800',     label: 'bg-red-100 text-red-700' },
  };

  const cfg = statusConfig[feedback.status];

  return (
    <div className={`rounded-xl border ${cfg.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-500" />
          <span className={`text-sm ${cfg.title}`} style={{ fontWeight: 600 }}>Revisión IA</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${cfg.label}`} style={{ fontWeight: 500 }}>
            {feedback.status}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-sm text-slate-600">{feedback.summary}</p>

          {feedback.goodPoints.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>✓ Lo que está bien</p>
              <ul className="space-y-1">
                {feedback.goodPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.missing.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>⚠ Qué falta</p>
              <ul className="space-y-1">
                {feedback.missing.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.actions.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>Acciones concretas ({feedback.actions.length}/5)</p>
              <ol className="space-y-1.5">
                {feedback.actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center" style={{ fontSize: '10px', fontWeight: 600 }}>{i + 1}</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {feedback.questions.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1.5" style={{ fontWeight: 600 }}>Preguntas para reflexionar ({feedback.questions.length}/5)</p>
              <ul className="space-y-1.5">
                {feedback.questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-600 italic">
                    <ArrowRight size={11} className="text-violet-400 mt-0.5 shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {feedback.contradictions && feedback.contradictions.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-700 mb-1" style={{ fontWeight: 600 }}>⚡ Contradicciones entre módulos</p>
              {feedback.contradictions.map((c, i) => (
                <p key={i} className="text-xs text-red-600">{c}</p>
              ))}
            </div>
          )}

          {feedback.status !== 'Aprobado' && onIterate && (
            <button
              onClick={onIterate}
              className="w-full mt-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg py-2 text-sm transition-colors"
              style={{ fontWeight: 500 }}
            >
              Corregir ahora
            </button>
          )}

          <p className="text-xs text-slate-400">
            Revisado el {new Date(feedback.timestamp).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  );
}
