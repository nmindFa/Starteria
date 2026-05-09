import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../services/portfolioService', () => ({
  listStrategicFronts: vi.fn(),
  listChallenges: vi.fn(),
  listInitiatives: vi.fn(),
  listOverlaps: vi.fn(),
  listExecutiveOutputs: vi.fn(),
}));

import * as portfolioService from '../../services/portfolioService';
import { adaptInitiative, usePortfolioData } from '../usePortfolioData';

describe('adaptInitiative — pure mapping with defaults', () => {
  it('coerces null/undefined fields into safe defaults', () => {
    const result = adaptInitiative({
      projectId: 'p1',
      challengeId: 'c1',
      strategicFrontId: undefined,
      name: undefined,
      project: { id: 'p1', name: 'My Project', status: 'IN_PROGRESS' },
      teamOwner: undefined,
      currentStep: undefined,
      status: undefined,
      mentor: null,
      sponsorTouchpoint: null,
      mainAlert: null,
      nextActionRecommended: null,
      attackedArea: null,
      hypothesisCovered: null,
      mainMetric: null,
      contributionType: undefined,
      estimatedContribution: undefined,
      lastActivity: null,
      signalSummary: null,
      mainBlocker: null,
      teamLabel: null,
      requiresSponsor: undefined,
      readyForDecision: undefined,
      blockedDays: undefined,
      requiresExternalCapability: undefined,
      partialSignal: undefined,
      resolvedCorePart: undefined,
      teamMembers: undefined,
      executiveSummary: null,
      experimentSummary: null,
      deliverables: undefined,
      aiCommentSummary: null,
      mentorCommentSummary: null,
      decisionRecommendationReason: null,
      stepsTimeline: undefined,
    });

    expect(result.id).toBe('p1');
    expect(result.name).toBe('My Project'); // falls back from project.name
    expect(result.strategicFrontId).toBe('');
    expect(result.challengeId).toBe('c1');
    expect(result.teamOwner).toBe('');
    expect(result.currentStep).toBe('Step 0');
    expect(result.status).toBe('en_step_0');
    expect(result.contributionType).toBe('descubrir');
    expect(result.estimatedContribution).toBe('bajo');
    expect(result.requiresSponsor).toBe(false);
    expect(result.readyForDecision).toBe(false);
    expect(result.blockedDays).toBe(0);
    expect(result.requiresExternalCapability).toBe(false);
    expect(result.partialSignal).toBe(false);
    expect(result.resolvedCorePart).toBe(false);
    expect(result.teamMembers).toEqual([]);
    expect(result.deliverables).toEqual([]);
    expect(result.stepsTimeline).toEqual([]);
  });

  it('preserves provided values', () => {
    const result = adaptInitiative({
      projectId: 'p2',
      challengeId: 'c2',
      strategicFrontId: 'f9',
      name: 'Custom name',
      teamOwner: 'Alice',
      currentStep: 'Step 1',
      status: 'avanzando',
      mentor: 'Bob',
      requiresSponsor: true,
      readyForDecision: true,
      blockedDays: 5,
      teamMembers: ['x', 'y'],
      deliverables: [
        { id: 'd1', title: 'D1', type: 'Resumen', note: 'n' },
      ],
      stepsTimeline: [
        { step: 'Step 0', state: 'completed', note: 'ok' },
      ],
    } as Parameters<typeof adaptInitiative>[0]);

    expect(result.name).toBe('Custom name');
    expect(result.strategicFrontId).toBe('f9');
    expect(result.teamOwner).toBe('Alice');
    expect(result.currentStep).toBe('Step 1');
    expect(result.status).toBe('avanzando');
    expect(result.mentor).toBe('Bob');
    expect(result.requiresSponsor).toBe(true);
    expect(result.readyForDecision).toBe(true);
    expect(result.blockedDays).toBe(5);
    expect(result.teamMembers).toEqual(['x', 'y']);
    expect(result.deliverables).toHaveLength(1);
    expect(result.stepsTimeline).toHaveLength(1);
  });

  it('uses raw.name when present, else project.name, else empty string', () => {
    const noName = adaptInitiative({
      projectId: 'p3',
      challengeId: 'c1',
    });
    expect(noName.name).toBe('');

    const fromProject = adaptInitiative({
      projectId: 'p4',
      challengeId: 'c1',
      project: { id: 'p4', name: 'Proj', status: 'DRAFT' },
    });
    expect(fromProject.name).toBe('Proj');

    const fromName = adaptInitiative({
      projectId: 'p5',
      challengeId: 'c1',
      name: 'Direct',
      project: { id: 'p5', name: 'Other', status: 'DRAFT' },
    });
    expect(fromName.name).toBe('Direct');
  });
});

describe('usePortfolioData — hook lifecycle', () => {
  const listStrategicFronts = portfolioService.listStrategicFronts as unknown as ReturnType<typeof vi.fn>;
  const listChallenges = portfolioService.listChallenges as unknown as ReturnType<typeof vi.fn>;
  const listInitiatives = portfolioService.listInitiatives as unknown as ReturnType<typeof vi.fn>;
  const listOverlaps = portfolioService.listOverlaps as unknown as ReturnType<typeof vi.fn>;
  const listExecutiveOutputs = portfolioService.listExecutiveOutputs as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    listStrategicFronts.mockReset();
    listChallenges.mockReset();
    listInitiatives.mockReset();
    listOverlaps.mockReset();
    listExecutiveOutputs.mockReset();
  });

  it('skips load when on /auth route', async () => {
    const orig = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...orig, pathname: '/auth' },
      writable: true,
      configurable: true,
    });
    const { result } = renderHook(() => usePortfolioData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listStrategicFronts).not.toHaveBeenCalled();
    Object.defineProperty(window, 'location', {
      value: orig,
      writable: true,
      configurable: true,
    });
  });

  it('loads fronts -> challenges -> initiatives/overlaps/outputs sequentially', async () => {
    const orig = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...orig, pathname: '/dashboard' },
      writable: true,
      configurable: true,
    });

    listStrategicFronts.mockResolvedValueOnce([{ id: 'f1' }, { id: 'f2' }]);
    listChallenges
      .mockResolvedValueOnce([{ id: 'c1' }])
      .mockResolvedValueOnce([{ id: 'c2' }]);
    listInitiatives
      .mockResolvedValueOnce([{ id: 'i1' }])
      .mockResolvedValueOnce([{ id: 'i2' }]);
    listOverlaps
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'o1' }]);
    listExecutiveOutputs
      .mockResolvedValueOnce([{ id: 'e1' }])
      .mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePortfolioData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.strategicFronts).toHaveLength(2);
    expect(result.current.challenges).toHaveLength(2);
    expect(result.current.initiatives).toHaveLength(2);
    expect(result.current.initiativeOverlaps).toHaveLength(1);
    expect(result.current.executiveOutputs).toHaveLength(1);
    expect(result.current.error).toBeNull();

    Object.defineProperty(window, 'location', {
      value: orig,
      writable: true,
      configurable: true,
    });
  });

  it('captures errors when fronts fetch fails', async () => {
    const orig = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...orig, pathname: '/dashboard' },
      writable: true,
      configurable: true,
    });

    listStrategicFronts.mockRejectedValueOnce(new Error('fronts down'));
    const { result } = renderHook(() => usePortfolioData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('fronts down');

    Object.defineProperty(window, 'location', {
      value: orig,
      writable: true,
      configurable: true,
    });
  });

  it('uses generic error message for non-Error rejections', async () => {
    const orig = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...orig, pathname: '/dashboard' },
      writable: true,
      configurable: true,
    });

    listStrategicFronts.mockRejectedValueOnce('plain failure');
    const { result } = renderHook(() => usePortfolioData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Error loading portfolio data');

    Object.defineProperty(window, 'location', {
      value: orig,
      writable: true,
      configurable: true,
    });
  });
});
