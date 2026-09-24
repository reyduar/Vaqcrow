# Bitácora: CORS en la API

## Objetivo

Permitir que la web, servida desde otro origen, llame a la API desde el navegador. Task [#272](https://github.com/reyduar/Vaqcrow/issues/272), detectada al documentar los perfiles de entorno de [#271](https://github.com/reyduar/Vaqcrow/issues/271): un preflight `OPTIONS` con `Origin: http://localhost:3001` devolvía 404 sin cabeceras `Access-Control-*`.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | `CORS_ALLOWED_ORIGINS` opcional, lista de orígenes exactos separados por coma; se rechazan `*`, rutas y esquemas no http(s) | Una lista explícita evita abrir la API a cualquier origen por accidente |
| D2 | Sin la variable: `APP_ENV=local` permite `http://localhost:3001` y `http://127.0.0.1:3001`; el resto de entornos, ninguno | El perfil docker funciona sin configuración extra; la demo debe declarar el origen de Vercel explícitamente |
| D3 | El parseo vive en `application/config`; `@fastify/cors` se registra en `infrastructure/http/build-app.ts` | Respeta el límite: `application/` no importa Fastify |
| D4 | Se expone `x-correlation-id` al navegador | La web ya usa ese identificador para trazabilidad |

## Configuración

- TDD: estricto (configuración de sesión); runner `pnpm --filter @vaqcrow/api exec vitest run`.
- Rama: `Vaqcrow#272_Task_Enable_CORS_on_the_API_for_the_web_origins`, apilada sobre #271.

## Tareas

- [x] **U1 — Configuración tipada de CORS.** Parser con tests (RED → GREEN). Ruta: writer delegado.
- [x] **U2 — Registro HTTP.** `@fastify/cors` en `buildApp`, cableado en `index.ts`, tests con `inject()`. Ruta: writer delegado.
- [x] **U3 — Documentación.** `environments.md`, README (reemplazar la limitación), tabla de variables de `deploy-planning.md`. Ruta: writer delegado.
- [x] **V — Verificación end-to-end** contra el contenedor del perfil docker. Ruta: inline.

## Evidencia TDD

- **U1 RED:** `pnpm --filter @vaqcrow/api exec vitest run src/application/config/cors-config.test.ts` → `Cannot find module './cors-config.js'`. **GREEN:** 20/20. RED adicional a mitad de ciclo: `https://*.example.com` no se rechazaba (el parser WHATWG no prohíbe `*` en el host); se agregó un guard explícito y volvió a GREEN.
- **U2 RED:** 2 de 4 tests nuevos de `build-app.test.ts` fallaron (preflight 404 en lugar de 204; sin `access-control-allow-origin`). **GREEN:** 12/12 tras registrar `@fastify/cors`.
- Desvío: `parseCorsConfigResult(env, environment: string)` recibe el entorno como `string` para evitar el ciclo `cors-config → api-config → cors-config`, que `no-circular` prohíbe.

## Verificación

- `pnpm --filter @vaqcrow/api test` — 26 archivos, 524 tests verdes (re-ejecutado por el padre).
- `pnpm run boundaries` — 319 módulos, 860 dependencias, 0 violaciones (re-ejecutado por el padre).
- `pnpm run lint` y `pnpm run typecheck` — verdes (warning preexistente en `@vaqcrow/web`).
- `pnpm env:docker:up` (ejecutado por el usuario; reconstruye la imagen con `@fastify/cors`) — exit 0, contenedor `vaqcrow-local-stack-api-1` healthy.
- Preflight `OPTIONS /assessments` con `Origin: http://localhost:3001` — 204, `access-control-allow-origin: http://localhost:3001`, `allow-methods: GET, POST, OPTIONS`, `allow-headers: content-type`, `expose-headers: x-correlation-id`.
- `GET /health` con el mismo origen — 200 con `access-control-allow-origin`.
- `GET /health` con `Origin: http://evil.example` — 200 sin `access-control-allow-origin`: el navegador bloquea la lectura.
- `POST /application-reviews/<uuid inexistente>/decisions` con origen permitido — 404 `not_found`: CORS no altera las rutas con base de datos.
- Pendiente: agregar `CORS_ALLOWED_ORIGINS` a `.env.cloud.example` (lo edita el usuario; regla `deny` sobre `.env.*`).
