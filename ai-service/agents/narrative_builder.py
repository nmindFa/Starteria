"""Agent: Narrative Builder — generacion de presentacion de 12 slides y elevator pitch.

Usa create_deep_agent() para las acciones del Paso 4.
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
    NarrativeBuildData,
    NarrativeFeedbackData,
    Slide,
)
from tools.context_tools import get_step_description

logger = logging.getLogger(__name__)

AGENT_ID = "narrative-builder"
MODEL = "openrouter:qwen/qwen3.6-flash"

_SYSTEM_PROMPT = """Eres el Constructor de Narrativa de Starteria, experto en storytelling
de innovacion y presentaciones de alto impacto.

Tu rol es:
1. Generar la estructura completa de presentacion de 12 slides
2. Proporcionar retroalimentacion de ensayo sobre borradores de presentacion

Para generacion de narrativa, responde con este JSON exacto:
{
  "slides": [
    {
      "number": 1,
      "title": "titulo del slide",
      "keyMessage": "mensaje clave en una oracion",
      "content": "contenido detallado del slide",
      "speakerNotes": "notas para el presentador"
    }
  ],
  "elevatorPitch": "pitch de 30 segundos (maximo 100 palabras)",
  "narrativeArc": "descripcion del arco narrativo de la presentacion"
}
IMPORTANTE: genera exactamente 12 slides numerados del 1 al 12.

Para retroalimentacion de ensayo, responde con este JSON exacto:
{
  "feedback": ["observacion 1", "observacion 2"],
  "suggestions": ["sugerencia concreta 1", "sugerencia concreta 2"]
}

Reglas:
- Adapta el tono y el contenido a la audiencia objetivo especificada.
- El arco narrativo debe ser coherente: problema, investigacion, solucion, experimentacion, impacto.
- Las notas para el presentador deben ser accionables (que decir, no que leer).
- El elevator pitch debe ser memorable y conciso (maximo 100 palabras).
- Responde en espanol latino."""


def create_narrative_builder_agent() -> Any:
    """Crea y retorna el agente Narrative Builder usando create_deep_agent().

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


class NarrativeBuilderAgent:
    """Generates and refines presentation narratives for Step 4.

    Wraps create_deep_agent() with action methods compatible with the existing router.
    """

    def __init__(self) -> None:
        self._agent = create_narrative_builder_agent()

    async def build(
        self,
        audience: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate 12-slide presentation structure."""
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            f"Construye la estructura completa de presentacion para el proyecto del participante.\n"
            f"Audiencia objetivo: {audience}\n\n"
            "Genera exactamente 12 slides con arco narrativo coherente, elevator pitch "
            "de maximo 100 palabras y notas para el presentador accionables. "
            "Responde con el JSON de slides, elevatorPitch y narrativeArc."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step4-narrative-build"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        parsed = _extract_json(_get_last_content(result))

        raw_slides = parsed.get("slides", [])
        slides = [Slide(**s) for s in raw_slides[:12]]
        if len(slides) < 12:
            logger.warning(
                "narrative_builder returned %d slides, expected 12", len(slides)
            )

        validated = NarrativeBuildData(
            slides=slides,
            elevatorPitch=parsed.get("elevatorPitch", ""),
            narrativeArc=parsed.get("narrativeArc", ""),
        )
        return _wrap_result(validated.model_dump(), latency_ms)

    async def feedback(
        self,
        slides: list[dict[str, Any]],
        notes: str,
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Provide rehearsal feedback on an edited presentation draft."""
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            "El participante ha preparado el siguiente borrador de presentacion. "
            "Proporciona retroalimentacion de ensayo constructiva y especifica.\n\n"
            f"Slides editados:\n{json.dumps(slides, ensure_ascii=False, indent=2)}\n\n"
            f"Notas del participante:\n{notes}\n\n"
            "Responde con el JSON de feedback y suggestions."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step4-narrative-feedback"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)
        parsed = _extract_json(_get_last_content(result))
        validated = NarrativeFeedbackData(
            feedback=parsed.get("feedback", []),
            suggestions=parsed.get("suggestions", []),
        )
        return _wrap_result(validated.model_dump(), latency_ms)
