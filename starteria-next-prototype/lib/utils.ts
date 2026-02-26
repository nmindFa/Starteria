import { ProjectData, Run } from './types';

export function computeGoNoGo(resultado?: number, umbral?: number): 'Go' | 'No-Go' | 'Inconcluso' {
  if (typeof resultado !== 'number' || typeof umbral !== 'number') return 'Inconcluso';
  return resultado >= umbral ? 'Go' : 'No-Go';
}

export function canCloseRun(run: Run, umbral: number): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const hasTaggedEvidence = run.evidences.some(e => !!e.tag?.trim());
  if (!hasTaggedEvidence) reasons.push('Agrega al menos 1 evidencia con etiqueta.');
  if (typeof run.resultado !== 'number') reasons.push('Registra el resultado numérico.');
  if (!run.fuente) reasons.push('Selecciona la fuente del resultado.');
  if (!run.learning.creiamos.trim() || !run.learning.observamos.trim() || !run.learning.aprendimos.trim() || !run.learning.haremos.trim()) {
    reasons.push('Completa la Learning Card.');
  }
  if (!run.decision) reasons.push('Selecciona una decisión del Run.');

  const auto = computeGoNoGo(run.resultado, umbral);
  if (auto === 'Go' && run.decision === 'Parar' && !run.justificacionParar?.trim()) {
    reasons.push('Si es Go y decides Parar, agrega justificación.');
  }
  return { ok: reasons.length === 0, reasons };
}

export function canSubmitStep3(project: ProjectData): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const step3 = project.step3;
  const run1 = step3.runs.find(r => r.name === 'Run #1');
  const run2 = step3.runs.find(r => r.name === 'Run #2');
  const hasPivotDocumented = step3.runs.some(r => r.status === 'Cerrado' && r.decision === 'Pivotar');

  if (!run1 || run1.status !== 'Cerrado') reasons.push('Run #1 cerrado');
  if ((!run2 || run2.status !== 'Cerrado') && !hasPivotDocumented) reasons.push('Run #2 cerrado o Pivot documentado');
  if (!step3.finalDecision) reasons.push('Decisión final registrada');
  if (!step3.changeLog.some(c => c.trim().length > 0)) reasons.push('Change-log con al menos 1 cambio');
  if (step3.upstreamChanged || step3.runs.some(r => r.needsUpstreamReview)) reasons.push('Confirma coherencia por cambio upstream');
  return { ok: reasons.length === 0, reasons };
}

export function canMarkDemoDayReady(project: ProjectData): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const step4 = project.step4;
  if (step4.selectedEvidenceIds.length < 3) reasons.push('Selecciona al menos 3 evidencias top.');
  if (!step4.recommendation) reasons.push('Define recomendación final (Go/Pivotar/Stop).');
  if (step4.razones.filter(r => r.trim()).length < 2) reasons.push('Agrega 2-3 razones claras.');
  if (!step4.pedidoConcreto.trim()) reasons.push('Completa pedido concreto al líder.');
  if (!step4.fechaObjetivo) reasons.push('Selecciona fecha objetivo.');
  return { ok: reasons.length === 0, reasons };
}
