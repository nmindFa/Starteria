/* ------------------------------------------------------------------ */
/*  portfolioService.ts - Service layer for Portfolio Lead operations  */
/* ------------------------------------------------------------------ */

import api from './api';
import type {
  StrategicFront,
  CreateStrategicFrontInput,
  Challenge,
  CreateChallengeInput,
  ChallengeActivationMode,
  StakeholderStatus,
  InvitationStatus,
  SquadRole,
  Initiative,
  InitiativeOverlap,
  ExecutiveOutput,
  PortfolioDecisionOutcome,
} from '../portfolio/PortfolioLeadContext';

// ---------- Response shape from backend ----------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------- Backend raw shapes (snake_case may differ) ----------
// We treat the backend responses as the same shape as our types
// since the backend for portfolio was designed alongside the frontend types.
// Add adapters here if naming diverges in the future.

// ── Strategic Fronts ──────────────────────────────────────────────

/** List all strategic fronts. */
export async function listStrategicFronts(): Promise<StrategicFront[]> {
  const { data } = await api.get<ApiResponse<StrategicFront[]>>('/portfolio/strategic-fronts');
  return data.data;
}

/** Create a new strategic front. */
export async function createStrategicFront(input: CreateStrategicFrontInput): Promise<StrategicFront> {
  const { data } = await api.post<ApiResponse<StrategicFront>>('/portfolio/strategic-fronts', input);
  return data.data;
}

/** Update an existing strategic front (partial). */
export async function updateStrategicFront(
  id: string,
  input: Partial<CreateStrategicFrontInput>,
): Promise<StrategicFront> {
  const { data } = await api.patch<ApiResponse<StrategicFront>>(
    `/portfolio/strategic-fronts/${id}`,
    input,
  );
  return data.data;
}

/** Delete a strategic front. */
export async function deleteStrategicFront(id: string): Promise<void> {
  await api.delete(`/portfolio/strategic-fronts/${id}`);
}

// ── Challenges ────────────────────────────────────────────────────

/** List challenges belonging to a strategic front. */
export async function listChallenges(frontId: string): Promise<Challenge[]> {
  const { data } = await api.get<ApiResponse<Challenge[]>>(
    `/portfolio/strategic-fronts/${frontId}/challenges`,
  );
  return data.data;
}

/** Create a challenge under a strategic front. */
export async function createChallenge(
  frontId: string,
  input: CreateChallengeInput,
): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/strategic-fronts/${frontId}/challenges`,
    input,
  );
  return data.data;
}

/** Update a challenge (partial). */
export async function updateChallenge(
  id: string,
  input: Partial<Challenge>,
): Promise<Challenge> {
  const { data } = await api.patch<ApiResponse<Challenge>>(
    `/portfolio/challenges/${id}`,
    input,
  );
  return data.data;
}

/** Add an invitation to a challenge's selectedPeople list. */
export async function addInvitation(
  challengeId: string,
  value: string,
): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/invitations`,
    { value },
  );
  return data.data;
}

/** Update the status of a specific invitation. */
export async function updateInvitation(
  challengeId: string,
  invId: string,
  status: InvitationStatus,
): Promise<Challenge> {
  const { data } = await api.patch<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/invitations/${invId}`,
    { status },
  );
  return data.data;
}

/** Add a member to a challenge's assignedSquad. */
export async function addSquadMember(
  challengeId: string,
  value: string,
  role: SquadRole,
): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/squad`,
    { value, role },
  );
  return data.data;
}

/** Update the role of a squad member. */
export async function updateSquadMember(
  challengeId: string,
  memberId: string,
  role: SquadRole,
): Promise<Challenge> {
  const { data } = await api.patch<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/squad/${memberId}`,
    { role },
  );
  return data.data;
}

/** Activate the open call for a challenge. */
export async function activateOpenCall(challengeId: string): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/activate-open-call`,
  );
  return data.data;
}

/** Publish a challenge so it becomes visible to participants. */
export async function publishChallenge(challengeId: string): Promise<Challenge> {
  const { data } = await api.post<ApiResponse<Challenge>>(
    `/portfolio/challenges/${challengeId}/publish`,
  );
  return data.data;
}

// ── Initiatives ───────────────────────────────────────────────────

/** List initiatives belonging to a challenge. */
export async function listInitiatives(challengeId: string): Promise<Initiative[]> {
  const { data } = await api.get<ApiResponse<Initiative[]>>(
    `/portfolio/challenges/${challengeId}/initiatives`,
  );
  return data.data;
}

/** Upsert the portfolio meta for an initiative (project). */
export async function upsertInitiativeMeta(
  projectId: string,
  input: Partial<Initiative>,
): Promise<Initiative> {
  const { data } = await api.put<ApiResponse<Initiative>>(
    `/portfolio/initiatives/${projectId}/meta`,
    input,
  );
  return data.data;
}

// ── Overlaps ──────────────────────────────────────────────────────

/** List initiative overlaps for a challenge. */
export async function listOverlaps(challengeId: string): Promise<InitiativeOverlap[]> {
  const { data } = await api.get<ApiResponse<InitiativeOverlap[]>>(
    `/portfolio/challenges/${challengeId}/overlaps`,
  );
  return data.data;
}

/** Create an overlap record for a challenge. */
export async function createOverlap(
  challengeId: string,
  input: Omit<InitiativeOverlap, 'id' | 'challengeId'>,
): Promise<InitiativeOverlap> {
  const { data } = await api.post<ApiResponse<InitiativeOverlap>>(
    `/portfolio/challenges/${challengeId}/overlaps`,
    input,
  );
  return data.data;
}

// ── Executive Outputs ─────────────────────────────────────────────

/** List executive outputs for a challenge. */
export async function listExecutiveOutputs(challengeId: string): Promise<ExecutiveOutput[]> {
  const { data } = await api.get<ApiResponse<ExecutiveOutput[]>>(
    `/portfolio/challenges/${challengeId}/executive-outputs`,
  );
  return data.data;
}

/** Create an executive output for a challenge. */
export async function createExecutiveOutput(
  challengeId: string,
  input: Partial<ExecutiveOutput> & { projectId: string; recommendation: PortfolioDecisionOutcome },
): Promise<ExecutiveOutput> {
  const { data } = await api.post<ApiResponse<ExecutiveOutput>>(
    `/portfolio/challenges/${challengeId}/executive-outputs`,
    input,
  );
  return data.data;
}

/** Update an executive output (partial). */
export async function updateExecutiveOutput(
  id: string,
  input: Partial<ExecutiveOutput>,
): Promise<ExecutiveOutput> {
  const { data } = await api.patch<ApiResponse<ExecutiveOutput>>(
    `/portfolio/executive-outputs/${id}`,
    input,
  );
  return data.data;
}

// ── Project Sponsor Data ──────────────────────────────────────────

/** Update sponsor data for a project. */
export async function updateSponsorData(
  projectId: string,
  input: Record<string, unknown>,
): Promise<void> {
  await api.patch(`/projects/${projectId}/sponsor-data`, input);
}

// Re-export activation mode and stakeholder status types for convenience
export type { ChallengeActivationMode, StakeholderStatus };
