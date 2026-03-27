import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronRight, Copy, Download, FileText, Lock, MessageSquare, Plus, Sparkles, Trash2 } from 'lucide-react';
import { EvidenceUploader } from '../EvidenceUploader';
import { StatusChip } from '../StatusChip';
import {
  Step1CaptureAnalysisFieldKey,
  Step1CaptureAnalysisTarget,
  Step1CaptureModuleContext,
  Step1CaptureSynthesisData,
} from '../step1-architecture/step1Architecture.types';
import { buildCaptureAnalysisSignature, buildModuleAnalysis } from './step1CaptureAnalysis';

interface Step1CaptureSynthesisModuleProps {
  context: Step1CaptureModuleContext;
  state: Step1CaptureSynthesisData;
  statusLabel: 'Pendiente' | 'En progreso' | 'Completado' | 'Requiere ajuste';
  missing: string[];
  reviewCtaLabel?: string;
  reviewCtaHint?: string;
  onChange: (updater: (prev: Step1CaptureSynthesisData) => Step1CaptureSynthesisData) => void;
  onOpenIA: () => void;
  onOpenMentor: () => void;
  onOpenReview: () => void;
}

const DECISION_OPTIONS = [
  { value: 'mantener', label: 'Mantener', description: 'La evidencia confirma el problema tal como esta definido.' },
  { value: 'ajustar', label: 'Ajustar', description: 'El problema sigue siendo valido, pero necesita precisiones.' },
  { value: 'reformular', label: 'Reformular', description: 'Lo aprendido cambia la definicion del problema a resolver.' },
] as const;

const buildFollowUpPrompt = (researchObjective: string, frontTitle: string, learningGoal: string) => [
  `Objetivo general de investigacion: ${researchObjective || 'Completar objetivo general de investigacion.'}`,
  `Frente a complementar: ${frontTitle || 'Frente sin titulo'}`,
  `Criterios de investigacion: ${learningGoal || 'Definir que hace falta validar o entender.'}`,
  'Genera una nueva guia de entrevista con 8 preguntas abiertas:',
  '1. 1 pregunta para abrir contexto',
  '2. 6 preguntas principales para validar el frente',
  '3. 1 pregunta de cierre para detectar vacios de informacion',
].join('\n');

const buildQualitativeHints = (frontTitle: string, learningGoal: string) => [
  `Busca ejemplos concretos sobre ${frontTitle || 'este frente'}.`,
  `Confirma o cuestiona si ${learningGoal || 'lo que quieres validar'} realmente esta ocurriendo.`,
  'Registra citas, patrones y algo que te haya sorprendido.',
];

const buildDataHints = () => [
  'Cantidad de casos o frecuencia.',
  'Tiempos, retrasos o diferencias relevantes.',
  'Evidencia que confirme, ajuste o descarte el problema.',
];

const frontAnchorId = (frontId: string) => `capture-front-${frontId}`;
const frontFieldAnchorId = (frontId: string, fieldKey: Step1CaptureAnalysisFieldKey) => `capture-front-${frontId}-${fieldKey}`;

const fieldPromptByType = (frontType: Step1CaptureAnalysisTarget['frontType']) =>
  frontType === 'data'
    ? [
        'Sube un archivo o pega un link en este frente.',
        'Agrega evidencia de frecuencia, tiempos, volumen o diferencias.',
        'Luego vuelve a correr el analisis IA del modulo.',
      ]
    : [
        'Agrega respuestas, notas o citas en este frente.',
        'Refuerza el hallazgo principal o algo que contradiga lo esperado.',
        'Luego vuelve a correr el analisis IA del modulo.',
      ];

const DECISION_LABELS = {
  mantener: 'Mantener',
  ajustar: 'Ajustar / acotar',
  reformular: 'Reformular / pivotear',
} as const;

const buildModuleClosureCard = (context: Step1CaptureModuleContext, state: Step1CaptureSynthesisData) => {
  const interviewCount = state.captures.filter(capture => capture.sourceType === 'perfil' && capture.notes.trim().length > 0).length;
  const documentaryCount = state.evidences.length;
  const frontTitles = context.researchFronts.map(front => front.title).filter(Boolean);
  const evidenceHighlights = state.evidences
    .map(evidence => evidence.insight.trim())
    .filter(Boolean)
    .slice(0, 2);
  const findingHighlights = state.organizedInsights
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 3);
  const criteria = state.aiAnalysis?.criteria || [];
  const decisionLabel = state.finalDecision ? DECISION_LABELS[state.finalDecision] : 'Decision pendiente';
  const decisionRationale = state.finalDecision
    ? state.finalDecision === 'mantener'
      ? 'La evidencia confirma que conviene avanzar con este problema tal como queda delimitado.'
      : state.finalRationale.trim() || state.aiAnalysis?.recommendations[0] || 'La evidencia pide ajustar el foco antes de avanzar.'
    : 'Todavia falta definir la decision final del aprendizaje.';
  const problemDefinition = state.finalDecision === 'reformular'
    ? `La investigacion sugiere reformular el problema inicial. ${state.finalRationale.trim() || 'El foco original cambio a partir de la evidencia reunida.'}`
    : state.finalDecision === 'ajustar'
    ? `El problema queda mas acotado a ${frontTitles.slice(0, 2).join(' y ') || 'los frentes investigados'}. ${state.finalRationale.trim() || 'La evidencia pide precisarlo mejor antes de pasar al siguiente step.'}`
    : state.finalDecision === 'mantener'
    ? `Se mantiene el problema, ahora con una delimitacion mas clara en ${frontTitles.slice(0, 2).join(' y ') || 'los frentes investigados'}.`
    : `La evidencia ya ayuda a delimitar mejor el problema en ${frontTitles.slice(0, 2).join(' y ') || 'los frentes investigados'}, pero la decision final aun no se cierra.`;

  return {
    problemDefinition,
    investigatedFronts: frontTitles,
    evidenceSummary: [
      `${interviewCount} captura(s) cualitativas con notas utiles.`,
      `${documentaryCount} archivo(s) o link(s) documentales cargados.`,
      ...evidenceHighlights,
    ].filter(Boolean),
    findings: findingHighlights.length > 0 ? findingHighlights : ['Todavia falta consolidar hallazgos clave en este cierre.'],
    validation: criteria.map(item => ({
      label: item.label,
      status: item.ok ? 'Cumple' : 'Requiere ajuste',
      detail: item.ok ? item.reason : item.missing,
    })),
    decisionLabel,
    decisionRationale,
  };
};

const buildModuleClosureSummary = (context: Step1CaptureModuleContext, state: Step1CaptureSynthesisData) => {
  const card = buildModuleClosureCard(context, state);

  return [
    `Problema definido al cierre: ${card.problemDefinition}`,
    `Que se investigo: ${card.investigatedFronts.join(', ') || 'Sin frentes definidos'}.`,
    `Evidencia consolidada: ${card.evidenceSummary.join(' ')}`,
    `Hallazgos clave: ${card.findings.join(' ')}`,
    `Validacion del problema: ${card.validation.map(item => `${item.label}: ${item.status}`).join(' | ') || 'Sin validacion disponible'}.`,
    `Decision tomada: ${card.decisionLabel}. ${card.decisionRationale}`,
  ].join('\n\n');
};

const buildCorrectionActions = (criterionLabel: string, isQualitative: boolean) => {
  if (isQualitative) {
    return [
      `Agrega respuestas, notas o citas que ayuden a mejorar "${criterionLabel}".`,
      'Refuerza el hallazgo principal o suma algo que sorprendio y cambie la lectura del frente.',
      'Si el sustento sigue corto, complementa con otra entrevista o una nota adicional.',
    ];
  }

  return [
    `Sube un archivo o link que ayude a reforzar "${criterionLabel}".`,
    'Agrega evidencia de frecuencia, tiempos, volumen, diferencias o tendencia.',
    'Aclara en el insight que muestra esa data y como confirma o cuestiona el problema.',
  ];
};

const downloadModuleSummary = (context: Step1CaptureModuleContext, state: Step1CaptureSynthesisData) => {
  const card = buildModuleClosureCard(context, state);
  const summary = [
    'Resumen del Modulo C - Captura de informacion y sintesis',
    '',
    `Objetivo general de investigacion: ${context.researchObjective || 'Sin definir'}`,
    '',
    'Problema definido al cierre:',
    card.problemDefinition,
    '',
    'Que se investigo:',
    card.investigatedFronts.map(item => `- ${item}`).join('\n') || '- Sin frentes',
    '',
    'Evidencia consolidada:',
    card.evidenceSummary.map(item => `- ${item}`).join('\n') || '- Sin evidencia consolidada',
    '',
    'Hallazgos clave:',
    card.findings.map(item => `- ${item}`).join('\n'),
    '',
    'Validacion del problema:',
    card.validation.map(item => `- ${item.label}: ${item.status}. ${item.detail}`).join('\n') || '- Sin validacion disponible',
    '',
    `Decision tomada: ${card.decisionLabel}`,
    card.decisionRationale,
    '',
    'Sintesis ejecutiva del cierre:',
    state.finalSummary || buildModuleClosureSummary(context, state),
  ].join('\n');

  const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'starteria-step1-modulo-c-resumen.txt';
  anchor.click();
  URL.revokeObjectURL(url);
};

export function Step1CaptureSynthesisModule({
  context,
  state,
  statusLabel,
  missing,
  reviewCtaLabel,
  reviewCtaHint,
  onChange,
  onOpenIA,
  onOpenMentor,
  onOpenReview,
}: Step1CaptureSynthesisModuleProps) {
  const [iaLoading, setIaLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [guidedFrontId, setGuidedFrontId] = useState<string | null>(null);
  const [guidedCriterion, setGuidedCriterion] = useState<string | null>(null);
  const [guidedTarget, setGuidedTarget] = useState<Step1CaptureAnalysisTarget | null>(null);
  const [reinforcedFronts, setReinforcedFronts] = useState<Record<string, boolean>>({});
  const frontBlocks = useMemo(() => context.researchFronts.map(front => ({
    ...front,
    captures: state.captures.filter(capture => capture.frontIds.includes(front.id)),
  })), [context.researchFronts, state.captures]);
  const currentAnalysisSignature = useMemo(() => buildCaptureAnalysisSignature(state), [state]);
  const needsReanalysis = Boolean(state.aiAnalysis && state.aiAnalysis.analyzedSignature !== currentAnalysisSignature);
  const blockingCriteria = state.aiAnalysis?.criteria.filter(item => !item.ok) || [];
  const allCriteriaReady = Boolean(state.aiAnalysis?.criteria.every(item => item.ok) && !needsReanalysis);
  const canDownloadSummary = Boolean(allCriteriaReady && state.finalSummary.trim().length > 0);
  const updatedFrontTitles = context.researchFronts
    .filter(front => reinforcedFronts[front.id])
    .map(front => front.title || 'Frente sin titulo');
  const closureCard = useMemo(() => buildModuleClosureCard(context, state), [context, state]);

  const addInsight = () => onChange(prev => ({ ...prev, organizedInsights: [...prev.organizedInsights, ''] }));

  const markFrontReinforced = (frontId: string) => {
    setReinforcedFronts(prev => ({ ...prev, [frontId]: true }));
  };

  const addEvidenceToCapture = (captureId: string, file: { name: string; type: string; size?: string; url?: string }) => {
    const capture = state.captures.find(item => item.id === captureId);
    if (capture?.frontIds[0]) {
      markFrontReinforced(capture.frontIds[0]);
    }
    onChange(prev => ({
      ...prev,
      evidences: [...prev.evidences, {
        id: `evidence-${Date.now()}-${captureId}`,
        kind: file.url ? 'link' : 'archivo',
        name: file.name,
        insight: '',
        captureRecordId: captureId,
        url: file.url,
      }],
    }));
  };

  const focusGuidedTarget = (criterionLabel: string, target: Step1CaptureAnalysisTarget) => {
    setGuidedFrontId(target.frontId);
    setGuidedCriterion(criterionLabel);
    setGuidedTarget(target);

    const targetElement = document.getElementById(frontFieldAnchorId(target.frontId, target.fieldKey))
      || document.getElementById(frontAnchorId(target.frontId));

    targetElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Modulo C: Captura de informacion y sintesis</h1>
            <StatusChip status={statusLabel} size="sm" />
          </div>
          <p className="text-sm text-slate-500 max-w-3xl">Este modulo te ayuda a capturar evidencia por frente, interpretar lo que encontraste y decidir si el problema se mantiene, se ajusta o se reformula.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onOpenIA} className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
            <Sparkles size={11} /> Mejorar con IA
          </button>
          <button onClick={onOpenMentor} className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
            <MessageSquare size={11} /> Mentor
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 space-y-3">
        <div>
          <p className="text-xs text-violet-700 mb-1" style={{ fontWeight: 700 }}>Objetivo general de investigacion</p>
          <p className="text-base text-violet-900 leading-relaxed" style={{ fontWeight: 600 }}>{context.researchObjective || 'Completa el Modulo B para definir con claridad que se buscaba validar.'}</p>
          <p className="text-sm text-violet-700 mt-2">Usa este objetivo como referencia para capturar evidencia, interpretar hallazgos y decidir si el problema se mantiene o necesita ajuste.</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>1. Captura por frente de investigacion</p>
          <p className="text-xs text-slate-500 mt-1">Cada bloque te ayuda a reunir evidencia cualitativa o cuantitativa segun el tipo de frente.</p>
        </div>
        <div className="p-4 space-y-5">
          {frontBlocks.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600" style={{ fontWeight: 500 }}>Todavia no hay frentes activos para capturar.</p>
              <p className="text-xs text-slate-400 mt-1">Completa primero el Modulo B para traer el objetivo y los frentes que quieres validar.</p>
            </div>
          )}

          {frontBlocks.map(front => {
            const qualitativeCaptures = front.captures.filter(capture => capture.sourceType === 'perfil');
            const dataCaptures = front.captures.filter(capture => capture.sourceType !== 'perfil');
            const blockTone = qualitativeCaptures.length > 0 && dataCaptures.length > 0 ? 'Mixto' : dataCaptures.length > 0 ? 'Data / documental' : 'Cualitativo';
            const isGuidedFront = guidedFrontId === front.id;
            const frontWasReinforced = reinforcedFronts[front.id];
            const frontActions = guidedTarget?.frontId === front.id
              ? fieldPromptByType(guidedTarget.frontType)
              : buildCorrectionActions(guidedCriterion || 'este criterio', qualitativeCaptures.length > 0);
            const highlightedFieldKey = guidedTarget?.frontId === front.id ? guidedTarget.fieldKey : null;

            return (
              <div id={frontAnchorId(front.id)} key={front.id} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                <div className="px-4 py-4 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{front.title || 'Frente sin titulo'}</p>
                    <p className="text-xs text-slate-500 mt-1">{front.learningGoal || 'Sin criterio de investigacion cargado'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {frontWasReinforced && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700" style={{ fontWeight: 600 }}>
                        Actualizado para reanalizar
                      </span>
                    )}
                    <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>{blockTone}</span>
                  </div>
                </div>
                <div className="p-4 space-y-5">
                  {isGuidedFront && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                      <div>
                        <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Correccion guiada en este frente</p>
                        <p className="text-sm text-amber-800 mt-1">Llegaste aqui porque el criterio <span style={{ fontWeight: 700 }}>{guidedCriterion}</span> requiere ajuste y este frente puede ayudarte a reforzarlo.</p>
                        {guidedTarget?.frontId === front.id && (
                          <p className="text-xs text-amber-700 mt-2">
                            <span style={{ fontWeight: 700 }}>Que falta aqui:</span> {guidedTarget.missing}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        {frontActions.map(action => (
                          <div key={action} className="text-xs text-amber-700 flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                            {action}
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-white/70 bg-white/70 p-3">
                        <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Ruta de accion en este frente</p>
                        <ol className="mt-2 space-y-1 text-xs text-amber-700">
                          <li>1. Revisa que falta en {guidedTarget?.fieldLabel?.toLowerCase() || 'este frente'}.</li>
                          <li>2. Agrega o ajusta evidencia aqui mismo.</li>
                          <li>3. Guarda los cambios en este frente.</li>
                          <li>4. Vuelve a correr el analisis IA del modulo.</li>
                        </ol>
                      </div>
                      {guidedTarget?.frontId === front.id && (
                        <div className="rounded-xl border border-amber-200 bg-white p-3">
                          <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Campo sugerido para corregir</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Completa <span style={{ fontWeight: 700 }}>{guidedTarget.fieldLabel.toLowerCase()}</span>. {guidedTarget.action}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {qualitativeCaptures.length > 0 && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 700 }}>Captura cualitativa</p>
                        <p className="text-xs text-slate-500">Sube soporte, pega links, resume respuestas y registra hallazgos o cosas que te sorprendieron.</p>
                      </div>
                      {qualitativeCaptures.map(capture => {
                        const captureEvidences = state.evidences.filter(evidence => evidence.captureRecordId === capture.id);
                        const followUpPrompt = buildFollowUpPrompt(context.researchObjective, front.title, front.learningGoal);
                        return (
                          <div key={capture.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{capture.sourceLabel}</p>
                                <p className="text-xs text-slate-500 mt-1">{capture.sourceDetail || 'Fuente cualitativa'}</p>
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full ${capture.needsFollowUp ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`} style={{ fontWeight: 600 }}>
                                {capture.needsFollowUp ? 'Necesita complemento' : 'En trabajo'}
                              </span>
                            </div>

                            <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                              <p className="text-xs text-violet-700 mb-2" style={{ fontWeight: 600 }}>En este frente busca:</p>
                              <ul className="space-y-1">
                                {buildQualitativeHints(front.title, front.learningGoal).map(item => (
                                  <li key={item} className="text-xs text-violet-700 flex items-start gap-2">
                                    <span className="w-1 h-1 rounded-full bg-violet-400 shrink-0 mt-1.5" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div id={frontFieldAnchorId(front.id, 'evidence')} className={highlightedFieldKey === 'evidence' ? 'rounded-xl ring-2 ring-amber-300 ring-offset-2 ring-offset-indigo-50' : ''}>
                              <EvidenceUploader onUpload={file => addEvidenceToCapture(capture.id, file)} />
                            </div>

                            {captureEvidences.length > 0 && (
                              <div className="space-y-2">
                                {captureEvidences.map(evidence => (
                                  <div key={evidence.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex items-center gap-2">
                                        <FileText size={13} className="text-slate-400" />
                                        <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{evidence.name}</p>
                                      </div>
                                      <button onClick={() => onChange(prev => ({ ...prev, evidences: prev.evidences.filter(item => item.id !== evidence.id) }))} className="text-xs text-slate-400 hover:text-red-600">
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  <div id={frontFieldAnchorId(front.id, 'evidenceInsight')}>
                                    <input value={evidence.insight} onChange={event => { markFrontReinforced(front.id); onChange(prev => ({ ...prev, evidences: prev.evidences.map(item => item.id === evidence.id ? { ...item, insight: event.target.value } : item) })); }} placeholder="Que demuestra este archivo o link" className={`w-full border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${highlightedFieldKey === 'evidenceInsight' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                            <div id={frontFieldAnchorId(front.id, 'notes')}>
                              <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Respuestas, notas o citas relevantes</label>
                              <textarea value={capture.notes} onChange={event => { markFrontReinforced(front.id); onChange(prev => ({ ...prev, captures: prev.captures.map(item => item.id === capture.id ? { ...item, notes: event.target.value, status: 'pendiente' } : item) })); }} rows={3} placeholder="Pega aqui las respuestas, notas o patrones observados en esta entrevista." className={`w-full border rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${highlightedFieldKey === 'notes' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`} />
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div id={frontFieldAnchorId(front.id, 'finding')}>
                                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Hallazgo principal</label>
                                <input value={capture.finding} onChange={event => { markFrontReinforced(front.id); onChange(prev => ({ ...prev, captures: prev.captures.map(item => item.id === capture.id ? { ...item, finding: event.target.value, status: 'pendiente' } : item) })); }} placeholder="Escribe el aprendizaje mas claro que deja esta fuente." className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${highlightedFieldKey === 'finding' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`} />
                              </div>
                              <div id={frontFieldAnchorId(front.id, 'surprises')}>
                                <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Que te sorprendio o merece atencion</label>
                                <input value={capture.surprises} onChange={event => { markFrontReinforced(front.id); onChange(prev => ({ ...prev, captures: prev.captures.map(item => item.id === capture.id ? { ...item, surprises: event.target.value, status: 'pendiente' } : item) })); }} placeholder="Anota algo inesperado, contradictorio o revelador." className={`w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${highlightedFieldKey === 'surprises' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`} />
                              </div>
                            </div>

                            <div id={frontFieldAnchorId(front.id, 'followUp')} className={`rounded-xl border bg-white p-3 space-y-3 ${highlightedFieldKey === 'followUp' ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'}`}>
                              <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Te falta complementar este frente?</p>
                              <div className="flex gap-2">
                                <button onClick={() => { markFrontReinforced(front.id); onChange(prev => ({ ...prev, captures: prev.captures.map(item => item.id === capture.id ? { ...item, needsFollowUp: false } : item) })); }} className={`text-xs px-3 py-1.5 rounded-lg border ${!capture.needsFollowUp ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600'}`} style={{ fontWeight: 500 }}>No, con esto avanzo</button>
                                <button onClick={() => { markFrontReinforced(front.id); onChange(prev => ({ ...prev, captures: prev.captures.map(item => item.id === capture.id ? { ...item, needsFollowUp: true } : item) })); }} className={`text-xs px-3 py-1.5 rounded-lg border ${capture.needsFollowUp ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600'}`} style={{ fontWeight: 500 }}>Si, necesito complementar</button>
                              </div>
                              {capture.needsFollowUp && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                                  <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Prompt corto para crear una nueva guia</p>
                                  <textarea readOnly value={followUpPrompt} rows={7} className="w-full border border-amber-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700 resize-none" />
                                  <button onClick={() => navigator.clipboard.writeText(followUpPrompt)} className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900" style={{ fontWeight: 600 }}><Copy size={11} /> Copiar prompt</button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {dataCaptures.length > 0 && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 700 }}>Captura de data o evidencia documental</p>
                        <p className="text-xs text-slate-500">En estos frentes enfocate en subir archivos o links y dejar claro que evidencia cuantitativa o documental reuniste.</p>
                      </div>
                      {dataCaptures.map(capture => {
                        const captureEvidences = state.evidences.filter(evidence => evidence.captureRecordId === capture.id);
                        return (
                          <div key={capture.id} className="rounded-xl border border-sky-100 bg-sky-50/40 p-4 space-y-4">
                            <div>
                              <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{capture.sourceLabel}</p>
                              <p className="text-xs text-slate-500 mt-1">{capture.sourceDetail || 'Fuente de data o documento'}</p>
                            </div>
                            <div className="rounded-xl border border-sky-100 bg-white p-3">
                              <p className="text-xs text-sky-700 mb-2" style={{ fontWeight: 600 }}>Referencia de la fuente</p>
                              <ul className="space-y-1">
                                {buildDataHints().map(item => (
                                  <li key={item} className="text-xs text-sky-700 flex items-start gap-2">
                                    <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0 mt-1.5" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div id={frontFieldAnchorId(front.id, 'evidence')} className={highlightedFieldKey === 'evidence' ? 'rounded-xl ring-2 ring-amber-300 ring-offset-2 ring-offset-sky-50' : ''}>
                              <EvidenceUploader onUpload={file => addEvidenceToCapture(capture.id, file)} />
                            </div>
                            {captureEvidences.length === 0 && <p className="text-xs text-slate-400">Todavia no hay archivos o links asociados a esta fuente.</p>}
                            <div className="space-y-2">
                              {captureEvidences.map(evidence => (
                                <div key={evidence.id} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <FileText size={13} className="text-slate-400" />
                                      <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>{evidence.name}</p>
                                    </div>
                                    <button onClick={() => onChange(prev => ({ ...prev, evidences: prev.evidences.filter(item => item.id !== evidence.id) }))} className="text-xs text-slate-400 hover:text-red-600">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <div id={frontFieldAnchorId(front.id, 'evidenceInsight')}>
                                    <input value={evidence.insight} onChange={event => { markFrontReinforced(front.id); onChange(prev => ({ ...prev, evidences: prev.evidences.map(item => item.id === evidence.id ? { ...item, insight: event.target.value } : item) })); }} placeholder="Que muestra esta data, archivo o link" className={`w-full border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 ${highlightedFieldKey === 'evidenceInsight' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {front.captures.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm text-slate-600" style={{ fontWeight: 500 }}>Este frente todavia no trae fuentes asociadas desde Modulo B.</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>2. Cierre del modulo</p>
            <p className="text-xs text-slate-500 mt-1">Aqui integras que investigaste, que evidencia reuniste, que sostiene o debilita el problema y que decision tomas.</p>
          </div>
          <button onClick={addInsight} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors" style={{ fontWeight: 500 }}>
            <Plus size={12} /> Agregar insight
          </button>
        </div>
        <div className="p-4 space-y-5">
          <div className="space-y-3">
            {state.organizedInsights.map((insight, index) => (
              <div key={`insight-${index}`} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs shrink-0 mt-1" style={{ fontWeight: 600 }}>{index + 1}</span>
                <div className="flex-1">
                  <textarea value={insight} onChange={event => onChange(prev => ({ ...prev, organizedInsights: prev.organizedInsights.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} rows={2} placeholder="Escribe un hallazgo que sostenga o debilite el problema." className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                </div>
                {state.organizedInsights.length > 2 && (
                  <button onClick={() => onChange(prev => ({ ...prev, organizedInsights: prev.organizedInsights.filter((_, itemIndex) => itemIndex !== index) }))} className="text-xs text-slate-400 hover:text-red-600 transition-colors mt-2">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm text-violet-900" style={{ fontWeight: 600 }}>Analisis IA del modulo</p>
                <p className="text-xs text-violet-700 mt-1">Te ayuda a entender que cumple, que requiere ajuste y en que frente conviene volver a trabajar.</p>
              </div>
              <button
                onClick={() => {
                  setIaLoading(true);
                  setTimeout(() => {
                    setGuidedFrontId(null);
                    setGuidedCriterion(null);
                    setGuidedTarget(null);
                    onChange(prev => ({ ...prev, aiAnalysis: buildModuleAnalysis(context, prev) }));
                    setReinforcedFronts({});
                    setIaLoading(false);
                  }, 1200);
                }}
                className="flex items-center gap-1.5 text-xs text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors"
                style={{ fontWeight: 600 }}
              >
                <Sparkles size={11} /> {iaLoading ? 'Analizando...' : 'Analizar evidencia con IA'}
              </button>
            </div>

            {state.aiAnalysis && blockingCriteria.length > 0 && !needsReanalysis && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Ruta de correccion dentro de este mismo modulo</p>
                <ol className="mt-2 space-y-1 text-xs text-amber-700">
                  <li>1. Revisa el criterio que no cumple.</li>
                  <li>2. Identifica el frente sugerido dentro de la tarjeta.</li>
                  <li>3. Vuelve a ese frente en este mismo modulo y agrega o ajusta evidencia.</li>
                  <li>4. Ejecuta otra vez el analisis IA del modulo.</li>
                </ol>
              </div>
            )}

            {needsReanalysis && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-2">
                <p className="text-xs text-sky-800" style={{ fontWeight: 700 }}>Ya corregiste evidencia. Falta reanalizar.</p>
                <p className="text-sm text-sky-700">El modulo detecto cambios nuevos en {updatedFrontTitles.join(', ') || 'los frentes trabajados'}. Vuelve a ejecutar el analisis IA para validar si esos ajustes ya cierran los vacios pendientes.</p>
              </div>
            )}

            {state.aiAnalysis && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {state.aiAnalysis.criteria.map(item => (
                    <div key={item.key} className={`rounded-xl border px-4 py-4 ${item.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className={`text-sm ${item.ok ? 'text-emerald-900' : 'text-amber-900'}`} style={{ fontWeight: 700 }}>{item.label}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 600 }}>
                          {item.ok ? 'Cumple' : 'Requiere ajuste'}
                        </span>
                      </div>
                      <p className={`text-xs mt-2 ${item.ok ? 'text-emerald-800' : 'text-amber-800'}`}>{item.meaning}</p>
                      <p className={`text-xs mt-2 ${item.ok ? 'text-emerald-700' : 'text-amber-700'}`}><span style={{ fontWeight: 600 }}>Por que:</span> {item.reason}</p>
                      <p className={`text-xs mt-2 ${item.ok ? 'text-emerald-700' : 'text-amber-700'}`}><span style={{ fontWeight: 600 }}>Que falta:</span> {item.missing}</p>
                      <p className={`text-xs mt-2 ${item.ok ? 'text-emerald-700' : 'text-amber-700'}`}><span style={{ fontWeight: 600 }}>Donde actuar:</span> {item.action}</p>
                      {!item.ok && item.targets.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.targets.slice(0, 2).map(target => (
                            <div key={`${item.key}-${target.frontId}-${target.fieldKey}`} className="rounded-lg border border-amber-200 bg-white p-2.5">
                              <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>{target.frontTitle}</p>
                              <p className="text-xs text-amber-700 mt-1">Falta completar <span style={{ fontWeight: 700 }}>{target.fieldLabel.toLowerCase()}</span>. {target.missing}</p>
                              <button
                                onClick={() => focusGuidedTarget(item.label, target)}
                                className="mt-2 text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 bg-white text-amber-700 hover:text-amber-900"
                                style={{ fontWeight: 600 }}
                              >
                                Ir a completar {target.fieldLabel.toLowerCase()}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/70 bg-white/70 p-4">
                  <p className="text-xs text-violet-700 mb-2" style={{ fontWeight: 600 }}>Recomendaciones para seguir</p>
                  <ul className="space-y-1.5">
                    {state.aiAnalysis.recommendations.map((item, index) => (
                      <li key={index} className="text-sm text-violet-900 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0 mt-2" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {!state.aiAnalysis ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Todavia falta analizar este modulo</p>
              <p className="text-sm text-amber-700">Primero ejecuta el analisis IA del modulo para revisar que criterios cumplen, que sigue bloqueando el cierre y en que frente conviene volver a trabajar.</p>
            </div>
          ) : needsReanalysis ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 space-y-3">
              <p className="text-xs text-sky-800" style={{ fontWeight: 700 }}>Ya corregiste, falta reanalizar</p>
              <p className="text-sm text-sky-700">El cierre final y el paso siguiente siguen bloqueados hasta volver a correr el analisis IA con la evidencia actualizada.</p>
              <ul className="space-y-1">
                {updatedFrontTitles.map(title => (
                  <li key={title} className="text-xs text-sky-700 flex items-start gap-2">
                    <span className="w-1 h-1 rounded-full bg-sky-400 shrink-0 mt-1.5" />
                    {title}: evidencia agregada y lista para reanalizar.
                  </li>
                ))}
              </ul>
            </div>
          ) : !allCriteriaReady ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Que sigue bloqueando el cierre final</p>
              <p className="text-sm text-amber-700">Todavia no puedes generar el resumen final ni habilitar el paso siguiente porque estos criterios siguen en ajuste:</p>
              <div className="space-y-2">
                {blockingCriteria.map(item => (
                  <div key={`blocking-${item.key}`} className="rounded-lg border border-amber-200 bg-white p-3">
                    <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>{item.label}</p>
                    <p className="text-xs text-amber-700 mt-1">{item.missing}</p>
                    {item.targets[0] && (
                      <p className="text-xs text-amber-700 mt-1">
                        <span style={{ fontWeight: 700 }}>Frente y accion:</span> {item.targets[0].frontTitle} - completa {item.targets[0].fieldLabel.toLowerCase()}.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-xs text-slate-700" style={{ fontWeight: 700 }}>Resumen general del modulo</p>
                    <p className="text-xs text-slate-500 mt-1">Todos los criterios ya cumplen. Ahora si puedes generar el cierre final con IA e integrar la decision sobre el problema.</p>
                  </div>
                  <button
                    onClick={() => {
                      setSummaryLoading(true);
                      setTimeout(() => {
                        onChange(prev => ({ ...prev, finalSummary: buildModuleClosureSummary(context, prev) }));
                        setSummaryLoading(false);
                      }, 1000);
                    }}
                    className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors"
                    style={{ fontWeight: 600 }}
                  >
                    <Sparkles size={11} /> {summaryLoading ? 'Generando...' : 'Generar resumen final con IA'}
                  </button>
                </div>

                {state.finalSummary.trim().length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4">
                    <p className="text-sm text-slate-700" style={{ fontWeight: 600 }}>Genera el cierre final para ver la card ejecutiva del modulo.</p>
                    <p className="text-xs text-slate-500 mt-1">La card consolidara el problema al cierre, lo investigado, la evidencia reunida, los hallazgos clave, la validacion del problema y la decision tomada.</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-xs text-indigo-700" style={{ fontWeight: 700 }}>Card ejecutiva del cierre</p>
                        <p className="text-sm text-slate-500 mt-1">Este es el output consolidado del modulo para compartir, revisar o usar como base del step siguiente.</p>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700" style={{ fontWeight: 600 }}>
                        {closureCard.decisionLabel}
                      </span>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 700 }}>Problema definido al cierre del modulo</p>
                        <p className="text-sm text-slate-800 leading-relaxed">{closureCard.problemDefinition}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 700 }}>Decision tomada</p>
                        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{closureCard.decisionLabel}</p>
                        <p className="text-sm text-slate-600 mt-1">{closureCard.decisionRationale}</p>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 700 }}>Que se investigo</p>
                        <div className="flex flex-wrap gap-2">
                          {closureCard.investigatedFronts.length > 0 ? closureCard.investigatedFronts.map(item => (
                            <span key={item} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-700" style={{ fontWeight: 600 }}>
                              {item}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-500">Sin frentes definidos.</span>
                          )}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 700 }}>Evidencia consolidada</p>
                        <ul className="space-y-1.5">
                          {closureCard.evidenceSummary.map(item => (
                            <li key={item} className="text-sm text-slate-700 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-2" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 700 }}>Hallazgos clave</p>
                        <ul className="space-y-1.5">
                          {closureCard.findings.map(item => (
                            <li key={item} className="text-sm text-slate-700 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 mt-2" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 700 }}>Validacion del problema</p>
                        <div className="space-y-2">
                          {closureCard.validation.map(item => (
                            <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs text-slate-800" style={{ fontWeight: 700 }}>{item.label}</p>
                                <span className={`text-[11px] px-2 py-0.5 rounded-full ${item.status === 'Cumple' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`} style={{ fontWeight: 700 }}>
                                  {item.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1">{item.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                      <p className="text-xs text-indigo-700 mb-2" style={{ fontWeight: 700 }}>Sintesis ejecutiva para continuidad</p>
                      <textarea value={state.finalSummary} onChange={event => onChange(prev => ({ ...prev, finalSummary: event.target.value }))} rows={6} placeholder="Ajusta si necesitas afinar el cierre ejecutivo del modulo." className="w-full border border-indigo-200 rounded-xl px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-600 mb-2" style={{ fontWeight: 500 }}>Decision del aprendizaje</label>
                <div className="grid gap-2 md:grid-cols-3">
                  {DECISION_OPTIONS.map(option => (
                    <button key={option.value} onClick={() => onChange(prev => ({ ...prev, finalDecision: option.value }))} className={`text-left px-3 py-3 rounded-xl border transition-colors ${state.finalDecision === option.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                      <p className={`text-sm ${state.finalDecision === option.value ? 'text-indigo-700' : 'text-slate-700'}`} style={{ fontWeight: 600 }}>{option.label}</p>
                      <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {state.finalDecision && state.finalDecision !== 'mantener' && (
                <div>
                  <label className="block text-xs text-slate-600 mb-1.5" style={{ fontWeight: 500 }}>Que debes ajustar a partir de este aprendizaje</label>
                  <input value={state.finalRationale} onChange={event => onChange(prev => ({ ...prev, finalRationale: event.target.value }))} placeholder="Explica que cambio y por que." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button onClick={() => downloadModuleSummary(context, state)} disabled={!canDownloadSummary} className="flex items-center gap-1.5 text-xs text-indigo-700 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors disabled:opacity-40" style={{ fontWeight: 600 }}>
              <Download size={12} /> Descargar resumen del modulo
            </button>
            {!canDownloadSummary && <p className="text-xs text-slate-500">La descarga se habilita cuando todo el analisis IA esta al dia, todos los criterios estan en cumple y ya generaste el cierre final del modulo.</p>}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {missing.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-amber-500" />
              <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Antes de enviar a revision, completa:</p>
            </div>
            <ul className="space-y-1">
              {missing.map((item, index) => (
                <li key={index} className="text-xs text-amber-700 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button onClick={onOpenReview} disabled={missing.length > 0} className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${missing.length === 0 ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`} style={{ fontWeight: 500 }}>
          {missing.length === 0 ? <><CheckCircle2 size={15} /> {reviewCtaLabel || 'Modulo C listo - Enviar a revision IA'} <ChevronRight size={15} /></> : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
        </button>
        {missing.length === 0 && reviewCtaHint && (
          <p className="text-xs text-slate-500">{reviewCtaHint}</p>
        )}
      </div>
    </div>
  );
}
