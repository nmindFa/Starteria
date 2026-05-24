---
id: PRD-002
title: "Auto-rellenado de Steps con extracción IA desde PDFs"
status: draft
date: 2026-05-17
author: BHIL Spec-Writer (Swarm)
sprint: S-02
priority: high
children: []
adrs: [ADR-004, ADR-005, ADR-012-backend]
---

# PRD-002: Auto-rellenado de Steps con extracción IA desde PDFs

## Problem statement

Los emprendedores (founders) que trabajan en una iniciativa Starteria no pueden trasladar la información que ya tienen documentada (planes de negocio, investigaciones de mercado, transcripciones de entrevistas, reportes internos, encuestas) hacia los campos estructurados de los Steps 0-4 porque hoy la única vía es transcripción manual campo por campo, lo que duplica trabajo, introduce errores y desincentiva el uso de evidencia previa.

---

## User stories (EARS format)

**US-001 -- Carga de documentos:**
WHEN un emprendedor en estado `en_step_0` … `en_step_4` arrastra o selecciona uno o varios archivos PDF en el panel de "Documentos de respaldo" de su iniciativa, the system SHALL validar tipo MIME, tamaño y número de archivos contra los límites definidos, registrar cada archivo con un identificador único, mostrar el estado de carga por archivo y rechazar con un mensaje específico cualquier archivo que viole los límites.

*Acceptance bands US-001:* tasa de éxito de cargas válidas ≥ 0.98 sobre N=200 intentos; tasa de mensajes de rechazo correctos ≥ 0.95 sobre N=50 intentos inválidos (formato no-PDF, archivo > tamaño máx, > 10 archivos, archivo cifrado con contraseña).

**US-002 -- Parseo y preparación:**
WHEN un PDF ha terminado de cargarse correctamente, the system SHALL extraer su contenido textual con referencia de página por bloque, detectar el idioma dominante (español o inglés) y dejarlo disponible para extracción en un tiempo P95 menor a 30 segundos para documentos de hasta 50 páginas.

*Acceptance bands US-002:* fidelidad de extracción de texto ≥ 0.95 (caracteres correctos / caracteres totales en gold set anotado) sobre N=30 PDFs; detección de idioma con accuracy ≥ 0.95 sobre N=50 PDFs etiquetados.

**US-003 -- Extracción de campos de Step 0 (Onboarding):**
WHEN el founder solicita "Auto-rellenar Step 0" sobre uno o más PDFs ya parseados y la iniciativa se encuentra en estado `en_step_0`, the system SHALL proponer valores para los campos de onboarding (datos personales del founder, rol, descripción del reto, contexto del proceso, impacto percibido, respaldo inicial) acompañados de provenance (PDF origen + página(s) + extracto citado + score de confianza 0.00-1.00) sin sobrescribir los campos que el founder ya haya editado manualmente.

*Acceptance bands US-003:* precisión por campo Step 0 ≥ 0.80 sobre N=50 PDFs anotados; 0 sobreescritura de campos manualmente editados sobre N=100 ejecuciones de QA; respeto del estado `en_step_0` validado en 100% de los intentos (no se ejecuta extracción si la iniciativa está fuera de ese estado).

**US-004 -- Extracción de campos de Step 1 (Validar y aterrizar el problema):**
WHEN el founder solicita "Auto-rellenar Step 1" y existe contenido relevante en los PDFs adjuntos, the system SHALL proponer valores para los módulos A (análisis inicial del problema), B (definición de captura: objetivos, perfiles, temas, preguntas) y C (evidencia y validación) con provenance por campo y omitir cualquier módulo para el cual no exista evidencia con confianza suficiente.

*Acceptance bands US-004:* precisión por campo Step 1 ≥ 0.78 sobre N=50 PDFs anotados (los campos cualitativos como "perfiles" y "temas" pueden tener umbral 0.70); 0 propuestas en módulos sin evidencia documentada.

**US-005 -- Extracción de campos de Step 2 (Formular oportunidad y diseñar experimento):**
WHEN el founder solicita "Auto-rellenar Step 2" sobre PDFs parseados, the system SHALL proponer hasta 3 candidatos de HMW, hasta 15 ideas iniciales y los campos del card de experimentación (hipótesis riesgosa, qué testear, con quién, dónde y cuándo, método, métrica de éxito, pasos, riesgos, evidencia a capturar), marcando explícitamente cuáles son extraídos del PDF y cuáles son sugerencias del agente sin respaldo documental.

*Acceptance bands US-005:* precisión por campo card de experimentación ≥ 0.75 sobre N=40 PDFs anotados; 100% de las ideas/HMW generativos (sin extracto de PDF) están marcados visualmente como "sugerencia del agente" y no como "extraído del PDF".

**US-006 -- Extracción de campos de Step 3 (Ejecutar, aprender y decidir):**
WHEN el founder solicita "Auto-rellenar Step 3" y los PDFs contienen evidencia de ejecución (resultados, transcripciones de testeo, métricas observadas), the system SHALL proponer valores para el plan del experimento (Módulo A) y para los registros de testeo, aprendizajes, fricciones y resultados (Módulo B), siempre con provenance por campo.

*Acceptance bands US-006:* precisión por campo Step 3 ≥ 0.75 sobre N=40 PDFs anotados; tasa de campos numéricos (métricas) correctos ≥ 0.85 con normalización de unidades documentada en provenance.

**US-007 -- Extracción de campos de Step 4 (Storytelling y plan de acción):**
WHEN el founder solicita "Auto-rellenar Step 4" sobre PDFs parseados, the system SHALL proponer valores para audiencia, objetivo de presentación, estructura de la presentación, y para el plan de acción (etapas, actividades, responsables, horizonte) con provenance por campo y sin generar contenido que no esté presente en los PDFs o derivable directamente de Steps previos.

*Acceptance bands US-007:* precisión por campo Step 4 ≥ 0.75 sobre N=40 PDFs anotados; tasa de alucinación en campos narrativos (audiencia, objetivo) ≤ 0.05 verificada por LLM-judge + sampling humano sobre N=80 propuestas.

**US-008 -- Visualización de provenance:**
WHILE un campo de cualquier Step contenga un valor propuesto por la IA y aún no confirmado por el founder, the system SHALL mostrar inline un indicador visual distinto del valor manual, el nombre del PDF origen, la(s) página(s) referenciada(s), el extracto citado (no más de 280 caracteres) y un score de confianza categorizado (alta ≥ 0.80, media 0.60-0.79, baja < 0.60).

*Acceptance bands US-008:* en pruebas de usabilidad con N=8 founders, ≥ 7 reconocen sin ayuda que el valor es propuesto por IA; ≥ 6 ubican la página origen en el PDF en ≤ 15 segundos; comprensión correcta del score categorizado ≥ 0.85 sobre N=20 sesiones.

**US-009 -- Confirmación o edición por el founder:**
WHEN el founder revisa un campo auto-rellenado, the system SHALL ofrecer tres acciones explícitas — "Confirmar", "Editar" (entra a edición manual conservando provenance como referencia histórica) y "Descartar" (borra el valor propuesto) — y SHALL marcar el campo como autoritativo solamente después de "Confirmar" o "Editar+Guardar", nunca por el solo hecho de haber sido propuesto.

*Acceptance bands US-009:* 0 casos donde un campo auto-rellenado quede marcado como autoritativo sin acción explícita del founder, sobre N=200 escenarios automatizados; reversibilidad de descarte verificada en 100% de los casos.

**US-010 -- Merge de múltiples documentos:**
WHEN el founder ha subido más de un PDF y solicita auto-rellenado de un Step, the system SHALL consolidar la evidencia disponible por campo, priorizando el extracto con mayor confianza y registrando en provenance todas las fuentes contribuyentes (no únicamente la dominante).

*Acceptance bands US-010:* completitud de provenance multi-fuente ≥ 0.95 (sobre N=30 escenarios con 2-5 PDFs por iniciativa, ningún PDF aporte queda sin registrar); precisión combinada ≥ 0.80 vs. la del PDF dominante solo.

**US-011 -- Resolución de conflictos entre PDFs:**
IF dos o más PDFs proponen valores contradictorios para el mismo campo y la diferencia de confianza entre ellos es menor a 0.10, THEN the system SHALL mostrar al founder ambas opciones lado a lado con sus respectivas provenance y pedir selección explícita antes de poblar el campo, en lugar de elegir automáticamente.

*Acceptance bands US-011:* tasa de detección de conflictos verdaderos ≥ 0.85 sobre N=30 escenarios con conflictos inyectados; tasa de falsos conflictos (campos compatibles marcados como conflicto) ≤ 0.10.

**US-012 -- Fallback de baja confianza:**
IF la confianza de extracción para un campo es menor a 0.60, THEN the system SHALL dejar el campo vacío, marcarlo con un indicador "sin evidencia suficiente" y registrar el motivo (cobertura insuficiente, ambigüedad, idioma no soportado), sin proponer un valor especulativo.

*Acceptance bands US-012:* 0 propuestas pobladas con score < 0.60 sobre N=200 ejecuciones; motivo registrado en 100% de los campos omitidos; mensaje al founder correctamente entendido en ≥ 0.85 de pruebas de usabilidad (N=8).

**US-013 -- Techo de costo por carga y por proyecto:**
WHILE el costo acumulado de extracción IA de una iniciativa en un mes natural alcance el techo definido en NFR, the system SHALL rechazar nuevas solicitudes de auto-rellenado para esa iniciativa, informar al founder del límite alcanzado y permitir la carga de PDFs (sin extracción) hasta el próximo ciclo de facturación.

*Acceptance bands US-013:* 0 sobrepasos del techo mensual por iniciativa sobre N=50 cohortes simuladas; mensaje al founder con claridad ≥ 0.85 (comprensión correcta en pruebas de usabilidad con N=8 participantes).

**US-014 -- Audit trail:**
WHEN cualquier operación de carga, parseo, extracción, propuesta, confirmación, edición o descarte ocurre, the system SHALL persistir un registro inmutable con timestamp, identificador de actor (founder, sistema), identificador de PDF, Step/módulo/campo, valor previo, valor propuesto, valor final y costo asociado, recuperable durante al menos 12 meses.

*Acceptance bands US-014:* cobertura del audit trail ≥ 0.999 (eventos registrados / eventos ocurridos) verificada por sampling sobre N=1000 acciones; integridad criptográfica del registro (sin modificación post-hoc) validada por hash chain en QA.

**US-015 -- Manejo de PII y datos sensibles:**
WHILE un PDF cargado contenga datos personales identificables (nombres completos, correos personales, teléfonos, documentos de identidad, direcciones), the system SHALL detectar y enmascarar dichos datos antes de enviar el contenido al modelo de extracción, almacenar el PDF original cifrado en reposo y permitir al founder marcar páginas como "no procesar".

*Acceptance bands US-015:* recall de detección de PII ≥ 0.95 sobre N=100 documentos con PII inyectada conocida; tasa de fugas de PII al modelo (false negatives) ≤ 0.02; tasa de falsos positivos que enmascaran texto no-PII relevante ≤ 0.05.

**US-016 -- Soporte multi-idioma (es / en):**
WHEN un PDF está predominantemente en inglés y el founder está trabajando una iniciativa en español, the system SHALL traducir los extractos al español al momento de poblar campos y conservar el extracto original en provenance para auditoría, manteniendo la calidad de extracción dentro del umbral definido en las métricas para ambos idiomas.

*Acceptance bands US-016:* fidelidad de traducción ≥ 0.85 (LLM-judge contra traducción humana) sobre N=30 extractos en→es; diferencia de precisión por campo entre PDFs en y es ≤ 0.10 absoluto.

**US-017 -- No-bypass del flujo de aprobación:**
WHILE una iniciativa contenga campos auto-rellenados sin confirmar, the system SHALL bloquear la transición de `en_step_4` a `esperando_revision` y mostrar al founder la lista de campos pendientes de confirmación, garantizando que el mentor reciba únicamente datos autoritativos.

*Acceptance bands US-017:* 0 casos de transición a `esperando_revision` con campos auto-rellenados sin confirmar sobre N=100 envíos simulados en QA; trazabilidad 100% de campos confirmados visible en audit trail antes de la transición.

---

## Success metrics

### Métricas de negocio / experiencia

| Métrica | Baseline | Target | Método de medición |
|---|---|---|---|
| Tiempo de captura de un Step (P50, founder con PDFs) | ~45 min (manual, observado en sesiones piloto) | ≤ 12 min asistido por IA | Telemetría: delta entre apertura de Step y submit a `esperando_revision` |
| Adopción de la feature | 0% | ≥ 50% de iniciativas creadas en el sprint suben al menos 1 PDF | Ratio iniciativas-con-pdf / iniciativas-totales |
| Tasa de confirmación de propuestas IA | N/A | ≥ 60% de campos auto-rellenados son confirmados sin edición | Eventos `field_autofill_confirmed` / total propuestos |
| Tasa de edición de propuestas IA | N/A | ≤ 30% de campos requieren edición sustancial (> 30% del texto cambiado) | Diff de longitud y distancia Levenshtein normalizada |
| Tasa de descarte | N/A | ≤ 10% de campos propuestos son descartados | Eventos `field_autofill_discarded` / total propuestos |
| Reducción de iteraciones mentor | Promedio 1.8 iteraciones por entrega (PRD-001) | ≤ 1.4 con autofill | FeedbackIA.status histórico antes/después |
| Costo mensual feature (100 iniciativas activas) | N/A | ≤ $150 USD | Agregado de costUsd en AuditLog para acciones de tipo `pdf_autofill_*` |

### Métricas de calidad IA

| Métrica de calidad IA | Umbral | N Evaluaciones | Método de evaluación |
|---|---|---|---|
| Precisión por campo (campos extraídos correctos / total extraídos) | ≥ 0.80 | 50 PDFs anotados (mix es/en) | Gold set anotado manualmente + comparación exacta normalizada |
| Recall por campo (campos detectados / campos presentes en el PDF) | ≥ 0.70 | 50 PDFs anotados | Gold set anotado manualmente |
| Factualidad (extractos sin alucinación, citas verificables) | ≥ 0.90 | 200 propuestas individuales | LLM-judge con el PDF como ground truth + verificación de página |
| Calibración de confianza (correlación entre score y acierto) | Pearson ≥ 0.65 | 200 propuestas | Análisis estadístico sobre gold set |
| Tasa de alucinaciones (campos con valor sin respaldo en el PDF) | ≤ 0.03 | 200 propuestas | Auditoría manual sobre muestra estratificada |
| Latencia P95 parseo (PDF de hasta 50 páginas) | < 30,000 ms | N/A | APM wall clock |
| Latencia P95 extracción de un Step completo | < 20,000 ms | N/A | APM wall clock |
| Cobertura idiomas (precisión inglés vs español) | Diferencia ≤ 0.10 | 25 PDFs en + 25 PDFs es | Comparación pareada sobre gold set |

---

## Non-functional requirements

- **Performance:**
  - Parseo P95 ≤ 30 segundos para PDFs de hasta 50 páginas; ≤ 90 segundos para PDFs de 50-150 páginas.
  - Extracción de un Step completo P95 ≤ 20 segundos.
  - Lectura sincrónica de provenance en la UI < 200 ms P95.
- **Availability:**
  - 99.0% uptime de la feature en horario de negocio (07:00-22:00 hora local).
  - Degradación graceful: si la extracción falla, la carga del PDF y su lectura manual deben seguir disponibles.
- **Security:**
  - Cifrado en reposo (PDFs originales y texto extraído).
  - Cifrado en tránsito en todas las llamadas internas y externas.
  - Detección y enmascarado automático de PII (DNI, correo personal, teléfono, dirección, nombre completo) antes de enviar contenido al modelo.
  - Retención por defecto 90 días para PDFs originales (configurable por founder hasta máximo 12 meses; obligatorio en audit trail por 12 meses sin contenido del PDF).
  - Acceso al PDF y a sus extracciones limitado al founder propietario, mentor asignado y portfolio lead correspondiente.
- **Cost:**
  - Techo por carga (parseo + extracción de todos los Steps relevantes): ≤ $0.30 USD por iniciativa por upload session.
  - Techo por iniciativa por mes: ≤ $1.50 USD.
  - Techo por cohorte / mes (100 iniciativas): ≤ $150 USD.
  - Alertas operativas al alcanzar 80% del techo mensual de cohorte; degradación a propuestas en cola (best-effort) al alcanzar 100%.
- **Compatibilidad con flujo de aprobación:** la feature no modifica las transiciones existentes del flujo. Todas las propuestas IA viven como capa pre-submission. El audit trail debe permitir al mentor distinguir, post-facto, qué campos fueron originados por IA y confirmados por el founder vs. ingresados manualmente desde el inicio.
- **Scalability:** Soporte para 50 cargas concurrentes y 100 iniciativas activas con PDFs sin degradación de latencia P95.
- **Observability:** Métricas por etapa (upload, parse, extract, propose, confirm) y por idioma; dashboard de costo por iniciativa y por cohorte; alertas si tasa de alucinaciones supera el umbral o si latencia P95 excede objetivo durante 15 minutos consecutivos.
- **Compliance:** consentimiento explícito del founder al cargar PDFs (declaración de propiedad o autorización de uso del contenido); derecho del founder a solicitar borrado de PDFs originales antes del periodo de retención por defecto.
- **Accesibilidad:** indicadores de provenance perceptibles por usuarios con daltonismo (no depender solo de color); navegación por teclado de las acciones Confirmar / Editar / Descartar; mensajes de estado anunciados por lectores de pantalla.

---

## Out of scope

Los siguientes elementos NO forman parte de este feature:

- Formatos distintos a PDF: archivos DOCX, HTML, imágenes sueltas (JPG/PNG), audio (WAV/MP3), video o planillas (XLSX/CSV).
- OCR sobre PDFs que son escaneos puros de manuscritos o documentos sin capa de texto. Los PDFs escaneados con OCR previo (texto seleccionable) sí entran en alcance; los puramente imagen quedan fuera del MVP.
- Envío automático al mentor sin paso explícito de confirmación por el founder. El feature termina antes de la transición a `esperando_revision`.
- Entrenamiento o fine-tuning de un modelo propietario para extracción. Se asume uso de modelos existentes vía el agente de extracción.
- Edición colaborativa multi-usuario en tiempo real sobre las propuestas IA. Una sola sesión de founder edita a la vez.
- Auto-rellenado de campos que no pertenezcan a Steps 0-4 (por ejemplo, ejecutivo del Portfolio Lead, decisiones de Sponsor).
- Resúmenes ejecutivos del PDF que no estén asociados a un campo específico de un Step.
- Integración con repositorios externos (Google Drive, Dropbox, SharePoint) para descubrir documentos automáticamente. La carga es siempre iniciada por el founder.
- Sugerencias proactivas tipo "subiste un PDF, deberías rellenar X". El founder dispara explícitamente cada auto-rellenado.

---

## Constraints and assumptions

**Constraints:**

- Se debe respetar el flujo de aprobación documentado en `docs/diagrams/initiative-approval-flow.drawio`. La feature opera únicamente en los estados `en_step_0` … `en_step_4` y nunca debe transicionar la iniciativa a `esperando_revision` sin confirmación del founder.
- Se debe respetar la arquitectura de agentes definida en PRD-001 (Orchestrator / Workers). El agente de extracción debe registrarse como un worker más con su entrada en routing.
- Máximo 10 archivos PDF por iniciativa, máximo 50 MB por archivo, máximo 200 páginas por archivo.
- Idiomas soportados: español y inglés. Cualquier otro idioma debe ser rechazado con un mensaje específico al founder.
- Se debe usar el sistema de autenticación y autorización existente (JWT, middleware) sin nuevos flujos.
- Se debe extender el modelo Prisma existente, no reemplazarlo. Nuevas tablas para PDFs y para propuestas autorellenadas deben respetar el patrón de las tablas existentes.
- Aprobación del founder es un gate obligatorio: ningún campo auto-rellenado puede llegar al mentor sin confirmación explícita (ver US-009 y US-017).

**Assumptions:**

- Los founders son los titulares legítimos de los documentos que suben (responsabilidad declarada al aceptar términos al cargar).
- Al menos un PDF cargado por iniciativa para que la feature tenga sentido. Iniciativas sin PDF siguen funcionando con flujo manual.
- Los PDFs son textualmente extraíbles (capa de texto presente). Un porcentaje < 10% pueden ser imagen pura; estos caen en out-of-scope.
- El volumen inicial es ≤ 100 iniciativas activas y ≤ 5 cargas/iniciativa/mes en promedio.
- El idioma de cada PDF es identificable con confianza > 0.80 mediante detección automática estándar.
- Los founders trabajan en navegadores modernos con soporte para drag-and-drop, FileReader y streaming.
- La API del proveedor de modelos LLM utilizada por el agente de extracción mantiene disponibilidad ≥ 99.5% durante el sprint.

---

## Dependencies

| Dependencia | Tipo | Estado |
|---|---|---|
| Sistema multi-agente Starteria (Orchestrator + Workers) — PRD-001 | Interna | Aprobada (en implementación) |
| Schema Prisma existente (Project, Step, User, AuditLog) | Interna | Disponible |
| Frontend React/TS — Step0Page.tsx … Step4Page.tsx | Interna | Disponible |
| Flujo de aprobación documentado — `docs/diagrams/initiative-approval-flow.drawio` | Interna | Disponible |
| ADR-001 (Selección de modelos LLM) | ADR | Aceptado |
| ADR-002 (Orchestration hierarchical) | ADR | Aceptado |
| ADR-003 (Structured output con system prompts) | ADR | Aceptado |
| ADR-PDF-EXTRACTION-MODEL (Selección de modelo y estrategia de extracción de campos desde PDFs) | ADR | Propuesto — pendiente de redacción |
| ADR-AUTOFILL-PROVENANCE-UX (Patrón visual y de interacción para mostrar provenance y gestionar confirmar/editar/descartar) | ADR | Propuesto — pendiente de redacción |
| ADR-PDF-STORAGE (Almacenamiento cifrado, retención, ciclo de vida y borrado de PDFs originales y derivados) | ADR | Propuesto — pendiente de redacción |
| Servicio de detección de PII | Interna o externa | Por definir en ADR-PDF-STORAGE |

---

## Open questions

- [ ] ¿Cuál es el techo aceptable de retención de PDFs por defecto: 90 días (propuesto), 30 días o 12 meses? Impacta storage, compliance y coste — Owner: Product / Legal, Due: 2026-05-24
- [ ] ¿Cómo se debe comportar la feature ante un PDF parcialmente cargado o corrupto: reintento automático, error visible al founder, o ambos con política de N reintentos? — Owner: Tech Lead, Due: 2026-05-24
- [ ] ¿Las propuestas auto-rellenadas deben expirar si el founder no las confirma en X horas/días, o persisten indefinidamente hasta confirmación o descarte explícito? — Owner: Product, Due: 2026-05-24
- [ ] ¿Cuál es el comportamiento esperado cuando un founder edita manualmente un campo ya confirmado y luego sube un nuevo PDF que propone un valor diferente: respetar manual, mostrar conflicto, o crear historial? — Owner: Product + UX, Due: 2026-05-24
- [ ] ¿La detección de PII se realiza on-device antes del upload, en el backend antes del envío al modelo, o en ambos puntos? Define el ADR-PDF-STORAGE — Owner: Security, Due: 2026-05-24
- [ ] ¿El soporte de inglés es obligatorio para el MVP o puede entrar en una segunda iteración? Afecta scope, gold set y cronograma — Owner: Product, Due: 2026-05-24
- [ ] ¿Los mentores deben poder ver el historial de propuestas IA (incluso descartadas) o solamente los valores autoritativos finales? — Owner: Product, Due: 2026-05-24

---

## Approval checklist

Before setting `status: approved`:
- [ ] Problem statement is one sentence with no solution hints
- [ ] All user stories use EARS format
- [ ] Success metrics are quantified
- [ ] Out-of-scope items are listed
- [ ] All open questions are resolved
- [ ] No implementation details appear in this document

---

*PRD-002 -- BHIL AI-First Development Toolkit -- Starteria PDF Autofill Agent*

*Referencias:* `docs/diagrams/initiative-approval-flow.drawio` (estados `en_step_0` … `en_step_4` → `esperando_revision`), `docs/starteria-step-logic.md` (módulos por Step), `front/src/app/pages/Step{0..4}Page.tsx` (categorías de campo), PRD-001 (sistema multi-agente), ADRs 001/002/003 (modelos, orquestación, structured output).
