"""Outbound webhook push from ai-service to the Express backend.

Why this exists: PDF extraction is async (5+ min p95). Without push, backend
only learns about completion when the frontend polls — so if the user navigates
away mid-run, the finished proposals stay stranded in the in-memory
`RunRegistry` until someone asks.

This module sends a single POST to backend's internal webhook endpoint when an
extraction reaches a terminal status (`completed`, `failed`, `cost_capped`).
The frontend poll path still works as a fallback for missed deliveries.

Auth (V1): shared secret in `X-Internal-Token` — same scheme + secret as the
inbound `AiServiceClient` so token rotation stays single-keyed.
TODO(ADR-011): swap for HMAC-SHA256 + timestamp + replay protection alongside
the `bridge.service.ts` upgrade.

Failure mode: fire-and-forget. If the webhook can't be delivered after 3
retries we log a warning and return — the run state is still correct in the
registry, and the next time anyone polls (frontend or a sweeper) the reactive
path will sync the DB.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx

from config import settings
from schemas.pdf_extraction import PdfExtractRunState

logger = logging.getLogger(__name__)


# Exponential backoff between retry attempts. Total: ~13s if all three retries
# are exhausted before the surrounding asyncio task is GC'd. Short enough that
# we don't keep the event loop busy for long; long enough to ride out a brief
# backend restart.
_RETRY_DELAYS_SEC: tuple[float, ...] = (1.0, 3.0, 9.0)


class BackendWebhookClient:
    """HTTP client for pushing terminal RunState updates to backend."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        token: Optional[str] = None,
        timeout_sec: Optional[float] = None,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        # Read from `settings` lazily so tests can monkeypatch the env and
        # construct a fresh client per test.
        self._base_url = (base_url if base_url is not None else settings.backend_webhook_url).rstrip("/")
        self._token = token if token is not None else settings.backend_webhook_token
        self._timeout_sec = (
            timeout_sec if timeout_sec is not None else settings.backend_webhook_timeout_sec
        )
        # Optional transport indirection — production passes None (httpx picks
        # its real transport); tests pass `httpx.MockTransport(handler)` to
        # intercept outbound HTTP without needing an external mocking library.
        self._transport = transport

    @property
    def enabled(self) -> bool:
        """The push is opt-in via env. Tests + local dev can leave it off."""
        return bool(self._base_url)

    async def push_run_state(self, run_id: str, state: PdfExtractRunState) -> None:
        """POST the run state to backend. Fire-and-forget — never raises."""
        if not self.enabled:
            logger.debug(
                "webhook disabled (BACKEND_WEBHOOK_URL unset); skipping push run=%s",
                run_id,
            )
            return

        url = f"{self._base_url}/{run_id}"
        # The backend webhook schema accepts only the fields it knows about.
        # `runId` is in the URL path; `progress` is internal to the registry.
        payload = state.model_dump(
            mode="json",
            exclude={"runId", "progress"},
            exclude_none=False,
        )
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Token": self._token,
        }

        last_error: Optional[str] = None
        for attempt in range(len(_RETRY_DELAYS_SEC) + 1):
            if attempt > 0:
                await asyncio.sleep(_RETRY_DELAYS_SEC[attempt - 1])
            try:
                client_kwargs: dict = {"timeout": self._timeout_sec}
                if self._transport is not None:
                    client_kwargs["transport"] = self._transport
                async with httpx.AsyncClient(**client_kwargs) as client:
                    response = await client.post(url, json=payload, headers=headers)
                if 200 <= response.status_code < 300:
                    logger.info(
                        "webhook delivered run=%s status=%s http=%d attempt=%d",
                        run_id,
                        state.status,
                        response.status_code,
                        attempt + 1,
                    )
                    return
                # 4xx is deterministic — retrying won't help.
                if 400 <= response.status_code < 500:
                    logger.warning(
                        "webhook rejected run=%s http=%d body=%s — not retrying",
                        run_id,
                        response.status_code,
                        response.text[:240],
                    )
                    return
                # 5xx → retry
                last_error = f"http {response.status_code}: {response.text[:160]}"
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                last_error = f"{type(exc).__name__}: {exc}"
            except Exception as exc:  # noqa: BLE001
                # Anything we didn't predict: log and break the loop so we don't
                # mask a coding bug behind retry noise.
                logger.exception(
                    "webhook unexpected error run=%s: %s", run_id, exc
                )
                return

        logger.warning(
            "webhook giving up run=%s after %d attempts (last_error=%s) — "
            "backend will catch up via reactive polling when the frontend asks",
            run_id,
            len(_RETRY_DELAYS_SEC) + 1,
            last_error,
        )


_client_instance: Optional[BackendWebhookClient] = None


def get_webhook_client() -> BackendWebhookClient:
    """Process-wide singleton, mirrors the registry accessor pattern."""
    global _client_instance
    if _client_instance is None:
        _client_instance = BackendWebhookClient()
    return _client_instance


def reset_webhook_client() -> None:
    """Test helper — drops the cached singleton so a new env can be picked up."""
    global _client_instance
    _client_instance = None


__all__ = [
    "BackendWebhookClient",
    "get_webhook_client",
    "reset_webhook_client",
]
