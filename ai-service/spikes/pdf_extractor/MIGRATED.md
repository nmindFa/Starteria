# MIGRATED — PDF extractor spike → production

**As of 2026-05-19 (TASK-008 Phase A)**, the validated logic in this directory
has been promoted to the production package:

| Spike file | Production location |
|---|---|
| `schemas.py` | `ai-service/schemas/pdf_extraction.py` (BREAKING: `testCycles` now wrapped in `FieldProposal`) |
| `parser.py` | `ai-service/agents/pdf_extractor/parser.py` (adds `parse_pdf_bytes`) |
| `extractor.py` (prompts) | `ai-service/agents/pdf_extractor/prompts.py` (verbatim 12 hard rules) |
| `extractor.py` (LLM calls) | `ai-service/agents/pdf_extractor/extractor.py` (DeepSeek kept; TODO ADR-004 for Haiku 4.5) |
| `chunker.py` (pgvector) | **Not promoted** — deferred to ADR-012 (one-shot full-text path covers ≤50pp) |
| `scorer.py` | **Kept here** as eval tooling; eventual move to `evals/runners/` |
| `run.py` | **Kept here** as CLI eval driver |
| `verify_install.py` | Replaced by `python -m agents.pdf_extractor --self-check` |

Endpoints exposed by the production worker:

- `POST /ai/pdf-extract` → returns `{ runId, status: "pending" }` immediately
- `GET /ai/pdf-extract/runs/{runId}` → poll for `running` / `completed` / `cost_capped` / `failed`

Both endpoints require `X-Internal-Token` (TASK-007 will swap to HMAC).

**Do not edit this directory.** It is kept intact as a reference until the spike
is deleted (TASK-008 DoD-008). Any change to the extractor pipeline must land in
the production package above.
