import {
  ResearchFront,
  ResearchGuide,
  ResearchObjective,
  ResearchSource,
  ResearchSourceType,
} from './step1ResearchV2.types';

const MAX_GUIDE_QUESTIONS = 8;

const normalizeText = (value: string, fallback: string) => value.trim() || fallback;

const buildInterviewCriteria = (front: ResearchFront): string[] => [
  `Identificar como se vive ${normalizeText(front.title, 'este frente').toLowerCase()} en la operacion real.`,
  `Reconocer frecuencia, variaciones y momentos criticos vinculados a ${normalizeText(front.learningGoal, 'lo que se busca validar').toLowerCase()}.`,
  'Detectar que evidencia ya existe y que vacios de informacion siguen abiertos.',
  'Entender que decision ayudaria a tomar esta conversacion o levantamiento.',
];

const buildInterviewQuestions = (front: ResearchFront, criteria: string[]): string[] => {
  const openingQuestions = [
    `Para empezar, como se relaciona tu rol con ${normalizeText(front.title, 'este frente').toLowerCase()}?`,
    'Cuando piensas en este problema, que caso reciente te viene primero a la mente?',
  ];

  const coreQuestions = criteria.map(criterion => {
    const cleanedCriterion = criterion.replace(/\.$/, '').toLowerCase();
    return `Como se manifiesta ${cleanedCriterion} en tu experiencia y que ejemplos concretos puedes compartir?`;
  });

  const closingQuestion = 'Para cerrar, que deberiamos investigar mejor antes de sacar una conclusion sobre este frente?';

  return [...openingQuestions, ...coreQuestions, closingQuestion].slice(0, MAX_GUIDE_QUESTIONS);
};

const buildDataSuggestedSources = (source: ResearchSource, front: ResearchFront): string[] => {
  const baseSuggestions = [
    source.label,
    'Registros operativos',
    'Dashboards internos',
    'Reportes internos',
    'Correos o tickets',
    'Archivos historicos',
  ];

  if (/sap|crm|erp/i.test(source.label) || /sap|crm|erp/i.test(source.detail)) {
    baseSuggestions.splice(1, 0, 'SAP / CRM / ERP');
  }

  if (/document|norma|politica/i.test(source.label) || /document|norma|politica/i.test(source.detail)) {
    baseSuggestions.push('Documentos normativos');
  }

  if (/dashboard|reporte|base/i.test(front.learningGoal)) {
    baseSuggestions.push('Bases de datos o cortes exportables');
  }

  return Array.from(new Set(baseSuggestions.map(item => item.trim()).filter(Boolean))).slice(0, 6);
};

const buildDataCriteria = (front: ResearchFront): string[] => [
  `Cantidad de casos vinculados a ${normalizeText(front.title, 'este frente').toLowerCase()}.`,
  `Frecuencia del problema o del evento asociado a ${normalizeText(front.learningGoal, 'lo que se busca validar').toLowerCase()}.`,
  'Tiempo promedio, retrasos o diferencias relevantes entre casos.',
  'Excepciones, rechazos, variaciones por sede, equipo o perfil y tendencia en el tiempo.',
  'Evidencia que confirme, ajuste o descarte el problema planteado.',
];

const buildDataInformationGaps = (front: ResearchFront, source: ResearchSource): string[] => [
  `Que dato falta si ${normalizeText(source.label, 'la fuente actual').toLowerCase()} no permite medir frecuencia o magnitud.`,
  'Que corte no existe hoy y seria necesario para comparar por periodo, sede, equipo o perfil.',
  'Que documento o fuente complementaria haria falta revisar para completar el analisis.',
  `Que hueco de informacion sigue abierto para entender mejor ${normalizeText(front.title, 'este frente').toLowerCase()}.`,
];

const buildInterviewGuide = (
  objective: ResearchObjective,
  front: ResearchFront,
  source: ResearchSource,
): ResearchGuide => {
  const criteria = buildInterviewCriteria(front);
  const questions = buildInterviewQuestions(front, criteria);
  const intro = `Queremos entender tu experiencia para investigar ${normalizeText(front.title, 'este frente').toLowerCase()} sin asumir respuestas ni dar el problema por validado.`;

  return {
    id: `${front.id}-${source.id}`,
    sourceId: source.id,
    sourceType: source.type,
    mode: 'interview',
    sourceLabel: source.label,
    intro,
    criteria,
    suggestedSources: [],
    questions,
    informationGaps: [],
    body: '',
    status: objective.draft.trim() ? 'listo' : 'revisar',
  };
};

const buildDataGuide = (
  objective: ResearchObjective,
  front: ResearchFront,
  source: ResearchSource,
): ResearchGuide => {
  const suggestedSources = buildDataSuggestedSources(source, front);
  const criteria = buildDataCriteria(front);
  const informationGaps = buildDataInformationGaps(front, source);
  const intro = `Esta revision busca reunir evidencia concreta para entender ${normalizeText(front.title, 'este frente').toLowerCase()} y contrastarla con el objetivo general de investigacion: ${normalizeText(objective.draft, 'sin objetivo definido')}.`;

  return {
    id: `${front.id}-${source.id}`,
    sourceId: source.id,
    sourceType: source.type,
    mode: 'data_review',
    sourceLabel: source.label,
    intro,
    criteria,
    suggestedSources,
    questions: [],
    informationGaps,
    body: '',
    status: objective.draft.trim() ? 'listo' : 'revisar',
  };
};

export const serializeResearchGuide = (
  guide: Pick<ResearchGuide, 'mode' | 'sourceType' | 'sourceLabel' | 'intro' | 'criteria' | 'suggestedSources' | 'questions' | 'informationGaps'>,
) => {
  const sourceLine = guide.sourceType === 'perfil'
    ? `Perfil o rol: ${guide.sourceLabel}`
    : `Fuente de data o evidencia: ${guide.sourceLabel}`;

  if (guide.mode === 'data_review') {
    return [
      sourceLine,
      '',
      'Proposito de la revision:',
      guide.intro,
      '',
      'Fuentes de informacion sugeridas:',
      ...guide.suggestedSources.map((item, index) => `${index + 1}. ${item}`),
      '',
      'Data o evidencia a capturar:',
      ...guide.criteria.map((item, index) => `${index + 1}. ${item}`),
      '',
      'Vacios de informacion detectables:',
      ...guide.informationGaps.map((item, index) => `${index + 1}. ${item}`),
    ].join('\n');
  }

  return [
    sourceLine,
    '',
    'Introduccion sugerida:',
    guide.intro,
    '',
    'Criterios sugeridos a investigar:',
    ...guide.criteria.map((item, index) => `${index + 1}. ${item}`),
    '',
    'Preguntas sugeridas:',
    ...guide.questions.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n');
};

export const buildGuideForSource = (
  objective: ResearchObjective,
  front: ResearchFront,
  source: ResearchSource,
): ResearchGuide => {
  const guide = source.type === 'perfil'
    ? buildInterviewGuide(objective, front, source)
    : buildDataGuide(objective, front, source);

  return {
    ...guide,
    body: serializeResearchGuide(guide),
  };
};
