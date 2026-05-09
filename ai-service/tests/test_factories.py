"""Validate factory helpers produce the expected shape and accept overrides."""

from __future__ import annotations

import pytest

from tests.factories import (
    fake_anthropic_response,
    fake_invoke_request,
    fake_project,
    fake_user,
)


@pytest.mark.unit
def test_fake_project_default_shape() -> None:
    project = fake_project()

    for key in ("id", "name", "description", "ownerId", "createdAt", "updatedAt"):
        assert key in project, f"missing key {key!r} in fake_project()"

    assert isinstance(project["id"], str) and project["id"]
    assert isinstance(project["name"], str)
    assert isinstance(project["description"], str)


@pytest.mark.unit
def test_fake_project_overrides_apply() -> None:
    project = fake_project(name="Custom", description="X")
    assert project["name"] == "Custom"
    assert project["description"] == "X"


@pytest.mark.unit
def test_fake_user_default_shape() -> None:
    user = fake_user()
    assert {"id", "email", "role"}.issubset(user.keys())
    assert "@" in user["email"]


@pytest.mark.unit
def test_fake_user_overrides_apply() -> None:
    user = fake_user(email="okuanb@efectiva.com.pe", role="admin")
    assert user["email"] == "okuanb@efectiva.com.pe"
    assert user["role"] == "admin"


@pytest.mark.unit
def test_fake_invoke_request_passes_pydantic_validation() -> None:
    """The factory output should validate against `schemas.requests.InvokeRequest`."""
    from schemas.requests import InvokeRequest

    payload = fake_invoke_request()
    parsed = InvokeRequest.model_validate(payload)

    assert parsed.action == "feedback"
    assert 0 <= parsed.step <= 4
    assert isinstance(parsed.payload, dict)


@pytest.mark.unit
def test_fake_invoke_request_overrides_apply() -> None:
    payload = fake_invoke_request(action="generate", step=3, module="C")
    assert payload["action"] == "generate"
    assert payload["step"] == 3
    assert payload["module"] == "C"


@pytest.mark.unit
def test_fake_anthropic_response_default_shape() -> None:
    response = fake_anthropic_response()

    assert response["type"] == "message"
    assert response["role"] == "assistant"
    assert response["content"][0]["type"] == "text"
    assert response["usage"]["input_tokens"] == 100
    assert response["usage"]["output_tokens"] == 200


@pytest.mark.unit
def test_fake_anthropic_response_overrides_apply() -> None:
    response = fake_anthropic_response(
        text="Custom answer", tokens_in=42, tokens_out=7
    )
    assert response["content"][0]["text"] == "Custom answer"
    assert response["usage"]["input_tokens"] == 42
    assert response["usage"]["output_tokens"] == 7
