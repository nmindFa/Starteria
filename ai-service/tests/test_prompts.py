"""Unit tests for prompts.system_prompts and prompts.templates.

Verifies the LangChain ChatPromptTemplate rendering for each agent's human
template using deterministic variable substitution (no LLM call).
"""

from __future__ import annotations

import pytest

from prompts import SYSTEM_PROMPTS, get_prompt_template
from prompts.templates import (
    EXPERIMENT_ANALYZE_HUMAN,
    EXPERIMENT_ROUTES_HUMAN,
    FEEDBACK_IA_HUMAN,
    HMW_GENERATE_HUMAN,
    IDEATE_HUMAN,
    MENTOR_VIRTUAL_HUMAN,
    NARRATIVE_BUILD_HUMAN,
    NARRATIVE_FEEDBACK_HUMAN,
    PROTOTYPE_SUGGEST_HUMAN,
    RESEARCH_ASSIST_HUMAN,
)


@pytest.mark.unit
class TestSystemPrompts:
    def test_all_expected_agents_have_a_system_prompt(self) -> None:
        expected = {
            "orchestrator",
            "mentor-virtual",
            "feedback-ia",
            "research-assistant",
            "solution-design",
            "experiment-coach",
            "narrative-builder",
        }
        assert expected.issubset(SYSTEM_PROMPTS.keys())

    @pytest.mark.parametrize("agent_id", list(SYSTEM_PROMPTS.keys()))
    def test_prompts_are_non_empty_strings_in_spanish(self, agent_id: str) -> None:
        prompt = SYSTEM_PROMPTS[agent_id]
        assert isinstance(prompt, str) and prompt.strip()
        # Spanish marker — every system prompt mentions Starteria explicitly.
        assert "Starteria" in prompt


@pytest.mark.unit
class TestGetPromptTemplate:
    def test_known_agent_uses_its_system_prompt(self) -> None:
        tpl = get_prompt_template("mentor-virtual", "Hola {name}")
        # Resolve with a known variable to inspect rendered messages.
        rendered = tpl.format_messages(name="Ana")
        assert len(rendered) == 2
        assert rendered[0].type == "system"
        assert "Mentor Virtual" in rendered[0].content
        assert rendered[1].type == "human"
        assert rendered[1].content == "Hola Ana"

    def test_unknown_agent_falls_back_to_orchestrator_prompt(self) -> None:
        tpl = get_prompt_template("does-not-exist", "Hola")
        rendered = tpl.format_messages()
        # Falls back to orchestrator system prompt
        assert SYSTEM_PROMPTS["orchestrator"].split(".")[0] in rendered[0].content


@pytest.mark.unit
class TestHumanTemplatesRender:
    def test_mentor_virtual_renders_with_step0_fields(self) -> None:
        tpl = get_prompt_template("mentor-virtual", MENTOR_VIRTUAL_HUMAN)
        rendered = tpl.format_messages(
            origen="proceso comercial",
            parteProceso="onboarding",
            impacto3meses="caida 20%",
            respaldo="logs CRM",
            descripcion="usuarios abandonan",
            quienImpacta="nuevos clientes",
            siMinimo="reducir 5%",
        )
        human = rendered[1].content
        assert "proceso comercial" in human
        assert "onboarding" in human
        assert "caida 20%" in human

    def test_feedback_ia_renders_with_module_data(self) -> None:
        tpl = get_prompt_template("feedback-ia", FEEDBACK_IA_HUMAN)
        rendered = tpl.format_messages(
            stepNumber=1,
            moduleId="A",
            moduleData="{caso: real}",
        )
        human = rendered[1].content
        assert "modulo A" in human
        assert "paso 1" in human

    def test_research_assist_renders_module_a_fields(self) -> None:
        tpl = get_prompt_template("research-assistant", RESEARCH_ASSIST_HUMAN)
        rendered = tpl.format_messages(
            casoReal="Cliente X",
            pasos="1,2,3",
            quiebre="paso 2",
            consecuencia="perdida 10%",
            causaInmediata="latencia",
            alcance="LATAM",
        )
        assert "Cliente X" in rendered[1].content

    def test_hmw_generate_renders(self) -> None:
        tpl = get_prompt_template("solution-design", HMW_GENERATE_HUMAN)
        rendered = tpl.format_messages(synthesisData="vision integrada")
        assert "vision integrada" in rendered[1].content

    def test_ideate_renders_with_hmw_and_context(self) -> None:
        tpl = get_prompt_template("solution-design", IDEATE_HUMAN)
        rendered = tpl.format_messages(hmw="Como podriamos X", context="ctx")
        human = rendered[1].content
        assert "Como podriamos X" in human
        assert "ctx" in human

    def test_experiment_routes_renders(self) -> None:
        tpl = get_prompt_template("solution-design", EXPERIMENT_ROUTES_HUMAN)
        rendered = tpl.format_messages(
            idea_id="i-1",
            idea_title="Idea A",
            idea_description="Descripcion A",
            dvfScores="{D:5,V:4,F:3}",
        )
        human = rendered[1].content
        assert "i-1" in human
        assert "Idea A" in human

    def test_prototype_suggest_renders(self) -> None:
        tpl = get_prompt_template("experiment-coach", PROTOTYPE_SUGGEST_HUMAN)
        rendered = tpl.format_messages(testCard="hipotesis: x")
        assert "hipotesis: x" in rendered[1].content

    def test_experiment_analyze_renders(self) -> None:
        tpl = get_prompt_template("experiment-coach", EXPERIMENT_ANALYZE_HUMAN)
        rendered = tpl.format_messages(
            runId="run-1",
            metrics="{conv: 0.4}",
            evidence="['url1']",
        )
        human = rendered[1].content
        assert "run-1" in human

    def test_narrative_build_renders_with_audience(self) -> None:
        tpl = get_prompt_template("narrative-builder", NARRATIVE_BUILD_HUMAN)
        rendered = tpl.format_messages(audience="comite ejecutivo")
        assert "comite ejecutivo" in rendered[1].content

    def test_narrative_feedback_renders(self) -> None:
        tpl = get_prompt_template("narrative-builder", NARRATIVE_FEEDBACK_HUMAN)
        rendered = tpl.format_messages(slides="[...]", notes="cuidar tiempos")
        human = rendered[1].content
        assert "cuidar tiempos" in human
