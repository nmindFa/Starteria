import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface BannerPorDefinirProps {
  title: string;
  question: string;
  context?: string;
}

export function BannerPorDefinir({ title, question, context }: BannerPorDefinirProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-dashed border-slate-300 rounded-lg bg-slate-50 p-3">
      <div className="flex items-start gap-2">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-xs shrink-0 mt-0.5" style={{ fontWeight: 600 }}>
          POR DEFINIR
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-600" style={{ fontWeight: 500 }}>{title}</p>
          {context && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-1 transition-colors"
            >
              <HelpCircle size={11} />
              Ver pregunta abierta
              {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
          {expanded && (
            <div className="mt-2 p-2 bg-white border border-slate-200 rounded text-xs text-slate-600 italic">
              💬 {question}
            </div>
          )}
          {!context && (
            <p className="text-xs text-slate-400 mt-0.5 italic">{question}</p>
          )}
        </div>
      </div>
    </div>
  );
}
