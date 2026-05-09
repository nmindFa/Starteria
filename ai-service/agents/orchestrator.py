"""Agent 1: Orchestrator — enruta solicitudes a agentes trabajadores con create_deep_agent().

Routing logic:
  step=0                         -> mentor-virtual
  action=feedback (any step)     -> feedback-ia
  step=1, module=B               -> research-assistant
  step=2, action=hmw-generate    -> solution-design
  step=2, action=ideate          -> solution-design
  step=2, action=experiment-routes -> solution-design
  step=3, action=prototype-suggest -> experiment-coach
  step=3, action=experiment-analyze -> experiment-coach
  step=4                         -> narrative-builder
  agentHint overrides step/module logic when set
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from deepagents.backends import FilesystemBackend
from langgraph.checkpoint.memory import MemorySaver
from langgraph.store.memory import InMemoryStore

from agents.experiment_coach import create_experiment_coach_agent
from agents.feedback_ia import create_feedback_ia_agent
from agents.mentor_virtual import create_mentor_virtual_agent
from agents.narrative_builder import create_narrative_builder_agent
from agents.research_assistant import create_research_assistant_agent
from agents.solution_design import create_solution_design_agent
from schemas.requests import InvokeRequest
from schemas.responses import InvokeResponse
from services.context_assembler import ContextAssembler
from services.cost_tracker import CostLimitExceededError, CostTracker
from tools.context_tools import get_agent_routing_hint, get_step_description

logger = logging.getLogger(__name__)

AGENT_ID = "orchestrator"
MODEL = "openrouter:qwen/qwen3.6-flash"
SKILLS_DIR = str(Path(__file__).parent.parent / "skills")

_SYSTEM_PROMPT = """Eres el Orquestador del sistema multi-agente de Starteria.

Recibes solicitudes del backend y las enrutas al agente especializado correcto
usando el tool `task` para delegar al subagente:

- step=0: delegar a mentor-virtual
- action=feedback: delegar a feedback-ia
- step=1 y module=B: delegar a research-assistant
- step=2 con action=hmw-generate, ideate o experiment-routes: delegar a solution-design
- step=3 con action=prototype-suggest o experiment-analyze: delegar a experiment-coach
- step=4: delegar a narrative-builder

Usa get_agent_routing_hint para confirmar el agente correcto si no estas seguro.

Retorna SIEMPRE la respuesta del subagente sin modificarla.
Sé directo y eficiente. Responde en espanol."""


_context_assembler = ContextAssembler()
_cost_tracker = CostTracker()

# Shared InMemoryStore for cross-thread memory
_shared_store = InMemoryStore()


_SUBAGENT_DESCRIPTIONS: dict[str, str] = {
    "mentor-virtual": (
        "Coaching formativo del Step 0: revisa la descripcion inicial del problema "
        "y devuelve feedback estructurado (claro, faltaPrecisar, preguntas, siguienteAccion)."
    ),
    "feedback-ia": (
        "Evaluacion formativa por modulo con rubrica: emite veredicto Aprobado/Iterar/Bloqueado "
        "con justificacion."
    ),
    "research-assistant": (
        "Genera plan de investigacion cualitativa (objetivo, temas, perfiles, guia de preguntas) "
        "a partir del analisis AS-IS del Modulo A en Step 1."
    ),
    "solution-design": (
        "Diseno de soluciones del Step 2: genera HMWs, ideacion divergente y rutas de experimento."
    ),
    "experiment-coach": (
        "Coach del Step 3: sugiere prototipos y analiza resultados Go/No-Go de experimentos."
    ),
    "narrative-builder": (
        "Constructor de narrativa del Step 4: storytelling de innovacion y presentaciones de impacto."
    ),
}


def _build_orchestrator() -> Any:
    """Construye el agente orquestador con todos los subagentes."""
    subagent_factories = [
        ("mentor-virtual", create_mentor_virtual_agent),
        ("feedback-ia", create_feedback_ia_agent),
        ("research-assistant", create_research_assistant_agent),
        ("solution-design", create_solution_design_agent),
        ("experiment-coach", create_experiment_coach_agent),
        ("narrative-builder", create_narrative_builder_agent),
    ]

    subagents = [
        {
            "name": name,
            "description": _SUBAGENT_DESCRIPTIONS[name],
            "runnable": factory(),
        }
        for name, factory in subagent_factories
    ]

    return create_deep_agent(
        name=AGENT_ID,
        model=MODEL,
        tools=[get_agent_routing_hint, get_step_description],
        system_prompt=_SYSTEM_PROMPT,
        subagents=subagents,
        backend=FilesystemBackend(
            root_dir=str(Path(__file__).parent.parent),
            virtual_mode=True,
        ),
        skills=[SKILLS_DIR],
        checkpointer=MemorySaver(),
        store=_shared_store,
    )


# Singleton — initialized once per process
_orchestrator_instance: Any = None


def get_orchestrator() -> Any:
    """Retorna la instancia singleton del orquestador, creandola si es necesario."""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = _build_orchestrator()
    return _orchestrator_instance


class OrchestratorAgent:
    """Public facade that runs the deepagents orchestration pipeline.

    Maintains backward compatibility with the existing router interface.
    """

    def __init__(self) -> None:
        self._orchestrator = get_orchestrator()

    async def invoke(self, request: InvokeRequest) -> InvokeResponse:
        """Process an InvokeRequest through the deepagents orchestration pipeline.

        Args:
            request: Validated InvokeRequest from the router.

        Returns:
            InvokeResponse with data, agent, model, tokensUsed, latencyMs.

        Raises:
            CostLimitExceededError: If cost ceilings are exceeded.
        """
        start = time.monotonic()
        project_id: str = request.payload.get("projectId", "unknown")  # type: ignore[union-attr]

        # Pre-flight cost checks
        _cost_tracker.check_project_daily_budget(project_id)
        _cost_tracker.check_request_cost(agent_id=request.agentHint or "feedback-ia")

        user_content = json.dumps(
            {
                "step": request.step,
                "module": request.module,
                "action": request.action,
                "agentHint": request.agentHint,
                "payload": request.payload,
            },
            ensure_ascii=False,
        )

        config = {"configurable": {"thread_id": project_id}}

        result = self._orchestrator.invoke(
            {"messages": [{"role": "user", "content": user_content}]},
            config=config,
        )

        total_ms = int((time.monotonic() - start) * 1000)

        # Extract last AI message from result
        messages = result.get("messages", [])
        raw_content = ""
        if messages:
            last_msg = messages[-1]
            raw_content = (
                last_msg.content
                if hasattr(last_msg, "content")
                else str(last_msg)
            )

        # Try to parse the response as JSON data
        try:
            data = json.loads(raw_content)
        except (json.JSONDecodeError, TypeError):
            data = {"response": raw_content}

        # Record usage (deepagents does not expose token counts directly)
        _cost_tracker.record_usage(
            project_id=project_id,
            agent_id=AGENT_ID,
            input_tokens=0,
            output_tokens=0,
        )

        return InvokeResponse(
            data=data,
            agent=AGENT_ID,
            model=MODEL,
            tokensUsed=0,
            latencyMs=total_ms,
        )
