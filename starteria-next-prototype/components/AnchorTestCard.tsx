import { TestCard } from '@/lib/types';

interface AnchorTestCardProps {
  testCard: TestCard;
  onSimulateUpstreamChange: () => void;
}

export function AnchorTestCard({ testCard, onSimulateUpstreamChange }: AnchorTestCardProps) {
  return (
    <div className="card sticky top-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Ancla del experimento</h2>
          <p className="text-xs text-slate-500">Test Card {testCard.version} - solo lectura</p>
        </div>
        <button onClick={onSimulateUpstreamChange} className="rounded-lg border border-brand-200 px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-50">
          Simular cambio en Test Card (upstream)
        </button>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <p><span className="font-semibold">Hipótesis más riesgosa:</span> {testCard.hipotesisRiesgosa}</p>
        <p><span className="font-semibold">Experimento:</span> {testCard.experimento}</p>
        <p><span className="font-semibold">Métrica:</span> {testCard.metrica}</p>
        <p><span className="font-semibold">Umbral Go/No-Go:</span> {testCard.umbralGoNoGo}</p>
        <p><span className="font-semibold">Escenario:</span> {testCard.escenario}</p>
        <p><span className="font-semibold">Con quién:</span> {testCard.conQuien}</p>
        <p><span className="font-semibold">Evidencia a capturar:</span> {testCard.evidenciaCapturar}</p>
        <p><span className="font-semibold">Riesgos/líneas rojas:</span> {testCard.riesgosLineasRojas}</p>
      </div>
    </div>
  );
}
