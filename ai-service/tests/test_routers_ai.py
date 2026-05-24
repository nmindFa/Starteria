"""Endpoint tests for routers.ai using mocked agent singletons.

Goal: cover the success and error paths of each `/api/v1/ai/...` route
WITHOUT calling any real LLM. We monkeypatch the module-level agent singletons
on `routers.ai` so they behave deterministically:

- success: agent.<method>() returns {"data": <stub>, ...}
- cost-exceeded: agent.<method>() raises CostLimitExceededError -> 402
- generic error: agent.<method>() raises RuntimeError              -> 503
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from services.cost_tracker import CostLimitExceededError


# ---------------------------------------------------------------------------
# Helpers — return an awaitable that produces (or raises) the canned value
# ---------------------------------------------------------------------------


def _async_return(value: Any):
    async def _coro(*args: Any, **kwargs: Any) -> Any:
        return value
    return _coro


def _async_raise(exc: BaseException):
    async def _coro(*args: Any, **kwargs: Any) -> Any:
        raise exc
    return _coro


# ---------------------------------------------------------------------------
# Common payloads
# ---------------------------------------------------------------------------

VALID_INVOKE_PAYLOAD = {
    "agentHint": "feedback-ia",
    "step": 1,
    "module": "A",
    "action": "feedback",
    "payload": {"projectId": "proj-1", "text": "hola"},
}

VALID_MENTOR_PAYLOAD = {
    "projectId": "proj-1",
    "step0Data": {
        "origen": "x",
        "parteProceso": "y",
        "impacto3meses": "z",
        "respaldo": "w",
        "descripcion": "d",
        "quienImpacta": "q",
        "siMinimo": "s",
    },
}

VALID_FEEDBACK_PAYLOAD = {
    "projectId": "proj-1",
    "stepNumber": 1,
    "moduleId": "A",
    "moduleData": {"foo": "bar"},
}

VALID_RESEARCH_PAYLOAD = {
    "projectId": "proj-1",
    "moduleAData": {
        "casoReal": "x",
        "pasos": "y",
        "quiebre": "z",
        "consecuencia": "w",
        "causaInmediata": "c",
        "alcance": "a",
    },
}

VALID_HMW_PAYLOAD = {"projectId": "proj-1", "synthesisData": {"vision": "x"}}
VALID_IDEATE_PAYLOAD = {
    "projectId": "proj-1",
    "hmw": "Como podriamos X",
    "context": {"k": "v"},
}
VALID_EXPERIMENT_ROUTES_PAYLOAD = {
    "projectId": "proj-1",
    "selectedIdea": {"id": "i-1", "title": "t", "description": "d"},
    "dvfScores": {"D": 5, "V": 4, "F": 3},
}
VALID_PROTO_PAYLOAD = {"projectId": "proj-1", "testCard": {"hyp": "x"}}
VALID_EXPERIMENT_ANALYZE_PAYLOAD = {
    "projectId": "proj-1",
    "runId": "run-1",
    "metrics": {"conv": 0.4},
    "evidence": ["url1"],
}
VALID_NARRATIVE_BUILD_PAYLOAD = {"projectId": "proj-1", "audience": "comite"}
VALID_NARRATIVE_FEEDBACK_PAYLOAD = {
    "projectId": "proj-1",
    "slides": [{"number": 1}],
    "notes": "n",
}

# Stubs used as agent return values: each endpoint returns {"data": <SchemaModel>}
STUB_FEEDBACK_DATA = {
    "data": {
        "status": "Aprobado",
        "summary": "ok",
        "goodPoints": [],
        "missing": [],
        "actions": [],
        "questions": [],
        "contradictions": [],
    }
}
STUB_MENTOR_DATA = {
    "data": {
        "claro": ["a"],
        "faltaPrecisar": [],
        "preguntas": [],
        "siguienteAccion": "x",
    }
}
STUB_RESEARCH_DATA = {
    "data": {
        "objetivo": "obj",
        "temas": [{"tema": "t1", "justificacion": "j1"}],
        "perfiles": [{"perfil": "p1", "razon": "r1"}],
        "guiaPreguntas": ["q1"],
    }
}
STUB_HMW_DATA = {"data": {"options": [{"hmw": "x", "rationale": "r"}]}}
STUB_IDEATE_DATA = {
    "data": {"ideas": [{"id": "i", "title": "t", "description": "d", "cluster": "c"}]}
}
STUB_EXPERIMENT_ROUTES_DATA = {
    "data": {"routes": [{"hypothesis": "h", "experiment": "e", "metric": "m"}]}
}
STUB_PROTO_DATA = {"data": {"components": ["c"], "instrumentation": ["i"], "tips": ["t"]}}
STUB_EXPERIMENT_ANALYZE_DATA = {
    "data": {
        "findings": ["f"],
        "recommendation": "GO",
        "rationale": "r",
        "learningCard": {"k": "v"},
    }
}
STUB_NARRATIVE_BUILD_DATA = {
    "data": {
        "slides": [
            {
                "number": i,
                "title": f"t{i}",
                "keyMessage": "km",
                "content": "c",
                "speakerNotes": "n",
            }
            for i in range(1, 13)
        ],
        "elevatorPitch": "ep",
        "narrativeArc": "arc",
    }
}
STUB_NARRATIVE_FEEDBACK_DATA = {
    "data": {"feedback": ["a"], "suggestions": ["b"]}
}


# ---------------------------------------------------------------------------
# Endpoint matrix: (route, payload, agent_attr, agent_method, stub_return)
# ---------------------------------------------------------------------------

ENDPOINT_MATRIX = [
    ("/api/v1/ai/mentor-virtual", VALID_MENTOR_PAYLOAD, "_mentor_virtual", "run", STUB_MENTOR_DATA),
    ("/api/v1/ai/feedback", VALID_FEEDBACK_PAYLOAD, "_feedback_ia", "run", STUB_FEEDBACK_DATA),
    ("/api/v1/ai/research-assist", VALID_RESEARCH_PAYLOAD, "_research_assistant", "run", STUB_RESEARCH_DATA),
    ("/api/v1/ai/hmw-generate", VALID_HMW_PAYLOAD, "_solution_design", "generate_hmw", STUB_HMW_DATA),
    ("/api/v1/ai/ideate", VALID_IDEATE_PAYLOAD, "_solution_design", "ideate", STUB_IDEATE_DATA),
    ("/api/v1/ai/experiment-routes", VALID_EXPERIMENT_ROUTES_PAYLOAD, "_solution_design", "experiment_routes", STUB_EXPERIMENT_ROUTES_DATA),
    ("/api/v1/ai/prototype-suggest", VALID_PROTO_PAYLOAD, "_experiment_coach", "prototype_suggest", STUB_PROTO_DATA),
    ("/api/v1/ai/experiment-analyze", VALID_EXPERIMENT_ANALYZE_PAYLOAD, "_experiment_coach", "experiment_analyze", STUB_EXPERIMENT_ANALYZE_DATA),
    ("/api/v1/ai/narrative-build", VALID_NARRATIVE_BUILD_PAYLOAD, "_narrative_builder", "build", STUB_NARRATIVE_BUILD_DATA),
    ("/api/v1/ai/narrative-feedback", VALID_NARRATIVE_FEEDBACK_PAYLOAD, "_narrative_builder", "feedback", STUB_NARRATIVE_FEEDBACK_DATA),
]


# ---------------------------------------------------------------------------
# Success path
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize("route,payload,attr,method,stub", ENDPOINT_MATRIX)
def test_endpoint_success_returns_200(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    route: str,
    payload: dict,
    attr: str,
    method: str,
    stub: dict,
) -> None:
    import routers.ai as ai_module

    target = getattr(ai_module, attr)
    monkeypatch.setattr(target, method, _async_return(stub))

    response = client.post(route, json=payload)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["data"] == stub["data"]


# ---------------------------------------------------------------------------
# Cost-exceeded -> 402 PAYMENT_REQUIRED
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize("route,payload,attr,method,_stub", ENDPOINT_MATRIX)
def test_endpoint_cost_exceeded_returns_402(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    route: str,
    payload: dict,
    attr: str,
    method: str,
    _stub: dict,
) -> None:
    import routers.ai as ai_module

    target = getattr(ai_module, attr)
    monkeypatch.setattr(
        target,
        method,
        _async_raise(CostLimitExceededError("over budget")),
    )

    response = client.post(route, json=payload)

    assert response.status_code == 402, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "COST_EXCEEDED"
    assert detail["error"] == "over budget"


# ---------------------------------------------------------------------------
# Generic exception -> 503 SERVICE_UNAVAILABLE
# ---------------------------------------------------------------------------


@pytest.mark.unit
@pytest.mark.parametrize("route,payload,attr,method,_stub", ENDPOINT_MATRIX)
def test_endpoint_generic_error_returns_503(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    route: str,
    payload: dict,
    attr: str,
    method: str,
    _stub: dict,
) -> None:
    import routers.ai as ai_module

    target = getattr(ai_module, attr)
    monkeypatch.setattr(target, method, _async_raise(RuntimeError("boom")))

    response = client.post(route, json=payload)

    assert response.status_code == 503, response.text
    detail = response.json()["detail"]
    assert detail["code"] == "SERVICE_UNAVAILABLE"


# ---------------------------------------------------------------------------
# /api/v1/ai/invoke — orchestrator-backed
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_invoke_success_returns_200(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import routers.ai as ai_module
    from schemas.responses import InvokeResponse

    canned = InvokeResponse(
        data={"hello": "world"},
        agent="orchestrator",
        model="openrouter:qwen/qwen3.6-flash",
        tokensUsed=0,
        latencyMs=12,
    )
    monkeypatch.setattr(ai_module._orchestrator, "invoke", _async_return(canned))

    response = client.post("/api/v1/ai/invoke", json=VALID_INVOKE_PAYLOAD)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["agent"] == "orchestrator"
    assert body["data"] == {"hello": "world"}


@pytest.mark.unit
def test_invoke_cost_exceeded_returns_402(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import routers.ai as ai_module

    monkeypatch.setattr(
        ai_module._orchestrator,
        "invoke",
        _async_raise(CostLimitExceededError("daily budget")),
    )
    response = client.post("/api/v1/ai/invoke", json=VALID_INVOKE_PAYLOAD)

    assert response.status_code == 402, response.text
    assert response.json()["detail"]["code"] == "COST_EXCEEDED"


@pytest.mark.unit
def test_invoke_generic_error_returns_503(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    import routers.ai as ai_module

    monkeypatch.setattr(
        ai_module._orchestrator, "invoke", _async_raise(RuntimeError("bang"))
    )
    response = client.post("/api/v1/ai/invoke", json=VALID_INVOKE_PAYLOAD)

    assert response.status_code == 503, response.text
    assert response.json()["detail"]["code"] == "SERVICE_UNAVAILABLE"


# ---------------------------------------------------------------------------
# Pydantic validation rejection (422) — exercises the request schemas
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestRequestValidation:
    def test_invoke_rejects_step_out_of_range(self, client: TestClient) -> None:
        bad = dict(VALID_INVOKE_PAYLOAD)
        bad["step"] = 99
        resp = client.post("/api/v1/ai/invoke", json=bad)
        assert resp.status_code == 422

    def test_feedback_rejects_step_zero(self, client: TestClient) -> None:
        bad = dict(VALID_FEEDBACK_PAYLOAD)
        bad["stepNumber"] = 0  # must be 1..4
        resp = client.post("/api/v1/ai/feedback", json=bad)
        assert resp.status_code == 422

    def test_mentor_rejects_missing_step0_field(self, client: TestClient) -> None:
        bad = {
            "projectId": "p1",
            "step0Data": {"origen": "x"},  # missing other required fields
        }
        resp = client.post("/api/v1/ai/mentor-virtual", json=bad)
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Helper functions in routers.ai
# ---------------------------------------------------------------------------


@pytest.mark.unit
def test_minimal_context_includes_tier1_fields() -> None:
    from routers.ai import _minimal_context

    ctx = _minimal_context("proj-X", step=2, module="A")
    assert ctx["project"] == {"id": "proj-X", "name": ""}
    assert ctx["currentStep"] == 2
    assert ctx["currentModule"] == "A"


@pytest.mark.unit
def test_handle_cost_error_raises_http_402() -> None:
    from fastapi import HTTPException

    from routers.ai import _handle_cost_error

    with pytest.raises(HTTPException) as exc_info:
        _handle_cost_error(CostLimitExceededError("nope"))

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail["code"] == "COST_EXCEEDED"
