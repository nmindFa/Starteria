"""LangChain PromptTemplate definitions para cada agente."""

from langchain_core.prompts import ChatPromptTemplate

from .system_prompts import SYSTEM_PROMPTS


def get_prompt_template(agent_id: str, human_template: str) -> ChatPromptTemplate:
    """Construye un ChatPromptTemplate para el agente dado.

    Args:
        agent_id: Identificador del agente (clave en SYSTEM_PROMPTS).
        human_template: Template del mensaje del usuario con variables entre llaves.

    Returns:
        ChatPromptTemplate listo para invocar.
    """
    system_prompt = SYSTEM_PROMPTS.get(agent_id, SYSTEM_PROMPTS["orchestrator"])
    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", human_template),
        ]
    )


# ---------------------------------------------------------------------------
# Human templates pre-definidos por agente
# ---------------------------------------------------------------------------

MENTOR_VIRTUAL_HUMAN = """
Revisa la siguiente descripcion de problema inicial (Step 0) del participante y
proporciona retroalimentacion estructurada.

Datos de Step 0:
- Origen del problema: {origen}
- Parte del proceso afectada: {parteProceso}
- Impacto en 3 meses: {impacto3meses}
- Respaldo/evidencia: {respaldo}
- Descripcion general: {descripcion}
- Quien se ve impactado: {quienImpacta}
- Si se resolviera al minimo: {siMinimo}

Responde con un JSON con esta estructura exacta:
{{
  "claro": ["lista de aspectos bien planteados"],
  "faltaPrecisar": ["lista de aspectos que necesitan mayor precision"],
  "preguntas": ["lista de preguntas orientadoras para el participante"],
  "siguienteAccion": "descripcion de la accion concreta que debe tomar ahora"
}}
"""

FEEDBACK_IA_HUMAN = """
Evalua el trabajo del participante en el modulo {moduleId} del paso {stepNumber}.

Datos del modulo:
{moduleData}

Emite una evaluacion formativa con este JSON exacto:
{{
  "status": "Aprobado | Iterar | Bloqueado",
  "summary": "resumen de maximo 500 caracteres",
  "goodPoints": ["aspectos positivos"],
  "missing": ["aspectos faltantes o incompletos"],
  "actions": ["acciones concretas para mejorar"],
  "questions": ["preguntas orientadoras"],
  "contradictions": ["posibles contradicciones detectadas"]
}}
"""

RESEARCH_ASSIST_HUMAN = """
A partir del siguiente analisis AS-IS del participante, genera un plan de investigacion.

Datos del modulo A:
- Caso real: {casoReal}
- Pasos del proceso: {pasos}
- Punto de quiebre: {quiebre}
- Consecuencia: {consecuencia}
- Causa inmediata: {causaInmediata}
- Alcance: {alcance}

Responde con este JSON exacto:
{{
  "objetivo": "objetivo de investigacion en una oracion",
  "temas": [
    {{"tema": "nombre del tema", "justificacion": "por que es relevante"}}
  ],
  "perfiles": [
    {{"perfil": "descripcion del perfil", "razon": "por que entrevistarlo"}}
  ],
  "guiaPreguntas": ["pregunta 1", "pregunta 2", "..."]
}}
Incluye al menos 3 temas, 2 perfiles y 5 preguntas.
"""

HMW_GENERATE_HUMAN = """
A partir de los siguientes datos de sintesis del participante, genera preguntas HMW
(Como Podriamos) variadas y accionables.

Datos de sintesis:
{synthesisData}

Responde con este JSON exacto:
{{
  "options": [
    {{"hmw": "Como podriamos...", "rationale": "por que esta reformulacion es valiosa"}}
  ]
}}
Genera al menos 3 opciones HMW distintas.
"""

IDEATE_HUMAN = """
El participante ha seleccionado el siguiente reto HMW:
"{hmw}"

Contexto del proyecto:
{context}

Genera ideas creativas y diversas para resolver este reto. Agrupa las ideas en clusters
tematicos.

Responde con este JSON exacto:
{{
  "ideas": [
    {{
      "id": "idea-001",
      "title": "titulo corto",
      "description": "descripcion de 2-3 oraciones",
      "cluster": "nombre del cluster tematico"
    }}
  ]
}}
Genera al menos 5 ideas agrupadas en al menos 2 clusters.
"""

EXPERIMENT_ROUTES_HUMAN = """
El participante ha seleccionado la siguiente idea finalista:
- ID: {idea_id}
- Titulo: {idea_title}
- Descripcion: {idea_description}

Puntuaciones DVF:
{dvfScores}

Genera rutas de experimento (hipotesis, experimento, metrica) para validar esta idea.

Responde con este JSON exacto:
{{
  "routes": [
    {{
      "hypothesis": "hipotesis a validar",
      "experiment": "descripcion del experimento a realizar",
      "metric": "metrica que define el exito"
    }}
  ]
}}
Genera al menos 2 rutas de experimento.
"""

PROTOTYPE_SUGGEST_HUMAN = """
El participante tiene el siguiente test card:
{testCard}

Sugiere componentes de prototipo, instrumentacion y consejos practicos para ejecutar
el experimento.

Responde con este JSON exacto:
{{
  "components": ["componente 1", "componente 2"],
  "instrumentation": ["instrumento de medicion 1", "instrumento 2"],
  "tips": ["consejo practico 1", "consejo 2"]
}}
"""

EXPERIMENT_ANALYZE_HUMAN = """
El participante ha ejecutado el experimento con ID: {runId}

Metricas obtenidas:
{metrics}

Evidencia recopilada:
{evidence}

Analiza los resultados y emite una recomendacion fundamentada.

Responde con este JSON exacto:
{{
  "findings": ["hallazgo 1", "hallazgo 2"],
  "recommendation": "GO | NO_GO | PIVOT",
  "rationale": "justificacion de la recomendacion en 2-4 oraciones",
  "learningCard": {{
    "keyLearning": "aprendizaje principal",
    "validatedAssumptions": ["supuesto validado"],
    "invalidatedAssumptions": ["supuesto invalidado"],
    "nextSteps": ["proximo paso"]
  }}
}}
"""

NARRATIVE_BUILD_HUMAN = """
Construye la estructura completa de presentacion para el proyecto del participante.
Audiencia objetivo: {audience}

El proyecto tiene los siguientes datos (contexto completo disponible en el sistema).

Genera exactamente 12 slides con este JSON exacto:
{{
  "slides": [
    {{
      "number": 1,
      "title": "titulo del slide",
      "keyMessage": "mensaje clave en una oracion",
      "content": "contenido detallado del slide",
      "speakerNotes": "notas para el presentador"
    }}
  ],
  "elevatorPitch": "pitch de 30 segundos (maximo 100 palabras)",
  "narrativeArc": "descripcion del arco narrativo de la presentacion"
}}
"""

NARRATIVE_FEEDBACK_HUMAN = """
El participante ha preparado el siguiente borrador de presentacion:

Slides editados:
{slides}

Notas del participante:
{notes}

Proporciona retroalimentacion de ensayo constructiva y especifica.

Responde con este JSON exacto:
{{
  "feedback": ["observacion 1", "observacion 2"],
  "suggestions": ["sugerencia concreta 1", "sugerencia concreta 2"]
}}
"""
