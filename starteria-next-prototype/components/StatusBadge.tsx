import { StepStatus, RunStatus } from '@/lib/types';

type Status = StepStatus | RunStatus | 'Go' | 'No-Go' | 'Inconcluso';

const tone: Record<Status, string> = {
  'No iniciado': 'bg-slate-100 text-slate-700',
  'En progreso': 'bg-blue-100 text-blue-700',
  'Enviado a revisión': 'bg-indigo-100 text-indigo-700',
  'Feedback IA': 'bg-purple-100 text-purple-700',
  'Ajustado': 'bg-amber-100 text-amber-700',
  'Sesión experto pendiente': 'bg-orange-100 text-orange-700',
  Aprobado: 'bg-emerald-100 text-emerald-700',
  Draft: 'bg-slate-100 text-slate-700',
  'En ejecución': 'bg-cyan-100 text-cyan-700',
  Cerrado: 'bg-emerald-100 text-emerald-700',
  Go: 'bg-emerald-100 text-emerald-700',
  'No-Go': 'bg-red-100 text-red-700',
  Inconcluso: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${tone[status]}`}>{status}</span>;
}
