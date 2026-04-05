---
id: PRD-001
title: "Sistema multi-agente IA Starteria"
status: approved
date: 2026-04-04
author: Architecture Agent (SPARC)
sprint: S-01
priority: high
children:
  - SPEC-001
adrs: [ADR-001, ADR-002, ADR-003]
---

# PRD-001: Sistema Multi-Agente IA para Starteria

## Problem statement

Los participantes de programas de innovacion corporativa no pueden recibir retroalimentacion formativa inmediata ni asistencia contextual durante la ejecucion de sus proyectos (Steps 0-4) porque la plataforma carece de agentes IA especializados por etapa, lo que genera dependencia total del facilitador humano y cuellos de botella en el avance.

---

## User stories (EARS format)

**US-001 -- Orchestrator (Queen):**
WHEN un componente del frontend o el Bridge envia una solicitud a `/api/v1/ai/invoke` con step, module y action, the system SHALL ensamblar el contexto del proyecto desde Prisma, seleccionar el agente worker apropiado segun la tabla de routing (step/module/action), delegar la ejecucion, validar el schema de respuesta, registrar la invocacion en AuditLog y retornar la respuesta estructurada en menos de 3 segundos (excluyendo latencia del worker).

**US-002 -- Mentor Virtual:**
WHEN un participante abre el panel de mentor en Step 0 con datos de `step0Data` (origen, impacto, respaldo, descripcion), the system SHALL analizar el contexto del proyecto y retornar un objeto `MentorVirtualFeedback` con campos `claro`, `faltaPrecisar`, `preguntas` y `siguienteAccion` en menos de 4 segundos.

**US-003 -- Feedback IA:**
WHEN un participante envia (submit) un modulo completado en cualquier Step (1-4), the system SHALL evaluar los datos del modulo contra la rubrica correspondiente, detectar vacios y contradicciones, y retornar un objeto `FeedbackIA` con status (`Aprobado`/`Iterar`/`Bloqueado`), resumen, puntos positivos, faltantes, acciones sugeridas y preguntas, persistiendo el resultado en la tabla `FeedbackIA` de Prisma.

**US-004 -- Research Assistant:**
WHEN un participante solicita asistencia en Step 1 Modulo B (Investigacion) y el Modulo A (AS-IS) esta completado, the system SHALL derivar un objetivo de investigacion a partir de los datos AS-IS, sugerir temas de investigacion, perfiles de entrevista y preguntas guia en menos de 4 segundos.

**US-005 -- Solution Design:**
WHEN un participante solicita generacion de HMW en Step 2 con datos de sintesis (Modulo D de Step 1) disponibles, the system SHALL generar al menos 3 reformulaciones HMW, facilitar ideacion con ideas clusterizadas, asistir la evaluacion DVF y sugerir rutas de experimentacion para el Test Card.

**US-006 -- Experiment Coach:**
WHEN un participante solicita asistencia en Step 3 con un Test Card completado (Step 2 Modulo D), the system SHALL sugerir componentes de prototipo e instrumentacion, y WHEN se envian resultados de ejecucion con evidencia, the system SHALL analizar los datos y emitir una recomendacion GO/NO_GO/PIVOT con justificacion y learning card.

**US-007 -- Narrative Builder:**
WHEN un participante solicita generacion de narrativa en Step 4 con todos los Steps previos completados, the system SHALL generar una estructura de presentacion de 12 slides con titulo, mensaje clave, contenido y notas del presentador, ademas de un elevator pitch y arco narrativo.

**US-008 -- OpenClaw Bridge:**
WHEN el webhook de OpenClaw recibe un mensaje de WhatsApp o Telegram, the system SHALL verificar la firma HMAC-SHA256, detectar la intencion del mensaje (status/assist/feedback/question/navigate), mapear el `senderId` a un `userId` registrado, construir una solicitud estructurada para el Orchestrator y formatear la respuesta para la plataforma de mensajeria (maximo 4096 caracteres).

**US-009 -- Fallback resiliente:**
IF un agente worker excede su timeout o falla con un error retryable, THEN the system SHALL reintentar hasta 2 veces con backoff (1s, 3s), y si persiste la falla, degradar al modelo de tier inferior (Opus a Sonnet, Sonnet a Haiku, Haiku a template estatico) retornando una respuesta parcial en lugar de un error.

**US-010 -- Control de costos:**
WHILE el costo acumulado de un proyecto en un dia alcanza el techo de $2.00 USD, the system SHALL rechazar nuevas solicitudes de IA para ese proyecto hasta el siguiente dia, informando al participante del limite alcanzado.

---

## Success metrics

| Metrica | Baseline | Target | Metodo de medicion |
|---|---|---|---|
| Tiempo hasta retroalimentacion (P50) | >24h (facilitador humano) | <10s (IA) | Telemetria de sesion (latencyMs en AuditLog) |
| Tasa de aceptacion de feedback | N/A | >=65% sin solicitar iteracion adicional | Ratio FeedbackIA.status='Aprobado' vs total |
| Cobertura de asistencia por Step | 0% (sin IA) | 100% de Steps 0-4 con agente dedicado | Invocaciones por agente en metricas Prometheus |
| Adopcion canal OpenClaw | 0 usuarios | >=20% de participantes activos usan WSP/Telegram | Usuarios unicos en openclaw_conversations |
| Costo mensual (100 proyectos activos) | N/A | <=$100 USD | Agregado de costUsd en AuditLog |

| Metrica de calidad IA | Umbral | N Evaluaciones | Metodo de evaluacion |
|---|---|---|---|
| Factualidad (sin alucinaciones) | >=0.85 | 50 por agente | LLM-judge con contexto del proyecto como ground truth |
| Relevancia de respuesta | >=0.80 | 50 por agente | LLM-judge evaluando alineacion respuesta-solicitud |
| Coherencia con rubrica (Feedback IA) | >=0.75 | 50 | Comparacion automatizada contra rubrica de referencia |
| Latencia P95 end-to-end | <5,000ms | N/A | APM wall clock (starteria_ai_latency_seconds) |
| Latencia P95 OpenClaw Bridge | <1,000ms | N/A | APM wall clock |

---

## Non-functional requirements

- **Performance:** P95 end-to-end (web) <5,000ms. P95 OpenClaw Bridge <1,000ms. Streaming first token <1,500ms para Narrative Builder.
- **Availability:** 99.5% uptime en horario de negocio (07:00-22:00 hora local). Circuit breaker por agente con umbral de 5 fallos en 60 segundos.
- **Security:** Todos los endpoints bajo autenticacion JWT. Validacion de inputs en system boundary. Webhooks OpenClaw verificados con HMAC-SHA256. Sin PII en logs de retrieval. Audit trail completo en tabla AuditLog.
- **Cost:** Techo por request: $0.05 USD. Techo por proyecto/dia: $2.00 USD. Techo por cohorte/mes: $100.00 USD. Techo por usuario OpenClaw/dia: $0.50 USD. Costo mensual estimado (100 proyectos): <=$77.80 USD.
- **Scalability:** Soporte para 100 proyectos activos concurrentes con 12,000 invocaciones/mes sin degradacion.
- **Observability:** Metricas Prometheus por agente (requests, latency, tokens, cost, errors). Dashboard de costos por cohorte y por proyecto.

---

## Out of scope

Los siguientes elementos NO forman parte de este feature:

- Entrenamiento o fine-tuning de modelos propios (se usan modelos de Anthropic via API)
- Integracion con modelos de otros proveedores (solo Anthropic: Opus, Sonnet, Haiku)
- Procesamiento de imagenes o archivos multimedia por los agentes (solo texto estructurado)
- Funcionalidad de chat libre / conversacion abierta en la web (las interacciones son estructuradas por step/module)
- Panel de administracion para configuracion de prompts (se hardcodean en primera version)
- Soporte multi-idioma (solo espanol para MVP)
- Integracion con canales distintos a WhatsApp y Telegram via OpenClaw
- Funcionalidad offline o procesamiento asincronico con notificaciones push

---

## Constraints and assumptions

**Constraints:**

- Se debe usar el sistema de autenticacion existente (JWT tokens, auth.middleware.ts) sin crear nuevos flujos de auth
- La base de datos PostgreSQL existente (Prisma) debe extenderse, no reemplazarse
- Se deben respetar los modelos Prisma existentes (Project, Step, User, AuditLog) y extender con FeedbackIA y tablas de OpenClaw
- El backend Express.js existente (app.ts) debe extenderse con nuevos modulos bajo `backend/modules/ai/` y `backend/modules/openclaw/`
- La infraestructura de deploy actual (Kubernetes, k8s/) debe soportar los nuevos modulos sin cambios de arquitectura
- No se pueden agregar dependencias externas de API sin revision de arquitectura (ADR requerido)
- El state machine de proyectos existente (state-machine.ts) no debe modificarse; los agentes operan como observadores/asesores

**Assumptions:**

- Los participantes trabajan en proyectos con datos estructurados en `step0Data` y `stepData` segun el schema Prisma actual
- El volumen inicial es de 100 proyectos activos con ~120 invocaciones/proyecto/mes
- El query promedio del participante es <500 tokens de input
- La respuesta promedio de los agentes es <1,000 tokens de output
- OpenClaw provee una API REST estable con webhooks HMAC-SHA256 firmados
- Los participantes que usan OpenClaw ya tienen cuenta en la plataforma web (no se registran desde WSP/Telegram)
- Los navegadores de los participantes soportan Server-Sent Events para streaming
- La API de Anthropic mantiene disponibilidad >=99.5% y los precios por token se mantienen estables durante el sprint

---

## Dependencies

| Dependencia | Tipo | Estado |
|---|---|---|
| API de Anthropic (Claude Opus, Sonnet, Haiku) | Externa | Disponible |
| OpenClaw Platform (webhooks, API de envio) | Externa | En evaluacion |
| Schema Prisma existente (Project, Step, User, AuditLog) | Interna | Disponible |
| Backend Express.js (app.ts, auth middleware) | Interna | Disponible |
| State machine de proyectos (state-machine.ts) | Interna | Disponible |
| Frontend React/TS (Step pages, panels) | Interna | Disponible |
| Infraestructura Kubernetes (k8s/) | Interna | Disponible |
| ADR-001: Seleccion de modelos por agente y tier routing | ADR | Propuesto |
| ADR-002: Estrategia de ensamblaje de contexto y caching de summaries | ADR | Propuesto |
| ADR-003: Integracion OpenClaw y maquina de estados conversacional | ADR | Propuesto |

---

*PRD-001 -- BHIL AI-First Development Toolkit -- Starteria Multi-Agent System*
