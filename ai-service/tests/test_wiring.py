"""Smoke test for OpenRouter + LangSmith migration.

Run with:
    OPENROUTER_API_KEY=test uv run python tests/test_wiring.py
"""

import os
import sys
from pathlib import Path

# Ensure dummy key before importing config (it is a required Settings field).
os.environ.setdefault("OPENROUTER_API_KEY", "test")

# Add ai-service root (parent of tests/) to sys.path so flat-layout imports work.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def main() -> None:
    # 1. config.settings exposes the four migration fields.
    from config import settings, Settings

    for attr in (
        "openrouter_api_key",
        "langsmith_api_key",
        "langsmith_project",
        "langsmith_tracing",
    ):
        assert hasattr(settings, attr), f"Settings missing attribute: {attr}"
        assert hasattr(Settings, "model_fields") and attr in Settings.model_fields, (
            f"Settings.model_fields missing: {attr}"
        )

    # 2. All seven agents export MODEL = "openrouter:qwen/qwen3.6-flash".
    expected_model = "openrouter:qwen/qwen3.6-flash"
    agent_modules = [
        "agents.orchestrator",
        "agents.mentor_virtual",
        "agents.research_assistant",
        "agents.feedback_ia",
        "agents.experiment_coach",
        "agents.solution_design",
        "agents.narrative_builder",
    ]
    for mod_name in agent_modules:
        mod = __import__(mod_name, fromlist=["MODEL"])
        assert mod.MODEL == expected_model, (
            f"{mod_name}.MODEL = {mod.MODEL!r}, expected {expected_model!r}"
        )

    # 3. ModelRouter.get_model returns the single tier for any agent id.
    from services.model_router import ModelRouter

    router = ModelRouter()
    assert router.get_model("anything") == expected_model, (
        f"ModelRouter.get_model returned {router.get_model('anything')!r}"
    )

    # 4. Cost estimate matches qwen-flash pricing (input 0.00025/1K, output 0.0015/1K).
    expected_cost = round(0.00025 + 0.0015, 6)
    actual_cost = router.estimate_cost_usd("x", 1000, 1000)
    assert actual_cost == expected_cost, (
        f"estimate_cost_usd(x, 1000, 1000) = {actual_cost}, expected {expected_cost}"
    )

    # 5. langsmith importable.
    import langsmith  # noqa: F401

    # 6. langchain_openrouter importable.
    import langchain_openrouter  # noqa: F401

    # 7. Orchestrator builds with subagents wrapped as CompiledSubAgent dicts.
    from agents.orchestrator import _build_orchestrator

    orchestrator_graph = _build_orchestrator()
    assert orchestrator_graph is not None, "orchestrator graph failed to build"
    assert type(orchestrator_graph).__name__ == "CompiledStateGraph", (
        f"expected CompiledStateGraph, got {type(orchestrator_graph).__name__}"
    )

    print("OK")


if __name__ == "__main__":
    main()
