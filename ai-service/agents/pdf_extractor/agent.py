"""High-level PdfExtractorAgent: orchestrates parse → PII → LLM → run state.

V1 pipeline (TASK-008):
    1. decode base64 PDF buffer
    2. parse pages via pypdf (pdfplumber fallback)
    3. detect language (es default)
    4. apply PII Stage B stub redaction to in-memory page text
    5. call `extract()` with cost cap; bubble CostCapExceeded as `cost_capped` status
    6. persist progress + final state in `RunRegistry`

TODO(ADR-004): swap DeepSeek for Claude Haiku 4.5 + with_structured_output.
TODO(ADR-008): persist run state to Redis/Postgres instead of in-memory.
TODO(PII): replace regex stub with Presidio + spaCy (recall ≥ 0.95).
TODO(ADR-012): pgvector retrieval skipped; one-shot full-text fits Haiku 200K ctx.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import logging
import os
import uuid
from dataclasses import dataclass

from agents.pdf_extractor.extractor import CostCapExceeded, extract
from agents.pdf_extractor.parser import detect_language, parse_pdf_bytes
from agents.pdf_extractor.pii import redact_pii
from agents.pdf_extractor.runs import RunRegistry, get_run_registry
from agents.pdf_extractor.webhook import BackendWebhookClient, get_webhook_client
from schemas.pdf_extraction import PdfExtractRequest

logger = logging.getLogger(__name__)


DEFAULT_COST_CAP_USD = float(os.getenv("PDF_EXTRACT_COST_CAP_USD", "0.30"))


@dataclass
class _PreparedRun:
    run_id: str
    pdf_bytes: bytes
    language: str | None
    cost_cap_usd: float
    file_name: str


class PdfExtractorAgent:
    """Async worker for `POST /ai/pdf-extract`."""

    def __init__(
        self,
        registry: RunRegistry | None = None,
        webhook: BackendWebhookClient | None = None,
    ) -> None:
        self._registry = registry or get_run_registry()
        # Resolved at construction so tests can inject a stub. The default
        # singleton respects `BACKEND_WEBHOOK_URL` (no-op if unset).
        self._webhook = webhook or get_webhook_client()

    # ---------- public API ----------

    def start(self, body: PdfExtractRequest) -> str:
        """Validate input, create a run, and schedule background extraction.

        Returns the new `runId` immediately. Caller is expected to expose it
        via `POST /ai/pdf-extract` synchronous ack.
        """
        try:
            pdf_bytes = base64.b64decode(body.pdfBase64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError(f"pdfBase64 is not valid base64: {exc}") from exc

        if not pdf_bytes:
            raise ValueError("pdfBase64 decodes to an empty buffer")

        cost_cap = body.costCapUsd if body.costCapUsd is not None else DEFAULT_COST_CAP_USD
        if cost_cap > DEFAULT_COST_CAP_USD:
            # Caller cannot raise the cap above the env-configured ceiling.
            cost_cap = DEFAULT_COST_CAP_USD

        run_id = str(uuid.uuid4())
        self._registry.create(run_id)
        prepared = _PreparedRun(
            run_id=run_id,
            pdf_bytes=pdf_bytes,
            language=body.language,
            cost_cap_usd=cost_cap,
            file_name=body.fileName,
        )
        asyncio.create_task(self._run(prepared))
        logger.info(
            "pdf_extractor run scheduled run_id=%s project=%s file=%s cost_cap=$%.4f",
            run_id,
            body.projectId,
            body.fileName,
            cost_cap,
        )
        return run_id

    # ---------- internals ----------

    async def _run(self, prepared: _PreparedRun) -> None:
        run_id = prepared.run_id
        try:
            self._registry.update(run_id, status="running", progress=0.05)
            blocks = await asyncio.to_thread(parse_pdf_bytes, prepared.pdf_bytes, prepared.file_name)
            language = prepared.language or detect_language(blocks)
            self._registry.update(run_id, progress=0.20)

            redactions_total = 0
            for block in blocks:
                if not block.text:
                    continue
                result = redact_pii(block.text)
                block.text = result.text
                redactions_total += result.redactions
            self._registry.update(run_id, progress=0.35)

            try:
                extraction = await asyncio.to_thread(
                    extract,
                    blocks,
                    language,
                    cost_cap_usd=prepared.cost_cap_usd,
                    pii_redactions=redactions_total,
                )
            except CostCapExceeded as cap_exc:
                logger.warning(
                    "pdf_extractor run=%s cost_capped at $%.4f (completed=%s)",
                    run_id,
                    cap_exc.cost_so_far,
                    cap_exc.completed,
                )
                self._registry.update(
                    run_id,
                    status="cost_capped",
                    cost_usd=round(cap_exc.cost_so_far, 6),
                    error_reason="COST_CAPPED",
                    progress=1.0,
                )
                await self._notify_backend(run_id)
                return

            self._registry.update(
                run_id,
                status="completed",
                proposals=extraction,
                cost_usd=extraction.extraction_metadata.cost_usd,
                progress=1.0,
            )
            logger.info(
                "pdf_extractor run=%s completed cost=$%.4f pii_redactions=%d",
                run_id,
                extraction.extraction_metadata.cost_usd,
                redactions_total,
            )
            await self._notify_backend(run_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception("pdf_extractor run=%s failed: %s", run_id, exc)
            self._registry.update(
                run_id,
                status="failed",
                error_reason=str(exc),
                progress=1.0,
            )
            await self._notify_backend(run_id)

    async def _notify_backend(self, run_id: str) -> None:
        """Push the current terminal RunState to backend. Never raises.

        Awaited inline so the run's asyncio.Task doesn't return before delivery
        is attempted. The client itself swallows all failures, so even a
        misconfigured webhook URL won't crash the extraction worker.
        """
        state = self._registry.get(run_id)
        if state is None:
            logger.warning("notify_backend: run=%s missing from registry", run_id)
            return
        try:
            await self._webhook.push_run_state(run_id, state)
        except Exception as exc:  # noqa: BLE001
            # `push_run_state` already absorbs predictable failures; this guard
            # only catches programming errors so they can't bubble up and crash
            # the surrounding extraction task.
            logger.exception("notify_backend run=%s unexpected: %s", run_id, exc)


# ---------- module self-check ----------


def _self_check() -> int:
    """Lightweight import + wiring check; mirrors `verify_install.py` from the spike."""
    print("== pdf_extractor production — self-check ==")
    ok = True

    print("\n1. Schemas importable + testCycles is wrapped:")
    try:
        from schemas.pdf_extraction import FieldProposal, Step3Extraction

        s3 = Step3Extraction()
        wrapped_type = type(s3).model_fields["testCycles"].annotation
        is_wrapped = "FieldProposal" in str(wrapped_type)
        marker = "OK  " if is_wrapped else "FAIL"
        print(f"  [{marker}] Step3Extraction.testCycles annotation = {wrapped_type}")
        ok &= is_wrapped
        # Ensure FieldProposal still works with a list value:
        FieldProposal(value=[{"queValidamos": None}], confidence=0.8)
        print("  [OK  ] FieldProposal accepts list values")
    except Exception as exc:  # noqa: BLE001
        print(f"  [FAIL] schemas import: {exc}")
        ok = False

    print("\n2. Agent + registry wiring:")
    try:
        agent = PdfExtractorAgent()
        reg = agent._registry  # noqa: SLF001 — internal sanity check
        rid = "self-check-run"
        reg.create(rid)
        snap = reg.get(rid)
        assert snap is not None and snap.status == "pending"
        reg.update(rid, status="completed")
        snap = reg.get(rid)
        assert snap is not None and snap.status == "completed"
        reg.clear()
        print("  [OK  ] RunRegistry create/get/update/clear roundtrip")
    except Exception as exc:  # noqa: BLE001
        print(f"  [FAIL] registry wiring: {exc}")
        ok = False

    print("\n3. PII stub:")
    try:
        from agents.pdf_extractor.pii import redact_pii

        out = redact_pii("Contacto: ana@x.com DNI 12345678 cel 987654321")
        assert "<PII:EMAIL>" in out.text
        assert "<PII:ID>" in out.text or "<PII:PHONE>" in out.text
        print(f"  [OK  ] PII redactions={out.redactions} sample={out.text!r}")
    except Exception as exc:  # noqa: BLE001
        print(f"  [FAIL] pii stub: {exc}")
        ok = False

    print("\n4. Prompts loadable + 12 hard rules preserved:")
    try:
        from agents.pdf_extractor.prompts import step_schema, system_prompt

        sp = system_prompt("es")
        rules_present = all(f"{n}." in sp for n in range(1, 13))
        marker = "OK  " if rules_present else "FAIL"
        print(f"  [{marker}] _SYSTEM_PROMPT_ES contains rules 1..12")
        ok &= rules_present
        # step3 must mention testCycles wrapper
        s3 = step_schema("step3")
        wrap_hint = any("FieldProposal" in f for f in s3["fields"] if "testCycles" in f)
        marker2 = "OK  " if wrap_hint else "FAIL"
        print(f"  [{marker2}] step3 schema hints testCycles wrapper")
        ok &= wrap_hint
    except Exception as exc:  # noqa: BLE001
        print(f"  [FAIL] prompts: {exc}")
        ok = False

    print()
    print("All checks PASSED" if ok else "Some checks FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    import sys

    if "--self-check" in sys.argv:
        sys.exit(_self_check())
    print("Usage: python -m agents.pdf_extractor --self-check")
    sys.exit(2)
