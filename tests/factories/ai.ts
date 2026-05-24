import { randomUUID } from 'node:crypto';

/**
 * Standard AI response envelope used by the ai-service bridge. Tests should
 * use `fakeAiResponse(data)` rather than building this shape by hand so any
 * future schema changes only require a single edit here.
 */
export interface AiMeta {
  agent: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  requestId: string;
}

export interface AiResponse<T> {
  ok: true;
  data: T;
  meta: AiMeta;
}

export function fakeAiResponse<T>(
  data: T,
  meta: Partial<AiMeta> = {},
): AiResponse<T> {
  return {
    ok: true,
    data,
    meta: {
      agent: 'mentor',
      model: 'gpt-4o-mini',
      tokensIn: 200,
      tokensOut: 300,
      costUsd: 0.001,
      latencyMs: 1200,
      requestId: randomUUID(),
      ...meta,
    },
  };
}
