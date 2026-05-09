"""Unit tests for services.context_assembler.ContextAssembler.

Pure deterministic logic — verifies tier-based field inclusion per agent.
No LLM, no I/O.
"""

from __future__ import annotations

import pytest

from services.context_assembler import ContextAssembler, _AGENT_TIERS


PROJECT = {"id": "p1", "name": "Demo"}
USER = {"id": "u1", "role": "participant"}


@pytest.mark.unit
class TestTier1AlwaysIncluded:
    def test_orchestrator_includes_only_tier1(self) -> None:
        ctx = ContextAssembler().assemble(
            agent_id="orchestrator",
            project=PROJECT,
            user=USER,
            current_step=2,
            current_module="A",
            step0_data={"foo": "bar"},
            current_step_data={"baz": 1},
            previous_modules=[{"x": 1}],
            all_steps_data={"q": 1},
            feedback_history=[{"f": 1}],
            conversation_history=[{"c": 1}],
        )
        # tier1 included
        assert ctx["project"] == PROJECT
        assert ctx["user"] == USER
        assert ctx["currentStep"] == 2
        assert ctx["currentModule"] == "A"
        # tier2 also included for orchestrator
        assert "step0Data" in ctx
        assert "currentStepData" in ctx
        assert "previousModules" in ctx
        # tier3 NOT included for orchestrator
        assert "allStepsData" not in ctx
        assert "feedbackHistory" not in ctx
        assert "conversationHistory" not in ctx

    def test_unknown_agent_falls_back_to_tier1_only(self) -> None:
        ctx = ContextAssembler().assemble(
            agent_id="unknown-agent",
            project=PROJECT,
            user=USER,
            current_step=0,
            step0_data={"a": 1},
            all_steps_data={"x": 1},
        )
        assert ctx["project"] == PROJECT
        assert ctx["user"] == USER
        assert "step0Data" not in ctx
        assert "allStepsData" not in ctx


@pytest.mark.unit
class TestTier2InclusionByAgent:
    def test_mentor_virtual_includes_tier2(self) -> None:
        ctx = ContextAssembler().assemble(
            agent_id="mentor-virtual",
            project=PROJECT,
            user=USER,
            current_step=0,
            step0_data={"o": "x"},
            current_step_data={"step": 0},
            previous_modules=[{"m": "A"}],
        )
        assert ctx["step0Data"] == {"o": "x"}
        assert ctx["currentStepData"] == {"step": 0}
        assert ctx["previousModules"] == [{"m": "A"}]

    def test_omits_tier2_fields_when_args_are_none(self) -> None:
        ctx = ContextAssembler().assemble(
            agent_id="mentor-virtual",
            project=PROJECT,
            user=USER,
            current_step=0,
            # no tier2 args provided
        )
        # tier2 is enabled for mentor-virtual but no tier2 args supplied -> nothing added
        assert "step0Data" not in ctx
        assert "currentStepData" not in ctx
        assert "previousModules" not in ctx


@pytest.mark.unit
class TestTier3InclusionByAgent:
    def test_feedback_ia_includes_tier3(self) -> None:
        ctx = ContextAssembler().assemble(
            agent_id="feedback-ia",
            project=PROJECT,
            user=USER,
            current_step=1,
            current_module="C",
            feedback_history=[{"prev": "iter"}],
            all_steps_data={"steps": []},
            conversation_history=[{"c": 1}],
        )
        assert ctx["feedbackHistory"] == [{"prev": "iter"}]
        assert ctx["allStepsData"] == {"steps": []}
        assert ctx["conversationHistory"] == [{"c": 1}]

    def test_narrative_builder_includes_all_steps_data(self) -> None:
        ctx = ContextAssembler().assemble(
            agent_id="narrative-builder",
            project=PROJECT,
            user=USER,
            current_step=4,
            all_steps_data={"step1": {}, "step2": {}, "step3": {}},
        )
        assert ctx["allStepsData"]["step1"] == {}

    def test_openclaw_bridge_skips_tier2_but_keeps_tier3(self) -> None:
        ctx = ContextAssembler().assemble(
            agent_id="openclaw-bridge",
            project=PROJECT,
            user=USER,
            current_step=0,
            step0_data={"ignore": "this"},
            conversation_history=[{"text": "hola"}],
        )
        # tier2 disabled -> step0_data dropped
        assert "step0Data" not in ctx
        # tier3 enabled -> conversation kept
        assert ctx["conversationHistory"] == [{"text": "hola"}]


@pytest.mark.unit
class TestAgentTierTable:
    def test_all_known_agents_have_tier1(self) -> None:
        for agent_id, tiers in _AGENT_TIERS.items():
            assert tiers["tier1"] is True, f"{agent_id} must include tier1"

    def test_table_contains_expected_agents(self) -> None:
        expected = {
            "orchestrator",
            "mentor-virtual",
            "feedback-ia",
            "research-assistant",
            "solution-design",
            "experiment-coach",
            "narrative-builder",
            "openclaw-bridge",
        }
        assert expected.issubset(_AGENT_TIERS.keys())
