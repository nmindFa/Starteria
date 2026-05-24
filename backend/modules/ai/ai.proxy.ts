/**
 * ai.proxy.ts — Thin backwards-compatible wrapper around bridge.service.
 *
 * Historical entry point. Kept so existing imports keep compiling.
 * NEW callers MUST import from './bridge.service' directly so the typed
 * options (userClaims, costCapUsd, requestId) are explicit at the call site.
 *
 * TODO(ADR-011): once all callers migrate to callAiService(), delete this file.
 */
import { callAiService, type CallAiServiceOptions } from './bridge.service';

export async function proxyToAiService(
  path: string,
  body: unknown,
  options: CallAiServiceOptions = {},
): Promise<unknown> {
  return callAiService('POST', path, body, options);
}

// Re-export for callers that want the full typed API.
export { callAiService } from './bridge.service';
export { BridgeError } from './bridge.service';
export type { AiBridge, BridgeUserClaims, CallAiServiceOptions } from './bridge.service';
