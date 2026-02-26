import { Run } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface RunListProps {
  runs: Run[];
  selectedRunId?: string;
  onSelectRun: (id: string) => void;
  onCreateRun: () => void;
}

export function RunList({ runs, selectedRunId, onSelectRun, onCreateRun }: RunListProps) {
  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="section-title">Runs (corridas)</h3>
        <button onClick={onCreateRun} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          Crear Run
        </button>
      </div>
      <div className="space-y-2">
        {runs.map((run) => (
          <button
            key={run.id}
            onClick={() => onSelectRun(run.id)}
            className={`w-full rounded-xl border p-3 text-left ${selectedRunId === run.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{run.name}</p>
              <StatusBadge status={run.status} />
            </div>
            {run.needsUpstreamReview && (
              <p className="mt-1 text-xs text-red-600">Revisar cambios (cambio upstream)</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
