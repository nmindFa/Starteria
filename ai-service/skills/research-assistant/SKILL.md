---
name: research-assistant-planning
description: Metodologia de investigacion cualitativa centrada en el usuario para el Paso 1 Modulo B de Starteria. Usa esta habilidad al generar planes de investigacion.
---

# Research Assistant - Planificacion de Investigacion

## Descripcion

El Research Assistant convierte el analisis AS-IS del participante en un plan de investigacion cualitativa concreto y accionable para el Modulo B del Paso 1.

## Input: Datos del Modulo A (AS-IS)

El plan de investigacion se construye a partir de:
- `casoReal`: historia especifica del problema
- `pasos`: secuencia del proceso afectado
- `quiebre`: punto de falla identificado
- `consecuencia`: impacto medido o estimado
- `causaInmediata`: causa proxima del quiebre
- `alcance`: delimitacion del problema

## Output: Plan de Investigacion

### Objetivo de investigacion
- Una oracion que describe QUE se quiere aprender y PARA QUE
- No es una lista de tareas, es una declaracion de intencion de aprendizaje
- Ejemplo: "Entender por que los coordinadores de turno abandonan el proceso de registro a mitad del flujo y que necesitarian para completarlo sin errores."

### Temas de investigacion (minimo 3)
Cada tema tiene:
- `tema`: nombre corto del area de investigacion
- `justificacion`: por que es critico investigar esto para resolver el problema

Temas sugeridos a derivar del AS-IS:
- Comportamiento actual de los usuarios en el proceso AS-IS
- Necesidades no atendidas en el punto de quiebre
- Contexto organizacional que rodea el problema
- Alternativas que los usuarios ya han intentado
- Consecuencias secundarias del problema

### Perfiles de entrevistados (minimo 2)
Cada perfil tiene:
- `perfil`: descripcion del tipo de persona a entrevistar
- `razon`: por que este perfil tiene informacion clave

Tipos de perfil a considerar:
- Usuarios que viven el problema directamente (los mas afectados por el quiebre)
- Usuarios que observan el problema desde afuera (con perspectiva diferente)
- Supervisores o responsables del proceso (con perspectiva sistemica)
- Usuarios que han "resuelto" el problema de manera informal

### Guia de preguntas (minimo 5)
- Preguntas abiertas (que, como, cuando, por que, cuantame)
- Organizadas del contexto general al especifico
- Evitar preguntas de si/no
- Evitar preguntas que sugieran la respuesta

Estructura sugerida:
1. Contexto general (cuantame sobre tu rol/proceso)
2. Descripcion del problema desde la perspectiva del usuario
3. Momento especifico del quiebre (que pasa exactamente cuando...)
4. Impacto en el usuario (como te afecta, que haces despues)
5. Intentos de solucion (has tratado de resolverlo, como)
6. Necesidades latentes (que necesitarias para que esto funcionara bien)

## Formato de respuesta

```json
{
  "objetivo": "oracion de objetivo de investigacion",
  "temas": [
    {"tema": "nombre del tema", "justificacion": "por que investigar esto"}
  ],
  "perfiles": [
    {"perfil": "descripcion del perfil", "razon": "por que tiene informacion clave"}
  ],
  "guiaPreguntas": ["pregunta 1", "pregunta 2", "pregunta 3", "pregunta 4", "pregunta 5"]
}
```

## Criterios de calidad

- El objetivo deriva directamente del quiebre y la consecuencia del AS-IS
- Los temas cubren el comportamiento del usuario, no solo el proceso
- Los perfiles incluyen a los mas afectados y al menos una perspectiva externa
- Las preguntas son exploratorias, no confirmatorias
- Todo el plan esta en espanol latino, claro y ejecutable por el participante
