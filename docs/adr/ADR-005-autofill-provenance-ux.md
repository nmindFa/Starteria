---
id: ADR-005
title: "Patrón de provenance e interacción confirmar/editar/descartar para auto-rellenado"
status: proposed
type: standard
date: 2026-05-17
decision_makers: [Architecture Agent (Swarm)]
related_prds: [PRD-002]
related_specs: []
sprint: S-02
review_trigger: "Tras usability test con N=8 founders (US-008, US-009)"
tags: [ux, provenance, autofill, accessibility, design-system]
---

# ADR-005: Patrón de provenance e interacción confirmar/editar/descartar para auto-rellenado

## Context and problem statement

PRD-002 introduce el auto-rellenado de Steps 0-4 desde PDFs cargados por el founder. Cada campo extraído llega a la UI como una propuesta IA que aún no es autoritativa: vive en una capa pre-submission con su evidencia (PDF origen, página, extracto citado, score de confianza) hasta que el founder la confirma, la edita o la descarta. La pieza crítica de la experiencia no es la extracción en sí — es la capa visual y de interacción que (a) hace evidente al founder que un valor es una propuesta y no un dato manual, (b) le permite verificar contra la fuente sin abandonar el flujo, y (c) garantiza que el mentor reciba únicamente datos confirmados (US-017). Sin un patrón único para esta capa, cada Step podría inventar su propia convención y se rompería tanto la accesibilidad (color-only signaling) como el contrato de aprobación.

**Decision question:** ¿Qué patrón visual e interactivo unifica la representación de provenance y las acciones Confirmar / Editar / Descartar para todos los campos auto-rellenados de Steps 0-4, garantizando comprensión sin ayuda ≥ 7/8 founders (US-008), accesibilidad sin depender solo de color, y bloqueo no eludible de la transición a `esperando_revision` (US-017)?

---

## Decision drivers

- **Comprensión sin ayuda (US-008):** ≥ 7 de 8 founders deben reconocer que un valor es propuesto por IA sin explicación previa, ≥ 6 deben ubicar la página origen del PDF en ≤ 15 segundos, y la categorización de confianza alta/media/baja debe ser correctamente interpretada en ≥ 0.85 de las sesiones.
- **Reversibilidad (US-009, US-012):** Toda propuesta, edición o descarte debe ser reversible mientras la iniciativa esté en estados `en_step_0` … `en_step_4`. Ningún campo se marca autoritativo por el solo hecho de haber sido propuesto.
- **Accesibilidad sin color-only:** Distinguir los estados de campo con al menos dos canales perceptuales adicionales al color (ícono + label textual + borde con patrón). Navegación completa por teclado y anuncio por lector de pantalla obligatorios para las tres acciones.
- **No-bypass del flujo de aprobación (US-017):** La transición a `esperando_revision` debe estar bloqueada mientras haya un solo campo en estado `ai-proposed-unconfirmed`. El bloqueo debe ser visible al founder con la lista exacta de campos pendientes y un atajo de navegación a cada uno.
- **Mentor distingue manual vs. autofill confirmado post-facto:** Aun cuando el mentor solo ve datos autoritativos, debe poder consultar en audit trail si un campo fue originado por IA y confirmado o si fue ingresado manualmente desde el inicio (US-014, NFR de compatibilidad con flujo de aprobación).
- **Coherencia con el sistema visual existente:** El patrón debe componerse con los componentes ancla actuales (chips de estado, banners de contexto, paneles laterales) sin introducir un lenguaje visual paralelo.

---

## Estados del campo

Todo campo de Steps 0-4 vive en exactamente uno de cuatro estados. La representación debe hacer cada estado distinguible por al menos tres canales (ícono, borde, label) además del color de fondo:

| Estado | Cuándo aplica | Ícono | Borde | Fondo | Label visible | Texto para lector de pantalla |
|---|---|---|---|---|---|---|
| `empty` | El campo nunca tuvo valor o fue descartado y aún no se reemplazó. US-012 también cae aquí cuando confianza < 0.60. | Sin ícono o ícono de punto vacío | Borde gris discontinuo (1px dashed) | Sin fondo distintivo | Placeholder con copy orientativo (ver UX writing) | "Campo vacío. Sin evidencia suficiente." cuando aplica US-012 |
| `manual` | El founder escribió el valor a mano desde un campo vacío, o editó+guardó un valor (haya o no venido de IA originalmente). | Ícono de lápiz | Borde gris sólido (1px solid) | Sin fondo distintivo | Sin label adicional | "Campo ingresado manualmente." |
| `ai-proposed-unconfirmed` | Una corrida del agente de extracción propuso un valor con confianza ≥ 0.60 que aún no fue confirmado, editado o descartado. | Ícono de estrella/chispa (consistente con el lenguaje de "asistente IA") | Borde punteado de 2px (patrón distinto al discontinuo de `empty`) | Fondo de acento suave (no usar verde ni rojo) | Chip "Propuesto por IA" + chip de confianza (Alta / Media / Baja) | "Valor propuesto por inteligencia artificial, sin confirmar. Confianza [alta/media/baja]. Tres acciones disponibles: Confirmar, Editar, Descartar." |
| `ai-proposed-confirmed` | El founder ejecutó "Confirmar" sobre un campo `ai-proposed-unconfirmed` (sin editar el valor). | Ícono de check + ícono pequeño de chispa secundario | Borde gris sólido (1px solid, igual a `manual`) | Sin fondo distintivo | Chip discreto "Confirmado desde PDF" visible solo en hover/focus o en la vista de auditoría | "Campo confirmado por el founder. Origen: propuesta IA verificada." |

**Reglas de transición:**
- `empty` → `manual` (founder escribe) → puede volver a `empty` solo si borra el valor.
- `empty` → `ai-proposed-unconfirmed` (corrida de autofill con confianza ≥ 0.60).
- `ai-proposed-unconfirmed` → `ai-proposed-confirmed` (Confirmar).
- `ai-proposed-unconfirmed` → `manual` (Editar + Guardar; el provenance original queda en audit trail, no se descarta).
- `ai-proposed-unconfirmed` → `empty` (Descartar).
- `manual` y `ai-proposed-confirmed` **no** son sobrescritos automáticamente por una nueva corrida de autofill (US-003 lo exige para Step 0 y se generaliza al resto). Una nueva propuesta sobre un campo ya en esos estados se acumula como sugerencia secundaria visible bajo demanda, nunca como reemplazo silencioso.

---

## Provenance data contract

Cada campo en estado `ai-proposed-unconfirmed` o `ai-proposed-confirmed` debe llevar adjunto un objeto de provenance con el siguiente contrato lógico. Este ADR define únicamente el contrato; la materialización (tablas Prisma, payload de API, tipos TypeScript) corresponde al SPEC derivado de PRD-002.

| Campo lógico | Tipo lógico | Obligatorio | Descripción |
|---|---|---|---|
| `sourcePdfId` | identificador estable | sí | Identificador del PDF dominante para esta propuesta. |
| `sourcePdfName` | texto corto | sí | Nombre original del archivo tal como fue cargado, mostrado al founder. |
| `pageNumbers` | lista de enteros | sí | Páginas referenciadas dentro del PDF dominante, en orden de aparición. |
| `quotedExcerpt` | texto ≤ 280 caracteres | sí | Fragmento textual literal extraído del PDF. Si la extracción atraviesa traducción (US-016), este campo guarda la versión en el idioma de la iniciativa; el original queda en `originalExcerpt`. |
| `originalExcerpt` | texto ≤ 280 caracteres | solo si hubo traducción | Texto en el idioma fuente cuando difiere del idioma de la iniciativa. |
| `confidenceScore` | número en [0.00, 1.00] | sí | Score de confianza emitido por el agente de extracción. |
| `confidenceBand` | enum `high` / `medium` / `low` | sí | Categorización derivada: `high` si ≥ 0.80, `medium` si 0.60-0.79, `low` reservado para auditoría — un campo con `low` NO se puebla (US-012). |
| `agentRunId` | identificador estable | sí | Identificador de la corrida del agente que produjo la propuesta. Permite agrupar todas las propuestas de una misma sesión. |
| `proposedAt` | timestamp | sí | Momento de generación de la propuesta. |
| `secondarySources` | lista de objetos provenance reducidos | sí (puede estar vacía) | Otras fuentes que aportaron evidencia al mismo campo (US-010). Cada entrada repite `sourcePdfId`, `sourcePdfName`, `pageNumbers`, `quotedExcerpt`, `confidenceScore`. |
| `conflict` | objeto opcional | solo en US-011 | Cuando se detecta conflicto (≥ 2 fuentes con valores distintos y delta de confianza < 0.10), se incluye con `competingValues` y referencias a sus provenance. |
| `omissionReason` | enum opcional | solo si el campo se omitió | Para campos dejados vacíos por US-012: `insufficient_coverage`, `ambiguity`, `unsupported_language`, `pii_blocked`. |

El contrato es la fuente de verdad para todas las representaciones visuales descritas en este ADR. Cualquier campo no listado aquí queda fuera del patrón.

---

## Interacciones — Confirmar / Editar / Descartar

Cada campo en estado `ai-proposed-unconfirmed` expone exactamente tres acciones, en este orden visual y de tabulación. Las labels son normativas — no se admiten variantes localizadas dentro del MVP.

| Acción | Label exacta | Placement | Atajo de teclado | Confirmación destructiva |
|---|---|---|---|---|
| Confirmar | "Confirmar" | Botón primario al pie del campo, alineado al inicio | `Enter` cuando el foco está en el campo o en el grupo de acciones | No requiere confirmación. Es no destructiva — el valor queda igual y solo cambia el estado. |
| Editar | "Editar" | Botón secundario inmediatamente después de Confirmar | `E` cuando el foco está en el grupo de acciones | No requiere confirmación previa. Al guardar la edición, el provenance original persiste en audit trail. |
| Descartar | "Descartar" | Botón terciario al final, visualmente menos prominente | `Supr` o `Backspace` cuando el foco está en el grupo de acciones | **Sí.** Se muestra un confirmador inline ("Descartar esta propuesta? El campo quedará vacío.") con opción "Deshacer" durante 8 segundos tras ejecutarse. El descarte queda registrado en audit trail (US-014). |

**Reglas adicionales:**
- El grupo de acciones es visible siempre que el campo esté en `ai-proposed-unconfirmed`. No se oculta tras menús contextuales ni hover-only — esto rompería la accesibilidad por teclado y la regla de UI rules "diferenciar claramente estados".
- Las labels deben coexistir con un ícono perceptual (check, lápiz, basurero) pero el texto es obligatorio; ícono-solo está prohibido por la regla de comprensión sin ayuda.
- En modo edición ("Editar"), el provenance permanece visible como referencia colateral (panel lateral o bloque inferior). El founder puede consultar el extracto sin perder el campo en edición.
- El copy de los micro-mensajes sigue las reglas de `starteria-ux-writing.md`: claro, humano, directo, orientado a acción. Ej. al descartar: "Listo, propuesta descartada. Puedes deshacer durante los próximos 8 segundos."

---

## Patrón de conflicto multi-PDF (US-011)

Cuando el agente detecta que dos o más PDFs proponen valores contradictorios para el mismo campo con un delta de confianza menor a 0.10, el campo entra en una variante del estado `ai-proposed-unconfirmed` denominada `conflict`. La regla por defecto del sistema — elegir la de mayor confianza — se suspende explícitamente.

**Contenido visual del campo en conflicto:**

- Encabezado del campo con un chip distintivo "Conflicto entre fuentes" + ícono de aviso (no usar rojo de error: el founder no cometió un error, son los datos los que difieren).
- Inmediatamente debajo, callout corto con copy: "Dos documentos proponen valores distintos para este campo. Selecciona la fuente correcta antes de continuar."
- Lista vertical de las opciones en conflicto. Cada opción ocupa una tarjeta con:
  - El valor propuesto, en tipografía del campo.
  - El nombre del PDF, página y extracto citado (≤ 280 caracteres).
  - El chip de confianza (Alta / Media).
  - Un radio button para selección y un botón "Confirmar esta fuente".
- El campo no se puebla hasta que el founder elige explícitamente una de las opciones. La opción no seleccionada queda registrada en audit trail como propuesta descartada con motivo "conflict_not_chosen".
- Si el founder prefiere ninguna de las opciones, puede usar "Descartar todas" y el campo cae a `empty`.

La jerarquía visual debe poner el callout y la lista de opciones por encima del grupo de acciones estándar — en conflicto, las acciones Confirmar/Editar/Descartar globales del campo se reemplazan por las acciones por opción.

---

## Patrón de aprobación gate (US-017)

Mientras la iniciativa contenga un solo campo en `ai-proposed-unconfirmed` (incluyendo variantes en conflicto), el flujo de aprobación queda bloqueado.

**Manifestación visual:**

- **Banner persistente** en la parte superior de la vista de Step 4 (estado `en_step_4`), también accesible desde el resumen de iniciativa. Copy: "Tienes N campos propuestos por IA sin confirmar. Revísalos antes de enviar a tu mentor."
- **Contador** N actualizado en tiempo real. El contador agrupa por Step y por módulo cuando N > 5.
- **Lista expandible** dentro del banner. Cada entrada de la lista es un enlace directo al campo correspondiente, con: nombre del Step, nombre del módulo, label del campo, y chip de confianza. Al hacer clic, la vista navega al Step y hace foco visual y de teclado en el campo.
- **Botón "Enviar a revisión"** deshabilitado mientras N > 0. El estado deshabilitado debe explicar el motivo en su tooltip y en el atributo accesible (`aria-describedby` apuntando al banner). No se debe ocultar el botón — esto rompería la previsibilidad del flujo.
- **Anuncio por lector de pantalla** al cargar la vista: "Envío bloqueado. N campos pendientes de confirmación." Cuando N pasa a 0, anunciar: "Todos los campos confirmados. Puedes enviar a revisión."

El gate es no eludible por diseño: no existe ninguna acción de UI que transicione la iniciativa a `esperando_revision` sin que el contador sea exactamente 0.

---

## Audit trail visibility

El audit trail (US-014) registra todos los eventos del ciclo de vida de una propuesta. La visibilidad se diferencia por rol:

- **Founder:** Ve, por cada campo, el estado actual y el provenance dominante. Puede expandir un panel de historial que muestre: corridas previas del agente sobre el mismo campo, ediciones aplicadas, descartes (con opción "Restaurar" mientras la iniciativa siga en estados `en_step_*`). No ve metadata interna como `agentRunId`, costo de la extracción, ni decisiones de routing.
- **Mentor:** Solo ve campos en estados `manual` o `ai-proposed-confirmed`. El mentor distingue ambos en una vista de auditoría secundaria — nunca como ruido visual en la revisión principal del Step. La distinción usa el mismo ícono discreto del estado `ai-proposed-confirmed` (chispa pequeña adyacente al check), no un color de fondo.
- **Portfolio lead / sistema:** Acceso completo al audit trail por API, incluyendo `agentRunId`, `costUsd`, y eventos descartados. Esto excede el alcance de UX de este ADR pero condiciona el contrato.

---

## Reversibilidad

- **Descartar:** Reversible durante 8 segundos vía toast "Deshacer". Tras ese tiempo, el descarte sigue siendo reversible desde el panel de historial del campo mientras la iniciativa esté en estados `en_step_*`. La operación "Restaurar" recoloca el campo en `ai-proposed-unconfirmed` con el mismo provenance.
- **Editar:** Cada edición crea una nueva entrada en el historial del campo. El provenance original de la propuesta IA persiste en audit trail aun cuando el valor final es distinto.
- **Confirmar:** Revertir una confirmación devuelve el campo a `ai-proposed-unconfirmed`. Disponible desde el panel de historial. Si el founder ya envió la iniciativa a `esperando_revision`, la reversión queda bloqueada hasta que el mentor devuelva la iniciativa a `en_step_*`.

---

## Decision

**Patrón adoptado: Inline provenance con grupo de acciones siempre visible, gate persistente en Step 4, conflicto resuelto por selección explícita.**

Cada campo auto-rellenado renderiza su provenance y sus tres acciones en el sitio donde el founder ya está mirando — no en un modal de revisión separado ni en un panel lateral exclusivo. El provenance es siempre auditable a un vistazo (PDF + página + extracto + confianza); las acciones siempre están a una tecla de distancia; el envío al mentor está siempre condicionado al contador del gate.

**Justificación contra los drivers:**
- Resuelve **comprensión sin ayuda** porque el valor, su origen y las acciones están físicamente juntos.
- Resuelve **reversibilidad** porque ningún paso es destructivo silencioso: confirmar es reversible, editar mantiene provenance, descartar tiene Deshacer + historial.
- Resuelve **accesibilidad** porque cada estado usa tres canales perceptuales (ícono + borde + label) y porque las acciones son alcanzables por teclado con shortcuts dedicados.
- Resuelve **no-bypass** porque el gate de US-017 es estructural: el botón de envío está deshabilitado mientras el contador > 0 y la lista de pendientes es navegable.
- Resuelve **distinción para mentor** porque el estado `ai-proposed-confirmed` mantiene una marca discreta consultable en la vista de auditoría.

---

## Consequences

**Positive:**
- El founder no abandona el contexto del Step para verificar la fuente — el extracto vive junto al campo.
- Las tres acciones uniformes en todos los Steps reducen carga cognitiva y permiten que pruebas de usabilidad iteren un único patrón.
- El gate elimina por construcción cualquier escenario donde un campo IA no confirmado llegue al mentor.
- La accesibilidad multi-canal (ícono + borde + label + ARIA) cumple WCAG 2.1 AA para distinción de estados sin depender de color.

**Negative:**
- El estado `ai-proposed-unconfirmed` introduce densidad visual adicional en formularios que ya son largos. Mitigación: el chip de confianza y el extracto pueden colapsarse a un resumen tras la confirmación; en `ai-proposed-confirmed` solo queda la chispa discreta.
- Mantener el grupo de acciones siempre visible (en lugar de hover) consume espacio horizontal. Mitigación: en viewports estrechos, las acciones bajan a una segunda línea sin cambiar la jerarquía.
- El conflicto multi-fuente (US-011) requiere una variante de campo más compleja que se aleja del patrón estándar — pero ocurre en una fracción acotada de propuestas y la divergencia visual está justificada por la decisión que pide al founder.

**Neutral:**
- El audit trail del founder versus el del mentor exige dos vistas distintas. Es trabajo adicional de implementación pero coherente con el modelo de roles existente.
- La regla de no sobrescritura silenciosa (una nueva corrida no reemplaza `manual` ni `ai-proposed-confirmed`) implica acumular sugerencias secundarias. Es coste de almacenamiento bajo y costo de UI manejable porque se exponen bajo demanda.

---

## Alternatives considered

### Alternativa A — Modal de revisión post-extracción ("Fill all + review later")

Tras lanzar el autofill, todos los campos se llenan en segundo plano y el founder es llevado a una pantalla dedicada que lista las propuestas para confirmar en bloque.

**Rechazada porque:** Separa el valor de su contexto del Step, obliga al founder a alternar mentalmente entre la pantalla de revisión y la pantalla del Step para entender qué significa cada campo, y permite confirmar en lote sin verificar — lo que erosiona el driver de "comprensión sin ayuda" y aumenta el riesgo de confirmaciones ciegas que el mentor luego tendría que corregir.

### Alternativa B — Panel lateral persistente de provenance

El campo solo muestra el valor; un panel lateral (siempre visible a la derecha) muestra el provenance del campo enfocado.

**Rechazada porque:** Funciona en monitores anchos pero degrada severamente en laptops 13" y en navegadores con sidebars de extensiones. Además rompe la regla de UI rules "no romper el flujo con pantallas aisladas" porque el provenance vive estructuralmente fuera del Step y obliga a un movimiento ocular adicional. La accesibilidad por teclado es más frágil (el foco del campo y el foco del panel viven en regiones distintas).

### Alternativa C — Auto-confirm con threshold alto (≥ 0.90)

Los campos con confianza ≥ 0.90 se confirman automáticamente y solo los de confianza media requieren acción del founder.

**Rechazada porque:** Viola US-009 ("the system SHALL marcar el campo como autoritativo solamente después de Confirmar o Editar+Guardar, nunca por el solo hecho de haber sido propuesto") y US-017 (no-bypass del flujo de aprobación). Aun con factuality ≥ 0.90 documentado en gold set, la confianza emitida por el modelo no es garantía de acierto en un PDF concreto, y un autofill no consentido transferiría responsabilidad al sistema en vez de al founder, lo que rompe el contrato de aprobación con el mentor.

### Alternativa D — Único botón "Aceptar" con menú de opciones

Reemplazar los tres botones explícitos por un único CTA "Revisar" que abre un menú con Confirmar/Editar/Descartar.

**Rechazada porque:** Esconde dos de las tres acciones detrás de un click adicional, aumentando la fricción para la acción más frecuente (Confirmar) y violando la regla de UI rules "demasiados CTA compitiendo" en el sentido inverso — la solución correcta es jerarquizar tres CTA por peso visual, no ocultar dos. También complica la accesibilidad por teclado (los shortcuts dedicados pierden sentido si las acciones están detrás de un menú).

---

## Compliance: a11y + UX writing

**Accesibilidad:**
- Cada estado del campo debe estar identificado por al menos tres canales perceptuales (ícono + borde + label) además del color de fondo. Contraste mínimo 4.5:1 para texto y 3:1 para componentes UI según WCAG 2.1 AA.
- Las tres acciones Confirmar / Editar / Descartar deben ser alcanzables por teclado mediante tabulación en el orden visual y mediante los shortcuts `Enter` / `E` / `Supr` cuando el foco está en el grupo de acciones del campo.
- Cada campo `ai-proposed-unconfirmed` debe exponer un texto accesible que combine: estado ("Valor propuesto por inteligencia artificial, sin confirmar"), confianza ("Confianza [alta/media/baja]"), y acciones disponibles. Usar `aria-describedby` para asociar el campo con su provenance.
- El gate de US-017 debe anunciarse al cargar la vista de Step 4 y cada vez que el contador cambia, sin spam — un anuncio por evento significativo.
- El callout de conflicto (US-011) debe usar `role="alert"` solo cuando aparece por primera vez, no en cada re-renderizado.

**UX writing (basado en `starteria-ux-writing.md`):**
- Tono claro, humano, directo, en español latino. Evitar spanglish ("autofill" en UI ✗, "auto-rellenado" ✓).
- Mensajes orientados a acción. Evitar genéricos. Ej. al descartar: "Listo, propuesta descartada. Puedes deshacer durante los próximos 8 segundos." NO "Acción completada."
- Confianza baja (campo vacío por US-012): copy del placeholder debe explicar el motivo, no solo el estado. Ej. "No encontramos evidencia suficiente en los PDFs cargados. Puedes completarlo a mano." NO "Sin datos."
- Mensajes del gate de US-017 deben orientar y destrabar, no acusar. Ej. "Tienes N campos propuestos por IA sin confirmar. Revísalos antes de enviar a tu mentor." NO "Acción bloqueada."
- Estructura "qué está bien / qué falta / qué recomienda hacer ahora" aplica al banner de pendientes cuando N > 0.

---

## References

- PRD-002 — Auto-rellenado de Steps con extracción IA desde PDFs (US-008, US-009, US-010, US-011, US-012, US-014, US-017)
- ADR-001 — Selección de modelos LLM para sistema multi-agente Starteria
- ADR-002 — Orchestration Hierarchical Orchestrator-Worker
- ADR-003 — Prompt strategy
- `docs/starteria-ui-rules.md` — Principios de UI y reglas de diferenciación de estados
- `docs/starteria-ux-writing.md` — Tono, reglas de redacción y estructura de feedback
- `docs/diagrams/initiative-approval-flow.drawio` — Estados `en_step_0` … `en_step_4` → `esperando_revision`

---

*Template version 1.0 -- BHIL AI-First Development Toolkit -- [barryhurd.com](https://barryhurd.com)*
