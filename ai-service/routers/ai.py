"""FastAPI router for all SPEC-001 AI endpoints.

All endpoints are internal (no auth — Express handles JWT before proxying).
"""

import logging
import os
import secrets

from fastapi import APIRouter, Header, HTTPException, status

from agents.experiment_coach import ExperimentCoachAgent
from agents.feedback_ia import FeedbackIAAgent
from agents.mentor_virtual import MentorVirtualAgent
from agents.narrative_builder import NarrativeBuilderAgent
from agents.orchestrator import OrchestratorAgent
from agents.pdf_extractor import PdfExtractorAgent, get_run_registry
from agents.research_assistant import ResearchAssistantAgent
from agents.solution_design import SolutionDesignAgent
from schemas.pdf_extraction import (
    PdfExtractAck,
    PdfExtractRequest,
    PdfExtractRunState,
)
from schemas.requests import (
    ExperimentAnalyzeRequest,
    ExperimentRoutesRequest,
    FeedbackRequest,
    HMWGenerateRequest,
    IdeateRequest,
    InvokeRequest,
    MentorVirtualRequest,
    NarrativeBuildRequest,
    NarrativeFeedbackRequest,
    PrototypeSuggestRequest,
    ResearchAssistRequest,
)
from schemas.responses import (
    ErrorResponse,
    ExperimentAnalyzeResponse,
    ExperimentRoutesResponse,
    FeedbackResponse,
    HMWGenerateResponse,
    IdeateResponse,
    InvokeResponse,
    MentorVirtualResponse,
    NarrativeBuildResponse,
    NarrativeFeedbackResponse,
    PrototypeSuggestResponse,
    ResearchAssistResponse,
)
from services.context_assembler import ContextAssembler
from services.cost_tracker import CostLimitExceededError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])

# Agent singletons shared with orchestrator to avoid duplicate init.
# Each agent class' __init__ may require `OPENROUTER_API_KEY` (via deepagents +
# ChatOpenRouter). Without the key, instantiation throws and uvicorn crashes.
# We wrap each one so the container boots even without the key — affected
# endpoints return 503 via `_require_agent` until the key is configured.
# The pdf_extractor uses its own LLM init (langchain_openai.ChatOpenAI with explicit
# api_key arg) so it can still be instantiated; it will fail at invocation time
# if no key is configured, which the run state surfaces as a clean failure.


class _UnavailableAgentProxy:
    """Stand-in returned by _safe_init when the real agent cannot be constructed.
    Any attribute access raises 503 with a clear message; this means existing
    handler code (`await _mentor_virtual.run(...)`) doesn't need to change.
    """

    def __init__(self, agent_name: str, reason: str) -> None:
        self._agent_name = agent_name
        self._reason = reason

    def __getattr__(self, _name: str):  # noqa: ANN001, ANN204
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{self._agent_name} is not configured: {self._reason}. "
            "Set OPENROUTER_API_KEY in the ai-service env and restart.",
        )


def _safe_init(cls, name):
    try:
        return cls()
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "Agent %s could not be initialized: %s — endpoint will return 503 until OPENROUTER_API_KEY is configured.",
            name, exc,
        )
        return _UnavailableAgentProxy(name, str(exc)[:160])


_orchestrator = _safe_init(OrchestratorAgent, "OrchestratorAgent")
_mentor_virtual = _safe_init(MentorVirtualAgent, "MentorVirtualAgent")
_feedback_ia = _safe_init(FeedbackIAAgent, "FeedbackIAAgent")
_research_assistant = _safe_init(ResearchAssistantAgent, "ResearchAssistantAgent")
_solution_design = _safe_init(SolutionDesignAgent, "SolutionDesignAgent")
_experiment_coach = _safe_init(ExperimentCoachAgent, "ExperimentCoachAgent")
_narrative_builder = _safe_init(NarrativeBuilderAgent, "NarrativeBuilderAgent")
_pdf_extractor = _safe_init(PdfExtractorAgent, "PdfExtractorAgent")
_run_registry = get_run_registry()
_ctx = ContextAssembler()




# TODO(TASK-007): replace shared-secret with HMAC-SHA256 (timestamp + body) verification.
_INTERNAL_TOKEN_ENV = "AI_SERVICE_INTERNAL_TOKEN"


def _verify_internal_token(token: str | None) -> None:
    expected = os.getenv(_INTERNAL_TOKEN_ENV, "")
    if not expected:
        # When the env is unset (local dev), skip auth to keep the iteration loop fast.
        return
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorResponse(
                error="Invalid or missing X-Internal-Token",
                code="AUTH_FAILED",
            ).model_dump(),
        )


def _minimal_context(project_id: str, step: int = 0, module: str | None = None) -> dict:
    return _ctx.assemble(
        agent_id="orchestrator",
        project={"id": project_id, "name": ""},
        user={"id": "system", "role": "participant", "name": ""},
        current_step=step,
        current_module=module,
    )


def _handle_cost_error(exc: CostLimitExceededError) -> None:
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=ErrorResponse(
            error=exc.message,
            code="COST_EXCEEDED",
        ).model_dump(),
    )


# ---------------------------------------------------------------------------
# POST /ai/invoke
# ---------------------------------------------------------------------------

@router.post("/invoke", response_model=InvokeResponse)
async def invoke(body: InvokeRequest) -> InvokeResponse:
    """Unified entry point — orchestrator routes internally."""
    try:
        return await _orchestrator.invoke(body)
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("invoke error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(
                error=str(exc),
                code="SERVICE_UNAVAILABLE",
            ).model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/mentor-virtual
# ---------------------------------------------------------------------------

@router.post("/mentor-virtual", response_model=MentorVirtualResponse)
async def mentor_virtual(body: MentorVirtualRequest) -> MentorVirtualResponse:
    try:
        ctx = _minimal_context(body.projectId, step=0)
        result = await _mentor_virtual.run(
            step0_data=body.step0Data.model_dump(),
            context=ctx,
        )
        return MentorVirtualResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("mentor-virtual error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/feedback
# ---------------------------------------------------------------------------

@router.post("/feedback", response_model=FeedbackResponse)
async def feedback(body: FeedbackRequest) -> FeedbackResponse:
    try:
        ctx = _minimal_context(body.projectId, step=body.stepNumber, module=body.moduleId)
        result = await _feedback_ia.run(
            step_number=body.stepNumber,
            module_id=body.moduleId,
            module_data=body.moduleData,
            context=ctx,
        )
        return FeedbackResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("feedback error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/research-assist
# ---------------------------------------------------------------------------

@router.post("/research-assist", response_model=ResearchAssistResponse)
async def research_assist(body: ResearchAssistRequest) -> ResearchAssistResponse:
    try:
        ctx = _minimal_context(body.projectId, step=1, module="B")
        result = await _research_assistant.run(
            module_a_data=body.moduleAData.model_dump(),
            context=ctx,
        )
        return ResearchAssistResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("research-assist error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/hmw-generate
# ---------------------------------------------------------------------------

@router.post("/hmw-generate", response_model=HMWGenerateResponse)
async def hmw_generate(body: HMWGenerateRequest) -> HMWGenerateResponse:
    try:
        ctx = _minimal_context(body.projectId, step=2)
        result = await _solution_design.generate_hmw(
            synthesis_data=body.synthesisData,
            context=ctx,
        )
        return HMWGenerateResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("hmw-generate error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/ideate
# ---------------------------------------------------------------------------

@router.post("/ideate", response_model=IdeateResponse)
async def ideate(body: IdeateRequest) -> IdeateResponse:
    try:
        ctx = _minimal_context(body.projectId, step=2)
        result = await _solution_design.ideate(
            hmw=body.hmw,
            context_data=body.context,
            agent_context=ctx,
        )
        return IdeateResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("ideate error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/experiment-routes
# ---------------------------------------------------------------------------

@router.post("/experiment-routes", response_model=ExperimentRoutesResponse)
async def experiment_routes(body: ExperimentRoutesRequest) -> ExperimentRoutesResponse:
    try:
        ctx = _minimal_context(body.projectId, step=2)
        result = await _solution_design.experiment_routes(
            selected_idea=body.selectedIdea.model_dump(),
            dvf_scores=body.dvfScores,
            context=ctx,
        )
        return ExperimentRoutesResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("experiment-routes error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/prototype-suggest
# ---------------------------------------------------------------------------

@router.post("/prototype-suggest", response_model=PrototypeSuggestResponse)
async def prototype_suggest(body: PrototypeSuggestRequest) -> PrototypeSuggestResponse:
    try:
        ctx = _minimal_context(body.projectId, step=3)
        result = await _experiment_coach.prototype_suggest(
            test_card=body.testCard,
            context=ctx,
        )
        return PrototypeSuggestResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("prototype-suggest error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/experiment-analyze
# ---------------------------------------------------------------------------

@router.post("/experiment-analyze", response_model=ExperimentAnalyzeResponse)
async def experiment_analyze(body: ExperimentAnalyzeRequest) -> ExperimentAnalyzeResponse:
    try:
        ctx = _minimal_context(body.projectId, step=3)
        result = await _experiment_coach.experiment_analyze(
            run_id=body.runId,
            metrics=body.metrics,
            evidence=body.evidence,
            context=ctx,
        )
        return ExperimentAnalyzeResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("experiment-analyze error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/narrative-build
# ---------------------------------------------------------------------------

@router.post("/narrative-build", response_model=NarrativeBuildResponse)
async def narrative_build(body: NarrativeBuildRequest) -> NarrativeBuildResponse:
    try:
        ctx = _minimal_context(body.projectId, step=4)
        result = await _narrative_builder.build(
            audience=body.audience,
            context=ctx,
        )
        return NarrativeBuildResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("narrative-build error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc


# ---------------------------------------------------------------------------
# POST /ai/pdf-extract  (TASK-008 — async ADR-008 pattern)
# ---------------------------------------------------------------------------


@router.post("/pdf-extract", response_model=PdfExtractAck)
async def pdf_extract(
    body: PdfExtractRequest,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> PdfExtractAck:
    """Schedule a PDF extraction. Returns runId immediately; poll via GET below."""
    _verify_internal_token(x_internal_token)
    try:
        run_id = _pdf_extractor.start(body)
        return PdfExtractAck(runId=run_id, status="pending")
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorResponse(error=str(exc), code="INVALID_INPUT").model_dump(),
        ) from exc
    except Exception as exc:
        logger.exception("pdf-extract scheduling error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(
                error=str(exc),
                code="SERVICE_UNAVAILABLE",
            ).model_dump(),
        ) from exc


@router.get("/pdf-extract/runs/{run_id}", response_model=PdfExtractRunState)
async def pdf_extract_run_status(
    run_id: str,
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> PdfExtractRunState:
    """Return the current state of an extraction run (proposals once completed)."""
    _verify_internal_token(x_internal_token)
    state = _run_registry.get(run_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorResponse(
                error=f"runId {run_id} not found",
                code="INVALID_INPUT",
            ).model_dump(),
        )
    return state


# ---------------------------------------------------------------------------
# POST /ai/narrative-feedback
# ---------------------------------------------------------------------------

@router.post("/narrative-feedback", response_model=NarrativeFeedbackResponse)
async def narrative_feedback(body: NarrativeFeedbackRequest) -> NarrativeFeedbackResponse:
    try:
        ctx = _minimal_context(body.projectId, step=4)
        result = await _narrative_builder.feedback(
            slides=body.slides,
            notes=body.notes,
            context=ctx,
        )
        return NarrativeFeedbackResponse(data=result["data"])
    except CostLimitExceededError as exc:
        _handle_cost_error(exc)
    except Exception as exc:
        logger.exception("narrative-feedback error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorResponse(error=str(exc), code="SERVICE_UNAVAILABLE").model_dump(),
        ) from exc
