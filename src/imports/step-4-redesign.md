Actúa como Product Designer en Figma. Estoy en Startería > Step 4 “Contar la historia” (Overview + submódulos A/B/C). Necesito que el Step 4 tenga un enfoque estratégico: no solo “presentación”, sino “story + decisión + plan (implementación/iteración) + sensibilidad organizacional”. Todo dentro del MISMO dashboard/proyecto, manteniendo look & feel.

PROBLEMA:
- No queda clara la función del Overview.
- Falta acceso rápido a “entregables” de los Steps 1–3 como resumen/descargable para armar el deck.
- “Deck y ensayo” debería incluir también plan de implementación (GO) o plan de iteración (ITERAR) o aprendizajes/qué no hacer (PIVOTE/NO-GO).
- La narrativa debe adaptarse a la audiencia y considerar realidad organizacional (cultura, estructura, relaciones entre áreas, dependencias).

OBJETIVO:
Rediseñar SOLO Step 4 (Overview + A/B/C) para que:
1) Overview sea “Control Tower”: resumen + descargables + selección de audiencia + selección de decisión + acceso a outputs.
2) A: Narrativa se adapte a audiencia (tono y foco) con IA.
3) B: Evidencias conecte evidencia -> mensaje -> slide.
4) C: “Deliverables finales” incluya Deck + Plan (GO/ITERAR) + Learnings (PIVOTE/NO-GO) + talk track.

REGLAS:
- Mantén el mismo layout/estilo del dashboard (sidebar, header, cards, chips, spacing).
- No crees pantallas fuera de Step 4. Si agregas secciones, que sea dentro de los mismos frames o como overlays.
- No inventes datos reales: usa placeholders “(Contenido de ejemplo para prototipo)”.
- Nombra layers/frames ordenado.

CAMBIOS EN STEP 4 OVERVIEW (frame actual):
1) Encabezado: agrega un bloque “Configuración de historia”
   - Selector de AUDIENCIA (chips): Gerencia / Sponsor / Comité / Equipo operativo / TI / RRHH
   - Selector de OBJETIVO (chips): Alinear / Pedir aprobación / Pedir recursos / Decidir (Go/Iterar/No-Go) / Informar avance
   - Selector de DECISIÓN (chips): Go / Iterar / No-Go / Pivote
   - Microcopy: “Tu historia se ajusta automáticamente según audiencia y objetivo.”

2) Agrega una sección nueva “Entregables por Step (resumen + descargables)”
   - 4 cards (Step 1, Step 2, Step 3, Step 4)
   - Cada card incluye:
     a) Resumen de 3–5 bullets (placeholder)
     b) Botones: “Ver resumen” y “Descargar (demo)”
     c) Lista de artefactos: HMW, Solution Card, Test Card, Blueprint del experimento, Evidencias, Resultados, Decisión (según step)
   - “Descargar (demo)” abre overlay con opciones:
     - PDF one-pager
     - Doc narrativo
     - CSV/Sheet de evidencias
     (solo visual)

3) Reemplaza/expande “Checklist para cerrar el Step 4” para que sea “Checklist de impacto”
   - Story outline completo
   - Evidencias seleccionadas y mensaje por evidencia
   - Recomendación/decisión clara
   - Deck listo (estructura)
   - Plan listo (implementación o iteración o aprendizajes)
   - Talk track listo
   (ajusta contador)

4) Agrega una sección “Contexto organizacional (para que sea realista)”
   - Campos breves tipo checklist/inputs:
     - Cultura (qué puede resistirse)
     - Estructura (áreas afectadas)
     - Relaciones/dependencias (quién debe alinearse)
     - Riesgos (top 3)
     - Requerimientos (recursos, herramientas, tiempo)
   - Botón “Sugerir consideraciones con IA” (overlay con bullets placeholder)

CAMBIOS EN STEP 4A — NARRATIVA:
1) Mantén las 7 secciones, pero agrega:
   - “Enfoque por audiencia” (muestra tags: Impacto, Riesgo, Costo/beneficio, Operación, Tiempo)
   - Botón “Ajustar a audiencia con IA”
     - Overlay con 3 versiones:
       - Ejecutiva (60–90 seg, foco decisión)
       - Operativa (foco implementación y riesgos)
       - Técnica (foco evidencia y método)
     - Botón “Aplicar versión” (visual)

2) Agrega una sección nueva al final: “Pedido final (call-to-action)”
   - Qué decisión necesitamos
   - Qué apoyo necesitamos (recursos, sponsor, acceso, gobernanza)
   - Próximo hito y fecha (placeholder)

CAMBIOS EN STEP 4B — EVIDENCIAS:
1) Cambia la lógica a “Evidencia -> Mensaje -> Slide”
   - Por cada evidencia:
     - Checkbox “Incluir”
     - Campo “Qué demuestra”
     - Campo “Qué decisión soporta”
     - Dropdown “Slide sugerida” (Resultado / Riesgo / Aprendizaje / Próximo paso)
2) Botón “Recomendar evidencia + mensaje con IA”
   - Overlay: top 3 evidencias + mensaje propuesto + por qué (placeholder)

CAMBIOS EN STEP 4C — DECK Y ENSAYO (renombrar a “Entregables finales”):
Divide el frame en 3 tabs o 3 cards grandes (sin salir de Step 4C):
1) “Deck” (estructura de 6–8 slides)
2) “Plan” (cambia según decisión seleccionada en Overview)
3) “Talk track” (60–90 seg + checklist de ensayo)

PLAN (dinámico por decisión):
- Si DECISIÓN = GO: mostrar “Plan de implementación”
  * 30-60-90 días (tabla)
  * RACI simple (Responsable/Aprobador/Soporte)
  * Dependencias y riesgos
  * Estrategia de adopción (comunicación + entrenamiento)
  * Métricas a monitorear (post-implementación)

- Si DECISIÓN = ITERAR: mostrar “Plan de iteración”
  * Qué ajustar (1–3 cambios)
  * Próximo experimento / re-test (cuándo, con quién, canal)
  * Evidencia mínima a capturar
  * Criterio go/no-go para cerrar siguiente ciclo
  * Recordatorio MVP: “no busques perfección”

- Si DECISIÓN = PIVOTE o NO-GO: mostrar “Aprendizajes y qué no hacer”
  * Supuestos invalidados
  * Señales encontradas en campo
  * Qué mantener (lo rescatable)
  * Qué NO repetir (errores)
  * Qué validar primero si se re-intenta (siguiente pregunta crítica)
  * Cómo contarlo sin vender humo (aprendizaje como valor)

Agrega botones IA (overlays) en Step 4C:
- “Generar deck según audiencia” (2 variantes)
- “Generar plan según decisión” (1 borrador)
- “Generar talk track” (1 borrador)

PROTOTIPADO:
- Overlays abren/cierran.
- “Ir a A/B/C” navega a cada submódulo.
- No requiere lógica real; basta visual + navegación a variantes.

NOMBRE DE OVERLAYS:
- Overlay_S4_Downloadables_Demo
- Overlay_S4_AI_ContextoOrg
- Overlay_S4_AI_AudienceNarrative
- Overlay_S4_AI_EvidenceMessaging
- Overlay_S4_AI_Deck
- Overlay_S4_AI_Plan
- Overlay_S4_AI_TalkTrack