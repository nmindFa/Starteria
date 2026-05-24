"""Embed page blocks with a local multilingual model and store in pgvector.

One chunk per page (the test PDF is 14 pages — splitting smaller hurts provenance).
Uses sentence-transformers `paraphrase-multilingual-MiniLM-L12-v2` (384 dim, runs CPU-only).
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Any

import psycopg
from pgvector.psycopg import register_vector

from spikes.pdf_extractor.parser import PageBlock

logger = logging.getLogger(__name__)

EMBED_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBED_DIM = 384
TABLE_NAME = "pdf_chunks"


@lru_cache(maxsize=1)
def _get_model() -> Any:
    """Lazy-load the embedding model once per process."""
    from sentence_transformers import SentenceTransformer

    logger.info("Loading embedding model: %s", EMBED_MODEL_NAME)
    return SentenceTransformer(EMBED_MODEL_NAME)


def _ensure_schema(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cur.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {TABLE_NAME} (
                id           BIGSERIAL PRIMARY KEY,
                pdf_id       TEXT NOT NULL,
                page         INTEGER NOT NULL,
                text         TEXT NOT NULL,
                embedding    vector({EMBED_DIM}) NOT NULL,
                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute(
            f"CREATE INDEX IF NOT EXISTS {TABLE_NAME}_pdf_id_idx ON {TABLE_NAME}(pdf_id);"
        )
    conn.commit()


def embed_and_store(blocks: list[PageBlock], pdf_id: str, conn_url: str) -> int:
    """Embed each non-empty page and upsert into pgvector. Returns chunks stored."""
    non_empty = [b for b in blocks if b.char_count > 0]
    if not non_empty:
        logger.warning("No non-empty pages to embed for pdf_id=%s", pdf_id)
        return 0

    model = _get_model()
    texts = [b.text for b in non_empty]
    vectors = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)

    with psycopg.connect(conn_url) as conn:
        _ensure_schema(conn)
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {TABLE_NAME} WHERE pdf_id = %s;", (pdf_id,))
            for block, vec in zip(non_empty, vectors, strict=True):
                cur.execute(
                    f"INSERT INTO {TABLE_NAME} (pdf_id, page, text, embedding) VALUES (%s, %s, %s, %s);",
                    (pdf_id, block.page, block.text, list(map(float, vec))),
                )
        conn.commit()

    logger.info("Stored %d chunks for pdf_id=%s", len(non_empty), pdf_id)
    return len(non_empty)


def retrieve_relevant(query: str, pdf_id: str, conn_url: str, top_k: int = 5) -> list[PageBlock]:
    """Cosine-similarity retrieval via pgvector `<=>` operator."""
    model = _get_model()
    [qvec] = model.encode([query], show_progress_bar=False, normalize_embeddings=True)
    qvec_list = list(map(float, qvec))

    with psycopg.connect(conn_url) as conn:
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT page, text
                FROM {TABLE_NAME}
                WHERE pdf_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s;
                """,
                (pdf_id, qvec_list, top_k),
            )
            rows = cur.fetchall()

    return [PageBlock(page=int(r[0]), text=r[1], char_count=len(r[1])) for r in rows]


def health_check(conn_url: str) -> bool:
    """Verify connection + extension; safe to call from CLI."""
    try:
        with psycopg.connect(conn_url) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                cur.fetchone()
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("pgvector health check failed: %s", exc)
        return False
