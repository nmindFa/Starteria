"""Pydantic schema validation tests.

The schemas modules already get 100% line coverage from imports, but these
tests exercise validators (range bounds, literals, length constraints) so any
regression in the contract surface fails the suite immediately.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

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
    SelectedIdea,
    Step0Data,
    ModuleAData,
)
from schemas.responses import (
    ErrorResponse,
    ExperimentAnalyzeData,
    FeedbackData,
    NarrativeBuildData,
    Slide,
)


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestInvokeRequest:
    def test_valid_payload(self) -> None:
        req = InvokeRequest(
            agentHint="feedback-ia",
            step=2,
            module="A",
            action="feedback",
            payload={"projectId": "p1"},
        )
        assert req.step == 2
        assert req.payload == {"projectId": "p1"}

    @pytest.mark.parametrize("step", [-1, 5, 99])
    def test_step_out_of_range_rejected(self, step: int) -> None:
        with pytest.raises(ValidationError):
            InvokeRequest(step=step, action="x", payload={})

    def test_action_required(self) -> None:
        with pytest.raises(ValidationError):
            InvokeRequest(step=0, payload={})  # type: ignore[call-arg]

    def test_payload_required(self) -> None:
        with pytest.raises(ValidationError):
            InvokeRequest(step=0, action="x")  # type: ignore[call-arg]


@pytest.mark.unit
class TestStep0Data:
    def test_all_fields_required(self) -> None:
        with pytest.raises(ValidationError) as exc:
            Step0Data(origen="x")  # type: ignore[call-arg]
        # Multiple missing fields should be reported.
        msg = str(exc.value)
        assert "parteProceso" in msg or "field required" in msg.lower()

    def test_round_trip(self) -> None:
        data = Step0Data(
            origen="o",
            parteProceso="pp",
            impacto3meses="i",
            respaldo="r",
            descripcion="d",
            quienImpacta="q",
            siMinimo="s",
        )
        assert data.model_dump()["origen"] == "o"


@pytest.mark.unit
class TestFeedbackRequest:
    @pytest.mark.parametrize("step", [0, 5, 99])
    def test_step_out_of_range_rejected(self, step: int) -> None:
        with pytest.raises(ValidationError):
            FeedbackRequest(
                projectId="p",
                stepNumber=step,
                moduleId="A",
                moduleData={},
            )

    def test_valid(self) -> None:
        req = FeedbackRequest(
            projectId="p", stepNumber=1, moduleId="A", moduleData={"x": 1}
        )
        assert req.stepNumber == 1


@pytest.mark.unit
class TestRemainingRequests:
    def test_research_assist(self) -> None:
        req = ResearchAssistRequest(
            projectId="p",
            moduleAData=ModuleAData(
                casoReal="x",
                pasos="x",
                quiebre="x",
                consecuencia="x",
                causaInmediata="x",
                alcance="x",
            ),
        )
        assert req.moduleAData.casoReal == "x"

    def test_mentor_virtual_request_valid(self) -> None:
        req = MentorVirtualRequest(
            projectId="p",
            step0Data=Step0Data(
                origen="o",
                parteProceso="p",
                impacto3meses="i",
                respaldo="r",
                descripcion="d",
                quienImpacta="q",
                siMinimo="s",
            ),
        )
        assert req.projectId == "p"

    def test_hmw_generate(self) -> None:
        req = HMWGenerateRequest(projectId="p", synthesisData={"k": "v"})
        assert req.synthesisData == {"k": "v"}

    def test_ideate(self) -> None:
        req = IdeateRequest(projectId="p", hmw="Como X", context={"k": "v"})
        assert req.hmw == "Como X"

    def test_experiment_routes(self) -> None:
        req = ExperimentRoutesRequest(
            projectId="p",
            selectedIdea=SelectedIdea(id="i", title="t", description="d"),
            dvfScores={"D": 5},
        )
        assert req.selectedIdea.id == "i"

    def test_prototype_suggest(self) -> None:
        req = PrototypeSuggestRequest(projectId="p", testCard={"k": "v"})
        assert req.testCard["k"] == "v"

    def test_experiment_analyze(self) -> None:
        req = ExperimentAnalyzeRequest(
            projectId="p", runId="r", metrics={"m": 1}, evidence=["u"]
        )
        assert req.runId == "r"

    def test_narrative_build(self) -> None:
        req = NarrativeBuildRequest(projectId="p", audience="a")
        assert req.audience == "a"

    def test_narrative_feedback(self) -> None:
        req = NarrativeFeedbackRequest(
            projectId="p",
            slides=[{"number": 1}],
            notes="n",
        )
        assert req.notes == "n"


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


@pytest.mark.unit
class TestFeedbackData:
    @pytest.mark.parametrize("status", ["Aprobado", "Iterar", "Bloqueado"])
    def test_valid_status_literals(self, status: str) -> None:
        data = FeedbackData(
            status=status,  # type: ignore[arg-type]
            summary="ok",
            goodPoints=[],
            missing=[],
            actions=[],
            questions=[],
            contradictions=[],
        )
        assert data.status == status

    def test_invalid_status_rejected(self) -> None:
        with pytest.raises(ValidationError):
            FeedbackData(
                status="Pending",  # type: ignore[arg-type]
                summary="x",
                goodPoints=[],
                missing=[],
                actions=[],
                questions=[],
                contradictions=[],
            )

    def test_summary_max_length(self) -> None:
        with pytest.raises(ValidationError):
            FeedbackData(
                status="Aprobado",
                summary="x" * 501,
                goodPoints=[],
                missing=[],
                actions=[],
                questions=[],
                contradictions=[],
            )


@pytest.mark.unit
class TestNarrativeBuildData:
    def _slide(self, n: int) -> dict:
        return {
            "number": n,
            "title": f"t{n}",
            "keyMessage": "km",
            "content": "c",
            "speakerNotes": "n",
        }

    def test_requires_exactly_12_slides(self) -> None:
        # 11 slides -> rejected.
        with pytest.raises(ValidationError):
            NarrativeBuildData(
                slides=[Slide(**self._slide(i)) for i in range(1, 12)],
                elevatorPitch="ep",
                narrativeArc="arc",
            )

    def test_accepts_exactly_12_slides(self) -> None:
        data = NarrativeBuildData(
            slides=[Slide(**self._slide(i)) for i in range(1, 13)],
            elevatorPitch="ep",
            narrativeArc="arc",
        )
        assert len(data.slides) == 12


@pytest.mark.unit
class TestExperimentAnalyzeData:
    @pytest.mark.parametrize("rec", ["GO", "NO_GO", "PIVOT"])
    def test_valid_recommendations(self, rec: str) -> None:
        data = ExperimentAnalyzeData(
            findings=["x"],
            recommendation=rec,  # type: ignore[arg-type]
            rationale="why",
            learningCard={"k": "v"},
        )
        assert data.recommendation == rec

    def test_invalid_recommendation_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ExperimentAnalyzeData(
                findings=[],
                recommendation="MAYBE",  # type: ignore[arg-type]
                rationale="x",
                learningCard={},
            )


@pytest.mark.unit
class TestErrorResponse:
    @pytest.mark.parametrize(
        "code",
        [
            "COST_EXCEEDED",
            "INVALID_INPUT",
            "AUTH_FAILED",
            "RATE_LIMIT",
            "TIMEOUT",
            "SERVICE_UNAVAILABLE",
        ],
    )
    def test_valid_codes(self, code: str) -> None:
        err = ErrorResponse(error="x", code=code)  # type: ignore[arg-type]
        assert err.code == code

    def test_invalid_code_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ErrorResponse(error="x", code="UNKNOWN_CODE")  # type: ignore[arg-type]
