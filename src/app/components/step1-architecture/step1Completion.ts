import {
  Step1CaptureModuleContext,
  Step1CaptureSynthesisData,
  Step1ModuleDefinition,
  Step1ModuleStatus,
  Step1ModuleViewModel,
} from './step1Architecture.types';
import { buildCaptureAnalysisSignature } from '../step1-capture-synthesis/step1CaptureAnalysis';

export const getStep1CaptureMissing = (state: Step1CaptureSynthesisData): string[] => {
  const missing: string[] = [];
  const completedCaptures = state.captures.filter(
    capture => capture.notes.trim().length > 0 && capture.finding.trim().length > 0,
  ).length;
  const evidencesWithInsight = state.evidences.filter(
    evidence => evidence.name.trim().length > 0 && evidence.insight.trim().length > 0,
  ).length;
  const organizedInsights = state.organizedInsights.filter(item => item.trim().length > 0).length;

  if (completedCaptures === 0) {
    missing.push('Registra al menos 1 captura con notas y hallazgo.');
  }
  if (evidencesWithInsight === 0) {
    missing.push('Agrega al menos 1 evidencia con el aprendizaje que demuestra.');
  }
  if (organizedInsights < 2) {
    missing.push('Organiza al menos 2 insights para consolidar el aprendizaje.');
  }
  if (!state.finalSummary.trim()) {
    missing.push('Redacta la sintesis final del Step 1.');
  }
  if (!state.finalDecision) {
    missing.push('Define la decision final sobre el aprendizaje del Step 1.');
  }
  if (state.finalDecision && state.finalDecision !== 'mantener' && !state.finalRationale.trim()) {
    missing.push('Explica por que ajustas o reformulas el problema.');
  }
  if (!state.aiAnalysis) {
    missing.push('Analiza con IA la evidencia del modulo para decidir si el problema sigue siendo valido.');
  }
  if (state.aiAnalysis && state.aiAnalysis.analyzedSignature !== buildCaptureAnalysisSignature(state)) {
    missing.push('Ya agregaste evidencia nueva. Vuelve a analizar el modulo con IA para actualizar el cierre.');
  }
  if (state.aiAnalysis && state.aiAnalysis.criteria.some(item => !item.ok)) {
    missing.push('El analisis IA aun tiene criterios en ajuste antes de cerrar el modulo.');
  }

  return missing;
};

export const calculateStep1Progress = (modules: Step1ModuleViewModel[]) =>
  Math.round((modules.filter(module => module.completed).length / modules.length) * 100);

interface BuildStep1ModuleViewModelsInput {
  moduleDefinitions: Step1ModuleDefinition[];
  analysisCompleted: boolean;
  researchCompleted: boolean;
  captureCompleted: boolean;
  researchNeedsAdjustment: boolean;
  captureNeedsAdjustment: boolean;
}

export const buildStep1ModuleViewModels = ({
  moduleDefinitions,
  analysisCompleted,
  researchCompleted,
  captureCompleted,
  researchNeedsAdjustment,
  captureNeedsAdjustment,
}: BuildStep1ModuleViewModelsInput): Step1ModuleViewModel[] =>
  moduleDefinitions.map(module => {
    if (module.key === 'analysis') {
      return {
        ...module,
        unlocked: true,
        completed: analysisCompleted,
        status: analysisCompleted ? 'complete' : 'available',
      };
    }

    if (module.key === 'research') {
      const unlocked = analysisCompleted;
      const status: Step1ModuleStatus =
        !unlocked ? 'locked' : researchNeedsAdjustment ? 'requires_adjustment' : researchCompleted ? 'complete' : 'available';

      return {
        ...module,
        unlocked,
        completed: researchCompleted && !researchNeedsAdjustment,
        status,
      };
    }

    const unlocked = analysisCompleted && researchCompleted && !researchNeedsAdjustment;
    const status: Step1ModuleStatus =
      !unlocked ? 'locked' : captureNeedsAdjustment ? 'requires_adjustment' : captureCompleted ? 'complete' : 'available';

    return {
      ...module,
      unlocked,
      completed: captureCompleted && !captureNeedsAdjustment,
      status,
    };
  });

export const buildCaptureModuleContext = (
  problemSummary: string,
  researchObjective: string,
  researchFronts: Step1CaptureModuleContext['researchFronts'],
): Step1CaptureModuleContext => ({
  problemSummary,
  researchObjective,
  researchFronts,
});
