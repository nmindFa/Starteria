import { OnePagerState } from '@/lib/types';

interface OnePagerEditorProps {
  value: OnePagerState;
  onChange: (patch: Partial<OnePagerState>) => void;
}

export function OnePagerEditor({ value, onChange }: OnePagerEditorProps) {
  const fields: Array<{ key: keyof OnePagerState; label: string }> = [
    { key: 'reto', label: 'Reto (resumen)' },
    { key: 'metricaUmbral', label: 'Métrica y umbral' },
    { key: 'disenoExperimento', label: 'Diseño del experimento' },
    { key: 'runsEjecutados', label: 'Runs ejecutados (tabla simple)' },
    { key: 'resultados', label: 'Resultados' },
    { key: 'aprendizajes', label: 'Aprendizajes' },
    { key: 'recomendacion', label: 'Recomendación' },
    { key: 'pedidoLider', label: 'Pedido al líder' },
  ];

  return (
    <div className="card">
      <h3 className="section-title mb-3">One-pager (editable)</h3>
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
