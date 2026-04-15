import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import * as portfolioService from '../services/portfolioService';
import { usePortfolioData } from '../hooks/usePortfolioData';

export type StrategicFrontStatus = 'draft' | 'active' | 'paused' | 'closed';
export type StrategicFrontPriority = 'Alta' | 'Media' | 'Baja';
export type ChallengeActivationMode = 'convocatoria_abierta' | 'personas_seleccionadas' | 'squad_asignado';
export type ChallengeStatus =
  | 'draft'
  | 'listo_para_activar'
  | 'activo_interno'
  | 'publicado'
  | 'recibiendo_iniciativas'
  | 'con_iniciativas_activas'
  | 'pendiente_de_decision'
  | 'cerrado';
export type ChallengeType = 'correccion' | 'crecimiento' | 'exploracion';
export type StakeholderStatus = 'definido' | 'notificado' | 'confirmado';
// Must match the Prisma StakeholderStatus enum: definido | notificado | confirmado
export type InvitationStatus = 'definido' | 'notificado' | 'confirmado';
export type SquadRole = 'lider' | 'colaborador';
export type InitiativePortfolioStatus =
  | 'en_step_0'
  | 'en_step_1'
  | 'en_step_2'
  | 'en_step_3'
  | 'en_step_4'
  | 'bloqueada'
  | 'esperando_revision'
  | 'lista_para_decision'
  | 'cerrada';
export type InitiativeStep = 'Step 0' | 'Step 1' | 'Step 2' | 'Step 3' | 'Step 4';
export type ChallengeCoverageStatus =
  | 'sin_cobertura'
  | 'cobertura_parcial'
  | 'cobertura_suficiente'
  | 'resuelto'
  | 'reformular'
  | 'cerrar';
export type InitiativeContributionType =
  | 'descubrir'
  | 'validar'
  | 'resolver_parcialmente'
  | 'resolver_directamente';
export type EstimatedContribution = 'bajo' | 'medio' | 'alto';
export type InitiativeOverlapLevel = 'bajo' | 'medio' | 'alto';
export type PortfolioDecisionOutcome =
  | 'pasar_a_segunda_fase'
  | 'iterar_desde_otro_angulo'
  | 'transferir_a_ti'
  | 'transferir_al_area_afectada'
  | 'evaluar_innovacion_abierta'
  | 'escalar_piloto'
  | 'cerrar_con_aprendizaje';
export type InitiativeStepProgressState = 'completado' | 'en_progreso' | 'pendiente' | 'bloqueado';
export type ExecutiveOutputStatus =
  | 'borrador_ejecutivo'
  | 'listo_para_compartir'
  | 'compartido_con_sponsor'
  | 'compartido_con_gerencia'
  | 'decision_recibida'
  | 'aprobado'
  | 'aprobado_con_ajustes'
  | 'rechazado'
  | 'transferido'
  | 'escalado_a_segunda_fase'
  | 'cerrado';

export interface StrategicFront {
  id: string;
  name: string;
  strategicObjective: string;
  whyNow: string;
  mainKpi: string;
  baseline: string;
  target: string;
  horizon: string;
  sponsor: string;
  priority: StrategicFrontPriority;
  status: StrategicFrontStatus;
  createdAt: string;
  challengeCount: number;
  initiativeCount: number;
}

export interface CreateStrategicFrontInput {
  name: string;
  strategicObjective: string;
  whyNow: string;
  mainKpi: string;
  baseline: string;
  target: string;
  horizon: string;
  sponsor: string;
  priority: StrategicFrontPriority;
  status: StrategicFrontStatus;
}

export interface ChallengeInvitation {
  id: string;
  value: string;
  status: InvitationStatus;
}

export interface SquadMember {
  id: string;
  value: string;
  role: SquadRole;
}

export interface Challenge {
  id: string;
  name: string;
  strategicFrontId: string;
  challengeType: ChallengeType | '';
  whatWeWantToMove: string;
  objective: string;
  whyNow: string;
  successCriteria: string;
  challengeOwner: string;
  activationMode: ChallengeActivationMode;
  status: ChallengeStatus;
  createdAt: string;
  challengeOwnerStatus: StakeholderStatus;
  sponsorStatus: StakeholderStatus;
  openCallStatus: 'inactiva' | 'activa';
  selectedPeople: ChallengeInvitation[];
  assignedSquad: SquadMember[];
  initiativeCount: number;
  coverageStatus: ChallengeCoverageStatus;
  visibleToParticipants: boolean;
  publicationNotes: string;
  lastPublishedAt?: string;
}

export interface Initiative {
  id: string;
  name: string;
  strategicFrontId: string;
  challengeId: string;
  teamOwner: string;
  currentStep: InitiativeStep;
  status: InitiativePortfolioStatus;
  mentor: string;
  sponsorTouchpoint: string;
  mainAlert: string;
  nextActionRecommended: string;
  attackedArea: string;
  hypothesisCovered: string;
  mainMetric: string;
  contributionType: InitiativeContributionType;
  estimatedContribution: EstimatedContribution;
  lastActivity: string;
  signalSummary: string;
  mainBlocker: string;
  teamLabel: string;
  requiresSponsor: boolean;
  readyForDecision: boolean;
  blockedDays: number;
  requiresExternalCapability: boolean;
  partialSignal: boolean;
  resolvedCorePart: boolean;
  teamMembers: string[];
  executiveSummary: string;
  experimentSummary: string;
  deliverables: Array<{ id: string; title: string; type: 'Resumen' | 'PDF' | 'Deck' | 'Video' | 'Link'; note: string }>;
  aiCommentSummary: string;
  mentorCommentSummary: string;
  decisionRecommendationReason: string;
  stepsTimeline: Array<{ step: InitiativeStep; state: InitiativeStepProgressState; note: string }>;
}

export interface InitiativeOverlap {
  id: string;
  challengeId: string;
  initiativeAId: string;
  initiativeBId: string;
  level: InitiativeOverlapLevel;
  rationale: string;
  recommendation: 'seguir' | 'fusionar' | 'reformular_una' | 'dejar_como_backup' | 'cerrar_una';
}

export interface PortfolioDecisionItem {
  id: string;
  challengeId: string;
  initiativeId: string;
  recommendation: PortfolioDecisionOutcome;
  summary: string;
  successReading: string;
  reviewReason: string;
}

export interface ExecutiveOutput {
  id: string;
  challengeId: string;
  initiativeId: string;
  recommendation: PortfolioDecisionOutcome;
  status: ExecutiveOutputStatus;
  whyNow: string;
  kpiToMove: string;
  approachSummary: string;
  scopeSummary: string;
  evidenceSummary: string;
  keyDeliverableSummary: string;
  cautionSummary: string;
  recommendationWhy: string;
  secondaryOptions: string;
  managementNeeds: string[];
  nextStepSummary: string;
  nextStepOwner: string;
  nextStepHorizon: string;
  nextStepExpectedResult: string;
  timeline: Array<{ label: string; note: string }>;
}

export interface CreateChallengeInput {
  name: string;
  strategicFrontId: string;
  challengeType: ChallengeType | '';
  whatWeWantToMove: string;
  objective: string;
  whyNow: string;
  successCriteria: string;
  challengeOwner: string;
  activationMode: ChallengeActivationMode;
  status: 'draft';
}

interface PortfolioLeadContextType {
  strategicFronts: StrategicFront[];
  challenges: Challenge[];
  initiatives: Initiative[];
  initiativeOverlaps: InitiativeOverlap[];
  portfolioDecisions: PortfolioDecisionItem[];
  executiveOutputs: ExecutiveOutput[];
  loading: boolean;
  error: string | null;
  createStrategicFront: (input: CreateStrategicFrontInput) => Promise<StrategicFront>;
  updateStrategicFront: (frontId: string, input: CreateStrategicFrontInput) => Promise<void>;
  updateStrategicFrontStatus: (frontId: string, status: StrategicFrontStatus) => Promise<void>;
  createChallenge: (input: CreateChallengeInput) => Promise<Challenge>;
  updateChallengeActivationMode: (challengeId: string, mode: ChallengeActivationMode) => Promise<void>;
  updateChallengeStakeholderStatus: (
    challengeId: string,
    stakeholder: 'challengeOwnerStatus' | 'sponsorStatus',
    status: StakeholderStatus,
  ) => Promise<void>;
  activateOpenCall: (challengeId: string) => Promise<void>;
  addSelectedPerson: (challengeId: string, value: string) => Promise<void>;
  updateSelectedPersonStatus: (challengeId: string, invitationId: string, status: InvitationStatus) => Promise<void>;
  addSquadMember: (challengeId: string, value: string, role: SquadRole) => Promise<void>;
  updateSquadMemberRole: (challengeId: string, memberId: string, role: SquadRole) => Promise<void>;
  confirmAssignedSquad: (challengeId: string) => Promise<void>;
  publishChallenge: (challengeId: string) => Promise<void>;
  loadChallengeCoverageDemo: (challengeId: string) => void;
  createExecutiveOutput: (initiativeId: string, recommendation: PortfolioDecisionOutcome) => Promise<ExecutiveOutput | null>;
  updateExecutiveOutputStatus: (outputId: string, status: ExecutiveOutputStatus) => Promise<void>;
}

const DEFAULT_STRATEGIC_FRONTS: StrategicFront[] = [
  {
    id: 'front-ops',
    name: 'Excelencia operativa',
    strategicObjective: 'Reducir friccion critica en procesos internos con impacto visible en productividad.',
    whyNow: 'El costo de la friccion ya se ve en tiempos, retrabajo y carga de supervision. Conviene intervenir antes de que escale.',
    mainKpi: 'Tiempo de ciclo operativo',
    baseline: '12 dias',
    target: '6 dias',
    horizon: 'Q3 2026',
    sponsor: 'Roberto Jimenez',
    priority: 'Alta',
    status: 'active',
    createdAt: '2026-04-02',
    challengeCount: 2,
    initiativeCount: 3,
  },
  {
    id: 'front-growth',
    name: 'Crecimiento digital',
    strategicObjective: 'Abrir nuevas oportunidades de adopcion y conversion en canales digitales.',
    whyNow: 'El canal digital ya muestra oportunidad de mejora y dejarlo quieto implicaria perder conversion y aprendizaje comercial.',
    mainKpi: 'Conversion digital',
    baseline: '2.1%',
    target: '3.8%',
    horizon: 'Q4 2026',
    sponsor: 'Laura Perez',
    priority: 'Media',
    status: 'active',
    createdAt: '2026-04-03',
    challengeCount: 1,
    initiativeCount: 1,
  },
];

const DEFAULT_CHALLENGES: Challenge[] = [
  {
    id: 'challenge-open',
    name: 'Reducir friccion en onboarding interno',
    strategicFrontId: 'front-ops',
    challengeType: 'correccion',
    whatWeWantToMove: 'Reducir tiempos muertos y retrabajo durante las primeras dos semanas de onboarding.',
    objective: 'Aterrizar una solucion accionable para reducir friccion critica en onboarding sin depender de una redefinicion amplia del proceso.',
    whyNow: 'El cuello de botella ya afecta productividad, experiencia del colaborador y tiempo de supervisores.',
    successCriteria: 'Bajar de 12 a 6 dias el tiempo de habilitacion completa.',
    challengeOwner: 'Lider de Talento',
    activationMode: 'convocatoria_abierta',
    status: 'recibiendo_iniciativas',
    createdAt: '2026-04-02',
    challengeOwnerStatus: 'confirmado',
    sponsorStatus: 'confirmado',
    openCallStatus: 'activa',
    selectedPeople: [],
    assignedSquad: [],
    initiativeCount: 3,
    coverageStatus: 'cobertura_parcial',
    visibleToParticipants: true,
    publicationNotes: 'Ya esta visible para participantes del programa.',
    lastPublishedAt: '2026-04-05',
  },
  {
    id: 'challenge-invite',
    name: 'Mejorar adopcion de tableros comerciales',
    strategicFrontId: 'front-growth',
    challengeType: 'crecimiento',
    whatWeWantToMove: 'Aumentar uso recurrente del tablero comercial por parte de jefaturas regionales.',
    objective: 'Abrir una via accionable para aumentar adopcion y convertir mejor el uso del tablero en decisiones comerciales sostenidas.',
    whyNow: 'Hay decisiones semanales sin respaldo oportuno porque la adopcion sigue baja.',
    successCriteria: 'Subir uso semanal recurrente del 32% al 60%.',
    challengeOwner: 'Head Comercial',
    activationMode: 'personas_seleccionadas',
    status: 'publicado',
    createdAt: '2026-04-04',
    challengeOwnerStatus: 'confirmado',
    sponsorStatus: 'notificado',
    openCallStatus: 'inactiva',
    selectedPeople: [
      { id: 'invite-1', value: 'participante@starteria.io', status: 'notificado' },
      { id: 'invite-2', value: 'sofia@empresa.com', status: 'confirmado' },
    ],
    assignedSquad: [],
    initiativeCount: 1,
    coverageStatus: 'sin_cobertura',
    visibleToParticipants: true,
    publicationNotes: 'Visible solo para las personas invitadas.',
    lastPublishedAt: '2026-04-07',
  },
  {
    id: 'challenge-squad',
    name: 'Eliminar reprocesos en cierres de atencion',
    strategicFrontId: 'front-ops',
    challengeType: 'correccion',
    whatWeWantToMove: 'Reducir errores y reprocesos en el cierre operativo semanal.',
    objective: 'Corregir un punto de falla operativo que ya tiene costo visible y necesita una ruta concreta de activacion.',
    whyNow: 'El costo del retrabajo crecio y el squad ya esta definido, pero aun no se publica hacia participantes.',
    successCriteria: 'Reducir retrabajo semanal en 30%.',
    challengeOwner: 'Gerencia de Servicio',
    activationMode: 'squad_asignado',
    status: 'activo_interno',
    createdAt: '2026-04-08',
    challengeOwnerStatus: 'confirmado',
    sponsorStatus: 'definido',
    openCallStatus: 'inactiva',
    selectedPeople: [],
    assignedSquad: [
      { id: 'squad-1', value: 'Ana Rodriguez', role: 'lider' },
      { id: 'squad-2', value: 'Miguel Torres', role: 'colaborador' },
    ],
    initiativeCount: 0,
    coverageStatus: 'sin_cobertura',
    visibleToParticipants: false,
    publicationNotes: 'Todavia no esta visible fuera del Portfolio Lead.',
  },
];

const DEFAULT_INITIATIVES: Initiative[] = [
  {
    id: 'initiative-a',
    name: 'Piloto de onboarding guiado',
    strategicFrontId: 'front-ops',
    challengeId: 'challenge-open',
    teamOwner: 'Ana Rodriguez',
    currentStep: 'Step 4',
    status: 'lista_para_decision',
    mentor: 'Carlos Mendez',
    sponsorTouchpoint: 'Revision final agendada con sponsor',
    mainAlert: 'Necesita decision de salida y capacidad para escalar.',
    nextActionRecommended: 'Llevarla a decisiones con foco en segunda fase o piloto ampliado.',
    attackedArea: 'Friccion inicial de accesos y habilitacion',
    hypothesisCovered: 'Si se guia al colaborador y al aprobador desde el dia 1, baja el tiempo de espera.',
    mainMetric: 'Tiempo de habilitacion completa',
    contributionType: 'resolver_parcialmente',
    estimatedContribution: 'alto',
    lastActivity: 'Hoy, revision de evidencia de Step 4',
    signalSummary: 'Redujo 34% del tiempo en el piloto y mejoro claridad para managers.',
    mainBlocker: 'Falta definir capacidad de implementacion y alcance siguiente.',
    teamLabel: 'Squad onboarding',
    requiresSponsor: true,
    readyForDecision: true,
    blockedDays: 0,
    requiresExternalCapability: false,
    partialSignal: false,
    resolvedCorePart: true,
    teamMembers: ['Ana Rodriguez', 'Miguel Torres', 'Roberto Jimenez'],
    executiveSummary: 'El equipo completo el piloto de onboarding guiado y ya demostro una reduccion visible del tiempo de habilitacion.',
    experimentSummary: 'Se corrio un piloto con 12 ingresos nuevos. La secuencia guiada redujo esperas, aclaro tareas criticas y bajo retrabajo del lider.',
    deliverables: [
      { id: 'deliv-a1', title: 'Resumen ejecutivo del piloto', type: 'Resumen', note: 'Sintesis de resultados, aprendizajes y siguiente paso sugerido.' },
      { id: 'deliv-a2', title: 'Deck de evidencia de Step 4', type: 'Deck', note: 'Slides con metricas, hallazgos y lectura de implementacion.' },
      { id: 'deliv-a3', title: 'Mapa de flujo ajustado', type: 'PDF', note: 'Documento comparativo antes vs despues del piloto.' },
    ],
    aiCommentSummary: 'La IA considera que la evidencia ya sostiene una salida clara y que el riesgo principal es de capacidad de implementacion, no de valor.',
    mentorCommentSummary: 'El mentor valida que el equipo resolvio la friccion principal y recomienda pasar a una fase controlada de escalamiento.',
    decisionRecommendationReason: 'Llega a decisiones porque esta en Step 4, tiene evidencia suficiente y ya resolvio una parte clara del reto.',
    stepsTimeline: [
      { step: 'Step 0', state: 'completado', note: 'Quedo claro el cuello de botella y el alcance inicial del reto.' },
      { step: 'Step 1', state: 'completado', note: 'El equipo confirmo la friccion principal con evidencia de usuarios y proceso.' },
      { step: 'Step 2', state: 'completado', note: 'Se priorizo una solucion guiada con criterio de impacto y viabilidad.' },
      { step: 'Step 3', state: 'completado', note: 'El piloto corrio con usuarios reales y registro mejora de tiempo.' },
      { step: 'Step 4', state: 'completado', note: 'La evidencia ya esta empaquetada para decidir escalamiento.' },
    ],
  },
  {
    id: 'initiative-b',
    name: 'Checklist inteligente para lideres',
    strategicFrontId: 'front-ops',
    challengeId: 'challenge-open',
    teamOwner: 'Miguel Torres',
    currentStep: 'Step 2',
    status: 'bloqueada',
    mentor: '',
    sponsorTouchpoint: '',
    mainAlert: 'Sigue bloqueada por falta de soporte tecnico para integrarse al sistema actual.',
    nextActionRecommended: 'Revisar si conviene transferir a TI o abrir camino de innovacion abierta.',
    attackedArea: 'Seguimiento de tareas del lider',
    hypothesisCovered: 'Un checklist dinamico reduce olvidos y retrabajo.',
    mainMetric: 'Cumplimiento de tareas de onboarding',
    contributionType: 'validar',
    estimatedContribution: 'medio',
    lastActivity: 'Hace 18 dias, ultimo ajuste de tarjeta de experimento',
    signalSummary: 'Hay interes, pero no se pudo validar por falta de integracion disponible.',
    mainBlocker: 'No hay capacidad tecnica interna asignada.',
    teamLabel: 'Equipo de operaciones',
    requiresSponsor: false,
    readyForDecision: false,
    blockedDays: 18,
    requiresExternalCapability: true,
    partialSignal: true,
    resolvedCorePart: false,
    teamMembers: ['Miguel Torres', 'Claudia Ruiz'],
    executiveSummary: 'La propuesta tiene sentido operativo, pero el equipo no pudo ejecutarla por falta de capacidad tecnica para integracion.',
    experimentSummary: 'Se definio una prueba de checklist inteligente, pero no pudo pasar de prototipo porque depende de integracion con sistemas internos.',
    deliverables: [
      { id: 'deliv-b1', title: 'Tarjeta de experimento bloqueada', type: 'Resumen', note: 'Resume hipotesis, alcance y razon del bloqueo actual.' },
      { id: 'deliv-b2', title: 'Prototipo funcional de flujo', type: 'Link', note: 'Mock del checklist y del comportamiento esperado.' },
    ],
    aiCommentSummary: 'La IA detecta valor potencial, pero recomienda no seguir iterando sin resolver primero la dependencia tecnica.',
    mentorCommentSummary: 'El mentor sugiere decidir pronto si esto pasa a TI o se reformula desde una solucion menos dependiente.',
    decisionRecommendationReason: 'Entra a decisiones porque esta bloqueada hace mas de 14 dias y requiere un destrabe externo.',
    stepsTimeline: [
      { step: 'Step 0', state: 'completado', note: 'El equipo definio la friccion del lider y la necesidad de seguimiento.' },
      { step: 'Step 1', state: 'completado', note: 'La validacion inicial confirmo que el olvido de tareas genera retrabajo.' },
      { step: 'Step 2', state: 'bloqueado', note: 'La solucion requiere integracion y eso freno el experimento.' },
      { step: 'Step 3', state: 'pendiente', note: 'No se ejecuto piloto por falta de soporte tecnico.' },
      { step: 'Step 4', state: 'pendiente', note: 'Todavia no hay caso para cierre ejecutivo.' },
    ],
  },
  {
    id: 'initiative-c',
    name: 'Segmentacion por tipo de ingreso',
    strategicFrontId: 'front-ops',
    challengeId: 'challenge-open',
    teamOwner: 'Celula de Talento',
    currentStep: 'Step 1',
    status: 'esperando_revision',
    mentor: 'Mentor de descubrimiento',
    sponsorTouchpoint: 'Revision de enfoque la proxima semana',
    mainAlert: 'Aun falta validar si el problema cambia segun tipo de ingreso.',
    nextActionRecommended: 'Profundizar evidencia y decidir si se fusiona con la iniciativa principal.',
    attackedArea: 'Causa secundaria del reto',
    hypothesisCovered: 'No todos los ingresos sufren la misma friccion.',
    mainMetric: 'Tiempo por tipo de colaborador',
    contributionType: 'descubrir',
    estimatedContribution: 'bajo',
    lastActivity: 'Ayer, carga de entrevistas',
    signalSummary: 'Aparece una senal parcial, pero aun no cambia la ruta principal.',
    mainBlocker: 'Falta evidencia suficiente en perfiles criticos.',
    teamLabel: 'Celula de descubrimiento',
    requiresSponsor: false,
    readyForDecision: false,
    blockedDays: 0,
    requiresExternalCapability: false,
    partialSignal: true,
    resolvedCorePart: false,
    teamMembers: ['Celula de Talento', 'Mentor de descubrimiento'],
    executiveSummary: 'La iniciativa sigue abierta como exploracion complementaria y aun necesita evidencia para justificar si continua o se fusiona.',
    experimentSummary: 'El equipo viene recogiendo entrevistas y patrones por tipo de ingreso para validar si existe una segunda causa del problema.',
    deliverables: [
      { id: 'deliv-c1', title: 'Resumen de entrevistas', type: 'PDF', note: 'Hallazgos preliminares por perfil de colaborador.' },
      { id: 'deliv-c2', title: 'Matriz de patrones', type: 'Resumen', note: 'Sintesis de diferencias entre tipos de ingreso.' },
    ],
    aiCommentSummary: 'La IA ve una senal interesante, pero aun no suficiente para abrir una decision de salida.',
    mentorCommentSummary: 'El mentor recomienda terminar de contrastar perfiles criticos antes de fusionar o cerrar.',
    decisionRecommendationReason: 'Se mantiene en seguimiento porque aun esta esperando revision y no tiene evidencia suficiente para una decision ejecutiva.',
    stepsTimeline: [
      { step: 'Step 0', state: 'completado', note: 'Se definio la hipotesis sobre una causa secundaria del reto.' },
      { step: 'Step 1', state: 'en_progreso', note: 'Sigue abierta la validacion con perfiles criticos.' },
      { step: 'Step 2', state: 'pendiente', note: 'Todavia no conviene bajar a solucion.' },
      { step: 'Step 3', state: 'pendiente', note: 'No aplica hasta cerrar la validacion.' },
      { step: 'Step 4', state: 'pendiente', note: 'Sin evidencia suficiente para decision.' },
    ],
  },
  {
    id: 'initiative-d',
    name: 'Ruta de adopcion por region',
    strategicFrontId: 'front-growth',
    challengeId: 'challenge-invite',
    teamOwner: 'Sofia Vargas',
    currentStep: 'Step 3',
    status: 'en_step_3',
    mentor: 'Mentor comercial',
    sponsorTouchpoint: 'Seguimiento quincenal con Head Comercial',
    mainAlert: 'La prueba va bien, pero aun no queda claro si escala a todas las regiones.',
    nextActionRecommended: 'Cerrar piloto y preparar evidencia para evaluar segunda fase.',
    attackedArea: 'Uso recurrente de tableros por jefaturas',
    hypothesisCovered: 'Una ruta simple por region mejora adopcion en managers.',
    mainMetric: 'Uso semanal recurrente',
    contributionType: 'resolver_parcialmente',
    estimatedContribution: 'medio',
    lastActivity: 'Hoy, nueva medicion de adopcion',
    signalSummary: 'Subio 14 puntos en dos regiones piloto.',
    mainBlocker: 'Falta definir soporte para regiones restantes.',
    teamLabel: 'Equipo comercial regional',
    requiresSponsor: true,
    readyForDecision: false,
    blockedDays: 0,
    requiresExternalCapability: false,
    partialSignal: true,
    resolvedCorePart: true,
    teamMembers: ['Sofia Vargas', 'Equipo comercial regional'],
    executiveSummary: 'La iniciativa muestra una mejora parcial en adopcion y necesita cerrar el piloto para decidir si entra a segunda fase.',
    experimentSummary: 'Se testeo una ruta de adopcion por region en dos equipos. La mejora es visible, pero la cobertura aun es parcial.',
    deliverables: [
      { id: 'deliv-d1', title: 'Tablero de adopcion piloto', type: 'Link', note: 'Metricas de uso por region durante la prueba.' },
      { id: 'deliv-d2', title: 'Resumen de aprendizajes', type: 'Resumen', note: 'Lo que funciono, lo que no y condiciones para escalar.' },
    ],
    aiCommentSummary: 'La IA recomienda cerrar mejor la evidencia comparativa antes de llevarla a una decision de escalamiento.',
    mentorCommentSummary: 'El mentor ve avance real y sugiere ordenar mejor los entregables para siguiente comite.',
    decisionRecommendationReason: 'Se mantiene en seguimiento porque aun esta en progreso, aunque ya tiene senales que podrian llevarla a decision pronto.',
    stepsTimeline: [
      { step: 'Step 0', state: 'completado', note: 'El problema de adopcion fue definido con claridad por region.' },
      { step: 'Step 1', state: 'completado', note: 'Se confirmo la friccion principal en managers regionales.' },
      { step: 'Step 2', state: 'completado', note: 'Se eligio una ruta de adopcion simple y medible.' },
      { step: 'Step 3', state: 'en_progreso', note: 'El piloto sigue abierto en dos regiones y falta cerrar lectura final.' },
      { step: 'Step 4', state: 'pendiente', note: 'Aun no esta lista la narrativa ejecutiva final.' },
    ],
  },
];

const DEFAULT_INITIATIVE_OVERLAPS: InitiativeOverlap[] = [
  {
    id: 'overlap-1',
    challengeId: 'challenge-open',
    initiativeAId: 'initiative-a',
    initiativeBId: 'initiative-c',
    level: 'medio',
    rationale: 'Ambas iniciativas tocan el mismo flujo de onboarding, pero desde angulos distintos.',
    recommendation: 'seguir',
  },
];

const DEFAULT_PORTFOLIO_DECISIONS: PortfolioDecisionItem[] = [
  {
    id: 'decision-1',
    challengeId: 'challenge-open',
    initiativeId: 'initiative-a',
    recommendation: 'escalar_piloto',
    summary: 'La iniciativa resolvio una parte clara del reto y ya tiene evidencia visible para decidir siguiente fase.',
    successReading: 'El piloto mostro mejora concreta en tiempo y claridad operativa.',
    reviewReason: 'Falta decidir si escala como piloto ampliado o entra a segunda fase formal.',
  },
  {
    id: 'decision-2',
    challengeId: 'challenge-open',
    initiativeId: 'initiative-b',
    recommendation: 'transferir_a_ti',
    summary: 'La iniciativa tiene senal parcial, pero depende de una capacidad tecnica que hoy no esta disponible.',
    successReading: 'La necesidad existe, pero la prueba no pudo ejecutarse con el stack actual.',
    reviewReason: 'La iniciativa lleva mas de dos semanas bloqueada por integracion.',
  },
];

const DEFAULT_EXECUTIVE_OUTPUTS: ExecutiveOutput[] = [
  {
    id: 'exec-initiative-a',
    challengeId: 'challenge-open',
    initiativeId: 'initiative-a',
    recommendation: 'escalar_piloto',
    status: 'listo_para_compartir',
    whyNow: 'El cuello de botella ya afecta productividad y la iniciativa ya demostro una mejora real en piloto.',
    kpiToMove: 'Tiempo de habilitacion completa',
    approachSummary: 'El equipo piloteo una ruta guiada de onboarding con responsables y tareas visibles desde el dia 1.',
    scopeSummary: 'Piloto controlado con 12 ingresos nuevos y seguimiento comparativo contra el flujo anterior.',
    evidenceSummary: 'La iniciativa redujo 34% del tiempo de habilitacion y mejoro claridad para managers.',
    keyDeliverableSummary: 'Deck de evidencia de Step 4 con metricas, aprendizajes y condiciones de escalamiento.',
    cautionSummary: 'La evidencia es fuerte para una siguiente fase controlada, pero aun falta definir capacidad de implementacion.',
    recommendationWhy: 'Se recomienda escalar piloto porque ya resolvio una parte clara del reto y el riesgo principal ya no es de valor sino de despliegue.',
    secondaryOptions: 'Como segunda opcion podria pasar a segunda fase sin escalar aun, pero eso retrasaria una oportunidad ya validada.',
    managementNeeds: ['Prioridad para implementacion', 'Capacidad operativa y tecnica', 'Sponsor para destrabar adopcion'],
    nextStepSummary: 'Escalar el piloto a un grupo mas amplio con seguimiento ejecutivo quincenal.',
    nextStepOwner: 'Ana Rodriguez con apoyo de Operaciones',
    nextStepHorizon: '6 semanas',
    nextStepExpectedResult: 'Validar sostenibilidad del impacto y preparar decision de implementacion ampliada.',
    timeline: [
      { label: 'Decision interna tomada', note: 'Portfolio Lead recomienda escalar piloto.' },
      { label: 'Borrador ejecutivo preparado', note: 'La narrativa ya esta lista para sponsor o gerencia.' },
      { label: 'Siguiente hito', note: 'Compartir con gerencia y pedir prioridad para despliegue controlado.' },
    ],
  },
  {
    id: 'exec-initiative-b',
    challengeId: 'challenge-open',
    initiativeId: 'initiative-b',
    recommendation: 'transferir_a_ti',
    status: 'borrador_ejecutivo',
    whyNow: 'El problema sigue vigente, pero la iniciativa no puede avanzar sin capacidad tecnica.',
    kpiToMove: 'Cumplimiento de tareas de onboarding',
    approachSummary: 'El equipo definio un checklist inteligente y un prototipo operativo para reducir olvidos y retrabajo.',
    scopeSummary: 'Trabajo conceptual y prototipo funcional sin despliegue por dependencia de integracion.',
    evidenceSummary: 'La necesidad esta validada, pero no hubo prueba completa porque falta soporte tecnico.',
    keyDeliverableSummary: 'Tarjeta de experimento bloqueada y mock funcional del flujo esperado.',
    cautionSummary: 'No conviene seguir iterando desde negocio sin destrabar antes la dependencia con TI.',
    recommendationWhy: 'Se recomienda transferir a TI porque el siguiente cuello de botella ya no es de diseño del experimento, sino de capacidad tecnica.',
    secondaryOptions: 'Otra opcion seria reformular hacia una solucion manual de menor alcance, pero perderia parte del valor buscado.',
    managementNeeds: ['Priorizacion tecnica', 'Asignacion de responsable en TI', 'Decision sobre alcance minimo viable'],
    nextStepSummary: 'Definir si TI toma el caso y con que prioridad entra al roadmap.',
    nextStepOwner: 'Portfolio Lead con responsable de TI',
    nextStepHorizon: '2 semanas',
    nextStepExpectedResult: 'Confirmar viabilidad tecnica o bajar el caso a una alternativa de menor dependencia.',
    timeline: [
      { label: 'Decision interna tomada', note: 'Portfolio Lead sugiere transferencia a TI.' },
      { label: 'Borrador ejecutivo en construccion', note: 'Aun falta dejar lista la narrativa para gerencia.' },
      { label: 'Siguiente hito', note: 'Compartir con sponsor o gerencia para destrabar capacidad.' },
    ],
  },
];

const PortfolioLeadContext = createContext<PortfolioLeadContextType | null>(null);

function patchChallenge(
  challenges: Challenge[],
  challengeId: string,
  updater: (challenge: Challenge) => Challenge,
) {
  return challenges.map(challenge => (challenge.id === challengeId ? updater(challenge) : challenge));
}

function challengeIsConfigured(challenge: Challenge) {
  if (challenge.activationMode === 'convocatoria_abierta') return challenge.openCallStatus === 'activa';
  if (challenge.activationMode === 'personas_seleccionadas') return challenge.selectedPeople.length > 0;
  return challenge.assignedSquad.length > 0;
}

function recomputeChallengeStatus(challenge: Challenge, initiatives: Initiative[]) {
  const related = initiatives.filter(item => item.challengeId === challenge.id);
  const ready = related.filter(item => item.readyForDecision).length;
  const active = related.filter(item => !['bloqueada', 'cerrada'].includes(item.status)).length;

  if (challenge.status === 'cerrado') return 'cerrado';
  if (!challenge.visibleToParticipants) return challengeIsConfigured(challenge) ? 'activo_interno' : 'listo_para_activar';
  if (related.length === 0) return 'publicado';
  if (ready > 0) return 'pendiente_de_decision';
  if (active > 0) return 'con_iniciativas_activas';
  return 'recibiendo_iniciativas';
}

function recomputeCoverageStatus(initiatives: Initiative[]): ChallengeCoverageStatus {
  if (initiatives.length === 0) return 'sin_cobertura';
  const ready = initiatives.filter(item => item.readyForDecision).length;
  const resolved = initiatives.filter(item => item.resolvedCorePart).length;
  if (ready > 0 && resolved > 0) return 'cobertura_suficiente';
  return 'cobertura_parcial';
}

function buildDecisionRecommendation(initiative: Initiative): PortfolioDecisionItem {
  if (initiative.status === 'lista_para_decision' || initiative.currentStep === 'Step 4') {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: initiative.resolvedCorePart ? 'escalar_piloto' : 'pasar_a_segunda_fase',
      summary: initiative.resolvedCorePart
        ? 'La iniciativa ya resolvio una parte clara del reto.'
        : 'La iniciativa llego al nivel de madurez suficiente para entrar a segunda fase.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker || 'Conviene definir el siguiente destino.',
    };
  }

  if (initiative.status === 'bloqueada' && initiative.blockedDays >= 14) {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: initiative.requiresExternalCapability ? 'transferir_a_ti' : 'iterar_desde_otro_angulo',
      summary: 'La iniciativa acumula demasiado tiempo bloqueada para seguir igual.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker,
    };
  }

  if (initiative.requiresExternalCapability) {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: 'evaluar_innovacion_abierta',
      summary: 'La solucion necesita una capacidad que hoy no esta disponible internamente.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker,
    };
  }

  if (initiative.partialSignal) {
    return {
      id: `decision-${initiative.id}`,
      challengeId: initiative.challengeId,
      initiativeId: initiative.id,
      recommendation: 'iterar_desde_otro_angulo',
      summary: 'Hay una senal parcial, pero aun no suficiente para escalar con confianza.',
      successReading: initiative.signalSummary,
      reviewReason: initiative.mainBlocker,
    };
  }

  return {
    id: `decision-${initiative.id}`,
    challengeId: initiative.challengeId,
    initiativeId: initiative.id,
    recommendation: 'cerrar_con_aprendizaje',
    summary: 'La lectura actual no justifica seguir invirtiendo energia sin reformular.',
    successReading: initiative.signalSummary,
    reviewReason: initiative.mainBlocker,
  };
}

function syncChallengeSummaries(challenges: Challenge[], initiatives: Initiative[]) {
  return challenges.map(challenge => {
    const related = initiatives.filter(item => item.challengeId === challenge.id);
    return {
      ...challenge,
      initiativeCount: related.length,
      coverageStatus: recomputeCoverageStatus(related),
      status: recomputeChallengeStatus(challenge, initiatives),
    };
  });
}

export function PortfolioLeadProvider({ children }: { children: ReactNode }) {
  // Remote data — loads from the backend on mount.
  // While loading is true, the DEFAULT_* arrays serve as fallback so the UI
  // can render without an empty-state flash.
  const {
    strategicFronts: remoteStrategicFronts,
    setStrategicFronts,
    challenges: remoteChallenges,
    setChallenges,
    initiatives: remoteInitiatives,
    setInitiatives,
    initiativeOverlaps: remoteInitiativeOverlaps,
    setInitiativeOverlaps,
    executiveOutputs: remoteExecutiveOutputs,
    setExecutiveOutputs,
    loading,
    error,
  } = usePortfolioData();

  // During the first load the remote arrays are empty; show defaults instead.
  const strategicFronts = loading && remoteStrategicFronts.length === 0
    ? DEFAULT_STRATEGIC_FRONTS
    : remoteStrategicFronts;
  const challenges = loading && remoteChallenges.length === 0
    ? DEFAULT_CHALLENGES
    : remoteChallenges;
  const initiatives = loading && remoteInitiatives.length === 0
    ? DEFAULT_INITIATIVES
    : remoteInitiatives;
  const initiativeOverlaps = loading && remoteInitiativeOverlaps.length === 0
    ? DEFAULT_INITIATIVE_OVERLAPS
    : remoteInitiativeOverlaps;
  const executiveOutputs = loading && remoteExecutiveOutputs.length === 0
    ? DEFAULT_EXECUTIVE_OUTPUTS
    : remoteExecutiveOutputs;

  // portfolioDecisions is derived/computed locally — it is not persisted as a
  // standalone resource. It is rebuilt whenever initiatives change.
  const [portfolioDecisions, setPortfolioDecisions] = useState<PortfolioDecisionItem[]>(
    DEFAULT_PORTFOLIO_DECISIONS,
  );

  // ── Async mutators ─────────────────────────────────────────────

  const createStrategicFront = useCallback(async (input: CreateStrategicFrontInput): Promise<StrategicFront> => {
    const front = await portfolioService.createStrategicFront(input);
    setStrategicFronts(prev => [front, ...prev]);
    return front;
  }, [setStrategicFronts]);

  const updateStrategicFront = useCallback(async (frontId: string, input: CreateStrategicFrontInput): Promise<void> => {
    await portfolioService.updateStrategicFront(frontId, input);
    setStrategicFronts(prev => prev.map(front => (front.id === frontId ? { ...front, ...input } : front)));
  }, [setStrategicFronts]);

  const updateStrategicFrontStatus = useCallback(async (frontId: string, status: StrategicFrontStatus): Promise<void> => {
    await portfolioService.updateStrategicFront(frontId, { status } as Partial<CreateStrategicFrontInput>);
    setStrategicFronts(prev => prev.map(front => (front.id === frontId ? { ...front, status } : front)));
  }, [setStrategicFronts]);

  const createChallenge = useCallback(async (input: CreateChallengeInput): Promise<Challenge> => {
    const challenge = await portfolioService.createChallenge(input.strategicFrontId, input);
    setChallenges(prev => [challenge, ...prev]);
    setStrategicFronts(prev =>
      prev.map(front =>
        front.id === input.strategicFrontId ? { ...front, challengeCount: front.challengeCount + 1 } : front,
      ),
    );
    return challenge;
  }, [setChallenges, setStrategicFronts]);

  const updateChallengeActivationMode = useCallback(async (challengeId: string, mode: ChallengeActivationMode): Promise<void> => {
    const updated = await portfolioService.updateChallenge(challengeId, { activationMode: mode });
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        activationMode: mode,
        status: updated.status,
      })),
    );
  }, [setChallenges]);

  const updateChallengeStakeholderStatus = useCallback(async (
    challengeId: string,
    stakeholder: 'challengeOwnerStatus' | 'sponsorStatus',
    status: StakeholderStatus,
  ): Promise<void> => {
    const updated = await portfolioService.updateChallenge(challengeId, { [stakeholder]: status });
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        [stakeholder]: status,
        status: updated.status,
      })),
    );
  }, [setChallenges]);

  const activateOpenCall = useCallback(async (challengeId: string): Promise<void> => {
    const updated = await portfolioService.activateOpenCall(challengeId);
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        openCallStatus: updated.openCallStatus,
        status: updated.status,
        publicationNotes: updated.publicationNotes,
      })),
    );
  }, [setChallenges]);

  const addSelectedPerson = useCallback(async (challengeId: string, value: string): Promise<void> => {
    const normalized = value.trim();
    if (!normalized) return;
    const updated = await portfolioService.addInvitation(challengeId, normalized);
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        selectedPeople: updated.selectedPeople,
        status: updated.status,
        publicationNotes: updated.publicationNotes,
      })),
    );
  }, [setChallenges]);

  const updateSelectedPersonStatus = useCallback(async (
    challengeId: string,
    invitationId: string,
    status: InvitationStatus,
  ): Promise<void> => {
    const updated = await portfolioService.updateInvitation(challengeId, invitationId, status);
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        selectedPeople: updated.selectedPeople,
        status: updated.status,
      })),
    );
  }, [setChallenges]);

  const addSquadMember = useCallback(async (challengeId: string, value: string, role: SquadRole): Promise<void> => {
    const normalized = value.trim();
    if (!normalized) return;
    const updated = await portfolioService.addSquadMember(challengeId, normalized, role);
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        assignedSquad: updated.assignedSquad,
        status: updated.status,
        publicationNotes: updated.publicationNotes,
      })),
    );
  }, [setChallenges]);

  const updateSquadMemberRole = useCallback(async (challengeId: string, memberId: string, role: SquadRole): Promise<void> => {
    const updated = await portfolioService.updateSquadMember(challengeId, memberId, role);
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        assignedSquad: updated.assignedSquad,
      })),
    );
  }, [setChallenges]);

  const confirmAssignedSquad = useCallback(async (challengeId: string): Promise<void> => {
    const currentChallenge = challenges.find(c => c.id === challengeId);
    const newStatus = currentChallenge && currentChallenge.assignedSquad.length > 0 ? 'activo_interno' : 'listo_para_activar';
    const newNotes = currentChallenge && currentChallenge.assignedSquad.length > 0
      ? 'El reto ya quedo activado internamente con squad asignado.'
      : currentChallenge?.publicationNotes ?? '';
    await portfolioService.updateChallenge(challengeId, { status: newStatus, publicationNotes: newNotes });
    setChallenges(prev =>
      patchChallenge(prev, challengeId, challenge => ({
        ...challenge,
        status: challenge.assignedSquad.length > 0 ? 'activo_interno' : 'listo_para_activar',
        publicationNotes: challenge.assignedSquad.length > 0
          ? 'El reto ya quedo activado internamente con squad asignado.'
          : challenge.publicationNotes,
      })),
    );
  }, [challenges, setChallenges]);

  const publishChallenge = useCallback(async (challengeId: string): Promise<void> => {
    const updated = await portfolioService.publishChallenge(challengeId);
    setChallenges(prev =>
      syncChallengeSummaries(
        patchChallenge(prev, challengeId, challenge => ({
          ...challenge,
          visibleToParticipants: updated.visibleToParticipants,
          publicationNotes: updated.publicationNotes,
          lastPublishedAt: updated.lastPublishedAt,
          status: updated.status,
        })),
        initiatives,
      ),
    );
  }, [setChallenges, initiatives]);

  const loadChallengeCoverageDemo = useCallback((challengeId: string): void => {
    const challenge = challenges.find(item => item.id === challengeId);
    if (!challenge) return;
    const front = strategicFronts.find(item => item.id === challenge.strategicFrontId);
    if (!front) return;
    const existing = initiatives.some(item => item.challengeId === challengeId);
    if (existing) return;

    const timestamp = Date.now();
    const seeded: Initiative[] = [
      {
        id: `initiative-${timestamp}-a`,
        name: 'Piloto inicial del reto',
        strategicFrontId: front.id,
        challengeId,
        teamOwner: 'Equipo del reto',
        currentStep: 'Step 1',
        status: 'en_step_1',
        mentor: 'Mentor asignado',
        sponsorTouchpoint: 'Revision ejecutiva pendiente',
        mainAlert: 'Todavia falta evidencia para ver si el reto esta bien enfocado.',
        nextActionRecommended: 'Profundizar validacion con usuarios clave.',
        attackedArea: challenge.whatWeWantToMove,
        hypothesisCovered: 'La primera hipotesis del reto ya esta formulada.',
        mainMetric: challenge.successCriteria,
        contributionType: 'validar',
        estimatedContribution: 'medio',
        lastActivity: 'Hoy',
        signalSummary: 'Ya hay una primera lectura, pero todavia es parcial.',
        mainBlocker: 'Falta evidencia con usuarios prioritarios.',
        teamLabel: 'Equipo inicial',
        requiresSponsor: false,
        readyForDecision: false,
        blockedDays: 0,
        requiresExternalCapability: false,
        partialSignal: true,
        resolvedCorePart: false,
        teamMembers: ['Equipo inicial'],
        executiveSummary: 'Primer esfuerzo para entender si el reto esta bien enfocado.',
        experimentSummary: 'La iniciativa abre una primera validacion del reto con usuarios clave y evidencia basica.',
        deliverables: [
          { id: `deliverable-${timestamp}-a`, title: 'Resumen de hipotesis inicial', type: 'Resumen', note: 'Documento base para leer el avance temprano.' },
        ],
        aiCommentSummary: 'La IA sugiere ampliar evidencia antes de tomar decisiones.',
        mentorCommentSummary: 'El mentor recomienda seguir validando con usuarios clave.',
        decisionRecommendationReason: 'Por ahora sigue en seguimiento porque aun esta en una fase temprana.',
        stepsTimeline: [
          { step: 'Step 0', state: 'completado', note: 'Se ordeno el punto de partida del reto.' },
          { step: 'Step 1', state: 'en_progreso', note: 'Sigue abierta la validacion inicial.' },
          { step: 'Step 2', state: 'pendiente', note: 'Todavia no conviene bajar a solucion.' },
          { step: 'Step 3', state: 'pendiente', note: 'Sin experimento todavia.' },
          { step: 'Step 4', state: 'pendiente', note: 'Sin cierre ejecutivo todavia.' },
        ],
      },
    ];

    const updatedInitiatives = [...seeded, ...initiatives];
    setInitiatives(updatedInitiatives);
    setPortfolioDecisions(prev => [...seeded.map(buildDecisionRecommendation), ...prev]);
    setChallenges(prev => syncChallengeSummaries(prev, updatedInitiatives));
    setStrategicFronts(prev =>
      prev.map(current =>
        current.id === front.id ? { ...current, initiativeCount: current.initiativeCount + seeded.length } : current,
      ),
    );
    setInitiativeOverlaps(prev => [...prev]);
  }, [challenges, initiatives, strategicFronts, setChallenges, setInitiatives, setInitiativeOverlaps, setStrategicFronts]);

  const createExecutiveOutput = useCallback(async (
    initiativeId: string,
    recommendation: PortfolioDecisionOutcome,
  ): Promise<ExecutiveOutput | null> => {
    const existing = executiveOutputs.find(item => item.initiativeId === initiativeId);
    if (existing) return existing;

    const initiative = initiatives.find(item => item.id === initiativeId);
    if (!initiative) return null;
    const challenge = challenges.find(item => item.id === initiative.challengeId);
    if (!challenge) return null;

    // Build the payload mirroring the local computation so the backend has
    // all fields even if it does not derive them itself.
    const payload: Partial<ExecutiveOutput> & { projectId: string; recommendation: PortfolioDecisionOutcome } = {
      projectId: initiative.id,
      recommendation,
      status: 'borrador_ejecutivo',
      whyNow: challenge.whyNow,
      kpiToMove: initiative.mainMetric || challenge.successCriteria,
      approachSummary: initiative.executiveSummary,
      scopeSummary: initiative.experimentSummary,
      evidenceSummary: initiative.signalSummary,
      keyDeliverableSummary: initiative.deliverables[0]?.title ?? 'Sin entregable clave visible',
      cautionSummary: initiative.mainBlocker || 'No hay cautela principal visible',
      recommendationWhy: initiative.decisionRecommendationReason,
      secondaryOptions: 'Las alternativas siguen disponibles como opcion secundaria si cambia la prioridad ejecutiva.',
      managementNeeds: initiative.requiresExternalCapability
        ? ['Prioridad tecnica', 'Responsable de destrabe', 'Decision de transferencia']
        : initiative.requiresSponsor
          ? ['Sponsor activo', 'Prioridad de implementacion', 'Aprobacion de siguiente fase']
          : ['Aprobacion', 'Priorizacion', 'Recursos minimos para siguiente paso'],
      nextStepSummary: initiative.nextActionRecommended,
      nextStepOwner: initiative.teamOwner,
      nextStepHorizon: initiative.readyForDecision ? '4 a 6 semanas' : '2 a 4 semanas',
      nextStepExpectedResult: initiative.readyForDecision
        ? 'Convertir la validacion actual en una siguiente fase con alcance claro.'
        : 'Destrabar la iniciativa o confirmar si conviene reformularla.',
      timeline: [
        { label: 'Decision interna tomada', note: portfolioDecisions.find(item => item.initiativeId === initiativeId)?.summary ?? 'Ya existe una recomendacion interna visible.' },
        { label: 'Borrador ejecutivo creado', note: 'Starteria traduce la evidencia a lenguaje gerencial.' },
        { label: 'Siguiente hito', note: 'Dejar la propuesta lista para sponsor o gerencia.' },
      ],
    };

    const created = await portfolioService.createExecutiveOutput(challenge.id, payload);
    setExecutiveOutputs(prev => [created, ...prev]);
    return created;
  }, [challenges, executiveOutputs, initiatives, portfolioDecisions, setExecutiveOutputs]);

  const updateExecutiveOutputStatus = useCallback(async (outputId: string, status: ExecutiveOutputStatus): Promise<void> => {
    await portfolioService.updateExecutiveOutput(outputId, { status });
    setExecutiveOutputs(prev =>
      prev.map(item =>
        item.id === outputId
          ? {
              ...item,
              status,
              timeline: [
                ...item.timeline.slice(0, 2),
                { label: `Estado actual: ${status.replaceAll('_', ' ')}`, note: 'La salida ejecutiva ya registro un nuevo hito post-decision.' },
              ],
            }
          : item,
      ),
    );
  }, [setExecutiveOutputs]);

  const value = useMemo<PortfolioLeadContextType>(() => ({
    strategicFronts,
    challenges,
    initiatives,
    initiativeOverlaps,
    portfolioDecisions,
    executiveOutputs,
    loading,
    error,
    createStrategicFront,
    updateStrategicFront,
    updateStrategicFrontStatus,
    createChallenge,
    updateChallengeActivationMode,
    updateChallengeStakeholderStatus,
    activateOpenCall,
    addSelectedPerson,
    updateSelectedPersonStatus,
    addSquadMember,
    updateSquadMemberRole,
    confirmAssignedSquad,
    publishChallenge,
    loadChallengeCoverageDemo,
    createExecutiveOutput,
    updateExecutiveOutputStatus,
  }), [
    strategicFronts,
    challenges,
    initiatives,
    initiativeOverlaps,
    portfolioDecisions,
    executiveOutputs,
    loading,
    error,
    createStrategicFront,
    updateStrategicFront,
    updateStrategicFrontStatus,
    createChallenge,
    updateChallengeActivationMode,
    updateChallengeStakeholderStatus,
    activateOpenCall,
    addSelectedPerson,
    updateSelectedPersonStatus,
    addSquadMember,
    updateSquadMemberRole,
    confirmAssignedSquad,
    publishChallenge,
    loadChallengeCoverageDemo,
    createExecutiveOutput,
    updateExecutiveOutputStatus,
  ]);

  return <PortfolioLeadContext.Provider value={value}>{children}</PortfolioLeadContext.Provider>;
}

export function usePortfolioLead() {
  const context = useContext(PortfolioLeadContext);
  if (!context) throw new Error('usePortfolioLead must be used within PortfolioLeadProvider');
  return context;
}
