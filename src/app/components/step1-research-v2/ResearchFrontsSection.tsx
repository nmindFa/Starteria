import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { ResearchFront, ResearchGuide, ResearchSourceType } from './step1ResearchV2.types';
import { ResearchFrontCard } from './ResearchFrontCard';

interface ResearchFrontsSectionProps {
  fronts: ResearchFront[];
  expandedFrontId: string | null;
  iaLoading: boolean;
  onToggleFront: (frontId: string) => void;
  onAddFront: () => void;
  onSuggestFronts: () => void;
  onMoveFront: (frontId: string, direction: 'up' | 'down') => void;
  onChangeFrontField: (frontId: string, field: 'title' | 'whyItMatters' | 'learningGoal', value: string) => void;
  onChangeFrontMode: (frontId: string, mode: ResearchFront['sourceMode']) => void;
  onToggleSource: (frontId: string, sourceId: string) => void;
  onAddSource: (frontId: string, type: ResearchSourceType) => void;
  onUpdateSource: (frontId: string, sourceId: string, field: 'label' | 'detail', value: string) => void;
  onRemoveSource: (frontId: string, sourceId: string) => void;
  onMoveSource: (frontId: string, sourceId: string, direction: 'up' | 'down') => void;
  onGenerateGuides: (frontId: string) => void;
  onUpdateGuide: (frontId: string, guideId: string, guide: ResearchGuide) => void;
  onCopyGuide: (guide: ResearchGuide) => void;
  onShareGuide: (guide: ResearchGuide) => void;
}

export function ResearchFrontsSection({
  fronts,
  expandedFrontId,
  iaLoading,
  onToggleFront,
  onAddFront,
  onSuggestFronts,
  onMoveFront,
  onChangeFrontField,
  onChangeFrontMode,
  onToggleSource,
  onAddSource,
  onUpdateSource,
  onRemoveSource,
  onMoveSource,
  onGenerateGuides,
  onUpdateGuide,
  onCopyGuide,
  onShareGuide,
}: ResearchFrontsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs shrink-0 mt-0.5" style={{ fontWeight: 700 }}>2</span>
          <div>
            <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>Frentes de investigacion alineados</p>
            <p className="text-xs text-slate-500">
              Cada frente se organiza en tema, criterios a investigar y fuentes de datos o evidencia. Su estado se calcula automaticamente segun lo que completes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onAddFront} className="flex items-center gap-1.5 text-xs text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors" style={{ fontWeight: 500 }}>
            <Plus size={11} /> Agregar frente
          </button>
          <button onClick={onSuggestFronts} disabled={iaLoading} className="flex items-center gap-1.5 text-xs text-violet-600 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 rounded-lg border border-violet-100 transition-colors disabled:opacity-50" style={{ fontWeight: 500 }}>
            {iaLoading ? 'Generando...' : <><Sparkles size={11} /> IA sugiere</>}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {fronts.map((front, index) => (
          <ResearchFrontCard
            key={front.id}
            front={front}
            index={index}
            expanded={expandedFrontId === front.id}
            iaLoading={iaLoading}
            onToggle={() => onToggleFront(front.id)}
            onMove={direction => onMoveFront(front.id, direction)}
            canMoveUp={index > 0}
            canMoveDown={index < fronts.length - 1}
            onChangeField={(field, value) => onChangeFrontField(front.id, field, value)}
            onChangeMode={mode => onChangeFrontMode(front.id, mode)}
            onToggleSource={sourceId => onToggleSource(front.id, sourceId)}
            onAddSource={type => onAddSource(front.id, type)}
            onUpdateSource={(sourceId, field, value) => onUpdateSource(front.id, sourceId, field, value)}
            onRemoveSource={sourceId => onRemoveSource(front.id, sourceId)}
            onMoveSource={(sourceId, direction) => onMoveSource(front.id, sourceId, direction)}
            onGenerateGuides={() => onGenerateGuides(front.id)}
            onUpdateGuide={(guideId, guide) => onUpdateGuide(front.id, guideId, guide)}
            onCopyGuide={onCopyGuide}
            onShareGuide={onShareGuide}
          />
        ))}
      </div>
    </div>
  );
}
