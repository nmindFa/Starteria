"""CLI entry point for the spike. Run as `python -m spikes.pdf_extractor.run extract …`."""

from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import typer
from dotenv import load_dotenv
from rich.console import Console

from spikes.pdf_extractor.chunker import embed_and_store, health_check
from spikes.pdf_extractor.extractor import extract
from spikes.pdf_extractor.parser import detect_language, parse_pdf
from spikes.pdf_extractor.scorer import render_report, save_report, score

_SPIKE_DIR = Path(__file__).parent
load_dotenv(_SPIKE_DIR / ".env")

app = typer.Typer(add_completion=False, help="pdf_extractor spike CLI")
console = Console()


def _default_conn_url() -> str:
    return os.getenv(
        "PGVECTOR_URL",
        "postgresql://postgres:postgres@localhost:5435/starteria_pdf_spike",
    )


@app.command()
def extract_cmd(
    pdf: Path = typer.Option(..., "--pdf", exists=True, file_okay=True, readable=True),
    ground_truth: Path = typer.Option(..., "--ground-truth", exists=True, file_okay=True),
    output_dir: Path = typer.Option(
        Path(__file__).parents[3] / "evals" / "results" / "pdf-extraction",
        "--output-dir",
    ),
    skip_pgvector: bool = typer.Option(False, "--skip-pgvector", help="Skip embed/store; LLM-only"),
    max_retries: int = typer.Option(1, "--max-retries", min=1, max=5),
    log_level: str = typer.Option("INFO", "--log-level"),
) -> None:
    """Parse → (embed) → extract → score → save."""
    logging.basicConfig(
        level=log_level.upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    console.rule("[bold cyan]pdf_extractor spike")
    console.print(f"PDF: {pdf}")
    console.print(f"Ground truth: {ground_truth}")
    console.print(f"Skip pgvector: {skip_pgvector}")
    console.print(f"Max retries: {max_retries}")

    # 1. Parse
    blocks = parse_pdf(str(pdf))
    language = detect_language(blocks)
    console.print(f"Parsed {len(blocks)} pages (language={language})")

    # 2. Embed + store (optional)
    if not skip_pgvector:
        conn_url = _default_conn_url()
        if not health_check(conn_url):
            console.print("[yellow]pgvector unreachable — falling back to --skip-pgvector behaviour[/yellow]")
            skip_pgvector = True
        else:
            pdf_id = pdf.stem
            stored = embed_and_store(blocks, pdf_id, conn_url)
            console.print(f"Stored {stored} embeddings in pgvector (pdf_id={pdf_id})")

    # 3. Extract (with retries on hard failure)
    extraction = None
    last_err: Exception | None = None
    for attempt in range(1, max_retries + 1):
        try:
            extraction = extract(blocks, language)
            break
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            console.print(f"[yellow]Attempt {attempt}/{max_retries} failed: {exc}[/yellow]")
    if extraction is None:
        console.print(f"[red]Extraction failed after {max_retries} attempts: {last_err}[/red]")
        raise typer.Exit(code=2)

    console.print(
        f"Extraction done in {extraction.extraction_metadata.duration_ms}ms "
        f"(model={extraction.extraction_metadata.model})"
    )

    # 4. Score
    gt = json.loads(ground_truth.read_text())
    report = score(extraction, gt)
    render_report(report, console=console)

    # 5. Save
    ts = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    out_path = output_dir / f"{ts}.json"
    save_report(report, extraction, out_path)
    console.print(f"Report saved → {out_path}")

    passed, _ = report.passes()
    raise typer.Exit(code=0 if passed else 1)


@app.command()
def doctor() -> None:
    """Run the verify_install checks."""
    from spikes.pdf_extractor.verify_install import main as verify

    sys.exit(verify())


if __name__ == "__main__":
    app()
