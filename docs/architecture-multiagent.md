# Starteria Multi-Agent System Architecture

Version: 1.0.0
Date: 2026-04-04
Author: Architecture Agent (SPARC)
Topology: Hierarchical (Orchestrator-Worker)
Agent Count: 8

---

## 1. System Diagram

```
                          +------------------------------+
                          |     External Channels        |
                          |  WhatsApp / Telegram (WSP)   |
                          +-------------+----------------+
                                        |
                                        v
                          +-------------+----------------+
                          |  [8] OpenClaw Bridge Agent   |
                          |  (Channel Adapter)           |
                          +-------------+----------------+
                                        |
                                        | HTTP / WebSocket
                                        v
+----------+    +----------+    +-------+--------+    +-------------------+
| Web App  |--->| API GW   |--->| Express.js     |--->| [1] Orchestrator  |
| React/TS |    | /api/v1  |    | Backend        |    |     Agent (Queen) |
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
| Agent    |  | Agent    |  | Agent    | | Agent  | | Agent      | | Agent       |
+----+-----+  +----+-----+  +----+----+ +---+----+ +-----+------+ +------+------+
     |              |             |           |           |               |
     +-------+------+------+-----+-----+-----+-----+-----+------+-------+
             |              |          |             |            |
        +----v----+    +----v----+  +--v---+   +----v----+  +----v----+
        | Project |    | Step +  |  | Audit|   | FeedbackIA| | Run/    |
        | Context |    | Module  |  | Log  |   | Table     | | Evidence|
        | (PG)    |    | Data    |  | (PG) |   | (PG)      | | (PG/S3)|
        +---------+    +---------+  +------+   +-----------+ +---------+

Legend:
  [N] = Agent number
  PG  = PostgreSQL (via Prisma)
  S3  = Object storage (evidence files)
  GW  = API Gateway (Express middleware)
```

---

## 2. Agent Definitions

### 2.1 Orchestrator Agent (Queen)

| Field | Value |
|-------|-------|
| **ID** | `orchestrator-queen` |
| **Responsibility** | Central coordinator. Receives all AI requests, assembles context, routes to the appropriate worker agent, aggregates responses, enforces cost ceilings, handles errors and retries. |
| **Model** | Opus (Tier 3) -- complex reasoning, multi-step routing, context synthesis |
| **Tools/Capabilities** | Context assembly, agent routing, cost tracking, session management, error recovery, model tier selection |
| **Inputs** | HTTP request from backend (`/api/v1/ai/*`), project state from Prisma, user role, current step/module, conversation history |
| **Outputs** | Routed response from worker agent, usage metrics, audit log entry |
| **Backend Endpoints** | `POST /api/v1/ai/invoke` -- unified entry point for all AI requests |
| **Frontend Integration** | All AI-enabled components call through `aiService.invoke()` which hits the unified endpoint |

### 2.2 Mentor Virtual Agent

| Field | Value |
|-------|-------|
| **ID** | `mentor-virtual` |
| **Responsibility** | Assists participants in Step 0. Analyzes the initial project context (origen, impacto, respaldo) and provides structured feedback: what is clear, what needs precision, guiding questions, and next action. |
| **Model** | Sonnet (Tier 3) -- needs nuanced understanding of business context |
| **Tools/Capabilities** | Step0Data analysis, structured feedback generation (claro/faltaPrecisar/preguntas/siguienteAccion), conversation memory |
| **Inputs** | `Step0Data` JSON (origen, parteProceso, impacto3meses, respaldo, descripcion, quienImpacta, siMinimo), project metadata |
| **Outputs** | `MentorVirtualFeedback` object: `{ claro: string[], faltaPrecisar: string[], preguntas: string[], siguienteAccion: string }` |
| **Backend Endpoints** | `POST /api/v1/ai/mentor-virtual` -- receives Step0Data, returns structured feedback |
| **Frontend Integration** | `MentorVirtualPanel` component (currently using mock `DEFAULT_FEEDBACK`). Replace mock with API call. |

### 2.3 Feedback IA Agent

| Field | Value |
|-------|-------|
| **ID** | `feedback-ia` |
| **Responsibility** | Provides formative feedback when a participant submits any module in Steps 1-4. Evaluates completeness, coherence, identifies gaps, suggests improvements. Returns structured verdict (Aprobado/Iterar/Bloqueado). |
| **Model** | Sonnet (Tier 3) -- requires evaluation against rubrics, nuanced judgment |
| **Tools/Capabilities** | Module data evaluation, rubric-based scoring, gap analysis, action suggestion, contradiction detection |
| **Inputs** | Step number, module ID, module data (JSON), project context (step0Data + previous modules), rubric definition |
| **Outputs** | `FeedbackIA` object: `{ status: 'Aprobado'|'Iterar'|'Bloqueado', summary: string, goodPoints: string[], missing: string[], actions: string[], questions: string[], contradictions: string[] }` |
| **Backend Endpoints** | `POST /api/v1/ai/feedback` -- receives step/module/data, returns FeedbackIA. Stores result in `FeedbackIA` Prisma table. |
| **Frontend Integration** | `FeedbackIAPanel` component (currently renders mock data). Wire to real endpoint on module submit. |

### 2.4 Research Assistant Agent

| Field | Value |
|-------|-------|
| **ID** | `research-assistant` |
| **Responsibility** | Assists in Step 1 Module B (Research). Generates research objective from AS-IS analysis, suggests investigation themes, recommends interview profiles, generates interview guide questions. |
| **Model** | Sonnet (Tier 3) -- needs to synthesize AS-IS data into research strategy |
| **Tools/Capabilities** | Objective generation from AS-IS, theme suggestion, profile recommendation, interview question generation, research plan structuring |
| **Inputs** | Module A (AS-IS) data: `{ casoReal, pasos, quiebre, consecuencia, causaInmediata, alcance }`, project step0Data for context |
| **Outputs** | `{ objetivo: string, temas: TemaInvestigacion[], perfiles: PerfilEntrevista[], guiaPreguntas: string[] }` |
| **Backend Endpoints** | `POST /api/v1/ai/research-assist` -- receives AS-IS data, returns research suggestions |
| **Frontend Integration** | `Step1ResearchModuleV2` component. Currently uses `buildResearchObjective()` and `buildResearchFrontSuggestions()` locally. Replace with AI-generated suggestions. |

### 2.5 Solution Design Agent

| Field | Value |
|-------|-------|
| **ID** | `solution-design` |
| **Responsibility** | Assists in Step 2. Generates HMW (How Might We) reformulations from the Step 1 synthesis. Facilitates ideation by suggesting ideas. Assists DVF (Deseable/Viable/Factible) evaluation. Generates experiment routes for the Test Card. |
| **Model** | Sonnet (Tier 3) -- creative reasoning for ideation and structured evaluation |
| **Tools/Capabilities** | HMW generation, idea brainstorming, idea clustering, DVF scoring assistance, experiment route suggestion |
| **Inputs** | Step 1 synthesis (Module D data), AS-IS analysis, research findings, restrictions. For DVF: list of finalist ideas. For Test Card: selected idea + DVF scores. |
| **Outputs** | HMW: `HmwOption[]`. Ideas: `Idea[]` with clusters. DVF: scoring suggestions. TestCard: `ExperimentRoute[]` with hypothesis/experiment/metric. |
| **Backend Endpoints** | `POST /api/v1/ai/hmw-generate` -- HMW from synthesis. `POST /api/v1/ai/ideate` -- idea generation. `POST /api/v1/ai/experiment-routes` -- test card suggestions. |
| **Frontend Integration** | `Step2Page` component. Currently has inline mock/manual data. Wire HMW options, idea suggestions, and experiment routes to AI endpoints. |

### 2.6 Experiment Coach Agent

| Field | Value |
|-------|-------|
| **ID** | `experiment-coach` |
| **Responsibility** | Assists in Step 3 (Probar en pequeno). Suggests prototype components and instrumentation based on the Test Card. Analyzes experiment results from the execution log. Provides Go/No-Go recommendation with rationale. |
| **Model** | Sonnet (Tier 3) -- analytical reasoning for experiment design and result interpretation |
| **Tools/Capabilities** | Prototype component suggestion, instrumentation design, result analysis, learning card generation, Go/No-Go decision support |
| **Inputs** | Test Card data from Step 2 Module D (hypothesis, experiment, metric). Execution log entries (bitacora). Evidence metadata. Run metrics. |
| **Outputs** | Prototype: `{ components: string[], instrumentation: string[], tips: string[] }`. Analysis: `{ findings: string[], recommendation: 'GO'|'NO_GO'|'PIVOT', rationale: string, learningCard: JSON }` |
| **Backend Endpoints** | `POST /api/v1/ai/prototype-suggest` -- from test card. `POST /api/v1/ai/experiment-analyze` -- from run data + evidence. |
| **Frontend Integration** | `Step3Page` component. Provide AI suggestions for prototype setup and automated analysis of experiment results. |

### 2.7 Narrative Builder Agent

| Field | Value |
|-------|-------|
| **ID** | `narrative-builder` |
| **Responsibility** | Assists in Step 4 (Presentar). Generates presentation structure (12 slides) based on the complete project journey. Creates storytelling narrative. Provides rehearsal feedback. |
| **Model** | Sonnet (Tier 3) -- creative writing, narrative structure |
| **Tools/Capabilities** | Slide structure generation, narrative arc construction, audience adaptation, rehearsal feedback, elevator pitch generation |
| **Inputs** | Complete project data: Step 0 context, Step 1 AS-IS + research + synthesis, Step 2 HMW + ideas + DVF + test card, Step 3 prototype + results + Go/No-Go. Target audience from Module A. |
| **Outputs** | `{ slides: Array<{ number: number, title: string, keyMessage: string, content: string, speakerNotes: string }>, elevatorPitch: string, narrativeArc: string }` |
| **Backend Endpoints** | `POST /api/v1/ai/narrative-build` -- generates full presentation structure. `POST /api/v1/ai/narrative-feedback` -- rehearsal feedback from draft. |
| **Frontend Integration** | `Step4Page` component. Populate slide builder with AI-generated structure. Provide feedback on user-edited narrative. |

### 2.8 OpenClaw Bridge Agent

| Field | Value |
|-------|-------|
| **ID** | `openclaw-bridge` |
| **Responsibility** | Bridges WhatsApp and Telegram channels to the Orchestrator. Translates conversational messages into structured API requests. Maintains per-user conversation state. Formats AI responses for messaging platforms (character limits, formatting). |
| **Model** | Haiku (Tier 2) -- simple message parsing and formatting, low latency required |
| **Tools/Capabilities** | Message parsing, intent detection, conversation state management, response formatting (WSP/Telegram), session mapping (phone number to userId), media handling |
| **Inputs** | Incoming webhook from OpenClaw: `{ platform: 'whatsapp'|'telegram', senderId: string, message: string, media?: object }` |
| **Outputs** | Outgoing message to OpenClaw: `{ recipientId: string, message: string, buttons?: object[] }`. Internal: structured request to Orchestrator. |
| **Backend Endpoints** | `POST /api/v1/openclaw/webhook` -- receives messages from OpenClaw. `POST /api/v1/openclaw/send` -- sends responses back. |
| **Frontend Integration** | None (channel-only agent). Admin dashboard may show OpenClaw conversation logs. |

---

## 3. Agent Summary Table

| # | Agent | Model | Step Scope | Latency Target | Cost/Request |
|---|-------|-------|------------|----------------|--------------|
| 1 | Orchestrator (Queen) | Opus | All | <3s | $0.015 |
| 2 | Mentor Virtual | Sonnet | Step 0 | <4s | $0.005 |
| 3 | Feedback IA | Sonnet | Steps 1-4 | <5s | $0.008 |
| 4 | Research Assistant | Sonnet | Step 1-B | <4s | $0.005 |
| 5 | Solution Design | Sonnet | Step 2 | <4s | $0.006 |
| 6 | Experiment Coach | Sonnet | Step 3 | <4s | $0.005 |
| 7 | Narrative Builder | Sonnet | Step 4 | <5s | $0.008 |
| 8 | OpenClaw Bridge | Haiku | All (external) | <1s | $0.0002 |

---

## 4. Data Flow Between Agents

### 4.1 Request Flow (Web)

```
User Action (React) --> api.ts (axios) --> Express Backend --> AI Router Middleware
    --> POST /api/v1/ai/invoke { agentHint, step, module, payload }
    --> Orchestrator Agent
        |
        +--> Context Assembly:
        |    1. Load project from Prisma (project + steps + modules)
        |    2. Load step0Data
        |    3. Load relevant stepData for current + previous steps
        |    4. Load previous FeedbackIA records
        |    5. Load conversation history (if applicable)
        |
        +--> Route to Worker Agent based on (step, module, action):
        |    Step 0, any action        --> Mentor Virtual Agent
        |    Steps 1-4, module submit  --> Feedback IA Agent
        |    Step 1, module B assist   --> Research Assistant Agent
        |    Step 2, HMW/ideate/DVF    --> Solution Design Agent
        |    Step 3, prototype/analyze --> Experiment Coach Agent
        |    Step 4, narrative/rehearse --> Narrative Builder Agent
        |
        +--> Worker processes with assembled context
        |
        +--> Orchestrator receives worker output
        |    1. Validate response schema
        |    2. Store FeedbackIA record if applicable
        |    3. Log to AuditLog
        |    4. Track cost
        |
        +--> Return structured response to frontend
```

### 4.2 Request Flow (OpenClaw / WhatsApp / Telegram)

```
User sends WSP/Telegram message
    --> OpenClaw Platform (webhook)
    --> POST /api/v1/openclaw/webhook { platform, senderId, message }
    --> OpenClaw Bridge Agent
        |
        +--> Parse intent from conversational message
        |    - "Como va mi proyecto?" --> { action: 'status', step: null }
        |    - "Ayuda con la investigacion" --> { action: 'assist', step: 1, module: 'B' }
        |    - "Revisa mi modulo A" --> { action: 'feedback', step: 1, module: 'A' }
        |
        +--> Map senderId to userId (phone-to-user lookup)
        +--> Build structured request for Orchestrator
        +--> Forward to Orchestrator Agent (same flow as web)
        |
        +--> Receive Orchestrator response
        +--> Format for messaging platform:
        |    - Truncate to platform limits (WSP: 4096 chars, Telegram: 4096)
        |    - Convert markdown to platform format
        |    - Add action buttons if supported
        |
        +--> POST /api/v1/openclaw/send { recipientId, message, buttons }
        --> OpenClaw sends to user
```

### 4.3 Inter-Agent Data Dependencies

```
Step 0 Data (Project.step0Data)
    |
    +--> [2] Mentor Virtual (reads to give feedback)
    +--> [4] Research Assistant (reads origen, parteProceso for research context)
    +--> [5] Solution Design (reads for HMW framing)
    +--> [7] Narrative Builder (reads for intro slides)

Step 1 Module A (AS-IS) Data
    |
    +--> [3] Feedback IA (evaluates on submit)
    +--> [4] Research Assistant (derives research objective)
    +--> [5] Solution Design (uses quiebre/consecuencia for HMW)

Step 1 Module B (Research) Data
    |
    +--> [3] Feedback IA (evaluates on submit)
    +--> [5] Solution Design (research insights inform ideation)

Step 1 Module D (Synthesis) Data
    |
    +--> [3] Feedback IA (evaluates on submit)
    +--> [5] Solution Design (primary input for HMW generation)

Step 2 Module D (Test Card) Data
    |
    +--> [3] Feedback IA (evaluates on submit)
    +--> [6] Experiment Coach (designs prototype from test card)

Step 3 Run Data + Evidence
    |
    +--> [3] Feedback IA (evaluates on submit)
    +--> [6] Experiment Coach (analyzes results, Go/No-Go)
    +--> [7] Narrative Builder (uses results for presentation)
```

---

## 5. Context Assembly Strategy

### 5.1 Context Window Construction

Each agent receives a context object assembled by the Orchestrator. The context is tiered to control token usage:

```typescript
interface AgentContext {
  // Tier 1: Always included (compact)
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

  // Tier 2: Included based on agent needs (medium)
  step0Data?: Step0Data;                    // For agents 2,4,5,7
  currentStepData?: Record<string, unknown>; // Current step's full data
  previousModules?: ModuleSummary[];         // Summaries of completed modules

  // Tier 3: Included only when required (heavy)
  allStepsData?: Record<number, unknown>;    // Full data for all steps (agent 7 only)
  feedbackHistory?: FeedbackIA[];            // Previous feedback records
  conversationHistory?: Message[];           // For OpenClaw conversational context
}

interface ModuleSummary {
  stepNumber: number;
  moduleId: string;
  status: ModuleStatus;
  summary: string;  // AI-generated 2-sentence summary, cached
}
```

### 5.2 Context Tier Assignment by Agent

| Agent | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|
| Orchestrator | Always | Always | Never (delegates) |
| Mentor Virtual | Always | step0Data | -- |
| Feedback IA | Always | currentStepData, previousModules | feedbackHistory |
| Research Assistant | Always | step0Data, currentStepData (module A) | -- |
| Solution Design | Always | step0Data, currentStepData, previousModules | -- |
| Experiment Coach | Always | currentStepData (test card + run data) | -- |
| Narrative Builder | Always | step0Data | allStepsData |
| OpenClaw Bridge | Always | -- | conversationHistory |

### 5.3 Module Summary Caching

To avoid passing full module data to every agent, the Orchestrator generates and caches 2-sentence summaries of each completed module. These summaries are stored in `Step.stepData.moduleSummaries` and regenerated only when module data changes.

---

## 6. API Endpoints

### 6.1 New AI Router Endpoints

All AI endpoints live under `/api/v1/ai/` and require authentication (Bearer JWT).

```
POST /api/v1/ai/invoke
  Body: { agentHint?: string, step: number, module?: string, action: string, payload: object }
  Response: { data: object, agent: string, model: string, tokensUsed: number, latencyMs: number }
  Description: Unified entry point. Orchestrator routes internally.

POST /api/v1/ai/mentor-virtual
  Body: { projectId: string, step0Data: Step0Data }
  Response: { data: MentorVirtualFeedback }
  Description: Direct endpoint for Step 0 mentor feedback.

POST /api/v1/ai/feedback
  Body: { projectId: string, stepNumber: number, moduleId: string, moduleData: object }
  Response: { data: FeedbackIA }
  Description: Submit module for AI review. Stores FeedbackIA record.

POST /api/v1/ai/research-assist
  Body: { projectId: string, moduleAData: ModuleASISData }
  Response: { data: { objetivo, temas, perfiles, guiaPreguntas } }
  Description: Generate research plan from AS-IS analysis.

POST /api/v1/ai/hmw-generate
  Body: { projectId: string, synthesisData: object }
  Response: { data: { options: HmwOption[] } }
  Description: Generate HMW reformulations.

POST /api/v1/ai/ideate
  Body: { projectId: string, hmw: string, context: object }
  Response: { data: { ideas: Idea[] } }
  Description: Generate and cluster ideas.

POST /api/v1/ai/experiment-routes
  Body: { projectId: string, selectedIdea: Finalista, dvfScores: object }
  Response: { data: { routes: ExperimentRoute[] } }
  Description: Generate experiment routes for test card.

POST /api/v1/ai/prototype-suggest
  Body: { projectId: string, testCard: object }
  Response: { data: { components, instrumentation, tips } }
  Description: Suggest prototype design.

POST /api/v1/ai/experiment-analyze
  Body: { projectId: string, runId: string, metrics: object, evidence: string[] }
  Response: { data: { findings, recommendation, rationale, learningCard } }
  Description: Analyze experiment results.

POST /api/v1/ai/narrative-build
  Body: { projectId: string, audience: string }
  Response: { data: { slides, elevatorPitch, narrativeArc } }
  Description: Generate full presentation structure.

POST /api/v1/ai/narrative-feedback
  Body: { projectId: string, slides: object[], notes: string }
  Response: { data: { feedback: string[], suggestions: string[] } }
  Description: Rehearsal feedback on draft presentation.
```

### 6.2 OpenClaw Endpoints

```
POST /api/v1/openclaw/webhook
  Body: { platform: 'whatsapp'|'telegram', senderId: string, message: string, media?: object, timestamp: string }
  Response: { status: 'received' }
  Description: Incoming webhook from OpenClaw. Processed asynchronously.

POST /api/v1/openclaw/send
  Body: { platform: string, recipientId: string, message: string, buttons?: object[] }
  Response: { status: 'sent', messageId: string }
  Description: Outgoing message to OpenClaw API.

GET /api/v1/openclaw/conversations/:userId
  Response: { data: Conversation[] }
  Description: Admin view of OpenClaw conversation history.
```

### 6.3 Cost & Observability Endpoints

```
GET /api/v1/ai/usage/:projectId
  Response: { totalTokens, totalCost, byAgent: Record<string, { tokens, cost, invocations }> }
  Description: AI usage metrics per project.

GET /api/v1/admin/ai/usage
  Query: { cohortId?, dateFrom?, dateTo? }
  Response: { aggregated usage across projects }
  Description: Admin-level AI usage dashboard.
```

---

## 7. Message Schema Between Agents

### 7.1 Orchestrator Request (Internal)

```typescript
interface OrchestratorRequest {
  requestId: string;          // UUID, for tracing
  userId: string;
  projectId: string;
  targetAgent: AgentId;       // Resolved by routing logic
  action: string;             // e.g., 'feedback', 'assist', 'generate'
  context: AgentContext;      // Assembled by Orchestrator
  payload: Record<string, unknown>;  // Agent-specific input
  constraints: {
    maxTokens: number;        // Output token limit
    temperature: number;      // 0.0-1.0
    costCeiling: number;      // Max cost in USD for this request
    timeoutMs: number;        // Max execution time
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

### 7.2 Agent Response (Internal)

```typescript
interface AgentResponse {
  requestId: string;
  agentId: AgentId;
  status: 'success' | 'partial' | 'error';
  data: Record<string, unknown>;  // Agent-specific output
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

### 7.3 FeedbackIA Schema (Stored in DB)

```typescript
// Maps to Prisma FeedbackIA model
// NOTE: Uses Spanish enum values to match existing frontend/backend convention
// (AppContext.tsx FeedbackIA interface, state-machine.ts transitions)
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

---

## 8. OpenClaw Integration

### 8.1 Architecture

```
+------------------+         +------------------+         +-------------------+
| WhatsApp User    |-------->| OpenClaw         |-------->| Starteria Backend |
| Telegram User    |<--------| Platform         |<--------| /api/v1/openclaw  |
+------------------+         | (SaaS/Self-host) |         +--------+----------+
                             +------------------+                  |
                                                           +-------v----------+
                                                           | OpenClaw Bridge  |
                                                           | Agent (Haiku)    |
                                                           +-------+----------+
                                                                   |
                                                           +-------v----------+
                                                           | Orchestrator     |
                                                           | Agent (Queen)    |
                                                           +------------------+
```

### 8.2 Webhook Signature Verification

All incoming OpenClaw webhooks MUST be verified using HMAC-SHA256 signature:

```typescript
// openclaw.middleware.ts
import crypto from 'crypto';

export function verifyOpenClawSignature(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers['x-openclaw-signature'] as string;
  const timestamp = req.headers['x-openclaw-timestamp'] as string;
  if (!signature || !timestamp) return res.status(401).json({ error: 'Missing signature' });

  // Reject if timestamp is older than 5 minutes (replay protection)
  if (Date.now() - parseInt(timestamp) > 300_000) return res.status(401).json({ error: 'Expired' });

  const expected = crypto
    .createHmac('sha256', process.env.OPENCLAW_WEBHOOK_SECRET!)
    .update(`${timestamp}.${JSON.stringify(req.body)}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(403).json({ error: 'Invalid signature' });
  }
  next();
}
```

### 8.3 Conversation State Machine

```
INITIAL --> IDENTIFY (ask for email/phone to map to userId)
    --> AUTHENTICATED (user found in DB)
        --> SELECT_PROJECT (if user has multiple projects)
            --> ACTIVE_SESSION (project selected, step/module context loaded)
                --> ASSIST (forward to appropriate worker agent)
                --> FEEDBACK (submit module data)
                --> STATUS (show project progress)
            --> IDLE (no action, waiting for input)
    --> UNREGISTERED (user not found, provide signup link)
```

### 8.3 Intent Detection (Haiku)

The Bridge Agent uses Haiku to classify incoming messages into intents:

| Intent | Example Messages | Routed To |
|--------|-----------------|-----------|
| `status` | "Como va mi proyecto?", "En que paso estoy?" | Orchestrator (project summary) |
| `assist` | "Ayuda con investigacion", "No se como hacer el HMW" | Step-appropriate worker |
| `feedback` | "Revisa mi modulo A", "Ya termine el paso 2" | Feedback IA Agent |
| `question` | "Que es DVF?", "Como funciona el test card?" | Mentor Virtual Agent |
| `navigate` | "Ir al paso 3", "Abrir mi proyecto" | Return deep link to web app |
| `unknown` | Anything else | Fallback: ask for clarification |

### 8.4 Response Formatting

```typescript
interface OpenClawOutbound {
  platform: 'whatsapp' | 'telegram';
  recipientId: string;
  message: string;           // Max 4096 chars, platform-formatted
  parseMode?: 'markdown';    // Telegram only
  buttons?: Array<{
    text: string;
    url?: string;            // Deep link to web app
    callback?: string;       // Inline callback for quick actions
  }>;
}
```

---

## 9. Error Handling & Resilience

### 9.1 Timeout Strategy

| Agent | Timeout | Fallback |
|-------|---------|----------|
| Orchestrator | 30s total | Return partial results with error flag |
| Mentor Virtual | 10s | Return cached/generic feedback |
| Feedback IA | 15s | Queue for async processing, notify later |
| Research Assistant | 10s | Return template suggestions |
| Solution Design | 10s | Return template HMW/ideas |
| Experiment Coach | 10s | Return generic prototype checklist |
| Narrative Builder | 15s | Return slide structure template |
| OpenClaw Bridge | 3s | "Processing your request, I will respond shortly" |

### 9.2 Retry Policy

```typescript
const retryPolicy = {
  maxRetries: 2,
  backoffMs: [1000, 3000],  // 1s, 3s
  retryableErrors: ['RATE_LIMIT', 'TIMEOUT', 'SERVICE_UNAVAILABLE'],
  nonRetryableErrors: ['INVALID_INPUT', 'AUTH_FAILED', 'COST_EXCEEDED'],
};
```

### 9.3 Fallback Chain

If the primary model fails, the Orchestrator attempts fallback:

```
Opus (fail) --> Sonnet (fallback)
Sonnet (fail) --> Haiku (degraded mode, shorter responses)
Haiku (fail) --> Static template response
```

### 9.4 Circuit Breaker

Per-agent circuit breaker with 5-failure threshold over 60 seconds. When open, requests are immediately routed to fallback or queued.

---

## 10. Cost Control

### 10.1 Cost Ceilings

| Scope | Ceiling | Enforcement |
|-------|---------|-------------|
| Per request | $0.05 | Orchestrator rejects if projected cost exceeds |
| Per project per day | $2.00 | Backend middleware check before routing to AI |
| Per cohort per month | $100.00 | Admin-configurable, tracked in usage table |
| Per user per day (OpenClaw) | $0.50 | Bridge agent enforces |

### 10.2 Model Routing Tiers (ADR-026)

```typescript
function selectModel(agentId: AgentId, complexity: number): ModelTier {
  // Tier 1: Static templates (no LLM)
  if (complexity < 0.1) return { model: 'template', cost: 0 };

  // Tier 2: Haiku for simple tasks
  if (complexity < 0.3 || agentId === 'openclaw-bridge') {
    return { model: 'haiku', cost: 0.0002 };
  }

  // Tier 3: Sonnet for most workers
  if (agentId !== 'orchestrator-queen') {
    return { model: 'sonnet', cost: 0.003 };
  }

  // Tier 3+: Opus for orchestrator
  return { model: 'opus', cost: 0.015 };
}
```

### 10.3 Estimated Monthly Costs (100 active projects)

| Agent | Invocations/Month | Avg Cost/Inv | Monthly Total |
|-------|-------------------|--------------|---------------|
| Orchestrator | 5,000 | $0.010 | $50.00 |
| Mentor Virtual | 500 | $0.005 | $2.50 |
| Feedback IA | 2,000 | $0.008 | $16.00 |
| Research Assistant | 400 | $0.005 | $2.00 |
| Solution Design | 600 | $0.006 | $3.60 |
| Experiment Coach | 300 | $0.005 | $1.50 |
| Narrative Builder | 200 | $0.008 | $1.60 |
| OpenClaw Bridge | 3,000 | $0.0002 | $0.60 |
| **Total** | **12,000** | -- | **$77.80** |

---

## 11. Observability

### 11.1 Logging Schema

Every AI invocation logs to the `AuditLog` table:

```typescript
{
  action: 'AI_INVOKE',
  resource: 'ai',
  resourceId: requestId,
  details: {
    agentId: string,
    model: string,
    step: number,
    module: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    latencyMs: number,
    status: 'success' | 'partial' | 'error',
    errorCode?: string,
    source: 'web' | 'openclaw',
  }
}
```

### 11.2 Metrics (Prometheus-compatible)

```
starteria_ai_requests_total{agent, model, status}
starteria_ai_latency_seconds{agent, model}
starteria_ai_tokens_total{agent, model, direction}  // input/output
starteria_ai_cost_usd_total{agent, model}
starteria_ai_errors_total{agent, error_code}
starteria_ai_circuit_breaker_state{agent}  // open/closed/half-open
```

### 11.3 Dashboard Queries

- Cost per cohort over time
- Agent utilization (invocations per agent)
- Error rate per agent (5xx, timeouts)
- Average latency per agent with p95/p99
- Token usage trends

---

## 12. Backend Module Structure

New backend modules to implement:

```
backend/
  modules/
    ai/                          # NEW: AI agent module
      ai.router.ts               # Routes for /api/v1/ai/*
      ai.controller.ts           # Request validation, response formatting
      ai.service.ts              # Orchestrator logic
      agents/
        orchestrator.agent.ts    # Queen agent: context assembly, routing
        mentor-virtual.agent.ts  # Step 0 mentor
        feedback-ia.agent.ts     # Module feedback
        research-assist.agent.ts # Step 1-B research
        solution-design.agent.ts # Step 2 HMW/ideation/DVF
        experiment-coach.agent.ts # Step 3 prototype/analysis
        narrative-builder.agent.ts # Step 4 presentation
      context/
        context-assembler.ts     # Builds AgentContext from Prisma data
        module-summarizer.ts     # Generates/caches module summaries
      cost/
        cost-tracker.ts          # Tracks usage per project/cohort
        model-router.ts          # Tier-based model selection
      types/
        agent.types.ts           # Shared TypeScript interfaces
    openclaw/                    # NEW: OpenClaw bridge module
      openclaw.router.ts         # Routes for /api/v1/openclaw/*
      openclaw.controller.ts
      openclaw.service.ts        # Bridge agent logic
      openclaw.client.ts         # HTTP client to OpenClaw API
      intent-detector.ts         # Message intent classification
      response-formatter.ts      # Platform-specific formatting
      conversation-state.ts      # Per-user conversation state machine
```

---

## 13. Frontend Integration Points

| Component | Current State | Integration Change |
|-----------|--------------|-------------------|
| `MentorVirtualPanel` | Uses `DEFAULT_FEEDBACK` mock | Call `POST /api/v1/ai/mentor-virtual` on panel open |
| `FeedbackIAPanel` | Renders mock `FeedbackIA` | Call `POST /api/v1/ai/feedback` on module submit |
| `Step1ResearchModuleV2` | Uses local `buildResearchObjective()` | Call `POST /api/v1/ai/research-assist` for AI suggestions |
| `Step2Page` (HMW section) | Manual HMW entry | Call `POST /api/v1/ai/hmw-generate` for AI options |
| `Step2Page` (Ideation) | Manual idea entry | Call `POST /api/v1/ai/ideate` for AI brainstorm |
| `Step2Page` (Test Card) | Manual experiment design | Call `POST /api/v1/ai/experiment-routes` for suggestions |
| `Step3Page` | Manual prototype + execution | Call `POST /api/v1/ai/prototype-suggest` and `/experiment-analyze` |
| `Step4Page` | Manual slide building | Call `POST /api/v1/ai/narrative-build` for structure |

### 13.1 Frontend AI Service

New service file at `front/src/app/services/aiService.ts`:

```typescript
import api from './api';

export const aiService = {
  invoke: (params: { step: number; module?: string; action: string; payload: object }) =>
    api.post('/ai/invoke', params),

  mentorVirtual: (projectId: string, step0Data: object) =>
    api.post('/ai/mentor-virtual', { projectId, step0Data }),

  feedback: (projectId: string, stepNumber: number, moduleId: string, moduleData: object) =>
    api.post('/ai/feedback', { projectId, stepNumber, moduleId, moduleData }),

  researchAssist: (projectId: string, moduleAData: object) =>
    api.post('/ai/research-assist', { projectId, moduleAData }),

  hmwGenerate: (projectId: string, synthesisData: object) =>
    api.post('/ai/hmw-generate', { projectId, synthesisData }),

  ideate: (projectId: string, hmw: string, context: object) =>
    api.post('/ai/ideate', { projectId, hmw, context }),

  experimentRoutes: (projectId: string, selectedIdea: object, dvfScores: object) =>
    api.post('/ai/experiment-routes', { projectId, selectedIdea, dvfScores }),

  prototypeSuggest: (projectId: string, testCard: object) =>
    api.post('/ai/prototype-suggest', { projectId, testCard }),

  experimentAnalyze: (projectId: string, runId: string, metrics: object, evidence: string[]) =>
    api.post('/ai/experiment-analyze', { projectId, runId, metrics, evidence }),

  narrativeBuild: (projectId: string, audience: string) =>
    api.post('/ai/narrative-build', { projectId, audience }),

  narrativeFeedback: (projectId: string, slides: object[], notes: string) =>
    api.post('/ai/narrative-feedback', { projectId, slides, notes }),

  usage: (projectId: string) =>
    api.get(`/ai/usage/${projectId}`),
};
```

---

## 14. Deployment Considerations

### 14.1 Environment Variables (New)

```env
# AI Provider
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...        # Stored in K8s secret
AI_DEFAULT_MODEL=claude-sonnet-4-20250514
AI_ORCHESTRATOR_MODEL=claude-opus-4-0-20250514

# Cost Control
AI_COST_CEILING_PER_REQUEST=0.05
AI_COST_CEILING_PER_PROJECT_DAY=2.00

# OpenClaw
OPENCLAW_API_URL=https://api.openclaw.io
OPENCLAW_API_KEY=oc-...              # Stored in K8s secret
OPENCLAW_WEBHOOK_SECRET=whsec-...    # For webhook signature verification
```

### 14.2 K8s Resource Adjustments

The AI module adds latency-sensitive outbound calls. Adjust backend deployment:

```yaml
resources:
  requests:
    memory: "512Mi"    # Up from 256Mi (context assembly buffers)
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### 14.3 Rate Limiting

Add rate limiting middleware for AI endpoints:

```
/api/v1/ai/*:       10 requests/min per user (participante)
/api/v1/ai/*:       50 requests/min per user (mentor/admin)
/api/v1/openclaw/*:  5 requests/min per sender (WSP/Telegram)
```

---

## 15. Role-Based Authorization Matrix

Every AI endpoint enforces role-based access. The backend roles are: `PARTICIPANTE` (owner), `MENTOR`, `SPONSOR`, `ADMIN`.

| Endpoint | PARTICIPANTE | MENTOR | SPONSOR | ADMIN |
|----------|:---:|:---:|:---:|:---:|
| `POST /api/v1/ai/invoke` | Own projects | Assigned projects | -- | All |
| `POST /api/v1/ai/mentor-virtual` | Own projects | -- | -- | All |
| `POST /api/v1/ai/feedback` | Own projects (submit) | Assigned (review) | -- | All |
| `POST /api/v1/ai/research-assist` | Own projects | -- | -- | All |
| `POST /api/v1/ai/hmw-generate` | Own projects | -- | -- | All |
| `POST /api/v1/ai/ideate` | Own projects | -- | -- | All |
| `POST /api/v1/ai/experiment-routes` | Own projects | -- | -- | All |
| `POST /api/v1/ai/prototype-suggest` | Own projects | -- | -- | All |
| `POST /api/v1/ai/experiment-analyze` | Own projects | Assigned | -- | All |
| `POST /api/v1/ai/narrative-build` | Own projects | -- | -- | All |
| `POST /api/v1/ai/narrative-feedback` | Own projects | Assigned | -- | All |
| `GET /api/v1/ai/usage/:projectId` | Own projects | Assigned | -- | All |
| `POST /api/v1/openclaw/webhook` | -- (system) | -- | -- | -- |
| `GET /api/v1/openclaw/conversations` | -- | -- | -- | All |
| `GET /api/v1/admin/ai/usage` | -- | -- | -- | All |

Authorization is enforced via the existing `auth.middleware.ts` with a new `aiAuthGuard` that checks project membership.

---

## 16. Implementation Priority

| Phase | Scope | Timeline | Dependencies |
|-------|-------|----------|--------------|
| **Phase 0** | Backend scaffolding: create `backend/modules/ai/` and `backend/modules/openclaw/` directories, register routes in `app.ts`, Prisma migration for `AIUsage` + `OpenClawConversation`, install `ai` + `@ai-sdk/anthropic` | Week 0 (prep) | None |
| **Phase 1** | Orchestrator + Feedback IA + `aiService.ts` frontend | Week 1-2 | Phase 0 |
| **Phase 2** | Mentor Virtual + Research Assistant | Week 3-4 | Phase 1 |
| **Phase 3** | Solution Design + Experiment Coach | Week 5-6 | Phase 1 |
| **Phase 4** | Narrative Builder | Week 7 | Phase 1 |
| **Phase 5** | OpenClaw Bridge (webhook + intent detection + state machine) | Week 8-9 | Phase 1, OpenClaw API access |

### Phase 0 Checklist (Backend Scaffolding)

```bash
# 1. Install dependencies
cd backend && npm install ai @ai-sdk/anthropic zod

# 2. Create module directories
mkdir -p backend/modules/ai/agents backend/modules/ai/context backend/modules/ai/cost backend/modules/ai/types
mkdir -p backend/modules/openclaw

# 3. Register routes in app.ts
# Add: import { aiRouter } from './modules/ai/ai.router';
# Add: import { openclawRouter } from './modules/openclaw/openclaw.router';
# Add: app.use('/api/v1/ai', aiRouter);
# Add: app.use('/api/v1/openclaw', openclawRouter);

# 4. Run Prisma migration
npx prisma migrate dev --name add-ai-usage-openclaw-models
```

---

## Appendix A: Prisma Schema Additions

```prisma
model AIUsage {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  agentId     String
  model       String
  action      String
  inputTokens Int
  outputTokens Int
  costUsd     Float
  latencyMs   Int
  status      String   // success, partial, error
  source      String   // web, openclaw
  createdAt   DateTime @default(now())

  @@index([projectId])
  @@index([agentId])
  @@index([createdAt])
}

model OpenClawConversation {
  id         String   @id @default(cuid())
  platform   String   // whatsapp, telegram
  senderId   String   // External platform ID
  userId     String?  // Mapped Starteria userId
  state      String   // Conversation state machine state
  projectId  String?  // Active project context
  messages   Json     // Conversation history (rolling window)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([platform, senderId])
  @@index([userId])
}
```
