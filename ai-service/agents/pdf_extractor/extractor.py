"""DeepSeek-via-OpenRouter extractor for the pdf_extractor agent (TASK-008).

Promoted from `ai-service/spikes/pdf_extractor/extractor.py` (validated 2026-05-19,
precision 0.800, recall 0.772, hallucination 0.000, provenance 0.964).

V1 keeps DeepSeek + JSON-in-prompt + regex fallback. The validated 12 hard rules
are loaded from `prompts.py` verbatim.

TODO(ADR-004): swap primary model to `claude-haiku-4-5-20260401` with
`with_structured_output(Step{N}Extraction)` + Anthropic tool use. Defer DeepSeek
to the fallback tier (Anthropic 5xx). See TASK-008 §8 fallback chain.

Mirrors the JSON-extract-with-regex-fallback pattern from `agents/mentor_virtual.py`.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime
from typing import Any

from langchain_openai import ChatOpenAI
from pydantic import ValidationError

from agents.pdf_extractor.parser import PageBlock
from agents.pdf_extractor.prompts import step_schema, system_prompt
from schemas.pdf_extraction import (
    ExtractionMetadata,
    InitiativeExtraction,
    Step0Extraction,
    Step1Extraction,
    Step2Extraction,
    Step3Extraction,
    Step4Extraction,
)

logger = logging.getLogger(__name__)

# TODO(ADR-004): replace with `claude-haiku-4-5-20260401` via langchain-anthropic.
_DEFAULT_MODEL = "deepseek/deepseek-chat"
_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"


# Per-million-token USD rates. DeepSeek-chat on OpenRouter as of 2026-05.
# TODO(ADR-004): extend with Anthropic Haiku/Sonnet rates when the swap lands.
OPENROUTER_MODEL_PRICING: dict[str, dict[str, float]] = {
    "deepseek/deepseek-chat": {"input": 0.14, "output": 0.28},
    "deepseek-chat": {"input": 0.14, "output": 0.28},
}


_STEP_VALIDATORS = {
    "step0": Step0Extraction,
    "step1": Step1Extraction,
    "step2": Step2Extraction,
    "step3": Step3Extraction,
    "step4": Step4Extraction,
}


class CostCapExceeded(Exception):
    """Raised mid-run when the running cost would exceed the configured cap."""

    def __init__(self, cost_so_far: float, cap: float, completed: list[str]) -> None:
        super().__init__(
            f"Cost cap ${cap:.4f} would be exceeded (so far: ${cost_so_far:.4f}); "
            f"completed: {completed}"
        )
        self.cost_so_far = cost_so_far
        self.cap = cap
        self.completed = completed


# ---------- Helpers ----------


def _build_full_text(blocks: list[PageBlock]) -> str:
    parts: list[str] = []
    for b in blocks:
        if b.char_count == 0:
            continue
        parts.append(f"\n\n=== PÁGINA {b.page} ===\n\n{b.text}")
    return "".join(parts).strip()


def _extract_json(content: str) -> dict[str, Any]:
    """Tolerant JSON parser: literal load → regex first-object fallback."""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


def _build_user_message(step: str, full_text: str, schema: dict[str, Any]) -> str:
    field_list = "\n".join(f"  - {f}" for f in schema["fields"])
    example = json.dumps(schema["example"], ensure_ascii=False, indent=2)
    hint = schema.get("context_hint", "")
    hint_block = f"\n\n{hint}\n" if hint else ""
    return (
        f"Extrae los campos del **{step}** del siguiente PDF de iniciativa.{hint_block}\n\n"
        f"Campos esperados (propone tantos como tengan evidencia razonable, no sólo los obvios):\n{field_list}\n\n"
        f"Ejemplos de campos bien formados (NO los incluyas literales — son guías de estructura):\n```json\n{example}\n```\n\n"
        f"Devuelve un objeto JSON con la forma de **{step}** (sin envolver en otro objeto, sin la clave '{step}' encima). "
        f"Cada campo propuesto debe llevar provenance como en el ejemplo.\n\n"
        f"=== CONTENIDO DEL PDF ===\n{full_text}\n=== FIN ==="
    )


def _build_llm() -> ChatOpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not set. Configure it in ai-service/.env."
        )
    model = os.getenv("OPENROUTER_MODEL", _DEFAULT_MODEL)
    base_url = os.getenv("OPENROUTER_BASE_URL", _DEFAULT_BASE_URL)
    # OpenRouter `extra_body.provider` lets us steer routing: allow_fallbacks=true
    # tells OpenRouter to try other providers if the chosen one is rate-limited /
    # down. This eliminates the transient 429 from a single upstream (e.g.
    # DeepInfra throttling `deepseek/deepseek-chat` on the free tier).
    return ChatOpenAI(
        base_url=base_url,
        model=model,
        api_key=api_key,
        temperature=0.1,
        max_tokens=4000,
        # Retry transient upstream failures up to 3x with exponential backoff.
        max_retries=3,
        model_kwargs={
            "response_format": {"type": "json_object"},
            "extra_body": {
                "provider": {
                    "allow_fallbacks": True,
                    "sort": "throughput",
                }
            },
        },
    )


def _model_price(model_name: str) -> dict[str, float]:
    return OPENROUTER_MODEL_PRICING.get(
        model_name, OPENROUTER_MODEL_PRICING["deepseek/deepseek-chat"]
    )


def _compute_cost(model_name: str, input_tokens: int, output_tokens: int) -> float:
    price = _model_price(model_name)
    return (input_tokens * price["input"] + output_tokens * price["output"]) / 1_000_000.0


def _tolerant_validate(validator: Any, parsed: dict[str, Any], step: str) -> Any:
    """Validate field-by-field; drop fields that fail individually so the rest survive."""
    if not isinstance(parsed, dict):
        logger.warning("Step %s: parsed is not a dict, got %s", step, type(parsed).__name__)
        return validator()

    payload = {k: v for k, v in parsed.items() if k in validator.model_fields}
    max_peel_iterations = 8
    for _ in range(max_peel_iterations):
        try:
            return validator.model_validate(payload)
        except ValidationError as exc:
            offenders = {err["loc"][0] for err in exc.errors() if err.get("loc")}
            if not offenders or not any(o in payload for o in offenders):
                logger.warning("Step %s validation has unrecoverable error: %s", step, exc.errors()[:2])
                break
            for top_field in offenders:
                if top_field in payload:
                    logger.info("Step %s: dropping field %r due to validation error", step, top_field)
                    payload.pop(top_field, None)

    try:
        return validator.model_validate(payload)
    except ValidationError:
        return validator()


def _call_step(
    llm: ChatOpenAI, step: str, full_text: str, language: str
) -> tuple[Any, int, dict[str, int]]:
    sys_prompt = system_prompt(language)
    user_msg = _build_user_message(step, full_text, step_schema(step))
    started = time.monotonic()

    try:
        response = llm.invoke([
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": user_msg},
        ])
    except Exception as exc:  # noqa: BLE001
        logger.error("LLM call failed for %s: %s", step, exc)
        return _STEP_VALIDATORS[step](), int((time.monotonic() - started) * 1000), {}

    raw = response.content if isinstance(response.content, str) else str(response.content)
    parsed = _extract_json(raw)
    validator = _STEP_VALIDATORS[step]
    validated = _tolerant_validate(validator, parsed, step)

    duration_ms = int((time.monotonic() - started) * 1000)
    usage = getattr(response, "usage_metadata", None) or {}
    tokens = {
        "input": int(usage.get("input_tokens", 0)) if isinstance(usage, dict) else 0,
        "output": int(usage.get("output_tokens", 0)) if isinstance(usage, dict) else 0,
    }
    logger.info(
        "Step %s extracted in %dms (tokens in=%d out=%d)",
        step,
        duration_ms,
        tokens["input"],
        tokens["output"],
    )
    return validated, duration_ms, tokens


def extract(
    blocks: list[PageBlock],
    language: str,
    *,
    cost_cap_usd: float | None = None,
    pii_redactions: int = 0,
) -> InitiativeExtraction:
    """Run a full Step0-Step4 extraction and assemble the InitiativeExtraction.

    Args:
        blocks: parsed pages (text-only; PII should already be redacted upstream).
        language: 'es' | 'en'.
        cost_cap_usd: if set, abort remaining steps when running cost would exceed cap.
            Already-completed steps survive; status will be set to 'cost_capped' by caller.
        pii_redactions: count of upstream PII redactions, copied into metadata.

    Raises:
        CostCapExceeded: when running cost exceeds the configured cap. The exception
            carries the partial state so the caller can persist what was extracted.
    """
    llm = _build_llm()
    model_name = (
        llm.model_name if hasattr(llm, "model_name") else getattr(llm, "model", _DEFAULT_MODEL)
    )
    full_text = _build_full_text(blocks)
    if not full_text:
        raise RuntimeError("No extractable text in PDF blocks; cannot run extraction.")

    started_at = datetime.utcnow().isoformat()
    started = time.monotonic()
    per_step_ms: dict[str, int] = {}
    per_step_tokens: dict[str, dict[str, int]] = {}
    extracted: dict[str, Any] = {}
    cost_so_far = 0.0
    completed: list[str] = []

    for step in ("step0", "step1", "step2", "step3", "step4"):
        if cost_cap_usd is not None and cost_so_far >= cost_cap_usd:
            logger.warning(
                "Cost cap reached before %s (cost=$%.4f cap=$%.4f); aborting remaining steps",
                step,
                cost_so_far,
                cost_cap_usd,
            )
            for remaining in ("step0", "step1", "step2", "step3", "step4"):
                if remaining not in extracted:
                    extracted[remaining] = _STEP_VALIDATORS[remaining]()
            raise CostCapExceeded(cost_so_far, cost_cap_usd, completed)

        value, ms, tokens = _call_step(llm, step, full_text, language)
        extracted[step] = value
        per_step_ms[step] = ms
        per_step_tokens[step] = tokens
        cost_so_far += _compute_cost(str(model_name), tokens.get("input", 0), tokens.get("output", 0))
        completed.append(step)

    finished_at = datetime.utcnow().isoformat()
    duration_ms = int((time.monotonic() - started) * 1000)

    metadata = ExtractionMetadata(
        model=str(model_name),
        language=language,
        pages=len(blocks),
        started_at=started_at,
        finished_at=finished_at,
        duration_ms=duration_ms,
        per_step_ms=per_step_ms,
        per_step_tokens=per_step_tokens,
        cost_usd=round(cost_so_far, 6),
        pii_redactions=pii_redactions,
        fallback_chain_used=[str(model_name)],  # TODO(ADR-004): record Haiku→Sonnet→DeepSeek transitions
    )

    return InitiativeExtraction(
        step0=extracted["step0"],
        step1=extracted["step1"],
        step2=extracted["step2"],
        step3=extracted["step3"],
        step4=extracted["step4"],
        extraction_metadata=metadata,
    )


__all__ = ["extract", "CostCapExceeded", "OPENROUTER_MODEL_PRICING"]
