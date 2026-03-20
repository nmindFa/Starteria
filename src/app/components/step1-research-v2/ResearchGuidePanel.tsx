import React from 'react';
import { Copy, Share2, Sparkles } from 'lucide-react';
import { ResearchGuide } from './step1ResearchV2.types';

interface ResearchGuidePanelProps {
  guide: ResearchGuide;
  onChangeIntro: (nextIntro: string) => void;
  onChangeCriterion: (index: number, nextValue: string) => void;
  onAddCriterion: () => void;
  onRemoveCriterion: (index: number) => void;
  onChangeSuggestedSource: (index: number, nextValue: string) => void;
  onAddSuggestedSource: () => void;
  onRemoveSuggestedSource: (index: number) => void;
  onChangeQuestion: (index: number, nextValue: string) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (index: number) => void;
  onChangeInformationGap: (index: number, nextValue: string) => void;
  onAddInformationGap: () => void;
  onRemoveInformationGap: (index: number) => void;
  onCopy: () => void;
  onShare: () => void;
}

const renderEditableList = (
  items: string[],
  onChange: (index: number, nextValue: string) => void,
  onRemove: (index: number) => void,
) => (
  <div className="space-y-2">
    {items.map((item, index) => (
      <div key={index} className="flex items-start gap-2">
        <span className="text-xs text-slate-400 mt-2">{index + 1}.</span>
        <input
          value={item}
          onChange={event => onChange(index, event.target.value)}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => onRemove(index)}
          className="text-xs text-slate-400 hover:text-red-500 px-2 py-2"
        >
          Quitar
        </button>
      </div>
    ))}
  </div>
);

export function ResearchGuidePanel({
  guide,
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
  onShare,
}: ResearchGuidePanelProps) {
  const isDataGuide = guide.mode === 'data_review';
  const criteria = guide.criteria || [];
  const suggestedSources = guide.suggestedSources || [];
  const questions = guide.questions || [];
  const informationGaps = guide.informationGaps || [];

  return (
    <div className={`rounded-xl border ${guide.status === 'revisar' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} p-4 space-y-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Guia editable para {guide.sourceLabel}</p>
          <p className="text-xs text-slate-500">{isDataGuide ? 'Revision de data y fuentes de informacion' : 'Entrevista semi estructurada'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <span className={`text-xs px-2 py-0.5 rounded-full ${guide.status === 'revisar' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`} style={{ fontWeight: 600 }}>
            {guide.status === 'revisar' ? 'Requiere ajuste' : 'Lista para usar'}
          </span>
          <button
            onClick={onCopy}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Copy size={11} /> Copiar
          </button>
          <button
            onClick={onShare}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Share2 size={11} /> Compartir guia
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-violet-500" />
          <p className="text-xs text-violet-700" style={{ fontWeight: 600 }}>
            {isDataGuide ? '1. Proposito de la revision' : '1. Introduccion sugerida'}
          </p>
        </div>
        <textarea
          value={guide.intro}
          onChange={event => onChangeIntro(event.target.value)}
          rows={3}
          className="w-full border border-violet-200 rounded-xl px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
        />
      </div>

      {isDataGuide ? (
        <>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>2. Fuentes de informacion sugeridas</p>
                <p className="text-xs text-slate-500">Ajusta que registros, reportes, sistemas o documentos conviene revisar para este frente.</p>
              </div>
              <button
                onClick={onAddSuggestedSource}
                className="text-xs text-indigo-600 hover:text-indigo-700"
                style={{ fontWeight: 500 }}
              >
                Agregar fuente
              </button>
            </div>
            {renderEditableList(suggestedSources, onChangeSuggestedSource, onRemoveSuggestedSource)}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>3. Data o evidencia a capturar</p>
                <p className="text-xs text-slate-500">Define que informacion concreta conviene extraer, revisar o contrastar en esas fuentes.</p>
              </div>
              <button
                onClick={onAddCriterion}
                className="text-xs text-indigo-600 hover:text-indigo-700"
                style={{ fontWeight: 500 }}
              >
                Agregar evidencia
              </button>
            </div>
            {renderEditableList(criteria, onChangeCriterion, onRemoveCriterion)}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>4. Vacios de informacion detectables</p>
                <p className="text-xs text-slate-500">Anota que faltaria conseguir si la fuente actual no alcanza para confirmar o descartar el frente.</p>
              </div>
              <button
                onClick={onAddInformationGap}
                className="text-xs text-indigo-600 hover:text-indigo-700"
                style={{ fontWeight: 500 }}
              >
                Agregar vacio
              </button>
            </div>
            {renderEditableList(informationGaps, onChangeInformationGap, onRemoveInformationGap)}
          </div>
        </>
      ) : (
        <>
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>2. Criterios sugeridos a investigar</p>
                <p className="text-xs text-slate-500">Ajusta lo que conviene observar, validar o contrastar en este frente.</p>
              </div>
              <button
                onClick={onAddCriterion}
                className="text-xs text-indigo-600 hover:text-indigo-700"
                style={{ fontWeight: 500 }}
              >
                Agregar criterio
              </button>
            </div>
            {renderEditableList(criteria, onChangeCriterion, onRemoveCriterion)}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>3. Preguntas sugeridas</p>
                <p className="text-xs text-slate-500">Usa preguntas abiertas y claras. Puedes editarlas, quitar las que no sirvan o agregar nuevas hasta un maximo de 8.</p>
              </div>
              <button
                onClick={onAddQuestion}
                disabled={questions.length >= 8}
                className="text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-40"
                style={{ fontWeight: 500 }}
              >
                Agregar pregunta
              </button>
            </div>
            {renderEditableList(questions, onChangeQuestion, onRemoveQuestion)}
            <p className="text-xs text-slate-500 mt-2">Total actual: {questions.length} de 8 preguntas.</p>
          </div>
        </>
      )}
    </div>
  );
}
