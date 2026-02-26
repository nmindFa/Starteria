import { Evidence } from '@/lib/types';

interface EvidencePickerProps {
  evidences: Evidence[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function EvidencePicker({ evidences, selectedIds, onToggle }: EvidencePickerProps) {
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="section-title">Evidencias top seleccionadas</h3>
        <span className={`text-xs ${selectedIds.length >= 3 ? 'text-emerald-700' : 'text-amber-700'}`}>{selectedIds.length}/3 mín.</span>
      </div>
      <div className="space-y-2">
        {evidences.map((e) => {
          const active = selectedIds.includes(e.id);
          return (
            <label key={e.id} className={`flex cursor-pointer items-center justify-between rounded-xl border p-2 ${active ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
              <div>
                <p className="text-sm font-medium">{e.name}</p>
                <p className="text-xs text-slate-500">{e.tag || 'Sin etiqueta'} - {e.type}</p>
              </div>
              <input type="checkbox" checked={active} onChange={() => onToggle(e.id)} />
            </label>
          );
        })}
      </div>
    </div>
  );
}
