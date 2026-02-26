
## Dashboard Starteria

Este repositorio contiene el dashboard principal de Starteria (Steps 0-4) con Step 3 y Step 4 integrados dentro del flujo del proyecto.

## Correr el proyecto

1. `npm i`
2. `npm run dev`

## Como activar modo demo

1. Inicia sesion como rol `Administrador` (o usa `VER COMO (demo)` en sidebar y cambia a `Administrador`).
2. En el sidebar, en la seccion `VER COMO (demo)`, activa el toggle:
   `Demo: desbloquear pasos`
3. El estado del toggle se guarda en `localStorage`.

## Como ver Step 3 y Step 4 dentro del dashboard

1. Entra a un proyecto (`/projects/:projectId`).
2. En las cards de pasos:
   - Paso 3 y Paso 4 ahora se abren dentro del mismo contenedor (vista expandible).
   - Si el paso esta bloqueado, puedes usar `Ver vista previa (solo lectura)`.
3. En modo demo, Paso 3 y 4 se abren aunque esten bloqueados, con badge `Vista demo`.
   - En `Vista demo` no se permite `Enviar a revision IA`.
  
