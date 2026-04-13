import React, { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight, Lock, MessageSquare, Sparkles } from 'lucide-react';
import { StatusChip } from '../StatusChip';
import { buildGuideForSource, serializeResearchGuide } from './researchGuideBuilder';
import { ResearchFrontsSection } from './ResearchFrontsSection';
import {
  ResearchGuide,
  ResearchModuleAContext,
  ResearchSource,
  ResearchSourceType,
  Step1ResearchModuleV2State,
} from './step1ResearchV2.types';

interface Step1ResearchModuleV2Props {
  context: ResearchModuleAContext;
  fichaConfirmada: boolean;
  state: Step1ResearchModuleV2State;
  iaLoading: boolean;
  statusLabel: 'Completado' | 'En progreso' | 'Requiere ajuste';
  missing: string[];
  onChange: (updater: (prev: Step1ResearchModuleV2State) => Step1ResearchModuleV2State) => void;
  onOpenIA: () => void;
  onOpenMentor: () => void;
  onGoToModuleA: () => void;
  onNext: () => void;
}

const createManualSource = (frontId: string, type: ResearchSourceType, index: number): ResearchSource => ({
  id: `${frontId}-${type}-${Date.now()}-${index}`,
  type,
  label: type === 'perfil' ? 'Nuevo perfil' : 'Nueva fuente de data',
  detail: type === 'perfil'
    ? 'Explica por que este perfil importa para entender el frente.'
    : 'Explica el valor de esta fuente para validar el frente.',
  owner: type === 'perfil' ? 'Persona o rol a contactar' : 'Area o responsable de la fuente',
  accessPoint: type === 'perfil' ? 'Entrevista, llamada o visita' : 'Sistema, archivo, tablero o repositorio',
  expectedLearning: type === 'perfil'
    ? 'Resume que esperas aprender de esta conversacion.'
    : 'Resume que esperas aprender o capturar con esta fuente.',
  origin: 'manual',
});

const reorder = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

export function Step1ResearchModuleV2({
  context,
  fichaConfirmada,
  state,
  iaLoading,
  statusLabel,
  missing,
  onChange,
  onOpenIA,
  onOpenMentor,
  onGoToModuleA,
  onNext,
}: Step1ResearchModuleV2Props) {
  const [expandedFrontId, setExpandedFrontId] = useState<string | null>(state.fronts[0]?.id || null);
  const [researchOpen, setResearchOpen] = useState(true);
  const [showModuleASummary, setShowModuleASummary] = useState(false);

  const deliverables = useMemo(() => {
    const completedFronts = state.fronts.filter(front => front.title.trim() && front.whyItMatters.trim() && front.learningGoal.trim()).length;
    const prioritizedSources = state.fronts.reduce((total, front) => total + front.selectedSourceIds.length, 0);
    const readyGuides = state.fronts.reduce((total, front) => total + front.guides.length, 0);
    return { completedFronts, prioritizedSources, readyGuides };
  }, [state.fronts]);

  const researchReady = state.fronts.filter(front => front.title.trim() && front.whyItMatters.trim() && front.learningGoal.trim()).length >= 3;

  const exportResearchPlan = () => {
    const lines = [
      'PLAN BASE DE INVESTIGACION - STEP 1 / MODULO B',
      '',
      '1. Objetivo de investigacion',
      state.objective.draft || 'Sin definir',
      '',
      '2. Frentes y fuentes priorizadas',
      ...state.fronts.flatMap((front, index) => {
        const selectedSources = front.sources.filter(source => front.selectedSourceIds.includes(source.id));
        return [
          `${index + 1}. ${front.title || 'Frente sin titulo'}`,
          `   Para que sirve: ${front.whyItMatters || 'Sin definir'}`,
          `   Que necesitas validar: ${front.learningGoal || 'Sin definir'}`,
          '   Fuentes priorizadas:',
          ...selectedSources.map(source => `   - ${source.type === 'perfil' ? 'Perfil' : 'Data'}: ${source.label} | Responsable: ${source.owner || 'Sin definir'} | Acceso: ${source.accessPoint || 'Sin definir'} | Esperas aprender: ${source.expectedLearning || source.detail || 'Sin definir'}`),
          '',
        ];
      }),
      '3. Guias generadas',
      ...state.fronts.flatMap(front => front.guides.map(guide => `- ${guide.sourceLabel}: ${guide.mode === 'interview' ? 'Guia base de entrevista' : 'Formato base de captura de data'}`)),
      '',
      '4. Siguiente paso sugerido',
      'Salir a capturar evidencia o revisar este plan con mentor antes de ir a campo.',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'starteria-plan-investigacion-modulo-b.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyResearchBriefForIA = async () => {
    const brief = [
      'Ayudame a mejorar esta preparacion de investigacion de campo.',
      '',
      `Objetivo actual: ${state.objective.draft || 'Sin definir'}`,
      '',
      'Frentes:',
      ...state.fronts.map((front, index) => {
        const selectedSources = front.sources.filter(source => front.selectedSourceIds.includes(source.id));
        return `${index + 1}. ${front.title || 'Frente sin titulo'} | Para que sirve: ${front.whyItMatters || 'Sin definir'} | Quiero validar: ${front.learningGoal || 'Sin definir'} | Fuentes: ${selectedSources.map(source => `${source.label} (${source.type})`).join(', ') || 'Sin fuentes'}`;
      }),
      '',
      'Dame feedback en este orden:',
      '1. Que esta bien',
      '2. Que falta',
      '3. Siguiente accion recomendada',
    ].join('\n');

    await navigator.clipboard.writeText(brief);
  };

  const applyFrontUpdate = (
    frontId: string,
    updater: (front: Step1ResearchModuleV2State['fronts'][number]) => Step1ResearchModuleV2State['fronts'][number],
  ) => {
    onChange(prev => ({
      ...prev,
      fronts: prev.fronts.map(front => {
        if (front.id !== frontId) return front;
        const nextFront = updater(front);
        return {
          ...nextFront,
          status: 'revisar',
          guides: nextFront.guides.map(guide => ({ ...guide, status: 'revisar' })),
        };
      }),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-xl text-slate-900" style={{ fontWeight: 700 }}>Modulo B: Investigacion de campo</h1>
            <StatusChip status={statusLabel} size="sm" />
          </div>
          <p className="text-sm text-slate-600 max-w-3xl">
            Aqui organizas la captura: que informacion levantar, con quien, donde y con que guia.
          </p>
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

      <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5">
        <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-900 leading-relaxed">
          <span style={{ fontWeight: 700 }}>Foco heredado del Modulo A:</span> el objetivo y los temas ya quedaron definidos. Aqui solo preparas como capturar la evidencia.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Objetivo heredado del Modulo A</p>
              {state.objective.draftOrigin === 'sugerido' && (
                <span className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200" style={{ fontWeight: 700 }}>
                  Sugerido por IA
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{state.objective.draft || 'Completa este objetivo en el Modulo A antes de planificar la captura.'}</p>
            <p className="text-xs text-slate-500">
              Si necesitas cambiar el foco o los temas prioritarios, vuelve al Modulo A y luego regresa para actualizar este plan.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowModuleASummary(true)}
              className="text-xs text-indigo-700 hover:text-indigo-900 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
              style={{ fontWeight: 600 }}
            >
              Ver salida del Modulo A
            </button>
            <button
              onClick={onGoToModuleA}
              className="text-xs text-violet-700 hover:text-violet-900 px-3 py-1.5 bg-white border border-violet-200 rounded-lg transition-colors"
              style={{ fontWeight: 600 }}
            >
              Editar en Modulo A
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button
          onClick={() => setResearchOpen(open => !open)}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3 text-left">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${researchReady ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'}`} style={{ fontWeight: 700 }}>
              1
            </span>
            <div>
              <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Plan de captura por tema</p>
              <p className="text-xs text-slate-500">{researchReady ? 'Ya puedes organizar fuentes, lugares y guias para salir a campo.' : 'Completa el foco en Modulo A y luego organiza aqui la captura.'}</p>
            </div>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${researchOpen ? 'rotate-180' : ''}`} />
        </button>
        {researchOpen && (
          <div className="px-5 pb-5">
            <ResearchFrontsSection
              fronts={state.fronts}
              expandedFrontId={expandedFrontId}
              iaLoading={iaLoading}
              focusEditable={false}
              onGoToModuleA={onGoToModuleA}
              onToggleFront={frontId => setExpandedFrontId(current => current === frontId ? null : frontId)}
              onAddFront={() => {
                const nextId = `front-${Date.now()}`;
                onChange(prev => ({
                  ...prev,
                  fronts: [
                    ...prev.fronts,
                    {
                      id: nextId,
                      title: '',
                      whyItMatters: '',
                      learningGoal: '',
                      origin: 'manual',
                      sourceMode: 'perfil',
                      sources: [],
                      selectedSourceIds: [],
                      guides: [],
                      status: 'revisar',
                    },
                  ],
                }));
                setExpandedFrontId(nextId);
              }}
              onMoveFront={(frontId, direction) => {
                onChange(prev => {
                  const currentIndex = prev.fronts.findIndex(front => front.id === frontId);
                  if (currentIndex < 0) return prev;
                  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
                  if (targetIndex < 0 || targetIndex >= prev.fronts.length) return prev;
                  return { ...prev, fronts: reorder(prev.fronts, currentIndex, targetIndex) };
                });
              }}
              onChangeFrontField={(frontId, field, value) => applyFrontUpdate(frontId, front => ({ ...front, origin: 'manual', [field]: value }))}
              onChangeFrontMode={(frontId, mode) => applyFrontUpdate(frontId, front => {
                const selectedSourceIds = front.selectedSourceIds.filter(sourceId => {
                  const source = front.sources.find(item => item.id === sourceId);
                  if (!source) return false;
                  if (mode === 'ambos') return true;
                  return source.type === mode;
                });
                return { ...front, sourceMode: mode, selectedSourceIds };
              })}
              onToggleSource={(frontId, sourceId) => applyFrontUpdate(frontId, front => {
                const hasSource = front.selectedSourceIds.includes(sourceId);
                return {
                  ...front,
                  selectedSourceIds: hasSource
                    ? front.selectedSourceIds.filter(item => item !== sourceId)
                    : [...front.selectedSourceIds, sourceId],
                };
              })}
              onAddSource={(frontId, type) => applyFrontUpdate(frontId, front => ({
                ...front,
                sources: [...front.sources, createManualSource(frontId, type, front.sources.length)],
              }))}
              onUpdateSource={(frontId, sourceId, field, value) => applyFrontUpdate(frontId, front => ({
                ...front,
                sources: front.sources.map(source => source.id === sourceId ? { ...source, origin: 'manual', [field]: value } : source),
              }))}
              onRemoveSource={(frontId, sourceId) => applyFrontUpdate(frontId, front => ({
                ...front,
                sources: front.sources.filter(source => source.id !== sourceId),
                selectedSourceIds: front.selectedSourceIds.filter(item => item !== sourceId),
                guides: front.guides.filter(guide => guide.sourceId !== sourceId),
              }))}
              onMoveSource={(frontId, sourceId, direction) => applyFrontUpdate(frontId, front => {
                const currentIndex = front.sources.findIndex(source => source.id === sourceId);
                if (currentIndex < 0) return front;
                const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
                if (targetIndex < 0 || targetIndex >= front.sources.length) return front;
                return { ...front, sources: reorder(front.sources, currentIndex, targetIndex) };
              })}
              onGenerateGuides={frontId => {
                onChange(prev => ({
                  ...prev,
                  fronts: prev.fronts.map(front => {
                    if (front.id !== frontId) return front;
                    const nextGuides = front.selectedSourceIds.map(sourceId => {
                      const source = front.sources.find(item => item.id === sourceId);
                      if (!source) return null;
                      return buildGuideForSource(prev.objective, front, source);
                    }).filter(Boolean) as ResearchGuide[];

                    return {
                      ...front,
                      guides: nextGuides,
                      status: 'listo',
                    };
                  }),
                }));
              }}
              onUpdateGuide={(frontId, guideId, guide) => applyFrontUpdate(frontId, front => ({
                ...front,
                guides: front.guides.map(item => item.id === guideId ? { ...guide, origin: 'manual' } : item),
              }))}
              onCopyGuide={guide => navigator.clipboard.writeText(serializeResearchGuide(guide))}
              onShareGuide={async guide => {
                const shareText = serializeResearchGuide(guide);
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: `Guia de investigacion - ${guide.sourceLabel}`,
                      text: shareText,
                    });
                    return;
                  } catch {
                    // If the user cancels the share sheet, fall back to copy below.
                  }
                }
                await navigator.clipboard.writeText(shareText);
              }}
            />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Salida del modulo</p>
            <p className="text-xs text-slate-500 mt-1">
              Llevas {deliverables.completedFronts} frente(s) organizados, {deliverables.prioritizedSources} fuente(s) priorizadas y {deliverables.readyGuides} guia(s) base listas para seguir afinando.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={exportResearchPlan} className="text-xs text-slate-700 hover:text-slate-900 px-3 py-1.5 bg-white border border-slate-200 rounded-lg transition-colors" style={{ fontWeight: 600 }}>
              Descargar plan base
            </button>
            <button onClick={copyResearchBriefForIA} className="text-xs text-indigo-700 hover:text-indigo-900 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg transition-colors" style={{ fontWeight: 600 }}>
              Copiar insumo para IA
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {missing.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={14} className="text-amber-500" />
              <p className="text-xs text-amber-800" style={{ fontWeight: 600 }}>Para avanzar al Modulo C, completa:</p>
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
        <button
          onClick={onNext}
          disabled={missing.length > 0}
          className={`w-full rounded-xl py-3 text-sm flex items-center justify-center gap-2 transition-colors ${missing.length === 0 ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
          style={{ fontWeight: 500 }}
        >
          {missing.length === 0 ? <>Modulo B listo - Ir a Captura y sintesis <ChevronRight size={15} /></> : <><Lock size={14} /> Completa los campos requeridos para avanzar</>}
        </button>
        <p className="text-xs text-slate-500 text-center">
          Siguiente paso logico: salir a capturar evidencia con estas guias o revisar el plan antes de avanzar al siguiente modulo.
        </p>
      </div>

      {showModuleASummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4" onClick={() => setShowModuleASummary(false)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Resumen de apoyo del Modulo A</p>
                <p className="text-xs text-slate-500 mt-1">Usalo solo si necesitas retomar el problema, el quiebre o el vacio pendiente antes de redactar tu objetivo.</p>
              </div>
              <button onClick={() => setShowModuleASummary(false)} className="text-xs text-slate-500 hover:text-slate-700" style={{ fontWeight: 600 }}>
                Cerrar
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500 mb-1" style={{ fontWeight: 700 }}>Resumen consolidado</p>
                <p className="text-sm text-slate-700 leading-relaxed">{context.lecturaConsolidada || 'Todavia no hay un resumen consolidado visible.'}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Problema</p>
                  <p className="text-sm text-slate-700 mt-1">{context.casoReal || 'Sin definir'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Quiebre</p>
                  <p className="text-sm text-slate-700 mt-1">{context.quiebre || 'Sin definir'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Impacto</p>
                  <p className="text-sm text-slate-700 mt-1">{context.consecuencia || 'Sin definir'}</p>
                </div>
              </div>
            </div>
            {!fichaConfirmada && (
              <div className="border-t border-slate-100 px-5 py-4">
                <button onClick={onGoToModuleA} className="text-xs text-violet-700 hover:text-violet-900" style={{ fontWeight: 600 }}>
                  Volver al Modulo A para revisarlo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
