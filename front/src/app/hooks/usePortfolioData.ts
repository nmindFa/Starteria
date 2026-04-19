/* ------------------------------------------------------------------ */
/*  usePortfolioData.ts - Hook to load all Portfolio Lead data        */
/* ------------------------------------------------------------------ */

import { useState, useEffect } from 'react';
import * as portfolioService from '../services/portfolioService';
import type {
  StrategicFront,
  Challenge,
  Initiative,
  InitiativeOverlap,
  ExecutiveOutput,
  InitiativeStep,
  InitiativePortfolioStatus,
  InitiativeContributionType,
  EstimatedContribution,
  InitiativeStepProgressState,
} from '../portfolio/PortfolioLeadContext';

// ---------- Backend initiative meta shape ----------
// The backend returns InitiativePortfolioMeta with embedded project fields.
// All portfolio tracking fields now have explicit columns in the schema,
// so the shape maps 1:1 to the Context Initiative type.

interface BackendInitiativeMeta {
  // Record identity
  id?: string;
  projectId: string;
  challengeId: string;
  strategicFrontId?: string | null;
  // Explicit portfolio tracking columns (from updated schema)
  currentStep?: InitiativeStep | null;
  status?: InitiativePortfolioStatus | null;
  mentor?: string | null;
  sponsorTouchpoint?: string | null;
  mainAlert?: string | null;
  nextActionRecommended?: string | null;
  attackedArea?: string | null;
  hypothesisCovered?: string | null;
  mainMetric?: string | null;
  contributionType?: InitiativeContributionType | null;
  estimatedContribution?: EstimatedContribution | null;
  lastActivity?: string | null;
  signalSummary?: string | null;
  mainBlocker?: string | null;
  teamLabel?: string | null;
  requiresSponsor?: boolean | null;
  readyForDecision?: boolean | null;
  blockedDays?: number | null;
  requiresExternalCapability?: boolean | null;
  partialSignal?: boolean | null;
  resolvedCorePart?: boolean | null;
  executiveSummary?: string | null;
  experimentSummary?: string | null;
  aiCommentSummary?: string | null;
  mentorCommentSummary?: string | null;
  decisionRecommendationReason?: string | null;
  // Complex arrays stored as Json in DB, arrive as parsed values
  teamMembers?: string[] | null;
  deliverables?: Array<{ id: string; title: string; type: 'Resumen' | 'PDF' | 'Deck' | 'Video' | 'Link'; note: string }> | null;
  stepsTimeline?: Array<{ step: InitiativeStep; state: InitiativeStepProgressState; note: string }> | null;
  // Project fields embedded via include
  name?: string | null;
  teamOwner?: string | null;
  project?: { id: string; name: string; status: string };
}

/**
 * Adapts a backend initiative record (InitiativePortfolioMeta + embedded project)
 * into the Initiative type expected by PortfolioLeadContext.
 *
 * Since all tracking fields now have explicit DB columns, this is a direct
 * field mapping with null-to-default coercion. The initiative id is the
 * projectId (the Project record is the canonical initiative entity).
 */
export function adaptInitiative(raw: BackendInitiativeMeta): Initiative {
  const projectName = raw.name ?? raw.project?.name ?? '';
  return {
    id: raw.projectId,
    name: projectName,
    strategicFrontId: raw.strategicFrontId ?? '',
    challengeId: raw.challengeId,
    teamOwner: raw.teamOwner ?? '',
    currentStep: raw.currentStep ?? 'Step 0',
    status: raw.status ?? 'en_step_0',
    mentor: raw.mentor ?? '',
    sponsorTouchpoint: raw.sponsorTouchpoint ?? '',
    mainAlert: raw.mainAlert ?? '',
    nextActionRecommended: raw.nextActionRecommended ?? '',
    attackedArea: raw.attackedArea ?? '',
    hypothesisCovered: raw.hypothesisCovered ?? '',
    mainMetric: raw.mainMetric ?? '',
    contributionType: raw.contributionType ?? 'descubrir',
    estimatedContribution: raw.estimatedContribution ?? 'bajo',
    lastActivity: raw.lastActivity ?? '',
    signalSummary: raw.signalSummary ?? '',
    mainBlocker: raw.mainBlocker ?? '',
    teamLabel: raw.teamLabel ?? '',
    requiresSponsor: raw.requiresSponsor ?? false,
    readyForDecision: raw.readyForDecision ?? false,
    blockedDays: raw.blockedDays ?? 0,
    requiresExternalCapability: raw.requiresExternalCapability ?? false,
    partialSignal: raw.partialSignal ?? false,
    resolvedCorePart: raw.resolvedCorePart ?? false,
    teamMembers: raw.teamMembers ?? [],
    executiveSummary: raw.executiveSummary ?? '',
    experimentSummary: raw.experimentSummary ?? '',
    deliverables: raw.deliverables ?? [],
    aiCommentSummary: raw.aiCommentSummary ?? '',
    mentorCommentSummary: raw.mentorCommentSummary ?? '',
    decisionRecommendationReason: raw.decisionRecommendationReason ?? '',
    stepsTimeline: raw.stepsTimeline ?? [],
  };
}

// ---------- Hook return type ----------

export interface UsePortfolioDataReturn {
  strategicFronts: StrategicFront[];
  setStrategicFronts: React.Dispatch<React.SetStateAction<StrategicFront[]>>;
  challenges: Challenge[];
  setChallenges: React.Dispatch<React.SetStateAction<Challenge[]>>;
  initiatives: Initiative[];
  setInitiatives: React.Dispatch<React.SetStateAction<Initiative[]>>;
  initiativeOverlaps: InitiativeOverlap[];
  setInitiativeOverlaps: React.Dispatch<React.SetStateAction<InitiativeOverlap[]>>;
  executiveOutputs: ExecutiveOutput[];
  setExecutiveOutputs: React.Dispatch<React.SetStateAction<ExecutiveOutput[]>>;
  loading: boolean;
  error: string | null;
}

/**
 * Loads all Portfolio Lead data from the backend on mount.
 *
 * Load order:
 *   1. Fetch all strategic fronts.
 *   2. Fetch challenges for every front in parallel.
 *   3. Fetch initiatives, overlaps and executive outputs for every
 *      challenge in parallel.
 *
 * Uses a cancelled flag for safe cleanup when the component unmounts
 * before the async work completes.
 */
export function usePortfolioData(): UsePortfolioDataReturn {
  const [strategicFronts, setStrategicFronts] = useState<StrategicFront[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [initiativeOverlaps, setInitiativeOverlaps] = useState<InitiativeOverlap[]>([]);
  const [executiveOutputs, setExecutiveOutputs] = useState<ExecutiveOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (typeof window !== 'undefined' && window.location.pathname === '/auth') {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Step 1: strategic fronts
        const fronts = await portfolioService.listStrategicFronts();
        if (cancelled) return;

        // Step 2: challenges for all fronts in parallel
        const challengeArrays = await Promise.all(
          fronts.map(front => portfolioService.listChallenges(front.id)),
        );
        if (cancelled) return;

        const allChallenges = challengeArrays.flat();

        // Step 3: initiatives, overlaps and executive outputs for every
        //         challenge, all in parallel
        const [initiativeArrays, overlapArrays, outputArrays] = await Promise.all([
          Promise.all(
            allChallenges.map(challenge => portfolioService.listInitiatives(challenge.id)),
          ),
          Promise.all(
            allChallenges.map(challenge => portfolioService.listOverlaps(challenge.id)),
          ),
          Promise.all(
            allChallenges.map(challenge => portfolioService.listExecutiveOutputs(challenge.id)),
          ),
        ]);
        if (cancelled) return;

        // The backend returns Initiative objects directly from listInitiatives.
        // If the backend returns raw BackendInitiativeMeta instead, wrap with:
        //   initiativeArrays.flat().map(adaptInitiative)
        const allInitiatives = initiativeArrays.flat() as Initiative[];
        const allOverlaps = overlapArrays.flat();
        const allOutputs = outputArrays.flat();

        setStrategicFronts(fronts);
        setChallenges(allChallenges);
        setInitiatives(allInitiatives);
        setInitiativeOverlaps(allOverlaps);
        setExecutiveOutputs(allOutputs);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Error loading portfolio data';
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    strategicFronts,
    setStrategicFronts,
    challenges,
    setChallenges,
    initiatives,
    setInitiatives,
    initiativeOverlaps,
    setInitiativeOverlaps,
    executiveOutputs,
    setExecutiveOutputs,
    loading,
    error,
  };
}
