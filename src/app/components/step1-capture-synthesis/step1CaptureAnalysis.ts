import {
  Step1CaptureAnalysisCriterionKey,
  Step1CaptureAnalysisFieldKey,
  Step1CaptureAnalysisTarget,
  Step1CaptureModuleContext,
  Step1CaptureSynthesisData,
} from '../step1-architecture/step1Architecture.types';

const FIELD_LABELS: Record<Step1CaptureAnalysisFieldKey, string> = {
  notes: 'Respuestas, notas o citas',
  finding: 'Hallazgo principal',
  surprises: 'Algo que sorprendio',
  evidence: 'Archivo o link',
  evidenceInsight: 'Insight de la evidencia',
  followUp: 'Decision de complementar',
};

interface FrontDiagnostic {
  id: string;
  title: string;
  learningGoal: string;
  frontType: 'qualitative' | 'data' | 'mixed';
  noteCount: number;
  findingCount: number;
  surpriseCount: number;
  evidenceCount: number;
  insightCount: number;
  needsFollowUp: boolean;
  missingQualitativeNotes: boolean;
  missingFinding: boolean;
  missingEvidence: boolean;
  missingEvidenceInsight: boolean;
}

const buildFrontDiagnostics = (context: Step1CaptureModuleContext, state: Step1CaptureSynthesisData): FrontDiagnostic[] =>
  context.researchFronts.map(front => {
    const captures = state.captures.filter(capture => capture.frontIds.includes(front.id));
    const evidences = state.evidences.filter(evidence => captures.some(capture => capture.id === evidence.captureRecordId));
    const qualitativeCaptures = captures.filter(capture => capture.sourceType === 'perfil');
    const dataCaptures = captures.filter(capture => capture.sourceType !== 'perfil');
    const frontType = qualitativeCaptures.length > 0 && dataCaptures.length > 0
      ? 'mixed'
      : dataCaptures.length > 0
      ? 'data'
      : 'qualitative';

    return {
      id: front.id,
      title: front.title || 'Frente sin titulo',
      learningGoal: front.learningGoal,
      frontType,
      noteCount: captures.filter(capture => capture.notes.trim().length > 0).length,
      findingCount: captures.filter(capture => capture.finding.trim().length > 0).length,
      surpriseCount: captures.filter(capture => capture.surprises.trim().length > 0).length,
      evidenceCount: evidences.length,
      insightCount: evidences.filter(evidence => evidence.insight.trim().length > 0).length,
      needsFollowUp: captures.some(capture => capture.needsFollowUp),
      missingQualitativeNotes: qualitativeCaptures.length > 0 && qualitativeCaptures.every(capture => capture.notes.trim().length === 0),
      missingFinding: captures.length > 0 && captures.every(capture => capture.finding.trim().length === 0),
      missingEvidence: captures.length > 0 && evidences.length === 0,
      missingEvidenceInsight: evidences.length > 0 && evidences.every(evidence => evidence.insight.trim().length === 0),
    };
  });

export const buildCaptureAnalysisSignature = (state: Step1CaptureSynthesisData) =>
  JSON.stringify({
    captures: state.captures
      .map(capture => ({
        id: capture.id,
        frontIds: [...capture.frontIds].sort(),
        notes: capture.notes.trim(),
        finding: capture.finding.trim(),
        surprises: capture.surprises.trim(),
        needsFollowUp: capture.needsFollowUp,
        status: capture.status,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    evidences: state.evidences
      .map(evidence => ({
        id: evidence.id,
        captureRecordId: evidence.captureRecordId,
        kind: evidence.kind,
        name: evidence.name.trim(),
        insight: evidence.insight.trim(),
        url: evidence.url || '',
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    organizedInsights: state.organizedInsights.map(item => item.trim()),
  });

const buildTarget = (
  front: FrontDiagnostic,
  fieldKey: Step1CaptureAnalysisFieldKey,
  missing: string,
  action: string,
): Step1CaptureAnalysisTarget => ({
  frontId: front.id,
  frontTitle: front.title,
  frontType: front.frontType,
  fieldKey,
  fieldLabel: FIELD_LABELS[fieldKey],
  missing,
  action,
});

const getCriterionTargets = (
  criterionKey: Step1CaptureAnalysisCriterionKey,
  diagnostics: FrontDiagnostic[],
): Step1CaptureAnalysisTarget[] => {
  const targets: Step1CaptureAnalysisTarget[] = [];
  const pushUnique = (target: Step1CaptureAnalysisTarget) => {
    if (!targets.some(item => item.frontId === target.frontId && item.fieldKey === target.fieldKey)) {
      targets.push(target);
    }
  };

  diagnostics.forEach(front => {
    if (criterionKey === 'scoped') {
      if (front.missingFinding) {
        pushUnique(buildTarget(front, 'finding', 'Todavia falta un hallazgo principal que acote mejor este frente.', 'Resume el aprendizaje mas claro que deja esta fuente.'));
      } else if (front.missingQualitativeNotes) {
        pushUnique(buildTarget(front, 'notes', 'Todavia faltan respuestas, notas o citas que ayuden a delimitar donde ocurre el problema.', 'Agrega notas concretas o citas que aterricen mejor la situacion.'));
      }
      return;
    }

    if (criterionKey === 'strategic') {
      if (front.missingEvidenceInsight) {
        pushUnique(buildTarget(front, 'evidenceInsight', 'Hay evidencia cargada, pero todavia no explica por que este problema importa.', 'Aclara en el insight el impacto en tiempo, costo, riesgo, servicio o productividad.'));
      } else if (front.missingFinding) {
        pushUnique(buildTarget(front, 'finding', 'Todavia falta un hallazgo que conecte este frente con un impacto relevante.', 'Resume mejor el impacto que tiene este frente para el equipo, el area o la operacion.'));
      }
      return;
    }

    if (criterionKey === 'real') {
      if (front.missingQualitativeNotes) {
        pushUnique(buildTarget(front, 'notes', 'Todavia faltan notas, respuestas o citas que muestren que el problema ocurre de verdad.', 'Agrega respuestas, notas o citas concretas de este frente.'));
      }
      if (front.missingEvidence) {
        pushUnique(buildTarget(front, 'evidence', 'Todavia no hay archivo o link que respalde este frente.', 'Sube un archivo o pega un link que confirme que esto esta ocurriendo.'));
      }
      return;
    }

    if (criterionKey === 'urgent') {
      if (front.missingEvidenceInsight) {
        pushUnique(buildTarget(front, 'evidenceInsight', 'Todavia falta mostrar frecuencia, retrasos, volumen o criticidad en este frente.', 'Aclara en el insight la frecuencia, el costo o el dano de no actuar.'));
      } else if (front.missingEvidence) {
        pushUnique(buildTarget(front, 'evidence', 'Todavia no hay evidencia documental o de data que muestre frecuencia o criticidad.', 'Sube un archivo o link con frecuencia, tiempos, volumen o diferencias relevantes.'));
      }
      return;
    }

    if (criterionKey === 'desirable') {
      if (front.frontType === 'data') {
        if (front.missingEvidenceInsight) {
          pushUnique(buildTarget(front, 'evidenceInsight', 'Todavia falta explicar por que esta evidencia vuelve deseable resolver el problema.', 'Aclara en el insight por que este problema vale la pena resolverlo ahora.'));
        }
      } else if (front.missingQualitativeNotes) {
        pushUnique(buildTarget(front, 'notes', 'Todavia faltan senales de interes real, frustracion o necesidad concreta.', 'Agrega citas o notas que muestren deseo real de resolver este problema.'));
      } else if (front.missingFinding) {
        pushUnique(buildTarget(front, 'finding', 'Todavia falta un hallazgo que explique por que resolverlo genera valor.', 'Refuerza el hallazgo principal con valor percibido o necesidad concreta.'));
      }
      return;
    }

    if (criterionKey === 'evidenceStrong') {
      if (front.missingEvidence) {
        pushUnique(buildTarget(front, 'evidence', 'Todavia falta respaldo documental o cuantitativo en este frente.', 'Sube un archivo o link adicional para complementar el sustento.'));
      }
      if (front.missingEvidenceInsight) {
        pushUnique(buildTarget(front, 'evidenceInsight', 'La evidencia existe, pero todavia no esta explicado que demuestra.', 'Resume en el insight que confirma, ajusta o cuestiona del problema.'));
      }
      if (front.needsFollowUp) {
        pushUnique(buildTarget(front, 'followUp', 'Este frente sigue marcado como insuficiente y necesita complemento.', 'Define si ya puedes avanzar o si hace falta conseguir mas informacion.'));
      }
    }
  });

  return targets.slice(0, 3);
};

const buildCriterionCopy = (
  criterionKey: Step1CaptureAnalysisCriterionKey,
  ok: boolean,
  targets: Step1CaptureAnalysisTarget[],
  diagnostics: FrontDiagnostic[],
) => {
  const targetNames = targets.map(target => target.frontTitle);
  const weakestFronts = diagnostics
    .filter(front => front.missingEvidence || front.missingFinding || front.missingQualitativeNotes || front.missingEvidenceInsight || front.needsFollowUp)
    .map(front => front.title);

  switch (criterionKey) {
    case 'scoped':
      return {
        label: 'Acotado',
        meaning: 'Evalua si el problema ya esta delimitado en una situacion, proceso, perfil o frente concreto.',
        reason: ok
          ? 'La evidencia ya permite describir con precision donde ocurre el problema y que parte del reto conviene priorizar.'
          : 'La evidencia todavia se ve amplia o dispersa, y eso hace dificil delimitar el problema con claridad.',
        missing: ok
          ? 'Este criterio ya tiene base suficiente para avanzar.'
          : targets[0]?.missing || 'Todavia falta aterrizar mejor el problema en los frentes mas debiles.',
        action: ok
          ? 'Mantiene esta delimitacion para el cierre.'
          : targets[0]
          ? `Vuelve a ${targets[0].frontTitle} y completa ${targets[0].fieldLabel.toLowerCase()}.`
          : `Vuelve a ${weakestFronts[0] || 'los frentes con menos evidencia'} y agrega informacion que delimite mejor donde ocurre el problema.`,
      };
    case 'strategic':
      return {
        label: 'Estrategico',
        meaning: 'Evalua si el problema importa a la empresa, area, equipo u otro resultado relevante.',
        reason: ok
          ? 'La evidencia ya conecta el problema con impacto relevante para el area, la operacion o el negocio.'
          : 'Todavia no queda suficientemente claro por que este problema importa a un resultado relevante.',
        missing: ok
          ? 'El impacto ya aparece explicado en la evidencia reunida.'
          : targets[0]?.missing || 'Todavia falta explicar mejor el impacto en tiempo, costo, riesgo, servicio o productividad.',
        action: ok
          ? 'Usa este impacto como parte del cierre.'
          : targets[0]
          ? `Refuerza ${targets[0].fieldLabel.toLowerCase()} en ${targets[0].frontTitle} para mostrar por que este problema si importa.`
          : `Refuerza el impacto en ${targetNames[0] || 'el frente mas debil'}.`,
      };
    case 'real':
      return {
        label: 'Real',
        meaning: 'Evalua si hay base suficiente para afirmar que el problema esta ocurriendo de verdad y no solo por percepcion.',
        reason: ok
          ? 'Ya hay notas, hallazgos y evidencias que muestran que el problema esta ocurriendo en la practica.'
          : 'La evidencia actual todavia no alcanza para confirmar que el problema es real y repetible.',
        missing: ok
          ? 'La ocurrencia del problema ya tiene respaldo minimo.'
          : targets[0]?.missing || 'Todavia faltan notas, archivos, links o evidencia directa en los frentes investigados.',
        action: ok
          ? 'Mantiene visibles estas pruebas en la sintesis.'
          : targets[0]
          ? `Completa ${targets[0].fieldLabel.toLowerCase()} en ${targets[0].frontTitle} para confirmar que el problema si esta ocurriendo.`
          : `Vuelve a ${targetNames.join(' y ') || 'los frentes activos'} y agrega evidencia directa.`,
      };
    case 'urgent':
      return {
        label: 'Urgente / importante',
        meaning: 'Evalua si vale la pena atenderlo pronto por impacto, criticidad o frecuencia.',
        reason: ok
          ? 'La evidencia ya deja ver frecuencia, criticidad o costo de no actuar.'
          : 'Todavia no esta suficientemente claro por que conviene atenderlo pronto o con prioridad.',
        missing: ok
          ? 'La prioridad del problema ya aparece en las evidencias.'
          : targets[0]?.missing || 'Todavia falta hacer visible la frecuencia, el dano o el costo de no resolverlo.',
        action: ok
          ? 'Usa esta senal para sostener la prioridad del problema.'
          : targets[0]
          ? `Refuerza ${targets[0].fieldLabel.toLowerCase()} en ${targets[0].frontTitle} para mostrar frecuencia, criticidad o costo.`
          : `Agrega evidencia de frecuencia o criticidad en ${targetNames[0] || 'el frente mas debil'}.`,
      };
    case 'desirable':
      return {
        label: 'Deseable',
        meaning: 'Evalua si existe interes real en resolver el problema y si se percibe valor en hacerlo.',
        reason: ok
          ? 'La evidencia ya muestra interes, necesidad o expectativa de resolver este problema.'
          : 'Todavia no se ve con claridad si resolverlo es algo que el equipo o los usuarios realmente valoran.',
        missing: ok
          ? 'La conveniencia de resolverlo ya aparece en los hallazgos.'
          : targets[0]?.missing || 'Todavia faltan senales de interes real, frustracion o necesidad concreta.',
        action: ok
          ? 'Conserva esta motivacion para el cierre.'
          : targets[0]
          ? `Vuelve a ${targets[0].frontTitle} y agrega ${targets[0].fieldLabel.toLowerCase()} que muestre interes real en resolverlo.`
          : `Busca evidencia de interes real en ${targetNames[0] || 'un frente cualitativo'}.`,
      };
    case 'evidenceStrong':
      return {
        label: 'Sustento suficiente',
        meaning: 'Evalua si ya tienes una base minima de evidencia cualitativa y cuantitativa para avanzar.',
        reason: ok
          ? 'Ya existe una base combinada de hallazgos y evidencias para sostener la decision.'
          : 'Todavia falta reunir o explicar mejor la evidencia disponible para cerrar con confianza.',
        missing: ok
          ? 'El modulo ya tiene una base minima para seguir.'
          : targets[0]?.missing || 'Todavia faltan archivos con insight claro, hallazgos mejor redactados o evidencia complementaria.',
        action: ok
          ? 'Ya puedes preparar el cierre final del modulo.'
          : targets[0]
          ? `Completa ${targets[0].fieldLabel.toLowerCase()} en ${targets[0].frontTitle} antes de intentar cerrar el modulo.`
          : `Complementa ${targetNames.join(' y ') || 'los frentes con menos sustento'} antes de cerrar el modulo.`,
      };
  }
};

export const buildModuleAnalysis = (context: Step1CaptureModuleContext, state: Step1CaptureSynthesisData) => {
  const diagnostics = buildFrontDiagnostics(context, state);
  const frontsCovered = diagnostics.filter(front =>
    front.noteCount > 0 || front.findingCount > 0 || front.evidenceCount > 0,
  ).length;
  const qualitativeCaptures = state.captures.filter(capture => capture.sourceType === 'perfil' && capture.notes.trim().length > 0).length;
  const evidencesWithInsight = state.evidences.filter(evidence => evidence.insight.trim().length > 0).length;
  const organizedInsights = state.organizedInsights.filter(item => item.trim().length > 0).length;
  const combinedText = [
    context.problemSummary,
    context.researchObjective,
    ...state.captures.map(capture => `${capture.notes} ${capture.finding} ${capture.surprises}`),
    ...state.evidences.map(evidence => `${evidence.name} ${evidence.insight}`),
    ...state.organizedInsights,
  ].join(' ').toLowerCase();

  const scoped = frontsCovered >= Math.max(1, Math.ceil(context.researchFronts.length / 2)) && organizedInsights >= 2;
  const strategic = /estrateg|cliente|cost|ingres|riesgo|productiv|equipo|area|operaci|tiempo/.test(combinedText) || evidencesWithInsight >= 2;
  const real = qualitativeCaptures + evidencesWithInsight >= Math.max(2, context.researchFronts.length);
  const urgent = /urg|critic|retras|perdid|riesgo|prioridad|dolor|frecuen/.test(combinedText) || evidencesWithInsight >= 3;
  const desirable = /resolver|mejorar|deseable|prioridad|quiere|necesari|reducir|evitar|valor/.test(combinedText) || organizedInsights >= 2;
  const evidenceStrong = evidencesWithInsight >= Math.max(1, context.researchFronts.length - 1) && state.captures.some(capture => capture.finding.trim().length > 0);

  let conclusion = 'El problema esta acotado, es estrategico y quiere ser resuelto.';
  if (!scoped) conclusion = 'Al problema le falta acotar.';
  else if (!strategic) conclusion = 'Al problema le falta ser estrategico.';
  else if (!desirable) conclusion = 'Al problema le falta deseabilidad.';
  else if (!evidenceStrong || !real) conclusion = 'Al problema le falta mayor sustento o mas informacion.';

  const criteria = ([
    ['scoped', scoped],
    ['strategic', strategic],
    ['real', real],
    ['urgent', urgent],
    ['desirable', desirable],
    ['evidenceStrong', evidenceStrong],
  ] as Array<[Step1CaptureAnalysisCriterionKey, boolean]>).map(([key, ok]) => {
    const targets = getCriterionTargets(key, diagnostics);
    const copy = buildCriterionCopy(key, ok, targets, diagnostics);
    return {
      key,
      label: copy.label,
      meaning: copy.meaning,
      ok,
      reason: copy.reason,
      missing: copy.missing,
      action: copy.action,
      frontTitles: targets.map(target => target.frontTitle),
      targets,
    };
  });

  const recommendations = criteria
    .filter(item => !item.ok)
    .map(item => {
      const target = item.targets[0];
      if (!target) {
        return `Revisa ${item.label.toLowerCase()} y agrega evidencia adicional antes de volver a analizar.`;
      }

      return `${item.label}: vuelve a ${target.frontTitle} y completa ${target.fieldLabel.toLowerCase()}. ${target.action}`;
    });

  if (recommendations.length === 0) {
    recommendations.push('Ya tienes base suficiente para generar el resumen final del modulo y preparar el paso siguiente.');
  }

  return {
    scoped,
    strategic,
    real,
    urgent,
    desirable,
    evidenceStrong,
    criteria,
    conclusion,
    recommendations,
    analyzedSignature: buildCaptureAnalysisSignature(state),
  };
};
