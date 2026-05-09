"""Agent: Experiment Coach — sugerencias de prototipo y analisis Go/No-Go.

Usa create_deep_agent() para las acciones del Paso 3.
"""

from __future__ import annotations

import json
import logging
import re
import time
from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from langgraph.checkpoint.memory import MemorySaver

from schemas.responses import (
    ExperimentAnalyzeData,
    PrototypeSuggestData,
)
from tools.context_tools import get_step_description

logger = logging.getLogger(__name__)

AGENT_ID = "experiment-coach"
MODEL = "openrouter:qwen/qwen3.6-flash"

_SYSTEM_PROMPT = """Eres el Coach de Experimentacion de Starteria.

Tu funcion es:
1. Sugerir componentes de prototipo e instrumentacion a partir de un test card
2. Analizar resultados de experimento y emitir recomendacion Go/No-Go/Pivot fundamentada

Para sugerencia de prototipo, responde con este JSON exacto:
{
  "components": ["componente 1", "componente 2"],
  "instrumentation": ["instrumento de medicion 1", "instrumento 2"],
  "tips": ["consejo practico 1", "consejo 2"]
}

Para analisis de experimento, responde con este JSON exacto:
{
  "findings": ["hallazgo 1", "hallazgo 2"],
  "recommendation": "GO | NO_GO | PIVOT",
  "rationale": "justificacion de la recomendacion en 2-4 oraciones",
  "learningCard": {
    "keyLearning": "aprendizaje principal",
    "validatedAssumptions": ["supuesto validado"],
    "invalidatedAssumptions": ["supuesto invalidado"],
    "nextSteps": ["proximo paso"]
  }
}

Reglas:
- La recomendacion debe ser GO, NO_GO o PIVOT (exactamente estos valores).
- Sé riguroso con la evidencia y practico en tus recomendaciones.
- Para el prototipo: fidelidad apropiada para validar la hipotesis, no over-engineering.
- Responde en espanol latino."""


def create_experiment_coach_agent() -> Any:
    """Crea y retorna el agente Experiment Coach usando create_deep_agent().

    Returns:
        Instancia del agente deepagents lista para invocar.
    """
    return create_deep_agent(
        name=AGENT_ID,
        model=MODEL,
        tools=[get_step_description],
        system_prompt=_SYSTEM_PROMPT,
        backend=FilesystemBackend(
            root_dir=str(Path(__file__).parent.parent),
            virtual_mode=True,
        ),
        checkpointer=MemorySaver(),
    )


def _extract_json(content: str) -> dict[str, Any]:
    """Extrae el JSON de la respuesta del agente."""
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return {}


def _get_last_content(result: dict[str, Any]) -> str:
    """Extrae el contenido del ultimo mensaje de la respuesta del agente."""
    messages = result.get("messages", [])
    if messages:
        last_msg = messages[-1]
        return last_msg.content if hasattr(last_msg, "content") else str(last_msg)
    return ""


def _wrap_result(data: dict[str, Any], latency_ms: int) -> dict[str, Any]:
    return {
        "data": data,
        "agent": AGENT_ID,
        "model": MODEL,
        "input_tokens": 0,
        "output_tokens": 0,
        "latency_ms": latency_ms,
    }


class ExperimentCoachAgent:
    """Suggests prototype components and analyzes experiment results.

    Wraps create_deep_agent() with action methods compatible with the existing router.
    """

    def __init__(self) -> None:
        self._agent = create_experiment_coach_agent()

    async def prototype_suggest(
        self,
        test_card: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Suggest prototype components and instrumentation from a test card."""
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            "El participante tiene el siguiente test card. Sugiere componentes de prototipo, "
            "instrumentacion y consejos practicos para ejecutar el experimento.\n\n"
            f"Test card:\n{json.dumps(test_card, ensure_ascii=False, indent=2)}\n\n"
            "Responde con el JSON de components, instrumentation y tips."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step3-prototype"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        parsed = _extract_json(_get_last_content(result))
        validated = PrototypeSuggestData(
            components=parsed.get("components", []),
            instrumentation=parsed.get("instrumentation", []),
            tips=parsed.get("tips", []),
        )
        return _wrap_result(validated.model_dump(), latency_ms)

    async def experiment_analyze(
        self,
        run_id: str,
        metrics: dict[str, Any],
        evidence: list[str],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Analyze experiment results and emit Go/No-Go/Pivot recommendation."""
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            f"El participante ha ejecutado el experimento con ID: {run_id}\n\n"
            f"Metricas obtenidas:\n{json.dumps(metrics, ensure_ascii=False, indent=2)}\n\n"
            f"Evidencia recopilada:\n{json.dumps(evidence, ensure_ascii=False)}\n\n"
            "Analiza los resultados y emite una recomendacion fundamentada. "
            "Responde con el JSON de findings, recommendation (GO/NO_GO/PIVOT), rationale y learningCard."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step3-analyze-{run_id}"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        parsed = _extract_json(_get_last_content(result))

        raw_rec = parsed.get("recommendation", "PIVOT")
        if raw_rec not in ("GO", "NO_GO", "PIVOT"):
            raw_rec = "PIVOT"

        validated = ExperimentAnalyzeData(
            findings=parsed.get("findings", []),
            recommendation=raw_rec,
            rationale=parsed.get("rationale", ""),
            learningCard=parsed.get("learningCard", {}),
        )
        return _wrap_result(validated.model_dump(), latency_ms)
