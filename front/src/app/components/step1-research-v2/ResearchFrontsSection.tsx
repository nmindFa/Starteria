import React from 'react';
import { Plus } from 'lucide-react';
import { ResearchFront, ResearchGuide, ResearchSourceType } from './step1ResearchV2.types';
import { ResearchFrontCard } from './ResearchFrontCard';

interface ResearchFrontsSectionProps {
  fronts: ResearchFront[];
  expandedFrontId: string | null;
  iaLoading: boolean;
  focusEditable?: boolean;
  onGoToModuleA?: () => void;
  onToggleFront: (frontId: string) => void;
  onAddFront: () => void;
  onMoveFront: (frontId: string, direction: 'up' | 'down') => void;
  onChangeFrontField: (frontId: string, field: 'title' | 'whyItMatters' | 'learningGoal', value: string) => void;
  onChangeFrontMode: (frontId: string, mode: ResearchFront['sourceMode']) => void;
  onToggleSource: (frontId: string, sourceId: string) => void;
  onAddSource: (frontId: string, type: ResearchSourceType) => void;
  onUpdateSource: (frontId: string, sourceId: string, field: 'label' | 'detail' | 'owner' | 'accessPoint' | 'expectedLearning', value: string) => void;
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
  focusEditable = true,
  onGoToModuleA,
  onToggleFront,
  onAddFront,
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-sm text-slate-800" style={{ fontWeight: 600 }}>
            Estos temas vienen del Modulo A; aqui defines como capturar la informacion que necesitas validar
          </p>
          <p className="text-xs text-slate-500">
            Para cada tema, organiza fuentes, personas, lugares y guias base para salir a campo con foco.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onAddFront} className="flex items-center gap-1.5 text-xs text-indigo-600 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors" style={{ fontWeight: 500 }}>
            <Plus size={11} /> Agregar tema operativo
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
            focusEditable={focusEditable}
            onGoToModuleA={onGoToModuleA}
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
