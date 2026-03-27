Actúa como Product Designer en Figma. Estoy en Startería > Step 4C “Entregables finales” (frame seleccionado), con tabs “Deck / Plan (Go) / Talk track”. Necesito agregar el ENTREGABLE FINAL: subir el deck en PDF (exportado desde PPT) para que la IA lo analice, y adjuntar la demo del prototipo como evidencia final. Todo dentro del mismo dashboard y estilo actual.

OBJETIVO:
1) Permitir subir “Deck final (PDF)” como archivo.
2) Permitir adjuntar “Demo del prototipo” (link/video/capturas/registro).
3) Tener un bloque de “Revisión IA del deck (PDF)” que entregue diagnóstico y checklist de listo-para-presentar.
4) Hacer que esto alimente el cierre del Step 4 (checklist y estado “Listo para presentar”).

REGLAS:
- Mantén exactamente el look & feel actual (cards, chips, botones, spacing).
- No crees pantallas fuera del Step 4. Usa overlays/modal si hace falta.
- No inventes datos reales; usa placeholders.
- Copy claro y accionable. Incluye microcopy de privacidad: “Evita datos personales sensibles”.

CAMBIOS EN ESTE FRAME (Step 4C):

A) Agrega una sección nueva al inicio del contenido (antes del talk track) llamada:
“Entrega final (para comité)”
Con 2 cards lado a lado:

1) Card: “Deck final (PDF)”
- Estado chip: “No subido” / “Subido” / “Analizado por IA”
- Área drag & drop + botón “Subir PDF”
- Requisitos (microcopy): “PDF, máx. XX MB (demo), evita datos sensibles.”
- Botones:
  - “Analizar con IA” (deshabilitado hasta que haya PDF)
  - “Reemplazar PDF”
  - “Ver PDF” (abre preview en overlay)
- Si está “Subido”, muestra:
  - Nombre del archivo + fecha + versión (v1/v2)
  - Mini preview (thumbnail) de 1–2 páginas (placeholder)

2) Card: “Demo del prototipo / evidencia de uso”
- Estado chip: “No agregada” / “Agregada”
- Botón “Agregar demo”
- Al agregarse, permitir elegir formato (chips):
  - Link (Figma prototype / staging)
  - Video (Loom/Drive)
  - Capturas
  - Registro de uso
- Mostrar 1–2 items agregados (placeholder) con:
  - “Qué demuestra”
  - “Decisión que soporta”
  - “Incluir en deck” (checkbox)

B) Overlays / Modals
1) Overlay: “Subir PDF (demo)”
- Input/área drop
- Nota: “Sube el PDF exportado desde tu PPT.”
- Botones: Cancelar / Subir

2) Overlay: “Vista previa del PDF”
- Marco de preview (placeholder)
- Botón: Cerrar

3) Overlay: “Agregar demo”
- Campos: Tipo (link/video/captura/registro), URL/archivo (placeholder), “Qué demuestra”, “Decisión que soporta”
- Botones: Cancelar / Guardar

C) Revisión IA del deck (PDF)
Debajo de “Entrega final”, agrega una card grande:
“Revisión IA del deck (PDF)”
- Estado: “Pendiente de análisis” / “Analizado”
- Botón principal: “Analizar PDF con IA” (dispara overlay o muestra resultados en la misma card)
- Resultados (placeholder) con estructura tipo:
  1) Lo que está bien (3–5 checks)
  2) Riesgos / confusiones (2–4 bullets)
  3) Recomendaciones por audiencia (Sponsor/Gerencia/Comité) (tabs o chips)
  4) Checklist “Listo para presentar” (auto-check visual)
  5) “Cambios sugeridos (v2)” (lista de ediciones sugeridas: claridad, evidencia, pedido final, plan)

- Agrega botón secundario: “Generar lista de mejoras (para v2)” (solo visual)
- Agrega microcopy: “La IA evalúa claridad, evidencia, coherencia narrativa, pedido final y plan.”

D) Checklist de cierre (conectar con Step 4)
En el checklist existente del Step 4 (si está en Overview, asegúrate de reflejarlo también aquí o agregar un mini-checklist en Step 4C):
- Agrega 2 ítems nuevos:
  - “Deck final (PDF) subido y analizado por IA”
  - “Demo del prototipo adjunta (evidencia de uso)”
- Cuando ambos estén completos (visual), mostrar chip:
  “Listo para presentar ✅”

INTERACCIONES (PROTOTYPE):
- “Subir PDF” abre overlay de upload; al “Subir” cambia estado a “Subido”.
- “Analizar con IA” cambia estado a “Analizado” y muestra resultados.
- “Agregar demo” abre overlay; al guardar cambia estado a “Agregada” y lista el item.
- “Ver PDF” abre overlay de preview.

NOMBRES SUGERIDOS:
- Section_FinalDelivery
- Card_FinalPDF
- Card_PrototypeDemo
- Overlay_UploadPDF
- Overlay_PDFPreview
- Overlay_AddDemo
- Card_AIReviewPDF