# Bitácora: perfiles de entorno cloud y docker

## Objetivo

Separar la configuración en dos perfiles explícitos: `.env.cloud` (Supabase remoto, API en Railway, web en Vercel, contratos en Testnet; reservado para la demo) y `.env.docker` (Supabase local, API en contenedor y Stellar Quickstart en Docker Desktop; para pruebas locales). Task [#271](https://github.com/reyduar/Vaqcrow/issues/271).

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Nombres `.env.cloud` / `.env.docker`, no `.env.development` / `.env.local` | Next.js y Vite cargan `.env.development` y `.env.local` en capas (`.env.local` pisa a `.env.development` en `next dev`), no como perfiles alternativos |
| D2 | El perfil se elige explícitamente (`node --env-file`, `vitest --mode`) | La API no usa dotenv y Next sólo lee `apps/web/.env*`; nada seleccionaba el archivo raíz de forma deliberada |
| D3 | La suite de integración usa por defecto el perfil docker | Evita escrituras accidentales en la base de la demo |
| D4 | La API conserva `STELLAR_NETWORK=testnet` en el perfil docker | El parser sólo acepta `testnet` y la API no tiene consumidor Stellar en runtime desde #250 U4; conectar la API a Quickstart queda diferido a #237 |
| D5 | Los archivos `.env.*` los manipula el usuario con `!` | La regla global `deny` de `Read/Edit(.env.*)` se respeta; ningún comando imprime valores |

## Configuración

- TDD: estricto (configuración de sesión). No hay cambio de comportamiento TypeScript; las comprobaciones son funcionales.
- Rama: `Vaqcrow#271_Task_Split_the_cloud_and_docker_environment_profiles`, apilada sobre la rama de #256 (PR #270).
- Estrategia de entrega: `ask-on-risk`; previsión < 400 líneas.

## Tareas

- [x] **U1 — Plantillas y migración de secretos.** `.gitignore`, plantillas `.env.cloud.example` / `.env.docker.example` (creadas por el usuario), `scripts/env/generate-docker-env.sh`, `mv .env.local .env.cloud` (usuario). Ruta: writer delegado (2+ archivos no triviales) + pasos del usuario.
- [x] **U2 — Stack local en Docker.** `docker-compose.local.yml`, `scripts/local-env.sh up|down|status`, scripts `env:docker:*` y `dev:*` en `package.json`. Ruta: writer delegado.
- [x] **U3 — Integración por perfil.** `test:integration:docker|cloud`, comentarios de `vitest.integration.config.ts` y `bake-off-llm.mjs`. Ruta: writer delegado.
- [x] **U4 — Documentación.** `docs/architecture/environments.md`, enlaces desde `deploy-planning.md` y README, `AGENTS.md` / `CLAUDE.md`. Ruta: writer delegado.
- [x] **V — Verificación end-to-end** (ver abajo). Ruta: inline (padre).

## Ajustes durante la verificación

- **A1 — Stack parcial de Supabase.** `supabase start` consideraba el stack levantado con sólo el contenedor de la base activo (kong/rest detenidos). `scripts/local-env.sh up` ahora comprueba el gateway en `:54321` y, si no responde, reinicia el stack con `supabase stop` (conserva el volumen) y `supabase start`.
- **A2 — Claves locales.** `supabase/config.toml` tenía `[auth] enabled = false` desde #41; con auth deshabilitado, `supabase status -o env` no emite `SERVICE_ROLE_KEY` ni `PUBLISHABLE_KEY`. Se habilitó auth sólo para el stack local (no se usa `supabase config push`).
- **A3 — Exclusiones del CLI 2.117.** `inbucket` se llama `mailpit` en esta versión (`supabase start --help`).
- **A4 — Build lento.** El primer build de la imagen tardó más de dos horas por latencia extrema de npm dentro de la VM de Docker Desktop (pedidos de hasta 1.996 s); desde el host el registro respondía en ~2 s. Queda como mejora un cache mount del store de pnpm, sujeto a confirmar compatibilidad con Railway.

## Verificación

- `bash -n` y `shellcheck` sobre `scripts/local-env.sh` y `scripts/env/generate-docker-env.sh` — sin advertencias.
- `pnpm run lint` y `pnpm run typecheck` — verdes (warning preexistente en `apps/web/src/infrastructure/http/fetch-http-client.ts`).
- `pnpm env:docker:down && pnpm env:docker:up` (ejecutado por el usuario) — exit 0: Supabase local (kong, rest, auth, db) sano, Quickstart sano en `:8000`, `.env.docker` generado sin imprimir valores, contenedor `vaqcrow-local-stack-api-1` healthy.
- `pnpm run verify` — lint, typecheck, build, boundaries y tests de `api`/`domain`/`contracts` verdes; `@vaqcrow/web#test` con 4 y luego 2 fallos por timeout de 5 s (carga de la máquina ~24 con el stack Docker activo; el conjunto fallido varía entre corridas). Los archivos afectados, ejecutados aislados, pasan: 2 archivos, 13 tests. Este cambio no modifica `apps/web/src`.
- `curl localhost:3000/health` — `{"status":"ok"}` 200 desde el contenedor.
- `POST /application-reviews/<uuid inexistente>/decisions` — 404 `not_found`: la API consulta Supabase local a través de kong con la clave `service_role` generada.
- `pnpm run test:db` — 17 comprobaciones pgTAP verdes.
- `pnpm --filter @vaqcrow/api test:integration` (perfil docker) — 15 verdes, 10 fallidos. Los 10 fallos están en `tests/integration/funding-intent-persistence.integration.test.ts` con `PGRST205`: la suite sigue apuntando a `funding_intent`, renombrada a `funding_intent_legacy` por la migración de #250. Es preexistente y no depende del perfil; la suite de `application_review` pasa completa.
- `git status` — `.env.cloud` y `.env.docker` ignorados; sólo `.env.cloud.example` y `.env.docker.example` versionados.

## Próximo paso

Decidir el retiro o la actualización de la suite de integración de `funding_intent` (fuera del alcance de #271). Abrir el PR de #271 apilado sobre #270.
