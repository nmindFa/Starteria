Actúa como Product Designer en Figma. Estoy en Startería > Step 4 “Contar la historia” > Overview (este frame exacto seleccionado). Necesito que ACTUALICES ESTE MISMO FRAME (no crear otra pantalla distinta) manteniendo 100% el layout/estilo actual (sidebar, header, cards, tipografía, spacing). Solo agrega las secciones y componentes solicitados.

PROBLEMA:
En el Overview actual solo se ve:
- “Resumen para contar (del Step 3)”
- “Checklist para cerrar el Step 4” (estático)
- Cards de navegación A/B/C
Pero NO aparece:
1) “Entregables por Step (resumen + descargables)”
2) Un checklist recomendado por IA (con diagnóstico de qué falta y acciones sugeridas)
3) Botones/overlays de descarga (demo) ni de recomendación IA.

OBJETIVO:
Convertir el Overview en un “Control Tower” para armar historia y deck:
- Mostrar entregables/resúmenes de Steps 1–3 (y Step 4) como “descargables / resumen” a la mano.
- Hacer que el checklist sea dinámico/IA-recomendado (con sugerencias accionables).
- Mantener navegación a A/B/C como está.

CAMBIOS (OBLIGATORIOS) EN ESTE FRAME:

A) Sección nueva: “Entregables por Step (resumen + descargables)”
- Colócala entre “Resumen para contar (del Step 3)” y el checklist.
- Diseña 4 cards (Step 1, Step 2, Step 3, Step 4) en formato compacto, cada una con:
  1) Título + chip de estado (Ej: “Listo / En progreso”)
  2) Mini resumen (3 bullets placeholder)
  3) Lista de artefactos (chips o bullets):
     - Step 1: Desafío, usuario, problema, evidencia
     - Step 2: HMW, ideas, matriz DVF, Solution Card, Test Card
     - Step 3: Blueprint/plan, evidencias, resultados, decisión, aprendizajes
     - Step 4: Story outline, evidencias seleccionadas, deck, plan/talk track
  4) Botones:
     - “Ver resumen” (abre overlay)
     - “Descargar (demo)” (abre overlay)
- Overlays:
  1) Overlay “Ver resumen” (contenido placeholder en formato one-pager)
  2) Overlay “Descargar (demo)” con opciones:
     - “One-pager (PDF)”
     - “Documento narrativo”
     - “Listado de evidencias (CSV/Sheet)”
     (solo visual, no export real)

B) Checklist para cerrar el Step 4: convertirlo en “Checklist recomendado por IA”
- Mantén la card, pero agrega:
  1) Encabezado con chip “Recomendación IA”
  2) Texto: “La IA te sugiere el siguiente orden para maximizar impacto.”
  3) Reordena los ítems y agrega 2 ítems nuevos:
     - “Audiencia definida y mensaje adaptado”
     - “Plan listo según decisión (Go/Iterar/Pivote)”
  4) Al lado derecho o debajo, agrega un bloque “Sugerencias IA (qué falta)” con 3–5 bullets (placeholder) que cambian el foco:
     - “Te falta seleccionar evidencias clave y explicar qué demuestra cada una.”
     - “Define el pedido final a la audiencia (qué decisión necesitas).”
     - “Genera el plan (implementación o iteración) antes del talk track.”
  5) Botón: “Recomendar checklist con IA” (abre overlay)

- Overlay “Recomendar checklist con IA”:
  - Muestra 3 versiones del checklist según audiencia (placeholder):
    1) Gerencia (foco impacto, riesgos, plan)
    2) Equipo operativo (foco implementación, RACI, tiempos)
    3) Comité (foco evidencia, método, decisiones)
  - Botón “Aplicar” (visual: selecciona una versión y la muestra en el checklist del Overview)

C) Microcopy para claridad del Overview
- Agrega una frase breve arriba de las 3 cards A/B/C:
  “Este Overview reúne todo lo construido (Steps 1–3) para que armes una historia de impacto y un plan accionable.”

RESTRICCIONES:
- No cambies sidebar/header ni estilos existentes.
- No crees navegación paralela.
- Usa placeholders explícitos.
- Nombres:
  - S4_Overview (mantener)
  - Section_DeliverablesByStep
  - Overlay_S4_ViewSummary
  - Overlay_S4_Download_Demo
  - Overlay_S4_AI_Checklist