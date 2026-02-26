import { Evidence } from '@/lib/types';

interface EvidenceListProps {
  evidences: Evidence[];
  onAddAttachment: () => void;
  onAddLink: () => void;
  onUpdate: (id: string, patch: Partial<Evidence>) => void;
}

export function EvidenceList({ evidences, onAddAttachment, onAddLink, onUpdate }: EvidenceListProps) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">Evidencias del Run</p>
        <div className="flex gap-2">
          <button onClick={onAddAttachment} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700">+ Adjunto</button>
          <button onClick={onAddLink} className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700">+ Link</button>
        </div>
      </div>
      <div className="space-y-2">
        {evidences.map((e) => (
          <div key={e.id} className="rounded-lg border border-slate-200 p-2">
            <div className="grid gap-2 md:grid-cols-4">
              <input
                value={e.name}
                onChange={(ev) => onUpdate(e.id, { name: ev.target.value })}
                placeholder="Nombre"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
              />
              <input
                value={e.label || ''}
                onChange={(ev) => onUpdate(e.id, { label: ev.target.value })}
                placeholder="Label"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
              />
              <input
                value={e.url || ''}
                onChange={(ev) => onUpdate(e.id, { url: ev.target.value })}
                placeholder="URL (si aplica)"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
              />
              <input
                value={e.tag || ''}
                onChange={(ev) => onUpdate(e.id, { tag: ev.target.value })}
                placeholder="Etiqueta (obligatoria)"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Tipo: {e.type}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
