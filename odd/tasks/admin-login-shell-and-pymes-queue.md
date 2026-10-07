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
- [x] **T1b — Filtro y conteo por estado server-side (seguimiento de T1).** `GET /sme-requests` gana `state` y `counts` globales por grupo de visualización; los KPIs y el badge dejan de derivarse de la página cargada.
- [x] **T2 — Login y shell de `/admin`.** Login real (sólo `ADMIN`), guard de ruta (D2), shell con header `Vaqcrow Admin` + `TESTNET · DEMO`, nav PyMEs/Usuarios, tema, campana, chip (D3) y cerrar sesión.
- [x] **T3 — Cola de PyMEs.** KPIs como filtros (`aria-pressed`), búsqueda, tabla con estados/acciones, paginación/orden y estados de carga/vacío/error (D1).
- [x] **T4 — Pruebas.** Componentes y guard: errores de login, filtros KPI, búsqueda, paginación/orden, denegación de rol, estados.
- [x] **T5 — Evidencia.** Documento `docs/planning/admin-login-shell-and-pymes-queue-evidence.md` (cierre de #386) y este registro.

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
- **Aplicación remota (2026-10-07).** El padre aplicó `20261007120000_create_admin_sme_request_queue_view.sql` al proyecto remoto vía el MCP de Supabase (version alineado al del repo) y verificó: vista `relkind=v`, `security_invoker=true`, `service_role` con SELECT y `anon`/`authenticated` sin acceso; historial remoto con la versión del repo. Los advisors de seguridad no reportan hallazgos nuevos.
- **Work-unit commit.** `d94e91b feat(api): add the admin PyMEs queue listing`.

### T2 — Login, guard y shell de `/admin` (frontend)

**Entregado (sin commit; el padre revisa y commitea):**

- `apps/web/src/app/admin/page.tsx` → `/admin`: renderiza `AdminLoginScreen`
  (cliente). Login real con Supabase Auth: sólo `ADMIN` entra; un `ADMIN` ya
  firmado que visita `/admin` va a `/admin/pymes`; una cuenta no-admin (o
  desactivada) se rechaza con el mensaje genérico `Correo o contraseña
  incorrectos.` y se descarta la sesión que hubiera abierto, sin revelar la
  consola (D2). No se embarca la nota «Demo: cualquier correo y contraseña te
  dejan entrar.» ni `sessionStorage['vaqcrow-admin']`.
- `apps/web/src/app/admin/(console)/layout.tsx` → guard + shell para
  `/admin/pymes` (y futuras rutas de consola). `AdminConsoleGate` decide con
  `adminConsoleDecision` (puro): `loading` espera, `signed-out` y no-admin
  redirigen a `/admin` sin montar la consola. El layout de consola no cubre
  `/admin` (está fuera del route group `(console)`).
- `AdminShell`: aside con marca `Vaqcrow Admin` + `TESTNET · DEMO`, nav
  `PyMEs`/`Usuarios`, `ThemeSwitcher` y «Cerrar sesión»; barra superior con
  badge `TESTNET`, `NotificationBell` y chip de usuario (nombre + línea de rol
  «Administrador», D3). Reutiliza `ThemeSwitcher`/`NotificationBell`/`Badge`/
  `BrandIsotipo` de `apps/web/src/presentation`.
- **Nav `Usuarios` (decisión):** es la vista de #390 y no existe todavía. Se
  renderiza como el ítem diseñado pero como `button` inerte y `disabled`, de
  modo que la consola no publica un enlace muerto y no se inventa una pantalla
  de usuarios. Evidencia en `admin-console.test.tsx` («renders Usuarios as an
  inert nav item instead of a dead link»).
- **Tema:** se reutiliza el `ThemeSwitcher` de tres opciones (claro/oscuro/
  sistema) ya establecido en la app, no el toggle de dos estados del template,
  porque el alcance autorizado pide reutilizar ese componente; desvío
  registrado.
- **Rol del chip (D3):** «Administrador»; no se inventa un cargo que no se
  recolecta («Operadora · compliance» del template no se replica).

### T3 — Cola de PyMEs (frontend)

- `apps/web/src/application/ports/admin-queue-port.ts`: puerto vendor-free y
  React-free (`AdminQueueQuery`/`AdminQueueItem`/`AdminQueuePage`/`AdminQueuePort`),
  `ApplicationReviewState` importado **type-only** de `@vaqcrow/contracts`.
- `apps/web/src/application/admin/queue.ts`: selectores puros — agrupación de
  los 6 estados del API en los 4 del template (`pending`/`changes`/`approved`/
  `rejected`), copys verbatim del template, filtros KPI, acción por estado,
  filtro/conteo de filas, `dd/mm/aaaa` con degradado honesto a «Sin dato»,
  toggle de orden y total de páginas.
- `apps/web/src/infrastructure/admin/http-admin-queue-gateway.ts`: adapter HTTP
  sobre `GET /sme-requests` con Bearer; valida el sobre `{items,page,pageSize,total}`
  y rechaza item malformado o estado desconocido como `unavailable`; `network`
  en fallo de transporte; todo non-200 → `unavailable` (nunca filtra el mensaje
  del proveedor). `create-admin-queue-port.ts` + `unavailable-admin-queue-port.ts`
  (null object cuando no hay `NEXT_PUBLIC_API_BASE_URL`).
- `apps/web/src/state/use-admin-queue.ts`: SWR por query resuelta (`page`/`pageSize`/
  `sort`/`order`/`q`), `reload` para el reintento, `page: null` (nunca página
  vacía) ante fallo.
- `apps/web/src/presentation/components/admin/pymes-queue.tsx`: título/subtítulo,
  KPIs como filtros (`aria-pressed`, borde de acento al activo, segundo clic
  limpia), búsqueda server-side por nombre/id/rubro (submit del form), tabla
  (PyME nombre+id, Rubro, Estado, Último cambio, Acciones) con orden server-side
  por encabezado (`aria-sort`), estados `Pendiente de revisión`/`Requiere
  cambios`/`Aprobada`/`Rechazada` con ícono+texto, acción `Revisar solicitud`
  (primaria) para pendientes y `Ver detalle` (secundaria) para el resto,
  `Sin dato` cuando falta el negocio, paginación (`Anterior`/`Página X de Y`/
  `Siguiente`), y estados de carga/vacío/error con «Reintentar».

**Limitación registrada (dato, no diseño, resuelta por T1b):** el contrato de T1
no ofrecía filtro por estado ni conteo por estado, así que los KPIs (número y
filtro) y el badge «Pendientes» del nav operaban sobre la página cargada. T1b
lo corrige con `state` y `counts` server-side (ver Progreso › T1b); no se
expandió el backend en silencio en T3.

### T1b — Filtro y conteo por estado server-side (seguimiento de T1)

**Entregado (sin commit; el padre revisa y commitea):**

- **API `GET /sme-requests` (ADMIN).** `state` opcional que acepta un grupo de
  visualización (`pending`/`changes`/`approved`/`rejected`) y lo resuelve
  server-side a los estados crudos de `application_review`
  (`awaiting_assessment`/`human_review` → `pending`; `changes_requested`;
  `approved`; `rejected`). Un `state` desconocido es `400 { code:
  "invalid_request" }` sin tocar el repositorio. La respuesta conserva
  `{ items, page, pageSize, total }` y agrega `counts` (un número por grupo,
  global, nunca acotado a la página).
- **Conteos sin migración.** PostgREST no tiene `group by`, así que el adapter
  hace **cuatro consultas count-only `HEAD`** (una por grupo, con
  `.in("state", estados crudos del grupo)`) en paralelo con la consulta de
  página; no se agregó ningún objeto SQL nuevo. Un conteo faltante o fallido es
  `unavailable` (nunca un 200 con KPIs inventados).
- **Web.** El puerto y el gateway (`AdminQueuePage.counts`, `AdminQueueQuery.state`,
  param `state`) siguen vendor-free; el gateway exige los cuatro conteos enteros
  no negativos y rechaza la página si faltan. `queue.ts` conserva los selectores
  puros y suma `queueQueryToggleFilter` (aplica/limpia el filtro server-side y
  vuelve a la página 1). `PymesQueue` muestra `page.counts`, marca
  `aria-pressed` según `query.state` y la tabla refleja el set filtrado; el badge
  «Pendientes» de `AdminShell` usa `page.counts.pending`. Se retiraron
  `filterQueueItems`/`countQueueStates` (quedaban muertos al pasar el filtro y el
  conteo al servidor).

**Decisión de mapeo registrada:** `pending` cubre sólo los dos estados que el
camino real produce en la cola (`awaiting_assessment` recién enviado y
`human_review`); `draft` no aparece porque `submit_sme_request` inserta
`awaiting_assessment`. Si un `draft` llegara a existir, el conteo y el filtro
`pending` no lo incluirían; se deja anotado como borde no alcanzable hoy.

**Verificación (RED→GREEN→REFACTOR):**

- RED: focused API (`list-admin-sme-requests.test.ts`,
  `supabase-sme-request-repository.test.ts`, `sme-request.route.test.ts`) →
  3 archivos / 6 tests fallando (`counts` ausente, `state` rechazado con 400,
  `ADMIN_QUEUE_RAW_STATES_BY_DISPLAY` inexistente). Focused web
  (`queue.test.ts`, `http-admin-queue-gateway.test.ts`,
  `admin-console.test.tsx`) → 3 archivos / 10 tests fallando
  (`queueQueryToggleFilter` no es función, `counts` no parseado, badge/KPIs
  derivados de la página).
- GREEN: focused API → 3 archivos / 53 tests passed; focused web → 3 archivos /
  46 tests passed; `pnpm --filter @vaqcrow/api test` → 76 archivos / 1788 tests
  passed; `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → 162
  archivos / 1550 tests passed; `pnpm --filter @vaqcrow/api typecheck` y
  `pnpm --filter @vaqcrow/web typecheck` → limpios; `pnpm run boundaries` → 797
  módulos sin violaciones; `pnpm run lint` → 0 errores (1 warning preexistente
  en `fetch-http-client.ts`, ajeno).
- REFACTOR: la validación de `state` usa `ADMIN_QUEUE_DISPLAY_STATES` en lugar
  de derivar las claves; focused y suites completas siguen en verde.

**Acciones de fila:** `onOpen` es un prop opcional; #410 es la vista de
revisión. En esta rebanada el botón se renderiza como lo diseña el template y no
navega.

**Verificación (RED→GREEN→REFACTOR):**

- RED: `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4
  src/application/admin/queue.test.ts src/application/admin/admin-guard.test.ts
  src/infrastructure/admin/http-admin-queue-gateway.test.ts
  src/app/admin/admin-console.test.tsx` → 4 archivos fallando (módulos/casos de
  uso inexistentes).
- GREEN: mismos 4 archivos → 51 tests passed; `pnpm --filter @vaqcrow/web exec
  vitest run --maxWorkers=4` → 162 archivos / 1546 tests passed;
  `pnpm --filter @vaqcrow/web typecheck` → limpio; `pnpm run boundaries` → sin
  violaciones (797 módulos); `pnpm run lint` → 0 errores (1 warning preexistente
  en `fetch-http-client.ts`, ajeno a esta unidad).
- REFACTOR: corrección del test del adapter para inyectar el cliente falso por
  constructor (como los gateways hermanos); los 4 archivos siguen en verde.

### T5 — Evidencia (2026-10-07)

**Entregado (sin commit; el padre revisa y commitea):**

- `docs/planning/admin-login-shell-and-pymes-queue-evidence.md`: documento de
  cierre en español, con la estructura de los hermanos (contexto, cómo leer,
  qué quedó implementado, qué quedó probado, límites, preguntas abiertas,
  criterios verbatim, estado de entrega). Mapea los 7 criterios de aceptación
  de #386, cita la fuente de cada resultado (comando re-ejecutado o entrada
  fechada de esta bitácora) y registra D1–D3 y los desvíos documentados.
- Este registro T5.

**Verificación de cierre (re-ejecutada en este árbol, 2026-10-07):**

- `pnpm run verify` → **exit 0**. Todos los gates pasan: lint, typecheck,
  lint:tests, typecheck:tests, test, build, boundaries y test:boundaries, con
  `contracts` 526, `domain` 120, `ai` 107, `api` 1788 y `web` 1550 tests;
  `test:boundaries` 162.
- En una corrida **anterior** del mismo gate, `@vaqcrow/web#test` falló con
  `Test Files 10 failed | 152 passed (162)` / `Tests 19 failed | 1531 passed
  (1550)` (18 `Test timed out in 5000ms` bajo la corrida paralela del
  `turbo run test` y 1 aserción de `registration-step.test.tsx` sensible al
  orden), en archivos **ajenos a #386**. Esos 10 archivos pasan en aislamiento
  (`10 passed` / `158 passed`) y la suite web completa pasa con `--maxWorkers=4`
  (162 / 1550). La re-ejecución del gate completo encadenado da **exit 0**.
- No se re-ejecutó Testnet, ni escrituras remotas de Supabase, ni
  `test:integration`. El resultado remoto de la migración (2026-10-07, MCP) se
  cita de esta bitácora, no se re-corrió.

**Diagnóstico honesto:** la primera corrida de `pnpm run verify` fue un
artefacto ambiental (flakiness de la corrida paralela), no una regresión de
#386; la re-ejecución del gate cierra en verde. Queda registrado como brecha
§5.1 del documento de evidencia.

## Próximo paso

#386 queda con su cierre documental entregado y el gate de cierre en verde. No
hay versión remota pendiente (la migración de la vista no cambió). Nada está en
`main`; #386 desbloquea las vistas de #410 (revisión) y #390 (usuarios).
