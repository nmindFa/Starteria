import { Step1ResearchModuleV2State } from '../step1-research-v2/step1ResearchV2.types';
import {
  Step1CaptureNormalizationInput,
  Step1CaptureRecord,
  Step1CaptureSynthesisData,
} from './step1Architecture.types';

const normalizeList = <T,>(value: T[] | T | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const normalizeStringList = (value: string[] | string | null | undefined): string[] =>
  normalizeList(value)
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);

const buildGuideSummary = (
  guide?: {
    criteria?: string[] | string;
    questions?: string[] | string;
    recommendations?: string[] | string;
  },
) => {
  const criteria = normalizeStringList(guide?.criteria);
  const questions = normalizeStringList(guide?.questions);
  const recommendations = normalizeStringList(guide?.recommendations);

  return [...criteria, ...questions, ...recommendations].join(' ').trim();
};

const buildCaptureRecordsFromResearch = (researchState: Step1ResearchModuleV2State): Step1CaptureRecord[] => {
  const records = new Map<string, Step1CaptureRecord>();

  normalizeList(researchState.fronts).forEach(front => {
    const selectedSourceIds = normalizeStringList(front?.selectedSourceIds);
    const sources = normalizeList(front?.sources);
    const guides = normalizeList(front?.guides);

    selectedSourceIds.forEach(sourceId => {
      const source = sources.find(item => item?.id === sourceId);
      if (!source) return;

      const guideList = guides.filter(guide => guide?.sourceId === sourceId);
      const existing = records.get(sourceId);
      const guideSummary = buildGuideSummary(guideList[0]);

      if (existing) {
        existing.frontIds = Array.from(new Set([...existing.frontIds, front.id]));
        existing.frontTitles = Array.from(new Set([...existing.frontTitles, front.title || 'Frente sin titulo']));
        existing.guideIds = Array.from(new Set([...existing.guideIds, ...guideList.map(guide => guide.id)]));
        existing.guideSummary = existing.guideSummary || guideSummary;
        existing.guideBody = existing.guideBody || guideList[0]?.body || '';
        return;
      }

      records.set(sourceId, {
        id: `capture-${sourceId}`,
        sourceId,
        sourceLabel: source.label,
        sourceType: source.type === 'perfil' ? 'perfil' : 'data',
        sourceDetail: source.detail,
        frontIds: [front.id],
        frontTitles: [front.title || 'Frente sin titulo'],
        guideIds: guideList.map(guide => guide.id),
        guideSummary,
        guideBody: guideList[0]?.body || '',
        notes: '',
        finding: '',
        surprises: '',
        needsFollowUp: false,
        status: 'pendiente',
      });
    });
  });

  return Array.from(records.values());
};

const mapLegacyDecision = (
  validationDecision?: '' | 'mantiene' | 'ajusta' | 'cambia',
  synthesisDecision?: '' | 'mantener' | 'acotar' | 'reformular' | 'cambiar',
): Step1CaptureSynthesisData['finalDecision'] => {
  if (synthesisDecision === 'mantener') return 'mantener';
  if (synthesisDecision === 'reformular' || synthesisDecision === 'cambiar') return 'reformular';
  if (synthesisDecision === 'acotar') return 'ajustar';
  if (validationDecision === 'mantiene') return 'mantener';
  if (validationDecision === 'ajusta') return 'ajustar';
  if (validationDecision === 'cambia') return 'reformular';
  return '';
};

export const normalizeCaptureSynthesisState = ({
  researchState,
  legacyRestrictions,
  legacyValidation,
  legacySynthesis,
}: Step1CaptureNormalizationInput): Step1CaptureSynthesisData => {
  const researchCaptures = buildCaptureRecordsFromResearch(researchState);
  const legacyCaptureByLabel = new Map(
    (legacyValidation?.fuentes || []).map(source => [source.rolNombre.trim().toLowerCase(), source]),
  );

  const captures = researchCaptures.map(capture => {
    const legacySource = legacyCaptureByLabel.get(capture.sourceLabel.trim().toLowerCase());
    return {
      ...capture,
      notes: legacySource?.queConfirmar || '',
      finding: legacySource?.porQue || '',
      status: legacySource?.queConfirmar || legacySource?.porQue ? 'completo' : 'pendiente',
    };
  });

  (legacyValidation?.fuentes || []).forEach(source => {
    const sourceLabel = source.rolNombre.trim();
    if (!sourceLabel) return;
    if (captures.some(capture => capture.sourceLabel.trim().toLowerCase() === sourceLabel.toLowerCase())) return;

    captures.push({
      id: `capture-legacy-${source.id}`,
      sourceId: source.id,
      sourceLabel,
      sourceType: source.tipo === 'datos' ? 'data' : source.tipo === 'documento' ? 'documento' : 'perfil',
      sourceDetail: source.porQue,
      frontIds: [],
      frontTitles: [],
      guideIds: [],
      guideSummary: '',
      guideBody: '',
      notes: source.queConfirmar || '',
      finding: source.porQue || '',
      surprises: '',
      needsFollowUp: false,
      status: source.queConfirmar || source.porQue ? 'completo' : 'pendiente',
    });
  });

  return {
    captures,
    evidences: (legacyValidation?.evidencias || []).map(evidence => ({
      id: evidence.id,
      kind: evidence.tipo || 'nota',
      name: evidence.nombre,
      insight: evidence.queDemuestra,
      captureRecordId: captures[0]?.id || '',
    })),
    organizedInsights: legacyValidation?.queAjusto?.length
      ? legacyValidation.queAjusto
      : ['', ''],
    finalSummary: legacySynthesis?.resumen || legacyValidation?.nuevaVersionReto || '',
    finalDecision: mapLegacyDecision(legacyValidation?.decisionReto, legacySynthesis?.pivotCheck),
    finalRationale: legacySynthesis?.razonPivot || '',
    aiAnalysis: null,
    version: legacySynthesis?.version || 1,
    legacyContext: {
      restrictionsNotes: [
        ...(legacyRestrictions?.limitesChips || []),
        legacyRestrictions?.limitesTexto || '',
        legacyRestrictions?.dependencia || '',
        legacyRestrictions?.alternativaPiloto || '',
      ].filter(Boolean),
      reviewOwner: legacyRestrictions?.vistoBueno || '',
      teamCapacity: legacyRestrictions?.capacidadReal || '',
    },
  };
};

export const syncCaptureSynthesisWithResearch = (
  current: Step1CaptureSynthesisData,
  researchState: Step1ResearchModuleV2State,
): Step1CaptureSynthesisData => {
  const nextRecords = buildCaptureRecordsFromResearch(researchState);

  return {
    ...current,
    captures: nextRecords.map(record => {
      const existing = current.captures.find(item => item.sourceId === record.sourceId);
      if (!existing) return record;

      return {
        ...record,
        notes: existing.notes,
        finding: existing.finding,
        surprises: existing.surprises || '',
        needsFollowUp: existing.needsFollowUp || false,
        status: existing.status,
      };
    }),
    evidences: current.evidences.filter(evidence =>
      nextRecords.some(record => record.id === evidence.captureRecordId) || !evidence.captureRecordId,
    ),
  };
};
