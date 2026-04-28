export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Canonical Error Envelope V1.
 * Always emitted by the central error handler. Never hand-built in controllers.
 */
export interface ApiErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface ApiErrorBody {
  /** SCREAMING_SNAKE_CASE machine-readable code. */
  code: string;
  /** Human-readable message in espanol latino. */
  message: string;
  /** Optional dotted-path for the offending field. */
  field?: string;
  /** Optional actionable next step for the user. */
  hint?: string;
  /** Optional seconds to wait before retrying (ACCOUNT_LOCKED, RATE_LIMITED). */
  retryAfterSeconds?: number;
  /** Optional per-field validation issues. */
  details?: ApiErrorDetail[];
  /** Request correlation id (from request-id middleware). */
  requestId?: string;
}

export interface ApiErrorEnvelope {
  success: false;
  error: ApiErrorBody;
}

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Discriminated union of API responses. */
export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiErrorEnvelope;
