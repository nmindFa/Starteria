# Startería - Instrucciones del proyecto

## Qué es este producto
Startería es una plataforma guiada para diseñar iniciativas de intraemprendimiento desde un problema real hasta una propuesta probada y presentada con claridad.

No debe comportarse como un CRUD, ni como un formulario plano. Debe sentirse como un playbook secuencial con guía, claridad, criterios de validación y progreso visible.

## Cómo debe trabajar el agente
Antes de editar cualquier pantalla o componente:
1. Identifica qué step y módulo estás modificando.
2. Explica el objetivo funcional de ese módulo.
3. Explica qué no debe romperse del flujo actual.
4. Propón el ajuste UX/UI y UX Writing.
5. Luego implementa el cambio.

## Reglas de diseño
- Mantener la narrativa secuencial por steps.
- No crear pantallas nuevas si el ajuste puede resolverse en el flujo actual.
- Mostrar con claridad qué está bloqueado, qué falta y qué sigue.
- Mantener visible la información ancla cuando un módulo depende de información previa.
- Priorizar claridad, acompañamiento y progresión.

## Reglas de UX Writing
- Escribir en español latino claro.
- Evitar spanglish innecesario.
- Evitar copy genérico.
- Todo texto debe ayudar a entender, decidir o avanzar.
- Cuando haya feedback IA, mostrar:
  - qué está bien
  - qué falta
  - siguiente acción recomendada

## Reglas de IA
La IA puede sugerir, analizar, refinar y orientar, pero no debe inventar evidencia ni asumir validaciones no realizadas.

## Contexto funcional
La lógica detallada del producto está en:
- docs/starteria-step-logic.md
- docs/starteria-ux-writing.md
- docs/starteria-review-rules.md