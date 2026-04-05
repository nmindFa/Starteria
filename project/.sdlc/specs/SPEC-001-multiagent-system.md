---
id: SPEC-001
title: "Sistema Multi-Agente de IA para Starteria"
status: approved
date: 2026-04-04
parent: PRD-001
sprint: S-01
adrs: [ADR-001, ADR-002, ADR-003]
tasks: [TASK-001, TASK-002, TASK-003, TASK-004, TASK-005]
---

# SPEC-001: Sistema Multi-Agente de IA -- Especificacion Tecnica

## Specification summary

Esta especificacion describe la implementacion del sistema multi-agente de IA para la plataforma Starteria, compuesto por 8 agentes especializados en topologia jerarquica Orchestrator-Worker. El sistema introduce un modulo backend `ai/` con un agente orquestador (Opus) que enruta solicitudes a 6 agentes trabajadores (Sonnet) segun el paso y modulo del proyecto, mas un agente puente (Haiku) para integracion con canales externos WhatsApp/Telegram via OpenClaw. La implementacion modifica el backend Express+Prisma existente anadiendo nuevos endpoints `/api/v1/ai/*` y `/api/v1/openclaw/*`, dos nuevos modelos Prisma (`AIUsage`, `OpenClawConversation`), y un servicio frontend `aiService.ts` que reemplaza los mocks actuales con llamadas reales a la API.

---

## Architecture overview

```
                          +------------------------------+
                          |     External Channels        |
                          |  WhatsApp / Telegram (WSP)   |
                          +-------------+----------------+
                                        |
                                        v
                          +-------------+----------------+
                          |  [8] OpenClaw Bridge Agent   |
                          |  (Channel Adapter - Haiku)   |
                          +-------------+----------------+
                                        |
                                        | HTTP / WebSocket
                                        v
+----------+    +----------+    +-------+--------+    +-------------------+
| Web App  |--->| API GW   |--->| Express.js     |--->| [1] Orchestrator  |
| React/TS |    | /api/v1  |    | Backend        |    |     Agent (Opus)  |
+----------+    +----------+    | Prisma + PG    |    +--------+----------+
                                +----------------+             |
                                                               |
                    +------------------------------------------+
                    |                    |                      |
          +---------v------+  +---------v-------+  +-----------v---------+
          | Step-Aware      |  | Step-Aware       |  | Step-Aware          |
          | Router          |  | Router           |  | Router              |
          +--------+--------+  +--------+---------+  +----------+----------+
                   |                    |                        |
     +-------------+------+    +-------+--------+    +----------+---------+
     |                    |    |                |    |                    |
+----v-----+  +-----v----+  +-v--------+ +----v---+ +------v-----+ +---v---------+
| [2]      |  | [3]      |  | [4]      | | [5]    | | [6]        | | [7]         |
| Mentor   |  | Feedback |  | Research | | Solut. | | Experiment | | Narrative   |
| Virtual  |  | IA       |  | Assist.  | | Design | | Coach      | | Builder     |
| Sonnet   |  | Sonnet   |  | Sonnet   | | Sonnet | | Sonnet     | | Sonnet      |
+----------+  +----------+  +----------+ +--------+ +------------+ +-------------+
```

**Componentes nuevos introducidos:**

- `backend/modules/ai/` -- Modulo completo del sistema multi-agente con orquestador, 6 agentes trabajadores, ensamblador de contexto, rastreador de costos y enrutador de modelos
- `backend/modules/openclaw/` -- Modulo puente para integracion con WhatsApp/Telegram via OpenClaw (agente puente, detector de intents, maquina de estados de conversacion)
- `front/src/app/services/aiService.ts` -- Servicio frontend que centraliza todas las llamadas a endpoints de IA

**Componentes existentes modificados:**

- `backend/app.ts` -- Registro de rutas `/api/v1/ai` y `/api/v1/openclaw`
- `front/prisma/schema.prisma` -- Nuevos modelos `AIUsage` y `OpenClawConversation`
- `MentorVirtualPanel` -- Reemplazo de mock `DEFAULT_FEEDBACK` por llamada a API real
- `FeedbackIAPanel` -- Conexion con endpoint `/api/v1/ai/feedback` en submit de modulo
- `Step1ResearchModuleV2` -- Reemplazo de `buildResearchObjective()` local por sugerencias IA
- `Step2Page` -- Conexion de HMW, ideacion y rutas de experimento con endpoints IA
- `Step3Page` -- Conexion de sugerencia de prototipo y analisis de experimento
- `Step4Page` -- Conexion de generacion de narrativa con endpoint IA

**Decisiones arquitectonicas que gobiernan esta funcionalidad:**

- ADR-001: Topologia jerarquica Orchestrator-Worker con enrutamiento basado en paso/modulo
- ADR-002: Ensamblaje de contexto por capas (Tier 1/2/3) para control de tokens
- ADR-003: Enrutamiento de modelos por tiers (Template/Haiku/Sonnet/Opus) segun complejidad

---

## API contracts

Todos los endpoints requieren autenticacion Bearer JWT. Base path: `/api/v1`.

### POST /api/v1/ai/invoke

Punto de entrada unificado. El Orquestador enruta internamente.

**Request:**
```json
{
  "agentHint": "string",           // opcional -- ID del agente sugerido
  "step": 0,                       // requerido -- numero de paso (0-4)
  "module": "string",              // opcional -- ID del modulo (A, B, C, D)
  "action": "string",              // requerido -- accion: feedback, assist, generate
  "payload": {}                    // requerido -- datos especificos del agente
}
```

**Response (200):**
```json
{
  "data": {},
  "agent": "string",
  "model": "string",
  "tokensUsed": 0,
  "latencyMs": 0
}
```

**Response (4xx/5xx):**
```json
{
  "error": "string",
  "code": "COST_EXCEEDED | INVALID_INPUT | AUTH_FAILED | RATE_LIMIT | TIMEOUT | SERVICE_UNAVAILABLE",
  "details": "string | null"
}
```

### POST /api/v1/ai/mentor-virtual

Feedback estructurado del mentor virtual para Step 0.

**Request:**
```json
{
  "projectId": "string",          // requerido -- UUID del proyecto
  "step0Data": {                   // requerido -- datos de Step 0
    "origen": "string",
    "parteProceso": "string",
    "impacto3meses": "string",
    "respaldo": "string",
    "descripcion": "string",
    "quienImpacta": "string",
    "siMinimo": "string"
  }
}
```

**Response (200):**
```json
{
  "data": {
    "claro": ["string"],
    "faltaPrecisar": ["string"],
    "preguntas": ["string"],
    "siguienteAccion": "string"
  }
}
```

### POST /api/v1/ai/feedback

Evaluacion formativa de modulo. Almacena resultado en tabla `FeedbackIA` de Prisma.

**Request:**
```json
{
  "projectId": "string",          // requerido -- UUID del proyecto
  "stepNumber": 0,                // requerido -- numero de paso (1-4)
  "moduleId": "string",           // requerido -- ID del modulo (A, B, C, D)
  "moduleData": {}                // requerido -- datos del modulo en formato JSON
}
```

**Response (200):**
```json
{
  "data": {
    "status": "Aprobado | Iterar | Bloqueado",
    "summary": "string",
    "goodPoints": ["string"],
    "missing": ["string"],
    "actions": ["string"],
    "questions": ["string"],
    "contradictions": ["string"]
  }
}
```

### POST /api/v1/ai/research-assist

Genera plan de investigacion a partir del analisis AS-IS.

**Request:**
```json
{
  "projectId": "string",          // requerido
  "moduleAData": {                 // requerido -- datos del modulo A (AS-IS)
    "casoReal": "string",
    "pasos": "string",
    "quiebre": "string",
    "consecuencia": "string",
    "causaInmediata": "string",
    "alcance": "string"
  }
}
```

**Response (200):**
```json
{
  "data": {
    "objetivo": "string",
    "temas": [
      {
        "tema": "string",
        "justificacion": "string"
      }
    ],
    "perfiles": [
      {
        "perfil": "string",
        "razon": "string"
      }
    ],
    "guiaPreguntas": ["string"]
  }
}
```

### POST /api/v1/ai/hmw-generate

Genera reformulaciones HMW (How Might We) a partir de la sintesis.

**Request:**
```json
{
  "projectId": "string",          // requerido
  "synthesisData": {}              // requerido -- datos del modulo D de Step 1
}
```

**Response (200):**
```json
{
  "data": {
    "options": [
      {
        "hmw": "string",
        "rationale": "string"
      }
    ]
  }
}
```

### POST /api/v1/ai/ideate

Genera y agrupa ideas a partir de un HMW seleccionado.

**Request:**
```json
{
  "projectId": "string",          // requerido
  "hmw": "string",                // requerido -- HMW seleccionado
  "context": {}                    // requerido -- contexto adicional del proyecto
}
```

**Response (200):**
```json
{
  "data": {
    "ideas": [
      {
        "id": "string",
        "title": "string",
        "description": "string",
        "cluster": "string"
      }
    ]
  }
}
```

### POST /api/v1/ai/experiment-routes

Genera rutas de experimento para el test card.

**Request:**
```json
{
  "projectId": "string",          // requerido
  "selectedIdea": {                // requerido -- idea finalista
    "id": "string",
    "title": "string",
    "description": "string"
  },
  "dvfScores": {}                  // requerido -- puntuaciones DVF
}
```

**Response (200):**
```json
{
  "data": {
    "routes": [
      {
        "hypothesis": "string",
        "experiment": "string",
        "metric": "string"
      }
    ]
  }
}
```

### POST /api/v1/ai/prototype-suggest

Sugiere componentes de prototipo e instrumentacion desde el test card.

**Request:**
```json
{
  "projectId": "string",          // requerido
  "testCard": {}                   // requerido -- datos del test card de Step 2 Modulo D
}
```

**Response (200):**
```json
{
  "data": {
    "components": ["string"],
    "instrumentation": ["string"],
    "tips": ["string"]
  }
}
```

### POST /api/v1/ai/experiment-analyze

Analiza resultados de experimento y emite recomendacion Go/No-Go.

**Request:**
```json
{
  "projectId": "string",          // requerido
  "runId": "string",              // requerido -- ID de la ejecucion
  "metrics": {},                   // requerido -- metricas del experimento
  "evidence": ["string"]          // requerido -- URLs o IDs de evidencia
}
```

**Response (200):**
```json
{
  "data": {
    "findings": ["string"],
    "recommendation": "GO | NO_GO | PIVOT",
    "rationale": "string",
    "learningCard": {}
  }
}
```

### POST /api/v1/ai/narrative-build

Genera estructura completa de presentacion (12 slides).

**Request:**
```json
{
  "projectId": "string",          // requerido
  "audience": "string"            // requerido -- audiencia objetivo
}
```

**Response (200):**
```json
{
  "data": {
    "slides": [
      {
        "number": 0,
        "title": "string",
        "keyMessage": "string",
        "content": "string",
        "speakerNotes": "string"
      }
    ],
    "elevatorPitch": "string",
    "narrativeArc": "string"
  }
}
```

### POST /api/v1/ai/narrative-feedback

Feedback de ensayo sobre borrador de presentacion.

**Request:**
```json
{
  "projectId": "string",          // requerido
  "slides": [{}],                  // requerido -- array de slides editados
  "notes": "string"               // requerido -- notas del participante
}
```

**Response (200):**
```json
{
  "data": {
    "feedback": ["string"],
    "suggestions": ["string"]
  }
}
```

### GET /api/v1/ai/usage/:projectId

Metricas de uso de IA por proyecto.

**Response (200):**
```json
{
  "totalTokens": 0,
  "totalCost": 0.0,
  "byAgent": {
    "mentor-virtual": {
      "tokens": 0,
      "cost": 0.0,
      "invocations": 0
    }
  }
}
```

### GET /api/v1/admin/ai/usage

Dashboard de uso de IA a nivel administrativo.

**Query params:** `cohortId` (opcional), `dateFrom` (opcional), `dateTo` (opcional)

**Response (200):**
```json
{
  "totalTokens": 0,
  "totalCost": 0.0,
  "byAgent": {},
  "byCohort": {},
  "byDate": {}
}
```

### POST /api/v1/openclaw/webhook

Webhook entrante desde OpenClaw. Verificacion de firma HMAC-SHA256 obligatoria.

**Headers requeridos:**
- `x-openclaw-signature` -- firma HMAC-SHA256
- `x-openclaw-timestamp` -- timestamp para proteccion de replay (ventana de 5 minutos)

**Request:**
```json
{
  "platform": "whatsapp | telegram",  // requerido
  "senderId": "string",               // requerido -- ID de plataforma externa
  "message": "string",                // requerido -- mensaje del usuario
  "media": {},                         // opcional -- objeto multimedia
  "timestamp": "string"               // requerido -- ISO timestamp
}
```

**Response (200):**
```json
{
  "status": "received"
}
```

### POST /api/v1/openclaw/send

Envio de mensaje hacia OpenClaw API.

**Request:**
```json
{
  "platform": "string",              // requerido
  "recipientId": "string",           // requerido
  "message": "string",               // requerido -- max 4096 chars
  "buttons": [                        // opcional
    {
      "text": "string",
      "url": "string",
      "callback": "string"
    }
  ]
}
```

**Response (200):**
```json
{
  "status": "sent",
  "messageId": "string"
}
```

### GET /api/v1/openclaw/conversations/:userId

Historial de conversaciones OpenClaw (solo admin).

**Response (200):**
```json
{
  "data": [
    {
      "id": "string",
      "platform": "string",
      "senderId": "string",
      "state": "string",
      "messages": [],
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
}
```

---

## Data models

### AIUsage

| Campo | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | String | NOT NULL, PRIMARY KEY, CUID | Identificador unico |
| `projectId` | String | NOT NULL, FOREIGN KEY (Project.id), ON DELETE CASCADE | Proyecto asociado |
| `agentId` | String | NOT NULL | Identificador del agente invocado |
| `model` | String | NOT NULL | Modelo utilizado (opus, sonnet, haiku) |
| `action` | String | NOT NULL | Accion ejecutada |
| `inputTokens` | Int | NOT NULL | Tokens de entrada consumidos |
| `outputTokens` | Int | NOT NULL | Tokens de salida generados |
| `costUsd` | Float | NOT NULL | Costo en USD de la invocacion |
| `latencyMs` | Int | NOT NULL | Latencia en milisegundos |
| `status` | String | NOT NULL | Estado: success, partial, error |
| `source` | String | NOT NULL | Origen: web, openclaw |
| `createdAt` | DateTime | NOT NULL, DEFAULT NOW() | Timestamp de creacion |

**Indices:** `@@index([projectId])`, `@@index([agentId])`, `@@index([createdAt])`

### OpenClawConversation

| Campo | Tipo | Restricciones | Descripcion |
|---|---|---|---|
| `id` | String | NOT NULL, PRIMARY KEY, CUID | Identificador unico |
| `platform` | String | NOT NULL | Plataforma: whatsapp, telegram |
| `senderId` | String | NOT NULL | ID externo de la plataforma |
| `userId` | String | NULLABLE | ID de usuario Starteria mapeado |
| `state` | String | NOT NULL | Estado de la maquina de estados de conversacion |
| `projectId` | String | NULLABLE | Proyecto activo en contexto |
| `messages` | Json | NOT NULL | Historial de conversacion (ventana deslizante) |
| `createdAt` | DateTime | NOT NULL, DEFAULT NOW() | Timestamp de creacion |
| `updatedAt` | DateTime | NOT NULL, @updatedAt | Timestamp de actualizacion |

**Restriccion unica:** `@@unique([platform, senderId])`
**Indices:** `@@index([userId])`

---

## Component design

### OrchestratorRequest

**Responsabilidad:** Mensaje interno que el Orquestador construye para enviar a los agentes trabajadores. Contiene toda la informacion necesaria para que un agente procese una solicitud.

**Interfaz:**
```typescript
interface OrchestratorRequest {
  requestId: string;          // UUID para trazabilidad
  userId: string;
  projectId: string;
  targetAgent: AgentId;       // Resuelto por logica de enrutamiento
  action: string;             // e.g., 'feedback', 'assist', 'generate'
  context: AgentContext;      // Ensamblado por el Orquestador
  payload: Record<string, unknown>;  // Datos especificos del agente
  constraints: {
    maxTokens: number;        // Limite de tokens de salida
    temperature: number;      // 0.0-1.0
    costCeiling: number;      // Costo maximo en USD para esta solicitud
    timeoutMs: number;        // Tiempo maximo de ejecucion
  };
  metadata: {
    source: 'web' | 'openclaw';
    platform?: 'whatsapp' | 'telegram';
    timestamp: string;
  };
}

type AgentId =
  | 'mentor-virtual'
  | 'feedback-ia'
  | 'research-assistant'
  | 'solution-design'
  | 'experiment-coach'
  | 'narrative-builder'
  | 'openclaw-bridge';
```

### AgentResponse

**Responsabilidad:** Respuesta estandar que todo agente trabajador devuelve al Orquestador. Incluye datos del resultado, metricas de uso e informacion de error si aplica.

**Interfaz:**
```typescript
interface AgentResponse {
  requestId: string;
  agentId: AgentId;
  status: 'success' | 'partial' | 'error';
  data: Record<string, unknown>;  // Output especifico del agente
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  };
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}
```

### AgentContext

**Responsabilidad:** Objeto de contexto ensamblado por el Orquestador y entregado a cada agente. Estructurado en 3 tiers para controlar uso de tokens.

**Interfaz:**
```typescript
interface AgentContext {
  // Tier 1: Siempre incluido (compacto)
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    currentStep: number;
    step0Status: Step0Status;
  };
  user: {
    id: string;
    role: Role;
    name: string;
  };
  currentStep: number;
  currentModule: string;

  // Tier 2: Incluido segun necesidad del agente (mediano)
  step0Data?: Step0Data;                    // Para agentes 2,4,5,7
  currentStepData?: Record<string, unknown>; // Datos completos del paso actual
  previousModules?: ModuleSummary[];         // Resumenes de modulos completados

  // Tier 3: Incluido solo cuando es necesario (pesado)
  allStepsData?: Record<number, unknown>;    // Datos completos de todos los pasos (solo agente 7)
  feedbackHistory?: FeedbackIA[];            // Registros previos de feedback
  conversationHistory?: Message[];           // Para contexto conversacional OpenClaw
}

interface ModuleSummary {
  stepNumber: number;
  moduleId: string;
  status: ModuleStatus;
  summary: string;  // Resumen de 2 oraciones generado por IA, cacheado
}
```

**Asignacion de Tiers por agente:**

| Agente | Tier 1 | Tier 2 | Tier 3 |
|--------|--------|--------|--------|
| Orchestrator | Siempre | Siempre | Nunca (delega) |
| Mentor Virtual | Siempre | step0Data | -- |
| Feedback IA | Siempre | currentStepData, previousModules | feedbackHistory |
| Research Assistant | Siempre | step0Data, currentStepData (modulo A) | -- |
| Solution Design | Siempre | step0Data, currentStepData, previousModules | -- |
| Experiment Coach | Siempre | currentStepData (test card + run data) | -- |
| Narrative Builder | Siempre | step0Data | allStepsData |
| OpenClaw Bridge | Siempre | -- | conversationHistory |

### FeedbackIAOutput

**Responsabilidad:** Estructura de salida del agente Feedback IA. Se almacena en la tabla FeedbackIA de Prisma. Usa valores enum en espanol para mantener consistencia con el frontend y backend existentes (`AppContext.tsx`, `state-machine.ts`).

**Interfaz:**
```typescript
interface FeedbackIAOutput {
  status: 'Aprobado' | 'Iterar' | 'Bloqueado';
  summary: string;
  goodPoints: string[];
  missing: string[];
  actions: string[];
  questions: string[];
  contradictions: string[];
}
```

**Notas de implementacion:**

- El campo `status` debe mapear directamente a las transiciones de `state-machine.ts`
- Los arrays `goodPoints`, `missing`, `actions`, `questions`, `contradictions` pueden estar vacios pero nunca `null`
- El campo `summary` no debe exceder 500 caracteres

---

## Dependency boundaries

```
ALLOWED:
  backend/modules/ai/          --> backend/shared/errors/AppError
  backend/modules/ai/          --> backend/shared/types/
  backend/modules/ai/          --> backend/modules/auth/auth.middleware (autenticacion)
  backend/modules/ai/          --> @prisma/client (acceso a datos)
  backend/modules/ai/          --> ai, @ai-sdk/anthropic (SDK de IA)
  backend/modules/ai/          --> zod (validacion de schemas)
  backend/modules/openclaw/    --> backend/modules/ai/ai.service (invocar orquestador)
  backend/modules/openclaw/    --> backend/shared/errors/AppError
  backend/modules/openclaw/    --> @prisma/client
  backend/modules/openclaw/    --> crypto (verificacion HMAC)
  front/src/app/services/      --> front/src/app/services/api (cliente HTTP existente)

FORBIDDEN:
  backend/modules/ai/          X  backend/modules/projects/ (interno, no importar directamente)
  backend/modules/ai/          X  backend/modules/users/ (interno, usar solo datos de contexto)
  backend/modules/openclaw/    X  backend/modules/projects/ (acceder via Prisma, no via servicio)
  backend/modules/ai/          X  external: openai, langchain, llamaindex
  backend/modules/openclaw/    X  external: twilio, messagebird (usar solo OpenClaw client)
  front/src/app/services/      X  @anthropic-ai/sdk (nunca exponer SDK de IA en frontend)
```

---

## Acceptance criteria

### Funcionales

- [ ] **AC-001:** DADO un participante autenticado en Step 0, CUANDO envia step0Data al endpoint `/api/v1/ai/mentor-virtual`, ENTONCES recibe un objeto `MentorVirtualFeedback` con arrays `claro`, `faltaPrecisar`, `preguntas` no vacios y un `siguienteAccion` con al menos 10 caracteres
- [ ] **AC-002:** DADO un participante en Step 1-4, CUANDO hace submit de un modulo al endpoint `/api/v1/ai/feedback`, ENTONCES recibe un objeto `FeedbackIA` con `status` en {Aprobado, Iterar, Bloqueado} y el resultado se persiste en la tabla FeedbackIA de Prisma
- [ ] **AC-003:** DADO un participante en Step 1 Modulo B, CUANDO solicita asistencia de investigacion, ENTONCES recibe objetivo, al menos 3 temas, al menos 2 perfiles y al menos 5 preguntas guia
- [ ] **AC-004:** DADO un participante en Step 2, CUANDO solicita generacion HMW, ENTONCES recibe al menos 3 opciones HMW derivadas de los datos de sintesis del Step 1
- [ ] **AC-005:** DADO un participante en Step 2, CUANDO solicita ideacion con un HMW seleccionado, ENTONCES recibe al menos 5 ideas agrupadas en clusters
- [ ] **AC-006:** DADO un participante en Step 3, CUANDO solicita analisis de experimento con metricas y evidencia, ENTONCES recibe una recomendacion en {GO, NO_GO, PIVOT} con rationale y learning card
- [ ] **AC-007:** DADO un participante en Step 4, CUANDO solicita generacion de narrativa, ENTONCES recibe exactamente 12 slides con titulo, keyMessage, contenido y speakerNotes, mas elevatorPitch y narrativeArc
- [ ] **AC-008:** DADO un mensaje entrante de WhatsApp/Telegram via webhook OpenClaw, CUANDO la firma HMAC-SHA256 es valida, ENTONCES el mensaje se procesa y se enruta al Orquestador con intent detectado
- [ ] **AC-009:** DADO un mensaje OpenClaw con firma invalida o timestamp expirado (>5min), CUANDO llega al webhook, ENTONCES se rechaza con HTTP 401/403

### Rendimiento

- [ ] **AC-010:** Latencia P95 del Orquestador < 3s bajo 50 usuarios concurrentes (load test)
- [ ] **AC-011:** Latencia P95 de agentes trabajadores Sonnet < 5s por solicitud individual
- [ ] **AC-012:** Latencia P95 del OpenClaw Bridge < 1s para deteccion de intent y formateo de respuesta
- [ ] **AC-013:** El circuit breaker se abre despues de 5 fallos en 60 segundos por agente y enruta a fallback inmediatamente

### Calidad AI-native

- [ ] **AC-014:** Puntuacion de factualidad >= 0.85 en al menos 50 ejecuciones del golden dataset, evaluada por LLM-judge contra las respuestas de referencia
- [ ] **AC-015:** Similitud semantica >= 0.80 entre respuestas del agente Feedback IA y respuestas de referencia del golden dataset
- [ ] **AC-016:** Cero violaciones de toxicidad en 100 ejecuciones (Perspective API score < 0.1)
- [ ] **AC-017:** El agente Feedback IA genera veredictos consistentes (mismo status) en >= 90% de ejecuciones repetidas con los mismos datos de entrada

### Seguridad y cumplimiento

- [ ] **AC-018:** Intentos de prompt injection son rechazados con error `PROMPT_INJECTION_DETECTED` en >= 95% de los casos de un dataset adversarial de 50 ejemplos
- [ ] **AC-019:** Campos PII (email, telefono) se redactan antes de enviar al modelo LLM y antes de almacenar en logs de auditoria

### Costos

- [ ] **AC-020:** Costo por solicitud individual no excede $0.05 USD, enforceado por el Orquestador antes de la invocacion
- [ ] **AC-021:** Costo por proyecto por dia no excede $2.00 USD, enforceado por middleware del backend
- [ ] **AC-022:** Costo por cohorte por mes no excede $100.00 USD (configurable por admin)

### Autorizacion

- [ ] **AC-023:** Un PARTICIPANTE solo puede invocar endpoints de IA sobre sus propios proyectos; intentos sobre proyectos ajenos retornan HTTP 403
- [ ] **AC-024:** Rate limiting aplicado: 10 req/min para PARTICIPANTE, 50 req/min para MENTOR/ADMIN en endpoints `/api/v1/ai/*`; 5 req/min por sender en `/api/v1/openclaw/*`

---

## Test requirements

**Unit tests** (logica deterministica):

- `tests/unit/ai/context-assembler.test.ts` -- Verificar ensamblaje correcto de contexto por tiers segun agente; verificar que Tier 3 no se incluye cuando no corresponde
- `tests/unit/ai/model-router.test.ts` -- Verificar seleccion correcta de modelo segun agentId y complejidad (template/haiku/sonnet/opus)
- `tests/unit/ai/cost-tracker.test.ts` -- Verificar enforcement de techo de costo por solicitud, por proyecto/dia y por cohorte/mes; verificar rechazo cuando se excede
- `tests/unit/openclaw/intent-detector.test.ts` -- Verificar clasificacion correcta de al menos 6 intents (status, assist, feedback, question, navigate, unknown) con mensajes de ejemplo
- `tests/unit/openclaw/signature-verification.test.ts` -- Verificar aceptacion de firma valida, rechazo de firma invalida y rechazo de timestamp expirado
- `tests/unit/openclaw/conversation-state.test.ts` -- Verificar transiciones de la maquina de estados: INITIAL->IDENTIFY->AUTHENTICATED->SELECT_PROJECT->ACTIVE_SESSION
- `tests/unit/ai/retry-policy.test.ts` -- Verificar que errores retryable (RATE_LIMIT, TIMEOUT, SERVICE_UNAVAILABLE) disparan reintentos y errores no-retryable (INVALID_INPUT, AUTH_FAILED, COST_EXCEEDED) no

**Integration tests:**

- `tests/integration/ai/feedback-flow.test.ts` -- Flujo completo: autenticacion -> submit modulo -> orquestador enruta a Feedback IA -> respuesta almacenada en tabla FeedbackIA -> respuesta devuelta al cliente
- `tests/integration/ai/mentor-virtual-flow.test.ts` -- Flujo completo: envio de step0Data -> respuesta estructurada con claro/faltaPrecisar/preguntas/siguienteAccion
- `tests/integration/ai/authorization.test.ts` -- Verificar que PARTICIPANTE no accede a proyectos ajenos, MENTOR solo accede a proyectos asignados, ADMIN accede a todos
- `tests/integration/ai/rate-limiting.test.ts` -- Verificar que exceder el rate limit retorna HTTP 429
- `tests/integration/openclaw/webhook-flow.test.ts` -- Flujo completo: webhook entrante con firma valida -> deteccion de intent -> enrutamiento al Orquestador -> formateo de respuesta -> envio via OpenClaw client
- `tests/integration/ai/circuit-breaker.test.ts` -- Verificar apertura despues de 5 fallos, enrutamiento a fallback, y recuperacion

**AI evaluation suite:**

- `evals/feedback-ia-suite.yaml` -- Minimo 30 casos de prueba cubriendo los 4 steps y modulos A-D con datos reales anonimizados
- `evals/mentor-virtual-suite.yaml` -- Minimo 20 casos de prueba con variedad de step0Data (completo, parcial, contradictorio)
- `evals/intent-detection-suite.yaml` -- Minimo 50 mensajes en espanol clasificados por intent esperado
- `evals/prompt-injection-suite.yaml` -- Minimo 50 ejemplos adversariales (jailbreak, role-play, instruccion override)
- `evals/golden/feedback-ia.jsonl` -- Minimo 30 ejemplos con respuestas de referencia validadas por mentores humanos
- `evals/golden/mentor-virtual.jsonl` -- Minimo 20 ejemplos con respuestas de referencia
- Umbral de aprobacion: factualidad >= 0.85, similitud semantica >= 0.80 en todos los casos

---

## Implementation order

1. [ ] **Phase 0 -- Scaffolding backend** (TASK-001)
   - Crear directorios `backend/modules/ai/` y `backend/modules/openclaw/` con estructura completa
   - Instalar dependencias: `ai`, `@ai-sdk/anthropic`, `zod`
   - Crear migracion Prisma para modelos `AIUsage` y `OpenClawConversation`
   - Registrar rutas en `app.ts`
   - Crear `front/src/app/services/aiService.ts`
   - Crear interfaces TypeScript en `backend/modules/ai/types/agent.types.ts`

2. [ ] **Phase 1 -- Orchestrator + Feedback IA** (TASK-002)
   - Implementar `orchestrator.agent.ts` con ensamblaje de contexto, enrutamiento basado en paso/modulo, tracking de costos, retry policy, circuit breaker y cadena de fallback
   - Implementar `feedback-ia.agent.ts` con evaluacion basada en rubricas
   - Implementar `context-assembler.ts` y `module-summarizer.ts`
   - Implementar `cost-tracker.ts` y `model-router.ts`
   - Implementar `ai.router.ts`, `ai.controller.ts`, `ai.service.ts`
   - Escribir unit tests e integration tests para ambos agentes
   - Conectar `FeedbackIAPanel` en frontend con endpoint real

3. [ ] **Phase 2 -- Mentor Virtual + Research Assistant** (TASK-003) [P]
   - Implementar `mentor-virtual.agent.ts` con analisis de step0Data y generacion de feedback estructurado
   - Implementar `research-assist.agent.ts` con generacion de objetivo, temas, perfiles y preguntas
   - Escribir unit tests e integration tests
   - Conectar `MentorVirtualPanel` y `Step1ResearchModuleV2` en frontend
   - Crear golden dataset para ambos agentes

4. [ ] **Phase 3 -- Solution Design + Experiment Coach + Narrative Builder** (TASK-004) [P]
   - Implementar `solution-design.agent.ts` con generacion HMW, ideacion y rutas de experimento
   - Implementar `experiment-coach.agent.ts` con sugerencia de prototipo y analisis Go/No-Go
   - Implementar `narrative-builder.agent.ts` con generacion de 12 slides y elevator pitch
   - Escribir unit tests e integration tests
   - Conectar `Step2Page`, `Step3Page` y `Step4Page` en frontend

5. [ ] **Phase 4 -- OpenClaw Bridge** (TASK-005)
   - Implementar `openclaw.router.ts`, `openclaw.controller.ts`, `openclaw.service.ts`
   - Implementar `openclaw.client.ts` (HTTP client)
   - Implementar `intent-detector.ts` con clasificacion Haiku de 6 intents
   - Implementar `response-formatter.ts` con formateo por plataforma (max 4096 chars)
   - Implementar `conversation-state.ts` con maquina de estados completa
   - Implementar verificacion de firma HMAC-SHA256 en middleware
   - Escribir unit tests, integration tests y AI evaluation suite para deteccion de intents
   - Crear dataset adversarial para pruebas de prompt injection

---

## Open technical questions

- [x] Seleccion de provider de IA -- Resuelto por: ADR-001 (Anthropic con SDK `ai` + `@ai-sdk/anthropic`)
- [x] Estrategia de enrutamiento de modelos -- Resuelto por: ADR-003 (3 tiers: Template/Haiku/Sonnet/Opus segun complejidad)
- [x] Estructura de contexto por capas -- Resuelto por: ADR-002 (3 tiers de contexto con caching de resumenes de modulos)

---

*SPEC-001 -- BHIL AI-First Development Toolkit -- Starteria Multi-Agent System*
