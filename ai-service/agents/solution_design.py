"""Agent: Solution Design — generacion HMW, ideacion y rutas de experimento.

Usa create_deep_agent() para las tres acciones del Paso 2.
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
    ExperimentRoute,
    ExperimentRoutesData,
    HMWGenerateData,
    HMWOption,
    Idea,
    IdeateData,
)
from tools.context_tools import get_step_description

logger = logging.getLogger(__name__)

AGENT_ID = "solution-design"
MODEL = "openrouter:qwen/qwen3.6-flash"

_SYSTEM_PROMPT = """Eres el agente de Diseno de Soluciones de Starteria.

Tu rol es guiar al participante en:
1. Generacion de preguntas HMW (Como Podriamos) — a partir de datos de sintesis
2. Ideacion estructurada — a partir de un HMW seleccionado
3. Diseno de rutas de experimento — a partir de una idea finalista con puntajes DVF

Segun la tarea que se te asigne, responde con el JSON correspondiente:

Para HMW:
{
  "options": [
    {"hmw": "Como podriamos...", "rationale": "por que esta reformulacion es valiosa"}
  ]
}
Genera al menos 3 opciones HMW distintas.

Para Ideacion:
{
  "ideas": [
    {
      "id": "idea-001",
      "title": "titulo corto",
      "description": "descripcion de 2-3 oraciones",
      "cluster": "nombre del cluster tematico"
    }
  ]
}
Genera al menos 5 ideas agrupadas en al menos 2 clusters.

Para Rutas de Experimento:
{
  "routes": [
    {
      "hypothesis": "hipotesis a validar",
      "experiment": "descripcion del experimento a realizar",
      "metric": "metrica que define el exito"
    }
  ]
}
Genera al menos 2 rutas de experimento.

Reglas:
- Genera opciones variadas, creativas y viables.
- Las ideas deben ser diversas, no variaciones de la misma idea.
- Responde en espanol latino."""


def create_solution_design_agent() -> Any:
    """Crea y retorna el agente Solution Design usando create_deep_agent().

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


class SolutionDesignAgent:
    """Handles HMW generation, idea generation, and experiment route design.

    Wraps create_deep_agent() with action methods compatible with the existing router.
    """

    def __init__(self) -> None:
        self._agent = create_solution_design_agent()

    async def generate_hmw(
        self,
        synthesis_data: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate HMW options from synthesis data."""
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            "A partir de los siguientes datos de sintesis del participante, genera preguntas HMW "
            "(Como Podriamos) variadas y accionables.\n\n"
            f"Datos de sintesis:\n{json.dumps(synthesis_data, ensure_ascii=False, indent=2)}\n\n"
            "Genera al menos 3 opciones HMW distintas. Responde con el JSON de options."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step2-hmw"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        parsed = _extract_json(_get_last_content(result))
        validated = HMWGenerateData(
            options=[HMWOption(**o) for o in parsed.get("options", [])]
        )
        return _wrap_result(validated.model_dump(), latency_ms)

    async def ideate(
        self,
        hmw: str,
        context_data: dict[str, Any],
        agent_context: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate and cluster ideas for a selected HMW."""
        start = time.monotonic()
        project_id: str = agent_context.get("project", {}).get("id", "unknown")

        user_message = (
            f'El participante ha seleccionado el siguiente reto HMW:\n"{hmw}"\n\n'
            f"Contexto del proyecto:\n{json.dumps(context_data, ensure_ascii=False, indent=2)}\n\n"
            "Genera ideas creativas y diversas para resolver este reto. Agrupa las ideas en clusters "
            "tematicos. Genera al menos 5 ideas en al menos 2 clusters. Responde con el JSON de ideas."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step2-ideate"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        parsed = _extract_json(_get_last_content(result))
        validated = IdeateData(
            ideas=[Idea(**i) for i in parsed.get("ideas", [])]
        )
        return _wrap_result(validated.model_dump(), latency_ms)

    async def experiment_routes(
        self,
        selected_idea: dict[str, Any],
        dvf_scores: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate experiment routes for a selected idea."""
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            f"El participante ha seleccionado la siguiente idea finalista:\n"
            f"- ID: {selected_idea.get('id', '')}\n"
            f"- Titulo: {selected_idea.get('title', '')}\n"
            f"- Descripcion: {selected_idea.get('description', '')}\n\n"
            f"Puntuaciones DVF:\n{json.dumps(dvf_scores, ensure_ascii=False, indent=2)}\n\n"
            "Genera rutas de experimento (hipotesis, experimento, metrica) para validar esta idea. "
            "Genera al menos 2 rutas. Responde con el JSON de routes."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step2-routes"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        parsed = _extract_json(_get_last_content(result))
        validated = ExperimentRoutesData(
            routes=[ExperimentRoute(**r) for r in parsed.get("routes", [])]
        )
        return _wrap_result(validated.model_dump(), latency_ms)
