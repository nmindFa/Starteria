import React, { useState } from 'react';
import { AlertCircle, ChevronRight, Lock, MessageSquare, Sparkles } from 'lucide-react';
import { StatusChip } from '../StatusChip';
import { buildGuideForSource, serializeResearchGuide } from './researchGuideBuilder';
import { ResearchFrontsSection } from './ResearchFrontsSection';
import { ResearchObjectiveSection } from './ResearchObjectiveSection';
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
  onSuggestObjective: () => void;
  onSuggestFronts: () => void;
  onGoToModuleA: () => void;
  onNext: () => void;
}

const createManualSource = (frontId: string, type: ResearchSourceType, index: number): ResearchSource => ({
  id: `${frontId}-${type}-${Date.now()}-${index}`,
  type,
  label: type === 'perfil' ? 'Nuevo perfil' : 'Nueva fuente de data',
  detail: type === 'perfil'
    ? 'Explica por que esta persona aporta evidencia relevante.'
    : 'Explica que dato o documento ayudara a validar este frente.',
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
  onSuggestObjective,
  onSuggestFronts,
  onGoToModuleA,
  onNext,
}: Step1ResearchModuleV2Props) {
  const [expandedFrontId, setExpandedFrontId] = useState<string | null>(state.fronts[0]?.id || null);

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
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600" style={{ fontWeight: 600 }}>V2 activa</span>
          </div>
          <p className="text-sm text-slate-500 max-w-3xl">
            Esta version conecta el resumen inicial del problema con un objetivo de investigacion trazable, frentes alineados y guias editables por fuente.
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

      <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 flex items-start gap-3">
        <Sparkles size={14} className="text-violet-500 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs text-violet-800 mb-1" style={{ fontWeight: 600 }}>Ancla visible del Modulo A</p>
          <p className="text-sm text-violet-700 leading-relaxed">{context.lecturaConsolidada}</p>
          {!fichaConfirmada && (
            <button onClick={onGoToModuleA} className="mt-3 flex items-center gap-1 text-xs text-violet-700 px-2.5 py-1.5 bg-violet-100 hover:bg-violet-200 rounded-lg border border-violet-200 transition-colors" style={{ fontWeight: 500 }}>
              Completar Modulo A primero <ChevronRight size={10} />
            </button>
          )}
        </div>
      </div>

      <ResearchObjectiveSection
        context={context}
        objective={state.objective}
        iaLoading={iaLoading}
        onSuggest={onSuggestObjective}
        onUseSuggestion={() => {
          onChange(prev => ({
            ...prev,
            objective: {
              ...prev.objective,
              draft: prev.objective.suggestedDraft,
              status: 'revisar',
            },
          }));
        }}
        onChange={nextDraft => {
          onChange(prev => ({
            ...prev,
            objective: { ...prev.objective, draft: nextDraft, status: 'revisar' },
            fronts: prev.fronts.map(front => ({
              ...front,
              status: 'revisar',
              guides: front.guides.map(guide => ({ ...guide, status: 'revisar' })),
            })),
          }));
        }}
      />

      <ResearchFrontsSection
        fronts={state.fronts}
        expandedFrontId={expandedFrontId}
        iaLoading={iaLoading}
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
        onSuggestFronts={() => {
          onSuggestFronts();
          setExpandedFrontId('front-1');
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
        onChangeFrontField={(frontId, field, value) => applyFrontUpdate(frontId, front => ({ ...front, [field]: value }))}
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
          sources: front.sources.map(source => source.id === sourceId ? { ...source, [field]: value } : source),
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
          guides: front.guides.map(item => item.id === guideId ? guide : item),
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs text-slate-500 mb-2" style={{ fontWeight: 600 }}>Resumen del plan de investigacion</p>
        <div className="space-y-1.5 text-sm text-slate-700">
          <p><span style={{ fontWeight: 600 }}>Objetivo general:</span> {state.objective.draft || 'Sin definir'}</p>
          <p><span style={{ fontWeight: 600 }}>Frentes:</span> {state.fronts.filter(front => front.title.trim()).length} definidos</p>
          <p><span style={{ fontWeight: 600 }}>Guias listas:</span> {state.fronts.reduce((total, front) => total + front.guides.length, 0)}</p>
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
      </div>
    </div>
  );
}
