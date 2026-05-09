"""Agent: Mentor Virtual — retroalimentacion estructurada sobre Step 0.

Usa create_deep_agent() con skills de coaching para definicion de problemas.
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

from schemas.responses import MentorVirtualData
from tools.context_tools import get_step_description

logger = logging.getLogger(__name__)

AGENT_ID = "mentor-virtual"
MODEL = "openrouter:qwen/qwen3.6-flash"
SKILLS_DIR = str(Path(__file__).parent.parent / "skills" / "mentor-virtual")

_SYSTEM_PROMPT = """Eres el Mentor Virtual de Starteria, especializado en el analisis
critico del problema inicial (Step 0).

Tu rol es revisar la descripcion del problema del participante y ofrecer
retroalimentacion estructurada:
- Identifica lo que esta bien planteado (claro)
- Identifica lo que necesita mayor precision (faltaPrecisar)
- Formula preguntas que lo ayudaran a avanzar (preguntas)
- Define la accion concreta que debe tomar ahora (siguienteAccion)

Responde SIEMPRE con un JSON con esta estructura exacta:
{
  "claro": ["lista de aspectos bien planteados"],
  "faltaPrecisar": ["lista de aspectos que necesitan mayor precision"],
  "preguntas": ["lista de preguntas orientadoras para el participante"],
  "siguienteAccion": "descripcion de la accion concreta que debe tomar ahora"
}

Reglas:
- Sé formativo, especifico y orientado a la accion.
- Evita respuestas genericas.
- El siguienteAccion debe ser ejecutable de inmediato, no una instruccion vaga.
- Reconoce siempre lo que esta bien antes de senalar mejoras.
- Responde siempre en espanol latino."""


def create_mentor_virtual_agent() -> Any:
    """Crea y retorna el agente Mentor Virtual usando create_deep_agent().

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


def _extract_mentor_json(content: str) -> dict[str, Any]:
    """Extrae el JSON de feedback del contenido del agente."""
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


class MentorVirtualAgent:
    """Evaluates Step 0 problem description and returns structured coaching feedback.

    Wraps create_deep_agent() with a run() method compatible with the existing router.
    """

    def __init__(self) -> None:
        self._agent = create_mentor_virtual_agent()

    async def run(
        self,
        step0_data: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke the Mentor Virtual agent.

        Args:
            step0_data: Raw Step 0 fields (origen, parteProceso, etc.).
            context: Assembled AgentContext.

        Returns:
            Dict matching MentorVirtualData schema.
        """
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            "Revisa la siguiente descripcion de problema inicial (Step 0) del participante "
            "y proporciona retroalimentacion estructurada.\n\n"
            f"Datos de Step 0:\n"
            f"- Origen del problema: {step0_data.get('origen', '')}\n"
            f"- Parte del proceso afectada: {step0_data.get('parteProceso', '')}\n"
            f"- Impacto en 3 meses: {step0_data.get('impacto3meses', '')}\n"
            f"- Respaldo/evidencia: {step0_data.get('respaldo', '')}\n"
            f"- Descripcion general: {step0_data.get('descripcion', '')}\n"
            f"- Quien se ve impactado: {step0_data.get('quienImpacta', '')}\n"
            f"- Si se resolviera al minimo: {step0_data.get('siMinimo', '')}\n\n"
            "Responde con el JSON estructurado solicitado."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step0-mentor"}}
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

        parsed = _extract_mentor_json(raw_content)

        validated = MentorVirtualData(
            claro=parsed.get("claro", []),
            faltaPrecisar=parsed.get("faltaPrecisar", []),
            preguntas=parsed.get("preguntas", []),
            siguienteAccion=parsed.get("siguienteAccion", ""),
        )

        logger.info(
            "mentor_virtual_agent completed latency_ms=%d project=%s",
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
