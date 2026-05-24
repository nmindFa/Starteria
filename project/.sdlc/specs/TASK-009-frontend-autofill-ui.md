---
id: TASK-009
title: "Frontend: hook usePdfAutofill + UI de provenance + integración en Steps 0-4"
status: ready
date: 2026-05-19
author: BHIL Tasks (Swarm)
parent: SPEC-002
sprint: S-02
estimate: 8d
adrs: [ADR-005, ADR-002]
depends_on: [TASK-006, TASK-008, TASK-010]
unblocks: []
---

# TASK-009: Frontend del auto-rellenado IA — uploader, hook, provenance UI e integración Steps 0-4

## 1. Objetivo

Construir toda la capa frontend del auto-rellenado desde PDFs (PRD-002), aterrizando el contrato de UX definido en ADR-005. Esto incluye: (a) un uploader real de PDFs de iniciativa que reemplaza el stub actual, (b) el hook `usePdfAutofill` que arranca y poolea una corrida de extracción, (c) un slice de contexto `autofillProposals` que sostiene el ciclo unconfirmed → confirmed / edited / discarded, (d) un componente `<AutofillField>` que expresa los cuatro estados visuales + variante de conflicto con tres canales perceptuales (ícono + borde + label), (e) la UI de conflicto multi-PDF (US-011), (f) el approval gate del Step 4 (US-017) y (g) la integración real de ~50 fieldPaths en Step0Page..Step4Page conectados a los endpoints de persistencia del backend (TASK-006). Todo detrás de un feature flag `feature.pdfAutofill` por usuario, con telemetría para validar las bandas de aceptación de US-008/US-009/US-017 y los success metrics de PRD-002.

---

## 2. Pre-requisitos

| Pre-requisito | Origen | Estado esperado al iniciar TASK-009 |
|---|---|---|
| Endpoints REST para confirmar / editar / descartar / merge de propuestas | TASK-006 | Disponibles en `/api/v1/initiatives/:id/autofill-proposals/...` con contratos documentados |
| Pipeline de extracción PDF (parseo + agente + emisión de propuestas con provenance) | TASK-008 | Una corrida `POST /api/v1/initiatives/:id/autofill-runs` devuelve `runId` y `GET .../autofill-runs/:runId` reporta `status` y, al terminar, `proposals[]` que cumplen el contrato lógico del ADR-005 §"Provenance data contract" |
| Persistencia backend para Steps 2/3/4 | TASK-010 (declarado en apéndice) | `stepService.saveStepData` operativo en Steps 2, 3 y 4 con modelos Prisma equivalentes a los de Step 1 |
| Tokens de diseño (colores, tipografía, sombras) | `front/src/app/components/ui` | Disponibles — TASK-009 no inventa tokens nuevos |
| Feature-flag service | `front/src/app/services/featureFlags.ts` | Disponible o se crea aquí como utilidad mínima (`isEnabled('feature.pdfAutofill', userId)`) |

Si TASK-010 no está cerrada al momento de empezar, TASK-009 puede arrancar por la rama A→D del plan (uploader + hook + context + componente) pero la integración en Steps 2/3/4 queda bloqueada — debe negociarse con el squad de backend antes de iniciar la fase F.

---

## 3. Alcance

Esta tarea entrega, en orden de dependencia:

1. **Componente nuevo `PdfInitiativeUploader`** — drag-and-drop específico para PDFs de iniciativa, presign → PUT directo a storage → confirm en backend, ≤10 archivos por iniciativa, ≤50 MB por archivo, PDF-only, feedback por archivo (subiendo, listo, error). Sustituye únicamente el flujo del uploader de PDFs de iniciativa; el `EvidenceUploader` actual permanece intacto para subir evidencia dentro de los módulos.
2. **Hook nuevo `usePdfAutofill(initiativeId)`** — arranca una corrida de extracción, poolea con backoff exponencial truncado, expone `{ status, proposals, error }` y consolida el resultado en el slice de contexto.
3. **Slice nuevo `autofillProposals`** en `AppContext` — fuente de verdad en cliente del estado por campo (`unconfirmed` / `confirmed` / `edited` / `discarded`) + provenance + reductor con acciones tipificadas.
4. **Componente nuevo `<AutofillField>`** — wrapper de input que aplica el contrato visual completo de ADR-005 (4 estados + conflicto), shortcuts Enter / E / Supr, ARIA, popover de provenance.
5. **UI de conflicto multi-PDF** (US-011) — variante del estado `ai-proposed-unconfirmed` con selección explícita por fuente.
6. **Approval gate de Step 4** (US-017) — banner persistente con contador, deep-links a campos pendientes, bloqueo del CTA "Enviar a revisión" mientras existan unconfirmed.
7. **Integración en Step0Page..Step4Page** — sustituir los inputs nativos de ~50 fieldPaths por `<AutofillField>`, lista declarada en §13.
8. **Wiring de persistencia** contra los endpoints de TASK-006 para cada acción (Confirmar / Editar / Descartar / Seleccionar fuente).
9. **Feature flag y telemetría** — `feature.pdfAutofill`, eventos `field_autofill_*` con las dimensiones necesarias para validar PRD-002.
10. **Accesibilidad WCAG 2.1 AA** — auditoría axe-core sin violaciones nuevas en cualquiera de los estados.

---

## 4. Fuera de alcance

- Backend de extracción, agente IA, prompts y modelo (TASK-008 / ADR-004).
- Storage de PDFs, cifrado en reposo, lifecycle y borrado (ADR de PDF storage, fuera de TASK-009).
- Detección y enmascarado de PII (vive en backend, asume cumplido al recibir propuestas).
- Persistencia backend de Steps 2/3/4 (TASK-010, declarada en apéndice).
- Modificaciones a `EvidenceUploader.tsx` que afecten su uso actual para subir evidencia dentro de módulos.
- Re-skin general del Step 0..4. El cambio visual se limita al wrapping de inputs por `<AutofillField>` y al banner del gate.
- Mentor view del audit trail (US-014 lado mentor). TASK-009 expone solo el lado founder.
- Telemetría infraestructural (instrumentación de logs, dashboards). Esta TASK emite los eventos; el dashboard se crea en una TASK separada.

---

## 5. Componentes nuevos

| Nombre | Path | Propósito | Props (resumen prosa) |
|---|---|---|---|
| `PdfInitiativeUploader` | `front/src/app/components/PdfInitiativeUploader.tsx` | Drag-and-drop específico para PDFs de iniciativa, integra presign → upload directo → confirm en backend, lista archivos con estado por archivo (queued, uploading, ready, failed), detecta idioma cuando el backend lo reporta. | Recibe `initiativeId`, callback `onUploadComplete(pdfId)`, callback opcional `onAllReady()` para disparar autofill, y un flag `disabled` para cuando el feature flag está apagado. |
| `usePdfAutofill` | `front/src/app/hooks/usePdfAutofill.ts` | Hook React que recibe `initiativeId`, arranca una corrida de extracción contra TASK-008, poolea hasta done/failed/timeout, despacha `MERGE_FROM_RUN` al slice de contexto y expone `{ status, proposals, error, start, cancel }`. | API: `usePdfAutofill(initiativeId)` → `{ status: 'idle' \| 'running' \| 'done' \| 'failed' \| 'timeout', proposals, error, start(scope), cancel() }`. |
| `AutofillField` | `front/src/app/components/AutofillField.tsx` | Wrapper de campo con el contrato visual de ADR-005. Resuelve estado, dibuja borde + ícono + label, expone popover de provenance, instala shortcuts y persiste vía servicios de TASK-006. | Recibe `fieldPath`, `value`, `onChange`, `inputType` (`text` / `textarea` / `select` / `multiselect` / `enum`), `enumOptions` opcional, `placeholder`, `ariaLabel`, `highImpact` (boolean para mostrar confirmación adicional en Confirmar). |
| `ProvenancePopover` | `front/src/app/components/ProvenancePopover.tsx` | Subcomponente de `AutofillField`. Renderiza nombre de PDF, páginas, extracto ≤280 chars, banda de confianza y, si hay traducción, el extracto original colapsable. | Recibe el objeto provenance del campo y un flag `open`. |
| `AutofillConflictField` | `front/src/app/components/AutofillConflictField.tsx` | Variante de `AutofillField` para US-011. Lista las fuentes en conflicto en tarjetas con radio button y CTA "Confirmar esta fuente". | Recibe `fieldPath` y los `competingValues[]` con su provenance. |
| `ApprovalGateBanner` | `front/src/app/components/ApprovalGateBanner.tsx` | Banner persistente en Step 4 con contador, lista expandible y CTA "Enviar a revisión" deshabilitado mientras N > 0. | Recibe `initiativeId`, lee del slice `autofillProposals` el conteo de unconfirmed, expone callback `onSubmit()` que solo dispara si N=0. |
| `useAutofillProposals` | `front/src/app/hooks/useAutofillProposals.ts` | Hook utilitario que selecciona del contexto la propuesta del `fieldPath`, su estado actual y exporta callbacks `confirm()`, `edit(newValue)`, `discard()`, `restore()`. | API: `useAutofillProposals(fieldPath)` → `{ proposal, confirm, edit, discard, restore, selectConflictSource }`. |
| `featureFlags` (si no existe) | `front/src/app/services/featureFlags.ts` | Lectura simple del flag `feature.pdfAutofill` por usuario, por defecto `false` en producción, override por env para staging. | API: `isEnabled(flagId: string, userId?: string): boolean`. |

---

## 6. Hook `usePdfAutofill`

### Firma prosa
`usePdfAutofill(initiativeId)` retorna un objeto con `status`, `proposals`, `error`, y dos métodos imperativos `start(scope)` y `cancel()`. El parámetro `scope` indica qué Steps procesar — `'step0'`, `'step1'`, …, `'step4'`, o `'all'`. El hook NO se auto-dispara con el montaje; el founder lo gatilla.

### Pseudocódigo de la firma (≤ 10 líneas)

```ts
export function usePdfAutofill(initiativeId: string): {
  status: 'idle' | 'running' | 'done' | 'failed' | 'timeout';
  proposals: AutofillProposal[];
  error: AutofillError | null;
  start: (scope: 'step0' | 'step1' | 'step2' | 'step3' | 'step4' | 'all') => Promise<void>;
  cancel: () => void;
}
```

### Lifecycle

1. `start(scope)` hace `POST /api/v1/initiatives/:id/autofill-runs` con el scope; recibe `{ runId }` y cambia `status` a `'running'`.
2. Empieza a poolear `GET /api/v1/initiatives/:id/autofill-runs/:runId` con la estrategia de backoff descrita abajo.
3. Cuando el backend reporta `status: 'done'`, el hook recoge `proposals[]`, despacha `MERGE_FROM_RUN` al contexto y pasa a `'done'`.
4. Si reporta `status: 'failed'`, recoge el error tipificado y pasa a `'failed'`.
5. Si se acumulan 120 s de poll sin terminar, el hook pasa a `'timeout'` y emite `error: { code: 'AUTOFILL_TIMEOUT' }`.
6. `cancel()` aborta el poll y deja `status: 'idle'`; las propuestas ya cargadas vía un `MERGE_FROM_RUN` previo NO se revierten.

### Backoff de polling

Intervalos en milisegundos: `500, 1000, 2000, 4000, 4000, 5000, 5000, …` capados a 5000 ms a partir del sexto intento. Tiempo total máximo de poll: 120 000 ms. Si en cualquier intento el HTTP retorna 5xx, se reintenta con el siguiente intervalo (no se trata como fallo definitivo). Si retorna 4xx, se aborta inmediatamente con `error.code` derivado del payload.

### Estados de error tipificados

| Código | Cuándo se emite | UI esperada |
|---|---|---|
| `AUTOFILL_TIMEOUT` | 120 s sin done/failed | Toast persistente "La extracción tarda más de lo normal. Puedes reintentarlo o continuar manualmente." con CTA "Reintentar". |
| `AUTOFILL_RUN_NOT_FOUND` | 404 al poolear | Toast "No pudimos encontrar la corrida de extracción. Reintenta." con CTA "Reintentar". |
| `AUTOFILL_UNAUTHORIZED` | 401/403 | Redirect a login si 401; toast permisos si 403. |
| `AUTOFILL_COST_CEILING` | 402/429 con `code: 'COST_CEILING'` | Banner con copy de US-013 (techo de costo). |
| `AUTOFILL_UNKNOWN` | Resto | Toast genérico con CTA "Reintentar". |

---

## 7. Context slice `autofillProposals`

### Shape (prosa)

El slice vive en `AppContext` junto a los slices `step0..step4`. Es un mapa `Record<fieldPath, AutofillProposalState>` donde `fieldPath` es la ruta canónica (ej. `step0.nombreParticipante`, `step1.asisData.quiebre`, `step2.testCard.hipotesis`) tal como aparece en el ground-truth de `evals/golden/pdf-extraction/test-iniciativa.ground-truth.json`. El objeto `AutofillProposalState` contiene: el estado (`'unconfirmed' \| 'confirmed' \| 'edited' \| 'discarded'`), el valor propuesto inicialmente, el valor final actual (puede coincidir con el propuesto o haber sido editado), el provenance dominante (contrato del ADR-005 §"Provenance data contract"), el `confidenceBand`, una lista de fuentes secundarias y opcionalmente un objeto `conflictWith` que enumera los valores en disputa cuando aplica US-011.

### Acciones del reductor

| Acción | Payload | Efecto |
|---|---|---|
| `MERGE_FROM_RUN` | `{ proposals: AutofillProposal[] }` | Para cada propuesta entrante: si el campo no existe en el slice, se inserta con estado `unconfirmed`; si existe en estado `confirmed` o `edited`, se acumula como fuente secundaria pero NO se sobrescribe (regla de no sobrescritura silenciosa del ADR-005); si existe en `discarded`, se ignora; si existe como `unconfirmed`, se reemplaza solo si el nuevo `confidenceScore` es mayor por al menos 0.10. |
| `CONFIRM` | `{ fieldPath }` | Transición `unconfirmed → confirmed`. Persiste vía `POST /autofill-proposals/:fieldPath/confirm` (TASK-006). En éxito conserva el provenance como referencia histórica. |
| `EDIT` | `{ fieldPath, newValue }` | Transición a `edited`. `finalValue` queda en `newValue`, `proposedValue` se preserva. Persiste vía `POST /autofill-proposals/:fieldPath/edit`. |
| `DISCARD` | `{ fieldPath }` | Transición a `discarded`. Persiste vía `DELETE /autofill-proposals/:fieldPath`. Inicia ventana de undo de 8 s en UI. |
| `RESTORE` | `{ fieldPath }` | Transición `discarded → unconfirmed` (solo si la iniciativa sigue en `en_step_*`). Persiste vía `POST /autofill-proposals/:fieldPath/restore`. |
| `RESOLVE_CONFLICT` | `{ fieldPath, chosenSourceId }` | En campos con `conflictWith`, fija la fuente elegida, mueve la otra a "descartada por conflicto" y deja el campo en `unconfirmed` listo para `CONFIRM`. Persiste vía `POST /autofill-proposals/:fieldPath/resolve-conflict`. |
| `CLEAR_FOR_INITIATIVE` | `{ initiativeId }` | Limpia el slice al cambiar de iniciativa. |

### Selectores

- `selectProposal(fieldPath)` → estado completo del campo o `null` si no hay propuesta.
- `selectUnconfirmedCount(initiativeId)` → entero, usado por el approval gate.
- `selectUnconfirmedList(initiativeId)` → lista ordenada por Step y módulo para el banner expandible.
- `selectConflicts(initiativeId)` → lista de fieldPaths en variante conflicto.

---

## 8. Componente `<AutofillField>`

Wrapper de un input nativo (text, textarea, select, multiselect, enum-chip). Lee del slice el `AutofillProposalState` del `fieldPath` y resuelve a uno de los cuatro estados visuales del ADR-005 (más la variante conflicto, que delega a `AutofillConflictField`).

### Comportamiento por estado

- `empty` — render del input nativo con placeholder orientativo. Sin ícono, borde dashed 1 px gris.
- `manual` — render del input nativo, borde sólido 1 px gris, ícono de lápiz al margen del label.
- `ai-proposed-unconfirmed` — render del input con borde punteado 2 px de acento, ícono de chispa, chip "Propuesto por IA" + chip "Confianza alta/media/baja", grupo de acciones `Confirmar / Editar / Descartar` visible al pie. Popover de provenance accesible por hover y por click sobre el ícono de información.
- `ai-proposed-confirmed` — render como `manual` con un ícono pequeño de chispa secundario adyacente al check, sin grupo de acciones. Chip "Confirmado desde PDF" visible en hover/focus.
- `edited` — visualmente equivale a `manual`. La referencia al provenance original sigue accesible desde un menú de "Ver origen" sin alterar la jerarquía.

### Accesibilidad

- Cada estado expone `aria-label` con el texto exacto especificado en la tabla del ADR-005 §"Estados del campo".
- El grupo de acciones es un `role="toolbar"` con `aria-orientation="horizontal"`.
- El popover de provenance es un `role="dialog"` con `aria-modal="false"` (no atrapa el foco, pero anuncia su apertura).
- El `aria-describedby` del input apunta al id del popover cuando está abierto.
- Anuncios live: cada confirmación/edición/descarte dispara un `aria-live="polite"` con el texto "Campo confirmado", "Campo editado y guardado" o "Propuesta descartada, puedes deshacer durante 8 segundos".

### Keyboard shortcuts (ADR-005 §"Interacciones")

| Tecla | Foco | Acción |
|---|---|---|
| `Enter` | Sobre el input o sobre el toolbar de acciones | Ejecuta `Confirmar`. Si `highImpact=true`, abre confirmación inline antes de persistir. |
| `E` | Sobre el toolbar de acciones | Ejecuta `Editar` (pone el input en modo edición, foco al input). |
| `Supr` o `Backspace` | Sobre el toolbar de acciones | Abre confirmación inline "Descartar esta propuesta?" + persiste al confirmar. |
| `Tab` | Cualquiera | Tabulación natural: input → Confirmar → Editar → Descartar → siguiente campo. |
| `Esc` | Sobre el popover de provenance abierto | Cierra el popover. |

---

## 9. Estados visuales (espejo de ADR-005 §"Estados del campo")

| Estado | Ícono | Borde | Fondo | Label visible | Texto lector de pantalla |
|---|---|---|---|---|---|
| `empty` | Sin ícono | Gris dashed 1 px | Sin fondo | Placeholder orientativo según UX writing | "Campo vacío. Sin evidencia suficiente." cuando aplica US-012 (omitido por baja confianza). |
| `manual` | Lápiz | Gris sólido 1 px | Sin fondo | Sin label adicional | "Campo ingresado manualmente." |
| `ai-proposed-unconfirmed` | Chispa | Acento dotted 2 px | Acento suave (no verde, no rojo) | Chip "Propuesto por IA" + chip "Confianza [alta/media/baja]" | "Valor propuesto por inteligencia artificial, sin confirmar. Confianza [alta/media/baja]. Tres acciones disponibles: Confirmar, Editar, Descartar." |
| `ai-proposed-confirmed` | Check + chispa secundaria pequeña | Gris sólido 1 px | Sin fondo | Chip "Confirmado desde PDF" visible solo en hover/focus | "Campo confirmado por el founder. Origen: propuesta IA verificada." |
| Variante `conflict` | Aviso (no rojo de error) | Acento dotted 2 px con patrón doble | Acento suave + tarjetas internas con borde por fuente | Chip "Conflicto entre fuentes" + callout "Selecciona la fuente correcta" | "Conflicto entre fuentes para este campo. Dos opciones disponibles, selecciona una antes de continuar." |

Contraste mínimo verificado: 4.5:1 para texto, 3:1 para bordes y chips. Los chips de confianza no dependen del color: incluyen siempre el texto "Alta", "Media", "Baja".

---

## 10. Provenance popover

El popover aparece sobre el ícono de chispa del campo `ai-proposed-unconfirmed` o `ai-proposed-confirmed`. Contenido fijo:

- Nombre del PDF origen (texto del campo `sourcePdfName` del contrato).
- Páginas referenciadas como lista compacta (ej. "p. 3, 4" o "p. 2-3").
- Extracto citado literal, máximo 280 caracteres, en una `<blockquote>` semántica.
- Banda de confianza (label "Alta", "Media", "Baja") + el score numérico entre paréntesis (`0.87`).
- Si hubo traducción (US-016), un acordeón "Ver extracto original" expone `originalExcerpt`.
- Si hay `secondarySources`, un pie del popover indica "Otros documentos también respaldan este valor: PDF-X (p. 5), PDF-Y (p. 12)".

Interacción:

- Apertura: hover sobre el ícono después de 200 ms, o click. En teclado: `Enter` sobre el ícono cuando tiene foco.
- Cierre: mouse-out después de 500 ms de delay, `Esc`, o click fuera.
- En viewports estrechos, el popover se renderiza como `<details>` debajo del campo, no como overlay flotante, para preservar accesibilidad táctil.

---

## 11. UI de conflicto multi-PDF (US-011)

Cuando el slice marca un campo como `conflictWith`, `AutofillField` delega a `AutofillConflictField`. La región completa del campo se expande para mostrar:

- Encabezado con chip "Conflicto entre fuentes" + ícono de aviso.
- Callout corto: "Dos documentos proponen valores distintos para este campo. Selecciona la fuente correcta antes de continuar."
- Una tarjeta por cada opción en conflicto, con: valor propuesto en la tipografía del campo, nombre del PDF, páginas, extracto ≤280 caracteres, chip de confianza, radio button y CTA "Confirmar esta fuente".
- CTA secundaria "Descartar todas" que cae el campo a `empty`.

Al seleccionar una fuente, el slice despacha `RESOLVE_CONFLICT`. El campo regresa a `ai-proposed-unconfirmed` con la fuente elegida como dominante; la otra queda en audit trail con motivo "conflict_not_chosen". El founder debe luego ejecutar `Confirmar` explícitamente (un solo paso adicional, no automático).

---

## 12. Approval gate UI (US-017)

`ApprovalGateBanner` se monta en la cabecera de `Step4Page` (y como secundario en la vista de resumen de iniciativa, accesible desde el sidebar). Comportamiento:

- Cuando `selectUnconfirmedCount(initiativeId) > 0`:
  - Muestra el banner con copy "Tienes N campos propuestos por IA sin confirmar. Revísalos antes de enviar a tu mentor." donde N es el contador en tiempo real.
  - Si N > 5, el banner se colapsa por defecto en una lista agrupada por Step y por módulo; cada entrada es un deep-link que navega al Step correspondiente y hace `scrollIntoView` + focus visual en el campo.
  - El CTA "Enviar a revisión" del Step 4 está deshabilitado, con `aria-disabled="true"` y `aria-describedby` apuntando al banner. El estado deshabilitado se hace visible sin ocultar el botón.
  - Al primer render del Step 4 con N > 0, anuncio `aria-live="assertive"`: "Envío bloqueado. N campos pendientes de confirmación."
- Cuando `N === 0`:
  - El banner desaparece.
  - El CTA "Enviar a revisión" se habilita.
  - Anuncio `aria-live="polite"`: "Todos los campos confirmados. Puedes enviar a revisión."

El gate es no eludible: no existe acción de UI que transicione la iniciativa a `esperando_revision` sin que el contador sea exactamente cero. La verificación final también ocurre en backend (TASK-006) — TASK-009 solo es la primera línea de defensa visual.

---

## 13. Integración en Step0Page..Step4Page

Las claves siguientes se sustituyen por `<AutofillField fieldPath="..." ... />` en cada página, manteniendo el control nativo cuando el feature flag está apagado.

**Step 0 (8 campos):**
`step0.nombreParticipante`, `step0.rolArea`, `step0.origen`, `step0.quePasaQueQuieres`, `step0.impacta`, `step0.parteProceso`, `step0.impacto3meses`, `step0.respaldo`, `step0.quienEscuchar` — 9 fieldPaths.

**Step 1 (15 campos):**
`step1.asisData.casoReal`, `step1.asisData.quiebre`, `step1.asisData.quiebreDetalle`, `step1.asisData.consecuencia`, `step1.asisData.consequenceTags`, `step1.asisData.causaInmediata`, `step1.asisData.evidenciaTipo`, `step1.asisData.evidenciaNota`, `step1.asisData.alcance`, `step1.cData.limitesChips`, `step1.cData.dependencia`, `step1.cData.alternativaPiloto` — 12 fieldPaths.

**Step 2 (7 campos):**
`step2.hmw`, `step2.testCard.hipotesis`, `step2.testCard.queTestan`, `step2.testCard.conQuien`, `step2.testCard.dondeCuando`, `step2.testCard.metodo`, `step2.testCard.metrica` — 7 fieldPaths.

**Step 3 (10 campos):**
`step3.formatoExp`, `step3.logistica.donde`, `step3.instrumentacion`, `step3.testCycles[0].queValidamos`, `step3.testCycles[0].metricaPrincipal`, `step3.testCycles[0].resultadoEsperado`, `step3.testCycles[0].resultadoObservado`, `step3.testCycles[0].decision`, `step3.testCycles[0].aprendizaje`, `step3.goNoGo`, `step3.aprendizajes`, `step3.diagnostico.senales` — 12 fieldPaths.

**Step 4 (14 campos):**
`step4.audience`, `step4.meetingGoal`, `step4.decision`, `step4.closureType`, `step4.presentation.problem`, `step4.presentation.urgency`, `step4.presentation.evidence`, `step4.presentation.proposal`, `step4.presentation.solutionComponents`, `step4.presentation.tests`, `step4.presentation.results`, `step4.presentation.recommendation`, `step4.presentation.orgNeeds`, `step4.presentation.nextStep`, `step4.implementationPlan`, `step4.orgContext.affectedAreas`, `step4.orgContext.risks` — 17 fieldPaths.

**Total: 57 fieldPaths envueltos** (alineados con `evals/golden/pdf-extraction/test-iniciativa.ground-truth.json`). Los campos del set `must_omit` del ground-truth NO se envuelven: nunca recibirán propuestas (por US-012) y deben seguir como inputs manuales con su placeholder estándar.

---

## 14. Persistencia con backend

Cada acción del founder sobre una propuesta dispara una llamada al backend (TASK-006). La tabla siguiente fija el contrato esperado:

| Acción en UI | Endpoint | Cuándo dispara |
|---|---|---|
| `Confirmar` (sin editar) | `POST /api/v1/initiatives/:id/autofill-proposals/:fieldPath/confirm` | Click en "Confirmar", `Enter` sobre el toolbar, o confirmación de la edición sin cambios. |
| `Editar + Guardar` | `POST /api/v1/initiatives/:id/autofill-proposals/:fieldPath/edit` con body `{ value }` | `blur` del input en modo edición con valor distinto al propuesto. |
| `Descartar` (tras 8s o confirmado por usuario) | `DELETE /api/v1/initiatives/:id/autofill-proposals/:fieldPath` | Click en "Descartar" tras 8 s sin "Deshacer", o confirmación explícita. |
| `Restaurar` (desde historial) | `POST /api/v1/initiatives/:id/autofill-proposals/:fieldPath/restore` | Acción desde el panel de historial mientras la iniciativa siga en `en_step_*`. |
| `Resolver conflicto` | `POST /api/v1/initiatives/:id/autofill-proposals/:fieldPath/resolve-conflict` con body `{ chosenSourceId }` | Selección de una de las opciones en `AutofillConflictField`. |
| `Cargar PDF` | `POST /api/v1/initiatives/:id/pdfs/presign` → `PUT` a URL devuelta → `POST /api/v1/initiatives/:id/pdfs/:pdfId/confirm` | Drop o selección de un archivo en `PdfInitiativeUploader`. |
| `Arrancar corrida` | `POST /api/v1/initiatives/:id/autofill-runs` con body `{ scope }` | Click en CTA "Auto-rellenar Step N" o "Auto-rellenar todo". |

Cada llamada incluye optimistic update en el slice; en caso de error 4xx/5xx el estado revierte y se muestra un toast con el código del backend. Para `DELETE` la ventana de undo de 8 s se mantiene local: si el founder hace "Deshacer" antes de los 8 s, se cancela el `DELETE` (debounce).

---

## 15. Feature flag y rollout beta

- Flag: `feature.pdfAutofill`. Por defecto `false` en producción.
- Activación: por `userId` vía servicio de feature flags. La beta de 20 founders se gestiona por whitelist en el servidor; el frontend solo lee el flag.
- Cuando el flag está `false`: `PdfInitiativeUploader` NO se monta, `AutofillField` se comporta como input nativo equivalente (passthrough), el banner del gate no aparece.
- Telemetría requerida (eventos a emitir, con dimensiones `userId`, `initiativeId`, `fieldPath`, `stepNumber`, `confidenceBand`):
  - `field_autofill_proposed` — emitido al recibir una propuesta (un evento por campo por corrida).
  - `field_autofill_confirmed` — al persistir confirmación exitosa.
  - `field_autofill_edited` — al persistir edición; incluye `editDistance` (Levenshtein normalizada) para calcular "edición sustancial" (PRD-002 §"Métricas").
  - `field_autofill_discarded` — al persistir descarte (post ventana de undo).
  - `field_autofill_restored` — al restaurar desde historial.
  - `field_autofill_conflict_resolved` — al resolver un conflicto, incluye `chosenSourceId`.
  - `approval_gate_blocked` — al cargar Step 4 con N > 0, incluye el contador.
  - `approval_gate_cleared` — cuando N pasa a 0.
  - `pdf_upload_started`, `pdf_upload_completed`, `pdf_upload_failed` — para el uploader.
  - `autofill_run_started`, `autofill_run_completed`, `autofill_run_failed` — para el hook.

Bandas objetivo (de PRD-002): confirm rate ≥ 0.60, edit rate ≤ 0.30 (edición sustancial = `editDistance > 0.30`), discard rate ≤ 0.10. La instrumentación debe permitir computar estas tres ratios en un dashboard externo.

---

## 16. Accesibilidad checklist

- [ ] Cada estado del campo se distingue por al menos tres canales: ícono + borde + label/texto. Color es decorativo, no portador único de información.
- [ ] Contraste de texto ≥ 4.5:1 verificado en los cuatro estados + variante conflicto, con axe-core o equivalente.
- [ ] Contraste de bordes y chips ≥ 3:1.
- [ ] Tabulación natural en el orden visual: input → Confirmar → Editar → Descartar → siguiente campo.
- [ ] Shortcuts `Enter` / `E` / `Supr` documentados en un tooltip accesible y en el ARIA label del toolbar.
- [ ] Cada `AutofillField` expone `aria-label` y `aria-describedby` apuntando al popover de provenance cuando está abierto.
- [ ] El popover usa `role="dialog"` con `aria-modal="false"`.
- [ ] Anuncios live (`aria-live="polite"`) emitidos al confirmar / editar / descartar, con copy en español.
- [ ] El banner del gate usa `role="region"` con `aria-labelledby` apuntando a su título; los deep-links son `<a>` con `href` calculado (no `<div onClick>`).
- [ ] El estado deshabilitado del CTA "Enviar a revisión" usa `aria-disabled="true"` + `aria-describedby` al banner (no `display: none`).
- [ ] El callout de conflicto usa `role="alert"` solo en su primer render.
- [ ] Auditoría axe-core sobre cada estado del componente: 0 violaciones críticas o serias.

---

## 17. UX writing checklist

Basado en `docs/starteria-ux-writing.md` (tono claro, humano, directo, español latino, sin spanglish):

- [ ] El uploader dice "Arrastra tus PDFs o haz clic para seleccionarlos." No "Drop files here" ni "Upload".
- [ ] Cuando una carga falla por tamaño: "Este archivo supera los 50 MB. Reduce su tamaño o divídelo antes de subirlo." No "Error de tamaño".
- [ ] Estado `unconfirmed` muestra siempre el chip "Propuesto por IA" — no "AI suggestion" ni "autofill".
- [ ] Acción "Descartar" dispara toast "Listo, propuesta descartada. Puedes deshacer durante los próximos 8 segundos." No "Deleted".
- [ ] Campo omitido por US-012: placeholder "No encontramos evidencia suficiente en los PDFs cargados. Puedes completarlo a mano." No "Sin datos".
- [ ] Banner del gate dice "Tienes N campos propuestos por IA sin confirmar. Revísalos antes de enviar a tu mentor." No "Acción bloqueada" ni "Submission blocked".
- [ ] Callout de conflicto: "Dos documentos proponen valores distintos para este campo. Selecciona la fuente correcta antes de continuar."
- [ ] Tooltip del CTA deshabilitado: "Confirma los N campos pendientes antes de enviar a tu mentor."
- [ ] Mensaje de techo de costo (US-013): "Alcanzaste el límite mensual de auto-rellenado para esta iniciativa. Puedes seguir cargando PDFs; el auto-rellenado se reanuda el próximo mes."
- [ ] Mensaje de timeout del hook: "La extracción tarda más de lo normal. Puedes reintentarlo o continuar manualmente."

---

## 18. Tests

### 18.1 Vitest unitarios

- `usePdfAutofill`: arranca corrida, transita estados, aplica backoff (mockeando `setTimeout`), respeta techo de 120 s, dispara `MERGE_FROM_RUN`, maneja 4xx y 5xx según la tabla de errores.
- `autofillProposals` reductor: cubre cada acción (`MERGE_FROM_RUN`, `CONFIRM`, `EDIT`, `DISCARD`, `RESTORE`, `RESOLVE_CONFLICT`, `CLEAR_FOR_INITIATIVE`) con casos felices y de borde (mismo fieldPath ya `confirmed`, intento de `RESTORE` cuando la iniciativa salió de `en_step_*`).
- `AutofillField` transiciones: render por estado, comportamiento de shortcuts (simulación de `keydown`), ventana de undo de descarte (avanzar timers de Vitest 7 s y 8 s).
- `selectUnconfirmedCount` y `selectUnconfirmedList`: ordenación correcta por Step y módulo, exclusión de `confirmed`/`edited`/`discarded`.

### 18.2 Component tests (React Testing Library)

- Render de cada uno de los cuatro estados visuales + variante conflicto, con assertions DOM: existencia del ícono correcto, del label correcto, del aria-label correcto.
- Shortcut `Enter` dispara `confirm()` y persiste vía servicio mockeado.
- Shortcut `E` entra en modo edición y enfoca el input.
- Shortcut `Supr` abre confirmación inline; al confirmar, persiste el descarte tras 8 s.
- Popover de provenance: apertura por hover (tras 200 ms), por click, por `Enter`; cierre por `Esc` y por click fuera.
- Approval gate: contador correcto, deep-link enfoca el campo destino, CTA deshabilitado mientras N > 0.

### 18.3 E2E Playwright

Cubre el flujo completo end-to-end con un PDF de prueba (`docs/Test - iniciativa.pdf`):

- **E2E-1 (US-001)** — Founder arrastra PDF; aparece en lista con estado "Subiendo"; pasa a "Listo".
- **E2E-2 (US-001 inválido)** — Founder arrastra `.docx`; aparece toast "Solo aceptamos archivos PDF" y el archivo no entra a la lista.
- **E2E-3 (US-009 happy path)** — Tras carga, founder hace click en "Auto-rellenar Step 0"; los 9 campos aparecen con borde dotted y chip "Propuesto por IA"; founder confirma uno; el chip cambia, el toolbar desaparece.
- **E2E-4 (US-009 edit)** — Founder edita un campo; al blur, el estado pasa a `edited`; en el panel de historial, el provenance original sigue accesible.
- **E2E-5 (US-009 discard + undo)** — Founder descarta; durante 8 s, "Deshacer" lo restaura; tras 8 s, queda `discarded`.
- **E2E-6 (US-011)** — PDFs con conflicto inyectado; el campo muestra dos tarjetas; founder selecciona una; el campo queda `unconfirmed`; founder confirma.
- **E2E-7 (US-017)** — Founder navega a Step 4 con campos sin confirmar; CTA deshabilitado; click en deep-link del banner enfoca el campo en su Step; tras confirmar todos, CTA se habilita.
- **E2E-8 (US-013 cost ceiling)** — Stub backend devuelve 402; aparece banner de techo con el copy correcto.

### 18.4 Accesibilidad

- `axe-core` ejecutado sobre `AutofillField` en cada uno de los cuatro estados + variante conflicto, sobre `ApprovalGateBanner` con N > 0 y N = 0, sobre `PdfInitiativeUploader`. Resultado esperado: 0 violaciones de severidad "serious" o "critical".
- Auditoría manual con lector de pantalla (NVDA o VoiceOver) sobre el flujo E2E-3 completo: cada anuncio live debe ser audible y comprensible.

### 18.5 Usability (US-008)

- Sesiones moderadas N=8 founders.
- Métricas: ≥ 7 reconocen sin ayuda que el valor es propuesto por IA; ≥ 6 ubican la página origen del PDF en ≤ 15 s; comprensión correcta del score categorizado ≥ 0.85 sobre las 20 sesiones agregadas (US-008 acceptance band).
- Notas: protocolo y guía de moderación viven fuera de esta TASK; lo que TASK-009 entrega es la build instrumentada y la lista de tareas observables (cargar PDF, auto-rellenar Step 0, identificar página origen, confirmar 3 campos, descartar 1 con undo).

---

## 19. Definition of Done

- [ ] Los 8 componentes / hooks listados en §5 existen, exportados, con tipos públicos.
- [ ] Los 57 fieldPaths listados en §13 están envueltos por `<AutofillField>` en Steps 0..4 cuando `feature.pdfAutofill` está activo.
- [ ] El reductor `autofillProposals` cubre las 7 acciones de §7 con tests unitarios al 100% de ramas.
- [ ] `usePdfAutofill` respeta el backoff y el techo de 120 s validados por test unitario.
- [ ] Approval gate bloquea el envío mientras N > 0 (test E2E-7 verde).
- [ ] Auditoría axe-core sin violaciones críticas o serias en los estados de `AutofillField`, `AutofillConflictField`, `ApprovalGateBanner`, `PdfInitiativeUploader`.
- [ ] Tests Playwright E2E-1..E2E-8 verdes contra un backend stub.
- [ ] Telemetría: los 12 eventos listados en §15 se emiten con sus dimensiones; verificable con un mock de `analytics` en tests.
- [ ] Sesiones de usabilidad ejecutadas, resultados documentados, ≥ 7/8 founders reconocen el valor como propuesto por IA.
- [ ] `npm run lint` y `npm run build` verdes en el paquete `front/`.
- [ ] Feature flag `feature.pdfAutofill` por defecto `false` en producción; verificado por test.
- [ ] PR abierto (no mergeado) con título `feat(TASK-009): frontend autofill UI + hook + Steps 0-4 wiring`.
- [ ] Progress note en `project/.sdlc/knowledge/progress-TASK-009-[fecha].md`.

---

## 20. Estimación

8 días de un ingeniero senior frontend con apoyo de QA para la auditoría axe-core y las sesiones de usabilidad.

| Fase | Entregable | Días |
|---|---|---|
| A | `PdfInitiativeUploader` real con presign → PUT directo → confirm + validaciones de tipo/tamaño/número. | 1.0 |
| B | `usePdfAutofill` (backoff + estados + cancel) y slice `autofillProposals` (shape + 7 acciones del reductor + selectores). | 1.0 |
| C | `AutofillField` con los 4 estados visuales + shortcuts + integración con el reductor. | 1.5 |
| D | `ProvenancePopover` con todos los campos del contrato + acordeón de traducción + variante mobile. | 0.5 |
| E | `AutofillConflictField` (US-011) + `ApprovalGateBanner` (US-017) con deep-links y bloqueo del CTA. | 1.0 |
| F | Envoltura de los 57 fieldPaths en `Step0Page..Step4Page` + wiring de persistencia contra TASK-006. | 2.0 |
| G | Tests unitarios + component + Playwright E2E + auditoría axe-core. | 1.0 |
| **Total** |  | **8.0** |

---

## 21. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| TASK-010 (persistencia Steps 2/3/4) se retrasa o queda parcial. | Media | Alto — sin ella, Steps 2/3/4 no persisten autofill. | Declarar TASK-010 como hard dependency (ver apéndice); empezar fases A-E en paralelo y reservar la fase F a backend listo. Bloquear el merge de la fase F hasta verificar persistencia con un test de humo en `stepService`. |
| El ground-truth muta y rompe la lista de 57 fieldPaths. | Media | Medio | Centralizar el array de fieldPaths en una constante única (`autofillFieldPaths.ts`) generada desde el ground-truth; validar en CI que los fieldPaths usados por `AutofillField` en Steps 0..4 son subset del ground-truth. |
| Auditoría axe-core descubre violaciones serias tarde. | Media | Medio | Integrar axe-core en los component tests desde la fase C (no esperar a G). Tener un checkpoint al final de la fase C antes de invertir en F. |
| Sesiones de usabilidad fallan la banda de US-008 (≥ 7/8 reconocen sin ayuda). | Baja | Alto — bloquea el rollout a la beta de 20 founders. | Diseñar el chip "Propuesto por IA" + el borde dotted con suficiente contraste y label textual desde el día 1; planificar una iteración rápida (≤ 2 días) sobre el ícono y el copy si el test piloto con N=3 detecta confusión. |
| El polling sostenido del hook consume demasiada batería en mobile. | Baja | Bajo | Backoff capado a 5 s y techo de 120 s; el hook usa `document.visibilityState === 'hidden'` para pausar el poll cuando la pestaña está en background. |
| Optimistic updates desincronizan el slice con el backend cuando hay fallos intermitentes. | Media | Medio | Cada acción del reductor que persiste registra un `pendingActionId`; al recibir el response, se reconcilia; al fallar, se revierte con un toast. Test unitario explícito para cada acción con respuesta 500. |
| `PdfInitiativeUploader` rompe accidentalmente el flujo de `EvidenceUploader`. | Baja | Alto — afecta evidencia de módulos. | Componentes completamente separados, ninguno importa al otro. Test de regresión sobre `EvidenceUploader` antes del merge. |
| El feature flag se activa por error en producción para todos los usuarios. | Baja | Alto | Default `false` en el código y en el servicio. Test que verifica que sin flag, `AutofillField` cae a passthrough. Rollout vía whitelist solamente. |

---

## Apéndice: TASK-010 (declarado como hijo de SPEC-002)

```yaml
id: TASK-010
title: "Persistencia backend para Steps 2/3/4 (paridad con Step 1)"
status: ready
parent: SPEC-002
sprint: S-02
estimate: 3d
adrs: []
depends_on: []
unblocks: [TASK-009]
```

**Objetivo:** Cerrar la brecha donde hoy solo Step 1 invoca `stepService.saveStepData`. Sin esto, las confirmaciones / ediciones de autofill en Steps 2/3/4 no sobrevivirían un refresh y el approval gate (US-017) no tendría un estado autoritativo que validar antes de `esperando_revision`.

**Alcance:**
- Extender el backend para aceptar `PUT /projects/:id/steps/2/data`, `.../steps/3/data`, `.../steps/4/data` con los blobs equivalentes a los del Step 1.
- Agregar modelos Prisma (o extender el modelo `Step.data` existente si ya es JSON polimórfico) que persistan los blobs de Step 2/3/4.
- Migraciones idempotentes con rollback documentado.
- Invocar `saveStepData` desde `Step2Page`, `Step3Page` y `Step4Page` en cada cambio relevante (mismo patrón que Step 1).
- Tests de integración: el blob sobrevive a refresh; el backend rechaza payloads inválidos con 400.

**Fuera de alcance:** lógica de validación semántica de cada Step (eso vive en los agentes IA, no en este endpoint).

**Definition of done:** Endpoints disponibles, las tres páginas Step persisten en cada cambio, `npm test backend/__tests__/modules/steps` verde, migración aplicada en staging.

---

*Task generado siguiendo BHIL AI-First Development Toolkit*
