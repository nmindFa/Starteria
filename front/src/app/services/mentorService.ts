import api from './api';

interface ApiResponse<T> { success: boolean; data: T; }

export interface MentorReview {
  id: string;
  projectId: string;
  projectName?: string;
  stepNumber?: number;
  submittedAt?: string;
  status: string;
  [key: string]: unknown;
}

export interface ReviewSubmission {
  feedback?: string;
  decision?: 'approved' | 'rework';
  [key: string]: unknown;
}

export async function listReviews(): Promise<MentorReview[]> {
  const { data } = await api.get<ApiResponse<MentorReview[]>>('/mentor/reviews');
  return data.data;
}

export async function getReview(id: string): Promise<MentorReview> {
  const { data } = await api.get<ApiResponse<MentorReview>>(`/mentor/reviews/${id}`);
  return data.data;
}

export async function submitReview(id: string, body: ReviewSubmission): Promise<MentorReview> {
  const { data } = await api.post<ApiResponse<MentorReview>>(`/mentor/reviews/${id}`, body);
  return data.data;
}
