"""Model selection y estimacion de costos.

Todos los agentes corren sobre OpenRouter -> qwen/qwen3.6-flash.
Pricing oficial OpenRouter (<=256K contexto):
  - Input:  $0.25 / 1M tokens
  - Output: $1.50 / 1M tokens
"""

MODEL_ID = "openrouter:qwen/qwen3.6-flash"

_INPUT_COST_PER_1K = 0.00025
_OUTPUT_COST_PER_1K = 0.0015


class ModelRouter:
    """Resuelve el modelo a usar y estima costos por invocacion."""

    def get_model(self, _agent_id: str) -> str:
        """Retorna el ID de modelo para el agente dado."""
        return MODEL_ID

    def estimate_cost_usd(
        self,
        _agent_id: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """Estima el costo en USD para la invocacion dada."""
        cost = (input_tokens / 1000 * _INPUT_COST_PER_1K) + (
            output_tokens / 1000 * _OUTPUT_COST_PER_1K
        )
        return round(cost, 6)
