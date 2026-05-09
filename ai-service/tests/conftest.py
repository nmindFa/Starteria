"""Shared pytest fixtures for ai-service tests.

This file ensures:
1. The ai-service root is on `sys.path` (flat-layout imports like `from main import app`).
2. A dummy `OPENROUTER_API_KEY` exists before `config` is imported (Settings requires it).
3. FastAPI app, sync TestClient, and async httpx client fixtures are available.
4. respx-based mocks for outbound HTTP (Anthropic, OpenRouter) are easy to wire.
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator, Generator

import pytest

# ---------------------------------------------------------------------------
# Bootstrapping: sys.path + required env vars BEFORE importing the app
# ---------------------------------------------------------------------------

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# config.Settings requires openrouter_api_key — set a dummy before any import.
os.environ.setdefault("OPENROUTER_API_KEY", "test-dummy-key")
os.environ.setdefault("LANGSMITH_TRACING", "false")
os.environ.setdefault("ENVIRONMENT", "test")


# ---------------------------------------------------------------------------
# App / clients
# ---------------------------------------------------------------------------


@asynccontextmanager
async def _noop_lifespan(app):  # pragma: no cover - trivial
    """Replace heavy lifespan during tests (skips orchestrator warmup)."""
    yield


@pytest.fixture(scope="session")
def app():
    """Return the FastAPI app with lifespan disabled to avoid orchestrator init."""
    from main import app as _app

    # Replace lifespan with a noop so TestClient does not warm up the orchestrator.
    _app.router.lifespan_context = _noop_lifespan
    return _app


@pytest.fixture()
def client(app) -> Generator:
    """Synchronous FastAPI TestClient (Starlette-based)."""
    from fastapi.testclient import TestClient

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
async def async_client(app) -> AsyncGenerator:
    """Async httpx client bound to the FastAPI app via ASGITransport."""
    import httpx

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Time / freezing helper
# ---------------------------------------------------------------------------


@pytest.fixture()
def freeze_time():
    """Helper to use freezegun in tests.

    Example:
        def test_something(freeze_time):
            with freeze_time("2026-01-01T00:00:00Z"):
                ...
    """
    from freezegun import freeze_time as _freeze_time

    return _freeze_time


# ---------------------------------------------------------------------------
# Outbound HTTP mocks (Anthropic / OpenRouter)
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_anthropic(respx_mock):
    """Intercept Anthropic Messages API calls and return a canned response.

    Yields the respx route so individual tests can override the response if needed.
    """
    from .factories import fake_anthropic_response

    route = respx_mock.post("https://api.anthropic.com/v1/messages").respond(
        status_code=200, json=fake_anthropic_response()
    )
    return route


@pytest.fixture()
def mock_openrouter(respx_mock):
    """Intercept OpenRouter chat completions and return a canned response."""
    canned = {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "model": "openrouter/qwen-flash",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "OK"},
                "finish_reason": "stop",
            }
        ],
        "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
    }
    route = respx_mock.post("https://openrouter.ai/api/v1/chat/completions").respond(
        status_code=200, json=canned
    )
    return route
