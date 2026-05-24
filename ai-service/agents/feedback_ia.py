"""Agent: Feedback IA — evaluacion formativa de modulos (Aprobado/Iterar/Bloqueado).

Usa create_deep_agent() con skills de rubricas y herramienta get_step_rubric.
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

from schemas.responses import FeedbackData
from tools.context_tools import get_step_rubric

logger = logging.getLogger(__name__)

AGENT_ID = "feedback-ia"
MODEL = "openrouter:qwen/qwen3.6-flash"
SKILLS_DIR = str(Path(__file__).parent.parent / "skills" / "feedback-ia")

_SYSTEM_PROMPT = """Eres el agente de Evaluacion Formativa de Starteria.
Tu funcion es evaluar el trabajo de un participante en un modulo especifico
y emitir un veredicto: Aprobado, Iterar o Bloqueado.

Para cada evaluacion:
1. Usa la herramienta get_step_rubric para obtener los criterios del paso y modulo.
2. Evalua el trabajo contra los criterios de la rubrica.
3. Responde con un JSON que tiene esta estructura exacta:
   {
     "status": "Aprobado | Iterar | Bloqueado",
     "summary": "resumen de maximo 500 caracteres",
     "goodPoints": ["aspectos positivos"],
     "missing": ["aspectos faltantes o incompletos"],
     "actions": ["acciones concretas para mejorar"],
     "questions": ["preguntas orientadoras"],
     "contradictions": ["posibles contradicciones detectadas"]
   }

Reglas:
- Aprobado: cumple todos los criterios criticos del modulo.
- Iterar: tiene valor pero le faltan elementos importantes.
- Bloqueado: problemas fundamentales que impiden avanzar.
- Los arrays pueden estar vacios pero nunca null.
- El summary no debe exceder 500 caracteres.
- Sé formativo, especifico y orientado a la accion.
- Responde exclusivamente en espanol latino."""


def create_feedback_ia_agent() -> Any:
    """Crea y retorna el agente Feedback IA usando create_deep_agent().

    Returns:
        Instancia del agente deepagents lista para invocar.
    """
    return create_deep_agent(
        name=AGENT_ID,
        model=MODEL,
        tools=[get_step_rubric],
        system_prompt=_SYSTEM_PROMPT,
        backend=FilesystemBackend(
            root_dir=str(Path(__file__).parent.parent),
            virtual_mode=True,
        ),
        skills=[SKILLS_DIR],
        checkpointer=MemorySaver(),
    )


def _extract_feedback_json(content: str) -> dict[str, Any]:
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


class FeedbackIAAgent:
    """Evaluates a participant's module work and issues a formative verdict.

    Wraps create_deep_agent() with a run() method compatible with the existing router.
    """

    def __init__(self) -> None:
        self._agent = create_feedback_ia_agent()

    async def run(
        self,
        step_number: int,
        module_id: str,
        module_data: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """Invoke the Feedback IA agent.

        Args:
            step_number: Step number (1-4).
            module_id: Module identifier (A/B/C/D).
            module_data: Raw module data to evaluate.
            context: Assembled AgentContext.

        Returns:
            Dict matching FeedbackData schema plus usage metadata.
        """
        start = time.monotonic()
        project_id: str = context.get("project", {}).get("id", "unknown")

        user_message = (
            f"Evalua el trabajo del participante en el Modulo {module_id} del Paso {step_number}.\n\n"
            f"Datos del modulo:\n{json.dumps(module_data, ensure_ascii=False, indent=2)}\n\n"
            f"Primero usa get_step_rubric con step_number={step_number} y module_id='{module_id}' "
            f"para obtener los criterios de evaluacion. Luego evalua y responde con el JSON."
        )

        config = {"configurable": {"thread_id": f"{project_id}-step{step_number}-{module_id}"}}
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

        parsed = _extract_feedback_json(raw_content)

        raw_status = parsed.get("status", "Iterar")
        if raw_status not in ("Aprobado", "Iterar", "Bloqueado"):
            raw_status = "Iterar"

        validated = FeedbackData(
            status=raw_status,
            summary=str(parsed.get("summary", ""))[:500],
            goodPoints=parsed.get("goodPoints", []),
            missing=parsed.get("missing", []),
            actions=parsed.get("actions", []),
            questions=parsed.get("questions", []),
            contradictions=parsed.get("contradictions", []),
        )

        logger.info(
            "feedback_ia_agent completed step=%d module=%s status=%s latency_ms=%d",
            step_number,
            module_id,
            validated.status,
            latency_ms,
        )

        return {
            "data": validated.model_dump(),
            "agent": AGENT_ID,
            "model": MODEL,
            "input_tokens": 0,
            "output_tokens": 0,
            "latency_ms": latency_ms,
        }
