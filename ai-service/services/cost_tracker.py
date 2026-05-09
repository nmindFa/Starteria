"""Cost ceiling enforcement per request and per project/day.

Tracks accumulated cost in-memory (keyed by project_id + date).
In production this should be backed by Redis or the backend database.
"""

import logging
from collections import defaultdict
from datetime import date

from config import settings
from services.model_router import ModelRouter

logger = logging.getLogger(__name__)

_model_router = ModelRouter()

# In-memory store: project_id -> date string -> accumulated cost USD
_daily_cost: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))


class CostLimitExceededError(Exception):
    """Raised when a cost ceiling would be exceeded."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class CostTracker:
    """Tracks and enforces cost ceilings."""

    def check_request_cost(
        self,
        agent_id: str,
        estimated_input_tokens: int = 2000,
        estimated_output_tokens: int = 1000,
    ) -> None:
        """Raise CostLimitExceededError if estimated request cost exceeds ceiling.

        Args:
            agent_id: Agent being invoked.
            estimated_input_tokens: Conservative input token estimate.
            estimated_output_tokens: Conservative output token estimate.
        """
        estimated = _model_router.estimate_cost_usd(
            agent_id, estimated_input_tokens, estimated_output_tokens
        )
        ceiling = settings.max_cost_per_request_usd
        if estimated > ceiling:
            raise CostLimitExceededError(
                f"Estimated request cost ${estimated:.4f} exceeds ceiling ${ceiling}"
            )

    def check_project_daily_budget(self, project_id: str) -> None:
        """Raise CostLimitExceededError if project daily budget is exhausted.

        Args:
            project_id: Project being charged.
        """
        today = str(date.today())
        accumulated = _daily_cost[project_id][today]
        ceiling = settings.max_cost_per_project_day_usd
        if accumulated >= ceiling:
            raise CostLimitExceededError(
                f"Project {project_id} daily cost ${accumulated:.4f} "
                f"has reached ceiling ${ceiling}"
            )

    def record_usage(
        self,
        project_id: str,
        agent_id: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """Record actual usage and return cost in USD.

        Args:
            project_id: Project being charged.
            agent_id: Agent that was invoked.
            input_tokens: Actual input tokens used.
            output_tokens: Actual output tokens used.

        Returns:
            Cost in USD for this invocation.
        """
        cost = _model_router.estimate_cost_usd(agent_id, input_tokens, output_tokens)
        today = str(date.today())
        _daily_cost[project_id][today] += cost
        logger.info(
            "cost_recorded project=%s agent=%s cost_usd=%.6f daily_total=%.6f",
            project_id,
            agent_id,
            cost,
            _daily_cost[project_id][today],
        )
        return cost
