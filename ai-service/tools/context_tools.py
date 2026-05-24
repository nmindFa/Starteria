"""@tool functions for project context retrieval used by deepagents agents."""

from langchain.tools import tool


@tool
def get_step_rubric(step_number: int, module_id: str) -> str:
    """Obtiene la rubrica de evaluacion para un paso y modulo especifico de Starteria.

    Args:
        step_number: Numero de paso (1-4).
        module_id: Identificador del modulo (A, B, C, D).

    Returns:
        Texto de la rubrica con criterios de evaluacion para ese paso/modulo.
    """
    rubrics: dict[tuple[int, str], str] = {
        (1, "A"): (
            "Modulo A (AS-IS) - Paso 1: La descripcion debe incluir un caso real concreto "
            "(no generico), los pasos del proceso afectado, el punto de quiebre especifico, "
            "la consecuencia medible, la causa inmediata identificada y el alcance del "
            "problema. Criterios: especificidad del caso real (no puede ser hipotetico), "
            "claridad del quiebre, cuantificacion de la consecuencia."
        ),
        (1, "B"): (
            "Modulo B (Research) - Paso 1: El plan de investigacion debe definir un objetivo "
            "claro de investigacion, al menos 3 temas de investigacion con justificacion, "
            "al menos 2 perfiles de entrevistados con razon de seleccion y al menos 5 "
            "preguntas guia abiertas. Criterios: orientacion al usuario, evitar preguntas "
            "cerradas, cobertura de los temas identificados."
        ),
        (1, "C"): (
            "Modulo C (Insights) - Paso 1: Los insights deben surgir de evidencia real de "
            "investigacion, no de suposiciones. Cada insight debe conectar un patron "
            "observado con una necesidad del usuario. Criterios: respaldo en datos, "
            "claridad del patron, conexion con oportunidad de diseno."
        ),
        (1, "D"): (
            "Modulo D (Sintesis) - Paso 1: La sintesis debe integrar todos los insights "
            "en una vision cohesiva del problema. Debe incluir la perspectiva del usuario "
            "afectado y una reformulacion del problema como oportunidad. Criterios: "
            "integracion de insights, centrado en el usuario, claridad de la oportunidad."
        ),
        (2, "A"): (
            "Modulo A (HMW) - Paso 2: Las preguntas HMW deben ser suficientemente amplias "
            "para generar multiples soluciones pero suficientemente concretas para enfocar "
            "la ideacion. Deben derivar directamente de la sintesis del Paso 1. "
            "Criterios: amplitud adecuada, conexion con sintesis, orientacion a solucion."
        ),
        (2, "B"): (
            "Modulo B (Ideacion) - Paso 2: Las ideas deben ser diversas, creativas y "
            "agruparse en clusters tematicos. Minimo 5 ideas en al menos 2 clusters. "
            "Criterios: cantidad y diversidad de ideas, calidad de los clusters, "
            "viabilidad potencial."
        ),
        (2, "C"): (
            "Modulo C (DVF) - Paso 2: La evaluacion DVF debe aplicarse a las ideas "
            "finalistas con criterios de Deseabilidad, Viabilidad y Factibilidad. "
            "Cada dimension debe tener justificacion. Criterios: consistencia de la "
            "evaluacion, justificacion de puntajes, seleccion fundamentada."
        ),
        (2, "D"): (
            "Modulo D (Test Card) - Paso 2: El test card debe especificar la hipotesis "
            "a validar, el experimento a realizar, la metrica de exito y el criterio de "
            "decision Go/No-Go. Criterios: claridad de la hipotesis, especificidad del "
            "experimento, metrica medible, umbral de decision claro."
        ),
        (3, "A"): (
            "Modulo A (Prototipo) - Paso 3: El prototipo debe ser del nivel de fidelidad "
            "adecuado para validar la hipotesis del test card. Debe incluir los componentes "
            "minimos necesarios. Criterios: fidelidad apropiada, cobertura de componentes "
            "criticos, viabilidad de construccion."
        ),
        (3, "B"): (
            "Modulo B (Ejecucion) - Paso 3: El registro de ejecucion del experimento debe "
            "incluir metricas reales medidas, evidencia recopilada y observaciones del "
            "proceso. Criterios: completitud de datos, calidad de la evidencia, "
            "fidelidad al protocolo del test card."
        ),
        (3, "C"): (
            "Modulo C (Analisis) - Paso 3: El analisis debe comparar los resultados con "
            "la hipotesis original y emitir una recomendacion Go/No-Go/Pivot fundamentada. "
            "Debe incluir aprendizajes y proximos pasos. Criterios: rigor del analisis, "
            "fundamentacion de la recomendacion, calidad del learning card."
        ),
        (4, "A"): (
            "Modulo A (Narrativa) - Paso 4: La narrativa debe contar la historia de "
            "innovacion de manera cohesiva para la audiencia objetivo. Los 12 slides deben "
            "tener un arco narrativo claro. Criterios: coherencia narrativa, adaptacion "
            "a la audiencia, impacto del elevator pitch."
        ),
    }

    key = (step_number, module_id)
    rubric = rubrics.get(key)
    if rubric:
        return rubric
    return (
        f"Rubrica generica para Paso {step_number} Modulo {module_id}: "
        "Evalua completitud, coherencia interna, alineacion con el objetivo del modulo, "
        "especificidad de los datos provistos y viabilidad de las conclusiones."
    )


@tool
def get_agent_routing_hint(step: int, action: str, module: str | None = None) -> str:
    """Determina que agente especializado debe manejar una solicitud dada.

    Args:
        step: Numero de paso (0-4).
        action: Accion solicitada (feedback, assist, generate, etc.).
        module: Identificador del modulo opcional (A, B, C, D).

    Returns:
        Nombre del agente especializado recomendado.
    """
    if action == "feedback":
        return "feedback-ia"
    if step == 0:
        return "mentor-virtual"
    if step == 1 and module == "B":
        return "research-assistant"
    if step == 2:
        routing = {
            "hmw-generate": "solution-design",
            "ideate": "solution-design",
            "experiment-routes": "solution-design",
        }
        return routing.get(action, "solution-design")
    if step == 3:
        routing = {
            "prototype-suggest": "experiment-coach",
            "experiment-analyze": "experiment-coach",
        }
        return routing.get(action, "experiment-coach")
    if step == 4:
        routing = {
            "narrative-build": "narrative-builder",
            "narrative-feedback": "narrative-builder",
        }
        return routing.get(action, "narrative-builder")
    return "feedback-ia"


@tool
def get_step_description(step: int) -> str:
    """Obtiene la descripcion del paso de la metodologia Starteria.

    Args:
        step: Numero de paso (0-4).

    Returns:
        Descripcion del paso y sus modulos.
    """
    descriptions: dict[int, str] = {
        0: (
            "Paso 0 - Definicion del Problema: El participante define el problema de "
            "innovacion que quiere resolver. Incluye origen, parte del proceso afectada, "
            "impacto, respaldo, descripcion, quien se ve impactado y el valor minimo "
            "de resolver el problema."
        ),
        1: (
            "Paso 1 - Investigacion: Cuatro modulos: A=AS-IS (mapeo del proceso actual), "
            "B=Research (plan de investigacion con usuarios), C=Insights (patrones y "
            "necesidades identificadas), D=Sintesis (vision cohesiva del problema)."
        ),
        2: (
            "Paso 2 - Diseno de Solucion: Cuatro modulos: A=HMW (preguntas Como Podriamos), "
            "B=Ideacion (generacion y clustering de ideas), C=DVF (evaluacion de ideas), "
            "D=Test Card (diseno del experimento de validacion)."
        ),
        3: (
            "Paso 3 - Experimentacion: Tres modulos: A=Prototipo (construccion del "
            "prototipo), B=Ejecucion (registro del experimento), C=Analisis (Go/No-Go/Pivot)."
        ),
        4: (
            "Paso 4 - Narrativa: Un modulo: A=Presentacion (12 slides con arco narrativo, "
            "elevator pitch y notas para el presentador, adaptados a la audiencia objetivo)."
        ),
    }
    return descriptions.get(step, f"Paso {step}: descripcion no disponible.")
