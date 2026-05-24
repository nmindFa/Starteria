"""Unit tests for services.cost_tracker.CostTracker.

Covers:
- check_request_cost() raises CostLimitExceededError when estimate exceeds ceiling.
- check_project_daily_budget() raises when accumulated >= ceiling.
- record_usage() returns cost and accumulates per project + day.
- CostLimitExceededError exposes `.message`.
"""

from __future__ import annotations

import pytest

from services.cost_tracker import (
    CostLimitExceededError,
    CostTracker,
    _daily_cost,
)


@pytest.fixture(autouse=True)
def _reset_daily_cost() -> None:
    """Wipe the in-memory daily-cost store before every test in this module."""
    _daily_cost.clear()
    yield
    _daily_cost.clear()


@pytest.mark.unit
class TestCostLimitExceededError:
    def test_message_attribute_is_set(self) -> None:
        err = CostLimitExceededError("over budget")
        assert err.message == "over budget"
        assert str(err) == "over budget"

    def test_is_exception_subclass(self) -> None:
        assert issubclass(CostLimitExceededError, Exception)


@pytest.mark.unit
class TestCheckRequestCost:
    def test_passes_under_ceiling(self) -> None:
        tracker = CostTracker()
        # Default ceiling is $0.05; default tokens (2000 in / 1000 out) cost
        # 2 * 0.00025 + 1 * 0.0015 = 0.002 -> well under ceiling.
        tracker.check_request_cost(agent_id="feedback-ia")  # should not raise

    def test_raises_when_estimate_exceeds_ceiling(self, monkeypatch) -> None:
        # Force a tiny ceiling so any non-zero estimate trips the guard.
        from services import cost_tracker as ct_mod

        monkeypatch.setattr(ct_mod.settings, "max_cost_per_request_usd", 0.0)

        tracker = CostTracker()
        with pytest.raises(CostLimitExceededError) as exc_info:
            tracker.check_request_cost(
                agent_id="x",
                estimated_input_tokens=1000,
                estimated_output_tokens=1000,
            )
        assert "exceeds ceiling" in exc_info.value.message

    def test_uses_custom_token_estimates(self, monkeypatch) -> None:
        # Set ceiling slightly below cost of 1K/1K (0.00175) to assert the
        # custom estimates are actually consumed.
        from services import cost_tracker as ct_mod

        monkeypatch.setattr(ct_mod.settings, "max_cost_per_request_usd", 0.001)

        tracker = CostTracker()
        # Tiny request — should pass even under the lowered ceiling.
        tracker.check_request_cost(agent_id="x", estimated_input_tokens=10, estimated_output_tokens=10)

        # Large request — should fail.
        with pytest.raises(CostLimitExceededError):
            tracker.check_request_cost(
                agent_id="x", estimated_input_tokens=1000, estimated_output_tokens=1000
            )


@pytest.mark.unit
class TestCheckProjectDailyBudget:
    def test_passes_when_no_usage(self) -> None:
        tracker = CostTracker()
        tracker.check_project_daily_budget("proj-fresh")  # should not raise

    def test_raises_when_accumulated_meets_ceiling(self, monkeypatch) -> None:
        from services import cost_tracker as ct_mod

        # Tighten the per-project daily ceiling.
        monkeypatch.setattr(ct_mod.settings, "max_cost_per_project_day_usd", 0.001)

        tracker = CostTracker()
        # Push usage above the lowered ceiling.
        tracker.record_usage(
            project_id="proj-1", agent_id="x", input_tokens=1000, output_tokens=1000
        )

        with pytest.raises(CostLimitExceededError) as exc_info:
            tracker.check_project_daily_budget("proj-1")
        assert "proj-1" in exc_info.value.message
        assert "ceiling" in exc_info.value.message


@pytest.mark.unit
class TestRecordUsage:
    def test_returns_estimated_cost(self) -> None:
        tracker = CostTracker()
        cost = tracker.record_usage(
            project_id="proj-A", agent_id="x", input_tokens=1000, output_tokens=1000
        )
        assert cost == pytest.approx(0.00175)

    def test_accumulates_across_calls(self, freeze_time) -> None:
        tracker = CostTracker()
        with freeze_time("2026-05-08T12:00:00Z"):
            tracker.record_usage("proj-B", "x", 1000, 0)  # 0.00025
            tracker.record_usage("proj-B", "x", 0, 1000)  # 0.0015
        from datetime import date

        today = str(date(2026, 5, 8))
        assert _daily_cost["proj-B"][today] == pytest.approx(0.00175)

    def test_separates_projects(self) -> None:
        tracker = CostTracker()
        tracker.record_usage("proj-X", "x", 1000, 1000)
        tracker.record_usage("proj-Y", "x", 1000, 1000)

        # Each project should accumulate independently.
        from datetime import date

        today = str(date.today())
        assert _daily_cost["proj-X"][today] == pytest.approx(0.00175)
        assert _daily_cost["proj-Y"][today] == pytest.approx(0.00175)

    def test_zero_tokens_records_zero_cost(self) -> None:
        tracker = CostTracker()
        cost = tracker.record_usage("proj-zero", "x", 0, 0)
        assert cost == 0.0
