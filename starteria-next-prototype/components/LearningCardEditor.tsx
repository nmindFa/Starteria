import { LearningCard } from '@/lib/types';

interface LearningCardEditorProps {
  value: LearningCard;
  onChange: (patch: Partial<LearningCard>) => void;
}

export function LearningCardEditor({ value, onChange }: LearningCardEditorProps) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-800">Learning Card (obligatoria)</p>
      <div className="space-y-2">
        <textarea value={value.creiamos} onChange={(e) => onChange({ creiamos: e.target.value })} placeholder="Creíamos que..." className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" rows={2} />
        <textarea value={value.observamos} onChange={(e) => onChange({ observamos: e.target.value })} placeholder="Observamos..." className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" rows={2} />
        <textarea value={value.aprendimos} onChange={(e) => onChange({ aprendimos: e.target.value })} placeholder="Aprendimos..." className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" rows={2} />
        <textarea value={value.haremos} onChange={(e) => onChange({ haremos: e.target.value })} placeholder="Haremos..." className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" rows={2} />
      </div>
    </div>
  );
}
