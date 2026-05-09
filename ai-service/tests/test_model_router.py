"""Unit tests for services.model_router.ModelRouter.

Pure deterministic logic — no LLM calls, no I/O.
Covers: get_model() and estimate_cost_usd() with rounding/edge cases.
"""

from __future__ import annotations

import pytest

from services.model_router import (
    MODEL_ID,
    ModelRouter,
    _INPUT_COST_PER_1K,
    _OUTPUT_COST_PER_1K,
)


@pytest.mark.unit
class TestModelRouterGetModel:
    def test_returns_qwen_flash_constant(self) -> None:
        router = ModelRouter()
        assert router.get_model("any-agent") == MODEL_ID
        assert MODEL_ID == "openrouter:qwen/qwen3.6-flash"

    def test_returns_same_model_for_every_agent(self) -> None:
        router = ModelRouter()
        # Single-tier router — agent ID does not change the model.
        assert router.get_model("orchestrator") == router.get_model("feedback-ia")
        assert router.get_model("mentor-virtual") == router.get_model("narrative-builder")


@pytest.mark.unit
class TestModelRouterEstimateCost:
    def test_zero_tokens_yields_zero_cost(self) -> None:
        router = ModelRouter()
        assert router.estimate_cost_usd("x", 0, 0) == 0.0

    def test_one_thousand_in_one_thousand_out(self) -> None:
        router = ModelRouter()
        # 1K input @ 0.00025 + 1K output @ 0.0015 = 0.001750
        assert router.estimate_cost_usd("x", 1000, 1000) == pytest.approx(0.001750)

    def test_input_only(self) -> None:
        router = ModelRouter()
        # 4K input only -> 4 * 0.00025 = 0.001000
        assert router.estimate_cost_usd("x", 4000, 0) == pytest.approx(0.001000)

    def test_output_only(self) -> None:
        router = ModelRouter()
        # 2K output only -> 2 * 0.0015 = 0.003000
        assert router.estimate_cost_usd("x", 0, 2000) == pytest.approx(0.003000)

    def test_result_is_rounded_to_six_decimals(self) -> None:
        router = ModelRouter()
        cost = router.estimate_cost_usd("x", 1, 1)
        # Value should be a float rounded to 6 decimals at most.
        assert isinstance(cost, float)
        as_str = f"{cost:.10f}".rstrip("0").rstrip(".")
        decimals = as_str.split(".")[-1] if "." in as_str else ""
        assert len(decimals) <= 6

    def test_constants_match_openrouter_pricing(self) -> None:
        # Pricing is documented in services/model_router.py:
        # Input  $0.25 / 1M tokens -> 0.00025 per 1K
        # Output $1.50 / 1M tokens -> 0.0015 per 1K
        assert _INPUT_COST_PER_1K == 0.00025
        assert _OUTPUT_COST_PER_1K == 0.0015

    def test_large_volume_does_not_overflow(self) -> None:
        router = ModelRouter()
        cost = router.estimate_cost_usd("x", 1_000_000, 1_000_000)
        # 1M input + 1M output = 0.25 + 1.50 = 1.75
        assert cost == pytest.approx(1.75)
