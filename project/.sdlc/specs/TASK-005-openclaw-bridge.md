---
id: TASK-005
title: "Implementar OpenClaw Bridge para integracion WhatsApp/Telegram"
status: ready
spec: SPEC-001
adrs: [ADR-001, ADR-002, ADR-003]
sprint: S-01
parallel: false
depends_on: [TASK-002]
estimated_tokens: 32K
session_handoff: null
---

# TASK-005: OpenClaw Bridge (Phase 4)

## Task context

**Feature:** Sistema Multi-Agente IA (SPEC-001)
**Purpose:** Implementar el modulo completo de integracion OpenClaw que conecta canales externos WhatsApp y Telegram con el Orchestrator. Incluye el router/controller/service, el cliente HTTP hacia OpenClaw API, el detector de intents, el formateador de respuestas por plataforma, la maquina de estados de conversacion, y la verificacion de firma HMAC-SHA256 del webhook.
**Session type:** Fresh start

---

## Session start instructions

```
Session context for TASK-005:

Read these files in order before doing anything else:
1. project/.sdlc/context/architecture.md        -> project architectural constraints
2. docs/adr/ADR-001.md                          -> topologia Orchestrator-Worker
3. project/.sdlc/specs/SPEC-001-multiagent-system.md -> feature specification (API contracts para /openclaw/*)
4. docs/architecture-multiagent.md (secciones 2.8, 8) -> OpenClaw Bridge agent + integration architecture
5. backend/modules/ai/types/agent.types.ts      -> interfaces del sistema
6. backend/modules/ai/agents/orchestrator.agent.ts -> orchestrator para forwarding
7. backend/modules/openclaw/                     -> stubs creados en TASK-001
8. project/.sdlc/knowledge/progress-TASK-002-[date].md -> estado previo

Confirm understanding by stating:
- What you will implement
- Which files you will create or modify (list them)
- What the definition of done is

Wait for my confirmation before proceeding.
```

---

## Scope

### Files to CREATE

| File path | Purpose |
|---|---|
| `backend/__tests__/modules/openclaw/openclaw.test.ts` | Tests unitarios del servicio OpenClaw |
| `backend/__tests__/modules/openclaw/intent-detector.test.ts` | Tests unitarios del detector de intents |
| `backend/__tests__/modules/openclaw/conversation-state.test.ts` | Tests unitarios de la maquina de estados |
| `backend/__tests__/modules/openclaw/webhook-signature.test.ts` | Tests unitarios de verificacion de firma |
| `backend/__tests__/modules/openclaw/openclaw.integration.test.ts` | Tests integracion endpoints /openclaw/* |

### Files to MODIFY

| File path | Change description |
|---|---|
| `backend/modules/openclaw/openclaw.router.ts` | Reemplazar stubs 501 con rutas reales: POST /webhook, POST /send, GET /conversations/:userId |
| `backend/modules/openclaw/openclaw.controller.ts` | Implementar handlers con validacion Zod, verificacion de firma HMAC |
| `backend/modules/openclaw/openclaw.service.ts` | Implementar logica del bridge: parse intent -> build request -> forward to orchestrator -> format response -> send back |
| `backend/modules/openclaw/openclaw.client.ts` | Implementar HTTP client hacia OpenClaw API con retry y circuit breaker |
| `backend/modules/openclaw/intent-detector.ts` | Implementar clasificacion de intents desde mensajes conversacionales |
| `backend/modules/openclaw/response-formatter.ts` | Implementar formateo de respuestas por plataforma (WhatsApp/Telegram limits) |
| `backend/modules/openclaw/conversation-state.ts` | Implementar maquina de estados per-user con persistencia en Prisma |

### Files to NOT TOUCH

- `backend/modules/ai/agents/` -- todos los agentes ya implementados en TASK-002/003/004
- `backend/modules/ai/ai.router.ts` -- ya implementado
- `backend/modules/auth/` -- modulo de autenticacion existente
- `backend/modules/projects/` -- modulo de proyectos existente
- `front/src/app/` -- no hay integracion frontend para OpenClaw (channel-only)
- `docs/adr/` -- ADRs no se modifican en tasks de implementacion

---

## Implementation specification

### Interfaces and signatures

```typescript
// backend/modules/openclaw/openclaw.router.ts

import { Router } from 'express';

export const openclawRouter: Router;
// POST /webhook  -> openclawController.handleWebhook
// POST /send     -> openclawController.sendMessage
// GET  /conversations/:userId -> openclawController.getConversations
```

```typescript
// backend/modules/openclaw/openclaw.controller.ts

export class OpenClawController {
  constructor(
    private readonly openclawService: OpenClawService
  ) {}

  async handleWebhook(req: Request, res: Response): Promise<void> {
    // 1. Verify HMAC-SHA256 signature
    // 2. Verify timestamp (5min replay window)
    // 3. Parse body
    // 4. Forward to service (async)
    // 5. Return { status: 'received' } immediately
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    // 1. Validate body
    // 2. Forward to OpenClaw client
    // 3. Return { status: 'sent', messageId }
  }

  async getConversations(req: Request, res: Response): Promise<void> {
    // 1. Verify admin role
    // 2. Query conversations by userId
    // 3. Return { data: Conversation[] }
  }
}
```

```typescript
// backend/modules/openclaw/openclaw.service.ts

import { OrchestratorAgent } from '../ai/agents/orchestrator.agent';

export class OpenClawService {
  constructor(
    private readonly orchestrator: OrchestratorAgent,
    private readonly intentDetector: IntentDetector,
    private readonly responseFormatter: ResponseFormatter,
    private readonly conversationState: ConversationStateMachine,
    private readonly openclawClient: OpenClawClient
  ) {}

  async processIncoming(webhook: IncomingWebhook): Promise<void> {
    // 1. Get or create conversation state
    // 2. Detect intent from message
    // 3. Map senderId to userId (phone-to-user lookup)
    // 4. Build structured request for Orchestrator
    // 5. Invoke Orchestrator
    // 6. Format response for platform
    // 7. Send response via OpenClaw client
    // 8. Update conversation state
  }
}

export interface IncomingWebhook {
  platform: 'whatsapp' | 'telegram';
  senderId: string;
  message: string;
  media?: Record<string, unknown>;
  timestamp: string;
}
```

```typescript
// backend/modules/openclaw/openclaw.client.ts

export class OpenClawClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) {}

  async send(params: {
    platform: string;
    recipientId: string;
    message: string;
    buttons?: Array<{ text: string; url?: string; callback?: string }>;
  }): Promise<{ messageId: string }> {
    // HTTP POST to OpenClaw API with retry (max 2 retries, exponential backoff)
  }
}
```

```typescript
// backend/modules/openclaw/intent-detector.ts

export type ConversationalIntent = {
  action: string;       // 'feedback' | 'assist' | 'generate' | 'status'
  step: number | null;  // 0-4 or null if ambiguous
  module: string | null; // 'A' | 'B' | 'C' | 'D' or null
  confidence: number;   // 0.0 - 1.0
};

export class IntentDetector {
  async detect(message: string, conversationHistory: string[]): Promise<ConversationalIntent> {
    // Option A: Rule-based (keywords + patterns) for high-confidence intents
    // Option B: LLM-based (Haiku) for ambiguous messages
    // Combine: try rules first, fall back to Haiku if confidence < 0.7
  }
}
```

```typescript
// backend/modules/openclaw/response-formatter.ts

export class ResponseFormatter {
  format(
    platform: 'whatsapp' | 'telegram',
    agentResponse: Record<string, unknown>
  ): { message: string; buttons?: Array<{ text: string; url?: string; callback?: string }> } {
    // 1. Convert structured response to readable text
    // 2. Truncate to platform limit (4096 chars)
    // 3. Convert markdown to platform format
    // 4. Add action buttons if applicable
  }
}
```

```typescript
// backend/modules/openclaw/conversation-state.ts

export type ConversationState =
  | 'idle'
  | 'awaiting_project_selection'
  | 'awaiting_step_selection'
  | 'awaiting_module_input'
  | 'processing'
  | 'awaiting_confirmation';

export class ConversationStateMachine {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreate(platform: string, senderId: string): Promise<{
    state: ConversationState;
    projectId: string | null;
    userId: string | null;
  }> {
    // Get from OpenClawConversation table, create if not exists
  }

  async transition(
    platform: string,
    senderId: string,
    newState: ConversationState,
    context?: { projectId?: string; userId?: string }
  ): Promise<void> {
    // Update state in OpenClawConversation
  }

  async appendMessage(
    platform: string,
    senderId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    // Append to messages JSON (rolling window of last 20 messages)
  }
}
```

### Business logic (step by step)

```
WEBHOOK PROCESSING FLOW:
1. Recibir POST /api/v1/openclaw/webhook
2. Verificar firma HMAC-SHA256:
   a. Extraer x-openclaw-signature y x-openclaw-timestamp de headers
   b. Verificar que timestamp esta dentro de ventana de 5 minutos
   c. Calcular HMAC-SHA256(timestamp + '.' + body) con OPENCLAW_WEBHOOK_SECRET
   d. Comparar con firma recibida (timing-safe comparison)
   IF firma invalida: return 401 Unauthorized
3. Parsear body del webhook
4. Retornar { status: 'received' } inmediatamente (202 Accepted)
5. Procesar asincrono:
   a. conversationState.getOrCreate(platform, senderId)
   b. intentDetector.detect(message, conversationHistory)
      - "Como va mi proyecto?" -> { action: 'status', step: null }
      - "Ayuda con la investigacion" -> { action: 'assist', step: 1, module: 'B' }
      - "Revisa mi modulo A" -> { action: 'feedback', step: 1, module: 'A' }
   c. Mapear senderId a userId via User.phone lookup
      IF no match: enviar mensaje "No encontramos tu cuenta. Registrate en..."
   d. Construir AIInvokeRequest desde intent
   e. Invocar orchestrator.invoke()
   f. responseFormatter.format(platform, orchestratorResponse)
   g. openclawClient.send(formattedResponse)
   h. conversationState.appendMessage() para ambos mensajes
   i. conversationState.transition() al nuevo estado

HMAC VERIFICATION:
1. Extraer signature = headers['x-openclaw-signature']
2. Extraer timestamp = headers['x-openclaw-timestamp']
3. Verificar: Math.abs(Date.now() - parseInt(timestamp)) < 300000 (5 min)
4. Calcular: expected = HMAC-SHA256(timestamp + '.' + JSON.stringify(body), secret)
5. Comparar: crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
```

### Error handling

| Error condition | Detection | Response |
|---|---|---|
| Firma HMAC invalida | timingSafeEqual retorna false | Return 401 Unauthorized, log security event |
| Timestamp fuera de ventana 5min | Date.now() - timestamp > 300000 | Return 401 Unauthorized, log replay attempt |
| OPENCLAW_WEBHOOK_SECRET no configurado | env variable undefined | Throw startup error, no registrar ruta |
| senderId no mapeado a userId | User.phone lookup retorna null | Enviar mensaje de registro al usuario, no invocar orchestrator |
| Intent no detectado (confidence < 0.5) | IntentDetector confidence check | Enviar mensaje "No entendi tu mensaje. Intenta con..." con opciones |
| OpenClaw API send falla | HTTP error en client | Retry 2 veces con backoff; si falla, log error (no afecta usuario ya que respuesta fue asincrona) |
| Orchestrator error | AgentResponse.status === 'error' | Enviar mensaje generico "Hubo un error procesando tu solicitud" |
| Mensaje excede limite plataforma | message.length > 4096 | Truncar con "..." y agregar nota "Respuesta completa en la plataforma web" |

---

## Test requirements

### Write tests FIRST

1. Escribir todos los tests -- deben FALLAR inicialmente
2. Commit: `git commit -m "test: TASK-005 failing tests"`
3. Implementar hasta que tests pasen
4. NO modificar archivos de test durante implementacion

### Unit tests

**File:** `backend/__tests__/modules/openclaw/webhook-signature.test.ts`

```typescript
describe('Webhook Signature Verification', () => {
  it('should accept valid HMAC-SHA256 signature', () => {
    const body = '{"platform":"whatsapp","senderId":"123","message":"hola"}';
    const timestamp = String(Date.now());
    const secret = 'test-secret';
    const signature = computeHMAC(timestamp, body, secret);
    expect(verifySignature(signature, timestamp, body, secret)).toBe(true);
  });

  it('should reject invalid signature', () => {
    expect(verifySignature('invalid', String(Date.now()), '{}', 'secret')).toBe(false);
  });

  it('should reject timestamp outside 5 minute window', () => {
    const oldTimestamp = String(Date.now() - 400000); // 6+ minutes ago
    expect(verifyTimestamp(oldTimestamp)).toBe(false);
  });

  it('should accept timestamp within 5 minute window', () => {
    const recentTimestamp = String(Date.now() - 60000); // 1 minute ago
    expect(verifyTimestamp(recentTimestamp)).toBe(true);
  });
});
```

**File:** `backend/__tests__/modules/openclaw/intent-detector.test.ts`

```typescript
describe('IntentDetector', () => {
  describe('detect', () => {
    it('should detect status intent from "como va mi proyecto"', async () => {
      const result = await detector.detect('Como va mi proyecto?', []);
      expect(result.action).toBe('status');
    });

    it('should detect assist intent from "ayuda con la investigacion"', async () => {
      const result = await detector.detect('Ayuda con la investigacion', []);
      expect(result.action).toBe('assist');
      expect(result.step).toBe(1);
      expect(result.module).toBe('B');
    });

    it('should detect feedback intent from "revisa mi modulo A"', async () => {
      const result = await detector.detect('Revisa mi modulo A', []);
      expect(result.action).toBe('feedback');
      expect(result.module).toBe('A');
    });

    it('should return low confidence for ambiguous messages', async () => {
      const result = await detector.detect('hola', []);
      expect(result.confidence).toBeLessThan(0.7);
    });

    // Edge cases:
    // - Message in English instead of Spanish
    // - Message with typos
    // - Empty message
  });
});
```

**File:** `backend/__tests__/modules/openclaw/conversation-state.test.ts`

```typescript
describe('ConversationStateMachine', () => {
  describe('getOrCreate', () => {
    it('should create new conversation with idle state', async () => {
      const conv = await machine.getOrCreate('whatsapp', 'new-sender');
      expect(conv.state).toBe('idle');
    });

    it('should return existing conversation', async () => {
      await machine.getOrCreate('whatsapp', 'existing-sender');
      const conv = await machine.getOrCreate('whatsapp', 'existing-sender');
      expect(conv).toBeDefined();
    });
  });

  describe('transition', () => {
    it('should update state in database', async () => {
      await machine.transition('whatsapp', 'sender1', 'processing');
      const conv = await machine.getOrCreate('whatsapp', 'sender1');
      expect(conv.state).toBe('processing');
    });
  });

  describe('appendMessage', () => {
    it('should maintain rolling window of 20 messages', async () => {
      for (let i = 0; i < 25; i++) {
        await machine.appendMessage('whatsapp', 'sender1', 'user', `msg ${i}`);
      }
      // Verify only last 20 are kept
    });
  });
});
```

### Integration tests

**File:** `backend/__tests__/modules/openclaw/openclaw.integration.test.ts`

Test the complete flow including:
- [ ] Happy path: POST /api/v1/openclaw/webhook con firma valida procesa mensaje
- [ ] Happy path: POST /api/v1/openclaw/send envia mensaje a OpenClaw API
- [ ] Happy path: GET /api/v1/openclaw/conversations/:userId retorna historial (admin)
- [ ] Error path: POST /api/v1/openclaw/webhook sin firma retorna 401
- [ ] Error path: POST /api/v1/openclaw/webhook con timestamp expirado retorna 401
- [ ] Error path: GET /api/v1/openclaw/conversations/:userId sin rol admin retorna 403
- [ ] Boundary: mensaje de WhatsApp con media object

---

## Acceptance criteria

- [ ] **AC-001:** POST /api/v1/openclaw/webhook verifica firma HMAC-SHA256 y rechaza firmas invalidas con 401
- [ ] **AC-002:** POST /api/v1/openclaw/webhook rechaza timestamps fuera de ventana de 5 minutos
- [ ] **AC-003:** Intent detector clasifica correctamente al menos: status, assist (investigacion), feedback (modulo)
- [ ] **AC-004:** Conversation state machine persiste estado en tabla OpenClawConversation via Prisma
- [ ] **AC-005:** Response formatter trunca mensajes a 4096 chars y convierte markdown a formato de plataforma
- [ ] **AC-006:** OpenClaw client implementa retry con backoff exponencial (max 2 retries)
- [ ] **AC-007:** POST /api/v1/openclaw/send envia mensaje y retorna messageId
- [ ] **AC-008:** GET /api/v1/openclaw/conversations/:userId requiere rol admin
- [ ] **AC-009:** Mensajes de usuario no mapeado reciben respuesta de registro
- [ ] **AC-010:** Rolling window de conversacion mantiene maximo 20 mensajes

**For AI-native components:**
- [ ] **AC-AI-001:** `npx promptfoo eval --config evals/openclaw-intent.yaml` passes at >= 0.90 intent accuracy, 50 cases

---

## Definition of done

This task is COMPLETE when:

- [ ] All acceptance criteria above pass
- [ ] `npm run lint` passes with 0 errors
- [ ] TypeScript compiles with 0 errors (`npm run build`)
- [ ] PR opened (not merged) with title: `feat(TASK-005): OpenClaw Bridge para WhatsApp/Telegram`
- [ ] `project/.sdlc/knowledge/progress-TASK-005-[date].md` written
- [ ] No files modified outside the scope section above

---

## Session close instructions

Before ending this session, write `project/.sdlc/knowledge/progress-TASK-005-[date].md`:

```markdown
# Progress: TASK-005 -- [date]

## Completed
- [bullet: what was done]
- [bullet: what was done]

## Test status
- Unit tests: [X]/[total] passing
- Integration tests: [X]/[total] passing
- Known failures: [describe if any]

## Files created/modified
- `[path]` -- [what changed]

## Decisions made
- [Any decision that should become an ADR draft]

## Next steps
- [Exact first action for next session]
- [Any remaining acceptance criteria not yet met]

## Questions for spec update
- [Any ambiguity discovered that should update SPEC-001]
```

---

*Task generado siguiendo BHIL AI-First Development Toolkit*
