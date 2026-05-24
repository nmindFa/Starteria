"""PDF parsing: pypdf primary, pdfplumber fallback. Plus simple es/en detection."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

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


def _extract_with_pypdf(path: Path) -> list[PageBlock]:
    from pypdf import PdfReader  # imported lazily

    reader = PdfReader(str(path))
    blocks: list[PageBlock] = []
    for idx, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:  # noqa: BLE001
            logger.warning("pypdf failed on page %d: %s", idx, exc)
            text = ""
        blocks.append(PageBlock(page=idx, text=text, char_count=len(text)))
    return blocks


def _extract_with_pdfplumber(path: Path) -> list[PageBlock]:
    import pdfplumber  # imported lazily

    blocks: list[PageBlock] = []
    with pdfplumber.open(str(path)) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            try:
                text = (page.extract_text() or "").strip()
            except Exception as exc:  # noqa: BLE001
                logger.warning("pdfplumber failed on page %d: %s", idx, exc)
                text = ""
            blocks.append(PageBlock(page=idx, text=text, char_count=len(text)))
    return blocks


def parse_pdf(path: str) -> list[PageBlock]:
    """Parse a PDF into per-page text blocks.

    pypdf is the primary extractor (fast, deterministic). If it returns mostly empty
    pages, pdfplumber is tried as a fallback. Pages with no text are kept (char_count=0)
    so downstream code can still address them by number.
    """
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"PDF not found: {path}")

    blocks = _extract_with_pypdf(p)
    non_empty = sum(1 for b in blocks if b.char_count > 0)
    if non_empty < max(1, len(blocks) // 3):
        logger.info("pypdf yielded sparse text (%d/%d pages); falling back to pdfplumber", non_empty, len(blocks))
        plumber_blocks = _extract_with_pdfplumber(p)
        # Prefer pdfplumber result if it materially improves coverage.
        plumber_non_empty = sum(1 for b in plumber_blocks if b.char_count > 0)
        if plumber_non_empty > non_empty:
            blocks = plumber_blocks

    logger.info("Parsed PDF %s: %d pages, %d non-empty",
                p.name, len(blocks), sum(1 for b in blocks if b.char_count > 0))
    return blocks


def detect_language(blocks: list[PageBlock]) -> str:
    """Detect dominant language (`es` or `en`) via stopword frequency."""
    text = " ".join(b.text for b in blocks).lower()
    tokens = [t.strip(".,;:!?¡¿()[]\"'") for t in text.split() if t]
    if not tokens:
        return "es"  # default for Starteria
    es_hits = sum(1 for t in tokens if t in _ES_STOPWORDS)
    en_hits = sum(1 for t in tokens if t in _EN_STOPWORDS)
    if es_hits == 0 and en_hits == 0:
        return "es"
    return "es" if es_hits >= en_hits else "en"
