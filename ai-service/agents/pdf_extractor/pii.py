"""PII redaction — Stage B V1 stub (TASK-008 §10).

V1 covers the highest-frequency Peruvian-context patterns with regex only:
    - DNI/RUC: 8-11 consecutive digit strings (DNI=8, foreign card=9, RUC=11)
    - Email
    - Peruvian phone numbers (mobile: 9XXXXXXXX; landline with country code +51 …)

TODO(PII): swap for `microsoft/presidio-analyzer + spaCy es_core_news_lg + en_core_web_lg`
with custom recognizers for PE_DNI and PE_RUC, target recall ≥ 0.95 over the synthetic
suite per ADR-004 §Acceptance criteria. The mapping placeholder → original must be
encrypted (AES-GCM with per-project KMS key) and discarded once proposals are persisted.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Order matters: longest patterns first so RUC (11) is not eaten by DNI (8).
_PHONE_PE = re.compile(r"(?:\+?51[\s\-]?)?(?:9\d{8}|\(?0?1\)?[\s\-]?\d{6,7})")
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b", re.IGNORECASE)
_DIGITS_8_11 = re.compile(r"\b\d{8,11}\b")


@dataclass
class RedactionResult:
    text: str
    redactions: int


def redact_pii(text: str) -> RedactionResult:
    """Mask DNI-like digits, emails, and Peruvian phone numbers.

    Returns the redacted text plus a count of redactions performed. Counts are
    additive across entity types; the same span counted once.
    """
    if not text:
        return RedactionResult(text="", redactions=0)

    redactions = 0

    def _sub_count(pattern: re.Pattern[str], replacement: str, src: str) -> str:
        nonlocal redactions
        new_src, n = pattern.subn(replacement, src)
        redactions += n
        return new_src

    redacted = _sub_count(_EMAIL, "<PII:EMAIL>", text)
    redacted = _sub_count(_PHONE_PE, "<PII:PHONE>", redacted)
    redacted = _sub_count(_DIGITS_8_11, "<PII:ID>", redacted)

    return RedactionResult(text=redacted, redactions=redactions)


__all__ = ["RedactionResult", "redact_pii"]
