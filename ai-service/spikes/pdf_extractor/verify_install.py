"""Sanity-check script: imports, env, pgvector, files. Exit 0 on green, 1 otherwise."""

from __future__ import annotations

import importlib
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

_SPIKE_DIR = Path(__file__).parent
_REPO_ROOT = _SPIKE_DIR.parents[2]
load_dotenv(_SPIKE_DIR / ".env")


def _check(label: str, ok: bool, detail: str = "") -> bool:
    marker = "OK  " if ok else "FAIL"
    print(f"  [{marker}] {label}{' — ' + detail if detail else ''}")
    return ok


def _check_import(module: str) -> bool:
    try:
        importlib.import_module(module)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"         import error: {exc}")
        return False


def main() -> int:
    all_ok = True
    print("== pdf_extractor spike — verify_install ==\n")

    print("1. Python imports:")
    for module in [
        "pypdf",
        "pdfplumber",
        "langchain",
        "langchain_openai",
        "psycopg",
        "pgvector",
        "sentence_transformers",
        "pydantic",
        "dotenv",
        "typer",
        "rich",
    ]:
        all_ok &= _check(module, _check_import(module))

    print("\n2. Spike modules importable:")
    for module in [
        "spikes.pdf_extractor.schemas",
        "spikes.pdf_extractor.parser",
        "spikes.pdf_extractor.chunker",
        "spikes.pdf_extractor.extractor",
        "spikes.pdf_extractor.scorer",
        "spikes.pdf_extractor.run",
    ]:
        all_ok &= _check(module, _check_import(module))

    print("\n3. Environment variables:")
    key = os.getenv("OPENROUTER_API_KEY")
    all_ok &= _check("OPENROUTER_API_KEY", bool(key), f"length={len(key) if key else 0}")
    model = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-chat")
    _check("OPENROUTER_MODEL", True, model)
    pg_url = os.getenv("PGVECTOR_URL", "postgresql://postgres:postgres@localhost:5435/starteria_pdf_spike")
    _check("PGVECTOR_URL", True, pg_url.replace(":postgres@", ":***@"))

    print("\n4. Required files:")
    pdf_path = _REPO_ROOT / "docs" / "Test - iniciativa.pdf"
    gt_path = _REPO_ROOT / "evals" / "golden" / "pdf-extraction" / "test-iniciativa.ground-truth.json"
    all_ok &= _check(f"PDF exists ({pdf_path.name})", pdf_path.exists(), str(pdf_path))
    all_ok &= _check("Ground truth JSON", gt_path.exists(), str(gt_path))

    print("\n5. pgvector reachability (optional — skipped if psycopg missing):")
    try:
        import psycopg  # noqa: F401

        from spikes.pdf_extractor.chunker import health_check

        reachable = health_check(pg_url)
        # not fatal — we allow --skip-pgvector
        _check("pgvector connection", reachable, "non-fatal; use --skip-pgvector to bypass")
    except Exception as exc:  # noqa: BLE001
        _check("pgvector connection", False, f"non-fatal: {exc}")

    print()
    print("All checks PASSED" if all_ok else "Some checks FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
