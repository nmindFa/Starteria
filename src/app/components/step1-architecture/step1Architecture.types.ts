import { Step1ResearchModuleV2State } from '../step1-research-v2/step1ResearchV2.types';

export type Step1ModuleId = 'A' | 'B' | 'C';
export type Step1ModuleKey = 'analysis' | 'research' | 'capture_synthesis';
export type Step1ModuleStatus = 'locked' | 'available' | 'complete' | 'requires_adjustment';

export interface Step1ModuleDefinition {
  id: Step1ModuleId;
  key: Step1ModuleKey;
  label: string;
  shortName: string;
  order: number;
}

export interface Step1CaptureRecord {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceType: 'perfil' | 'data' | 'documento' | 'otra';
  sourceDetail: string;
  frontIds: string[];
  frontTitles: string[];
  guideIds: string[];
  guideSummary: string;
  guideBody: string;
  notes: string;
  finding: string;
  surprises: string;
  needsFollowUp: boolean;
  status: 'pendiente' | 'completo';
}

export interface Step1CaptureEvidence {
  id: string;
  kind: '' | 'nota' | 'audio' | 'captura' | 'link' | 'reporte' | 'archivo';
  name: string;
  insight: string;
  captureRecordId: string;
  url?: string;
}

export type Step1CaptureAnalysisCriterionKey =
  | 'scoped'
  | 'strategic'
  | 'real'
  | 'urgent'
  | 'desirable'
  | 'evidenceStrong';

export type Step1CaptureAnalysisFieldKey =
  | 'notes'
  | 'finding'
  | 'surprises'
  | 'evidence'
  | 'evidenceInsight'
  | 'followUp';

export interface Step1CaptureAnalysisTarget {
  frontId: string;
  frontTitle: string;
  frontType: 'qualitative' | 'data' | 'mixed';
  fieldKey: Step1CaptureAnalysisFieldKey;
  fieldLabel: string;
  missing: string;
  action: string;
}

export interface Step1CaptureSynthesisData {
  captures: Step1CaptureRecord[];
  evidences: Step1CaptureEvidence[];
  organizedInsights: string[];
  finalSummary: string;
  finalDecision: '' | 'mantener' | 'ajustar' | 'reformular';
  finalRationale: string;
  aiAnalysis: {
    scoped: boolean;
    strategic: boolean;
    real: boolean;
    urgent: boolean;
    desirable: boolean;
    evidenceStrong: boolean;
    criteria: Array<{
      key: Step1CaptureAnalysisCriterionKey;
      label: string;
      meaning: string;
      ok: boolean;
      reason: string;
      missing: string;
      action: string;
      frontTitles: string[];
      targets: Step1CaptureAnalysisTarget[];
    }>;
    conclusion: string;
    recommendations: string[];
    analyzedSignature: string;
  } | null;
  version: number;
  legacyContext: {
    restrictionsNotes: string[];
    reviewOwner: string;
    teamCapacity: string;
  };
}

export interface Step1ModuleViewModel extends Step1ModuleDefinition {
  unlocked: boolean;
  completed: boolean;
  status: Step1ModuleStatus;
}

export interface Step1CaptureModuleContext {
  problemSummary: string;
  researchObjective: string;
  researchFronts: Array<{
    id: string;
    title: string;
    learningGoal: string;
    sourceLabels: string[];
    guideCount: number;
  }>;
}

export interface Step1CaptureLegacyRestrictions {
  limitesChips?: string[];
  limitesTexto?: string;
  dependencia?: string;
  dependenciaDueno?: string;
  dependenciaProbabilidad?: '' | 'baja' | 'media' | 'alta';
  alternativaPiloto?: string;
  vistoBueno?: string;
  capacidadReal?: string;
}

export interface Step1CaptureLegacyValidation {
  fuentes?: Array<{
    id: string;
    tipo: '' | 'persona' | 'datos' | 'documento';
    rolNombre: string;
    porQue: string;
    queConfirmar: string;
  }>;
  evidencias?: Array<{
    id: string;
    tipo: '' | 'nota' | 'audio' | 'captura' | 'link' | 'reporte';
    nombre: string;
    queDemuestra: string;
  }>;
  decisionReto?: '' | 'mantiene' | 'ajusta' | 'cambia';
  nuevaVersionReto?: string;
  queAjusto?: string[];
}

export interface Step1CaptureLegacySynthesis {
  resumen?: string;
  pivotCheck?: '' | 'mantener' | 'acotar' | 'reformular' | 'cambiar';
  razonPivot?: string;
  version?: number;
}

export interface Step1CaptureNormalizationInput {
  researchState: Step1ResearchModuleV2State;
  legacyRestrictions?: Step1CaptureLegacyRestrictions;
  legacyValidation?: Step1CaptureLegacyValidation;
  legacySynthesis?: Step1CaptureLegacySynthesis;
}
