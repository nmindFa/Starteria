import { StoryBuilderState } from '@/lib/types';

interface StoryBuilderProps {
  value: StoryBuilderState;
  onChange: (patch: Partial<StoryBuilderState>) => void;
}

export function StoryBuilder({ value, onChange }: StoryBuilderProps) {
  const fields: Array<{ key: keyof StoryBuilderState; label: string }> = [
    { key: 'contexto', label: 'Contexto (1-2 frases)' },
    { key: 'problema', label: 'Problema y quién sufre' },
    { key: 'queProbamos', label: 'Qué probamos (experimento)' },
    { key: 'queVimos', label: 'Qué vimos (resultado vs umbral)' },
    { key: 'queAprendimos', label: 'Qué aprendimos' },
    { key: 'recomendacion', label: 'Recomendación (Go/Pivot/Stop)' },
    { key: 'pedidoLider', label: 'Pedido al líder (qué necesito y para cuándo)' },
  ];

  return (
    <div className="card">
      <h3 className="section-title mb-3">Story Builder 1-3 min</h3>
      <div className="space-y-2">
        {fields.map((f) => (
          <label key={f.key} className="block text-sm text-slate-700">
            {f.label}
            <textarea value={value[f.key]} onChange={(e) => onChange({ [f.key]: e.target.value })} rows={2} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm" />
          </label>
        ))}
      </div>
    </div>
  );
}
