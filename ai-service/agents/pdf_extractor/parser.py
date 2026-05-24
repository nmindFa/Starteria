"""PDF parsing for the production pdf_extractor agent (TASK-008).

Promoted from `ai-service/spikes/pdf_extractor/parser.py` (validated 2026-05-19).
Adds `parse_pdf_bytes()` so the agent can ingest a base64-decoded buffer directly
from the endpoint without writing to disk.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Union

logger = logging.getLogger(__name__)


@dataclass
class PageBlock:
    page: int
    text: str
    char_count: int


_ES_STOPWORDS = {
    "de", "la", "que", "el", "en", "y", "a", "los", "del", "las", "por", "un", "para",
    "con", "no", "una", "su", "al", "es", "lo", "como", "más", "pero", "sus", "le",
    "ya", "o", "este", "sí", "porque", "esta", "entre", "cuando", "muy", "sin",
}
_EN_STOPWORDS = {
    "the", "of", "and", "to", "in", "a", "is", "that", "for", "it", "on", "with",
    "as", "are", "this", "be", "by", "an", "or", "from", "at", "but", "not", "we",
    "have", "has", "was", "were", "which", "their", "they",
}


def _extract_with_pypdf(source: Union[Path, io.BytesIO]) -> list[PageBlock]:
    from pypdf import PdfReader  # imported lazily

    reader = PdfReader(source if isinstance(source, io.BytesIO) else str(source))
    blocks: list[PageBlock] = []
    for idx, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("pypdf failed on page %d: %s", idx, exc)
            text = ""
        blocks.append(PageBlock(page=idx, text=text, char_count=len(text)))
    return blocks


def _extract_with_pdfplumber(source: Union[Path, io.BytesIO]) -> list[PageBlock]:
    import pdfplumber  # imported lazily

    blocks: list[PageBlock] = []
    arg = source if isinstance(source, io.BytesIO) else str(source)
    with pdfplumber.open(arg) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            try:
                text = (page.extract_text() or "").strip()
            except Exception as exc:  # noqa: BLE001
                logger.warning("pdfplumber failed on page %d: %s", idx, exc)
                text = ""
            blocks.append(PageBlock(page=idx, text=text, char_count=len(text)))
    return blocks


def _parse(source: Union[Path, io.BytesIO], label: str) -> list[PageBlock]:
    blocks = _extract_with_pypdf(source)
    non_empty = sum(1 for b in blocks if b.char_count > 0)
    if non_empty < max(1, len(blocks) // 3):
        logger.info(
            "pypdf yielded sparse text (%d/%d pages); falling back to pdfplumber",
            non_empty,
            len(blocks),
        )
        # pdfplumber needs a fresh seek for BytesIO inputs.
        if isinstance(source, io.BytesIO):
            source.seek(0)
        plumber_blocks = _extract_with_pdfplumber(source)
        plumber_non_empty = sum(1 for b in plumber_blocks if b.char_count > 0)
        if plumber_non_empty > non_empty:
            blocks = plumber_blocks

    logger.info(
        "Parsed PDF %s: %d pages, %d non-empty",
        label,
        len(blocks),
        sum(1 for b in blocks if b.char_count > 0),
    )
    return blocks


def parse_pdf(path: str) -> list[PageBlock]:
    """Parse a PDF on disk into per-page text blocks."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"PDF not found: {path}")
    return _parse(p, p.name)


def parse_pdf_bytes(data: bytes, file_name: str = "<inline>") -> list[PageBlock]:
    """Parse a PDF buffer (bytes) without touching the filesystem."""
    if not data:
        raise ValueError("Empty PDF payload")
    return _parse(io.BytesIO(data), file_name)


def detect_language(blocks: list[PageBlock]) -> str:
    """Detect dominant language (`es` or `en`) via stopword frequency."""
    text = " ".join(b.text for b in blocks).lower()
    tokens = [t.strip(".,;:!?¡¿()[]\"'") for t in text.split() if t]
    if not tokens:
        return "es"
    es_hits = sum(1 for t in tokens if t in _ES_STOPWORDS)
    en_hits = sum(1 for t in tokens if t in _EN_STOPWORDS)
    if es_hits == 0 and en_hits == 0:
        return "es"
    return "es" if es_hits >= en_hits else "en"
