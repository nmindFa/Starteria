import React from 'react';

export interface ActionFieldCardProps {
  label: string;
  completed: boolean;
  exampleLabel?: string;
  onExample?: () => void;
  iaLabel?: string;
  onIA?: () => void;
  bullets?: string[];
  children?: React.ReactNode;
}

export function ActionFieldCard({
  label,
  completed,
  exampleLabel = 'Ver ejemplo',
  onExample,
  iaLabel = '✨ Mejorar con IA',
  onIA,
  bullets = [],
  children,
}: ActionFieldCardProps) {
  return (
    <div className="border rounded-xl p-3 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${completed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
              {completed ? '✅ Completo' : '⚠️ Por ajustar'}
            </span>
            <h3 className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{label}</h3>
          </div>

          <div className="mb-2">
            {children}
          </div>

          {bullets.length > 0 && (
            <div className="text-xs text-slate-500 mt-2 ml-1">
              <div style={{ fontWeight: 600 }}>Qué no puede faltar:</div>
              <ul className="ml-4 list-disc mt-1">
                {bullets.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end space-y-2 shrink-0">
          <button onClick={onExample} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md"> {exampleLabel} </button>
          <button onClick={onIA} className="text-xs text-violet-600 hover:text-violet-800 px-2 py-1 rounded-md"> {iaLabel} </button>
        </div>
      </div>
    </div>
  );
}

export default ActionFieldCard;
