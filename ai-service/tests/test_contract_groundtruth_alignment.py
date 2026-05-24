"""Cross-layer CONTRACT test — schema vs. ground-truth field paths.

Guarantees that every `fieldPath` listed in
`evals/golden/pdf-extraction/test-iniciativa.ground-truth.json::fields`
can be produced by the production `InitiativeExtraction` Pydantic model,
and that the production model does NOT carry extra leaves the ground
truth doesn't know about. This catches silent schema drift between
ai-service, the backend `flattenFieldProposals`, and the eval corpus.

If this test fails with a non-empty diff, one of three things changed:
  1. Someone renamed a Pydantic field → the agent can no longer propose
     the ground-truth path. Action: rename schema OR ground truth.
  2. Someone added a new Pydantic field → ground truth is stale.
     Action: extend ground truth with the new path + expected.
  3. Someone removed a Pydantic field → ground truth has dead key.
     Action: remove from ground truth or restore the field.

This test is intentionally fast (<50ms) — no LLM, no PDF, just schema
introspection. It is NOT gated by `RUN_EVAL_TESTS`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Iterable

import pytest

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent
GT_PATH = REPO_ROOT / "evals" / "golden" / "pdf-extraction" / "test-iniciativa.ground-truth.json"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _ensure_ground_truth() -> None:
    if not GT_PATH.exists():
        pytest.skip(f"Ground truth missing: {GT_PATH}")


# ---------------------------------------------------------------------------
# Python port of `backend/modules/initiative-pdfs/extraction-flatten.ts`.
# Walks the dict tree dumped from Pydantic and emits dotted paths for every
# `FieldProposal` leaf (anything that has both a `value` and a numeric
# `confidence`). Identical algorithm — kept in-file (~25 lines) so the test
# does not introduce a runtime dependency on the backend.
# ---------------------------------------------------------------------------

_SKIP_KEYS = frozenset({"must_omit_violations", "extraction_metadata"})


def _is_field_proposal_leaf(node: Any) -> bool:
    if not isinstance(node, dict):
        return False
    return "value" in node and "confidence" in node and isinstance(node["confidence"], (int, float))


def _is_wrapped_list_of_field_proposal_objects(node: Any) -> bool:
    """Mirror of `isWrappedListOfFieldProposalObjects` in extraction-flatten.ts.

    True iff node is a FieldProposal wrapper whose `.value` is a list of dicts
    each containing FieldProposal sub-fields (e.g. testCycles in production).
    """
    if not _is_field_proposal_leaf(node):
        return False
    value = node.get("value")
    if not isinstance(value, list) or not value:
        return False
    for item in value:
        if not isinstance(item, dict):
            continue
        if any(_is_field_proposal_leaf(v) for v in item.values()):
            return True
    return False


def _walk(node: Any, prefix: str, out: list[str]) -> None:
    if node is None:
        return
    if _is_field_proposal_leaf(node):
        if _is_wrapped_list_of_field_proposal_objects(node):
            # Descend into list-wrapped FieldProposal-of-objects (testCycles case).
            for idx, item in enumerate(node["value"]):
                _walk(item, f"{prefix}[{idx}]", out)
            return
        out.append(prefix)
        return
    if isinstance(node, list):
        for idx, child in enumerate(node):
            _walk(child, f"{prefix}[{idx}]", out)
        return
    if isinstance(node, dict):
        for key, value in node.items():
            if key in _SKIP_KEYS:
                continue
            next_prefix = key if prefix == "" else f"{prefix}.{key}"
            _walk(value, next_prefix, out)


def flatten_field_paths(extraction: dict[str, Any]) -> list[str]:
    out: list[str] = []
    _walk(extraction, "", out)
    return out


# ---------------------------------------------------------------------------
# Build a fully-populated InitiativeExtraction (every leaf set) so the flatten
# walk emits the complete schema surface — including `step3.testCycles[0].*`.
# ---------------------------------------------------------------------------


def _dummy_proposal(value: Any = "stub") -> dict[str, Any]:
    return {
        "value": value,
        "provenance": [{"page": 1, "quote": "stub", "confidence": 0.9}],
        "confidence": 0.9,
    }


def _build_fully_populated_extraction() -> Any:
    """Instantiate the PRODUCTION Pydantic model with every leaf populated."""
    from schemas.pdf_extraction import (
        ExtractionMetadata,
        FieldProposal,
        InitiativeExtraction,
        PresentationContent,
        Provenance,
        Step0Extraction,
        Step1AsisData,
        Step1CData,
        Step1Extraction,
        Step2Extraction,
        Step2TestCard,
        Step3Diagnostico,
        Step3Extraction,
        Step3Logistica,
        Step4Extraction,
        Step4OrgContext,
        TestCycle,
    )

    def fp(value: Any = "stub") -> FieldProposal:
        return FieldProposal(
            value=value,
            provenance=[Provenance(page=1, quote="stub", confidence=0.9)],
            confidence=0.9,
        )

    step0 = Step0Extraction(
        nombreParticipante=fp(),
        rolArea=fp(),
        origen=fp(),
        quePasaQueQuieres=fp(),
        impacta=fp(),
        parteProceso=fp(),
        impacto3meses=fp(),
        respaldo=fp(),
        quienEscuchar=fp(),
    )

    step1 = Step1Extraction(
        asisData=Step1AsisData(
            casoReal=fp(),
            quiebre=fp(),
            quiebreDetalle=fp(),
            consecuencia=fp(),
            consequenceTags=fp(),
            causaInmediata=fp(),
            evidenciaTipo=fp(),
            evidenciaNota=fp(),
            alcance=fp(),
        ),
        cData=Step1CData(
            limitesChips=fp(),
            dependencia=fp(),
            alternativaPiloto=fp(),
        ),
    )

    step2 = Step2Extraction(
        hmw=fp(),
        testCard=Step2TestCard(
            hipotesis=fp(),
            queTestan=fp(),
            conQuien=fp(),
            dondeCuando=fp(),
            metodo=fp(),
            metrica=fp(),
        ),
    )

    # TASK-008 BREAKING CHANGE: testCycles is wrapped in a FieldProposal whose
    # `.value` is a list[TestCycle]. We mirror the production shape.
    one_cycle = TestCycle(
        queValidamos=fp(),
        metricaPrincipal=fp(),
        resultadoEsperado=fp(),
        resultadoObservado=fp(),
        decision=fp(),
        aprendizaje=fp(),
    )

    step3 = Step3Extraction(
        formatoExp=fp(),
        logistica=Step3Logistica(donde=fp()),
        instrumentacion=fp([{"k": "v"}]),
        testCycles=FieldProposal(
            value=[one_cycle.model_dump()],
            provenance=[Provenance(page=8, quote="stub", confidence=0.9)],
            confidence=0.9,
        ),
        goNoGo=fp(),
        aprendizajes=fp(),
        diagnostico=Step3Diagnostico(senales=fp()),
    )

    step4 = Step4Extraction(
        audience=fp(),
        meetingGoal=fp(),
        decision=fp(),
        closureType=fp(),
        presentation=PresentationContent(
            problem=fp(),
            urgency=fp(),
            evidence=fp(),
            proposal=fp(),
            solutionComponents=fp(),
            tests=fp(),
            results=fp(),
            recommendation=fp(),
            orgNeeds=fp(),
            nextStep=fp(),
        ),
        implementationPlan=fp([{"stage": "s", "activity": "a"}]),
        orgContext=Step4OrgContext(affectedAreas=fp(), risks=fp()),
    )

    metadata = ExtractionMetadata(
        model="test-model",
        language="es",
        pages=1,
        started_at="2026-01-01T00:00:00",
        finished_at="2026-01-01T00:00:00",
        duration_ms=0,
    )

    return InitiativeExtraction(
        step0=step0,
        step1=step1,
        step2=step2,
        step3=step3,
        step4=step4,
        extraction_metadata=metadata,
    )


# ---------------------------------------------------------------------------
# Path normalization
# ---------------------------------------------------------------------------


def _normalize_array_indices(paths: Iterable[str]) -> set[str]:
    """Collapse `[N]` indices to `[0]` so different cardinalities still match.

    The ground truth happens to use `[0]` exclusively (single cycle). The
    schema walk also produces `[0]` because we instantiate one TestCycle.
    The normalization makes the contract robust against future multi-cycle
    fixtures without churn here.
    """
    import re

    out: set[str] = set()
    for p in paths:
        out.add(re.sub(r"\[\d+\]", "[0]", p))
    return out


# ---------------------------------------------------------------------------
# The contract test
# ---------------------------------------------------------------------------


def test_contract_groundtruth_alignment() -> None:
    """Every ground-truth fieldPath maps to a Pydantic leaf — and vice versa."""
    _ensure_ground_truth()

    extraction = _build_fully_populated_extraction()
    dumped = extraction.model_dump()

    schema_paths = _normalize_array_indices(flatten_field_paths(dumped))

    gt = json.loads(GT_PATH.read_text(encoding="utf-8"))
    gt_keys = _normalize_array_indices(gt["fields"].keys())

    missing_in_schema = sorted(gt_keys - schema_paths)
    extra_in_schema = sorted(schema_paths - gt_keys)

    if missing_in_schema or extra_in_schema:
        msg_parts = ["Schema drift detected between Pydantic and ground truth."]
        if missing_in_schema:
            msg_parts.append("")
            msg_parts.append("MISSING IN SCHEMA (ground truth has, Pydantic can't emit):")
            for p in missing_in_schema:
                msg_parts.append(f"  - {p}")
        if extra_in_schema:
            msg_parts.append("")
            msg_parts.append("EXTRA IN SCHEMA (Pydantic emits, ground truth doesn't expect):")
            for p in extra_in_schema:
                msg_parts.append(f"  + {p}")
        pytest.fail("\n".join(msg_parts))


def test_contract_every_groundtruth_key_resolves_in_dump() -> None:
    """Defensive sibling: assert NO ground-truth key is silently absent.

    This is a strict subset check (missing only), separate from the symmetric
    test so a CI failure clearly distinguishes "schema needs new field" from
    "ground truth has stale entry".
    """
    _ensure_ground_truth()

    extraction = _build_fully_populated_extraction()
    dumped = extraction.model_dump()

    schema_paths = _normalize_array_indices(flatten_field_paths(dumped))
    gt = json.loads(GT_PATH.read_text(encoding="utf-8"))
    gt_keys = _normalize_array_indices(gt["fields"].keys())

    missing = sorted(gt_keys - schema_paths)
    assert not missing, (
        "Ground-truth fieldPaths missing from production Pydantic schema:\n  - "
        + "\n  - ".join(missing)
    )
