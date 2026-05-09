"""Unit tests for tools.context_tools.

These three @tool functions are pure lookup/branching logic with no LLM calls.
We invoke them via `.invoke({...})` (LangChain tool interface) so the @tool
decorator is exercised the same way the agents call them.
"""

from __future__ import annotations

import pytest

from tools.context_tools import (
    get_agent_routing_hint,
    get_step_description,
    get_step_rubric,
)


@pytest.mark.unit
class TestGetStepRubric:
    @pytest.mark.parametrize(
        "step,module",
        [
            (1, "A"),
            (1, "B"),
            (1, "C"),
            (1, "D"),
            (2, "A"),
            (2, "B"),
            (2, "C"),
            (2, "D"),
            (3, "A"),
            (3, "B"),
            (3, "C"),
            (4, "A"),
        ],
    )
    def test_known_combinations_return_specific_rubric(self, step: int, module: str) -> None:
        out = get_step_rubric.invoke({"step_number": step, "module_id": module})
        assert isinstance(out, str) and len(out) > 50
        # Specific rubrics start with "Modulo X (...)" — fallback starts with "Rubrica generica".
        assert out.startswith("Modulo")

    def test_unknown_combination_returns_generic_fallback(self) -> None:
        out = get_step_rubric.invoke({"step_number": 99, "module_id": "Z"})
        assert "Rubrica generica" in out
        assert "Paso 99" in out
        assert "Modulo Z" in out

    def test_step3_module_d_falls_back_to_generic(self) -> None:
        # 3D is not in the rubric table -> generic fallback
        out = get_step_rubric.invoke({"step_number": 3, "module_id": "D"})
        assert "Rubrica generica" in out


@pytest.mark.unit
class TestGetAgentRoutingHint:
    def test_action_feedback_always_routes_to_feedback_ia(self) -> None:
        for step in (0, 1, 2, 3, 4):
            out = get_agent_routing_hint.invoke({"step": step, "action": "feedback"})
            assert out == "feedback-ia"

    def test_step0_routes_to_mentor_virtual(self) -> None:
        out = get_agent_routing_hint.invoke({"step": 0, "action": "assist"})
        assert out == "mentor-virtual"

    def test_step1_module_b_routes_to_research_assistant(self) -> None:
        out = get_agent_routing_hint.invoke({"step": 1, "action": "assist", "module": "B"})
        assert out == "research-assistant"

    def test_step1_other_modules_fall_through_to_default(self) -> None:
        # Step 1 module A/C/D have no specific routing -> falls to final default.
        out = get_agent_routing_hint.invoke({"step": 1, "action": "assist", "module": "A"})
        assert out == "feedback-ia"

    @pytest.mark.parametrize(
        "action",
        ["hmw-generate", "ideate", "experiment-routes", "unknown-step2-action"],
    )
    def test_step2_routes_to_solution_design(self, action: str) -> None:
        out = get_agent_routing_hint.invoke({"step": 2, "action": action})
        assert out == "solution-design"

    @pytest.mark.parametrize(
        "action",
        ["prototype-suggest", "experiment-analyze", "unknown-step3-action"],
    )
    def test_step3_routes_to_experiment_coach(self, action: str) -> None:
        out = get_agent_routing_hint.invoke({"step": 3, "action": action})
        assert out == "experiment-coach"

    @pytest.mark.parametrize(
        "action",
        ["narrative-build", "narrative-feedback", "unknown-step4-action"],
    )
    def test_step4_routes_to_narrative_builder(self, action: str) -> None:
        out = get_agent_routing_hint.invoke({"step": 4, "action": action})
        assert out == "narrative-builder"

    def test_unknown_step_falls_back_to_feedback_ia(self) -> None:
        out = get_agent_routing_hint.invoke({"step": 99, "action": "assist"})
        assert out == "feedback-ia"


@pytest.mark.unit
class TestGetStepDescription:
    @pytest.mark.parametrize("step", [0, 1, 2, 3, 4])
    def test_known_steps_have_descriptions(self, step: int) -> None:
        out = get_step_description.invoke({"step": step})
        assert out.startswith(f"Paso {step}")
        assert len(out) > 30

    def test_unknown_step_returns_placeholder(self) -> None:
        out = get_step_description.invoke({"step": 99})
        assert "Paso 99" in out
        assert "no disponible" in out
