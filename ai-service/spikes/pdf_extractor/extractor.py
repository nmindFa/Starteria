"""LangChain agent: PDF page blocks → InitiativeExtraction with provenance.

Single-shot per Step against the full PDF text (the spike doc is 14pp so it fits easily).
Uses ChatOpenAI configured with OpenRouter base_url + DeepSeek model and `response_format=json_object`.
Mirrors the JSON-extract-with-regex-fallback pattern from `agents/mentor_virtual.py`.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import ValidationError

from spikes.pdf_extractor.parser import PageBlock
from spikes.pdf_extractor.schemas import (
    ExtractionMetadata,
    InitiativeExtraction,
    Step0Extraction,
    Step1Extraction,
    Step2Extraction,
    Step3Extraction,
    Step4Extraction,
)

logger = logging.getLogger(__name__)

_DEFAULT_MODEL = "deepseek/deepseek-chat"
_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"

_SPIKE_DIR = Path(__file__).parent
load_dotenv(_SPIKE_DIR / ".env")


_SYSTEM_PROMPT_ES = """Eres un extractor experto de información estructurada desde PDFs de iniciativas Starteria (metodología BHIL).
Tu única tarea es leer el contenido completo del PDF y proponer valores para los campos del Step indicado, en formato JSON.

CONTEXTO IMPORTANTE: el PDF que recibes es típicamente una presentación EJECUTIVA COMPLETA de una iniciativa real (problema → hipótesis → experimento piloto → resultados → recomendación → pedido al comité). Por tanto, espera encontrar evidencia para LA MAYORÍA de los campos del Step indicado. Sé proactivo: si una página describe el piloto ejecutado, eso ES evidencia para Step 3; si la última página pide al comité, eso ES Step 4 audience/closureType. NO te limites a quotes literales que repiten el nombre del campo — SINTETIZA cuando una sección entera describe un campo (p.ej. el valor de "implementationPlan" es la tabla Gantt completa; el valor de "evidence" agrega métricas de varias páginas).

REGLAS DURAS (no negociables):
1. Si un campo NO tiene evidencia en el PDF, omítelo. Si tiene evidencia parcial o sintetizable, PROPÓNLO.
2. Para CADA campo propuesto, incluye provenance como lista (puede tener varias entradas si la evidencia abarca varias páginas):
   - "page": entero (≥1),
   - "quote": cadena ≤280 chars copiada LITERALMENTE del PDF (sin parafrasear),
   - "confidence": número entre 0.0 y 1.0.
3. Sólo propone valores con confidence ≥ 0.55. Sé moderadamente generoso; el usuario revisará y confirmará/editará.
4. Estructura de cada propuesta: {"value": <valor>, "provenance": [{"page": N, "quote": "...", "confidence": 0.x}, ...], "confidence": 0.x}.
5. El "value" puede ser string, número, lista de strings, lista de objetos, o objeto — usa la forma que indique el campo.
6. Devuelve UN ÚNICO objeto JSON válido. Sin markdown, sin ```json, sin texto fuera del JSON.
7. Para campos de SÍNTESIS narrativa (casoReal, problem, urgency, etc.): el "value" debe ser TU redacción sintetizada en 1-3 frases que integre lo que el PDF muestra, NO una cita textual. La cita textual va en "quote".
8. Para campos enum: el "value" debe ser EXACTAMENTE una de las opciones declaradas (sin variantes).
9. Para listas de objetos (implementationPlan, instrumentacion, testCycles): el "value" es la lista completa con todos los items extraíbles del PDF.
10. Para campos de SÍNTESIS narrativa (problem, urgency, evidence, casoReal, consecuencia, quiebreDetalle, etc.): INCLUYE en tu redacción los NÚMEROS, PORCENTAJES y MÉTRICAS clave del PDF (p.ej. "6,000+ excepciones", "5h+", "-93%", "42%", "300min→21min", montos en S/.). Estos números son evidencia crítica.
11. Para listas de aprendizajes/learnings: PRESERVA el LABEL/título de cada bullet del deck (p.ej. "Capacidad Local: <descripción>", "Autonomía ≠ Descontrol: <descripción>"), no sólo el cuerpo.
12. Para implementationPlan/Gantt: si el deck contiene una TABLA Gantt, extrae TODAS sus filas (≥8 típicamente), una por objeto con stage/activity/expectedResult/status. NO devuelvas solo las recomendaciones de alto nivel (Conservador/Moderado) — esas no son el plan; el plan es la tabla detallada en la página 'Gantt de Cambios' o similar."""


_SYSTEM_PROMPT_EN = """You are an expert structured-extraction agent for Starteria initiative PDFs (BHIL methodology).
Your only task is to read the full PDF content and propose values for the fields of the indicated Step, in JSON.

HARD RULES (non-negotiable):
1. If a field has no clear evidence in the PDF, OMIT it from the JSON. Do not fabricate values.
2. For EVERY proposed field, include provenance with:
   - "page": integer (page number where evidence lives, ≥1),
   - "quote": string ≤280 chars copied VERBATIM from the PDF (do not paraphrase),
   - "confidence": number between 0.0 and 1.0.
3. Only propose values with confidence ≥ 0.60. If your confidence is lower, omit the field.
4. Proposal shape: {"value": <value>, "provenance": [{"page": N, "quote": "...", "confidence": 0.x}], "confidence": 0.x}.
5. Return ONE valid JSON object. No text outside the JSON. No markdown, no ```json fences.
6. If a Step is absent from the PDF, return {} (empty object)."""


_STEP_SCHEMAS: dict[str, dict[str, Any]] = {
    "step0": {
        "fields": [
            "nombreParticipante (string) — co-líder o sponsor presentando la iniciativa (usualmente en la diapositiva de equipo/última página)",
            "rolArea (string) — rol y área del co-líder (p.ej. 'Sub Gerente Créditos / Sucursales — Unimaq')",
            "origen (enum: 'problema'|'oportunidad'|'idea'|'explorando'|'otra') — si el deck habla de un 'Reto' o 'Desafío' = 'problema'",
            "quePasaQueQuieres (string_long, 80-400 chars) — SÍNTESIS narrativa del problema observado + objetivo de la iniciativa, integrando reto, hipótesis y resultado deseado",
            "impacta (list of strings) — áreas afectadas. Selecciona TODAS las que apliquen de: ['Clientes externos','Operaciones','Ventas','Postventa','Finanzas','TI','Gerencias','Otros']",
            "parteProceso (enum: 'antes'|'durante'|'despues'|'transversal'|'otra') — si el problema ocurre durante la operación de venta/crédito = 'durante'",
            "impacto3meses (enum: 'ingresos'|'costos'|'riesgo'|'cliente'|'productividad'|'no_claro'|'otro')",
            "respaldo (enum: 'datos'|'testimonios'|'benchmark'|'hipotesis'|'otro') — si la presentación incluye métricas cuantitativas (#excepciones, %, tiempos) = 'datos'",
            "quienEscuchar (string) — roles/perfiles operativos cuya voz importa (no los co-líderes ni sponsors; busca jefes de oficina, administradores, equipo afectado)",
        ],
        "example": {
            "origen": {
                "value": "problema",
                "provenance": [{"page": 3, "quote": "El Reto: Rigidez Operativa — 6,000+ excepciones", "confidence": 0.92}],
                "confidence": 0.92,
            },
            "quePasaQueQuieres": {
                "value": "Las sucursales no pueden resolver excepciones de crédito localmente: dependen de autorización desde Lima, generando 6,000+ excepciones/año y 5h+ lead time que detiene la operatividad del cliente.",
                "provenance": [
                    {"page": 2, "quote": "necesitamos esperar la autorización desde Lima", "confidence": 0.9},
                    {"page": 3, "quote": "6,000+ excepciones — 5h+ lead time", "confidence": 0.9}
                ],
                "confidence": 0.88,
            },
        },
    },
    "step1": {
        "fields": [
            "asisData.casoReal (string_long) — SÍNTESIS narrativa del caso AS-IS: cliente/situación, qué pasa hoy, dónde se atasca. Integra contexto del reto + el quote del cliente si existe",
            "asisData.quiebre (string, 1 frase) — el momento/paso donde se detiene el flujo (típicamente lo que el deck llama 'cuello de botella' o lo que el cliente protesta)",
            "asisData.quiebreDetalle (string_long) — descripción estructural del quiebre: por qué pasa, qué causas sistémicas hay (busca en 'Desafíos detectados', 'Reglas Sistémicas', 'Dependencia Central')",
            "asisData.consecuencia (string_long) — qué pasa cuando ocurre el quiebre: integra impacto operativo + económico + humano (saturación, lead time, # excepciones)",
            "asisData.consequenceTags (list of strings) — TODAS las dimensiones que apliquen, de ['operativa','economica','humana','estrategica']. Si hay carga al equipo = 'humana'. Si afecta operación = 'operativa'. Si bloquea ingresos/clientes = 'economica'",
            "asisData.causaInmediata (string) — causa raíz mencionada en el deck (p.ej. 'reglas heredadas en SAP + centralización en Lima')",
            "asisData.evidenciaTipo (enum: 'dato'|'ticket'|'testimonio'|'benchmark') — si hay métricas cuantitativas (#, %, h) = 'dato'",
            "asisData.evidenciaNota (string) — cita de la métrica más fuerte: '6,000+ excepciones en 2025 con 5h+ lead time'",
            "asisData.alcance (enum: 'antes'|'durante'|'después'|'transversal')",
            "cData.limitesChips (list of strings) — restricciones/MUSTs no negociables: 'no comprometer riesgo financiero', 'reglas claras', 'control corporativo', 'capacitación constante'",
            "cData.dependencia (string) — sistemas/equipos de los que depende la solución (SAP, equipo de Lima, gobierno central)",
            "cData.alternativaPiloto (string_long) — descripción del piloto ejecutado: dónde (sedes), con qué herramientas (SAP Fiori, Plataforma de Alerta, Reglas Nivel 2)",
        ],
        "example": {
            "asisData": {
                "quiebre": {
                    "value": "Esperar autorización desde Lima",
                    "provenance": [{"page": 2, "quote": "necesitamos esperar la autorización desde Lima", "confidence": 0.95}],
                    "confidence": 0.95,
                },
                "casoReal": {
                    "value": "Un cliente con urgencia llega a la sucursal a liberar un crédito; el sistema SAP bloquea por reglas heredadas; el ejecutivo escala a Lima y la autorización tarda 5h+, deteniendo la operativa.",
                    "provenance": [
                        {"page": 2, "quote": "necesitamos esperar la autorización desde Lima", "confidence": 0.9},
                        {"page": 4, "quote": "Criterios contradictorios en SAP heredados", "confidence": 0.85}
                    ],
                    "confidence": 0.87,
                },
            }
        },
    },
    "step2": {
        "fields": [
            "hmw (string_long) — REFORMULA la hipótesis del deck como pregunta '¿Cómo podríamos / Cómo habilitamos...?'. NO uses la pregunta retórica final del deck; usa la hipótesis (sección 'Nuestra Hipótesis')",
            "testCard.hipotesis (string_long) — la hipótesis literal del deck en formato 'Si X entonces Y' (sección 'Habilitación Local + Agilidad Controlada')",
            "testCard.queTestan (string) — qué se prueba: 'viabilidad del modelo' o similar",
            "testCard.conQuien (string) — con qué actores/sedes se prueba (sucursales mencionadas)",
            "testCard.dondeCuando (string) — sedes específicas + cuándo (típicamente 'sedes con alto flujo')",
            "testCard.metodo (string) — herramientas y procesos usados en el piloto (busca 'Herramientas Utilizadas')",
            "testCard.metrica (string) — métricas de éxito principales (lead time, % resolución local, etc.)",
        ],
        "example": {
            "hmw": {
                "value": "¿Cómo habilitamos a los jefes y administradores de sucursal con criterios claros, capacitación y herramientas para resolver excepciones de forma rápida y segura, sin comprometer la gestión del riesgo financiero?",
                "provenance": [{"page": 5, "quote": "Si habilitamos a los jefes y administradores con criterios claros, capacitación y herramientas... podrán resolver excepciones de forma rápida y segura, sin comprometer la gestión del riesgo financiero.", "confidence": 0.92}],
                "confidence": 0.92,
            }
        },
    },
    "step3": {
        "fields": [
            "formatoExp (enum) — si el deck describe un piloto en sedes operativas reales = 'Piloto operativo'. Opciones: 'Formulario'|'Landing'|'WhatsApp'|'Prototipo'|'Concierge'|'Piloto operativo'",
            "logistica.donde (string) — sedes/locaciones donde corrió el piloto (busca 'Arequipa', 'Huancayo', etc.)",
            "instrumentacion (FieldProposal envolviendo lista: {value: [{dato, metricaExito, fuente}, ...], provenance: [...], confidence: 0.x}). El value ES la lista; el wrapper FieldProposal es obligatorio. NO devuelvas una lista pelada en raíz para este campo.",
            "testCycles (list de objetos — IMPORTANTE: NO lo envuelvas en FieldProposal; es directamente una LISTA en la raíz). Cada objeto tiene sub-campos { queValidamos, metricaPrincipal, resultadoEsperado, resultadoObservado, decision (enum 'mantener'|'iterar'|'pivotear'|'detener'), aprendizaje } — y CADA sub-campo SÍ es un FieldProposal {value, provenance, confidence}. Ver ejemplo.",
            "goNoGo (enum: 'Go'|'Iterar'|'No-Go'|'Pivote') — si el deck recomienda escalar/desplegar = 'Go'",
            "aprendizajes (list of strings) — los 'Aprendizajes Clave' del deck, uno por bullet",
            "diagnostico.senales (list of strings) — señales numéricas observadas (p.ej. '-93% reducción tiempo', '42% resolución local')",
        ],
        "context_hint": "**IMPORTANTE**: este deck describe un PILOTO YA EJECUTADO con resultados concretos. Espera encontrar Step 3 completo: formatoExp='Piloto operativo', logistica.donde={sedes piloto}, resultados numéricos en página de 'Impacto del experimento', aprendizajes en 'Aprendizajes Clave', decisión en 'Escenarios recomendados'. NO omitas Step 3.",
        "example": {
            "formatoExp": {
                "value": "Piloto operativo",
                "provenance": [{"page": 6, "quote": "El Experimento Piloto — Arequipa y Huancayo", "confidence": 0.95}],
                "confidence": 0.95,
            },
            "goNoGo": {
                "value": "Go",
                "provenance": [{"page": 9, "quote": "Escenarios recomendados: Conservador (Optimizar)", "confidence": 0.85}],
                "confidence": 0.85,
            },
            "testCycles": [
                {
                    "queValidamos": {
                        "value": "Si habilitar autonomía local con SAP Fiori reduce lead time manteniendo control",
                        "provenance": [{"page": 5, "quote": "Si habilitamos a los jefes y administradores", "confidence": 0.88}],
                        "confidence": 0.88
                    },
                    "metricaPrincipal": {
                        "value": "Lead time (min) y % de resolución local",
                        "provenance": [{"page": 8, "quote": "Reducción del Tiempo — Solicitudes resueltas localmente", "confidence": 0.95}],
                        "confidence": 0.95
                    },
                    "resultadoObservado": {
                        "value": "300min → 21min (-93%); 42% resueltas localmente",
                        "provenance": [{"page": 8, "quote": "300 min — 21 min — -93% — 42%", "confidence": 0.95}],
                        "confidence": 0.95
                    },
                    "decision": {
                        "value": "mantener",
                        "provenance": [{"page": 9, "quote": "Escenarios recomendados: Conservador", "confidence": 0.85}],
                        "confidence": 0.85
                    }
                }
            ],
        },
    },
    "step4": {
        "fields": [
            "audience (enum: 'Sponsor'|'Gerencia'|'Comite'|'Equipo operativo'|'Area duena') — si hay sección 'Pedido al Comité' = 'Comite'",
            "meetingGoal (string) — qué se pide al receptor (aprobación, sponsorship, presupuesto)",
            "decision (enum: 'Go'|'Iterar'|'Pivote'|'No-Go') — recomendación del deck: si pide escalar/desplegar = 'Go'",
            "closureType (enum: 'Implementar'|'Iterar'|'Pivotear'|'Solo aprendizajes') — si escenario recomendado es 'Conservador (Optimizar)' o 'Implementar/Despliegue' = 'Implementar'; si 'Reingeniería' = 'Iterar' o 'Pivotear'",
            "presentation.problem (string_long) — síntesis del problema en 1-2 frases para audiencia ejecutiva",
            "presentation.urgency (string_long) — por qué importa AHORA",
            "presentation.evidence (string_long) — AGREGA todas las métricas cuantitativas del PDF (excepciones, lead time, %, antes/después)",
            "presentation.proposal (string_long) — síntesis de la propuesta",
            "presentation.solutionComponents (string_long) — herramientas + procesos clave",
            "presentation.tests (string) — descripción del piloto (sedes, foco)",
            "presentation.results (string_long) — resultados numéricos del experimento",
            "presentation.recommendation (string_long) — qué escenario se recomienda y por qué",
            "presentation.orgNeeds (string_long) — qué necesita la organización para implementar (priorización, sponsor, presupuesto)",
            "presentation.nextStep (string_long) — próximo paso solicitado al comité",
            "implementationPlan (FieldProposal envolviendo lista: {value: [{stage, activity, expectedResult, status}, ...], provenance: [...], confidence: 0.x}). El value ES la lista con TODAS las filas Gantt; el wrapper FieldProposal es obligatorio. NO devuelvas lista pelada en raíz.",
            "orgContext.affectedAreas (string) — áreas/equipos impactados por la implementación (sucursales, créditos, tecnología, gerencia)",
            "orgContext.risks (string_long) — riesgos organizacionales del despliegue (autonomía → descontrol si faltan reglas)",
        ],
        "context_hint": "**IMPORTANTE**: este PDF ES la presentación al Comité (Step 4 deliverable). audience='Comite', closureType='Implementar' si recomienda Conservador. La tabla Gantt (si existe) ES el implementationPlan completo — extrae TODAS las filas.",
        "example": {
            "audience": {
                "value": "Comite",
                "provenance": [{"page": 12, "quote": "Pedido al Comité", "confidence": 0.95}],
                "confidence": 0.95,
            },
            "decision": {
                "value": "Go",
                "provenance": [{"page": 9, "quote": "Escenarios recomendados: 1. Conservador (Optimizar)", "confidence": 0.88}],
                "confidence": 0.88,
            },
            "implementationPlan": {
                "value": [
                    {"stage": "Flexibilización", "activity": "Disponibilidad de Línea para Gran Minería", "expectedResult": "Continuidad operativa", "status": "Completado"},
                    {"stage": "Continuidad Operativa", "activity": "Extensión Masiva de Vigencia a 24 Meses", "expectedResult": "Asegura continuidad comercial", "status": "En curso"}
                ],
                "provenance": [{"page": 10, "quote": "Gantt de Cambios — Área de Créditos", "confidence": 0.9}],
                "confidence": 0.85,
            },
        },
    },
}


def _build_full_text(blocks: list[PageBlock]) -> str:
    parts: list[str] = []
    for b in blocks:
        if b.char_count == 0:
            continue
        parts.append(f"\n\n=== PÁGINA {b.page} ===\n\n{b.text}")
    return "".join(parts).strip()


def _extract_json(content: str) -> dict[str, Any]:
    """Tolerant JSON parser: literal load → regex first-object fallback (mirrors mentor_virtual)."""
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


def _build_user_message(step: str, full_text: str, schema: dict[str, Any]) -> str:
    field_list = "\n".join(f"  - {f}" for f in schema["fields"])
    example = json.dumps(schema["example"], ensure_ascii=False, indent=2)
    hint = schema.get("context_hint", "")
    hint_block = f"\n\n{hint}\n" if hint else ""
    return (
        f"Extrae los campos del **{step}** del siguiente PDF de iniciativa.{hint_block}\n\n"
        f"Campos esperados (propone tantos como tengan evidencia razonable, no sólo los obvios):\n{field_list}\n\n"
        f"Ejemplos de campos bien formados (NO los incluyas literales — son guías de estructura):\n```json\n{example}\n```\n\n"
        f"Devuelve un objeto JSON con la forma de **{step}** (sin envolver en otro objeto, sin la clave '{step}' encima). "
        f"Cada campo propuesto debe llevar provenance como en el ejemplo.\n\n"
        f"=== CONTENIDO DEL PDF ===\n{full_text}\n=== FIN ==="
    )


def _build_llm() -> ChatOpenAI:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not set. Place it in spikes/pdf_extractor/.env")
    model = os.getenv("OPENROUTER_MODEL", _DEFAULT_MODEL)
    base_url = os.getenv("OPENROUTER_BASE_URL", _DEFAULT_BASE_URL)
    return ChatOpenAI(
        base_url=base_url,
        model=model,
        api_key=api_key,
        temperature=0.1,
        max_tokens=4000,
        model_kwargs={"response_format": {"type": "json_object"}},
    )


_STEP_VALIDATORS = {
    "step0": Step0Extraction,
    "step1": Step1Extraction,
    "step2": Step2Extraction,
    "step3": Step3Extraction,
    "step4": Step4Extraction,
}


def _tolerant_validate(validator: Any, parsed: dict[str, Any], step: str) -> Any:
    """Validate field-by-field; drop fields that fail individually so the rest survive.

    LLMs often confuse the FieldProposal wrapper for list/object fields. Rather than discarding
    the whole Step extraction on a single validation error, drop only the offending fields.
    """
    if not isinstance(parsed, dict):
        logger.warning("Step %s: parsed is not a dict, got %s", step, type(parsed).__name__)
        return validator()

    # Strategy: try the full payload; on failure, peel offending fields off and retry.
    payload = {k: v for k, v in parsed.items() if k in validator.model_fields}
    max_peel_iterations = 8
    for _ in range(max_peel_iterations):
        try:
            return validator.model_validate(payload)
        except ValidationError as exc:
            offenders = {err["loc"][0] for err in exc.errors() if err.get("loc")}
            if not offenders or not any(o in payload for o in offenders):
                logger.warning("Step %s validation has unrecoverable error: %s", step, exc.errors()[:2])
                break
            for top_field in offenders:
                if top_field in payload:
                    logger.info("Step %s: dropping field %r due to validation error", step, top_field)
                    payload.pop(top_field, None)

    # All else failed — return empty validator instance.
    try:
        return validator.model_validate(payload)
    except ValidationError:
        return validator()


def _call_step(llm: ChatOpenAI, step: str, full_text: str, language: str) -> tuple[Any, int, dict[str, int]]:
    system_prompt = _SYSTEM_PROMPT_ES if language == "es" else _SYSTEM_PROMPT_EN
    user_msg = _build_user_message(step, full_text, _STEP_SCHEMAS[step])
    started = time.monotonic()

    try:
        response = llm.invoke([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ])
    except Exception as exc:  # noqa: BLE001
        logger.error("LLM call failed for %s: %s", step, exc)
        return _STEP_VALIDATORS[step](), int((time.monotonic() - started) * 1000), {}

    raw = response.content if isinstance(response.content, str) else str(response.content)
    # Debug: dump raw responses to /tmp for post-mortem (gitignored, low cost)
    try:
        debug_dir = Path("/tmp/pdf_extractor_debug")
        debug_dir.mkdir(exist_ok=True)
        (debug_dir / f"{step}_raw.json").write_text(raw, encoding="utf-8")
    except Exception:  # noqa: BLE001
        pass
    parsed = _extract_json(raw)

    validator = _STEP_VALIDATORS[step]
    validated = _tolerant_validate(validator, parsed, step)

    duration_ms = int((time.monotonic() - started) * 1000)
    usage = getattr(response, "usage_metadata", None) or {}
    tokens = {
        "input": int(usage.get("input_tokens", 0)) if isinstance(usage, dict) else 0,
        "output": int(usage.get("output_tokens", 0)) if isinstance(usage, dict) else 0,
    }
    logger.info("Step %s extracted in %dms (tokens in=%d out=%d)",
                step, duration_ms, tokens["input"], tokens["output"])
    return validated, duration_ms, tokens


def extract(blocks: list[PageBlock], language: str) -> InitiativeExtraction:
    """Run a full Step0-Step4 extraction and assemble the InitiativeExtraction."""
    llm = _build_llm()
    model_name = llm.model_name if hasattr(llm, "model_name") else getattr(llm, "model", _DEFAULT_MODEL)
    full_text = _build_full_text(blocks)
    if not full_text:
        raise RuntimeError("No extractable text in PDF blocks; cannot run extraction.")

    started_at = datetime.utcnow().isoformat()
    started = time.monotonic()
    per_step_ms: dict[str, int] = {}
    per_step_tokens: dict[str, dict[str, int]] = {}

    extracted: dict[str, Any] = {}
    for step in ("step0", "step1", "step2", "step3", "step4"):
        value, ms, tokens = _call_step(llm, step, full_text, language)
        extracted[step] = value
        per_step_ms[step] = ms
        per_step_tokens[step] = tokens

    finished_at = datetime.utcnow().isoformat()
    duration_ms = int((time.monotonic() - started) * 1000)

    metadata = ExtractionMetadata(
        model=str(model_name),
        language=language,
        pages=len(blocks),
        started_at=started_at,
        finished_at=finished_at,
        duration_ms=duration_ms,
        per_step_ms=per_step_ms,
        per_step_tokens=per_step_tokens,
    )

    return InitiativeExtraction(
        step0=extracted["step0"],
        step1=extracted["step1"],
        step2=extracted["step2"],
        step3=extracted["step3"],
        step4=extracted["step4"],
        extraction_metadata=metadata,
    )
