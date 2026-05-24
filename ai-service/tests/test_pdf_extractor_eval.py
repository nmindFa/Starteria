"""TASK-008 §14.3 — CI eval gate for the production pdf_extractor agent.

Runs the full pipeline against `docs/Test - iniciativa.pdf` and asserts the four
thresholds from the validated spike baseline:
    precision ≥ 0.80, recall ≥ 0.70, hallucination ≤ 0.03, provenance ≥ 0.90.

Skipped by default to keep the fast suite under a second. Opt in with:
    RUN_EVAL_TESTS=1 pytest tests/test_pdf_extractor_eval.py -k eval
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent
PDF_PATH = REPO_ROOT / "docs" / "Test - iniciativa.pdf"
GT_PATH = REPO_ROOT / "evals" / "golden" / "pdf-extraction" / "test-iniciativa.ground-truth.json"

# Re-use the spike scorer until the eval runner is moved out of `spikes/`.
SPIKE_DIR = ROOT / "spikes" / "pdf_extractor"
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(SPIKE_DIR.parent.parent) not in sys.path:
    sys.path.insert(0, str(SPIKE_DIR.parent.parent))


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_EVAL_TESTS") != "1",
    reason="Eval gate is opt-in via RUN_EVAL_TESTS=1 (calls real DeepSeek/OpenRouter).",
)


def _ensure_assets() -> None:
    if not PDF_PATH.exists():
        pytest.skip(f"Test PDF missing: {PDF_PATH}")
    if not GT_PATH.exists():
        pytest.skip(f"Ground truth missing: {GT_PATH}")


def test_pdf_extractor_meets_baseline_thresholds() -> None:
    """End-to-end: parse → PII → extract → score; assert all 4 baseline thresholds."""
    _ensure_assets()

    from agents.pdf_extractor import detect_language, extract, parse_pdf_bytes, redact_pii

    pdf_bytes = PDF_PATH.read_bytes()
    blocks = parse_pdf_bytes(pdf_bytes, PDF_PATH.name)
    language = detect_language(blocks)

    redactions = 0
    for block in blocks:
        if not block.text:
            continue
        result = redact_pii(block.text)
        block.text = result.text
        redactions += result.redactions

    extraction = extract(blocks, language, pii_redactions=redactions)

    # Use the spike scorer; the breaking change for testCycles is absorbed by
    # `_coerce_value`, which already extracts `.value` from FieldProposal wrappers.
    from spikes.pdf_extractor.scorer import score

    gt = json.loads(GT_PATH.read_text())
    report = score(extraction, gt)
    metrics = report.aggregate()

    assert metrics["precision"] >= 0.80, f"precision={metrics['precision']:.3f} < 0.80"
    assert metrics["recall"] >= 0.70, f"recall={metrics['recall']:.3f} < 0.70"
    assert (
        metrics["hallucination_rate"] <= 0.03
    ), f"hallucination_rate={metrics['hallucination_rate']:.3f} > 0.03"
    assert (
        metrics["provenance_page_accuracy"] >= 0.90
    ), f"provenance_page_accuracy={metrics['provenance_page_accuracy']:.3f} < 0.90"
