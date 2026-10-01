# Bitácora: Supabase Auth, roles, RLS y autorización de la API

## Objetivo

Introducir autenticación real con Supabase Auth (email y contraseña), los roles `PYME`, `INVERSOR` y `ADMIN`, políticas RLS por rol, autorización con denegación por defecto en cada endpoint de `apps/api`, el superadmin sembrado y un registro de auditoría append-only. Task [#370](https://github.com/reyduar/Vaqcrow/issues/370) de la Feature [#369](https://github.com/reyduar/Vaqcrow/issues/369) (Epic [#368](https://github.com/reyduar/Vaqcrow/issues/368)).

## Ramas y entrega

- Rama de integración: `Vaqcrow#369_Feat_Establish_Supabase_Auth_roles_RLS_and_API_authorization`.
- Rama de trabajo: `Vaqcrow#370_Task_Implement_Supabase_Auth_roles_RLS_and_API_authorization`; su PR apunta a la rama de la Feature, no a `main`.
- **Entrega apilada:** #369 y [#378](https://github.com/reyduar/Vaqcrow/issues/378) (login y shell por rol) llegan juntas a `main`; #378 nace de la rama de #369. Mientras tanto la demo desplegada (recorrido de seis pasos) sigue funcionando.

## TDD

- Modo: **activado** (Strict TDD Mode de la configuración de sesión del owner).
- Runners: Vitest (`pnpm --filter @vaqcrow/api exec vitest run <archivo>`) y pgTAP (`pnpm run test:db`, contra el stack local del perfil docker).
- Cada unidad registra el RED observado antes del GREEN.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Confirmación de email activada para `PYME`/`INVERSOR`; Supabase Auth envía el enlace con Resend como SMTP propio | Sin confirmación, las notificaciones por Resend llegarían a direcciones que nadie verificó; el SMTP por defecto de Supabase tiene límites de envío muy bajos (owner, 2026-10-01) |
| D2 | Recuperación de contraseña diferida a un issue posterior | No bloquea la demo y el template no la diseña (owner, 2026-10-01) |
| D3 | Superadmin sembrado con un script manual por perfil (`seed:superadmin:docker` / `:cloud`) que lee `VAQCROW_SUPERADMIN_EMAIL` y `VAQCROW_SUPERADMIN_PASSWORD` de `.env.docker`/`.env.cloud`; idempotente; nombre «Admin Vaqcrow», usuario `vaqcrow.admin` | La contraseña no vive en Railway ni en el arranque de la API; el repo es público (owner, 2026-10-01) |
| D4 | #369 y #378 se apilan y llegan juntas a `main`; sin interruptor `API_AUTH_MODE` | La autorización por defecto rompería la web desplegada antes del login; un interruptor de seguridad mal configurado abre la API (owner, 2026-10-01) |
| D5 | El `actor` de la decisión humana deja de venir del body y pasa a ser el admin autenticado | Una decisión atribuida tiene que estar ligada a una identidad verificada, no a texto libre |
| D6 | `application_review` y `human_decision` siguen siendo sólo `service_role` | La API es la única escritora; `tests/rls-grants-containment.test.ts` (#196) sigue vigente |

## Política de autorización por endpoint (propuesta inicial)

| Endpoint | Política |
|---|---|
| `GET /health` | Pública |
| `POST /sme-requests`, `GET /sme-requests/:id` | `PYME` (propiedad por fila llega con #398) |
| `GET/POST /businesses/:id/sales-periods` | `PYME` (lectura también `ADMIN`) |
| `POST /assessments`, `POST/GET /application-reviews/:id/assessments`, `GET .../manual-review` | `ADMIN` |
| `POST/GET /application-reviews/:id/decisions` | `ADMIN`; `actor` = admin autenticado |
| `POST /campaigns` | `ADMIN` |
| `GET /campaigns/:id`, `GET /campaigns/:id/transactions/:hash` | Autenticado (cualquier rol activo) |
| `POST /campaigns/:id/invocations` y `/submission` | Autenticado (`INVERSOR` aporta/retira; el reembolso es permissionless) |
| `POST /revenue-share-distributions` y `/submission`, `GET .../:id` | `PYME` (lectura también `ADMIN`) |
| `/funding-intents/*` | Ruta legada, no cableada en `index.ts`: `ADMIN` |
| Cualquier ruta no listada | Denegada |

Un usuario `Inactivo` recibe `401` aunque su token sea válido.

## Unidades de trabajo

- [x] **U1 — Esquema de identidad.** Migración: `profile` (usuario, rol, nombre visible, usuario único, estado `active`/`inactive`), `audit_log` append-only, trigger de alta que sólo acepta `PYME`/`INVERSOR`, RLS y grants explícitos. pgTAP primero (RED). Probar local y aplicar al remoto en la misma unidad. Ruta: delegada (escritor único; preparación de escritura sobre 4+ archivos).
  - Migración: `supabase/migrations/20260930180000_create_identity_and_audit.sql` (`profile`, trigger `on_auth_user_created` -> `handle_new_user()` security definer con `search_path=''` y execute revocado, `audit_log` append-only con índices, RLS y grants explícitos, política `profile_select_own`). Test: `supabase/tests/identity_and_audit.sql` (32 aserciones).
  - RED: `pnpm run test:db` sin la migración -> `relation "public.profile" does not exist`, `Failed 37/37 subtests`, `Result: FAIL`.
  - GREEN: `pnpm exec supabase migration up --local` aplicó la migración; `pnpm run test:db` -> `Files=7, Tests=147, Result: PASS` (plan corregido de 37 a 32 al contar mal las aserciones; las 32 pasaron a la primera). `pnpm run test:boundaries` -> 143 passed; `pnpm exec vitest run tests/rls-grants-containment.test.ts` -> 8 passed (sin cambios necesarios).
  - Remoto (2026-10-01, MCP de Supabase): `apply_migration` con el cuerpo del archivo (SHA-256 `461e580f…`) y la versión del historial alineada a `20260930180000`. Verificado: `profile` y `audit_log` con RLS; grants `authenticated:SELECT` + `service_role:INSERT/SELECT/UPDATE` en `profile` y `service_role:INSERT/SELECT` en `audit_log`; política `profile_select_own` (SELECT, authenticated); trigger `on_auth_user_created` presente; `handle_new_user()` security definer sin execute para anon/authenticated; `application_review` y `human_decision` sin cambios. Advisor de seguridad: sólo el INFO `rls_enabled_no_policy` esperado para las tablas exclusivas de `service_role`.
  - Commit: `eaa8f69`. Revisión del orquestador: el rol `ADMIN` sólo entra por `app_metadata` (escribible solo por `service_role`).
- [ ] **U2 — Autorización en la API.** `AuthPort` + adaptador Supabase, hook `onRequest` con denegación por defecto y tabla de políticas, `actor` desde el principal, puerto y adaptador de auditoría. Tests de matriz rol × endpoint primero (RED). Ruta: delegada.
- [ ] **U3 — Configuración, seed y preflight.** Slice de config, script `seed:superadmin`, chequeo de preflight «existe un `ADMIN` activo», `generate-docker-env.sh` y los `.example`. Ruta: delegada.
- [ ] **U4 — Auth de Supabase y SMTP.** `supabase/config.toml` (`site_url`, confirmaciones, SMTP de Resend por variable) y la misma configuración en el proyecto remoto. Ruta: delegada; depende de que el owner tenga un dominio verificado en Resend.
- [ ] **U5 — Documentación.** `identity-and-rls-boundaries.md`, `environments.md`, `DEMO.md`, `CLAUDE.md`/`AGENTS.md`. Ruta: delegada.

## Verificación

_Pendiente._

## Próximo paso

U2 — autorización en la API con la matriz rol × endpoint en rojo.
