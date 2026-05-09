"""FastAPI router for all SPEC-001 AI endpoints.

All endpoints are internal (no auth — Express handles JWT before proxying).
"""

import logging

from fastapi import APIRouter, HTTPException, status

from agents.experiment_coach import ExperimentCoachAgent
from agents.feedback_ia import FeedbackIAAgent
from agents.mentor_virtual import MentorVirtualAgent
from agents.narrative_builder import NarrativeBuilderAgent
from agents.orchestrator import OrchestratorAgent
from agents.research_assistant import ResearchAssistantAgent
from agents.solution_design import SolutionDesignAgent
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

# Agent singletons shared with orchestrator to avoid duplicate init
_orchestrator = OrchestratorAgent()
_mentor_virtual = MentorVirtualAgent()
_feedback_ia = FeedbackIAAgent()
_research_assistant = ResearchAssistantAgent()
_solution_design = SolutionDesignAgent()
_experiment_coach = ExperimentCoachAgent()
_narrative_builder = NarrativeBuilderAgent()
_ctx = ContextAssembler()


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
