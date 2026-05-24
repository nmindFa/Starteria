# PDF Extraction Eval — Starteria Autofill Agent

Eval suite for the PDF auto-fill spike (see [PRD-002](../../../project/.sdlc/specs/PRD-002-pdf-autofill-agent.md), [ADR-004](../../../docs/adr/ADR-004-pdf-extraction-model.md)).

## What this measures

Given a PDF document of an initiative, the `pdf_extractor` agent must produce a JSON document with proposed values for Step 0–4 fields, each annotated with provenance (page + quote + confidence). This eval grades:

- **Precision per field** — when the agent proposes a value, is it correct (vs. ground truth)?
- **Recall per field** — does the agent capture all the fields present in the PDF?
- **Hallucination rate** — does the agent propose values for fields with no PDF evidence (`must_omit`)?
- **Provenance fidelity** — does the cited page actually contain the quoted text?
- **Confidence calibration** — Pearson correlation between agent's confidence score and per-field correctness.

## Thresholds (from PRD-002, US-003..US-007)

| Metric | Threshold |
|---|---|
| Precision per field | ≥ 0.80 |
| Recall per field | ≥ 0.70 |
| Hallucination rate (must_omit violations) | ≤ 0.03 |
| Confidence calibration (Pearson) | ≥ 0.65 |
| Provenance page accuracy | ≥ 0.90 |

The /loop autosuspends when ALL thresholds are met on this gold set.

## Gold set

| File | Source PDF | Pages | Domain |
|---|---|---|---|
| `test-iniciativa.ground-truth.json` | `docs/Test - iniciativa.pdf` | 14 | Crédito y cobranzas — Protocolo de Autonomía (Unimaq/Ferreycorp) |

This is a single-document seed. To formalize the production PRD-002 eval suite, expand to N=50 with anotated PDFs (es + en mix).

## Field-level match rules

Each ground-truth field declares its `match_rule`:

| Rule | Description |
|---|---|
| `exact` | Normalized string equality (lowercase, strip, NFC) |
| `enum` | Must match one of the declared options |
| `substring` | Expected is a normalized substring of the agent output |
| `list_overlap` | Jaccard ≥ `min_overlap` over normalized tokens/items |
| `semantic` | Cosine sim ≥ 0.75 via embeddings |
| `numeric` | Absolute value equality (units normalized) |
| `freeform_long` | ROUGE-L F1 ≥ 0.40 AND `key_entities_required` recall ≥ 0.70 |

The `weight` field controls per-field contribution to the macro precision score.

## Running

Will be implemented in iter 2 of the /loop:

```bash
# from repo root, with rotated OPENROUTER_API_KEY exported
cd ai-service
uv run python -m spikes.pdf_extractor.run \
  --pdf "../docs/Test - iniciativa.pdf" \
  --ground-truth "../evals/golden/pdf-extraction/test-iniciativa.ground-truth.json" \
  --output "../evals/results/pdf-extraction/$(date +%Y%m%d-%H%M%S).json"
```

Output: `evals/results/pdf-extraction/<timestamp>.json` with per-field score, overall metrics, and pass/fail vs. thresholds.

## How the ground truth was built

Iter 1 of `/loop` (this turn): Claude read the 14-page PDF and manually mapped its content to Step 0–4 fields per:
- `front/src/app/pages/Step{0..4}Page.tsx` (field shapes)
- `docs/starteria-step-logic.md` (module purpose)
- The auto-fillable fields map produced by the researcher swarm agent in the earlier /loop iteration

Fields with NO evidence in the PDF are listed in the `must_omit` block. Any agent proposal there counts as hallucination.

## Important — this is the seed, not production gold

This single-PDF eval is the loop's stop signal. Before promoting the spike to production:
- expand to N≥50 PDFs (mix domains, es + en)
- have 2 humans independently annotate, reconcile disagreements
- version-control the gold set (changes to ground truth invalidate prior runs)
- declare the gold set in `evals/golden/starteria-pdf-extraction-eval.jsonl` per ADR-004 §5

## Deviations from ADRs (POC scope)

The spike intentionally diverges from the formal architecture for local testing:

| ADR decision | POC choice | Rationale |
|---|---|---|
| ADR-004: Claude Haiku 4.5 + function calling | DeepSeek v4 Flash via OpenRouter, JSON-in-prompt + Pydantic | User-requested; cheap + fast for iteration |
| ADR-007: S3/MinIO for file storage | Local filesystem inside the container | No AWS for the spike |
| ADR-012: separate pgvector cohort isolation | Single pgvector container, shared schema | Single-document POC |

These deviations are explicitly time-boxed. Production must follow the ADRs.
