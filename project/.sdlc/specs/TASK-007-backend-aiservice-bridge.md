---
id: TASK-007
title: "Bridge backend ↔ ai-service: HMAC + JWT propagation + cost cap"
status: ready
date: 2026-05-19
author: BHIL Tasks (Swarm)
parent: SPEC-002
sprint: S-02
estimate: 5d
adrs: [ADR-011-backend, ADR-003-backend, ADR-004-backend, ADR-010-backend]
depends_on: []
unblocks: [TASK-008]
---

# TASK-007: Bridge backend ↔ ai-service (frontera de confianza)

## 1. Objetivo

Implementar la frontera de confianza entre Express (autenticado por JWT, dueño del JWT del usuario, dueño del rate limit, dueño del cost cap) y ai-service (FastAPI, hoy sin auth, dueño de la inferencia LLM). Esta tarea lleva ADR-011 de `Proposed` a `Accepted`: convierte el archivo `backend/modules/ai/ai.proxy.ts` (hoy 23 líneas con cero callers) en el único portal saliente desde Express hacia ai-service, agrega firma HMAC-SHA256, propaga claims del JWT en un header firmado por Express, impone un techo de costo por request (`X-Cost-Cap-USD`), protege contra replay con LRU + ventana de 60s, y rodea todo con un circuit breaker que devuelve el envelope de error V1 de ADR-010.

Se hace ahora porque TASK-006 (`initiative-pdfs/`) necesita llamar a `POST /ai/pdf-extract` en ai-service (lo implementa TASK-008), y sin esta frontera de confianza la llamada quedaría sin auth — exponiendo Anthropic API key y el cost cap del proyecto a cualquier proceso con red interna.

## 2. Pre-requisitos

- **ADR-011-backend** estado actual: `Proposed`. Esta tarea es el vehículo que lo lleva a `Accepted` con evidencia: tests passing, lint rule activa, métricas Prometheus visibles.
- **ADR-003-backend** (Auth Strategy): el JWT ya es verificado por `middleware/authenticate.ts`. Esta tarea consume `req.user` (userId, role) tal cual lo deja ese middleware. No se modifica.
- **ADR-004-backend** (Authorization): los chequeos de rol (`participant` / `mentor` / `admin`) ocurren en las rutas Express antes de invocar el proxy. El proxy no decide permisos, solo los transporta.
- **ADR-010-backend** (Error envelope V1): todos los errores que el proxy devuelva al caller Express deben usar `AppError` con `code` SCREAMING_SNAKE_CASE.
- `ai-service/routers/ai.py` ya expone 11 endpoints. Esta tarea agrega un middleware FastAPI que valida HMAC + claims firmados, sin reescribir los routers internos (eso es TASK-008).
- Variables de entorno requeridas en `backend/.env` y `ai-service/.env`:
  - `BRIDGE_SHARED_SECRET_CURRENT` (32 bytes base64)
  - `BRIDGE_SHARED_SECRET_PREVIOUS` (32 bytes base64, opcional, 7 días de overlap durante rotación)
  - `BRIDGE_CLAIMS_SIGNING_KEY` (32 bytes base64, distinto del HMAC compartido)
  - `BRIDGE_HMAC_REQUIRED` (feature flag: `dual` | `required`, default `dual` durante migración)

## 3. Alcance

1. Cablear `backend/modules/ai/ai.proxy.ts` como única salida Express → ai-service. Firma `proxyToAiService(path, body, ctx)` donde `ctx` incluye `userClaims`, `costCapUsd`, `requestId`.
2. Implementar firma HMAC-SHA256 en Express (lado emisor) y verificación en ai-service (middleware FastAPI nuevo, `ai-service/middleware/bridge_auth.py`).
3. Implementar `X-User-Claims` header: Express serializa `{userId, role, projectScope}` y lo firma con `BRIDGE_CLAIMS_SIGNING_KEY` (HMAC-SHA256 sobre el JSON canónico). ai-service verifica esa firma DESPUÉS de validar la HMAC del request completo.
4. Implementar replay protection en ai-service: LRU in-memory de capacidad 10K con tuplas `(signature, timestamp)` y ventana ±60s.
5. Implementar cost cap: Express adjunta `X-Cost-Cap-USD` (decimal con 4 dígitos, ej. `0.0500`). ai-service estima el costo proyectado del request ANTES de invocar el LLM (token counter sobre prompt + estimación de tokens de salida del schema Pydantic); si proyectado > cap, devolver 402 con `code: AI_COST_CAP_EXCEEDED`.
6. Propagar `X-Bridge-Request-Id` (UUIDv7 generado por Express) hacia ai-service y de vuelta a logs, traces OpenTelemetry, y headers de respuesta de Express al frontend.
7. Implementar circuit breaker por endpoint ai-service (no global): 5 fallos consecutivos en 60s abre el breaker por 30s. Mientras esté abierto, el proxy devuelve `AppError` con `code: AI_SERVICE_UNAVAILABLE` (mapeo a ADR-010).
8. Lint rule custom (ESLint plugin local) que prohíbe `fetch(...)` y `axios(...)` con URL que apunte a `aiServiceUrl` fuera de `backend/modules/ai/ai.proxy.ts`.
9. Migrar las 11 rutas existentes de ai-service a aceptar HMAC: dual-accept (con y sin HMAC) durante 1 sprint, luego HMAC-required cuando `BRIDGE_HMAC_REQUIRED=required`.
10. Tests: unit (canonical request), integration (round-trip con mock de ai-service via supertest + httpx_mock), security (replay, timestamp expirado, secreto incorrecto, cost cap excedido), chaos (ai-service down → breaker → envelope V1).

## 4. Fuera de alcance

- **NO** se reescribe `ai-service/routers/ai.py` para reemplazar `_minimal_context` con claims reales — eso es TASK-008 (que consume los claims que esta tarea propaga).
- **NO** se cambian roles ni permisos del usuario en Express: la authorization layer (`middleware/authorize.ts`, ADR-004) sigue siendo la única fuente de verdad sobre quién puede invocar qué capability.
- **NO** se implementa el endpoint `POST /ai/pdf-extract` en ai-service — eso es TASK-008. Esta tarea lo proxea cuando exista.
- **NO** se modifica `docker-compose.yml` para mover ai-service a una red interna (`internal-ai`) — eso queda como follow-up de infra documentado en ADR-011 §5; esta tarea opera con el binding actual y agrega la HMAC como defensa en profundidad.
- **NO** se persiste `AiInvocationLog`: la capa de persistencia listada en ADR-011 §8 se implementará junto con cada caller específico (TASK-006 para PDF, futuros tasks para feedback/research).
- **NO** se agrega rate limit en Express: el rate limit de ADR-011 §6 ya existe (`middleware/rateLimit.ts`); esta tarea solo lo respeta, no lo reimplementa.

## 5. Contrato del bridge

### Headers de request (Express → ai-service)

| Nombre | Tipo | Obligatorio | Descripción | Derivado de |
|---|---|---|---|---|
| `X-Bridge-Signature` | string base64 | sí | HMAC-SHA256 sobre canonical request | `BRIDGE_SHARED_SECRET_CURRENT` |
| `X-Bridge-Timestamp` | string (epoch ms) | sí | Marca temporal de emisión en Express | `Date.now()` |
| `X-Bridge-Request-Id` | string UUIDv7 | sí | Identificador de correlación end-to-end | Generado por Express si el front no envía `X-Request-Id` |
| `X-User-Claims` | string JSON+base64 | sí | `{userId, role, projectScope}` serializado | `req.user` post-`authenticate` |
| `X-User-Claims-Signature` | string base64 | sí | HMAC-SHA256 del `X-User-Claims` con clave separada | `BRIDGE_CLAIMS_SIGNING_KEY` |
| `X-Cost-Cap-USD` | string decimal (4 dígitos) | sí | Techo absoluto en USD para este request | Política por capability (default `0.0500`) |
| `Content-Type` | `application/json` | sí | — | Estándar HTTP |

### Headers de response (ai-service → Express)

| Nombre | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `X-Bridge-Request-Id` | string UUIDv7 | sí | Eco del request id para correlación |
| `X-AI-Cost-USD` | string decimal | sí (en 2xx) | Costo real consumido por el LLM en este request |
| `X-AI-Tokens-Input` | int | sí (en 2xx) | Tokens de entrada |
| `X-AI-Tokens-Output` | int | sí (en 2xx) | Tokens de salida |
| `X-AI-Latency-Ms` | int | sí (en 2xx) | Latencia interna (excluye red Express↔ai-service) |
| `X-AI-Model` | string | sí (en 2xx) | Modelo concreto invocado (e.g. `claude-3.5-haiku-20251022`) |

### Envelope de error (Express devuelve al front, ADR-010 V1)

`{ success: false, error: { code, message, hint?, retryAfterSeconds?, requestId } }`. El proxy NUNCA filtra el body de error de ai-service al front — siempre lo mapea a un `AppError`.

### Mapeo de errores (ai-service → Express envelope)

| Causa | HTTP en ai-service | `code` en Express envelope |
|---|---|---|
| HMAC ausente o inválido | 401 | `AI_SERVICE_INTERNAL` (no se filtra detalle) |
| Timestamp fuera de ventana ±60s | 401 | `AI_SERVICE_INTERNAL` |
| Replay detectado en LRU | 409 | `BRIDGE_REPLAY_DETECTED` |
| Cost cap proyectado excede `X-Cost-Cap-USD` | 402 | `AI_COST_CAP_EXCEEDED` |
| Claims signature inválida | 401 | `AI_SERVICE_INTERNAL` |
| Validación Pydantic (422) | 422 | `AI_INVALID_INPUT` |
| Anthropic upstream timeout | 504 | `AI_UPSTREAM_TIMEOUT` |
| Anthropic upstream 5xx | 503 | `AI_UPSTREAM_UNAVAILABLE` |
| Breaker abierto en Express | 503 (sin red) | `AI_SERVICE_UNAVAILABLE` |
| 5xx no clasificado | 500/503 | `AI_SERVICE_INTERNAL` |

## 6. Algoritmo de firma HMAC

Canonical request (pseudocódigo, cada token en una línea separada por `LF`):

```
METHOD
PATH
TIMESTAMP_MS
SHA256_HEX(BODY_BYTES)
```

Donde:

- `METHOD` es upper-case (`POST`).
- `PATH` es el path absoluto incluyendo query string normalizado (ordenado alfabéticamente por nombre de parámetro). Sin scheme ni host.
- `TIMESTAMP_MS` es el mismo valor que va en `X-Bridge-Timestamp`.
- `BODY_BYTES` es el body crudo serializado (UTF-8, sin re-formatear); para `application/json` se firma el JSON tal cual fue enviado.

Firma = `base64(HMAC-SHA256(BRIDGE_SHARED_SECRET_CURRENT, canonical_request_utf8))`.

Validez ±60s respecto al reloj NTP de ai-service. Si la diferencia es > 60s → 401. Tolerancia adicional de ±5s para clock skew interno entre contenedores (la ventana efectiva es 65s pero el header `X-Bridge-Timestamp` se compara contra 60s; el extra es solo holgura).

### Rotación de secretos (procedimiento operacional)

1. Día 0: ops genera `BRIDGE_SHARED_SECRET_NEW` (32 bytes desde `/dev/urandom`).
2. Día 1: redeploy ai-service con `BRIDGE_SHARED_SECRET_CURRENT=NEW` y `BRIDGE_SHARED_SECRET_PREVIOUS=OLD`. ai-service valida con ambos durante la ventana.
3. Día 1: redeploy Express con `BRIDGE_SHARED_SECRET_CURRENT=NEW`. Express firma con NEW.
4. Día 8 (7 días después): ops borra `BRIDGE_SHARED_SECRET_PREVIOUS` de ai-service y redeploy.
5. Ningún request en vuelo debe fallar durante la ventana de overlap. Las métricas Prometheus deben mostrar 0 fallos de HMAC durante la rotación; >0 fallos = rollback inmediato.

## 7. Propagación de JWT (claims)

### Claims que SÍ se propagan en `X-User-Claims`

- `userId` (string UUID): el identificador estable del usuario (Prisma `User.id`).
- `role` (`participant` | `mentor` | `admin`): rol determinado por la authorization layer.
- `projectScope` (array de string UUID): proyectos a los que el usuario tiene acceso, ya filtrado por `verifyProjectOwnership` antes de llegar al proxy.

### Claims que NUNCA cruzan la frontera

- Refresh token bruto: queda solo en la cookie del front.
- Hash bcrypt de password: nunca sale de `users` table.
- Access token completo: ai-service no debe poder hablar con APIs upstream con la identidad del usuario.
- Email del usuario: no se propaga; ai-service usa `userId` opaco. Si TASK-008 necesita nombre del usuario, debe leerlo del read-replica Prisma — no del header.
- IP del cliente: no se propaga (privacidad). El log de Express ya lo tiene asociado a `requestId`.

### Verificación en ai-service

1. El middleware HMAC valida el request completo (incluye `X-User-Claims` en el body? No — está en headers, pero la firma HMAC del request NO cubre headers). Por eso se requiere la doble firma:
2. Verificar `X-User-Claims-Signature = HMAC-SHA256(BRIDGE_CLAIMS_SIGNING_KEY, X-User-Claims)`. Si no coincide → 401.
3. Decodificar `X-User-Claims` (base64 → JSON) y poblar `request.state.user_claims` para que los routers TASK-008 lo consuman.
4. Cualquier intento de cambiar `userId` en el body por parte de un atacante que solo controle el body falla porque el `X-User-Claims` no se altera y los routers leen `request.state.user_claims.userId`, NUNCA `body.userId`.

## 8. Cost cap por request

### Flujo

1. Express, antes de invocar el proxy, determina el cap por capability:
   - `mentor-virtual`: `0.0300`
   - `feedback`, `hmw-generate`, `ideate`, `experiment-routes`, `prototype-suggest`, `experiment-analyze`, `narrative-feedback`: `0.0500`
   - `research-assist`, `narrative-build`, `invoke`, `pdf-extract` (TASK-008): `0.1000`
2. Express adjunta el cap en `X-Cost-Cap-USD`. Decimal estricto, 4 dígitos de precisión, separador `.`.
3. ai-service, en el middleware bridge_auth (antes del router), llama a `cost_tracker.estimate(body, capability)` que:
   - Cuenta tokens del prompt ensamblado (`tiktoken` u homólogo del modelo en uso).
   - Suma el `max_tokens` de salida declarado en el schema Pydantic de la response.
   - Multiplica por la tarifa USD/1k del modelo (config `MODEL_PRICING_USD_PER_1K`).
   - Devuelve `(projected_input_cost, projected_output_cost, projected_total)`.
4. Si `projected_total > X-Cost-Cap-USD * 1.05` (margen 5% para subestimación de tokens de salida) → devolver 402 con `{code: "AI_COST_CAP_EXCEEDED", projected: 0.0612, cap: 0.0500}` y NO invocar el LLM. Express mapea a envelope V1 con `code: AI_COST_CAP_EXCEEDED`.

### Logica de refund (informativa, no se persiste en esta tarea)

Si `actual_cost < projected_total`, el header `X-AI-Cost-USD` lleva el costo real. El consumidor (TASK-006 cuando persista `AiInvocationLog`) registra el delta. Esta tarea NO escribe en BD — solo emite los headers correctos.

### Falsos positivos en prompts grandes legítimos

Si un caller necesita ejecutar un request que excede el cap por capability (e.g. `research-assist` con contexto de 8k tokens de input), el caller en Express puede pasar un override explícito (`{costCapOverrideUsd: 0.20}`) que requiere claim `role === 'admin'` para ser aceptado. El proxy verifica esto antes de poner el header. Si un `participant` intenta el override → `AppError(code: FORBIDDEN)`.

## 9. Replay protection

### Estructura

- LRU in-memory por proceso de ai-service (módulo `ai-service/middleware/replay_guard.py`).
- Capacidad: 10 000 entradas (estimado: 60s × 100 req/s en pico = 6 000, holgura 1.6x).
- Clave de la tupla: `f"{base64_signature}:{timestamp_ms}"`.
- Política de evicción: LRU (item menos recientemente accedido se descarta primero).

### Algoritmo

1. Al recibir un request validado por HMAC y dentro de la ventana ±60s, ai-service consulta el LRU con la clave.
2. Si la clave ya existe → 409 con `{code: "BRIDGE_REPLAY_DETECTED"}`. Express mapea a envelope V1 con el mismo `code` (caso raro: indica bug del caller, no del atacante).
3. Si no existe → inserta y procede.
4. Como bonus: cualquier entrada con `timestamp_ms < (Date.now() - 90_000)` se purga proactivamente cuando un nuevo request entra (limpieza barata, evita inflar el LRU innecesariamente).

### Limitación documentada

LRU in-memory NO sobrevive a restart de ai-service ni se sincroniza entre réplicas. Aceptable para esta tarea porque:
- Ventana de 60s es corta — restart frecuente no es escenario real.
- Multi-réplica no está en producción aún (ai-service corre como singleton). Cuando se escale, este módulo migrará a Redis (follow-up tracked en backlog post-ADR-011).

## 10. Circuit breaker y observabilidad

### Circuit breaker (Express, librería `opossum`)

- Una instancia por capability (no global). Listado de capabilities en §3 punto 1, más `pdf-extract` (TASK-008).
- Threshold: 5 fallos consecutivos en ventana de 60s.
- Timeout por request: P95 esperado + 50% (config por capability; default 7500ms).
- ResetTimeout: 30s (half-open: deja pasar 1 request de prueba; si éxito → cerrado, si fallo → abierto otros 30s).
- Cuando abierto: el proxy NO golpea la red, devuelve `AppError(code: AI_SERVICE_UNAVAILABLE, retryAfterSeconds: 30)`.

### Métricas Prometheus (Express)

- `bridge_requests_total{capability, status}` — counter.
- `bridge_request_duration_seconds{capability}` — histogram (buckets `[0.1, 0.5, 1, 2, 5, 10, 30]`).
- `bridge_breaker_state{capability}` — gauge (0=closed, 1=half_open, 2=open).
- `bridge_cost_cap_exceeded_total{capability}` — counter.
- `bridge_replay_detected_total` — counter.

### Métricas Prometheus (ai-service)

- `ai_service_hmac_failures_total{reason}` — counter (`reason ∈ {timestamp_skew, signature_mismatch, missing_header}`).
- `ai_service_cost_cap_rejections_total{capability}` — counter.
- `ai_service_replay_rejections_total` — counter.

### Shape de log (Express, JSON)

Campos siempre presentes en cada request al proxy: `{level, timestamp, requestId, userId, role, capability, costCapUsd, durationMs, status, breakerState, errorCode?}`. NUNCA: prompt crudo, respuesta del modelo, email, IP, refresh token.

### Trace OpenTelemetry (W3C `traceparent`)

- Span Express: `bridge.request` con attributes `bridge.capability`, `bridge.cost_cap_usd`, `bridge.request_id`, `bridge.breaker_state`.
- Span ai-service: `bridge.handle` con attributes `bridge.signature_valid`, `bridge.timestamp_skew_ms`, `bridge.cost_projected_usd`, `bridge.cost_actual_usd`.
- El `bridge.signature` (base64) NO se loguea ni se traza — sólo un hash truncado de 8 caracteres para correlación si fuese necesario.

## 11. Plan de migración (dual-accept → required)

### Sprint actual (S-02)

- Variable `BRIDGE_HMAC_REQUIRED=dual` en ambos servicios.
- Express SIEMPRE firma. ai-service ACEPTA con firma O sin firma — log al nivel `warn` cuando reciba un request sin firma, contador `ai_service_unsigned_requests_total{caller}`.
- Cero callers fuera de Express (lint rule lo garantiza). Los únicos requests sin firma posibles son: (a) test interno de ai-service mismo, (b) bug del lint rule. Ambos se monitorean.

### Sprint S-03 (un sprint después de aceptar TASK-007)

- Verificar dashboard Prometheus: `ai_service_unsigned_requests_total == 0` por 7 días corridos.
- Si verde: flip a `BRIDGE_HMAC_REQUIRED=required` primero en staging, luego prod.
- ai-service ahora rechaza con 401 cualquier request sin firma.
- Si rojo (hay tráfico sin firmar): no flippear, investigar el caller, abrir issue de regresión.

### Feature flag

- `BRIDGE_HMAC_REQUIRED` se lee al inicio del proceso de ai-service. Cambio requiere redeploy (no hot-reload). Esto es intencional: el cambio de modo es un evento operacional, no una decisión runtime.

## 12. Tests

### Unit (Express, `backend/__tests__/modules/ai/ai.proxy.test.ts`)

- `canonicalRequest` produce el formato exacto especificado en §6 para varios cuerpos (vacío, JSON pequeño, JSON con caracteres Unicode).
- `signRequest` produce una firma determinística reproducible vs un vector de prueba conocido.
- `serializeClaims` y `signClaims` separan correctamente lo permitido de lo prohibido (no debe poder pasar `passwordHash` ni `refreshToken`).
- Breaker abierto → el proxy retorna `AppError(AI_SERVICE_UNAVAILABLE)` sin tocar la red (mock de `undici.Pool`).
- Cost cap override sin `role === 'admin'` → `AppError(FORBIDDEN)`.

### Unit (ai-service, `ai-service/tests/middleware/test_bridge_auth.py`)

- Canonical request match: dado mismo cuerpo, mismo path, mismo timestamp, calcular HMAC con la misma clave y verificar contra la firma del header.
- Verifica que `X-User-Claims-Signature` con clave incorrecta → 401.
- Verifica que `request.state.user_claims` queda poblado correctamente tras parseo.

### Integration (Express, `backend/__tests__/integration/ai-bridge-roundtrip.test.ts`)

Mock de ai-service con `nock` que verifica que los headers llegan exactos:
- Round-trip `/api/v1/ai/feedback` → mock responde 200 → response del proxy contiene `X-AI-Cost-USD`, `X-AI-Tokens-Input`, `X-Bridge-Request-Id`.
- Round-trip donde el mock responde 402 (cost cap) → Express devuelve envelope V1 con `code: AI_COST_CAP_EXCEEDED`.

### Security (mezcla Express + ai-service real con `pytest-asyncio`)

- Replay rechazado: enviar el mismo (signature, timestamp) dos veces → segundo retorno 409 / `BRIDGE_REPLAY_DETECTED`.
- Timestamp expirado: enviar con `X-Bridge-Timestamp = Date.now() - 120_000` → 401.
- Secreto incorrecto: Express firma con secreto distinto al de ai-service → 401, métrica `ai_service_hmac_failures_total{reason="signature_mismatch"}` se incrementa.
- Cost cap excedido: prompt de 10k tokens con `X-Cost-Cap-USD=0.01` → 402 antes de invocar el LLM (verificar via spy que el mock de Anthropic no fue llamado).
- Claims tampering: cambiar `userId` en el header `X-User-Claims` sin re-firmar → 401.

### Chaos (`backend/__tests__/integration/ai-bridge-chaos.test.ts`)

- ai-service totalmente down (puerto cerrado, mock con `connection refused`): 5 requests fallidos en 60s → el sexto recibe envelope V1 con `code: AI_SERVICE_UNAVAILABLE` sin haber intentado conexión (verificar con spy de undici).
- Después de 30s con breaker abierto: el siguiente request es half-open. Si el mock responde 200 → breaker se cierra y los siguientes 10 requests pasan limpio.
- Clock skew: ai-service con reloj 70s atrasado vs Express → todos los requests fallan con 401. Documentar como riesgo operacional, no como bug.

## 13. Definition of Done

Esta tarea está COMPLETA cuando todos los siguientes son verificables:

- [ ] `backend/modules/ai/ai.proxy.ts` re-exporta una API tipada `proxyToAiService(path, body, ctx)` y todo el código del backend que actualmente hace `fetch(aiServiceUrl + ...)` lo usa. Verificación: `grep -RIn "aiServiceUrl" backend/modules/ | grep -v ai.proxy.ts` retorna 0 matches.
- [ ] Lint rule custom activa: `npm run lint` falla si alguien introduce `fetch(...)` o `axios.post(...)` apuntando a `aiServiceUrl` fuera del proxy. Test del rule: agregar un caller prohibido en una rama temporal y verificar que el lint falla.
- [ ] Middleware FastAPI `ai-service/middleware/bridge_auth.py` instalado en `main.py` antes de `router`. Test: arrancar ai-service sin Express y hacer `curl localhost:8001/ai/feedback` → 401.
- [ ] Cost cap funcionando: un request con `X-Cost-Cap-USD=0.0001` para `feedback` devuelve 402 sin invocar al LLM (verificado por spy/mock de Anthropic).
- [ ] Replay protection: en tests, el mismo `(signature, timestamp)` enviado 2 veces produce 409 en el segundo intento.
- [ ] Circuit breaker: forzar 5 fallos consecutivos abre el breaker; el sexto request retorna `AI_SERVICE_UNAVAILABLE` sin tocar la red.
- [ ] Tres dashboards de Grafana visibles en staging: `bridge_overview`, `bridge_costs`, `bridge_security`. Cada uno con al menos las 3 métricas Prometheus listadas en §10.
- [ ] OpenTelemetry traces visibles: un request end-to-end produce 2 spans correlacionados por `traceparent`, sin filtrar prompt ni firma.
- [ ] Tests: `npm test backend/__tests__/modules/ai/` pasa con 0 fallos; `pytest ai-service/tests/middleware/` pasa con 0 fallos.
- [ ] ADR-011 actualizado de `Proposed` a `Accepted` con fecha 2026-05-19, en un commit aparte.
- [ ] PR abierto (no mergeado) con título `feat(TASK-007): bridge backend↔ai-service con HMAC + JWT propagation + cost cap`.
- [ ] `project/.sdlc/knowledge/progress-TASK-007-2026-05-19.md` escrito.

## 14. Estimación

5 días en 5 fases secuenciales, validables independientemente:

| Fase | Trabajo | Días | Validación |
|---|---|---|---|
| A | Librería de firma HMAC: `signRequest`, `verifyRequest`, canonical request builder, vectores de prueba. Aplica a ambos lados (Express en TS, ai-service en Python — código distinto, mismos vectores). | 1d | Unit tests verdes en ambos lados con vectores compartidos. |
| B | Propagación de JWT claims: `serializeClaims`, `signClaims`, middleware FastAPI que pobla `request.state.user_claims`. Auditoría de qué claims pueden cruzar. | 1d | Unit tests + revisión de seguridad: lista de claims aprobados firmada en PR. |
| C | Cost cap + replay protection: estimación de tokens en `cost_tracker.estimate`, LRU replay guard, header propagation. | 1d | Tests de seguridad pasan (cost cap excedido, replay rechazado, timestamp expirado). |
| D | Circuit breaker + observabilidad: `opossum` por capability, métricas Prometheus, spans OpenTelemetry, dashboards Grafana en staging. | 1d | Chaos test pasa (breaker abre y cierra correctamente); dashboards rinden con datos sintéticos. |
| E | Migración de los 11 endpoints existentes + lint rule + flag `dual` activo. ADR-011 movido a `Accepted`. | 1d | `grep` ya no encuentra callers fuera del proxy; lint rule falla en PR test; ADR-011 en `Accepted`. |

Notas operacionales: las fases A y B pueden paralelizarse parcialmente (dos personas), pero la suite de tests se vuelve frágil si la firma cambia mientras se programa claims. Recomendado serial salvo que el equipo sea grande.

## 15. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Clock skew entre contenedores** desfasa la ventana de 60s y todos los requests fallan con 401. | Media | Alta | Documentar requirement de NTP en infra. Ventana efectiva interna de ±65s en ai-service da 5s de holgura. Métrica `bridge_timestamp_skew_ms` (histogram) alerta a partir de p99 > 10s. |
| **Outage durante rotación de secretos**: alguien borra `BRIDGE_SHARED_SECRET_PREVIOUS` antes del día 8 y los requests in-flight con la firma vieja fallan. | Baja | Alta | Runbook operacional aprobado por security antes de la primera rotación. Pre-flight: confirmar via métrica Prometheus que la última firma con `PREVIOUS` fue hace > 7 días antes de borrar. |
| **Cost cap falso positivo** rechaza requests legítimos grandes (e.g. `research-assist` con contexto enorme). | Media | Media | Override admin documentado (§8). Métrica `bridge_cost_cap_exceeded_total{capability}` permite ver patrones. Si un caller específico (TASK-008 PDF extract) excede consistentemente, ajustar la política por capability sin código (config). |
| **LRU replay guard inflado** en pico de tráfico hace que se evicten entradas legítimas y un replay real pase. | Baja | Media | Tamaño 10k validado en §9 (margen 1.6x sobre pico esperado). Métrica `bridge_lru_evictions_per_minute` (counter) alerta si > 100/min sostenido. Plan B: migrar a Redis (backlog post-ADR-011). |
| **Tokens estimados ≠ tokens reales**: la estimación pre-LLM subestima el output y el costo real supera el cap proyectado. | Media | Baja | Margen del 5% (§8). El costo real va en `X-AI-Cost-USD` para auditoría posterior. Si patrón sistemático, calibrar el estimador con datos reales. |
| **Endpoint sin firmar olvidado durante migración** queda accesible en modo `dual` y un attacker con red interna lo invoca. | Baja | Alta | Lint rule + métrica `ai_service_unsigned_requests_total` con alerta > 0. Pre-condición para flip a `required`: 7 días consecutivos con esa métrica en 0. |
| **Doble firma confunde a operadores** que debuggean producción y ven dos headers HMAC distintos (`X-Bridge-Signature` + `X-User-Claims-Signature`). | Alta | Baja | Runbook documenta la diferencia. Logs marcan cuál falló (`reason ∈ {request_signature, claims_signature}`). |

---

*Task generado siguiendo BHIL AI-First Development Toolkit. Hand-offs: TASK-006 (`backend/modules/initiative-pdfs/`) es el primer caller real; TASK-008 (router `POST /ai/pdf-extract` en ai-service) es el primer callee real. Esta tarea define la frontera de confianza entre ambos.*
