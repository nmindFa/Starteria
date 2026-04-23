import api from './api';
import { adaptProject, type FrontendProject, type BackendProject } from './project.adapter';

interface ApiResponse<T> { success: boolean; data: T; }

export interface Cohort {
  id: string;
  code?: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

export async function listCohorts(): Promise<Cohort[]> {
  const { data } = await api.get<ApiResponse<Cohort[]>>('/admin/cohorts');
  return data.data;
}

export async function getCohortProjects(cohortId: string): Promise<FrontendProject[]> {
  const { data } = await api.get<ApiResponse<BackendProject[] | { items: BackendProject[] }>>(`/admin/cohorts/${cohortId}/projects`);
  const raw = Array.isArray(data.data) ? data.data : data.data.items;
  return raw.map(adaptProject);
}
