"""In-memory run-state registry for async PDF extractions (TASK-008 §6).

TODO(ADR-008): production should persist to Redis or Postgres (`ai_extraction_runs`
table owned by TASK-006). V1 uses a process-local dict — runs are lost on restart;
acceptable for the initial bridge integration but NOT for canary rollout.
"""

from __future__ import annotations

import threading
from typing import Optional

from schemas.pdf_extraction import (
    InitiativeExtraction,
    PdfExtractRunState,
    RunStatus,
)


class RunRegistry:
    """Thread-safe in-memory store of extraction run states."""

    def __init__(self) -> None:
        self._runs: dict[str, PdfExtractRunState] = {}
        self._lock = threading.Lock()

    def create(self, run_id: str) -> PdfExtractRunState:
        with self._lock:
            state = PdfExtractRunState(runId=run_id, status="pending", progress=0.0)
            self._runs[run_id] = state
            return state

    def get(self, run_id: str) -> Optional[PdfExtractRunState]:
        with self._lock:
            return self._runs.get(run_id)

    def update(
        self,
        run_id: str,
        *,
        status: Optional[RunStatus] = None,
        proposals: Optional[InitiativeExtraction] = None,
        cost_usd: Optional[float] = None,
        error_reason: Optional[str] = None,
        progress: Optional[float] = None,
    ) -> Optional[PdfExtractRunState]:
        with self._lock:
            state = self._runs.get(run_id)
            if state is None:
                return None
            patch: dict[str, object] = {}
            if status is not None:
                patch["status"] = status
            if proposals is not None:
                patch["proposals"] = proposals
            if cost_usd is not None:
                patch["costUsd"] = cost_usd
            if error_reason is not None:
                patch["errorReason"] = error_reason
            if progress is not None:
                patch["progress"] = progress
            updated = state.model_copy(update=patch)
            self._runs[run_id] = updated
            return updated

    def clear(self) -> None:
        """Test helper — drop all runs."""
        with self._lock:
            self._runs.clear()


_registry_instance: Optional[RunRegistry] = None


def get_run_registry() -> RunRegistry:
    """Process-wide singleton accessor."""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = RunRegistry()
    return _registry_instance


__all__ = ["RunRegistry", "get_run_registry"]
