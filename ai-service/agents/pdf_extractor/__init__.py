"""Production pdf_extractor agent (TASK-008).

Promoted from the validated spike `ai-service/spikes/pdf_extractor/`
(precision 0.800, recall 0.772, hallucination 0.000, provenance 0.964 on 2026-05-19).

Public surface:
    - `PdfExtractorAgent`: async-run worker, parsing + PII + LLM extraction.
    - `RunRegistry`: in-memory run-state store (V1; TODO(ADR-008) Redis/Postgres).
    - `parse_pdf`, `parse_pdf_bytes`, `detect_language`: parser helpers.
    - `extract`, `CostCapExceeded`, `OPENROUTER_MODEL_PRICING`: low-level extractor.
    - `redact_pii`, `RedactionResult`: PII Stage B stub.

Self-check:
    $ python -m agents.pdf_extractor --self-check
"""

from __future__ import annotations

from agents.pdf_extractor.agent import PdfExtractorAgent
from agents.pdf_extractor.extractor import (
    OPENROUTER_MODEL_PRICING,
    CostCapExceeded,
    extract,
)
from agents.pdf_extractor.parser import (
    PageBlock,
    detect_language,
    parse_pdf,
    parse_pdf_bytes,
)
from agents.pdf_extractor.pii import RedactionResult, redact_pii
from agents.pdf_extractor.runs import RunRegistry, get_run_registry

__all__ = [
    "PdfExtractorAgent",
    "RunRegistry",
    "get_run_registry",
    "PageBlock",
    "parse_pdf",
    "parse_pdf_bytes",
    "detect_language",
    "extract",
    "CostCapExceeded",
    "OPENROUTER_MODEL_PRICING",
    "redact_pii",
    "RedactionResult",
]
