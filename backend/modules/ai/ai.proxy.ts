/**
 * HTTP proxy to the Python ai-service microservice.
 * Reads AI_SERVICE_URL from config (default: http://localhost:8001).
 */
import { config } from '../../config';

export async function proxyToAiService(
  path: string,
  body: unknown
): Promise<unknown> {
  const url = `${config.aiServiceUrl}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'upstream_error' }));
    throw err;
  }
  return response.json();
}
