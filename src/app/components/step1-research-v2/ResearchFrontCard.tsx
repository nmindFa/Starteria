import React from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { serializeResearchGuide } from './researchGuideBuilder';
import { ResearchFront, ResearchGuide, ResearchSourceMode, ResearchSourceType } from './step1ResearchV2.types';
import { ResearchGuidePanel } from './ResearchGuidePanel';

interface ResearchFrontCardProps {
  front: ResearchFront;
  index: number;
  expanded: boolean;
  iaLoading: boolean;
  onToggle: () => void;
  onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChangeField: (field: 'title' | 'whyItMatters' | 'learningGoal', value: string) => void;
  onChangeMode: (mode: ResearchSourceMode) => void;
  onToggleSource: (sourceId: string) => void;
  onAddSource: (type: ResearchSourceType) => void;
  onUpdateSource: (sourceId: string, field: 'label' | 'detail', value: string) => void;
  onRemoveSource: (sourceId: string) => void;
  onMoveSource: (sourceId: string, direction: 'up' | 'down') => void;
  onGenerateGuides: () => void;
  onUpdateGuide: (guideId: string, guide: ResearchGuide) => void;
  onCopyGuide: (guide: ResearchGuide) => void;
  onShareGuide: (guide: ResearchGuide) => void;
}

const modeOptions: { value: ResearchSourceMode; label: string; description: string }[] = [
  { value: 'perfil', label: 'Perfiles', description: 'Conversaciones con roles o personas.' },
  { value: 'data', label: 'Data', description: 'Registros, documentos o evidencia.' },
  { value: 'ambos', label: 'Ambos', description: 'Combina voces y evidencia.' },
];

const buildFrontStatus = (front: ResearchFront) => {
  const hasTopic = front.title.trim().length > 0;
  const hasCriteria = front.learningGoal.trim().length > 0;
  const hasWhy = front.whyItMatters.trim().length > 0;
  const hasSelectedSource = front.selectedSourceIds.length > 0;
  const hasGuide = front.guides.some(guide => front.selectedSourceIds.includes(guide.sourceId));

  if (hasTopic && hasCriteria && hasWhy && hasSelectedSource && hasGuide) {
    return {
      label: 'Guia lista',
      tone: 'bg-emerald-100 text-emerald-700',
      helper: 'Estado automatico: este frente ya tiene tema, criterios, para que sirve, al menos una fuente seleccionada y una guia generada.',
    };
  }

  if (hasTopic && hasCriteria && hasWhy && hasSelectedSource) {
    return {
      label: 'Listo para generar guia',
      tone: 'bg-indigo-100 text-indigo-700',
      helper: 'Estado automatico: este frente ya puede generar guia porque tiene tema, criterios, para que sirve y al menos una fuente seleccionada.',
    };
  }

  return {
    label: 'Requiere ajuste',
    tone: 'bg-amber-100 text-amber-700',
    helper: 'Estado automatico: aun falta completar tema, criterios, para que sirve o seleccionar al menos una fuente.',
  };
};

const updateGuideBody = (guide: ResearchGuide): ResearchGuide => {
  const normalizedGuide: ResearchGuide = {
    ...guide,
    mode: guide.mode || (guide.sourceType === 'data' ? 'data_review' : 'interview'),
    criteria: guide.criteria || [],
    suggestedSources: guide.suggestedSources || [],
    questions: guide.questions || [],
    informationGaps: guide.informationGaps || [],
  };

  return {
    ...normalizedGuide,
    body: serializeResearchGuide(normalizedGuide),
  };
};

export function ResearchFrontCard({
  front,
  index,
  expanded,
  iaLoading,
  onToggle,
  onMove,
  canMoveUp,
  canMoveDown,
  onChangeField,
  onChangeMode,
  onToggleSource,
  onAddSource,
  onUpdateSource,
  onRemoveSource,
  onMoveSource,
  onGenerateGuides,
  onUpdateGuide,
  onCopyGuide,
  onShareGuide,
}: ResearchFrontCardProps) {
  const frontStatus = buildFrontStatus(front);

  return (
    <div className={`border rounded-2xl overflow-hidden ${expanded ? 'border-indigo-200 shadow-sm bg-white' : 'border-slate-200 bg-white'}`}>
      <div
        className={`px-4 py-3 flex items-center gap-3 cursor-pointer ${expanded ? 'bg-indigo-50 border-b border-indigo-100' : 'hover:bg-slate-50'}`}
        onClick={onToggle}
      >
        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${expanded ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-600'}`} style={{ fontWeight: 700 }}>
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm truncate ${expanded ? 'text-indigo-900' : 'text-slate-800'}`} style={{ fontWeight: 600 }}>
            {front.title || 'Nuevo frente de investigacion'}
          </p>
          <p className="text-xs text-slate-500 truncate">{front.learningGoal || 'Define el criterio principal que quieres investigar en este frente.'}</p>
          <p className="text-xs text-slate-400 mt-1 truncate">{frontStatus.helper}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${frontStatus.tone}`} style={{ fontWeight: 600 }}>
          {frontStatus.label}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180 text-indigo-500' : ''}`} />
      </div>

      {expanded && (
        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div>
              <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Estructura del frente</p>
              <p className="text-xs text-slate-500">Completa este frente en tres partes: tema a investigar, criterios sugeridos a investigar y fuentes de datos o evidencia a conseguir.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Tema a investigar</label>
                <input
                  value={front.title}
                  onChange={event => onChangeField('title', event.target.value)}
                  placeholder="Ej. Existencia y magnitud del problema"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Para que sirve investigar este frente</label>
                <input
                  value={front.whyItMatters}
                  onChange={event => onChangeField('whyItMatters', event.target.value)}
                  placeholder="Ej. Ayuda a decidir si el problema es un patron real o un caso aislado."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Criterios sugeridos a investigar</label>
              <textarea
                value={front.learningGoal}
                onChange={event => onChangeField('learningGoal', event.target.value)}
                rows={2}
                placeholder="Ej. Confirmar frecuencia, impacto, variaciones entre perfiles y que evidencia falta conseguir."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
              <p className="text-xs text-slate-500 mt-1">Escribe que necesitas observar, validar o contrastar. Luego la guia IA convertira esto en criterios y preguntas concretas.</p>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-600 mb-2 block" style={{ fontWeight: 500 }}>Tipo de fuente a usar</label>
            <div className="grid gap-2 md:grid-cols-3">
              {modeOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => onChangeMode(option.value)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${front.sourceMode === option.value ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{option.label}</p>
                  <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Fuentes de datos o evidencia a conseguir</p>
                <p className="text-xs text-slate-500">Selecciona o crea las fuentes que realmente te ayudaran a capturar la data de este frente.</p>
              </div>
              <div className="flex gap-2">
                {(front.sourceMode === 'perfil' || front.sourceMode === 'ambos') && (
                  <button onClick={() => onAddSource('perfil')} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100">
                    <Plus size={11} /> Agregar perfil
                  </button>
                )}
                {(front.sourceMode === 'data' || front.sourceMode === 'ambos') && (
                  <button onClick={() => onAddSource('data')} className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 px-2.5 py-1.5 bg-sky-50 rounded-lg border border-sky-100">
                    <Plus size={11} /> Agregar data
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {front.sources.map((source, sourceIndex) => {
                const selected = front.selectedSourceIds.includes(source.id);
                return (
                  <div key={source.id} className={`rounded-xl border p-3 ${selected ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => onToggleSource(source.id)}
                          className="mt-1"
                        />
                        <div className="flex-1 grid gap-3 md:grid-cols-2">
                          <div>
                            <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 600 }}>{source.type === 'perfil' ? 'Perfil o rol' : 'Fuente de data o evidencia'}</p>
                            <input
                              value={source.label}
                              onChange={event => onUpdateSource(source.id, 'label', event.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 600 }}>Que esperas obtener de esta fuente</p>
                            <input
                              value={source.detail}
                              onChange={event => onUpdateSource(source.id, 'detail', event.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </label>
                      <div className="flex items-center gap-1">
                        <button onClick={() => onMoveSource(source.id, 'up')} disabled={sourceIndex === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                          <ArrowUp size={14} />
                        </button>
                        <button onClick={() => onMoveSource(source.id, 'down')} disabled={sourceIndex === front.sources.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
                          <ArrowDown size={14} />
                        </button>
                        <button onClick={() => onRemoveSource(source.id)} className="text-slate-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {front.sources.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
                  Este frente aun no tiene fuentes. Agrega perfiles, data o ambas segun la evidencia que necesites conseguir.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
            <p className="text-sm text-sky-800" style={{ fontWeight: 600 }}>Como se calcula el estado de este frente</p>
            <p className="text-xs text-sky-700 mt-1">{frontStatus.helper}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button onClick={() => onMove('up')} disabled={!canMoveUp} className="text-xs text-slate-600 px-2.5 py-1.5 border border-slate-200 rounded-lg disabled:opacity-30">
                Subir
              </button>
              <button onClick={() => onMove('down')} disabled={!canMoveDown} className="text-xs text-slate-600 px-2.5 py-1.5 border border-slate-200 rounded-lg disabled:opacity-30">
                Bajar
              </button>
            </div>
            <button
              onClick={onGenerateGuides}
              disabled={iaLoading || front.selectedSourceIds.length === 0}
              className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 600 }}
            >
              {iaLoading ? 'Generando...' : <><Sparkles size={11} /> Generar guia con IA</>}
            </button>
          </div>

          {front.selectedSourceIds.length > 0 && (
            <div className="space-y-4">
              {front.guides
                .filter(guide => front.selectedSourceIds.includes(guide.sourceId))
                .map(guide => (
                  <ResearchGuidePanel
                    key={guide.id}
                    guide={guide}
                    onChangeIntro={nextIntro => onUpdateGuide(guide.id, updateGuideBody({ ...guide, intro: nextIntro, status: 'revisar' }))}
                    onChangeCriterion={(criterionIndex, nextValue) => {
                      const nextCriteria = guide.criteria.map((item, itemIndex) => itemIndex === criterionIndex ? nextValue : item);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, criteria: nextCriteria, status: 'revisar' }));
                    }}
                    onAddCriterion={() => onUpdateGuide(guide.id, updateGuideBody({ ...guide, criteria: [...guide.criteria, ''], status: 'revisar' }))}
                    onRemoveCriterion={criterionIndex => {
                      const nextCriteria = guide.criteria.filter((_, itemIndex) => itemIndex !== criterionIndex);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, criteria: nextCriteria, status: 'revisar' }));
                    }}
                    onChangeSuggestedSource={(sourceIndex, nextValue) => {
                      const nextSuggestedSources = guide.suggestedSources.map((item, itemIndex) => itemIndex === sourceIndex ? nextValue : item);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, suggestedSources: nextSuggestedSources, status: 'revisar' }));
                    }}
                    onAddSuggestedSource={() => onUpdateGuide(guide.id, updateGuideBody({ ...guide, suggestedSources: [...guide.suggestedSources, ''], status: 'revisar' }))}
                    onRemoveSuggestedSource={sourceIndex => {
                      const nextSuggestedSources = guide.suggestedSources.filter((_, itemIndex) => itemIndex !== sourceIndex);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, suggestedSources: nextSuggestedSources, status: 'revisar' }));
                    }}
                    onChangeQuestion={(questionIndex, nextValue) => {
                      const nextQuestions = guide.questions.map((item, itemIndex) => itemIndex === questionIndex ? nextValue : item).slice(0, 8);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, questions: nextQuestions, status: 'revisar' }));
                    }}
                    onAddQuestion={() => {
                      if (guide.questions.length >= 8) return;
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, questions: [...guide.questions, ''], status: 'revisar' }));
                    }}
                    onRemoveQuestion={questionIndex => {
                      const nextQuestions = guide.questions.filter((_, itemIndex) => itemIndex !== questionIndex);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, questions: nextQuestions, status: 'revisar' }));
                    }}
                    onChangeInformationGap={(gapIndex, nextValue) => {
                      const nextInformationGaps = guide.informationGaps.map((item, itemIndex) => itemIndex === gapIndex ? nextValue : item);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, informationGaps: nextInformationGaps, status: 'revisar' }));
                    }}
                    onAddInformationGap={() => onUpdateGuide(guide.id, updateGuideBody({ ...guide, informationGaps: [...guide.informationGaps, ''], status: 'revisar' }))}
                    onRemoveInformationGap={gapIndex => {
                      const nextInformationGaps = guide.informationGaps.filter((_, itemIndex) => itemIndex !== gapIndex);
                      onUpdateGuide(guide.id, updateGuideBody({ ...guide, informationGaps: nextInformationGaps, status: 'revisar' }));
                    }}
                    onCopy={() => onCopyGuide(updateGuideBody(guide))}
                    onShare={() => onShareGuide(updateGuideBody(guide))}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
