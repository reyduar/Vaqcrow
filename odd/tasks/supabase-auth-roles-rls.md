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
  - Revisión RDD: `gentle-ai review assess` → riesgo `high` (`hot_path`: auth), 4 archivos / 353 líneas; el owner eligió «Omitir esta vez» (`declined_this_candidate`). El handoff de diseño se agregó a `.gitignore` (`chore`, decisión del owner de dejarlo fuera) porque bloqueaba el inventario de archivos sin trackear.
- [x] **U2 — Autorización en la API.** `AuthPort` + adaptador Supabase, hook `onRequest` con denegación por defecto y tabla de políticas, `actor` desde el principal, puerto y adaptador de auditoría. Tests de matriz rol × endpoint primero (RED). Ruta: delegada.
  - Implementación (ruta delegada, escritor único). Archivos nuevos en `apps/api/src`: `application/ports/auth-port.ts` (`AuthPort`, `Principal`, códigos `unauthenticated`/`unavailable`), `application/ports/audit-log-port.ts`, `application/authorization/route-policy.ts` (+ test; tabla `METHOD + patrón` -> `public | authenticated | roles`, HEAD hereda GET), `infrastructure/adapters/supabase-auth.ts` (+ test; `auth.getUser(token)` con el cliente service-role y luego lectura de `profile`; 4xx salvo 429 -> `unauthenticated`, resto -> `unavailable`, log interno sin `message`/`details`/`hint` al llamador), `infrastructure/adapters/supabase-audit-log.ts` (+ test; insert en `audit_log`), `infrastructure/http/authorization-hook.ts` (hook `onRequest`, `decorateRequest("principal")`), `infrastructure/http/authorization.test.ts` (matriz rol x endpoint, cobertura, 503, default-deny, CORS en 401) y `infrastructure/http/test-support/auth.ts` (`fakeAuthPort`, `bearer`, `buildAppAs(role, deps)`). Modificados: `build-app.ts` (dependencia `auth`, hook tras el de correlación, `allowedHeaders`, observador `observeRoutes` para el test de cobertura), `human-decision.route.ts` (sin `actor` en el body; actor = `principal.displayName`), `index.ts` (cablea `SupabaseAuth` y `SupabaseAuditLog`; el audit log no se llama aún), `tsconfig.build.json` (excluye `test-support`), y los 12 tests de rutas/secuencias existentes (migrados a `buildAppAs`, sin tocar aserciones salvo las del `actor`).
  - `packages/contracts` sin cambios: `HumanDecisionCommand` conserva `actor` (semántica de texto de `human_decision.actor`); lo que cambia es de dónde lo toma la ruta. Sin cambios de base de datos.
  - Decisión de diseño: `buildApp` acepta `auth.policy` (sólo tests) para las rutas ad-hoc de `build-app.test.ts` (`/request-id`, `/failure`), que no tienen entrada en la tabla y por defecto reciben 403.
  - RED: `pnpm --filter @vaqcrow/api exec vitest run <authorization, build-app, supabase-auth, supabase-audit-log, route-policy>` -> `Test Files 4 failed | 1 passed (5)` (`Cannot find module './supabase-auth.js'`, `'./supabase-audit-log.js'`, `route-policy.js`, y la matriz sin hook). El test CORS de `allowedHeaders` ya pasaba (el plugin refleja las cabeceras pedidas por defecto): queda como guarda de regresión junto con `allowedHeaders` explícito.
  - GREEN: `pnpm --filter @vaqcrow/api test` -> 58 archivos, 1303 tests passed; `pnpm --filter @vaqcrow/contracts test` -> 526 passed; `pnpm run boundaries` -> sin violaciones (561 módulos); `pnpm --filter @vaqcrow/api lint` y `typecheck` limpios. `pnpm run verify`: api/domain/contracts/ai en verde; `@vaqcrow/web` test falló sólo por timeouts de 5 s en pruebas jsdom bajo carga (9 y luego 2 fallos en archivos distintos cada vez; los dos de la segunda corrida pasan aislados, 11/11), ninguno relacionado con `actor` (apps/web sin cambios).
  - Política final: coincide con la tabla inicial. Detalle: `POST /application-reviews/:id/assessments` y `GET .../assessment` (ruta real en singular) son `ADMIN`; `GET /sme-requests/:id` es `PYME` (sin lectura de `ADMIN` por ahora, según la tabla).
  - Ruptura conocida: `apps/web` y `apps/web/e2e/support/stub-api-server.mjs` todavía envían `actor` en `POST .../decisions` (ahora 400) y no mandan `Authorization`; la web se actualiza en #378 (entrega apilada D4). Los tests unitarios de web no llaman a la API real.
  - Revisión del orquestador (2026-10-01): el hook niega por defecto (ruta sin política → 403), `inactive` → 401, `unavailable` → 503; `index.ts` no pasa el override `auth.policy` (sólo tests). Spot check: `pnpm --filter @vaqcrow/api test` → 58 archivos, 1303 tests verdes. `pnpm --filter @vaqcrow/web test` → 5 fallas por `Test timed out in 5000ms` con load average ~27; la rama no toca `apps/web` ni `packages/` (`git diff --stat origin/main..HEAD -- apps/web packages` vacío). Se registran como **pendientes** (inestabilidad por carga), no como verdes: re-ejecutar con la máquina descargada antes de la PR.
- **Revisión RDD de U1 + U2 (2026-10-01):** riesgo `high` (32 archivos, 1.561 líneas); el owner eligió «Revisar este cambio». Cuatro lentes (riesgo, resiliencia, legibilidad, confiabilidad) sin hallazgos bloqueantes → `approved`; acuse `review-ce15d418f1074331` con autoridad `burned`. Hallazgos consultivos (no reabren la revisión), a resolver como trabajo posterior:
  - `WARNING` — el `actor` de la decisión es `displayName`, que no es único: registrar también `userId` (vía `audit_log` cuando #410 cablee la auditoría).
  - `WARNING` — `auth.getUser` sin timeout en `SupabaseAuth`: acotar la espera y devolver `unavailable`.
  - `WARNING` — la FK `audit_log.actor_user_id → profile` impide borrar un usuario con auditoría: se desactiva (`inactive`), no se borra; documentarlo en U5.
  - `WARNING` — `SupabaseAuditLog` traga el rechazo sin causa: registrar el código sanitizado.
  - Sugerencias menores: lista de roles duplicada en el adaptador, rama `429` sin test, causa descartada en el `catch` de auth, wiring de auditoría sin uso todavía, doc del token de test, aserciones pgTAP de `throws` poco específicas.
- [ ] **U3 — Configuración, seed y preflight.** Slice de config, script `seed:superadmin`, chequeo de preflight «existe un `ADMIN` activo», `generate-docker-env.sh` y los `.example`. Ruta: delegada.
- [ ] **U4 — Auth de Supabase y SMTP.** `supabase/config.toml` (`site_url`, confirmaciones, SMTP de Resend por variable) y la misma configuración en el proyecto remoto. Ruta: delegada; depende de que el owner tenga un dominio verificado en Resend.
- [ ] **U5 — Documentación.** `identity-and-rls-boundaries.md`, `environments.md`, `DEMO.md`, `CLAUDE.md`/`AGENTS.md`. Ruta: delegada.

## Verificación

_Pendiente._

## Próximo paso

U3 — configuración, script de seed del superadmin y preflight.
