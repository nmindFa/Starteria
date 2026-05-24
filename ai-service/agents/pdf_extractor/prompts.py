"""Prompt registry for the pdf_extractor agent (TASK-008).

These are the EXACT prompts validated in the spike (precision 0.800, recall 0.772,
hallucination 0.000, provenance 0.964 on `docs/Test - iniciativa.pdf`).

The only spike adjustment for production is in `_STEP_SCHEMAS["step3"]`: the
`testCycles` field hint now matches the wrapped-in-FieldProposal shape from
`schemas/pdf_extraction.py` (TASK-008 §6 breaking change). Every other rule is
verbatim — modifying them invalidates the baseline.
"""

from __future__ import annotations

from typing import Any


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


# Per-Step descriptors, hints, and few-shot examples.
# TASK-008 §6 breaking change: testCycles is now wrapped in FieldProposal — the
# step3 hint and example reflect this. All other content is verbatim from spike.
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
                    {"page": 3, "quote": "6,000+ excepciones — 5h+ lead time", "confidence": 0.9},
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
                        {"page": 4, "quote": "Criterios contradictorios en SAP heredados", "confidence": 0.85},
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
            # TASK-008 §6 breaking change: testCycles wrapped in FieldProposal like instrumentacion.
            "testCycles (FieldProposal envolviendo lista: {value: [{queValidamos, metricaPrincipal, resultadoEsperado, resultadoObservado, decision, aprendizaje}, ...], provenance: [...], confidence: 0.x}). El value ES la lista; el wrapper FieldProposal es obligatorio. NO devuelvas lista pelada en raíz. CADA sub-campo de cada item de la lista SÍ es un FieldProposal {value, provenance, confidence}.",
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
            "testCycles": {
                "value": [
                    {
                        "queValidamos": {
                            "value": "Si habilitar autonomía local con SAP Fiori reduce lead time manteniendo control",
                            "provenance": [{"page": 5, "quote": "Si habilitamos a los jefes y administradores", "confidence": 0.88}],
                            "confidence": 0.88,
                        },
                        "metricaPrincipal": {
                            "value": "Lead time (min) y % de resolución local",
                            "provenance": [{"page": 8, "quote": "Reducción del Tiempo — Solicitudes resueltas localmente", "confidence": 0.95}],
                            "confidence": 0.95,
                        },
                        "resultadoObservado": {
                            "value": "300min → 21min (-93%); 42% resueltas localmente",
                            "provenance": [{"page": 8, "quote": "300 min — 21 min — -93% — 42%", "confidence": 0.95}],
                            "confidence": 0.95,
                        },
                        "decision": {
                            "value": "mantener",
                            "provenance": [{"page": 9, "quote": "Escenarios recomendados: Conservador", "confidence": 0.85}],
                            "confidence": 0.85,
                        },
                    }
                ],
                "provenance": [{"page": 8, "quote": "Impacto del experimento — 300 min → 21 min", "confidence": 0.9}],
                "confidence": 0.88,
            },
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
                    {"stage": "Continuidad Operativa", "activity": "Extensión Masiva de Vigencia a 24 Meses", "expectedResult": "Asegura continuidad comercial", "status": "En curso"},
                ],
                "provenance": [{"page": 10, "quote": "Gantt de Cambios — Área de Créditos", "confidence": 0.9}],
                "confidence": 0.85,
            },
        },
    },
}


def system_prompt(language: str) -> str:
    """Return the system prompt for the requested language (es/en)."""
    return _SYSTEM_PROMPT_ES if language == "es" else _SYSTEM_PROMPT_EN


def step_schema(step: str) -> dict[str, Any]:
    """Return the descriptor (fields + example + optional context_hint) for a step."""
    return _STEP_SCHEMAS[step]


__all__ = ["system_prompt", "step_schema"]
