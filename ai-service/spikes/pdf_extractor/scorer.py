"""Score an InitiativeExtraction against the ground-truth JSON.

Implements match rules from `evals/golden/pdf-extraction/README.md`:
  exact, enum, substring, list_overlap, freeform_long, numeric.

Aggregates: precision, recall, hallucination_rate, provenance_page_accuracy.
Emits a rich.Table + a JSON report file.
"""

from __future__ import annotations

import json  # noqa: F401 — used in _score_list_overlap
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.table import Table

from spikes.pdf_extractor.schemas import InitiativeExtraction

logger = logging.getLogger(__name__)


# ---------- normalization helpers ----------


def _normalize(s: str) -> str:
    s = unicodedata.normalize("NFC", s).strip().lower()
    return re.sub(r"\s+", " ", s)


def _tokenize(s: str) -> set[str]:
    s = _normalize(s)
    return {t for t in re.split(r"[^a-z0-9áéíóúñü]+", s) if len(t) > 2}


def _coerce_value(prop: Any) -> Any:
    """Extract `.value` from a FieldProposal-like structure (dict or model)."""
    if prop is None:
        return None
    if isinstance(prop, dict):
        if "value" in prop:
            return prop["value"]
        return prop
    if hasattr(prop, "value"):
        return prop.value
    return prop


def _coerce_provenance(prop: Any) -> list[dict[str, Any]]:
    if prop is None:
        return []
    if isinstance(prop, dict):
        return list(prop.get("provenance") or [])
    if hasattr(prop, "provenance"):
        return [p.model_dump() if hasattr(p, "model_dump") else dict(p) for p in (prop.provenance or [])]
    return []


def _get_by_path(obj: Any, path: str) -> Any:
    """Walk `step0.foo`, `step3.testCycles[0].queValidamos`, etc."""
    cur: Any = obj
    parts = re.findall(r"([a-zA-Z_][a-zA-Z0-9_]*)(\[(\d+)\])?", path)
    for name, _bracket, idx in parts:
        if not name:
            continue
        if cur is None:
            return None
        if isinstance(cur, dict):
            cur = cur.get(name)
        else:
            cur = getattr(cur, name, None)
        if idx:
            i = int(idx)
            if cur is None or i >= len(cur):
                return None
            cur = cur[i]
    return cur


# ---------- per-rule scoring ----------


def _score_exact(expected: Any, actual: Any) -> bool:
    if actual is None:
        return False
    return _normalize(str(expected)) == _normalize(str(actual))


def _score_substring(expected: Any, actual: Any, must_contain_any: list[str] | None) -> bool:
    if actual is None:
        return False
    a = _normalize(str(actual))
    if must_contain_any:
        return any(_normalize(tok) in a for tok in must_contain_any)
    return _normalize(str(expected)) in a


def _item_token_overlap(a: Any, b: Any) -> float:
    """Token-Jaccard between two list items (strings or dicts serialized to text)."""
    ta = _tokenize(str(a) if not isinstance(a, dict) else " ".join(str(v) for v in a.values()))
    tb = _tokenize(str(b) if not isinstance(b, dict) else " ".join(str(v) for v in b.values()))
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _score_list_overlap(expected: Any, actual: Any, min_overlap: float, key_entities: list[str] | None) -> bool:
    if actual is None:
        return False
    threshold = float(min_overlap or 0.5)

    # Key-entity gate (applies to any shape)
    flat_actual_text = _normalize(json.dumps(actual, ensure_ascii=False) if isinstance(actual, (list, dict)) else str(actual))
    if key_entities:
        for ent in key_entities:
            if _normalize(ent) not in flat_actual_text:
                return False

    # Both lists → per-item best-match token overlap
    if isinstance(expected, list) and isinstance(actual, list) and expected and actual:
        matched = 0
        for exp_item in expected:
            best = max((_item_token_overlap(exp_item, a) for a in actual), default=0.0)
            if best >= 0.5:
                matched += 1
        coverage = matched / len(expected)
        return coverage >= threshold

    # Fallback: token Jaccard on flat string
    exp_tokens = _tokenize(str(expected) if not isinstance(expected, list) else " ".join(str(x) for x in expected))
    act_tokens = _tokenize(str(actual) if not isinstance(actual, list) else " ".join(str(x) for x in actual))
    if not exp_tokens:
        return False
    inter = len(exp_tokens & act_tokens)
    union = len(exp_tokens | act_tokens)
    return (inter / union if union else 0.0) >= threshold


def _score_freeform_long(expected: Any, actual: Any, key_entities: list[str] | None) -> bool:
    """Simplified for spike speed: key-entity recall ≥ 0.70 (skip ROUGE-L)."""
    if actual is None:
        return False
    text = _normalize(str(actual))
    entities = key_entities or []
    if not entities:
        # Fall back to substring of first 30 chars of expected
        return _normalize(str(expected))[:30] in text
    hits = sum(1 for ent in entities if _normalize(ent) in text)
    recall = hits / len(entities)
    return recall >= 0.70


def _score_numeric(expected: Any, actual: Any) -> bool:
    if actual is None:
        return False
    nums_exp = re.findall(r"-?\d+(?:[.,]\d+)?", str(expected))
    nums_act = re.findall(r"-?\d+(?:[.,]\d+)?", str(actual))
    if not nums_exp:
        return False
    return any(n in nums_act for n in nums_exp)


def _grade_field(spec: dict[str, Any], actual: Any) -> bool:
    rule = spec.get("match_rule", "exact")
    expected = spec.get("expected")
    if rule == "exact" or rule == "enum":
        ok = _score_exact(expected, actual)
        if not ok and spec.get("alternates"):
            ok = any(_score_exact(alt, actual) for alt in spec["alternates"])
        return ok
    if rule == "substring":
        return _score_substring(expected, actual, spec.get("must_contain_any"))
    if rule == "list_overlap":
        return _score_list_overlap(expected, actual, spec.get("min_overlap", 0.5), spec.get("key_entities_required"))
    if rule == "freeform_long":
        return _score_freeform_long(expected, actual, spec.get("key_entities_required"))
    if rule == "numeric":
        return _score_numeric(expected, actual)
    if rule == "semantic":
        # NOTE: real semantic match deferred for spike. Fall back to freeform.
        return _score_freeform_long(expected, actual, spec.get("key_entities_required"))
    return False


# ---------- provenance grading ----------


def _provenance_pages_match(provenance: list[dict[str, Any]], expected_pages: Any) -> bool:
    """A provenance is acceptable if any proposed page == expected (or ±1)."""
    if not provenance:
        return False
    expected_set: set[int] = set()
    if expected_pages is None:
        return False
    if isinstance(expected_pages, int):
        expected_set = {expected_pages}
    else:
        for tok in re.findall(r"\d+", str(expected_pages)):
            expected_set.add(int(tok))
    if not expected_set:
        return False
    for p in provenance:
        page = p.get("page") if isinstance(p, dict) else getattr(p, "page", None)
        if page is None:
            continue
        if any(abs(int(page) - e) <= 1 for e in expected_set):
            return True
    return False


# ---------- main report ----------


@dataclass
class FieldResult:
    path: str
    rule: str
    weight: float
    proposed: bool
    correct: bool
    provenance_ok: bool
    expected_summary: str
    actual_summary: str


@dataclass
class ScoreReport:
    fields: list[FieldResult] = field(default_factory=list)
    must_omit_violations: list[str] = field(default_factory=list)
    total_fields: int = 0
    proposed_count: int = 0
    correct_count: int = 0
    provenance_ok_count: int = 0
    thresholds: dict[str, float] = field(default_factory=dict)
    timing_ms: int = 0

    @property
    def precision(self) -> float:
        return self.correct_count / self.proposed_count if self.proposed_count else 0.0

    @property
    def recall(self) -> float:
        return self.correct_count / self.total_fields if self.total_fields else 0.0

    @property
    def hallucination_rate(self) -> float:
        return len(self.must_omit_violations) / max(1, self.proposed_count)

    @property
    def provenance_accuracy(self) -> float:
        return self.provenance_ok_count / self.proposed_count if self.proposed_count else 0.0

    def passes(self) -> tuple[bool, dict[str, bool]]:
        t = self.thresholds
        checks = {
            "precision": self.precision >= t.get("precision_per_field_min", 0.80),
            "recall": self.recall >= t.get("recall_per_field_min", 0.70),
            "hallucination": self.hallucination_rate <= t.get("hallucination_rate_max", 0.03),
            "provenance": self.provenance_accuracy >= t.get("provenance_page_accuracy_min", 0.90),
        }
        return all(checks.values()), checks


def score(extraction: InitiativeExtraction, ground_truth: dict[str, Any]) -> ScoreReport:
    report = ScoreReport(thresholds={**ground_truth.get("meta", {}).get("thresholds", {}),
                                     "provenance_page_accuracy_min": 0.90})
    fields_spec = ground_truth.get("fields", {})
    must_omit = set(ground_truth.get("must_omit", {}).get("fields", []))

    for path, spec in fields_spec.items():
        report.total_fields += 1
        prop = _get_by_path(extraction, path)
        actual_value = _coerce_value(prop)
        provenance = _coerce_provenance(prop)
        proposed = actual_value is not None

        correct = False
        provenance_ok = False
        if proposed:
            report.proposed_count += 1
            correct = _grade_field(spec, actual_value)
            if correct:
                report.correct_count += 1
            evidence = spec.get("evidence", {})
            provenance_ok = _provenance_pages_match(provenance, evidence.get("page"))
            if provenance_ok:
                report.provenance_ok_count += 1

        report.fields.append(FieldResult(
            path=path,
            rule=spec.get("match_rule", "exact"),
            weight=float(spec.get("weight", 1.0)),
            proposed=proposed,
            correct=correct,
            provenance_ok=provenance_ok,
            expected_summary=str(spec.get("expected"))[:80],
            actual_summary=str(actual_value)[:80] if proposed else "—",
        ))

    for path in must_omit:
        prop = _get_by_path(extraction, path)
        if _coerce_value(prop) is not None:
            report.must_omit_violations.append(path)
            # also counts toward proposed_count for hallucination_rate denominator
            report.proposed_count += 1

    return report


def render_report(report: ScoreReport, console: Console | None = None) -> None:
    console = console or Console()
    table = Table(title="Field-level results", show_lines=False)
    table.add_column("Path", style="cyan", overflow="fold", max_width=46)
    table.add_column("Rule", style="magenta", width=12)
    table.add_column("Prop", style="white", width=4)
    table.add_column("OK", style="green", width=3)
    table.add_column("Prov", style="yellow", width=4)
    table.add_column("Actual", overflow="fold", max_width=40)
    for r in report.fields:
        table.add_row(
            r.path,
            r.rule,
            "Y" if r.proposed else "n",
            "Y" if r.correct else ("-" if not r.proposed else "N"),
            "Y" if r.provenance_ok else ("-" if not r.proposed else "N"),
            r.actual_summary,
        )
    console.print(table)

    if report.must_omit_violations:
        console.print(f"[red]must_omit violations ({len(report.must_omit_violations)}):[/red]")
        for v in report.must_omit_violations:
            console.print(f"  - {v}")

    passed, checks = report.passes()
    summary = Table(title="Summary vs thresholds", show_header=True)
    summary.add_column("Metric")
    summary.add_column("Value")
    summary.add_column("Threshold")
    summary.add_column("Pass?")
    t = report.thresholds
    summary.add_row("precision",
                    f"{report.precision:.3f}",
                    f"≥ {t.get('precision_per_field_min', 0.80)}",
                    "[green]PASS[/green]" if checks["precision"] else "[red]FAIL[/red]")
    summary.add_row("recall",
                    f"{report.recall:.3f}",
                    f"≥ {t.get('recall_per_field_min', 0.70)}",
                    "[green]PASS[/green]" if checks["recall"] else "[red]FAIL[/red]")
    summary.add_row("hallucination_rate",
                    f"{report.hallucination_rate:.3f}",
                    f"≤ {t.get('hallucination_rate_max', 0.03)}",
                    "[green]PASS[/green]" if checks["hallucination"] else "[red]FAIL[/red]")
    summary.add_row("provenance_page_accuracy",
                    f"{report.provenance_accuracy:.3f}",
                    f"≥ {t.get('provenance_page_accuracy_min', 0.90)}",
                    "[green]PASS[/green]" if checks["provenance"] else "[red]FAIL[/red]")
    console.print(summary)
    console.print(f"[bold]{'PASS' if passed else 'FAIL'}[/bold] — overall")


def save_report(report: ScoreReport, extraction: InitiativeExtraction, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "ran_at": datetime.utcnow().isoformat(),
        "metadata": extraction.extraction_metadata.model_dump(),
        "totals": {
            "total_fields": report.total_fields,
            "proposed_count": report.proposed_count,
            "correct_count": report.correct_count,
            "provenance_ok_count": report.provenance_ok_count,
            "precision": report.precision,
            "recall": report.recall,
            "hallucination_rate": report.hallucination_rate,
            "provenance_page_accuracy": report.provenance_accuracy,
        },
        "must_omit_violations": report.must_omit_violations,
        "fields": [
            {
                "path": r.path, "rule": r.rule, "weight": r.weight,
                "proposed": r.proposed, "correct": r.correct,
                "provenance_ok": r.provenance_ok,
                "expected": r.expected_summary, "actual": r.actual_summary,
            }
            for r in report.fields
        ],
        "thresholds": report.thresholds,
        "extraction": extraction.model_dump(),
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    logger.info("Wrote score report → %s", output_path)
