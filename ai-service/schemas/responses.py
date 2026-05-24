from typing import Any, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# POST /ai/invoke
# ---------------------------------------------------------------------------

class InvokeResponse(BaseModel):
    data: dict[str, Any]
    agent: str
    model: str
    tokensUsed: int
    latencyMs: int


# ---------------------------------------------------------------------------
# POST /ai/mentor-virtual
# ---------------------------------------------------------------------------

class MentorVirtualData(BaseModel):
    claro: list[str]
    faltaPrecisar: list[str]
    preguntas: list[str]
    siguienteAccion: str


class MentorVirtualResponse(BaseModel):
    data: MentorVirtualData


# ---------------------------------------------------------------------------
# POST /ai/feedback
# ---------------------------------------------------------------------------

class FeedbackData(BaseModel):
    status: Literal["Aprobado", "Iterar", "Bloqueado"]
    summary: str = Field(..., max_length=500)
    goodPoints: list[str]
    missing: list[str]
    actions: list[str]
    questions: list[str]
    contradictions: list[str]


class FeedbackResponse(BaseModel):
    data: FeedbackData


# ---------------------------------------------------------------------------
# POST /ai/research-assist
# ---------------------------------------------------------------------------

class ResearchTopic(BaseModel):
    tema: str
    justificacion: str


class ResearchProfile(BaseModel):
    perfil: str
    razon: str


class ResearchAssistData(BaseModel):
    objetivo: str
    temas: list[ResearchTopic]
    perfiles: list[ResearchProfile]
    guiaPreguntas: list[str]


class ResearchAssistResponse(BaseModel):
    data: ResearchAssistData


# ---------------------------------------------------------------------------
# POST /ai/hmw-generate
# ---------------------------------------------------------------------------

class HMWOption(BaseModel):
    hmw: str
    rationale: str


class HMWGenerateData(BaseModel):
    options: list[HMWOption]


class HMWGenerateResponse(BaseModel):
    data: HMWGenerateData


# ---------------------------------------------------------------------------
# POST /ai/ideate
# ---------------------------------------------------------------------------

class Idea(BaseModel):
    id: str
    title: str
    description: str
    cluster: str


class IdeateData(BaseModel):
    ideas: list[Idea]


class IdeateResponse(BaseModel):
    data: IdeateData


# ---------------------------------------------------------------------------
# POST /ai/experiment-routes
# ---------------------------------------------------------------------------

class ExperimentRoute(BaseModel):
    hypothesis: str
    experiment: str
    metric: str


class ExperimentRoutesData(BaseModel):
    routes: list[ExperimentRoute]


class ExperimentRoutesResponse(BaseModel):
    data: ExperimentRoutesData


# ---------------------------------------------------------------------------
# POST /ai/prototype-suggest
# ---------------------------------------------------------------------------

class PrototypeSuggestData(BaseModel):
    components: list[str]
    instrumentation: list[str]
    tips: list[str]


class PrototypeSuggestResponse(BaseModel):
    data: PrototypeSuggestData


# ---------------------------------------------------------------------------
# POST /ai/experiment-analyze
# ---------------------------------------------------------------------------

class ExperimentAnalyzeData(BaseModel):
    findings: list[str]
    recommendation: Literal["GO", "NO_GO", "PIVOT"]
    rationale: str
    learningCard: dict[str, Any]


class ExperimentAnalyzeResponse(BaseModel):
    data: ExperimentAnalyzeData


# ---------------------------------------------------------------------------
# POST /ai/narrative-build
# ---------------------------------------------------------------------------

class Slide(BaseModel):
    number: int
    title: str
    keyMessage: str
    content: str
    speakerNotes: str


class NarrativeBuildData(BaseModel):
    slides: list[Slide] = Field(..., min_length=12, max_length=12)
    elevatorPitch: str
    narrativeArc: str


class NarrativeBuildResponse(BaseModel):
    data: NarrativeBuildData


# ---------------------------------------------------------------------------
# POST /ai/narrative-feedback
# ---------------------------------------------------------------------------

class NarrativeFeedbackData(BaseModel):
    feedback: list[str]
    suggestions: list[str]


class NarrativeFeedbackResponse(BaseModel):
    data: NarrativeFeedbackData


# ---------------------------------------------------------------------------
# Error response
# ---------------------------------------------------------------------------

ErrorCode = Literal[
    "COST_EXCEEDED",
    "INVALID_INPUT",
    "AUTH_FAILED",
    "RATE_LIMIT",
    "TIMEOUT",
    "SERVICE_UNAVAILABLE",
]


class ErrorResponse(BaseModel):
    error: str
    code: ErrorCode
    details: str | None = None
