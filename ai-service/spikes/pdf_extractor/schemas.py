"""Pydantic v2 models mirroring the ground-truth shape.

Field paths and shapes MUST match `evals/golden/pdf-extraction/test-iniciativa.ground-truth.json`.
Every leaf is `Optional[FieldProposal] = None` so the agent can omit fields without evidence.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class Provenance(BaseModel):
    """A single piece of evidence supporting a proposed field value."""

    model_config = ConfigDict(extra="ignore")

    page: int = Field(..., ge=1, description="Page number (1-indexed) in the source PDF")
    quote: str = Field(..., max_length=320, description="Literal excerpt from the PDF (≤280 chars target)")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Per-evidence confidence 0-1")


class FieldProposal(BaseModel):
    """Generic wrapper for any proposed field value with its provenance."""

    model_config = ConfigDict(extra="ignore")

    value: Any = Field(..., description="The proposed value (str | list | dict)")
    provenance: list[Provenance] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0, description="Aggregate confidence for the field")


# ---------- Step 0 ----------


class Step0Extraction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    nombreParticipante: Optional[FieldProposal] = None
    rolArea: Optional[FieldProposal] = None
    origen: Optional[FieldProposal] = None
    quePasaQueQuieres: Optional[FieldProposal] = None
    impacta: Optional[FieldProposal] = None
    parteProceso: Optional[FieldProposal] = None
    impacto3meses: Optional[FieldProposal] = None
    respaldo: Optional[FieldProposal] = None
    quienEscuchar: Optional[FieldProposal] = None


# ---------- Step 1 ----------


class Step1AsisData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    casoReal: Optional[FieldProposal] = None
    quiebre: Optional[FieldProposal] = None
    quiebreDetalle: Optional[FieldProposal] = None
    consecuencia: Optional[FieldProposal] = None
    consequenceTags: Optional[FieldProposal] = None
    causaInmediata: Optional[FieldProposal] = None
    evidenciaTipo: Optional[FieldProposal] = None
    evidenciaNota: Optional[FieldProposal] = None
    alcance: Optional[FieldProposal] = None


class Step1CData(BaseModel):
    model_config = ConfigDict(extra="ignore")

    limitesChips: Optional[FieldProposal] = None
    dependencia: Optional[FieldProposal] = None
    alternativaPiloto: Optional[FieldProposal] = None


class Step1Extraction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    asisData: Step1AsisData = Field(default_factory=Step1AsisData)
    cData: Step1CData = Field(default_factory=Step1CData)


# ---------- Step 2 ----------


class Step2TestCard(BaseModel):
    model_config = ConfigDict(extra="ignore")

    hipotesis: Optional[FieldProposal] = None
    queTestan: Optional[FieldProposal] = None
    conQuien: Optional[FieldProposal] = None
    dondeCuando: Optional[FieldProposal] = None
    metodo: Optional[FieldProposal] = None
    metrica: Optional[FieldProposal] = None


class Step2Extraction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    hmw: Optional[FieldProposal] = None
    testCard: Step2TestCard = Field(default_factory=Step2TestCard)


# ---------- Step 3 ----------


class Step3Logistica(BaseModel):
    model_config = ConfigDict(extra="ignore")

    donde: Optional[FieldProposal] = None


class TestCycle(BaseModel):
    model_config = ConfigDict(extra="ignore")

    queValidamos: Optional[FieldProposal] = None
    metricaPrincipal: Optional[FieldProposal] = None
    resultadoEsperado: Optional[FieldProposal] = None
    resultadoObservado: Optional[FieldProposal] = None
    decision: Optional[FieldProposal] = None
    aprendizaje: Optional[FieldProposal] = None


class Step3Diagnostico(BaseModel):
    model_config = ConfigDict(extra="ignore")

    senales: Optional[FieldProposal] = None


class Step3Extraction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    formatoExp: Optional[FieldProposal] = None
    logistica: Step3Logistica = Field(default_factory=Step3Logistica)
    instrumentacion: Optional[FieldProposal] = None
    testCycles: list[TestCycle] = Field(default_factory=list)
    goNoGo: Optional[FieldProposal] = None
    aprendizajes: Optional[FieldProposal] = None
    diagnostico: Step3Diagnostico = Field(default_factory=Step3Diagnostico)


# ---------- Step 4 ----------


class PresentationContent(BaseModel):
    model_config = ConfigDict(extra="ignore")

    problem: Optional[FieldProposal] = None
    urgency: Optional[FieldProposal] = None
    evidence: Optional[FieldProposal] = None
    proposal: Optional[FieldProposal] = None
    solutionComponents: Optional[FieldProposal] = None
    tests: Optional[FieldProposal] = None
    results: Optional[FieldProposal] = None
    recommendation: Optional[FieldProposal] = None
    orgNeeds: Optional[FieldProposal] = None
    nextStep: Optional[FieldProposal] = None


class ImplementationPlanRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    stage: str
    activity: str
    expectedResult: Optional[str] = None
    status: Optional[str] = None


class Step4OrgContext(BaseModel):
    model_config = ConfigDict(extra="ignore")

    affectedAreas: Optional[FieldProposal] = None
    risks: Optional[FieldProposal] = None


class Step4Extraction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    audience: Optional[FieldProposal] = None
    meetingGoal: Optional[FieldProposal] = None
    decision: Optional[FieldProposal] = None
    closureType: Optional[FieldProposal] = None
    presentation: PresentationContent = Field(default_factory=PresentationContent)
    implementationPlan: Optional[FieldProposal] = None
    orgContext: Step4OrgContext = Field(default_factory=Step4OrgContext)


# ---------- Root ----------


class ExtractionMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")

    model: str
    language: str
    pages: int
    started_at: str
    finished_at: str
    duration_ms: int
    per_step_ms: dict[str, int] = Field(default_factory=dict)
    per_step_tokens: dict[str, dict[str, int]] = Field(default_factory=dict)
    parse_failures: list[str] = Field(default_factory=list)


class InitiativeExtraction(BaseModel):
    model_config = ConfigDict(extra="ignore")

    step0: Step0Extraction = Field(default_factory=Step0Extraction)
    step1: Step1Extraction = Field(default_factory=Step1Extraction)
    step2: Step2Extraction = Field(default_factory=Step2Extraction)
    step3: Step3Extraction = Field(default_factory=Step3Extraction)
    step4: Step4Extraction = Field(default_factory=Step4Extraction)
    must_omit_violations: list[str] = Field(default_factory=list)
    extraction_metadata: ExtractionMetadata


def empty_metadata(model: str, language: str, pages: int) -> ExtractionMetadata:
    now = datetime.utcnow().isoformat()
    return ExtractionMetadata(
        model=model,
        language=language,
        pages=pages,
        started_at=now,
        finished_at=now,
        duration_ms=0,
    )
