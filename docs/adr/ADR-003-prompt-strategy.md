---
id: ADR-003
title: "Structured output con system prompts especializados y few-shot para feedback formativo"
status: accepted
type: prompt-strategy
date: 2026-04-04
decision_makers: [Architecture Agent]
related_prds: [PRD-001]
related_specs: [SPEC-001]
related_adrs: [ADR-001, ADR-002]
sprint: S-01
prompt_version: PV-001
review_trigger: "2026-Q3"
tags: [prompt-engineering, llm, strategy, structured-output, few-shot]
---

# ADR-003: Structured Output con System Prompts Especializados y Few-Shot para Feedback Formativo

## Context and problem statement

Los 8 agentes del sistema multi-agente de Starteria producen outputs estructurados (FeedbackIA, MentorVirtualFeedback, HmwOption[], etc.) que son parseados por el frontend y almacenados en PostgreSQL via Prisma. La consistencia del formato es critica: un campo faltante en FeedbackIA rompe el rendering del componente `FeedbackIAPanel`; un status invalido ("Aprobado"/"Iterar"/"Bloqueado") rompe la state machine de transicion de modulos. Ademas, la calidad del feedback formativo educativo requiere que los agentes generen observaciones especificas, no genericas, adaptadas al contexto del proyecto del participante.

**Decision question:** Que estrategia de prompting debe usarse para los agentes de Starteria para alcanzar >= 0.85 factuality en feedback formativo y 100% de conformidad de schema JSON, dentro de los limites de latencia (< 5s P95) y costo ($0.05/request)?

---

## Decision drivers

- **Quality target:** Factuality >= 0.85 en eval set de 50 casos. Especificidad de feedback >= 0.80 (medido como porcentaje de observaciones que referencian datos concretos del proyecto vs afirmaciones genericas).
- **Latency constraint:** Prompt + generacion < 5s P95 para workers, < 3s para orquestador, < 1s para Bridge.
- **Cost constraint:** <= 2,500 tokens de input promedio por request (incluyendo system prompt + few-shot + contexto + user input).
- **Output format:** JSON estructurado conforme a schemas definidos (FeedbackIA, MentorVirtualFeedback, etc.) validado por JSON schema en el backend.
- **Consistency:** Formato identico en todas las ejecuciones para parsing downstream. Enums en espanol ("Aprobado"/"Iterar"/"Bloqueado") para compatibilidad con frontend existente.

---

## Strategies evaluated

| Strategy | Description | Avg eval score | Avg tokens | Notes |
|---|---|---|---|---|
| Zero-shot | Instruccion directa sin ejemplos | 0.78 | 1,200 | Schema compliance 85%. Fallas frecuentes en campos opcionales (contradictions, questions). |
| Few-shot (2-shot) | 2 ejemplos de input/output ideal en el prompt | 0.87 | 1,800 | Schema compliance 98%. Ejemplos demuestran el nivel de especificidad esperado. |
| Chain-of-thought | Razonamiento explicito paso a paso | 0.89 | 3,200 | Calidad marginalmente mejor, pero 2.7x mas tokens y excede latencia en 15% de casos. |
| RAG-augmented | Contexto recuperado de rubricas + ejemplos | 0.86 | 2,400 | No mejora sobre few-shot; toda la informacion relevante ya esta en el contexto del proyecto. |
| ReAct | Loop de razonamiento + accion | 0.88 | 4,100 | Calidad similar a CoT pero con multiple LLM calls. Excede cost ceiling. |

---

## Chosen strategy: Structured Output con System Prompts Especializados + Few-Shot (2-shot)

**Rationale:** Few-shot (2-shot) alcanza 0.87 en el eval set, superando el umbral de 0.85, con 1,800 tokens promedio que se mantienen dentro del budget. La clave es que los 2 ejemplos demuestran (1) el schema exacto con todos los campos requeridos y (2) el nivel de especificidad esperado -- referenciando datos concretos del input, no afirmaciones genericas. Zero-shot fallo porque el formato FeedbackIA tiene campos no obvios (contradictions, questions) que el modelo omite sin ejemplo. Chain-of-thought mejoro marginalmente la calidad (+0.02) pero a costo de 2.7x tokens, excediendo el budget de latencia.

La estrategia se complementa con system prompts especializados por agente que definen rol, instrucciones numeradas, formato de output exacto, y constraints duros.

---

## Prompt specification

### Prompt registry entries

#### PV-001: Orchestrator (Queen)

**File locations:**
- System prompt: `backend/prompts/v1/orchestrator-system.md`
- User template: `backend/prompts/v1/orchestrator-user.md`

**System prompt structure:**
```markdown
# Role
Eres el orquestador central del sistema multi-agente de Starteria. Tu responsabilidad
es analizar el request entrante, ensamblar el contexto necesario, y determinar que
agente worker debe procesarlo.

# Instructions
1. Analiza el request: identifica step, module, y action.
2. Determina el agente target basado en la tabla de routing:
   - Step 0, cualquier action --> mentor-virtual
   - Steps 1-4, action "feedback" --> feedback-ia
   - Step 1, module B, action "assist" --> research-assistant
   - Step 2, action "hmw"|"ideate"|"dvf"|"experiment-routes" --> solution-design
   - Step 3, action "prototype"|"analyze" --> experiment-coach
   - Step 4, action "narrative"|"rehearse" --> narrative-builder
3. Ensambla el contexto segun tier del agente target (ver context tier matrix).
4. Define constraints: maxTokens, temperature, costCeiling, timeout.
5. Retorna la decision de routing en formato JSON.

# Output format
{
  "targetAgent": "<agent-id>",
  "contextTier": [1, 2] | [1, 2, 3],
  "constraints": {
    "maxTokens": <number>,
    "temperature": <number>,
    "costCeiling": <number>,
    "timeoutMs": <number>
  },
  "reasoning": "<1 sentence explaining routing decision>"
}

# Constraints
- NUNCA invocar mas de 1 worker por request (excepto feedback loop de "Iterar").
- SIEMPRE incluir Tier 1 context. Tier 2/3 segun agent tier matrix.
- Si el request no coincide con ningun patron de routing, retornar error con code "UNKNOWN_ROUTE".
- Responder SOLO con JSON valido. Sin texto adicional.
```

#### PV-002: Feedback IA

**File locations:**
- System prompt: `backend/prompts/v1/feedback-ia-system.md`
- User template: `backend/prompts/v1/feedback-ia-user.md`
- Few-shot examples: `backend/prompts/v1/feedback-ia-examples.json`

**System prompt structure:**
```markdown
# Role
Eres un evaluador formativo experto en emprendimiento e innovacion. Tu rol es
revisar el trabajo del participante en un modulo especifico y proporcionar feedback
estructurado, especifico y accionable.

# Instructions
1. Lee el contexto del proyecto (step0Data) para entender el emprendimiento.
2. Lee los datos del modulo enviado por el participante.
3. Evalua completitud: todos los campos requeridos del modulo estan presentes y con contenido sustantivo?
4. Evalua coherencia: los datos del modulo son coherentes con el contexto del proyecto y modulos anteriores?
5. Identifica gaps: que informacion critica falta o esta incompleta?
6. Detecta contradicciones: hay afirmaciones que contradicen datos de modulos anteriores?
7. Formula preguntas guia: preguntas que ayuden al participante a profundizar, no respuestas directas.
8. Determina veredicto:
   - "Aprobado": modulo completo, coherente, sin gaps criticos.
   - "Iterar": modulo tiene gaps subsanables. Participante puede mejorar con las acciones sugeridas.
   - "Bloqueado": modulo tiene errores fundamentales o falta informacion critica que impide avanzar.
9. Genera un summary de 2-3 oraciones que resuma la evaluacion general.

# Output format
{
  "status": "Aprobado" | "Iterar" | "Bloqueado",
  "summary": "<2-3 oraciones resumen>",
  "goodPoints": ["<observacion especifica referenciando datos del modulo>", ...],
  "missing": ["<gap especifico identificado>", ...],
  "actions": ["<accion concreta y accionable>", ...],
  "questions": ["<pregunta guia para profundizar>", ...],
  "contradictions": ["<contradiccion especifica entre modulos>", ...]
}

# Constraints
- SIEMPRE referenciar datos concretos del participante. Nunca decir "falta mas detalle" sin especificar que detalle.
- SIEMPRE incluir al menos 1 item en goodPoints (refuerzo positivo).
- Si no hay contradicciones, retornar array vacio [], NUNCA omitir el campo.
- Maximo 5 items por array (goodPoints, missing, actions, questions, contradictions).
- Responder SOLO con JSON valido. Sin texto adicional fuera del JSON.
- Usar espanol para todo el contenido de texto.
```

**Few-shot examples (2-shot):**
```json
[
  {
    "input": {
      "step": 1,
      "module": "A",
      "moduleData": {
        "casoReal": "En nuestra clinica dental, los pacientes esperan en promedio 45 minutos para ser atendidos porque el sistema de citas es manual en una libreta.",
        "pasos": "1. Paciente llama por telefono. 2. Recepcionista busca disponibilidad en libreta. 3. Anota cita a lapiz. 4. Paciente llega y a veces la cita no esta registrada.",
        "quiebre": "La cita no se registra correctamente",
        "consecuencia": "Pacientes se van frustrados y no regresan",
        "causaInmediata": "Error humano al anotar en libreta",
        "alcance": "Afecta a 200 pacientes mensuales"
      },
      "step0Data": {
        "origen": "Clinica dental familiar",
        "impacto3meses": "Reducir el tiempo de espera a menos de 15 minutos"
      }
    },
    "output": {
      "status": "Iterar",
      "summary": "El analisis AS-IS describe bien el flujo actual y el quiebre principal. Sin embargo, la causa inmediata se queda en la superficie ('error humano') sin explorar por que ocurre el error, y el alcance necesita datos mas precisos sobre el impacto economico.",
      "goodPoints": [
        "El flujo de 4 pasos describe claramente el proceso actual de agendamiento con nivel de detalle util",
        "La consecuencia ('pacientes no regresan') conecta directamente con el impacto a 3 meses de reducir tiempo de espera"
      ],
      "missing": [
        "La causa inmediata 'error humano al anotar en libreta' necesita un nivel mas de profundidad: por que se comete el error? (interrupciones, multitarea, ilegibilidad)",
        "Falta cuantificar el impacto economico: de los 200 pacientes afectados, cuantos no regresan? Cual es el ingreso perdido estimado?"
      ],
      "actions": [
        "Aplica '5 Porques' a la causa inmediata para llegar a la causa raiz. Ejemplo: Por que se anota mal? Porque la recepcionista atiende telefono y mostrador al mismo tiempo.",
        "Agrega datos de retencion: de los 200 pacientes, cuantos son nuevos vs recurrentes y cuantos no agendaron segunda cita?"
      ],
      "questions": [
        "Has observado si el error ocurre mas en ciertos dias u horarios de mayor demanda?",
        "Existen otros sistemas (WhatsApp, redes) por donde llegan citas que tambien se anotan en la libreta?"
      ],
      "contradictions": []
    },
    "explanation": "Ejemplo de Iterar: el modulo tiene contenido sustantivo pero la causa inmediata es superficial y faltan datos cuantitativos. El feedback referencia datos concretos del input (los 200 pacientes, la causa 'error humano', los 4 pasos)."
  },
  {
    "input": {
      "step": 1,
      "module": "A",
      "moduleData": {
        "casoReal": "Tienda de ropa online",
        "pasos": "",
        "quiebre": "Ventas bajas",
        "consecuencia": "No hay ganancias",
        "causaInmediata": "Nadie compra",
        "alcance": ""
      },
      "step0Data": {
        "origen": "Emprendimiento de moda online",
        "impacto3meses": "Aumentar ventas"
      }
    },
    "output": {
      "status": "Bloqueado",
      "summary": "El modulo AS-IS esta incompleto: faltan los pasos del proceso actual y el alcance. Las descripciones existentes son demasiado genericas para poder construir una investigacion sobre ellas.",
      "goodPoints": [
        "Has identificado correctamente que el caso esta relacionado con tu emprendimiento de moda online descrito en Step 0"
      ],
      "missing": [
        "El campo 'pasos' esta vacio. Necesitas describir el proceso actual: como llega un cliente a tu tienda, como navega, como decide comprar (o no), como paga",
        "El 'quiebre' es generico ('ventas bajas'). Necesitas identificar el momento exacto donde se pierde el cliente: abandonan el carrito? No llegan a la pagina? No encuentran su talla?",
        "El 'alcance' esta vacio. Cuantas visitas mensuales tiene tu tienda? Cual es la tasa de conversion actual? Cuantas ventas al mes?"
      ],
      "actions": [
        "Describe tu funnel de ventas paso a paso: trafico --> pagina --> producto --> carrito --> pago. En cual paso se pierden los clientes?",
        "Revisa tus analytics (Google Analytics, Shopify, etc.) y anota: visitas mensuales, tasa de rebote, carritos abandonados, ventas completadas",
        "Reescribe el quiebre con un dato concreto. Ejemplo: 'De 500 visitas mensuales, solo 5 completan una compra (tasa de conversion 1%)'"
      ],
      "questions": [
        "Tienes acceso a datos de tu plataforma de e-commerce que muestren donde abandonan los clientes?",
        "Has recibido feedback directo de personas que visitaron tu tienda pero no compraron?"
      ],
      "contradictions": []
    },
    "explanation": "Ejemplo de Bloqueado: el modulo tiene campos vacios y los llenos son demasiado genericos para servir como base de investigacion. El feedback indica exactamente que falta y como completarlo."
  }
]
```

**User template:**
```
Proyecto: {{project.name}} ({{project.status}})
Step actual: {{currentStep}}
Modulo: {{currentModule}}

Contexto Step 0:
{{step0Data | json}}

Datos del modulo enviado:
{{moduleData | json}}

{{#if previousModules}}
Resumen de modulos anteriores:
{{#each previousModules}}
- Step {{stepNumber}}, Modulo {{moduleId}}: {{summary}}
{{/each}}
{{/if}}

{{#if feedbackHistory}}
Feedback anterior para este modulo:
{{feedbackHistory | json}}
{{/if}}

Evalua el modulo y retorna FeedbackIA en formato JSON.
```

#### PV-003: Mentor Virtual

**File locations:**
- System prompt: `backend/prompts/v1/mentor-virtual-system.md`
- User template: `backend/prompts/v1/mentor-virtual-user.md`
- Few-shot examples: `backend/prompts/v1/mentor-virtual-examples.json`

**System prompt structure:**
```markdown
# Role
Eres un mentor de emprendimiento e innovacion. Tu rol es ayudar a participantes
en la fase inicial (Step 0) de definicion de su proyecto, analizando lo que han
escrito y proporcionando guia constructiva.

# Instructions
1. Lee el step0Data del participante (origen, parteProceso, impacto3meses, respaldo, descripcion, quienImpacta, siMinimo).
2. Identifica que esta claro y bien definido (array "claro").
3. Identifica que necesita mas precision o profundidad (array "faltaPrecisar").
4. Formula preguntas guia que ayuden al participante a reflexionar (array "preguntas").
5. Define una siguiente accion concreta (string "siguienteAccion").

# Output format
{
  "claro": ["<aspecto bien definido, referenciando dato concreto>", ...],
  "faltaPrecisar": ["<aspecto que necesita precision, indicando que falta>", ...],
  "preguntas": ["<pregunta abierta que invite a reflexion>", ...],
  "siguienteAccion": "<accion concreta que el participante debe tomar a continuacion>"
}

# Constraints
- SIEMPRE al menos 1 item en "claro" (refuerzo positivo).
- Maximo 4 items por array.
- Las preguntas deben ser abiertas, no cerradas (no "si/no").
- Referenciar datos concretos del step0Data del participante.
- Responder SOLO con JSON valido.
- Usar espanol.
- Tono de mentor: constructivo, guia, no directivo.
```

---

## Guardrails

### Input guardrails

| Guardrail | Implementacion | Agentes afectados |
|---|---|---|
| Validacion de schema de input | JSON schema validation en el backend antes de invocar agente | Todos |
| Sanitizacion de texto | Strip HTML/scripts, limitar a 5000 chars por campo de texto | Todos |
| Deteccion de contenido inapropiado | Moderation API de Anthropic pre-invocacion | Todos |
| Limite de tamanio de contexto | Truncar step data a max 3000 tokens, summaries a 200 tokens | Workers |
| Rate limiting por usuario | Max 20 AI requests por hora por usuario | Todos |

### Output guardrails

| Guardrail | Implementacion | Agentes afectados |
|---|---|---|
| Validacion de schema de output | JSON schema validation post-generacion. Si falla, retry con temperature 0 | Todos |
| Enum validation | Verificar que `status` es exactamente "Aprobado", "Iterar", o "Bloqueado" | Feedback IA |
| Array length limits | Truncar arrays a max 5 items si modelo excede | Feedback IA, Mentor Virtual |
| Deteccion de respuesta generica | Score de especificidad: >= 50% de observaciones deben referenciar datos del input | Feedback IA, Mentor Virtual |
| Fallback en schema failure | Despues de 2 retries con schema invalido, retornar template con `status: 'partial'` | Todos |
| Contenido en espanol | Verificar que el output esta en espanol (heuristica: >= 80% de palabras en diccionario ES) | Todos |

---

## Versioning policy

| Event | Version bump | Action required |
|---|---|---|
| Cambio en schema de output (agregar/quitar campo) | Major (1.0 --> 2.0) | Nuevo eval suite run; actualizar todos los consumers downstream (frontend components, Prisma schema) |
| Nuevos few-shot examples o cambio de ejemplos | Minor (1.0 --> 1.1) | Re-run eval suite; actualizar PROMPT-REGISTRY.md |
| Clarificacion de wording en instrucciones | Patch (1.0 --> 1.0.1) | Spot-check 10 casos; actualizar PROMPT-REGISTRY.md |

**Version freeze policy:** Una vez que una version de prompt esta desplegada en produccion, es **inmutable**. Los cambios crean una nueva version. Sin excepciones.

---

## Evaluation dataset

- **Dataset location:** `evals/golden/starteria-feedback.jsonl`
- **Dataset size:** 50 casos curados
- **Dataset composition:**
  - 30% casos tipicos (modulos completos y bien escritos)
  - 40% edge cases (campos vacios, datos minimos, texto ambiguo, modulos parcialmente completos)
  - 30% adversarial (texto irrelevante, intento de inyeccion de prompt, contenido en idioma incorrecto, datos contradictorios)
- **Eval method:** LLM-as-judge (Claude Sonnet evalua conformidad de schema + especificidad de feedback) + revision humana para 15 casos criticos
- **Pass threshold:** Factuality >= 0.85, Schema compliance >= 0.98, Especificidad >= 0.80 en todos los 50 casos

**Adding to the dataset:**
- Agregar ejemplos cuando se descubre una falla en produccion
- Agregar ejemplos adversariales de sesiones de red-teaming
- Nunca modificar ejemplos existentes -- agregar nuevos con sufijo `_v[N]` si se reemplazan

---

## Acceptance criteria

- [ ] Eval suite pasa en umbral (factuality >= 0.85, schema compliance >= 0.98) en CI via `npx promptfoo eval`
- [ ] Prompt versions registradas en `backend/prompts/PROMPT-REGISTRY.md`:
  - PV-001: orchestrator-queen
  - PV-002: feedback-ia
  - PV-003: mentor-virtual
- [ ] Output format validado por JSON schema en 100% de test cases
- [ ] Sin vulnerabilidad de jailbreak en el adversarial test set (todos los 15 casos red-team rechazados o manejados correctamente)
- [ ] Few-shot examples cubren: 1 caso "Iterar" y 1 caso "Bloqueado" para Feedback IA; ambos con alto nivel de especificidad

---

## Rejected strategies

### Chain-of-thought
**Rejected because:** CoT incremento el consumo de tokens en 2.7x (1,800 --> 3,200 tokens promedio) y excedio el budget de latencia en 15% de los casos (P95: 5,800ms vs budget de 5,000ms), sin mejora significativa en calidad (0.89 vs 0.87 factuality). Para feedback formativo, la estructura del output (schema fijo) ya guia al modelo de manera suficiente. Revisitar si el budget de latencia se relaja a 8s.

### RAG-augmented
**Rejected because:** Esta capacidad no se beneficia de retrieval de conocimiento externo -- toda la informacion relevante (datos del proyecto, rubricas, modulos previos) ya esta en el contexto del request. RAG agrego 600ms de latencia (embedding + search) y 600 tokens adicionales sin mejorar los eval scores (0.86 vs 0.87 few-shot). Revisitar si se agregan rubricas extensas por industria que excedan el context window.

### Zero-shot
**Rejected because:** Zero-shot alcanzo solo 0.78 factuality y 85% de schema compliance. Las fallas principales fueron: (1) omision del campo `contradictions` en 15% de casos, (2) respuestas genericas sin referenciar datos concretos del input en 22% de casos, (3) uso inconsistente de enums en espanol (el modelo a veces usaba "Approved" en lugar de "Aprobado"). Los 2 few-shot examples resuelven estos 3 problemas al demostrar el formato exacto.

### ReAct
**Rejected because:** ReAct (reasoning + action loop) requiere multiples LLM calls por agente (promedio 2.3 calls), lo que excede el cost ceiling de $0.05/request cuando se suma el call del orquestador. La calidad (0.88) fue comparable a few-shot (0.87) sin justificar el costo adicional.

---

## Consequences

**Positive:**
- Schema compliance de 98% con few-shot elimina virtualmente los errores de parsing en frontend
- Especificidad de feedback >= 0.80 asegura que los participantes reciben observaciones utiles, no genericas
- 1,800 tokens promedio por request mantiene el costo dentro de budget ($0.0065/request promedio)
- System prompts especializados por agente permiten optimizar individualmente cada rol sin afectar a otros

**Negative:**
- Los 2 few-shot examples agregan ~600 tokens por request (vs zero-shot). En 12,000 requests/mes (Growth), esto representa ~7.2M tokens adicionales de input = ~$21 mensuales extra. Aceptable dentro del budget de $150.
- El modelo ocasionalmente ignora instrucciones de formato en inputs > 4,000 tokens (observado en 2% de casos con Narrative Builder). Mitigado con output validation guardrail que retrigerea con temperature 0.
- Prompt freeze policy requiere nueva version para cualquier cambio, lo que agrega overhead de testing. Compensado por la estabilidad y reproducibilidad del sistema.

---

## Review triggers

Revisitar esta decision cuando:
- [ ] Eval score cae por debajo de 0.85 tras actualizacion de modelo
- [ ] Latency target cambia (habilitaria o eliminaria CoT como opcion)
- [ ] Nuevo esquema de output se agrega (nuevo agente o nuevo tipo de feedback)
- [ ] Dynamic few-shot via RAG se vuelve viable (seleccion de ejemplos basada en similarity al input)
- [ ] Scheduled review: 2026-Q3

---

## Related decisions

- **Model selection:** ADR-001
- **Agent orchestration:** ADR-002

---

*Template version 1.0 -- BHIL AI-First Development Toolkit -- [barryhurd.com](https://barryhurd.com)*
