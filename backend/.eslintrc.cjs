/**
 * Backend ESLint configuration.
 *
 * This file currently only declares the bridge-isolation rule for TASK-007 V1.
 * The project does not yet ship a global ESLint setup (no eslint dependency
 * installed in front/package.json as of 2026-05-19). Once it is added, merge
 * this rule into the root config.
 *
 * ── Bridge isolation rule (TASK-007) ─────────────────────────────────────────
 * Direct calls to AI_SERVICE_URL from outside backend/modules/ai/bridge.service.ts
 * are forbidden. All Express → ai-service traffic MUST go through
 * `callAiService()` so headers (X-Internal-Token, X-Request-Id, X-User-Claims,
 * X-Cost-Cap-USD), retries and the circuit breaker are applied uniformly.
 *
 * TODO(ADR-011): when HMAC signing lands, the rule below upgrades to also
 * forbid manual header construction outside the bridge.
 *
 * Manual verification (used by CI today, until ESLint is wired):
 *
 *   grep -RIn "aiServiceUrl\|AI_SERVICE_URL" backend/modules/ \\
 *     | grep -v "bridge.service.ts\|ai.proxy.ts" \\
 *     | grep -v "^[^:]*:[^:]*://" \\
 *     ; test $? -eq 1
 *
 * exits 0 when no offenders are found (grep returns 1 when nothing matches).
 */
module.exports = {
  root: false,
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        // Block: fetch('...ai-service-host...')
        selector:
          "CallExpression[callee.name='fetch'] > Literal[value=/localhost:8001|ai-service|AI_SERVICE_URL/]",
        message:
          'Direct fetch() to ai-service is forbidden. Use callAiService() from backend/modules/ai/bridge.service.ts (TASK-007 trust boundary).',
      },
      {
        // Block: axios.{get,post,...}('...ai-service-host...')
        selector:
          "CallExpression[callee.object.name='axios'] > Literal[value=/localhost:8001|ai-service|AI_SERVICE_URL/]",
        message:
          'Direct axios call to ai-service is forbidden. Use callAiService() from backend/modules/ai/bridge.service.ts (TASK-007 trust boundary).',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        // Re-export of config.aiServiceUrl outside the bridge is suspicious.
        // Allow inside the bridge directory itself.
        patterns: [
          {
            group: ['**/config'],
            importNames: ['config'],
            message:
              "[Advisory] If you import config.aiServiceUrl, ensure the resulting HTTP call goes through callAiService() in bridge.service.ts.",
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // The bridge module itself is the legitimate consumer.
      files: ['modules/ai/bridge.service.ts', 'modules/ai/ai.proxy.ts'],
      rules: {
        'no-restricted-syntax': 'off',
        'no-restricted-imports': 'off',
      },
    },
  ],
};
