"""Tier 1/2/3 context assembly for each agent.

Tier 1: Always included (compact) — project identity, user, current step/module.
Tier 2: Included per agent need (medium) — step data, module summaries.
Tier 3: Included only when necessary (heavy) — all steps data, feedback history.
"""

from typing import Any

# Tier assignment per agent (mirrors SPEC-001 AgentContext table)
_AGENT_TIERS: dict[str, dict[str, bool]] = {
    "orchestrator":      {"tier1": True, "tier2": True,  "tier3": False},
    "mentor-virtual":    {"tier1": True, "tier2": True,  "tier3": False},
    "feedback-ia":       {"tier1": True, "tier2": True,  "tier3": True},
    "research-assistant": {"tier1": True, "tier2": True, "tier3": False},
    "solution-design":   {"tier1": True, "tier2": True,  "tier3": False},
    "experiment-coach":  {"tier1": True, "tier2": True,  "tier3": False},
    "narrative-builder": {"tier1": True, "tier2": True,  "tier3": True},
    "openclaw-bridge":   {"tier1": True, "tier2": False, "tier3": True},
}


class ContextAssembler:
    """Assembles context object for each agent according to tier assignment."""

    def assemble(
        self,
        agent_id: str,
        project: dict[str, Any],
        user: dict[str, Any],
        current_step: int,
        current_module: str | None = None,
        step0_data: dict[str, Any] | None = None,
        current_step_data: dict[str, Any] | None = None,
        previous_modules: list[dict[str, Any]] | None = None,
        all_steps_data: dict[str, Any] | None = None,
        feedback_history: list[dict[str, Any]] | None = None,
        conversation_history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Assemble context for the given agent.

        Args:
            agent_id: Target agent identifier.
            project: Tier 1 project data dict.
            user: Tier 1 user data dict.
            current_step: Current step number (0-4).
            current_module: Current module ID (A/B/C/D).
            step0_data: Tier 2 — Step 0 raw data.
            current_step_data: Tier 2 — Full data of current step.
            previous_modules: Tier 2 — Summaries of completed modules.
            all_steps_data: Tier 3 — Full data of all steps (narrative-builder only).
            feedback_history: Tier 3 — Prior feedback records (feedback-ia only).
            conversation_history: Tier 3 — Conversation window (openclaw-bridge only).

        Returns:
            Context dict with the appropriate tiers populated.
        """
        tiers = _AGENT_TIERS.get(agent_id, {"tier1": True, "tier2": False, "tier3": False})
        ctx: dict[str, Any] = {}

        # Tier 1: always included
        if tiers["tier1"]:
            ctx["project"] = project
            ctx["user"] = user
            ctx["currentStep"] = current_step
            ctx["currentModule"] = current_module

        # Tier 2: included per agent
        if tiers["tier2"]:
            if step0_data is not None:
                ctx["step0Data"] = step0_data
            if current_step_data is not None:
                ctx["currentStepData"] = current_step_data
            if previous_modules is not None:
                ctx["previousModules"] = previous_modules

        # Tier 3: only when necessary
        if tiers["tier3"]:
            if all_steps_data is not None:
                ctx["allStepsData"] = all_steps_data
            if feedback_history is not None:
                ctx["feedbackHistory"] = feedback_history
            if conversation_history is not None:
                ctx["conversationHistory"] = conversation_history

        return ctx
