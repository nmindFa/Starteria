Actúa como UX/UI Designer + Prototyper en Figma.

Contexto:
- Estoy en el dashboard de Startería, dentro de un proyecto, al final del Step 2 (Diseñar solución) en el submódulo D - Cards.
- Step 2 ya tiene “Revisión IA: Aprobado” y está pendiente la “Sesión con experto obligatoria”.
- Necesito que la última acción “Agendar sesión con mentor” sea el paso que DESBLOQUEA Step 3 y me permita TESTEAR las pantallas del Step 3 dentro del mismo flujo del dashboard (misma estructura visual: sidebar, header, contenedor, estilo).
- Regla del PRD: el desbloqueo del siguiente step requiere IA aprobó + sesión experto aprobada. En este prototipo, simula que al “Agendar sesión” queda aprobado para desbloquear Step 3 (modo demo). Mantén el copy claro para que se entienda que es una simulación. (REQ-FLOW-004) 

Objetivo del trabajo:
1) Mantener el mismo layout del dashboard (no diseñes una app distinta, no cambies navegación global).
2) Crear el flujo interactivo: Step 2 (final) → click “Agendar sesión con mentor” → modal/overlay para agendar → confirmación → Step 3 desbloqueado + navegación automática a Step 3.
3) Crear pantallas mínimas de Step 3 “Probar en pequeño” para poder testear UX: overview + 3 submódulos (A/B/C) con contenido placeholder realista (sin inventar datos), siguiendo patrón “entregables mínimos → revisión IA → sesión experto” para ejecutar experimento y capturar evidencia.

Instrucciones de diseño (importante):
- Reutiliza componentes existentes: botones, cards, chips, iconos, espaciados y tipografías del frame actual.
- No cambies el estilo visual. Mantén el color principal y el look & feel.
- No crees una navegación paralela. Todo debe sentirse parte del MISMO dashboard/proyecto.
- Usa nombres de frames y layers ordenados.

Entrega esperada (frames + prototipo):
A) STEP 2 (estado actual) — “Sesión con experto obligatoria” visible
- Mantén el bloque “Revisión IA: Aprobado”.
- Mantén el bloque “Sesión con experto obligatoria” con botón “Agendar sesión con mentor”.
- Agrega una micro-nota bajo el botón (texto pequeño) que diga: “Modo demo: al agendar se desbloquea el Step 3”.

B) OVERLAY/MODAL “Agendar sesión con mentor”
- Al hacer click en “Agendar sesión con mentor”, abrir un overlay modal centrado.
- Contenido del modal:
  - Título: “Agendar sesión con mentor”
  - Subtexto: “Selecciona una fecha y hora para validar el Step 2 y desbloquear el Step 3.”
  - Campos simples (mock): selector de fecha, selector de hora, dropdown “Mentor” (1 opción dummy), textarea opcional “Notas”.
  - Botones: “Cancelar” (cierra overlay) y “Confirmar sesión” (continúa).
- Interacciones:
  - “Cancelar” cierra overlay y vuelve al Step 2 sin cambios.
  - “Confirmar sesión” cierra overlay, muestra un toast “Sesión agendada. Step 3 desbloqueado.” y navega a Step 3.

C) STEP 2 (estado posterior a agendar) — opcional pero recomendado
- Crea una variante/frame donde el bloque de sesión cambie a estado “Agendada” o “Aprobada” (chip verde o check).
- El Step 2 debe quedar como “Aprobado” y Step 3 como “Disponible”.

D) STEP 3 — Overview (misma estructura del dashboard)
- Nuevo frame: “Step 3 — Probar en pequeño (Overview)”.
- Debe mantener:
  - Sidebar igual
  - Encabezado “Volver al proyecto”
  - Título “Step 3” y subtítulo “Probar en pequeño”
  - Menú interno tipo Step 2 pero ahora con submódulos de Step 3:
    A - Plan del experimento
    B - Ejecutar y capturar evidencia
    C - Resultados y decisión
- En el cuerpo:
  - Card “Resumen del experimento” (traído del Step 2 / Test Card):
    - Hipótesis (placeholder)
    - Experimento (placeholder)
    - Métrica + umbral go/no-go (placeholder)
    - Evidencia a capturar (placeholder)
    - Nota: “(Contenido de ejemplo para prototipo)”
  - Card/Checklist “Entregables mínimos del Step 3” (checklist vacía, 5 ítems).
  - Botón principal “Enviar a revisión IA” deshabilitado hasta que checklist mínima tenga checks (simula con estado visual, no necesitas lógica real compleja).

E) STEP 3A — Plan del experimento
- Frame: “Step 3A — Plan del experimento”
- Contenido:
  - Checklist de preparación (3–5 items)
  - Sección “Participantes / muestra” (placeholder)
  - Sección “Canal / logística” (placeholder)
  - CTA “Guardar borrador” + “Marcar como completo” (deshabilita si no hay checks; solo visual)

F) STEP 3B — Ejecutar y capturar evidencia
- Frame: “Step 3B — Ejecutar y capturar evidencia”
- Contenido:
  - Tabla/lista de evidencias (3 filas dummy): tipo (link/archivo/nota), descripción, fecha.
  - Botón “Adjuntar evidencia” (abre mini overlay simple con 2 opciones: “Subir archivo” / “Pegar link”).
  - Sección “Registro de resultados” con campos: valor medido, observaciones, incidencias (placeholder).

G) STEP 3C — Resultados y decisión
- Frame: “Step 3C — Resultados y decisión”
- Contenido:
  - Card “Comparación vs umbral” (muestra: Umbral, Resultado, Estado: Go/No-Go como chip).
  - Card “Aprendizajes” (3 bullets placeholder).
  - Campo “Decisión” con 3 botones: “Go”, “Iterar”, “No-Go” (solo visual).
  - Botón “Enviar a revisión IA” (visible).
  - Luego, al enviar, muestra un bloque “Revisión IA (placeholder)” y un bloque “Sesión con experto obligatoria” (mismo patrón del Step 2).

Prototipado (clicks):
- Desde Step 2 (final), el botón “Agendar sesión con mentor” abre el overlay.
- “Confirmar sesión” navega automáticamente al frame “Step 3 — Overview”.
- En Step 3 Overview, cada submódulo (A/B/C) navega a su frame correspondiente.
- En Step 3, agrega un indicador visual de que Step 3 está “desbloqueado” y “En progreso”.
- Mantén transiciones simples (instant o dissolve); overlay como “Open overlay”.

Nomenclatura:
- Usa nombres: “S2_Final_PendingMentor”, “Overlay_ScheduleMentor”, “S3_Overview”, “S3A_Plan”, “S3B_Evidence”, “S3C_Results”.

Restricciones:
- No inventes datos reales del proyecto; usa placeholders explícitos.
- No cambies la arquitectura visual del dashboard.
- No crees una experiencia alternativa fuera del flujo.