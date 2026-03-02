Actúa como Product Designer en Figma. Estoy en Startería > Step 3 “Probar en pequeño” (submódulos A/B/C). Necesito MEJORAR el Step 3 sin crear pantallas nuevas fuera del dashboard ni romper el look & feel: solo actualizar los frames actuales de Step 3A, Step 3B y Step 3C manteniendo sidebar/header/tipografías/spacing/componentes.

PROBLEMA GLOBAL:
- Step 3A hoy explica hipótesis/muestra/métrica, pero NO conceptualiza el experimento como sistema (componentes/artefactos + dónde/cuándo).
- Step 3B hoy registra evidencias/resultados, pero NO captura aprendizajes cualitativos ni guía iteraciones (2da validación / siguientes pruebas) ni alerta contra “perfeccionismo”.
- Step 3C muestra resultado vs umbral, pero falta un comparativo IA entre “lo esperado (Step 2)” vs “lo real (campo)”, un diagnóstico preliminar editable, recomendaciones (Go/Iterar/No-Go/Pivote) y un puente directo para Step 4 (story/presentación) sin obligar a crear un experimento nuevo.

OBJETIVO:
1) Completar la “conceptualización” del experimento en Step 3A (qué piezas lo componen + logística + instrumentación).
2) Convertir Step 3B en una bitácora operativa + “malla receptora” de aprendizajes (ideas, críticas, preguntas, nuevas hipótesis) y habilitar ciclos de re-test (iteraciones) con apoyo de IA.
3) Convertir Step 3C en un cierre robusto: IA compara plan vs ejecución, produce diagnóstico editable y recomendaciones accionables; si hay pivote, NO llevar a otra ventana/flujo nuevo, sino capturar aprendizajes y preparar insumos para Step 4 (presentación).

REGLAS DE DISEÑO (OBLIGATORIAS):
- Mantén exactamente el estilo del dashboard (componentes, colores, chips, cards, botones).
- No inventes datos reales: usa placeholders explícitos tipo “(Contenido de ejemplo para prototipo)”.
- No agregues nuevas rutas fuera de Step 3; todo ocurre dentro del mismo Step 3 y prepara el salto a Step 4 sin “crear experimento nuevo”.
- Nombra layers/frames ordenado.

CAMBIOS ESPECÍFICOS POR SUBMÓDULO:

A) STEP 3A — “Plan del experimento” (CONCEPTUALIZACIÓN)
1) Agrega sección “Formato del experimento” (chips/radio):
   - Formulario / Landing / WhatsApp / Prototipo / Concierge / Piloto operativo.
2) Agrega card “Componentes del experimento (artefactos)”:
   - Lista en mini-cards. Cada componente muestra: Nombre, Propósito, Canal/Herramienta, Owner, Link/Asset, Estado (Pendiente/Listo), DoD (1 línea).
   - Botón “+ Agregar componente” (abre modal).
3) Modal “Agregar componente”:
   - Inputs: Nombre, Propósito, Canal/Herramienta, Owner, Link/Asset, DoD, Estado. Botones: Cancelar / Guardar componente.
4) Agrega card “Logística (dónde y cuándo)”:
   - Campos: Dónde (contexto/canal), Cuándo (fecha/ventana), Duración, Quién dispara el piloto, Contingencia (1 línea).
5) Agrega card “Captura de evidencia (instrumentación)”:
   - Tabla: Dato a capturar | Fuente | Responsable | Evidencia (link/archivo).
   - Botón “Adjuntar evidencia” (overlay simple: “Pegar link / Subir archivo”).

B) STEP 3B — “Ejecutar y capturar evidencia” (BITÁCORA + MALLA RECEPTORA + CICLOS)
Mantén la tabla de Evidencias y el “Registro de resultados”, pero agrega 3 bloques nuevos:

1) Card “Bitácora de ejecución (qué se hizo)”:
   - Lista tipo timeline (fecha/hora + acción + responsable + notas).
   - Botón “+ Registrar evento” (overlay/modal con campos: Fecha/hora, Acción ejecutada, Responsable, Nota breve).
   - Objetivo: que el equipo registre lo ejecutado (no solo el output final).

2) Card “Malla receptora (lo que aprendimos en campo)” con 4 secciones:
   a) “Ideas interesantes observadas” (bullets + botón “+ agregar”)
   b) “Críticas constructivas / fricciones” (bullets + botón “+ agregar”)
   c) “Preguntas nuevas que surgieron” (bullets + botón “+ agregar”)
   d) “Nuevas hipótesis / mejoras sugeridas” (bullets + botón “+ agregar”)
   - Cada ítem debe poder capturarse en un modal simple: Tipo (idea/crítica/pregunta/hipótesis), Descripción, Evidencia asociada (opcional link), Severidad/impacto (bajo/medio/alto opcional).

3) Card “Siguiente iteración (re-test)”:
   - Microcopy claro: “No busques lo perfecto. Apunta al MVP: lo mínimo que resuelve y se puede probar.”
   - Campos:
     - “Qué punto pendiente validaremos ahora” (placeholder)
     - “Qué cambiaremos del experimento (1–3 cambios)” (placeholder)
     - “Cómo lo volveremos a probar (método/canal)” (placeholder)
     - “Cuándo lo probaremos (fecha/ventana)” (placeholder)
   - Botón “Definir qué sigue con IA”:
     - Abre overlay “Sugerencias IA — siguiente paso de experimentación”.
     - El overlay genera (placeholder) 3 opciones:
       1) “Iterar” (pequeño ajuste y re-test rápido)
       2) “Complementar” (2da validación con usuarios para puntos pendientes)
       3) “Pivote parcial” (ajuste de enfoque sin empezar de cero)
     - Cada opción trae: objetivo, cambio propuesto, evidencia a capturar, y duración estimada (placeholder).
     - Botón “Aplicar sugerencia” (rellena los campos de “Siguiente iteración” en el frame, aunque sea visualmente).

C) STEP 3C — “Resultados y decisión” (COMPARATIVO IA + DIAGNÓSTICO + RECOMENDACIONES + HANDOFF STEP 4)
Mantén “Comparación vs umbral” y “Aprendizajes clave”, pero agrega 4 bloques nuevos:

1) Card “Comparativo: Plan (Step 2) vs Real (campo)”:
   - Tabla comparativa 2 columnas:
     - “Lo que esperábamos” (Hipótesis/umbral/métrica del Step 2)
     - “Lo que pasó” (resultado real + notas)
   - Campos vienen precargados como placeholder desde el “Resumen del experimento del Step 2” (solo visual).

2) Card “Diagnóstico preliminar IA (editable)”:
   - Un bloque tipo “Revisión IA” pero enfocado en diagnóstico:
     - “Señales positivas” (2–3 bullets placeholder)
     - “Riesgos / fricciones” (2–3 bullets placeholder)
     - “Qué falta validar” (1–2 bullets placeholder)
   - Botón “Editar diagnóstico” (habilita edición del texto o abre modal para ajustar; visual basta).

3) Card “Recomendación IA: qué hacer ahora”:
   - Según el estado Go/Iterar/No-Go/Pivote (placeholder), muestra recomendaciones concretas:
     - Si Go: “qué escalar” + “condiciones para escalar” + “riesgos”
     - Si Iterar: “qué ajustar” + “próximo re-test” + “evidencia”
     - Si No-Go: “por qué no” + “qué aprendimos” + “qué no repetir”
     - Si Pivote: NO crear ‘nuevo experimento’; solo:
       - “Qué aprendizaje nos hace pivotar”
       - “Qué variable cambia (usuario/propuesta/canal)”
       - “Qué mantener del experimento actual”
       - “Qué validar primero en un siguiente ciclo”
   - Botón “Refinar recomendación con IA” (overlay con 2–3 versiones placeholder y CTA “Usar esta”).

4) Card “Preparar Step 4 — Contar la historia (insumos)”:
   - Sin cambiar de step ni abrir ventana nueva, agrega un “kit” de salida para Step 4:
     - “Story outline” (Problema → Hipótesis → Experimento → Resultados → Decisión → Aprendizajes → Próximo paso)
     - “Bullets para slides” (5–7 bullets placeholder)
     - “Evidencias a mostrar” (links a 2–3 evidencias ya adjuntadas; placeholder)
   - Botón “Generar borrador de presentación con IA”:
     - Abre overlay con una estructura de 6–8 láminas (títulos + bullets placeholder).
     - Botón “Aplicar” (muestra la estructura en la card como lista; NO exportes a otro lugar).

PROTOTIPO (INTERACCIONES CLAVE):
- Step 3A: “+ Agregar componente” abre modal; “Guardar componente” cierra modal y añade un item (visual).
- Step 3B: “+ Registrar evento” abre modal y agrega evento al timeline (visual). “Definir qué sigue con IA” abre overlay con 3 opciones; “Aplicar sugerencia” rellena campos (visual).
- Step 3C: “Editar diagnóstico” permite edición (visual). “Generar borrador de presentación con IA” abre overlay con outline y “Aplicar” lo pega en la card “Preparar Step 4”.

NOMENCLATURA (si necesitas variantes):
- Mantén nombres actuales y agrega componentes/layers con prefijos:
  - S3A_Formato, S3A_Componentes, S3A_Logistica, S3A_Instrumentacion
  - S3B_Bitacora, S3B_MallaReceptora, S3B_SiguienteIteracion, Overlay_S3B_AI_Next
  - S3C_Comparativo, S3C_DiagnosticoIA, S3C_RecomendacionIA, S3C_Pack_Step4, Overlay_S3C_AI_Deck