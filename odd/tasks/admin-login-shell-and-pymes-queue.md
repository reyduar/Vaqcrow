# Bitácora — Feature #386: login de admin, shell de la consola y cola de PyMEs

Rama de integración: `Vaqcrow#386_Feat_Provide_the_admin_login_shell_and_PyMEs_queue`.
Base: punta de `Vaqcrow#382_Feat_Deliver_in_app_notifications_and_Resend_email` (`997ab08`), que ya contiene #369/#378 (auth + shell por rol), #398 (onboarding PyME) y #382 (campana). No arrastra el backend de #410.

## Objetivo

Entregar la entrada de la consola de operación en `/admin`: login real con Supabase Auth (sólo `ADMIN`), el shell de la consola y la cola de PyMEs con KPIs como filtros, búsqueda, tabla, estados y acciones, siguiendo `Vaqcrow Admin.dc.html`.

## Problema y por qué

#410 (revisión/aprobación) y #390 (usuarios/roles) cuelgan de esta consola y hoy no existe: `/admin` no está en la app y el backend no expone un listado de solicitudes para operadores. Sin la entrada de la consola, la revisión admin no tiene dónde vivir.

## Decisiones del owner (2026-10-07)

| # | Pregunta abierta del issue | Resolución |
|---|---|---|
| D1 | Estados de carga/vacío/error y paginación/orden | **Agregar paginación y orden** además de estados honestos de carga/vacío/error. |
| D2 | Qué ve un no-admin al abrir `/admin` y expiración de sesión | **Redirigir sin revelar**: no-admin o cuenta desactivada vuelven al login de `/admin` con mensaje genérico; la sesión expirada vuelve al login de `/admin`. |
| D3 | Línea de rol del chip de usuario | **Nombre + rol** («Administrador»); no se inventa un cargo que no se recolecta. |

## Hallazgo de alcance

El issue dice que la cola lee «el engine existente `GET /sme-requests`», pero ese listado **no existe**: `apps/api` sólo tiene `POST /sme-requests` y `GET /sme-requests/:applicationId` (ambos `PYME`). La cola necesita un endpoint de listado nuevo, `ADMIN`, con nombre, rubro, estado y último cambio por solicitud.

## Alcance autorizado

- Endpoint backend de listado de solicitudes para `ADMIN` (nuevo), reutilizando los repositorios existentes.
- `/admin`: login real (Supabase Auth, sólo `ADMIN`), shell de consola y guard de ruta.
- `/admin/pymes`: cola con KPIs como filtros, búsqueda, tabla, estados, acciones, paginación/orden y estados de carga/vacío/error.
- Reutilizar `AuthScreen`/`ThemeSwitcher`/`NotificationBell` y los componentes de `apps/web/src/presentation`.
- Tests deterministas y evidencia en español en la misma unidad.

## Restricciones

- El template es la fuente visual y de comportamiento; lo que no diseña se resuelve con las decisiones D1–D3 y no se inventa más.
- Nada de `sessionStorage['vaqcrow-admin']` ni de la nota «cualquier correo y contraseña te dejan entrar».
- Ninguna página pública enlaza a `/admin`; un no-admin es denegado sin revelar la consola.
- Sin secretos, PII ni claims de producción.

## Tareas

- [x] **T1 — Endpoint de listado admin.** `GET` de solicitudes para `ADMIN` con nombre, rubro, estado y último cambio, paginación, orden y búsqueda server-side (requirió una vista SQL read-only, ver Progreso); tests y ruta registrada.
- [ ] **T2 — Login y shell de `/admin`.** Login real (sólo `ADMIN`), guard de ruta (D2), shell con header `Vaqcrow Admin` + `TESTNET · DEMO`, nav PyMEs/Usuarios, tema, campana, chip (D3) y cerrar sesión.
- [ ] **T3 — Cola de PyMEs.** KPIs como filtros (`aria-pressed`), búsqueda, tabla con estados/acciones, paginación/orden y estados de carga/vacío/error (D1).
- [ ] **T4 — Pruebas.** Componentes y guard: errores de login, filtros KPI, búsqueda, paginación/orden, denegación de rol, estados.
- [ ] **T5 — Evidencia.** Documento en `docs/planning/` y cierre.

## Checks aplicables

- `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm --filter @vaqcrow/api test`
- `pnpm run verify`

## Progreso

### T1 — Endpoint de listado admin (backend)

**Hallazgo de diseño (2026-10-07).** El join de la cola (nombre/rubro del `businesses`
del dueño + estado/último cambio de `application_review`, por `application_id`) no se
puede hacer server-side con PostgREST sobre el esquema actual: `sme_request` y
`businesses` no tienen FK directa (ambos cuelgan de `profile`),
`businesses.owner_user_id` no es único, y PostgREST sólo permite ordenar un
top-level por un embed *to-one*. Verificado contra PostgREST 16.2 local:
`order=application_review(updated_at)` funciona; `order=businesses(name)` →
`PGRST108`; `order=profile(businesses(name))` → `PGRST100`. El owner aprobó la
**opción A**: una vista SQL read-only (migración) que resuelve el join y permite
paginación/orden/búsqueda server-side con el valor honesto «Sin dato» cuando falta
el negocio. `supabase/migrations/` pasó a ser superficie de edición autorizada para
el único archivo nuevo.

**Entregado (sin commit; el padre revisa y commitea):**

- Migración `supabase/migrations/20261007120000_create_admin_sme_request_queue_view.sql`:
  vista `public.admin_sme_request_queue` (`security_invoker = true`) que hace
  `LEFT JOIN lateral` de `sme_request` + `application_review` + `businesses` (por
  `owner_user_id`, con `order by created_at desc, id limit 1` para no multiplicar
  filas). Grants: `revoke all` a `anon, authenticated, service_role` y `grant select`
  sólo a `service_role`. Incluye comentario de reversión.
- Puerto `SmeRequestRepositoryPort.listAdminQueue(query)` + tipos `AdminQueueQuery`
  /`AdminQueueItem`/`AdminQueuePage` y `MISSING_BUSINESS_LABEL = "Sin dato"`.
- Caso de uso `application/use-cases/list-admin-sme-requests.ts`: valida y acota
  `page` (≥1, tope 100 000), `pageSize` (1..100), `sort`
  (`applicationId|name|sector|state|updatedAt`), `order` (`asc|desc`) y `q`
  (sanitiza metacaracteres del filtro de PostgREST); consulta inválida →
  `invalid_request` (400) sin tocar el repositorio.
- Adapter `SupabaseSmeRequestRepository.listAdminQueue`: lee la vista con
  `select("*", { count: "exact" })`, `.order(...)`, `.or(...)` (búsqueda sobre
  nombre/id/rubro) y `.range(...)`, todo server-side; `count` ausente = `unavailable`;
  fila malformada = `unavailable`; negocio faltante → `"Sin dato"`.
- Ruta `GET /sme-requests` en `sme-request.route.ts` (ADMIN), política
  `"GET /sme-requests": only("ADMIN")` y fila en la matriz de `authorization.test.ts`.
- Respuesta `{ items: [{ applicationId, name, sector, state, updatedAt }], page, pageSize, total }`;
  query malformada 400 `{ code: "invalid_request" }`; fallo de proveedor 503
  `{ code: "unavailable" }` (nunca 200 vacío).

**Verificación (RED→GREEN→REFACTOR):**

- RED: `pnpm --filter @vaqcrow/api exec vitest run <3 archivos nuevos/ajustados>` →
  3 archivos / 8 tests fallando (`listAdminQueue is not a function`, módulo del caso
  de uso inexistente, ruta `404`).
- GREEN: focused (caso de uso + adapter + ruta + autorización + `build-app` +
  `sme-request.test.ts`) → 327 passed; `pnpm --filter @vaqcrow/api test` → 76 archivos /
  1781 tests passed; `pnpm --filter @vaqcrow/api typecheck` → limpio;
  `pnpm --filter @vaqcrow/api lint` → limpio; `pnpm run boundaries` → sin violaciones.
- REFACTOR: extracción de `queueSearchFilter` en el adapter; focused sigue en verde.
- Migración aplicada **sólo local** (no remoto) con el SQL exacto vía
  `docker exec -i supabase_db_vaqcrow psql ... -f <migración>`, porque
  `supabase migration up --local` rechaza por versiones de migración de otra rama
  ajenas al repo (no se hizo `repair`/`pull`). Verificado: `security_invoker=true`,
  sólo `service_role` con SELECT, y las queries del adapter (orden por
  name/sector/state/updated_at, `or(...ilike...)`, count exacto) responden 200.
  Prueba transaccional con `rollback`: una solicitud con negocio devuelve
  nombre/rubro y una sin negocio devuelve NULL.
- **Pendiente del padre:** aplicar la migración al proyecto remoto con autorización
  explícita (la política del repo pide local+remoto en la misma unidad; la tarea
  reservó el remoto al padre).

## Próximo paso

T2 (login real y shell de `/admin`) y T3 (cola de PyMEs en `apps/web`, consumiendo
`GET /sme-requests`).
