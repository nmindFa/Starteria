# Spike: `pdf_extractor`

Time-boxed POC for the PDF auto-fill agent ([PRD-002](../../../project/.sdlc/specs/PRD-002-pdf-autofill-agent.md)).

**Status:** WIP — driven by `/loop` iterations. Do NOT import from `ai-service/agents/`.

## Goal

Validate end-to-end that an LLM agent can read a 14-page Spanish initiative PDF and produce a JSON document of Step 0–4 field proposals that scores above the PRD-002 thresholds against the gold set in `evals/golden/pdf-extraction/`.

## POC stack (deviates from ADRs for local testing)

| Layer | Production (ADR) | POC (this spike) |
|---|---|---|
| Model | Claude Haiku 4.5 + function calling (ADR-004) | DeepSeek v4 Flash via OpenRouter |
| Structured output | `with_structured_output` + Pydantic | JSON-in-prompt + Pydantic validate + regex fallback |
| File storage | S3/MinIO presigned URLs (ADR-007/012) | Local filesystem (`docs/Test - iniciativa.pdf` read in-process) |
| Vector store | TBD per ADR-004 | **pgvector** (separate container `starteria-pgvector` on port 5434) |
| PDF parsing | TBD per ADR-004 | `pypdf` + `pdfplumber` (text layer only, no OCR) |
| Trust boundary | Express bridge with HMAC (ADR-011) | Direct Python script, no Express |
| Auth | JWT (ADR-003) | None (spike runs locally) |

The user explicitly authorized these deviations for the POC. Do NOT promote any code from this directory to `ai-service/agents/` without first replacing each row above with the production decision.

## Loop stop condition

The `/loop` autosuspends when, in a single run against `evals/golden/pdf-extraction/test-iniciativa.ground-truth.json`, ALL of:

- Precision per field ≥ 0.80
- Recall per field ≥ 0.70
- Hallucination rate (must_omit violations) ≤ 0.03
- Provenance page accuracy ≥ 0.90

Until then, each loop iteration refines prompts, chunking, or schema.

## Planned files (to be created in iter 2)

```
ai-service/spikes/pdf_extractor/
├── README.md                  # this file
├── pyproject.toml             # spike deps (pypdf, pdfplumber, langchain-postgres, psycopg)
├── schemas.py                 # Pydantic models mirroring the ground-truth shape
├── parser.py                  # PDF → page-blocks (text + page #)
├── chunker.py                 # page-blocks → embedding chunks (pgvector store)
├── extractor.py               # LangChain agent: chunks → field proposals + provenance
├── scorer.py                  # compare agent output to ground truth, emit metrics
└── run.py                     # CLI: --pdf, --ground-truth, --output
```

## Security note

The OPENROUTER_API_KEY shared in the /loop prompt is now in the conversation transcript. **Revoke it on openrouter.ai/keys, generate a new one, and place it ONLY in `.env`** (gitignored). The spike reads the key via `os.environ["OPENROUTER_API_KEY"]` — never hardcoded.

## Running (iter 3+)

```bash
# from repo root
export OPENROUTER_API_KEY=<your-rotated-key>
docker compose up -d pgvector   # starts the spike's pgvector container
cd ai-service
uv sync                          # installs spike deps
uv run python -m spikes.pdf_extractor.run \
  --pdf "../docs/Test - iniciativa.pdf" \
  --ground-truth "../evals/golden/pdf-extraction/test-iniciativa.ground-truth.json" \
  --output "../evals/results/pdf-extraction/$(date +%Y%m%d-%H%M%S).json"
```

## Cleanup

When the POC graduates (or is abandoned), remove this entire directory and the `pgvector` service from `docker-compose.yml`. Do not let spike code rot in `main`.
