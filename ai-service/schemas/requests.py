from typing import Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# POST /ai/invoke
# ---------------------------------------------------------------------------

class InvokeRequest(BaseModel):
    agentHint: str | None = Field(None, description="ID sugerido del agente a invocar")
    step: int = Field(..., ge=0, le=4, description="Numero de paso (0-4)")
    module: str | None = Field(None, description="ID del modulo (A, B, C, D)")
    action: str = Field(..., description="Accion: feedback, assist, generate")
    payload: dict[str, Any] = Field(..., description="Datos especificos del agente")


# ---------------------------------------------------------------------------
# POST /ai/mentor-virtual
# ---------------------------------------------------------------------------

class Step0Data(BaseModel):
    origen: str
    parteProceso: str
    impacto3meses: str
    respaldo: str
    descripcion: str
    quienImpacta: str
    siMinimo: str


class MentorVirtualRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    step0Data: Step0Data = Field(..., description="Datos de Step 0")


# ---------------------------------------------------------------------------
# POST /ai/feedback
# ---------------------------------------------------------------------------

class FeedbackRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    stepNumber: int = Field(..., ge=1, le=4, description="Numero de paso (1-4)")
    moduleId: str = Field(..., description="ID del modulo (A, B, C, D)")
    moduleData: dict[str, Any] = Field(..., description="Datos del modulo en formato JSON")


# ---------------------------------------------------------------------------
# POST /ai/research-assist
# ---------------------------------------------------------------------------

class ModuleAData(BaseModel):
    casoReal: str
    pasos: str
    quiebre: str
    consecuencia: str
    causaInmediata: str
    alcance: str


class ResearchAssistRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    moduleAData: ModuleAData = Field(..., description="Datos del modulo A (AS-IS)")


# ---------------------------------------------------------------------------
# POST /ai/hmw-generate
# ---------------------------------------------------------------------------

class HMWGenerateRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    synthesisData: dict[str, Any] = Field(..., description="Datos del modulo D de Step 1")


# ---------------------------------------------------------------------------
# POST /ai/ideate
# ---------------------------------------------------------------------------

class IdeateRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    hmw: str = Field(..., description="HMW seleccionado")
    context: dict[str, Any] = Field(..., description="Contexto adicional del proyecto")


# ---------------------------------------------------------------------------
# POST /ai/experiment-routes
# ---------------------------------------------------------------------------

class SelectedIdea(BaseModel):
    id: str
    title: str
    description: str


class ExperimentRoutesRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    selectedIdea: SelectedIdea = Field(..., description="Idea finalista")
    dvfScores: dict[str, Any] = Field(..., description="Puntuaciones DVF")


# ---------------------------------------------------------------------------
# POST /ai/prototype-suggest
# ---------------------------------------------------------------------------

class PrototypeSuggestRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    testCard: dict[str, Any] = Field(..., description="Datos del test card de Step 2 Modulo D")


# ---------------------------------------------------------------------------
# POST /ai/experiment-analyze
# ---------------------------------------------------------------------------

class ExperimentAnalyzeRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    runId: str = Field(..., description="ID de la ejecucion")
    metrics: dict[str, Any] = Field(..., description="Metricas del experimento")
    evidence: list[str] = Field(..., description="URLs o IDs de evidencia")


# ---------------------------------------------------------------------------
# POST /ai/narrative-build
# ---------------------------------------------------------------------------

class NarrativeBuildRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    audience: str = Field(..., description="Audiencia objetivo")


# ---------------------------------------------------------------------------
# POST /ai/narrative-feedback
# ---------------------------------------------------------------------------

class NarrativeFeedbackRequest(BaseModel):
    projectId: str = Field(..., description="UUID del proyecto")
    slides: list[dict[str, Any]] = Field(..., description="Array de slides editados")
    notes: str = Field(..., description="Notas del participante")
