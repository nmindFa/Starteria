# Starteria - Prototipo Step 3 y Step 4

Mini-app en Next.js App Router con TypeScript y Tailwind para visualizar:
- `/step-3`: Probar en pequeño
- `/step-4`: Contar una historia (Demo Day ready)

## Requisito de entorno

- Node LTS 20 (`>=20 <24`)
- Si usas NVM:

```bash
nvm use 20.19.0
```

## Correr en local

```bash
npm install
npm run dev
```

Abrir:
- `http://localhost:3000/step-3`
- `http://localhost:3000/step-4`

## Notas
- Sin backend ni base de datos.
- Estado persistido en `localStorage` con la clave `starteria-prototype-project`.
- Datos iniciales mock en `lib/mockData.ts`.
- En Node 24 puede aparecer un error interno de build de Next en algunos entornos.
