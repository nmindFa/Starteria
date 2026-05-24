---
name: feedback-ia-rubrics
description: Rubricas de evaluacion formativa para los pasos 1-4 y modulos A-D de la metodologia Starteria. Usa esta habilidad al evaluar el trabajo de un participante.
---

# Feedback IA - Rubricas de Evaluacion Formativa

## Descripcion

Esta habilidad provee las rubricas de evaluacion para cada paso y modulo de la metodologia Starteria. El veredicto siempre es uno de: **Aprobado**, **Iterar** o **Bloqueado**.

## Criterios de veredicto

- **Aprobado**: El trabajo cumple todos los criterios criticos del modulo. El participante puede avanzar.
- **Iterar**: El trabajo tiene valor pero le faltan elementos importantes. El participante debe corregir antes de avanzar.
- **Bloqueado**: El trabajo tiene problemas fundamentales que impiden avanzar. Requiere rehacer elementos centrales.

## Paso 1 - Investigacion

### Modulo A (AS-IS)
Criterios criticos:
- `caso_real`: historia concreta y especifica (no generica ni hipotetica)
- `pasos`: secuencia clara del proceso actual con al menos 3 pasos identificados
- `quiebre`: punto de falla especifico y observable
- `consecuencia`: impacto medible o cuantificable
- `causa_inmediata`: causa proxima identificada (no la raiz, sino la inmediata)
- `alcance`: delimitacion clara de quien y cuanto se ve afectado

Senales de Bloqueado: el caso es hipotetico, no hay quiebre identificado, la consecuencia es vaga.
Senales de Iterar: algunos campos incompletos, consecuencia poco cuantificada, causa confundida con sintoma.

### Modulo B (Research Plan)
Criterios criticos:
- `objetivo`: oracion clara que describe que se quiere aprender
- `temas`: minimo 3 temas con justificacion de relevancia
- `perfiles`: minimo 2 perfiles de entrevistados con razon de seleccion
- `guia_preguntas`: minimo 5 preguntas abiertas (no de si/no)

Senales de Bloqueado: objetivo ausente, preguntas cerradas, perfiles irrelevantes.
Senales de Iterar: menos temas o perfiles del minimo, preguntas poco abiertas.

### Modulo C (Insights)
Criterios criticos:
- Los insights deben surgir de datos de investigacion real, no de suposiciones
- Cada insight conecta un patron observado con una necesidad del usuario
- Al menos 3 insights diferenciados

Senales de Bloqueado: insights son opiniones sin respaldo en datos.
Senales de Iterar: insights mezclados con suposiciones, poca diferenciacion.

### Modulo D (Sintesis)
Criterios criticos:
- Integracion coherente de los insights del Modulo C
- Perspectiva centrada en el usuario (no en la organizacion)
- Reformulacion del problema como oportunidad de diseno

Senales de Bloqueado: sintesis contradice los insights, no hay reformulacion.
Senales de Iterar: sintesis parcial, perspectiva organizacional predomina.

## Paso 2 - Diseno de Solucion

### Modulo A (HMW)
- Preguntas Como Podriamos derivadas de la sintesis del Paso 1
- Amplitud adecuada: ni muy abiertas ni muy restrictivas
- Al menos 3 preguntas HMW distintas

### Modulo B (Ideacion)
- Minimo 5 ideas agrupadas en al menos 2 clusters
- Diversidad de enfoques (no variaciones de la misma idea)
- Titulos y descripciones claros

### Modulo C (DVF)
- Evaluacion de Deseabilidad, Viabilidad y Factibilidad con justificacion
- Criterios aplicados consistentemente a todas las ideas evaluadas
- Seleccion fundamentada de la idea finalista

### Modulo D (Test Card)
- Hipotesis especifica y falsificable
- Experimento concreto y ejecutable
- Metrica de exito con umbral de decision claro (Go/No-Go)

## Paso 3 - Experimentacion

### Modulo A (Prototipo)
- Fidelidad apropiada para la hipotesis a validar (no over-engineering)
- Componentes minimos necesarios documentados
- Plan de construccion realista

### Modulo B (Ejecucion)
- Metricas reales medidas (no estimadas)
- Evidencia concreta recopilada
- Fidelidad al protocolo del test card

### Modulo C (Analisis)
- Comparacion directa con la hipotesis original
- Recomendacion Go/No-Go/Pivot con justificacion
- Learning card con aprendizajes y proximos pasos

## Paso 4 - Narrativa

### Modulo A (Presentacion)
- Exactamente 12 slides con arco narrativo coherente
- Elevator pitch de maximo 100 palabras
- Contenido adaptado a la audiencia objetivo
- Notas para el presentador accionables en cada slide

## Formato de respuesta

Siempre responde en JSON con esta estructura exacta:
```json
{
  "status": "Aprobado | Iterar | Bloqueado",
  "summary": "resumen de maximo 500 caracteres",
  "goodPoints": ["aspecto positivo 1", "aspecto positivo 2"],
  "missing": ["elemento faltante 1", "elemento faltante 2"],
  "actions": ["accion concreta 1", "accion concreta 2"],
  "questions": ["pregunta orientadora 1", "pregunta orientadora 2"],
  "contradictions": ["contradiccion detectada 1"]
}
```

Los arrays pueden estar vacios pero nunca null. El summary no debe exceder 500 caracteres.
