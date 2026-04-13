import {
  ResearchFront,
  ResearchModuleAContext,
  ResearchObjective,
  ResearchSource,
  Step1ResearchModuleV2State,
} from './step1ResearchV2.types';

const makeId = (prefix: string, index: number) => `${prefix}-${index + 1}`;

const clean = (value: string, fallback: string) => value.trim() || fallback;

const buildProfileSources = (actoresProceso?: string): ResearchSource[] => {
  const actors = (actoresProceso || '')
    .split(',')
    .map(actor => actor.trim())
    .filter(Boolean);

  if (actors.length === 0) {
    return [
      {
        id: 'perfil-1',
        type: 'perfil',
        label: 'Persona afectada',
        detail: 'Importa porque vive el problema en el proceso real.',
        owner: 'Usuario o actor afectado',
        accessPoint: 'Entrevista o llamada breve',
        expectedLearning: 'Entender como se manifiesta el problema, con que frecuencia aparece y que impacto genera.',
        origin: 'sugerido',
      },
      {
        id: 'perfil-2',
        type: 'perfil',
        label: 'Responsable operativo',
        detail: 'Importa porque coordina el paso donde ocurre el quiebre.',
        owner: 'Lider o responsable del proceso',
        accessPoint: 'Entrevista de contexto',
        expectedLearning: 'Entender causas operativas, restricciones del proceso y evidencia ya disponible.',
        origin: 'sugerido',
      },
    ];
  }

  return actors.slice(0, 3).map((actor, index) => ({
    id: makeId('perfil', index),
    type: 'perfil',
    label: actor,
    detail: index === 0
      ? 'Importa porque tiene visibilidad directa del problema y sus efectos.'
      : index === 1
      ? 'Importa porque ayuda a entender causas operativas y decisiones del proceso.'
      : 'Importa porque puede mostrar variaciones, restricciones o evidencia complementaria.',
    owner: actor,
    accessPoint: index === 0 ? 'Entrevista en contexto' : 'Entrevista o reunion breve',
    expectedLearning: index === 0
      ? 'Conocer casos recientes, fricciones concretas y senales del impacto real.'
      : index === 1
      ? 'Entender decisiones, cuellos de botella y datos que el area ya conoce.'
      : 'Detectar variaciones, excepciones o evidencia complementaria por area o perfil.',
    origin: 'sugerido',
  }));
};

const buildDataSources = (quiebre: string): ResearchSource[] => ([
  {
    id: 'data-1',
    type: 'data',
    label: 'Registros operativos',
    detail: `Aporta datos del proceso vinculados a ${clean(quiebre, 'el quiebre detectado')}.`,
    owner: 'Equipo operativo o analitica',
    accessPoint: 'Sistema, exportable o dashboard interno',
    expectedLearning: 'Medir frecuencia, volumen, tiempos y patrones del problema.',
    origin: 'sugerido',
  },
  {
    id: 'data-2',
    type: 'data',
    label: 'Evidencia documental',
    detail: 'Aporta tickets, reportes, correos o documentos que muestren frecuencia, tiempos o excepciones.',
    owner: 'Area responsable del proceso',
    accessPoint: 'Repositorio interno, correo o mesa de ayuda',
    expectedLearning: 'Contrastar casos reales, excepciones y trazas del problema.',
    origin: 'sugerido',
  },
]);

export const buildResearchObjective = (context: ResearchModuleAContext): ResearchObjective => {
  const casoReal = clean(context.casoReal, 'el proceso analizado');
  const quiebre = clean(context.quiebre, 'el punto donde aparece el problema');
  const consecuencia = clean(context.consecuencia, 'un impacto visible para los involucrados');
  const causa = clean(context.causaInmediata, 'causas operativas que aun deben validarse');

  return {
    moduleAStart: context.lecturaConsolidada,
    transformationNote: 'Tomamos el analisis inicial del problema y lo convertimos en un foco de investigacion que deja claro que validar antes de planear la captura.',
    draft: `Validar si el problema detectado en ${quiebre} existe de forma consistente dentro de ${casoReal}, entender su magnitud, frecuencia, impacto, causas y variaciones, y reunir evidencia suficiente para decidir si vale la pena avanzar con este reto.`,
    suggestedDraft: `Validar si el problema detectado en ${quiebre} existe de forma consistente dentro de ${casoReal}, entender su magnitud, frecuencia, impacto, causas y variaciones, y reunir evidencia suficiente para decidir si vale la pena avanzar con este reto.`,
    draftOrigin: 'sugerido',
    status: 'listo',
    trace: {
      problemObserved: `En Modulo A se observo un quiebre en ${quiebre} que hoy genera ${consecuencia}.`,
      informationGaps: [
        'Aun no esta claro que tan frecuente ocurre el problema ni a cuantos casos afecta.',
        `Todavia falta distinguir que parte del problema se explica por ${causa}.`,
        'No hay evidencia suficiente para separar percepcion, excepcion y patron repetido.',
      ],
      validationNeeds: [
        'Confirmar si el problema existe de forma real y recurrente.',
        'Entender a quien afecta, con que intensidad y en que situaciones cambia.',
        'Reunir evidencia cualitativa y cuantitativa antes de seguir al siguiente step.',
      ],
      recommendationReason: 'Tiene sentido porque baja el analisis inicial a un foco concreto de validacion: aclara que debes confirmar primero y evita que el Modulo B empiece a capturar sin criterio.',
    },
  };
};

export const buildResearchFrontSuggestions = (context: ResearchModuleAContext): ResearchFront[] => {
  const profileSources = buildProfileSources(context.actoresProceso);
  const dataSources = buildDataSources(context.quiebre);

  return [
    {
      id: 'front-1',
      title: 'Existencia y magnitud del problema',
      whyItMatters: 'Ayuda a comprobar si el problema es un patron real o solo un caso aislado.',
      learningGoal: 'Validar cuantas veces ocurre, a cuantos casos alcanza y como se comporta en el tiempo.',
      origin: 'sugerido',
      sourceMode: 'ambos',
      sources: [profileSources[0], dataSources[0]].filter(Boolean),
      selectedSourceIds: [profileSources[0]?.id, dataSources[0]?.id].filter(Boolean) as string[],
      guides: [],
      status: 'listo',
    },
    {
      id: 'front-2',
      title: 'Impacto operativo y consecuencias',
      whyItMatters: 'Permite traducir el problema a efectos visibles para usuarios, equipos y negocio.',
      learningGoal: `Entender como ${clean(context.consecuencia, 'el impacto observado')} cambia el trabajo real y que costo genera.`,
      origin: 'sugerido',
      sourceMode: 'ambos',
      sources: [profileSources[0], profileSources[1], dataSources[1]].filter(Boolean),
      selectedSourceIds: [profileSources[0]?.id, dataSources[1]?.id].filter(Boolean) as string[],
      guides: [],
      status: 'listo',
    },
    {
      id: 'front-3',
      title: 'Causas, variaciones y evidencia faltante',
      whyItMatters: 'Evita avanzar con una explicacion apresurada y ayuda a encontrar que validar mejor.',
      learningGoal: `Explorar si ${clean(context.causaInmediata, 'la causa preliminar')} explica el problema completo o si cambia segun perfil, area o contexto.`,
      origin: 'sugerido',
      sourceMode: 'ambos',
      sources: [...profileSources, ...dataSources.slice(0, 1)],
      selectedSourceIds: [profileSources[1]?.id, dataSources[0]?.id].filter(Boolean) as string[],
      guides: [],
      status: 'listo',
    },
  ];
};

export const buildInitialResearchV2State = (context: ResearchModuleAContext): Step1ResearchModuleV2State => ({
  objective: buildResearchObjective(context),
  fronts: buildResearchFrontSuggestions(context),
});
