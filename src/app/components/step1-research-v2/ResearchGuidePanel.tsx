import React, { useMemo, useState } from 'react';
import { ChevronDown, Copy, Download, Share2, Sparkles } from 'lucide-react';
import { ResearchGuide } from './step1ResearchV2.types';

interface ResearchGuidePanelProps {
  guide: ResearchGuide;
  frontTitle: string;
  learningGoal: string;
  onChangeIntro: (nextIntro: string) => void;
  onChangeCriterion: (index: number, nextValue: string) => void;
  onAddCriterion: () => void;
  onRemoveCriterion: (index: number) => void;
  onChangeSuggestedSource: (index: number, nextValue: string) => void;
  onAddSuggestedSource: () => void;
  onRemoveSuggestedSource: (index: number) => void;
  onChangeQuestion: (themeIndex: number, questionIndex: number, nextValue: string) => void;
  onAddQuestion: (themeIndex: number) => void;
  onRemoveQuestion: (themeIndex: number, questionIndex: number) => void;
  onChangeInformationGap: (index: number, nextValue: string) => void;
  onAddInformationGap: () => void;
  onRemoveInformationGap: (index: number) => void;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
}

function GuideSection({
  title,
  helper,
  open,
  onToggle,
  children,
}: {
  title: string;
  helper: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>{title}</p>
          <p className="text-xs text-slate-500">{helper}</p>
        </div>
        <ChevronDown size={15} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

function EditableList({
  items,
  placeholder,
  onChange,
  onRemove,
}: {
  items: string[];
  placeholder: string;
  onChange: (index: number, nextValue: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="text-xs text-slate-400 mt-2">{index + 1}.</span>
          <input
            value={item}
            placeholder={placeholder}
            onChange={event => onChange(index, event.target.value)}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={() => onRemove(index)} className="text-xs text-slate-400 hover:text-red-500 px-2 py-2">
            Quitar
          </button>
        </div>
      ))}
    </div>
  );
}

export function ResearchGuidePanel({
  guide,
  frontTitle,
  learningGoal,
  onChangeIntro,
  onChangeCriterion,
  onAddCriterion,
  onRemoveCriterion,
  onChangeSuggestedSource,
  onAddSuggestedSource,
  onRemoveSuggestedSource,
  onChangeQuestion,
  onAddQuestion,
  onRemoveQuestion,
  onChangeInformationGap,
  onAddInformationGap,
  onRemoveInformationGap,
  onCopy,
  onDownload,
  onShare,
}: ResearchGuidePanelProps) {
  const isDataGuide = guide.mode === 'data_review';
  const criteria = guide.criteria || [];
  const questionGroups = useMemo(
    () => (guide.questionGroups || []).map(group => group || []),
    [guide.questionGroups],
  );
  const questionCount = questionGroups.reduce((total, group) => total + group.length, 0);
  const [panelOpen, setPanelOpen] = useState(guide.status === 'revisar');
  const [introOpen, setIntroOpen] = useState(guide.status === 'revisar');
  const [contentOpen, setContentOpen] = useState(guide.status === 'revisar');
  const [closingOpen, setClosingOpen] = useState(false);

  const summaryText = isDataGuide
    ? `${guide.criteria.length} dato(s) a capturar · ${guide.informationGaps.length} vacio(s)`
    : `${criteria.length} tema(s) · ${questionCount} pregunta(s)`;

  const stateLabel = guide.status === 'revisar' ? 'Requiere revision' : 'Lista para usar';

  return (
    <div className={`rounded-2xl border ${guide.status === 'revisar' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} overflow-hidden`}>
      <button
        onClick={() => setPanelOpen(open => !open)}
        className="w-full px-4 py-4 flex items-start justify-between gap-3 text-left"
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-slate-800" style={{ fontWeight: 700 }}>
              {isDataGuide ? 'Guia de captura de data' : 'Guia de entrevista'} · {guide.sourceLabel}
            </p>
            <span className="text-[11px] px-2 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200" style={{ fontWeight: 700 }}>
              Sugerido por IA
            </span>
            <span className={`text-[11px] px-2 py-1 rounded-full ${guide.status === 'revisar' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`} style={{ fontWeight: 700 }}>
              {stateLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
            <span>{frontTitle || 'Frente sin titulo'}</span>
            <span>{summaryText}</span>
          </div>
          <p className="text-xs text-slate-500">
            {guide.status === 'revisar'
              ? 'Editaste este borrador. Revisa los bloques abiertos y vuelve a alinear la guia con el tema y la fuente elegida.'
              : 'Es un borrador afinable. Puedes abrir solo la parte que quieras editar, copiarla o descargarla.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={event => {
                event.stopPropagation();
                setPanelOpen(true);
                setIntroOpen(true);
                setContentOpen(true);
              }}
              className="text-xs text-amber-700 hover:text-amber-900 px-2.5 py-1.5 bg-white border border-amber-200 rounded-lg"
              style={{ fontWeight: 600 }}
            >
              {guide.status === 'revisar' ? 'Revisar cambios' : 'Editar'}
            </button>
            <button
              onClick={event => {
                event.stopPropagation();
                onCopy();
              }}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
              style={{ fontWeight: 500 }}
            >
              <Copy size={11} /> Copiar
            </button>
            <button
              onClick={event => {
                event.stopPropagation();
                onDownload();
              }}
              className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg"
              style={{ fontWeight: 500 }}
            >
              <Download size={11} /> Descargar
            </button>
            <button
              onClick={event => {
                event.stopPropagation();
                onShare();
              }}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg"
              style={{ fontWeight: 500 }}
            >
              <Share2 size={11} /> Compartir
            </button>
          </div>
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {panelOpen && (
        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Tipo</p>
              <p className="text-sm text-slate-700 mt-1">{isDataGuide ? 'Captura de data' : 'Entrevista'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Tema</p>
              <p className="text-sm text-slate-700 mt-1">{frontTitle || 'Sin definir'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400" style={{ fontWeight: 700 }}>Enfoque</p>
              <p className="text-sm text-slate-700 mt-1">{learningGoal || 'Ajusta que necesitas validar en este frente.'}</p>
            </div>
          </div>

          {guide.status === 'revisar' && (
            <div className="rounded-xl border border-amber-200 bg-white p-3">
              <p className="text-xs text-amber-800" style={{ fontWeight: 700 }}>Que revisar ahora</p>
              <p className="text-xs text-amber-700 mt-1">
                La guia ya no coincide del todo con el tema, la fuente o los cambios que hiciste. Revisa primero la introduccion y luego los bloques de contenido que quedaron abiertos.
              </p>
            </div>
          )}

          <GuideSection
            title={isDataGuide ? 'Objetivo de revision' : 'Introduccion'}
            helper={isDataGuide ? 'Aclara para que revisarás esta fuente.' : 'Es la apertura base para iniciar la conversacion.'}
            open={introOpen}
            onToggle={() => setIntroOpen(open => !open)}
          >
            <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={12} className="text-violet-500" />
                <p className="text-xs text-violet-700" style={{ fontWeight: 700 }}>Borrador sugerido por IA</p>
              </div>
              <textarea
                value={guide.intro}
                onChange={event => onChangeIntro(event.target.value)}
                rows={3}
                className="w-full border border-violet-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
              />
              <p className="text-xs text-violet-700">
                Puedes editarlo, recortarlo o reescribirlo. La idea es que refleje como quieres abrir la conversacion o la revision.
              </p>
            </div>
          </GuideSection>

          {isDataGuide ? (
            <GuideSection
              title="Fuente y captura"
              helper="Define que revisar, que capturar y que podria quedar pendiente."
              open={contentOpen}
              onToggle={() => setContentOpen(open => !open)}
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Que fuente se revisara</p>
                      <p className="text-xs text-slate-500">Lista reportes, bases o documentos concretos.</p>
                    </div>
                    <button onClick={onAddSuggestedSource} className="text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
                      Agregar fuente
                    </button>
                  </div>
                  <EditableList
                    items={guide.suggestedSources || []}
                    onChange={onChangeSuggestedSource}
                    onRemove={onRemoveSuggestedSource}
                    placeholder="Ej. Reporte mensual exportado"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Que datos conviene capturar</p>
                      <p className="text-xs text-slate-500">Agrega solo la evidencia que te ayudara a confirmar o descartar este tema.</p>
                    </div>
                    <button onClick={onAddCriterion} className="text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
                      Agregar dato
                    </button>
                  </div>
                  <EditableList
                    items={guide.criteria || []}
                    onChange={onChangeCriterion}
                    onRemove={onRemoveCriterion}
                    placeholder="Ej. Cantidad de casos por mes"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Que vacios podrian seguir abiertos</p>
                      <p className="text-xs text-slate-500">Anota que faltaria conseguir si esta fuente no basta.</p>
                    </div>
                    <button onClick={onAddInformationGap} className="text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
                      Agregar vacio
                    </button>
                  </div>
                  <EditableList
                    items={guide.informationGaps || []}
                    onChange={onChangeInformationGap}
                    onRemove={onRemoveInformationGap}
                    placeholder="Ej. Falta corte por area"
                  />
                </div>
              </div>
            </GuideSection>
          ) : (
            <GuideSection
              title="Temas y preguntas"
              helper="Cada tema debe ayudarte a resolver una duda concreta con preguntas editables."
              open={contentOpen}
              onToggle={() => setContentOpen(open => !open)}
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>Temas de la conversacion</p>
                      <p className="text-xs text-slate-500">Cada tema organiza una parte de la entrevista.</p>
                    </div>
                    <button onClick={onAddCriterion} className="text-xs text-indigo-600 hover:text-indigo-700" style={{ fontWeight: 600 }}>
                      Agregar tema
                    </button>
                  </div>
                  <EditableList
                    items={criteria}
                    onChange={onChangeCriterion}
                    onRemove={onRemoveCriterion}
                    placeholder="Ej. Frecuencia del problema"
                  />
                </div>

                <div className="space-y-3">
                  {criteria.map((criterion, themeIndex) => {
                    const themeQuestions = questionGroups[themeIndex] || [];
                    return (
                      <div key={`${criterion}-${themeIndex}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <p className="text-xs text-slate-600" style={{ fontWeight: 700 }}>Tema {themeIndex + 1}</p>
                            <p className="text-sm text-slate-800 mt-1" style={{ fontWeight: 600 }}>{criterion || 'Tema sin definir'}</p>
                          </div>
                          <button
                            onClick={() => onAddQuestion(themeIndex)}
                            className="text-xs text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg"
                            style={{ fontWeight: 600 }}
                          >
                            Agregar pregunta
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">
                          Usa preguntas abiertas y concretas para entender este tema sin asumir la respuesta.
                        </p>
                        {themeQuestions.length > 0 ? (
                          <div className="space-y-2">
                            {themeQuestions.map((question, questionIndex) => (
                              <div key={questionIndex} className="flex items-start gap-2">
                                <span className="text-xs text-slate-400 mt-2">{themeIndex + 1}.{questionIndex + 1}</span>
                                <input
                                  value={question}
                                  onChange={event => onChangeQuestion(themeIndex, questionIndex, event.target.value)}
                                  placeholder="Ej. Que caso reciente recuerdas sobre este tema?"
                                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => onRemoveQuestion(themeIndex, questionIndex)}
                                  className="text-xs text-slate-400 hover:text-red-500 px-2 py-2"
                                >
                                  Quitar
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                            Este tema aun no tiene preguntas. Usa "Agregar pregunta" para crear la primera.
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {criteria.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
                      Agrega al menos un tema para empezar a construir preguntas alineadas.
                    </div>
                  )}
                </div>
              </div>
            </GuideSection>
          )}

          <GuideSection
            title="Cierre"
            helper={isDataGuide ? 'Aclara que haras despues de revisar la evidencia.' : 'Deja una ultima pregunta para detectar que sigue abierto.'}
            open={closingOpen}
            onToggle={() => setClosingOpen(open => !open)}
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>
                {isDataGuide ? 'Siguiente accion sugerida' : 'Cierre sugerido'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {isDataGuide
                  ? 'Revisa si la evidencia confirma, ajusta o descarta el tema antes de sacar una conclusion.'
                  : 'Cierra preguntando que hace falta entender mejor antes de terminar la conversacion.'}
              </p>
            </div>
          </GuideSection>
        </div>
      )}
    </div>
  );
}
