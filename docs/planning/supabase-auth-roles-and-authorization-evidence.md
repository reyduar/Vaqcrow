# Evidencia de cierre de la Feature #369 — Issue #372

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#370](https://github.com/reyduar/Vaqcrow/issues/370) (implementación) y [#371](https://github.com/reyduar/Vaqcrow/issues/371) (pruebas) de la Feature [#369](https://github.com/reyduar/Vaqcrow/issues/369) ("Feature: Establish Supabase Auth, roles, RLS and API authorization", Epic [#368](https://github.com/reyduar/Vaqcrow/issues/368)), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/supabase-auth-roles-rls|Bitácora: Supabase Auth, roles, RLS y autorización de la API]].

> [!warning] Estado de entrega: nada de #369 está en `main`
> Las PRs [#443](https://github.com/reyduar/Vaqcrow/pull/443) (#370) y [#444](https://github.com/reyduar/Vaqcrow/pull/444) (#371) están mergeadas en la **rama de la Feature** `Vaqcrow#369_Feat_Establish_Supabase_Auth_roles_RLS_and_API_authorization`, no en `main`. Por decisión del owner (D4, 2026-10-01), #369 y [#378](https://github.com/reyduar/Vaqcrow/issues/378) (login y shell por rol) llegan **juntas** a `main`: la autorización con denegación por defecto rompería la web desplegada antes de que exista el login. Verificado el 2026-10-02 con `git merge-base --is-ancestor`: ni `a094e91` (merge de #443) ni `84fe98d` (merge de #444) son ancestros de `origin/main` (`aaee084`). La demo desplegada sigue usando la sesión de demostración.

## 1. Contexto y objetivo

El issue [#372](https://github.com/reyduar/Vaqcrow/issues/372) ("Task: Document evidence for Supabase Auth, roles, RLS and API authorization") es la tercera Task de la Feature #369. La Feature reemplaza la sesión de demostración por autenticación real con Supabase Auth (email y contraseña), los roles `PYME`, `INVERSOR` y `ADMIN`, RLS por rol, autorización con denegación por defecto en cada endpoint de `apps/api`, el superadmin sembrado y un registro de auditoría append-only. Supersede el límite de Auth.js v5 planificado en [#134](https://github.com/reyduar/Vaqcrow/issues/134).

| Task | Rama | PR | Merge (en la rama de la Feature) | Estado del issue (2026-10-02) |
|---|---|---|---|---|
| #370 — implementar | `Vaqcrow#370_Task_Implement_Supabase_Auth_roles_RLS_and_API_authorization` | [#443](https://github.com/reyduar/Vaqcrow/pull/443) | `a094e91`, 2026-10-02 01:26 UTC | **abierto**, Project `Backlog` (ver §9) |
| #371 — probar | `Vaqcrow#371_Task_Test_Supabase_Auth_roles_RLS_and_API_authorization` | [#444](https://github.com/reyduar/Vaqcrow/pull/444) | `84fe98d`, 2026-10-02 11:08 UTC | cerrado 2026-10-02, Project `Done` |
| #372 — documentar | `Vaqcrow#372_Task_Document_evidence_for_Supabase_Auth_roles_RLS_and_API_authorization` | — | — | este documento |

## 2. Cómo leer esta evidencia

- **Tres fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-02 en este árbol de trabajo (rama de #372 sobre `84fe98d`, Node `v24.21.0`), con su línea de salida real (§4.1). (b) **CI** — un run de GitHub Actions consultado con `gh pr checks` (§4.2). (c) **Bitácora** — una entrada fechada de la bitácora de iteración; se cita, **no** se re-ejecutó aquí (en particular, nada contra el proyecto Supabase remoto).
- **Sin secretos.** Ningún email, contraseña, clave, token, JWT ni identificador de proyecto aparece en este documento. Las variables se nombran, nunca sus valores.
- **Tests de PR sin servicios vivos.** La suite de `apps/api` usa dobles (`fakeAuthPort`, clientes falsos); sólo `pnpm run test:db` toca una base, y es el stack local del perfil docker.

## 3. Qué quedó implementado (Task #370)

Fuente: bitácora (U1–U5, 2026-10-01/02) y lectura del código en `84fe98d`.

- **Esquema de identidad** — `supabase/migrations/20260930180000_create_identity_and_audit.sql`: `profile` (usuario, rol `PYME`/`INVERSOR`/`ADMIN`, nombre visible, usuario único, estado `active`/`inactive`); trigger `on_auth_user_created` → `handle_new_user()` (`security definer`, `search_path = ''`, EXECUTE revocado a `anon`/`authenticated`) que **sólo acepta `PYME` o `INVERSOR`** desde `user_metadata`; `audit_log` append-only con índices; RLS habilitada y grants explícitos en la misma migración; política única `profile_select_own` (`SELECT`, `authenticated`, su propia fila).
- **Promoción a `ADMIN`** — `supabase/migrations/20261001120000_promote_admin_on_app_metadata.sql`: trigger `after update of raw_app_meta_data on auth.users` que crea o actualiza el `profile` como `ADMIN` cuando `app_metadata.role` pasa a `ADMIN`. Sólo `service_role` escribe `app_metadata`, así que no hay camino público (ver §7, corrección 1).
- **Autorización en la API** — `AuthPort` en `apps/api/src/application/ports/auth-port.ts`; adaptador `SupabaseAuth` en `infrastructure/adapters/supabase-auth.ts` (`auth.getUser` + lectura de `profile`, acotados a 5 s; 4xx salvo 429 → `unauthenticated`, resto → `unavailable`; sin `message`/`details`/`hint` hacia el llamador); tabla de políticas `application/authorization/route-policy.ts` (`public | authenticated | roles`); hook `onRequest` en `infrastructure/http/authorization-hook.ts` con denegación por defecto (ruta sin política → `403`), principal `inactive` → `401`, proveedor caído o que lanza → `503`, siempre con cuerpo `{ code }`.
- **`actor` de la decisión humana** — la ruta `POST /application-reviews/:id/decisions` toma el `actor` del principal autenticado (`displayName`), no del body (D5).
- **Registro de auditoría** — `application/ports/audit-log-port.ts` + `infrastructure/adapters/supabase-audit-log.ts` (insert en `audit_log`, registra sólo el `code` sanitizado). `index.ts` lo instancia pero **ninguna ruta lo llama todavía** (`void auditLog; // not consumed by any route yet`, `apps/api/src/index.ts:117`).
- **Manejador de errores sanitizado** — `build-app.ts` registra un `setErrorHandler`: toda excepción no atrapada en un handler responde `500 { code: "internal" }`; los 4xx propios de Fastify (`FST_*`) conservan su cuerpo de texto fijo (T6 de #371).
- **Seed del superadmin** — `apps/api/src/infrastructure/seed/seed-superadmin.ts` + `seed-superadmin-cli.ts`, scripts `seed:superadmin:docker|cloud`; lee `VAQCROW_SUPERADMIN_EMAIL` y `VAQCROW_SUPERADMIN_PASSWORD` del perfil; idempotente; rechaza un usuario existente que no sea `ADMIN` activo sin modificarlo; con borrado compensatorio si la verificación posterior a `createUser` falla (T3 de #371). `index.ts` no lo importa.
- **Preflight y entornos** — `scripts/demo/preflight/preflight.mjs`: `profile` y `audit_log` en las tablas verificadas, chequeo `admin-profile` (existe un `ADMIN` activo), `VAQCROW_SUPERADMIN_PASSWORD` sólo en la lista de redacción. `supabase/config.toml`: confirmación de email activada y Mailpit como SMTP local. Runbook del remoto en `docs/architecture/environments.md` §13.
- **Documentación** — `docs/architecture/identity-and-rls-boundaries.md` §9, `docs/planning/DEMO.md`, `docs/design/demo-ui.md` §2, `README.md`, `CLAUDE.md`/`AGENTS.md` (U5).

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-02)

Rama de #372 sobre `84fe98d`, Node `v24.21.0`, stack local del perfil docker levantado.

```sh
$ pnpm --filter @vaqcrow/api test
 Test Files  59 passed (59)
      Tests  1371 passed (1371)

$ pnpm --filter @vaqcrow/contracts test
 Test Files  15 passed (15)
      Tests  526 passed (526)

$ pnpm run test:db
/…/supabase/tests/admin_promotion.sql ...................... ok
/…/supabase/tests/admin_rls_scope.sql ...................... ok
/…/supabase/tests/identity_and_audit.sql ................... ok
(+ 6 archivos previos, todos ok)
All tests successful.
Files=9, Tests=167
Result: PASS

$ pnpm run boundaries
✔ no dependency violations found (564 modules, 1863 dependencies cruised)

$ pnpm run test:boundaries
 Test Files  10 passed (10)
      Tests  150 passed (150)

$ pnpm --filter @vaqcrow/api lint        # eslint .
exit 0

$ pnpm --filter @vaqcrow/api typecheck   # tsc -p tsconfig.json --noEmit
exit 0
```

**No re-ejecutado:** `pnpm --filter @vaqcrow/web test` (la Feature no toca `apps/web`; la bitácora registra timeouts de jsdom bajo carga en esa suite, sin relación con esta rama) ni `pnpm run build`. Su resultado de PR se toma del CI (§4.2).

### 4.2 CI de las PRs (consultado con `gh pr checks`, 2026-10-02)

| PR | Run | Job | Resultado |
|---|---|---|---|
| #443 | `36949922220` | Quality gates (lint, types, tests, build, boundaries) — `pnpm run verify` | pass |
| #443 | `36949922220` | Playwright (deterministic, local double) | pass |
| #443 | `36949922220` | Contracts (build, test, deploy on a local network) | pass |
| #444 | `36998899577` | Quality gates (lint, types, tests, build, boundaries) — `pnpm run verify` | pass |
| #444 | `36998899577` | Playwright (deterministic, local double) | pass |
| #444 | `36998899577` | Contracts (build, test, deploy on a local network) | pass |

Playwright pasa porque corre contra el doble local de la API (`apps/web/e2e/support/stub-api-server.mjs`), no contra la API con autorización; la web todavía no envía `Authorization` y sigue mandando `actor` (ruptura conocida, se resuelve en #378; ver §5).

### 4.3 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Matriz rol × endpoint (anónimo, `PYME`, `INVERSOR`, `ADMIN`, inactivo) con cobertura de todas las rutas registradas; el rol permitido **alcanza la ruta** con el principal adjunto (sonda `preValidation`) | `apps/api/src/infrastructure/http/authorization.test.ts` (160 tests) | Re-ejecutado (dentro de las 1371); RED por mutante en bitácora T1 |
| Denegaciones con cuerpo exactamente `{ code }` en 401/403/503 para las 21 rutas no públicas; puerto que lanza → `503` y registro sólo del nombre del error | `authorization.test.ts` (`sanitized denials`, `logs a thrown`) | Re-ejecutado; RED en bitácora T4/T5 |
| Excepción no atrapada en un handler → `500 { code: "internal" }`, sin el mensaje | `apps/api/src/infrastructure/http/build-app.test.ts` | Re-ejecutado; RED en bitácora T6 |
| `SupabaseAuth`: timeout, `429`, causa sanitizada | `supabase-auth.test.ts` | Re-ejecutado |
| Seed: idempotencia, rechazo de usuario no `ADMIN`, paginación y corte de `listUsers`, rollback compensatorio, ningún email/contraseña en la salida | `apps/api/src/infrastructure/seed/seed-superadmin.test.ts` (35 tests) | Re-ejecutado; RED en bitácora T3 |
| Signup con `ADMIN` en `user_metadata` falla y no deja usuario; sin grants por defecto a `anon`/`authenticated`; `audit_log` sin `UPDATE`/`DELETE` ni para `service_role` | `supabase/tests/identity_and_audit.sql` | Re-ejecutado (`test:db` PASS) |
| La promoción a `ADMIN` sólo ocurre por `app_metadata` | `supabase/tests/admin_promotion.sql` | Re-ejecutado |
| Un JWT `ADMIN` directo a la base sólo ve su propio `profile` y recibe `42501` en `audit_log`, `application_review` y `human_decision` | `supabase/tests/admin_rls_scope.sql` (11 tests) | Re-ejecutado; RED por mutante en bitácora T2 |

### 4.4 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **E2E contra el GoTrue local** (2026-10-02, usuarios descartables ya borrados): el CLI compilado del seed → «Super admin created» y, en la segunda corrida, «already present»; `POST /auth/v1/signup` con rol `PYME` → perfil `PYME` y Mailpit recibió «Confirm your email address»; signup con `data.role = "ADMIN"` → HTTP 500 `Database error saving new user`, sin usuario ni perfil.
- **Proyecto remoto** (MCP de Supabase): migración `20260930180000` aplicada y verificada el 2026-10-01 (RLS, grants, política `profile_select_own`, trigger, `handle_new_user()` sin EXECUTE para `anon`/`authenticated`); migración `20261001120000` aplicada y verificada el 2026-10-02 (los dos triggers, historial `20260930180000, 20261001120000`, advisor de seguridad sólo con el INFO esperado `rls_enabled_no_policy`).
- **Auth remoto** (2026-10-02): `GET /auth/v1/settings` → `disable_signup: false`, `mailer_autoconfirm: false`, `external.email: true`. El SMTP de Resend lo configuró el owner; esa consulta no lo observa.
- **Seed en ambos perfiles** (owner, 2026-10-02): `seed:superadmin:docker` y `seed:superadmin:cloud` → «Super admin created (username vaqcrow.admin)»; el orquestador verificó en el remoto un `profile` `ADMIN` / `active` / `vaqcrow.admin` / «Admin Vaqcrow» con email confirmado.

## 5. Límites y brechas vigentes

1. **Sin login en la web.** No existe pantalla de ingreso hasta [#378](https://github.com/reyduar/Vaqcrow/issues/378). El alta se ejercitó sólo a nivel API contra el GoTrue local; **el ingreso y el egreso (sign-in / sign-out) nunca se ejercitaron** de punta a punta.
2. **Entrega real de email por Resend no observada.** El SMTP está configurado en el remoto, pero ningún alta real pasó por él todavía; se confirma en el primer alta de #378.
3. **R1-002 — propiedad por fila.** Las rutas `PYME` verifican el rol pero no que la fila sea de quien llama: una PyME podría leer la solicitud de otra por id, leer o escribir ventas de cualquier negocio y leer cualquier distribución. La propiedad llega con [#398](https://github.com/reyduar/Vaqcrow/issues/398). **Condición de entrega:** R1-002 se resuelve o el owner lo acepta explícitamente antes del merge a `main` de #369 + #378. Detalle en `docs/architecture/identity-and-rls-boundaries.md` §9.7.
4. **Auditoría sin llamadores.** El almacén y el puerto existen y están probados; ninguna acción de admin se registra todavía. Se cablea con [#410](https://github.com/reyduar/Vaqcrow/issues/410) / [#390](https://github.com/reyduar/Vaqcrow/issues/390). Hasta entonces el `actor` de una decisión es sólo el `displayName`, que no es único (consultivo de la revisión de U1+U2).
5. **Invitaciones de admin no implementadas.** Hoy el único camino a `ADMIN` es el seed (o cualquier escritura de `service_role` sobre `app_metadata`). La invitación de operadores pertenece a [#390](https://github.com/reyduar/Vaqcrow/issues/390).
6. **Usuario inactivo: rechazo en la API, no en Supabase Auth.** El estado `inactive` vive en `profile`; GoTrue todavía emitiría un token a ese usuario, pero toda ruta no pública de la API lo rechaza con `401`. No hay hoy una ruta para desactivar usuarios (llega con #390).
7. **La web desplegada todavía no habla con la API autorizada.** `apps/web` y su doble E2E envían `actor` y no envían `Authorization`; contra la API de la rama de la Feature obtendrían `400`/`401`. Es la razón de la entrega apilada (D4).
8. **RLS de las tablas del motor sin cambios.** `application_review` y `human_decision` siguen siendo sólo `service_role` (D6); el acceso de admin a lo que la consola necesita pasa por la API, no por políticas RLS de admin (probado en `admin_rls_scope.sql`).

## 6. Preguntas abiertas resueltas por el owner

| Pregunta (issue #369, «Not designed in the template (open question)») | Resolución | Fuente |
|---|---|---|
| "Whether email confirmation and password reset are required for PYME/INVERSOR accounts is an open question for the owner." | **Confirmación de email: sí** (D1), con Resend como SMTP propio en el remoto y Mailpit en local. **Recuperación de contraseña: diferida** a un issue posterior (D2); no se implementó. | Bitácora D1/D2 (owner, 2026-10-01); `supabase/config.toml`; `GET /auth/v1/settings` remoto (2026-10-02, bitácora) |
| "The template has no sign-in screen, session-expiry behavior…" | La pantalla de ingreso y el comportamiento de sesión son alcance de [#378](https://github.com/reyduar/Vaqcrow/issues/378); esta Feature no inventó UI. | Bitácora §Ramas y entrega; D4 |
| "The super-admin seed has no UI in the template; its operational runbook (where the env vars live per profile) is not designed." | Script manual por perfil (`seed:superadmin:docker|cloud`) que lee las variables de `.env.docker` / `.env.cloud`; nunca en Railway ni al arrancar la API; idempotente (D3). Runbook en `docs/architecture/environments.md` §13. | Bitácora D3 (owner, 2026-10-01) |

Decisiones adicionales del owner registradas durante la Feature: D4 (entrega apilada #369 + #378, sin interruptor `API_AUTH_MODE`), D5 (`actor` = admin autenticado), D6 (`application_review` y `human_decision` siguen sólo `service_role`).

## 7. Correcciones aplicadas durante el ciclo

1. **El seed no podía crear un `ADMIN` (U1/U3, 2026-10-02).** `createUser` de GoTrue inserta en `auth.users` sin el `app_metadata` y lo actualiza después; el trigger de alta estricto rechazaba el alta. El pgTAP original no lo detectó porque insertaba el `app_metadata` directamente, una secuencia que GoTrue nunca hace. Corregido con la migración nueva `20261001120000` (sin editar la ya aplicada) y un pgTAP que reproduce la secuencia real.
2. **Fixtures pgTAP acoplados al seed (T2).** Tras sembrar el superadmin en docker, `admin_promotion.sql` e `identity_and_audit.sql` chocaban con el `username` único; los fixtures pasaron a usernames propios.
3. **Puerto de Auth que lanza (T4).** Si el adaptador lanzaba en lugar de devolver `unavailable`, Fastify respondía `500` con el mensaje crudo. Corregido con `try/catch` → `503 { code: "unavailable" }` y registro sólo del nombre del error (T5).
4. **Errores de handler sin sanitizar (T6).** `buildApp` no tenía `setErrorHandler`; ahora toda excepción no atrapada responde `500 { code: "internal" }`.
5. **Seed sin rollback (T3).** Un fallo posterior a `createUser` dejaba un usuario de Auth huérfano; ahora se borra y el mensaje lo dice. Agotar la búsqueda paginada ya no se informa como «no existe».
6. **Matriz que no probaba el handler (T1).** Los casos permitidos sólo afirmaban «no 401/403»; ahora prueban que se alcanzó la ruta (un mutante que bloqueaba todo rol permitido pasaba con la aserción vieja).

Revisiones RDD (bitácora): U1+U2 `approved` dos veces; U3+U4 `approved`; corrección de la promoción `approved`; T1–T4 `approved`; T5–T6 `approved` (2026-10-02, linaje `review-3ff864778304158b`). Ninguna con hallazgos bloqueantes; los consultivos quedaron registrados en la bitácora.

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #369) | Resultado | Fuente |
|---|---|---|---|
| 1 | "A user can create an account as `INVERSOR` or `PYME`, sign in and sign out with real Supabase Auth credentials." | ⚠️ **PARCIAL** — el alta funciona contra Supabase Auth real (GoTrue local): signup `PYME` → perfil `PYME` y email de confirmación en Mailpit; el trigger crea perfiles `PYME` e `INVERSOR`. **Sign-in y sign-out no se ejercitaron**: no hay login hasta #378. La entrega real por Resend no se observó. | Bitácora E2E local (2026-10-02); `test:db` re-ejecutado |
| 2 | "No request can obtain the `ADMIN` role except through the seed or an admin invitation." | ⚠️ **PARCIAL** — ningún camino público obtiene `ADMIN`: signup con `ADMIN` falla sin dejar usuario (pgTAP y E2E local con HTTP 500); la promoción exige `app_metadata`, escribible sólo por `service_role`. El seed funciona. **La invitación de admin no existe** (#390): hoy el seed es el único camino. | `test:db` re-ejecutado; bitácora E2E (2026-10-02) |
| 3 | "The super admin ("Admin Vaqcrow" / `vaqcrow.admin`) is created idempotently from environment variables; no credential appears in the repository, logs or issues." | ✅ **CUMPLIDO** — 35 tests del seed (idempotencia, salida sin email ni contraseña); segunda corrida local «already present»; sembrado por el owner en docker y cloud, perfil remoto verificado. Variables sólo en `.env.docker`/`.env.cloud` (no versionados); la contraseña está en la lista de redacción del preflight. | API test re-ejecutado; bitácora (2026-10-02) |
| 4 | "RLS policies enforce per-role access and are covered by `pnpm run test:db`; the migration is applied and verified on the remote project." | ✅ **CUMPLIDO** — `profile_select_own` (cada usuario ve sólo su perfil), un JWT `ADMIN` sólo ve el suyo, sin grants por defecto, `audit_log` append-only; `test:db` `Files=9, Tests=167, Result: PASS`. Ambas migraciones aplicadas y verificadas en el remoto. La propiedad por fila de las rutas de la API es R1-002 (§5.3), no RLS. | `test:db` re-ejecutado; remoto según bitácora (2026-10-01 y 2026-10-02) |
| 5 | "Every `apps/api` endpoint has an enforced authorization policy and denies by default; deactivated users are rejected." | ✅ **CUMPLIDO en la API, con condición de entrega** — test de cobertura de rutas, matriz rol × endpoint, ruta sin política → `403`, principal inactivo → `401`. Abierto: R1-002 (rol sin propiedad por fila), condición antes de `main`; el rechazo del inactivo ocurre en la API, no en Supabase Auth (§5.6). | API test re-ejecutado; CI #444 |
| 6 | "An append-only audit log store and port exist." | ✅ **CUMPLIDO** — `audit_log` sin `UPDATE`/`DELETE` ni para `service_role`; puerto y adaptador probados. Todavía sin llamadores (§5.4). | `test:db` y API test re-ejecutados |
| 7 | "The Auth.js v5 direction (#134) and the "no real auth" statement are superseded in the docs." | ✅ **CUMPLIDO, con dos residuos** — `DEMO.md`, `README.md`, `identity-and-rls-boundaries.md`, `demo-ui.md` §2, `demo-tasks-list.md` y `CLAUDE.md`/`AGENTS.md` lo declaran superseded. Residuos: `docs/design/claude-design-brief.md:269` («sin autenticación real; Auth.js de producción está fuera de alcance») y la fila D-12 de `docs/design/demo-ui.md` («Supabase Auth aún no implementado»). | Lectura del árbol con `rg "Auth\.js"` (2026-10-02) |
| 8 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO** — fallos cubiertos: proveedor caído o lento → `503`, puerto que lanza → `503`, handler que lanza → `500 { code: "internal" }`, denegaciones con `{ code }` exacto, rollback del seed; este documento es la evidencia. | API test re-ejecutado; §4.3 |
| 9 | "Every item under "Not designed in the template (open question)" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO** — confirmación de email (D1) y seed por perfil (D3) decididos antes de implementarse; recuperación de contraseña diferida (D2) y no implementada; sin UI inventada. | Bitácora D1–D3 (2026-10-01); §6 |
| 10 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO** — sin valores de variables en el repositorio, bitácora ni este documento; las respuestas y registros sólo llevan códigos y nombres de error. La demo sigue declarada como no productiva. | Revisión de este documento; tests de saneamiento re-ejecutados |

## 9. Riesgos, contradicciones y limitaciones aceptadas

- **Estado de los issues desalineado.** #370 sigue **abierto** y en `Backlog` en el Project aunque su PR #443 está mergeada en la rama de la Feature; #371 se cerró manualmente. Esta Task no lo modifica: cerrarlo es decisión del owner.
- **El remoto no se re-verificó aquí.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-01/02); esta Task no lo tocó.
- **Suite de web no re-ejecutada localmente.** Se apoya en el CI de #443 y #444.
- **Residuos de documentación** del criterio 7: quedan fuera de la superficie de esta Task y se registran como seguimiento.

## 10. Estado de entrega y próximos pasos

- Este cambio es sólo documentación: este archivo, la bitácora y las entradas de #370–#372 en `demo-tasks-list.md`. Commit en la rama de #372; la PR contra la rama de la Feature es un paso posterior.
- La Feature #369 **no está en `main`** y no se cierra al mergear esta Task en su rama: llega a `main` junto con #378.

> [!todo] Condiciones antes del merge a `main` de #369 + #378
> 1. [#378](https://github.com/reyduar/Vaqcrow/issues/378), desde la rama de #369: login, egreso y shell por rol, y la web enviando `Authorization` sin `actor`.
> 2. R1-002: resolverlo con [#398](https://github.com/reyduar/Vaqcrow/issues/398) o aceptación explícita del owner.
> 3. Observar la entrega real del email de confirmación por Resend en el primer alta de #378, y ejercitar sign-in/sign-out para completar el criterio 1.
