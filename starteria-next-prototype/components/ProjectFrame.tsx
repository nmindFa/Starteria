import { ProjectData } from '@/lib/types';
import { Stepper } from './Stepper';

interface ProjectFrameProps {
  project: ProjectData;
  activeStep: 3 | 4;
  children: React.ReactNode;
}

export function ProjectFrame({ project, activeStep, children }: ProjectFrameProps) {
  return (
    <main className="mx-auto min-h-screen max-w-7xl space-y-4 p-4 md:p-6">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">Proyecto</p>
            <h1 className="text-lg font-bold">{project.nombre}</h1>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{project.estadoProyecto}</span>
        </div>
      </div>

      <Stepper activeStep={activeStep} stepStatus={project.stepStatus} />

      <div className="card border-amber-200 bg-amber-50">
        <p className="text-sm font-semibold text-amber-800">Gating para pasar al siguiente step</p>
        <ul className="mt-1 list-disc pl-5 text-xs text-amber-700">
          <li>Checklist mínimos completos</li>
          <li>Enviar a revisión IA y resolver feedback</li>
          <li>Solicitar y aprobar sesión con experto</li>
        </ul>
      </div>

      {children}
    </main>
  );
}
