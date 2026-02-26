import { Run, TestCard } from '@/lib/types';
import { canCloseRun, computeGoNoGo } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { EvidenceList } from './EvidenceList';
import { LearningCardEditor } from './LearningCardEditor';

interface RunEditorProps {
  run: Run;
  testCard: TestCard;
  onChange: (nextRun: Run) => void;
  onCloseRun: () => void;
}

export function RunEditor({ run, testCard, onChange, onCloseRun }: RunEditorProps) {
  const autoDecision = computeGoNoGo(run.resultado, testCard.umbralGoNoGo);
  const closeCheck = canCloseRun(run, testCard.umbralGoNoGo);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">{run.name}</h3>
        <StatusBadge status={run.status} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          Tipo de muestra
          <select
            value={run.sampleType}
            onChange={(e) => onChange({ ...run, sampleType: e.target.value as Run['sampleType'] })}
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          >
            <option value="cualitativo">cualitativo</option>
            <option value="cuantitativo">cuantitativo</option>
          </select>
        </label>
        <label className="text-sm text-slate-700">
          Tamaño de muestra
          <input
            type="number"
            value={run.sampleSize}
            onChange={(e) => onChange({ ...run, sampleSize: Number(e.target.value || 0) })}
            className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      {run.sampleType === 'cualitativo' && <p className="text-xs text-blue-700">Tip: para usabilidad cualitativa, empieza con 5 personas por corrida.</p>}

      <label className="block text-sm text-slate-700">
        Plan de captura
        <textarea
          value={run.planCaptura}
          onChange={(e) => onChange({ ...run, planCaptura: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
        />
      </label>

      <EvidenceList
        evidences={run.evidences}
        onAddAttachment={() =>
          onChange({
            ...run,
            evidences: [...run.evidences, { id: `ev-${Date.now()}`, type: 'adjunto', name: 'nuevo-adjunto', tag: '' }],
          })
        }
        onAddLink={() =>
          onChange({
            ...run,
            evidences: [...run.evidences, { id: `ev-${Date.now()}`, type: 'link', name: 'nuevo-link', url: '', tag: '' }],
          })
        }
        onUpdate={(id, patch) => onChange({ ...run, evidences: run.evidences.map((e) => (e.id === id ? { ...e, ...patch } : e)) })}
      />

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-800">Resultado vs umbral</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm text-slate-700">
            Resultado
            <input
              type="number"
              value={typeof run.resultado === 'number' ? run.resultado : ''}
              onChange={(e) => onChange({ ...run, resultado: e.target.value ? Number(e.target.value) : undefined })}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-sm text-slate-700">
            Fuente
            <select
              value={run.fuente || ''}
              onChange={(e) => onChange({ ...run, fuente: (e.target.value || undefined) as Run['fuente'] })}
              className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">Seleccionar</option>
              <option value="medición directa">medición directa</option>
              <option value="reporte">reporte</option>
              <option value="proxy">proxy</option>
            </select>
          </label>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-slate-600">Go/No-Go automático:</span>
          <StatusBadge status={autoDecision} />
        </div>
      </div>

      <LearningCardEditor value={run.learning} onChange={(patch) => onChange({ ...run, learning: { ...run.learning, ...patch } })} />

      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-800">Decisión del Run</p>
        <div className="flex gap-2">
          {(['Iterar', 'Pivotar', 'Parar'] as const).map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...run, decision: d })}
              className={`rounded-lg px-3 py-1.5 text-xs ${run.decision === d ? 'bg-brand-600 text-white' : 'border border-slate-200 text-slate-700'}`}
            >
              {d}
            </button>
          ))}
        </div>
        {autoDecision === 'Go' && run.decision === 'Parar' && (
          <textarea
            value={run.justificacionParar || ''}
            onChange={(e) => onChange({ ...run, justificacionParar: e.target.value })}
            rows={2}
            placeholder="Justificación obligatoria si es Go pero decides Parar"
            className="mt-2 w-full rounded-md border border-amber-300 px-2 py-1.5 text-sm"
          />
        )}
      </div>

      <div>
        <button
          onClick={onCloseRun}
          disabled={!closeCheck.ok}
          aria-disabled={!closeCheck.ok}
          title={!closeCheck.ok ? closeCheck.reasons.join(' | ') : ''}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${closeCheck.ok ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-100 text-slate-400'}`}
        >
          Cerrar Run
        </button>
        {!closeCheck.ok && (
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
            {closeCheck.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
