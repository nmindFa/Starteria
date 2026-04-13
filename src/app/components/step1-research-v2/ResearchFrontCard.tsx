import React, { useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, Plus, Sparkles, X } from 'lucide-react';
import { serializeResearchGuide } from './researchGuideBuilder';
import { ResearchFront, ResearchGuide, ResearchSource, ResearchSourceMode, ResearchSourceType } from './step1ResearchV2.types';
import { ResearchGuidePanel } from './ResearchGuidePanel';

interface ResearchFrontCardProps {
  front: ResearchFront;
  index: number;
  expanded: boolean;
  iaLoading: boolean;
  focusEditable?: boolean;
  onGoToModuleA?: () => void;
  onToggle: () => void;
  onMove: (direction: 'up' | 'down') => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChangeField: (field: 'title' | 'whyItMatters' | 'learningGoal', value: string) => void;
  onChangeMode: (mode: ResearchSourceMode) => void;
  onToggleSource: (sourceId: string) => void;
  onAddSource: (type: ResearchSourceType) => void;
  onUpdateSource: (sourceId: string, field: 'label' | 'detail' | 'owner' | 'accessPoint' | 'expectedLearning', value: string) => void;
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
  const contentReady = front.title.trim() && front.whyItMatters.trim() && front.learningGoal.trim();
  const sourcesReady = front.selectedSourceIds.length > 0;
  const guidesReady = sourcesReady && front.selectedSourceIds.every(sourceId => front.guides.some(guide => guide.sourceId === sourceId));

  if (contentReady && sourcesReady && guidesReady) {
    return { label: 'Guia lista', tone: 'bg-emerald-100 text-emerald-700' };
  }

  if (contentReady && sourcesReady) {
    return { label: 'Listo para guia', tone: 'bg-indigo-100 text-indigo-700' };
  }

  return { label: 'En progreso', tone: 'bg-amber-100 text-amber-700' };
};

const updateGuideBody = (guide: ResearchGuide): ResearchGuide => {
  const baseQuestionGroups = guide.questionGroups
    ? guide.questionGroups.map(group => [...group])
    : (guide.criteria || []).map((_, index) => guide.questions[index] ? [guide.questions[index]] : []);
  const normalizedQuestionGroups = (guide.criteria || []).map((_, index) => baseQuestionGroups[index] || []);
  const normalizedGuide: ResearchGuide = {
    ...guide,
    mode: guide.mode || (guide.sourceType === 'data' ? 'data_review' : 'interview'),
    criteria: guide.criteria || [],
    suggestedSources: guide.suggestedSources || [],
    questionGroups: normalizedQuestionGroups,
    questions: normalizedQuestionGroups.flat().slice(0, 8),
    informationGaps: guide.informationGaps || [],
  };

  return {
    ...normalizedGuide,
    body: serializeResearchGuide(normalizedGuide),
  };
};

const downloadGuide = (guide: ResearchGuide) => {
  const blob = new Blob([serializeResearchGuide(guide)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${guide.mode === 'data_review' ? 'guia-captura-data' : 'guia-entrevista'}-${guide.sourceLabel.replace(/\s+/g, '-').toLowerCase()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

const SectionHeader = ({
  number,
  title,
  helper,
  ready,
  open,
  onToggle,
}: {
  number: number;
  title: string;
  helper: string;
  ready: boolean;
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3 text-left"
  >
    <div className="flex items-center gap-3">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${ready ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white'}`} style={{ fontWeight: 700 }}>
        {ready ? <CheckCircle2 size={14} /> : number}
      </span>
      <div>
        <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{title}</p>
        <p className="text-xs text-slate-500">{helper}</p>
      </div>
    </div>
    <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
  </button>
);

const SourceCard = ({
  source,
  selected,
  isProfile,
  sourceIndex,
  total,
  onToggleSource,
  onUpdateSource,
  onMoveSource,
  onRemoveSource,
}: {
  source: ResearchSource;
  selected: boolean;
  isProfile: boolean;
  sourceIndex: number;
  total: number;
  onToggleSource: (sourceId: string) => void;
  onUpdateSource: (sourceId: string, field: 'label' | 'detail' | 'owner' | 'accessPoint' | 'expectedLearning', value: string) => void;
  onMoveSource: (sourceId: string, direction: 'up' | 'down') => void;
  onRemoveSource: (sourceId: string) => void;
}) => (
  <div className={`rounded-xl border p-4 ${selected ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
    <div className="flex items-start justify-between gap-3">
      <label className="flex items-start gap-3 flex-1">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSource(source.id)}
          className="mt-1"
        />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] px-2 py-1 rounded-full ${isProfile ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'}`} style={{ fontWeight: 700 }}>
              {isProfile ? 'Perfil / persona' : 'Fuente de data'}
            </span>
            {source.origin === 'sugerido' && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200" style={{ fontWeight: 700 }}>
                Sugerido por IA
              </span>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 600 }}>{isProfile ? 'Perfil o rol' : 'Fuente'}</p>
              <input
                value={source.label}
                onChange={event => onUpdateSource(source.id, 'label', event.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 600 }}>{isProfile ? 'Por que este perfil importa' : 'Que valor aporta esta fuente'}</p>
              <textarea
                value={source.detail}
                onChange={event => onUpdateSource(source.id, 'detail', event.target.value)}
                rows={3}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            {!isProfile && (
              <div className="lg:col-span-2">
                <p className="text-xs text-slate-600 mb-1" style={{ fontWeight: 600 }}>Quien la maneja o facilita</p>
                <input
                  value={source.owner}
                  onChange={event => onUpdateSource(source.id, 'owner', event.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}
          </div>
        </div>
      </label>
      <div className="flex items-center gap-1">
        <button onClick={() => onMoveSource(source.id, 'up')} disabled={sourceIndex === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
          <ArrowUp size={14} />
        </button>
        <button onClick={() => onMoveSource(source.id, 'down')} disabled={sourceIndex === total - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30">
          <ArrowDown size={14} />
        </button>
        <button onClick={() => onRemoveSource(source.id)} className="text-slate-400 hover:text-red-500">
          <X size={14} />
        </button>
      </div>
    </div>
  </div>
);

export function ResearchFrontCard({
  front,
  index,
  expanded,
  iaLoading,
  focusEditable = true,
  onGoToModuleA,
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
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [guidesOpen, setGuidesOpen] = useState(true);

  const frontStatus = buildFrontStatus(front);
  const profileSources = front.sources.filter(source => source.type === 'perfil');
  const dataSources = front.sources.filter(source => source.type === 'data');
  const detailsReady = Boolean(front.title.trim() && front.whyItMatters.trim() && front.learningGoal.trim());
  const sourcesReady = front.selectedSourceIds.length > 0;
  const guidesReady = sourcesReady && front.selectedSourceIds.every(sourceId => front.guides.some(guide => guide.sourceId === sourceId));

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
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm truncate ${expanded ? 'text-indigo-900' : 'text-slate-800'}`} style={{ fontWeight: 600 }}>
              {front.title || 'Nuevo frente de investigacion'}
            </p>
            {front.origin === 'sugerido' && (
              <span className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200" style={{ fontWeight: 700 }}>
                Sugerido por IA
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">{front.learningGoal || 'Define que necesitas observar o validar en este frente.'}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${frontStatus.tone}`} style={{ fontWeight: 600 }}>
          {frontStatus.label}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${expanded ? 'rotate-180 text-indigo-500' : ''}`} />
      </div>

      {expanded && (
        <div className="p-5 space-y-4">
          <SectionHeader
            number={1}
            title={focusEditable ? 'Tema y foco del frente' : 'Tema heredado del Modulo A'}
            helper={focusEditable ? 'Define que vas a investigar, para que sirve y que necesitas validar.' : 'Este foco ya fue definido antes. Aqui solo lo usas para organizar la captura.'}
            ready={detailsReady}
            open={detailsOpen}
            onToggle={() => setDetailsOpen(open => !open)}
          />
          {detailsOpen && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
              {focusEditable ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div>
                      <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Que tema vas a investigar</label>
                      <input
                        value={front.title}
                        onChange={event => onChangeField('title', event.target.value)}
                        placeholder="Ej. Existencia y magnitud del problema"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Para que investigarlo</label>
                      <textarea
                        value={front.whyItMatters}
                        onChange={event => onChangeField('whyItMatters', event.target.value)}
                        rows={3}
                        placeholder="Ej. Ayuda a decidir si el problema es un patron real o un caso aislado."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 mb-1.5 block" style={{ fontWeight: 500 }}>Que necesitas validar</label>
                    <textarea
                      value={front.learningGoal}
                      onChange={event => onChangeField('learningGoal', event.target.value)}
                      rows={3}
                      placeholder="Ej. Confirmar frecuencia, impacto, variaciones entre perfiles y que evidencia falta conseguir."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">Esto guiara la eleccion de fuentes y la generacion de preguntas o formatos de captura.</p>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 lg:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Tema</p>
                      <p className="text-sm text-slate-700 mt-1">{front.title || 'Sin definir todavia'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Por que importa</p>
                      <p className="text-sm text-slate-700 mt-1">{front.whyItMatters || 'Sin definir todavia'}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Que necesitas validar</p>
                      <p className="text-sm text-slate-700 mt-1">{front.learningGoal || 'Sin definir todavia'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5">
                    <p className="text-xs text-indigo-800">
                      Si necesitas cambiar este foco, hazlo en el Modulo A y luego vuelve para actualizar la captura.
                    </p>
                    {onGoToModuleA && (
                      <button
                        onClick={onGoToModuleA}
                        className="shrink-0 text-xs text-indigo-700 hover:text-indigo-900"
                        style={{ fontWeight: 700 }}
                      >
                        Ir al Modulo A
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <SectionHeader
            number={2}
            title="Fuentes para responder este frente"
            helper="Elige si lo responderas con entrevistas, con evidencia o con ambas."
            ready={sourcesReady}
            open={sourcesOpen}
            onToggle={() => setSourcesOpen(open => !open)}
          />
          {sourcesOpen && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-5">
              <div>
                <p className="text-xs text-slate-600 mb-2" style={{ fontWeight: 600 }}>Tipo de fuente a usar</p>
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

              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Perfiles y fuentes para este frente</p>
                  <p className="text-xs text-slate-500">Prioriza solo las fuentes que de verdad te ayudaran a responder este frente.</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
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

              {(front.sourceMode === 'perfil' || front.sourceMode === 'ambos') && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                    <p className="text-sm text-indigo-800" style={{ fontWeight: 600 }}>Perfiles / personas</p>
                    <p className="text-xs text-indigo-700 mt-1">Sirven para preparar una guia de entrevista alineada al frente.</p>
                  </div>
                  {profileSources.map((source, sourceIndex) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      selected={front.selectedSourceIds.includes(source.id)}
                      isProfile
                      sourceIndex={sourceIndex}
                      total={profileSources.length}
                      onToggleSource={onToggleSource}
                      onUpdateSource={onUpdateSource}
                      onMoveSource={onMoveSource}
                      onRemoveSource={onRemoveSource}
                    />
                  ))}
                </div>
              )}

              {(front.sourceMode === 'data' || front.sourceMode === 'ambos') && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-sky-100 bg-sky-50 p-3">
                    <p className="text-sm text-sky-800" style={{ fontWeight: 600 }}>Data / evidencia</p>
                    <p className="text-xs text-sky-700 mt-1">Sirve para preparar una guia de captura o revision de evidencia.</p>
                  </div>
                  {dataSources.map((source, sourceIndex) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      selected={front.selectedSourceIds.includes(source.id)}
                      isProfile={false}
                      sourceIndex={sourceIndex}
                      total={dataSources.length}
                      onToggleSource={onToggleSource}
                      onUpdateSource={onUpdateSource}
                      onMoveSource={onMoveSource}
                      onRemoveSource={onRemoveSource}
                    />
                  ))}
                </div>
              )}

              {front.sources.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">
                  Este frente aun no tiene fuentes. Agrega perfiles, data o ambas segun la evidencia que necesites conseguir.
                </div>
              )}
            </div>
          )}

          <SectionHeader
            number={3}
            title="Guia utilizable"
            helper="Genera una salida lista para copiar, compartir o afinar antes de usar."
            ready={guidesReady}
            open={guidesOpen}
            onToggle={() => setGuidesOpen(open => !open)}
          />
          {guidesOpen && (
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                <p className="text-sm text-sky-800" style={{ fontWeight: 600 }}>La salida de esta guia</p>
                <p className="text-xs text-sky-700 mt-1">
                  {front.selectedSourceIds.length > 0
                    ? 'La IA te ayudara a convertir este frente en preguntas de entrevista o en un formato de captura de data, segun la fuente elegida.'
                    : 'Primero selecciona al menos una fuente para generar la guia o el formato base correspondiente.'}
                </p>
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
                        frontTitle={front.title}
                        learningGoal={front.learningGoal}
                        onChangeIntro={nextIntro => onUpdateGuide(guide.id, updateGuideBody({ ...guide, intro: nextIntro, status: 'revisar' }))}
                        onChangeCriterion={(criterionIndex, nextValue) => {
                          const nextCriteria = guide.criteria.map((item, itemIndex) => itemIndex === criterionIndex ? nextValue : item);
                          onUpdateGuide(guide.id, updateGuideBody({ ...guide, criteria: nextCriteria, status: 'revisar' }));
                        }}
                        onAddCriterion={() => onUpdateGuide(guide.id, updateGuideBody({
                          ...guide,
                          criteria: [...guide.criteria, ''],
                          questionGroups: [...(guide.questionGroups || guide.criteria.map(() => [])), []],
                          status: 'revisar',
                        }))}
                        onRemoveCriterion={criterionIndex => {
                          const nextCriteria = guide.criteria.filter((_, itemIndex) => itemIndex !== criterionIndex);
                          const nextQuestionGroups = (guide.questionGroups || guide.criteria.map(() => []))
                            .filter((_, itemIndex) => itemIndex !== criterionIndex);
                          onUpdateGuide(guide.id, updateGuideBody({ ...guide, criteria: nextCriteria, questionGroups: nextQuestionGroups, status: 'revisar' }));
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
                        onChangeQuestion={(themeIndex, questionIndex, nextValue) => {
                          const nextQuestionGroups = (guide.questionGroups || guide.criteria.map(() => []))
                            .map((group, groupIndex) => groupIndex === themeIndex
                              ? group.map((item, itemIndex) => itemIndex === questionIndex ? nextValue : item)
                              : group);
                          onUpdateGuide(guide.id, updateGuideBody({ ...guide, questionGroups: nextQuestionGroups, status: 'revisar' }));
                        }}
                        onAddQuestion={themeIndex => {
                          const currentGroups = (guide.questionGroups || guide.criteria.map(() => []));
                          const totalQuestions = currentGroups.reduce((total, group) => total + group.length, 0);
                          if (totalQuestions >= 8) return;
                          const nextQuestionGroups = currentGroups.map((group, groupIndex) =>
                            groupIndex === themeIndex ? [...group, ''] : group,
                          );
                          onUpdateGuide(guide.id, updateGuideBody({ ...guide, questionGroups: nextQuestionGroups, status: 'revisar' }));
                        }}
                        onRemoveQuestion={(themeIndex, questionIndex) => {
                          const nextQuestionGroups = (guide.questionGroups || guide.criteria.map(() => []))
                            .map((group, groupIndex) => groupIndex === themeIndex
                              ? group.filter((_, itemIndex) => itemIndex !== questionIndex)
                              : group);
                          onUpdateGuide(guide.id, updateGuideBody({ ...guide, questionGroups: nextQuestionGroups, status: 'revisar' }));
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
                        onDownload={() => downloadGuide(updateGuideBody(guide))}
                        onShare={() => onShareGuide(updateGuideBody(guide))}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
