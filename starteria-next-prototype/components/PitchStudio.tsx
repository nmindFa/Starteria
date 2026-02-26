import { PitchEvaluation } from '@/lib/types';

interface PitchStudioProps {
  fileName?: string;
  evaluation?: PitchEvaluation;
  onFile: (name: string) => void;
  onEvaluate: () => void;
}

export function PitchStudio({ fileName, evaluation, onFile, onEvaluate }: PitchStudioProps) {
  return (
    <div className="card">
      <h3 className="section-title mb-3">Pitch Studio (opcional)</h3>
      <div className="space-y-3">
        <label className="block text-sm text-slate-700">
          Subir audio/video (simulado)
          <input
            type="file"
            accept="audio/*,video/*"
            onChange={(e) => onFile(e.target.files?.[0]?.name || '')}
            className="mt-1 block w-full text-xs"
          />
        </label>
        {fileName && <p className="text-xs text-slate-500">Archivo: {fileName}</p>}
        <button onClick={onEvaluate} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Evaluar pitch
        </button>
        {evaluation && (
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-800">Score: {evaluation.score}</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">Fortalezas</p>
            <ul className="list-disc pl-5 text-xs text-slate-600">{evaluation.fortalezas.map((i) => <li key={i}>{i}</li>)}</ul>
            <p className="mt-2 text-xs font-semibold text-slate-700">Confusiones</p>
            <ul className="list-disc pl-5 text-xs text-slate-600">{evaluation.confusiones.map((i) => <li key={i}>{i}</li>)}</ul>
            <p className="mt-2 text-xs font-semibold text-slate-700">Reescritura sugerida</p>
            <ul className="list-disc pl-5 text-xs text-slate-600">{evaluation.reescritura.map((i) => <li key={i}>{i}</li>)}</ul>
            <p className="mt-2 text-xs text-slate-600"><span className="font-semibold">Tip de delivery:</span> {evaluation.tipDelivery}</p>
          </div>
        )}
      </div>
    </div>
  );
}
