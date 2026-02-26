import React from 'react';

export function PreviewCard({
  title,
  bullets,
  onEdit,
  icon,
  badge = 'Card final',
}: {
  title: string;
  bullets: string[];
  onEdit?: () => void;
  icon?: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="border rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-violet-100 bg-violet-50/70">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              {icon}
            </div>
            <div>
              <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{title}</p>
              <span className="inline-flex mt-1 text-[11px] px-2 py-0.5 rounded-full border border-violet-200 text-violet-700 bg-white" style={{ fontWeight: 600 }}>
                {badge}
              </span>
            </div>
          </div>
          <button onClick={onEdit} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded-md shrink-0">Editar detalles</button>
        </div>
      </div>

      <ul className="list-disc ml-9 mr-4 my-4 space-y-1 text-sm text-slate-700">
        {bullets.slice(0, 5).map((b, i) => (
          <li key={i} className="text-sm">{b || 'POR DEFINIR'}</li>
        ))}
      </ul>
    </div>
  );
}

export default PreviewCard;
