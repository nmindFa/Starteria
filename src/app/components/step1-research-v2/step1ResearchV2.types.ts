export type ResearchSourceMode = 'perfil' | 'data' | 'ambos';
export type ResearchSourceType = 'perfil' | 'data';
export type ResearchStatus = 'listo' | 'revisar';
export type ResearchGuideMode = 'interview' | 'data_review';

export interface ResearchSource {
  id: string;
  type: ResearchSourceType;
  label: string;
  detail: string;
  owner: string;
  accessPoint: string;
  expectedLearning: string;
  origin: 'sugerido' | 'manual';
}

export interface ResearchGuide {
  id: string;
  sourceId: string;
  sourceType: ResearchSourceType;
  mode: ResearchGuideMode;
  sourceLabel: string;
  intro: string;
  criteria: string[];
  suggestedSources: string[];
  questions: string[];
  questionGroups?: string[][];
  informationGaps: string[];
  body: string;
  origin: 'sugerido' | 'manual';
  status: ResearchStatus;
}

export interface ResearchFront {
  id: string;
  title: string;
  whyItMatters: string;
  learningGoal: string;
  origin: 'sugerido' | 'manual';
  sourceMode: ResearchSourceMode;
  sources: ResearchSource[];
  selectedSourceIds: string[];
  guides: ResearchGuide[];
  status: ResearchStatus;
}

export interface ResearchObjectiveTrace {
  problemObserved: string;
  informationGaps: string[];
  validationNeeds: string[];
  recommendationReason: string;
}

export interface ResearchObjective {
  moduleAStart: string;
  transformationNote: string;
  draft: string;
  suggestedDraft: string;
  draftOrigin: 'sugerido' | 'manual';
  trace: ResearchObjectiveTrace;
  status: ResearchStatus;
}

export interface Step1ResearchModuleV2State {
  objective: ResearchObjective;
  fronts: ResearchFront[];
}

export interface ResearchModuleAContext {
  casoReal: string;
  quiebre: string;
  consecuencia: string;
  causaInmediata: string;
  lecturaConsolidada: string;
  actoresProceso?: string;
}
