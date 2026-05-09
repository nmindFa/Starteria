"""Test-data factories for ai-service.

Mirrors the Node-side factories. Keep them deterministic where possible so
snapshots and asserts remain stable; allow `**overrides` for any field.
"""

from __future__ import annotations

import uuid
from typing import Any


# ---------------------------------------------------------------------------
# Domain objects
# ---------------------------------------------------------------------------


def fake_project(**overrides: Any) -> dict[str, Any]:
    """Return a minimal Project dict shaped like the Node-side factory."""
    base: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "name": "Proyecto demo",
        "description": "Proyecto de prueba para tests del ai-service.",
        "ownerId": str(uuid.uuid4()),
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


def fake_user(**overrides: Any) -> dict[str, Any]:
    """Return a minimal User dict."""
    base: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "email": "user@example.com",
        "role": "participant",
        "createdAt": "2026-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# AI request payloads (match schemas.requests.InvokeRequest)
# ---------------------------------------------------------------------------


def fake_invoke_request(**overrides: Any) -> dict[str, Any]:
    """Return a minimal InvokeRequest payload.

    Defaults align with `schemas.requests.InvokeRequest`:
      - step in [0..4], action: feedback|assist|generate, payload: dict.
    """
    base: dict[str, Any] = {
        "agentHint": "mentor_virtual",
        "step": 0,
        "module": "A",
        "action": "feedback",
        "payload": {
            "projectId": str(uuid.uuid4()),
            "text": "Texto de prueba",
        },
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Anthropic Messages API canned response
# ---------------------------------------------------------------------------


def fake_anthropic_response(
    *,
    text: str = "Respuesta canonica del LLM para pruebas.",
    tokens_in: int = 100,
    tokens_out: int = 200,
    model: str = "claude-3-5-sonnet-20241022",
    stop_reason: str = "end_turn",
) -> dict[str, Any]:
    """Return a dict shaped like Anthropic's Messages API response.

    Reference: https://docs.anthropic.com/en/api/messages
    """
    return {
        "id": f"msg_{uuid.uuid4().hex[:24]}",
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [
            {"type": "text", "text": text},
        ],
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {
            "input_tokens": tokens_in,
            "output_tokens": tokens_out,
        },
    }
