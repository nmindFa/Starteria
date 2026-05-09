"""Hello-world smoke test: the FastAPI app imports cleanly."""

from __future__ import annotations

import pytest


@pytest.mark.unit
def test_app_imports_and_is_named() -> None:
    """The app must be importable and carry its expected title/version."""
    from main import app

    assert app.title == "Starteria AI Service"
    assert app.version == "0.1.0"


@pytest.mark.unit
def test_app_has_ai_router_mounted() -> None:
    """The /api/v1 prefix from the AI router should appear in the routes table."""
    from main import app

    paths = {getattr(r, "path", "") for r in app.routes}
    assert any(p.startswith("/api/v1") for p in paths), (
        f"expected at least one /api/v1/* route, got: {sorted(paths)}"
    )
