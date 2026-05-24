"""Tests for `agents.pdf_extractor.webhook` — the outbound push from ai-service
to backend that lets the DB stay in sync without frontend polling.

What we lock in:
1. Push is a no-op when BACKEND_WEBHOOK_URL is unset (graceful disable).
2. Push POSTs to `{base_url}/{run_id}` with the expected JSON shape and the
   `X-Internal-Token` header.
3. 5xx responses trigger retries; 2xx exits early.
4. 4xx responses are treated as deterministic — no retries, no raise.
5. Network errors are swallowed (fire-and-forget) rather than propagating.

Tests use `httpx.MockTransport` rather than `respx` so they don't depend on an
extra mocking library outside the venv lock.
"""

from __future__ import annotations

import asyncio

import httpx
import pytest

from agents.pdf_extractor.webhook import BackendWebhookClient
from schemas.pdf_extraction import PdfExtractRunState


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def _no_sleep(monkeypatch):
    """Make asyncio.sleep a no-op so the retry backoff doesn't slow the tests."""

    async def _fast_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(asyncio, "sleep", _fast_sleep)


def _state(status: str = "completed") -> PdfExtractRunState:
    # `proposals` is omitted — the test is about HTTP behavior, not body
    # serialization of the full extraction tree (which is covered elsewhere).
    return PdfExtractRunState(
        runId="ai-run-1",
        status=status,  # type: ignore[arg-type]
        costUsd=0.0123,
        progress=1.0,
    )


class _CallRecorder:
    """Records the requests a MockTransport handler receives + plays back
    responses in order. Lets tests assert on what the client sent."""

    def __init__(self, responses: list[httpx.Response | Exception]) -> None:
        self._responses = list(responses)
        self.requests: list[httpx.Request] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        # Pop from front so each request consumes one canned response.
        if not self._responses:
            return httpx.Response(200, json={})
        nxt = self._responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        return nxt


def _client(
    recorder: _CallRecorder,
    *,
    base_url: str = "http://backend.test/api/v1/internal/ai/webhooks/pdf-extract/runs",
    token: str = "shared-secret",
) -> BackendWebhookClient:
    transport = httpx.MockTransport(recorder.handler)
    return BackendWebhookClient(
        base_url=base_url, token=token, timeout_sec=2.0, transport=transport
    )


# ---------------------------------------------------------------------------
# 1. Disabled when env unset
# ---------------------------------------------------------------------------


async def test_push_is_noop_when_url_is_empty():
    # No transport needed — the client should short-circuit before any HTTP.
    client = BackendWebhookClient(base_url="", token="x")
    assert client.enabled is False
    # Must not raise — silently swallow when push is disabled.
    await client.push_run_state("ai-run-1", _state())


# ---------------------------------------------------------------------------
# 2. Happy path — verifies URL, headers, and payload shape
# ---------------------------------------------------------------------------


async def test_push_posts_payload_with_token_header():
    recorder = _CallRecorder([httpx.Response(200, json={"success": True})])
    client = _client(recorder)

    await client.push_run_state("ai-run-1", _state("completed"))

    assert len(recorder.requests) == 1
    sent = recorder.requests[0]
    assert sent.method == "POST"
    assert str(sent.url) == (
        "http://backend.test/api/v1/internal/ai/webhooks/pdf-extract/runs/ai-run-1"
    )
    assert sent.headers["X-Internal-Token"] == "shared-secret"
    assert sent.headers["Content-Type"] == "application/json"

    body = sent.content.decode("utf-8")
    # `runId` and `progress` must NOT be in the body — runId is in the URL,
    # progress is registry-internal.
    assert '"runId"' not in body
    assert '"progress"' not in body
    assert '"status":"completed"' in body
    assert '"costUsd":0.0123' in body


# ---------------------------------------------------------------------------
# 3. 5xx → retry until 2xx
# ---------------------------------------------------------------------------


async def test_push_retries_on_5xx_then_succeeds():
    recorder = _CallRecorder(
        [
            httpx.Response(503, text="boom"),
            httpx.Response(503, text="still boom"),
            httpx.Response(200, json={"success": True}),
        ]
    )
    client = _client(recorder)

    await client.push_run_state("ai-run-1", _state("completed"))

    # 2 failures + 1 success = 3 total
    assert len(recorder.requests) == 3


# ---------------------------------------------------------------------------
# 4. 4xx is deterministic — no retry
# ---------------------------------------------------------------------------


async def test_push_does_not_retry_on_4xx():
    recorder = _CallRecorder(
        [httpx.Response(404, json={"error": {"code": "PDF_RUN_NOT_FOUND"}})]
    )
    client = _client(recorder)

    await client.push_run_state("ai-run-1", _state("completed"))

    # Single attempt — 4xx is deterministic.
    assert len(recorder.requests) == 1


# ---------------------------------------------------------------------------
# 5. Network errors are swallowed (fire-and-forget guarantee)
# ---------------------------------------------------------------------------


async def test_push_swallows_network_errors_and_exhausts_retries():
    # Same network failure 4 times — initial + 3 retries.
    recorder = _CallRecorder(
        [httpx.ConnectError("connection refused") for _ in range(4)]
    )
    client = _client(recorder)

    # Must not raise — the extraction worker depends on this guarantee.
    await client.push_run_state("ai-run-1", _state("completed"))

    assert len(recorder.requests) == 4
