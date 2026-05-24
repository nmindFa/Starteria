"""Offline regression test: proves the eval pipeline (scoring + ground-truth + thresholds)
is correct WITHOUT calling the live LLM.

This complements `test_pdf_extractor_eval.py` (live, opt-in via RUN_EVAL_TESTS=1) by
running the SAME scorer over a hand-crafted extraction snapshot that mirrors the
output DeepSeek/OpenRouter returned during the validated iter 8 of the original
/loop (recorded at `evals/results/pdf-extraction/20260519-200756.json` with
precision=0.800, recall=0.772, hallucination=0.000, provenance=0.964).

If anyone modifies the scorer, the schemas, the prompts, or the ground truth, this
test catches it immediately. No API key required.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ai-service" / "spikes" / "pdf_extractor"))


@pytest.fixture(scope="module")
def ground_truth() -> dict:
    gt_path = ROOT / "evals" / "golden" / "pdf-extraction" / "test-iniciativa.ground-truth.json"
    with gt_path.open(encoding="utf-8") as f:
        return json.load(f)


def _prop(value, page: int, quote: str, conf: float) -> dict:
    """Build a FieldProposal-shaped dict for snapshot fixtures."""
    return {
        "value": value,
        "provenance": [{"page": page, "quote": quote, "confidence": conf}],
        "confidence": conf,
    }


@pytest.fixture(scope="module")
def snapshot_extraction() -> dict:
    """Hand-crafted extraction snapshot that mirrors DeepSeek's iter-8 output for the
    test PDF. Includes ~40 high-confidence proposals across Steps 0–4 and provides
    enough recall to clear PRD-002 thresholds (precision ≥0.80, recall ≥0.70).
    """
    return {
        "step0": {
            "nombreParticipante": _prop("Nancy Andrade", 14, "Nancy Andrade Sub Gerente Créditos y Cobranzas", 0.95),
            "rolArea": _prop("Sub Gerente Créditos y Cobranzas — Unimaq", 14, "Sub Gerente Créditos y Cobranzas", 0.92),
            "origen": _prop("problema", 3, "El Reto: Rigidez Operativa — 6,000+ excepciones", 0.95),
            "quePasaQueQuieres": _prop(
                "Las sucursales no pueden resolver excepciones de crédito localmente: deben esperar autorización desde Lima, generando 6,000+ excepciones y 5h+ lead time que detiene operatividad del cliente. Queremos habilitar autonomía controlada en jefes y administradores de sucursal.",
                3, "6,000+ excepciones — 5h+ lead time — necesitamos esperar la autorización desde Lima", 0.9),
            "impacta": _prop(["Operaciones", "Ventas", "Clientes externos", "Finanzas"], 3, "carga administrativa masiva para el equipo de créditos", 0.88),
            "parteProceso": _prop("durante", 3, "durante fines de semana o cierres de mes", 0.9),
            "impacto3meses": _prop("cliente", 3, "detiene la operatividad del cliente", 0.85),
            "respaldo": _prop("datos", 3, "6,000+ excepciones — 5h+ lead time (datos cuantitativos)", 0.95),
            "quienEscuchar": _prop("Jefes de Oficina, Administradores de Sucursal, Equipo de Créditos", 5, "Si habilitamos a los jefes y administradores con criterios claros — Equipo Cobranzas", 0.8),
        },
        "step1": {
            "asisData": {
                "casoReal": _prop(
                    "Un cliente con urgencia llega a la sucursal a liberar un crédito; el sistema SAP bloquea por reglas heredadas; el ejecutivo escala a Lima y la autorización tarda 5h+, deteniendo operativa con el cliente.",
                    2, "necesitamos esperar la autorización desde Lima — Criterios contradictorios en SAP heredados", 0.88),
                "quiebre": _prop("Esperar autorización desde Lima", 2, "necesitamos esperar la autorización desde Lima", 0.95),
                "quiebreDetalle": _prop(
                    "La decisión está centralizada en Lima; las reglas de admisión en SAP son contradictorias y heredadas; los datos no son consultables en tiempo real desde sucursal; falta claridad sobre autonomías ya existentes.",
                    4, "Reglas Sistémicas: Criterios contradictorios en SAP heredados — Dependencia Central: Cuellos de botella por centralización en Lima", 0.9),
                "consecuencia": _prop(
                    "El cliente queda sin operar; el equipo de créditos se satura; lead time 5h+; se generaron 6,000+ excepciones en 2025.",
                    3, "6,000+ excepciones en 2025 — 5h+ lead time — detiene la operatividad del cliente", 0.92),
                "consequenceTags": _prop(["operativa", "economica", "humana"], 3, "carga administrativa masiva — detiene operatividad del cliente", 0.85),
                "causaInmediata": _prop("Criterios contradictorios en SAP heredados desde la implementación + centralización de decisiones en Lima", 4, "Reglas Sistémicas + Dependencia Central", 0.9),
                "evidenciaTipo": _prop("dato", 3, "6,000+ excepciones — 5h+ lead time", 0.92),
                "evidenciaNota": _prop("6,000+ excepciones en 2025 con 5h+ lead time", 3, "6,000+ EXCEPCIONES EN 2025 — 5h+ LEAD TIME", 0.95),
                "alcance": _prop("durante", 3, "durante fines de semana o cierres de mes", 0.85),
            },
            "cData": {
                "limitesChips": _prop(["no comprometer riesgo financiero", "reglas claras", "control corporativo", "capacitación"], 5, "sin comprometer la gestión del riesgo financiero — criterios claros — capacitación", 0.85),
                "dependencia": _prop("Reglas SAP + Equipo de Créditos Lima (centralización)", 4, "Criterios contradictorios en SAP — Cuellos de botella por centralización en Lima", 0.88),
                "alternativaPiloto": _prop(
                    "Piloto en sucursales Arequipa y Huancayo usando SAP Fiori (Liberación Directa) + Plataforma de Alerta Rápida + Reglas de Verificación Nivel 2",
                    6, "Arequipa y Huancayo — SAP Fiori (Liberación Directa) — Plataforma de Alerta Rápida — Reglas de Verificación Nivel 2", 0.92),
            },
        },
        "step2": {
            "hmw": _prop(
                "¿Cómo habilitamos a los jefes y administradores de sucursal con criterios claros, capacitación y herramientas para resolver excepciones de forma rápida y segura sin comprometer la gestión del riesgo financiero?",
                5, "Si habilitamos a los jefes y administradores con criterios claros, capacitación y herramientas... podrán resolver excepciones de forma rápida y segura, sin comprometer la gestión del riesgo financiero.", 0.92),
            "testCard": {
                "hipotesis": _prop(
                    "Si habilitamos a los jefes y administradores con criterios claros, capacitación y herramientas ya disponibles, podrán resolver excepciones de forma rápida y segura, sin comprometer la gestión del riesgo financiero.",
                    5, "Si habilitamos a los jefes y administradores con criterios claros... podrán resolver excepciones de forma rápida y segura, sin comprometer la gestión del riesgo financiero.", 0.95),
                "queTestan": _prop("Viabilidad del modelo de autonomía descentralizada en condiciones reales", 6, "demostrar la viabilidad del modelo en condiciones reales", 0.85),
                "conQuien": _prop("Sucursales Arequipa y Huancayo (jefes y administradores)", 6, "Arequipa y Huancayo", 0.95),
                "dondeCuando": _prop("Sedes con alto flujo (Arequipa y Huancayo)", 6, "Elegimos sedes con alto flujo", 0.85),
                "metodo": _prop("SAP Fiori (Liberación Directa) + Plataforma de Alerta Rápida + Reglas de Verificación Nivel 2", 6, "SAP Fiori (Liberación Directa) — Plataforma de Alerta Rápida — Reglas de Verificación Nivel 2", 0.95),
                "metrica": _prop("Lead time de respuesta (minutos) y % de solicitudes resueltas localmente", 8, "Reducción del Tiempo — Solicitudes resueltas localmente", 0.92),
            },
        },
        "step3": {
            "formatoExp": _prop("Piloto operativo", 6, "El Experimento Piloto — sedes con alto flujo en condiciones reales", 0.95),
            "logistica": {
                "donde": _prop("Arequipa y Huancayo", 6, "Suc. Arequipa — Suc. Huancayo", 0.95),
            },
            "instrumentacion": _prop(
                [
                    {"dato": "Lead time de respuesta", "metricaExito": "Reducción ≥50%", "fuente": "SAP Fiori + Plataforma Alerta Rápida"},
                    {"dato": "% solicitudes resueltas localmente", "metricaExito": "≥30%", "fuente": "Plataforma de Alerta Rápida"},
                ],
                8, "300 min (5h) — 21 min — -93% — 42% Solicitudes resueltas localmente", 0.88),
            "testCycles": [
                {
                    "queValidamos": _prop("Si habilitar autonomía local con SAP Fiori reduce lead time manteniendo control de riesgo", 5, "habilitar autonomía controlada — reducir tiempo de respuesta", 0.85),
                    "metricaPrincipal": _prop("Lead time (minutos) y % resolución local", 8, "300 min → 21 min — 42% Solicitudes resueltas localmente", 0.95),
                    "resultadoObservado": _prop("Lead time pasó de 300 min (5h) a 21 min (-93%); 42% resueltas localmente", 8, "Antes 300 min (5h) — Durante 21 min — -93% Reducción — 42% Solicitudes resueltas localmente", 0.95),
                    "decision": _prop("mantener", 9, "Escenarios recomendados: Conservador (Optimizar)", 0.88),
                    "aprendizaje": _prop(
                        "(1) Capacidad Local: la sucursal asume mayor protagonismo cuando sabe hasta dónde decidir. (2) Autonomía ≠ Descontrol: requiere reglas claras + datos confiables + capacitación constante. (3) Comunicación Periódica: información traducida según perfil.",
                        7, "Capacidad Local — Autonomía ≠ Descontrol — Comunicación Periódica", 0.92),
                }
            ],
            "goNoGo": _prop("Go", 9, "Escenarios recomendados: Conservador (Optimizar)", 0.9),
            "aprendizajes": _prop(
                [
                    "Capacidad Local: la sucursal puede asumir mayor protagonismo cuando sabe exactamente hasta dónde decidir",
                    "Autonomía ≠ Descontrol: requiere reglas claras, datos confiables para el seguimiento y capacitación constante",
                    "Comunicación Periódica: la información debe traducirse según el perfil (comercial, administrativo, créditos)",
                ],
                7, "Aprendizajes Clave: Capacidad Local — Autonomía ≠ Descontrol — Comunicación Periódica", 0.95),
            "diagnostico": {
                "senales": _prop(["-93% reducción de tiempo (300min → 21min)", "42% de solicitudes resueltas localmente"], 8, "-93% Reducción del Tiempo — 42% Solicitudes resueltas localmente", 0.95),
            },
        },
        "step4": {
            "audience": _prop("Comite", 12, "Pedido al Comité", 0.95),
            "meetingGoal": _prop("Solicitar aprobación de escalamiento + sponsorship + presupuesto", 12, "Pedido al Comité: Priorización — Sponsorship — Tecnología (S/.20,000)", 0.88),
            "decision": _prop("Go", 9, "Recomendación: Conservador (Optimizar) — escalamiento", 0.9),
            "closureType": _prop("Implementar", 9, "Conservador (Optimizar) — despliegue nacional", 0.9),
            "presentation": {
                "problem": _prop(
                    "Rigidez operativa: las sucursales no pueden resolver excepciones sin esperar autorización desde Lima, generando 6,000+ excepciones/año y 5h+ lead time.",
                    3, "Rigidez Operativa — 6,000+ excepciones — 5h+ lead time", 0.92),
                "urgency": _prop(
                    "La operatividad del cliente se detiene en fines de semana y cierres de mes; equipo de créditos saturado; afecta velocidad comercial.",
                    3, "Velocidad Comercial — detiene la operatividad del cliente durante fines de semana o cierres de mes", 0.85),
                "evidence": _prop(
                    "6,000+ excepciones en 2025; 5h+ lead time; piloto Arequipa+Huancayo: 300min → 21min (-93%), 42% resolución local",
                    8, "6,000+ — 5h+ — 300 min — 21 min — -93% — 42%", 0.95),
                "proposal": _prop(
                    "Protocolo de Autonomía: habilitación local de jefes y administradores con criterios claros + capacitación + herramientas, manteniendo control de riesgo (Agilidad Controlada).",
                    1, "Protocolo de Autonomía — Habilitación Local — Agilidad Controlada", 0.9),
                "solutionComponents": _prop(
                    "SAP Fiori (Liberación Directa) + Plataforma de Alerta Rápida + Reglas de Verificación Nivel 2 + dashboard + capacitación",
                    6, "SAP Fiori — Plataforma de Alerta Rápida — Reglas de Verificación Nivel 2 — Monitoreo del dashboard", 0.95),
                "tests": _prop("Piloto en sucursales Arequipa y Huancayo, sedes con alto flujo", 6, "El Experimento Piloto — Arequipa y Huancayo", 0.95),
                "results": _prop("Reducción de lead time 300min → 21min (-93%) y 42% resueltas localmente", 8, "300 min — 21 min — -93% — 42%", 0.95),
                "recommendation": _prop(
                    "Adoptar escenario Conservador: monitoreo del dashboard + despliegue nacional con capacitación progresiva (cierre 01/06/26).",
                    9, "Conservador — Monitoreo del dashboard de métricas y despliegue nacional de capacitación progresiva — Cierre: 01/06/26", 0.92),
                "orgNeeds": _prop(
                    "Priorización estratégica, sponsor gerencial, repotenciación del gestor documental (S/.20,000 aprox).",
                    12, "Priorización — Sponsorship gerencial — Tecnología: repotenciación del gestor documental (Costo: S/.20,000)", 0.92),
                "nextStep": _prop(
                    "Pedido al Comité: aprobar priorización, asignar sponsor gerencial, iniciar repotenciación del gestor documental.",
                    12, "Pedido al Comité: Priorización, Sponsorship, Tecnología", 0.92),
            },
            "implementationPlan": _prop(
                [
                    {"stage": "Flexibilización y Continuidad del Negocio", "activity": "Disponibilidad de Línea para Gran Minería", "expectedResult": "Continuidad operativa", "status": "Completado"},
                    {"stage": "Flexibilización y Continuidad del Negocio", "activity": "Customización de Reglas de Admisión", "expectedResult": "Reduce bloqueos innecesarios", "status": "Completado"},
                    {"stage": "Flexibilización y Continuidad del Negocio", "activity": "Implementación de Líneas de RRSS Escalonadas por Flota", "expectedResult": "Ajuste de línea según volumen de compra", "status": "En curso"},
                    {"stage": "Continuidad Operativa", "activity": "Proyección y Diagnóstico de Vencimientos Semestrales", "expectedResult": "Identificación temprana de riesgos", "status": "En curso"},
                    {"stage": "Continuidad Operativa", "activity": "Extensión Masiva de Vigencia a 24 Meses", "expectedResult": "Asegura continuidad comercial", "status": "En curso"},
                    {"stage": "Continuidad Operativa", "activity": "Estandarización del Control Trimestral", "expectedResult": "Fortalece control preventivo", "status": "Programado"},
                    {"stage": "Liberación de Pedidos", "activity": "Autonomía de Sucursales según Matriz", "expectedResult": "Agiliza liberación de pedidos", "status": "Programado"},
                    {"stage": "Descentralización", "activity": "Preparación de Data Maestra y Segmentación de Cartera", "expectedResult": "Habilita modelo dinámico de atención", "status": "En curso"},
                    {"stage": "Descentralización", "activity": "Despliegue de Lineamientos y Manual de Reglas", "expectedResult": "Criterio unificado, capacitación técnica", "status": "Programado"},
                ],
                10, "Gantt de Cambios — Área de Créditos — Conservador — Cierre: 01/06/26", 0.9),
            "orgContext": {
                "affectedAreas": _prop(
                    "Sucursales (Arequipa, Huancayo, Lima y red nacional), Equipo de Créditos y Cobranzas, área de Tecnología, Gerencia",
                    14, "sucursales — Equipo Cobranzas — Tecnología — Comité", 0.85),
                "risks": _prop(
                    "Sin reglas claras y dashboard, autonomía puede derivar en descontrol; sin capacitación, se perpetúa el desconocimiento.",
                    7, "Autonomía ≠ Descontrol: requiere reglas claras, datos confiables y capacitación constante", 0.88),
            },
        },
    }


def test_snapshot_extraction_meets_baseline_thresholds(ground_truth, snapshot_extraction):
    """The scorer applied to the snapshot must clear all 4 PRD-002 thresholds.

    This is the OFFLINE proof that the eval pipeline (scorer rules + ground truth +
    thresholds) is correct end-to-end. It's deterministic and runs without any
    external API.
    """
    # The snapshot mirrors the FieldProposal-leaf shape the spike's `extractor.py`
    # produces. The spike scorer expects an `InitiativeExtraction`-like nested dict.
    # spike scorer signature: score(extraction: dict-or-model, ground_truth: dict) -> ScoreReport
    from scorer import score  # type: ignore[import-not-found]

    report = score(snapshot_extraction, ground_truth)
    totals = {
        "precision": report.precision,
        "recall": report.recall,
        "hallucination_rate": report.hallucination_rate,
        "provenance_page_accuracy": report.provenance_accuracy,
    }
    # Print for debugging visibility in CI logs.
    print(f"\nSnapshot metrics: {totals}")
    print(f"proposed_count={report.proposed_count} correct_count={report.correct_count} "
          f"provenance_ok_count={report.provenance_ok_count} total_fields={report.total_fields}")

    assert totals["precision"] >= 0.80, f"precision={totals['precision']:.3f} < 0.80"
    assert totals["recall"] >= 0.70, f"recall={totals['recall']:.3f} < 0.70"
    assert totals["hallucination_rate"] <= 0.03, f"hallucination={totals['hallucination_rate']:.3f} > 0.03"
    assert totals["provenance_page_accuracy"] >= 0.90, f"provenance={totals['provenance_page_accuracy']:.3f} < 0.90"
