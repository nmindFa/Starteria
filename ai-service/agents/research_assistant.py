"""Agent: Research Assistant — genera plan de investigacion desde el analisis AS-IS.

Usa create_deep_agent() con skills de metodologia de investigacion cualitativa.
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

from schemas.responses import ResearchAssistData, ResearchProfile, ResearchTopic
from tools.context_tools import get_step_description

logger = logging.getLogger(__name__)

AGENT_ID = "research-assistant"
MODEL = "openrouter:qwen/qwen3.6-flash"
SKILLS_DIR = str(Path(__file__).parent.parent / "skills" / "research-assistant")

_SYSTEM_PROMPT = """Eres el Asistente de Investigacion de Starteria, experto en metodologia
de investigacion cualitativa centrada en el usuario.

A partir del analisis AS-IS del participante, defines un plan de investigacion solido.

Responde SIEMPRE con un JSON con esta estructura exacta:
{
  "objetivo": "objetivo de investigacion en una oracion",
  "temas": [
    {"tema": "nombre del tema", "justificacion": "por que es relevante"}
  ],
  "perfiles": [
    {"perfil": "descripcion del perfil", "razon": "por que entrevistarlo"}
  ],
  "guiaPreguntas": ["pregunta 1", "pregunta 2", "pregunta 3", "pregunta 4", "pregunta 5"]
}

Requisitos minimos:
- Al menos 3 temas con justificacion
- Al menos 2 perfiles con razon de seleccion
- Al menos 5 preguntas abiertas (no de si/no)

Reglas:
- El objetivo deriva directamente del quiebre y consecuencia del AS-IS.
- Los temas cubren comportamiento del usuario, no solo el proceso.
- Los perfiles incluyen a los mas afectados y al menos una perspectiva externa.
- Las preguntas son exploratorias, no confirmatorias.
- Sé sistematico, practico y orientado a la accion.
- Responde en espanol latino."""


def create_research_assistant_agent() -> Any:
    """Crea y retorna el agente Research Assistant usando create_deep_agent().

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
        skills=[SKILLS_DIR],
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


class ResearchAssistantAgent:
    """Generates a research plan (objective, topics, profiles, guide) from AS-IS data.

    Wraps create_deep_agent() with a run() method compatible with the existing router.
    """

    def __init__(self) -> None:
        self._agent = create_research_assistant_agent()

    async def run(
        self,
        module_a_data: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke the Research Assistant agent.

        Args:
            module_a_data: AS-IS module data (casoReal, pasos, quiebre, etc.).
            context: Assembled AgentContext.

        Returns:
            Dict matching ResearchAssistData schema plus usage metadata.
        """
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            "A partir del siguiente analisis AS-IS del participante, genera un plan de "
            "investigacion cualitativa centrada en el usuario.\n\n"
            f"Datos del Modulo A (AS-IS):\n"
            f"- Caso real: {module_a_data.get('casoReal', '')}\n"
            f"- Pasos del proceso: {module_a_data.get('pasos', '')}\n"
            f"- Punto de quiebre: {module_a_data.get('quiebre', '')}\n"
            f"- Consecuencia: {module_a_data.get('consecuencia', '')}\n"
            f"- Causa inmediata: {module_a_data.get('causaInmediata', '')}\n"
            f"- Alcance: {module_a_data.get('alcance', '')}\n\n"
            "Incluye al menos 3 temas, 2 perfiles y 5 preguntas. Responde con el JSON estructurado."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step1-research"}}
        result = self._agent.invoke(
            {"messages": [{"role": "user", "content": user_message}]},
            config=config,
        )

        latency_ms = int((time.monotonic() - start) * 1000)

        messages = result.get("messages", [])
        raw_content = ""
        if messages:
            last_msg = messages[-1]
            raw_content = (
                last_msg.content
                if hasattr(last_msg, "content")
                else str(last_msg)
            )

        parsed = _extract_json(raw_content)

        validated = ResearchAssistData(
            objetivo=parsed.get("objetivo", ""),
            temas=[ResearchTopic(**t) for t in parsed.get("temas", [])],
            perfiles=[ResearchProfile(**p) for p in parsed.get("perfiles", [])],
            guiaPreguntas=parsed.get("guiaPreguntas", []),
        )

        logger.info(
            "research_assistant_agent completed latency_ms=%d project=%s",
            latency_ms,
            project_id,
        )

        return {
            "data": validated.model_dump(),
            "agent": AGENT_ID,
            "model": MODEL,
            "input_tokens": 0,
            "output_tokens": 0,
            "latency_ms": latency_ms,
        }
