import Link from 'next/link';
import { StepStatus } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

interface StepperProps {
  activeStep: 3 | 4;
  stepStatus: Record<1 | 2 | 3 | 4, StepStatus>;
}

export function Stepper({ activeStep, stepStatus }: StepperProps) {
  return (
    <div className="card">
      <p className="section-title mb-3">Progreso de pasos</p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((n) => {
          const num = n as 1 | 2 | 3 | 4;
          const href = num === 3 ? '/step-3' : num === 4 ? '/step-4' : '#';
          const isActive = activeStep === num;
          return (
            <div key={num} className={`rounded-xl border p-3 ${isActive ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white'}`}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Step {num}</p>
                <StatusBadge status={stepStatus[num]} />
              </div>
              {num >= 3 ? (
                <Link href={href} className="text-xs text-brand-700 hover:underline">
                  Ir al step
                </Link>
              ) : (
                <p className="text-xs text-slate-400">Referencia histórica</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
