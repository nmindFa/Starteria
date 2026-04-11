/* ------------------------------------------------------------------ */
/*  stepService.ts - Service layer for step & module operations        */
/* ------------------------------------------------------------------ */

import api from './api';
import {
  adaptStep,
  adaptStepStatus,
  adaptStepStatusToBackend,
  adaptModuleStatus,
  adaptModuleStatusToBackend,
  type BackendStep,
  type FrontendStep,
} from './project.adapter';

// ---------- Response shape from backend ----------

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// ---------- Step data blob ----------

export interface StepData {
  [key: string]: unknown;
}

// ---------- AI review / session response ----------

export interface AiReviewResponse {
  [key: string]: unknown;
}

export interface MentorSessionResponse {
  [key: string]: unknown;
}

// ---------- Service functions ----------

/** List all steps for a project. */
export async function listSteps(projectId: string): Promise<FrontendStep[]> {
  const { data } = await api.get<ApiResponse<BackendStep[]>>(
    `/projects/${projectId}/steps`,
  );
  return data.data.map(adaptStep);
}

/** Get a single step (includes modules). */
export async function getStep(
  projectId: string,
  stepNumber: number,
): Promise<FrontendStep> {
  const { data } = await api.get<ApiResponse<BackendStep>>(
    `/projects/${projectId}/steps/${stepNumber}`,
  );
  return adaptStep(data.data);
}

/** Get the raw step data blob. */
export async function getStepData(
  projectId: string,
  stepNumber: number,
): Promise<StepData> {
  const { data } = await api.get<ApiResponse<StepData>>(
    `/projects/${projectId}/steps/${stepNumber}/data`,
  );
  return data.data;
}

/** Save (replace) the entire step data blob. */
export async function saveStepData(
  projectId: string,
  stepNumber: number,
  stepData: StepData,
): Promise<StepData> {
  const { data } = await api.put<ApiResponse<StepData>>(
    `/projects/${projectId}/steps/${stepNumber}/data`,
    stepData,
  );
  return data.data;
}

/** Update step status. Accepts frontend status string, converts to backend. */
export async function updateStepStatus(
  projectId: string,
  stepNumber: number,
  status: string,
): Promise<FrontendStep> {
  const backendStatus = adaptStepStatusToBackend(status);
  const { data } = await api.patch<ApiResponse<BackendStep>>(
    `/projects/${projectId}/steps/${stepNumber}`,
    { status: backendStatus },
  );
  return adaptStep(data.data);
}

/** Update a module's status within a step. */
export async function updateModuleStatus(
  projectId: string,
  stepNumber: number,
  moduleId: string,
  status: string,
): Promise<{ id: string; status: string }> {
  const backendStatus = adaptModuleStatusToBackend(status);
  const { data } = await api.patch<ApiResponse<{ id: string; status: string }>>(
    `/projects/${projectId}/steps/${stepNumber}/modules/${moduleId}`,
    { status: backendStatus },
  );
  return {
    ...data.data,
    status: adaptModuleStatus(data.data.status),
  };
}

/** Request an AI review for a step. */
export async function requestAiReview(
  projectId: string,
  stepNumber: number,
): Promise<AiReviewResponse> {
  const { data } = await api.post<ApiResponse<AiReviewResponse>>(
    `/projects/${projectId}/steps/${stepNumber}/ai-review`,
  );
  return data.data;
}

/** Request a mentor session for a step. */
export async function requestMentorSession(
  projectId: string,
  stepNumber: number,
): Promise<MentorSessionResponse> {
  const { data } = await api.post<ApiResponse<MentorSessionResponse>>(
    `/projects/${projectId}/steps/${stepNumber}/session`,
  );
  return data.data;
}

// Re-export adapted status helpers for convenience
export { adaptStepStatus, adaptModuleStatus };
