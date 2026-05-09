"""Run-method coverage for each worker agent class.

Reuses the already-initialised singletons from `routers.ai` so we do not pay
the cost of building a new deepagents pipeline. We monkeypatch `_agent.invoke`
to return a fixed deepagents-style payload (`{"messages": [<msg>]}`) and assert
the post-processing path (JSON extraction, schema validation, status/clamp,
latency, project-id propagation) end-to-end.
"""

from __future__ import annotations

import json
from typing import Any

import pytest


class _FakeMsg:
    """Stand-in for an LLM message — just exposes `.content`."""

    def __init__(self, content: str) -> None:
        self.content = content


def _result_with(payload: Any) -> dict:
    """Return a deepagents-style result dict whose last message is `payload`.

    `payload` may be a dict (will be json.dumps'd) or a raw string.
    """
    if isinstance(payload, (dict, list)):
        content = json.dumps(payload, ensure_ascii=False)
    else:
        content = str(payload)
    return {"messages": [_FakeMsg(content)]}


CTX = {"project": {"id": "proj-test"}, "user": {}, "currentStep": 0}


# ===========================================================================
# Mentor Virtual
# ===========================================================================


@pytest.mark.unit
class TestMentorVirtualRun:
    @pytest.fixture
    def agent(self):
        import routers.ai as ai_module

        return ai_module._mentor_virtual

    @pytest.mark.asyncio
    async def test_happy_path_returns_validated_data(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "claro": ["bien planteado"],
            "faltaPrecisar": ["impacto"],
            "preguntas": ["por que?"],
            "siguienteAccion": "habla con 3 usuarios",
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )

        out = await agent.run(
            step0_data={"origen": "x", "parteProceso": "y"},
            context=CTX,
        )

        assert out["agent"] == "mentor-virtual"
        assert out["model"] == "openrouter:qwen/qwen3.6-flash"
        assert out["data"]["claro"] == ["bien planteado"]
        assert out["data"]["siguienteAccion"] == "habla con 3 usuarios"
        assert out["latency_ms"] >= 0

    @pytest.mark.asyncio
    async def test_handles_missing_context_project(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            agent._agent,
            "invoke",
            lambda payload, config: _result_with({"claro": []}),
        )

        out = await agent.run(step0_data={}, context={})  # no project key
        assert out["data"]["claro"] == []
        assert out["data"]["siguienteAccion"] == ""

    @pytest.mark.asyncio
    async def test_invalid_json_falls_back_to_empty_data(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            agent._agent,
            "invoke",
            lambda payload, config: _result_with("no es json"),
        )
        out = await agent.run(step0_data={}, context=CTX)
        assert out["data"]["claro"] == []
        assert out["data"]["siguienteAccion"] == ""


# ===========================================================================
# Feedback IA
# ===========================================================================


@pytest.mark.unit
class TestFeedbackIARun:
    @pytest.fixture
    def agent(self):
        import routers.ai as ai_module

        return ai_module._feedback_ia

    @pytest.mark.asyncio
    async def test_aprobado_status_passes_through(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "status": "Aprobado",
            "summary": "ok",
            "goodPoints": ["a"],
            "missing": [],
            "actions": [],
            "questions": [],
            "contradictions": [],
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )

        out = await agent.run(
            step_number=1, module_id="A", module_data={"x": 1}, context=CTX
        )
        assert out["data"]["status"] == "Aprobado"
        assert out["data"]["goodPoints"] == ["a"]

    @pytest.mark.asyncio
    async def test_invalid_status_clamped_to_iterar(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "status": "Pendiente",  # invalid -> clamps to Iterar
            "summary": "ok",
            "goodPoints": [],
            "missing": [],
            "actions": [],
            "questions": [],
            "contradictions": [],
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )

        out = await agent.run(
            step_number=2, module_id="B", module_data={}, context=CTX
        )
        assert out["data"]["status"] == "Iterar"

    @pytest.mark.asyncio
    async def test_summary_truncated_to_500_chars(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "status": "Iterar",
            "summary": "x" * 800,
            "goodPoints": [],
            "missing": [],
            "actions": [],
            "questions": [],
            "contradictions": [],
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )

        out = await agent.run(
            step_number=1, module_id="A", module_data={}, context=CTX
        )
        assert len(out["data"]["summary"]) == 500

    @pytest.mark.asyncio
    async def test_missing_status_defaults_to_iterar(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Empty parsed JSON -> status defaults to Iterar.
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with("garbage")
        )
        out = await agent.run(
            step_number=1, module_id="A", module_data={}, context=CTX
        )
        assert out["data"]["status"] == "Iterar"


# ===========================================================================
# Research Assistant
# ===========================================================================


@pytest.mark.unit
class TestResearchAssistantRun:
    @pytest.fixture
    def agent(self):
        import routers.ai as ai_module

        return ai_module._research_assistant

    @pytest.mark.asyncio
    async def test_returns_validated_research_plan(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "objetivo": "entender el quiebre",
            "temas": [
                {"tema": "comportamiento", "justificacion": "x"},
                {"tema": "proceso", "justificacion": "y"},
            ],
            "perfiles": [{"perfil": "u", "razon": "r"}],
            "guiaPreguntas": ["p1", "p2"],
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.run(module_a_data={"casoReal": "x"}, context=CTX)

        assert out["agent"] == "research-assistant"
        assert out["data"]["objetivo"] == "entender el quiebre"
        assert len(out["data"]["temas"]) == 2
        assert out["data"]["perfiles"][0]["perfil"] == "u"

    @pytest.mark.asyncio
    async def test_empty_response_yields_empty_collections(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with("nope")
        )
        out = await agent.run(module_a_data={}, context=CTX)
        assert out["data"]["objetivo"] == ""
        assert out["data"]["temas"] == []
        assert out["data"]["perfiles"] == []
        assert out["data"]["guiaPreguntas"] == []


# ===========================================================================
# Solution Design (3 methods)
# ===========================================================================


@pytest.mark.unit
class TestSolutionDesignAgent:
    @pytest.fixture
    def agent(self):
        import routers.ai as ai_module

        return ai_module._solution_design

    @pytest.mark.asyncio
    async def test_generate_hmw(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "options": [
                {"hmw": "Como podriamos X", "rationale": "r1"},
                {"hmw": "Como podriamos Y", "rationale": "r2"},
            ]
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.generate_hmw(synthesis_data={"k": "v"}, context=CTX)
        assert out["agent"] == "solution-design"
        assert len(out["data"]["options"]) == 2

    @pytest.mark.asyncio
    async def test_ideate(self, agent, monkeypatch: pytest.MonkeyPatch) -> None:
        canned = {
            "ideas": [
                {"id": "i1", "title": "t1", "description": "d1", "cluster": "c1"},
            ]
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.ideate(
            hmw="Como X", context_data={"k": "v"}, agent_context=CTX
        )
        assert out["data"]["ideas"][0]["title"] == "t1"

    @pytest.mark.asyncio
    async def test_experiment_routes(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "routes": [
                {"hypothesis": "h1", "experiment": "e1", "metric": "m1"},
                {"hypothesis": "h2", "experiment": "e2", "metric": "m2"},
            ]
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.experiment_routes(
            selected_idea={"id": "i", "title": "t", "description": "d"},
            dvf_scores={"D": 5},
            context=CTX,
        )
        assert len(out["data"]["routes"]) == 2

    @pytest.mark.asyncio
    async def test_methods_handle_empty_response(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with("garbage")
        )
        # All three methods should produce empty validated containers.
        hmw_out = await agent.generate_hmw(synthesis_data={}, context=CTX)
        assert hmw_out["data"]["options"] == []

        ideate_out = await agent.ideate(hmw="x", context_data={}, agent_context=CTX)
        assert ideate_out["data"]["ideas"] == []

        routes_out = await agent.experiment_routes(
            selected_idea={"id": "i", "title": "t", "description": "d"},
            dvf_scores={},
            context=CTX,
        )
        assert routes_out["data"]["routes"] == []


# ===========================================================================
# Experiment Coach (2 methods)
# ===========================================================================


@pytest.mark.unit
class TestExperimentCoachAgent:
    @pytest.fixture
    def agent(self):
        import routers.ai as ai_module

        return ai_module._experiment_coach

    @pytest.mark.asyncio
    async def test_prototype_suggest(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "components": ["c1"],
            "instrumentation": ["i1"],
            "tips": ["t1"],
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.prototype_suggest(test_card={"hyp": "x"}, context=CTX)
        assert out["agent"] == "experiment-coach"
        assert out["data"]["components"] == ["c1"]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("rec", ["GO", "NO_GO", "PIVOT"])
    async def test_experiment_analyze_valid_recommendations(
        self, agent, monkeypatch: pytest.MonkeyPatch, rec: str
    ) -> None:
        canned = {
            "findings": ["f1"],
            "recommendation": rec,
            "rationale": "porque si",
            "learningCard": {"keyLearning": "x"},
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.experiment_analyze(
            run_id="r", metrics={"m": 1}, evidence=["url"], context=CTX
        )
        assert out["data"]["recommendation"] == rec

    @pytest.mark.asyncio
    async def test_experiment_analyze_invalid_rec_clamped_to_pivot(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "findings": [],
            "recommendation": "MAYBE",  # invalid -> clamped to PIVOT
            "rationale": "",
            "learningCard": {},
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.experiment_analyze(
            run_id="r", metrics={}, evidence=[], context=CTX
        )
        assert out["data"]["recommendation"] == "PIVOT"


# ===========================================================================
# Narrative Builder (2 methods)
# ===========================================================================


@pytest.mark.unit
class TestNarrativeBuilderAgent:
    @pytest.fixture
    def agent(self):
        import routers.ai as ai_module

        return ai_module._narrative_builder

    def _slide(self, n: int) -> dict:
        return {
            "number": n,
            "title": f"t{n}",
            "keyMessage": "km",
            "content": "c",
            "speakerNotes": "n",
        }

    @pytest.mark.asyncio
    async def test_build_with_12_slides_passes_validation(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "slides": [self._slide(i) for i in range(1, 13)],
            "elevatorPitch": "ep",
            "narrativeArc": "arc",
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.build(audience="comite", context=CTX)
        assert out["agent"] == "narrative-builder"
        assert len(out["data"]["slides"]) == 12
        assert out["data"]["elevatorPitch"] == "ep"

    @pytest.mark.asyncio
    async def test_build_with_more_than_12_slides_truncates_first(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # 15 slides -> code slices to first 12 then validates.
        canned = {
            "slides": [self._slide(i) for i in range(1, 16)],
            "elevatorPitch": "ep",
            "narrativeArc": "arc",
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.build(audience="x", context=CTX)
        assert len(out["data"]["slides"]) == 12
        # First slide preserved; truncation removed slides 13-15.
        assert out["data"]["slides"][0]["number"] == 1
        assert out["data"]["slides"][-1]["number"] == 12

    @pytest.mark.asyncio
    async def test_build_fewer_than_12_slides_raises_validation_error(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from pydantic import ValidationError

        canned = {
            "slides": [self._slide(i) for i in range(1, 6)],
            "elevatorPitch": "ep",
            "narrativeArc": "arc",
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        # NarrativeBuildData requires exactly 12 slides — pydantic raises here,
        # which exercises the "validation surfaces upstream" path.
        with pytest.raises(ValidationError):
            await agent.build(audience="x", context=CTX)

    @pytest.mark.asyncio
    async def test_feedback_returns_validated_response(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        canned = {
            "feedback": ["obs1"],
            "suggestions": ["sug1"],
        }
        monkeypatch.setattr(
            agent._agent, "invoke", lambda payload, config: _result_with(canned)
        )
        out = await agent.feedback(
            slides=[{"number": 1}], notes="n", context=CTX
        )
        assert out["data"]["feedback"] == ["obs1"]
        assert out["data"]["suggestions"] == ["sug1"]


# ===========================================================================
# Orchestrator
# ===========================================================================


@pytest.mark.unit
class TestOrchestratorInvoke:
    @pytest.fixture
    def agent(self):
        import routers.ai as ai_module

        return ai_module._orchestrator

    @pytest.mark.asyncio
    async def test_invoke_parses_json_response(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from schemas.requests import InvokeRequest

        # Replace the underlying deepagent with a stub returning a valid JSON.
        monkeypatch.setattr(
            agent._orchestrator,
            "invoke",
            lambda payload, config: _result_with({"ok": True}),
        )

        req = InvokeRequest(
            agentHint="feedback-ia",
            step=1,
            module="A",
            action="feedback",
            payload={"projectId": "proj-z", "text": "x"},
        )
        resp = await agent.invoke(req)

        assert resp.agent == "orchestrator"
        assert resp.model == "openrouter:qwen/qwen3.6-flash"
        assert resp.data == {"ok": True}
        assert resp.latencyMs >= 0

    @pytest.mark.asyncio
    async def test_invoke_falls_back_to_response_string_when_not_json(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from schemas.requests import InvokeRequest

        monkeypatch.setattr(
            agent._orchestrator,
            "invoke",
            lambda payload, config: _result_with("plain text answer"),
        )

        req = InvokeRequest(
            agentHint="feedback-ia",
            step=1,
            module="A",
            action="feedback",
            payload={"projectId": "proj-z"},
        )
        resp = await agent.invoke(req)

        assert resp.data == {"response": "plain text answer"}

    @pytest.mark.asyncio
    async def test_invoke_handles_empty_messages(
        self, agent, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from schemas.requests import InvokeRequest

        # Return result with no messages -> raw_content stays empty.
        monkeypatch.setattr(
            agent._orchestrator,
            "invoke",
            lambda payload, config: {"messages": []},
        )

        req = InvokeRequest(
            step=2, action="ideate", payload={"projectId": "proj-q"}
        )
        resp = await agent.invoke(req)
        # json.loads("") raises -> fallback path puts "" into response field.
        assert resp.data == {"response": ""}
