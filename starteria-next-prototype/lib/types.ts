export type StepStatus =
  | 'No iniciado'
  | 'En progreso'
  | 'Enviado a revisión'
  | 'Feedback IA'
  | 'Ajustado'
  | 'Sesión experto pendiente'
  | 'Aprobado';

export type RunStatus = 'Draft' | 'En ejecución' | 'Cerrado';
export type SampleType = 'cualitativo' | 'cuantitativo';
export type Decision = 'Iterar' | 'Pivotar' | 'Parar';
export type GoNoGo = 'Go' | 'No-Go' | 'Inconcluso';

export interface TestCard {
  version: string;
  hipotesisRiesgosa: string;
  experimento: string;
  metrica: string;
  umbralGoNoGo: number;
  escenario: string;
  conQuien: string;
  evidenciaCapturar: string;
  riesgosLineasRojas: string;
}

export interface Evidence {
  id: string;
  type: 'adjunto' | 'link';
  name: string;
  label?: string;
  url?: string;
  tag?: string;
}

export interface LearningCard {
  creiamos: string;
  observamos: string;
  aprendimos: string;
  haremos: string;
}

export interface Run {
  id: string;
  name: string;
  status: RunStatus;
  sampleType: SampleType;
  sampleSize: number;
  planCaptura: string;
  evidences: Evidence[];
  resultado?: number;
  fuente?: 'medición directa' | 'reporte' | 'proxy';
  learning: LearningCard;
  decision?: Decision;
  justificacionParar?: string;
  needsUpstreamReview?: boolean;
}

export interface StepFeedback {
  score: number;
  acciones: string[];
  preguntas: string[];
}

export interface Step3State {
  status: StepStatus;
  testCard: TestCard;
  upstreamChanged: boolean;
  runs: Run[];
  changeLog: string[];
  finalDecision?: Decision;
  feedback?: StepFeedback;
}

export interface StoryBuilderState {
  contexto: string;
  problema: string;
  queProbamos: string;
  queVimos: string;
  queAprendimos: string;
  recomendacion: string;
  pedidoLider: string;
}

export interface OnePagerState {
  reto: string;
  metricaUmbral: string;
  disenoExperimento: string;
  runsEjecutados: string;
  resultados: string;
  aprendizajes: string;
  recomendacion: string;
  pedidoLider: string;
}

export interface PitchEvaluation {
  score: number;
  fortalezas: string[];
  confusiones: string[];
  reescritura: string[];
  tipDelivery: string;
}

export interface Step4State {
  status: StepStatus;
  requiereRefrescar: boolean;
  story: StoryBuilderState;
  onePager: OnePagerState;
  manualEdits: Partial<OnePagerState>;
  selectedEvidenceIds: string[];
  recommendation?: 'Go' | 'Pivotar' | 'Stop';
  razones: string[];
  pedidoConcreto: string;
  fechaObjetivo: string;
  feedback?: StepFeedback;
  pitchFileName?: string;
  pitchEvaluation?: PitchEvaluation;
}

export interface ProjectData {
  id: string;
  nombre: string;
  estadoProyecto: string;
  stepStatus: Record<1 | 2 | 3 | 4, StepStatus>;
  step3: Step3State;
  step4: Step4State;
}
