# Evidencia de cierre de la Feature #386 — Issue #389

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#387](https://github.com/reyduar/Vaqcrow/issues/387) (implementación), [#388](https://github.com/reyduar/Vaqcrow/issues/388) (pruebas) y [#389](https://github.com/reyduar/Vaqcrow/issues/389) (evidencia) de la Feature [#386](https://github.com/reyduar/Vaqcrow/issues/386) ("Feature: Provide the admin login, shell and PyMEs queue", Epic [#375](https://github.com/reyduar/Vaqcrow/issues/375) "Consola de administración"), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación del issue, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/admin-login-shell-and-pymes-queue|Bitácora: login de admin, shell de la consola y cola de PyMEs]].

> [!warning] Estado de entrega: nada de #386 está en `main`
> El trabajo vive en la rama de integración `Vaqcrow#386_Feat_Provide_the_admin_login_shell_and_PyMEs_queue`, creada desde la punta de [#382](https://github.com/reyduar/Vaqcrow/issues/382) (`997ab08`), que ya contiene #369/#378 (auth + shell por rol), #398 (onboarding PyME) y #382 (campana). **No hay PR ni merge en esta Feature**, y este documento no reporta un estado mergeado. La demo desplegada desde `main` todavía no muestra la consola `/admin`. La migración de la vista `20261007120000` sí fue aplicada y verificada en el **proyecto remoto** (bitácora, 2026-10-07). #386 desbloquea [#390](https://github.com/reyduar/Vaqcrow/issues/390) y [#410](https://github.com/reyduar/Vaqcrow/issues/410).

> [!info] 2026-10-10 — Mergeado en `main` vía [#466](https://github.com/reyduar/Vaqcrow/pull/466) (merge `2b7e0d5`).

## 1. Contexto y objetivo

La Feature #386 entrega la **entrada de la consola de operación** en `/admin`: login real con Supabase Auth (sólo rol `ADMIN`), el **shell** de la consola (marca, navegación PyMEs/Usuarios, tema, campana de notificaciones, chip de usuario y cerrar sesión) y la **cola de PyMEs** (KPIs como filtros, búsqueda, tabla con estados y acciones, paginación/orden y estados honestos de carga/vacío/error). Todo sale de la única pantalla del template que diseña la consola, `docs/design/template/design_handoff_vaqcrow/screens/Vaqcrow Admin.dc.html` (vistas `login` y `pymes`).

#410 (revisión/aprobación) y #390 (usuarios/roles) cuelgan de esta consola y hasta ahora no existía: `/admin` no estaba en la app y el backend no exponía un listado de solicitudes para operadores. Sin la entrada de la consola, la revisión admin no tiene dónde vivir.

| Task | Rama | Estado |
|---|---|---|
| #387 — implementar | `Vaqcrow#386_Feat_Provide_the_admin_login_shell_and_PyMEs_queue` | implementada; commits `d94e91b` (T1), `e6b36c0` (docs de migración), `a6cea2b` (T2–T4), `2fb4da5` (T1b) |
| #388 — probar | (misma rama de la Feature) | cubierta por las suites deterministas (§4.2) |
| #389 — documentar | (misma rama de la Feature) | este documento |

**Hallazgo de alcance.** El issue dice que la cola lee «el engine existente `GET /sme-requests`», pero ese listado **no existía**: `apps/api` sólo tenía `POST /sme-requests` y `GET /sme-requests/:applicationId` (ambos `PYME`). La cola necesitó un endpoint de listado nuevo, `ADMIN`, con nombre, rubro, estado y último cambio por solicitud (bitácora §Hallazgo de alcance).

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-07 en este árbol de trabajo (rama de #386), con su línea de salida real y su código de salida (§4.1). (b) **Bitácora** — una entrada fechada de [[odd/tasks/admin-login-shell-and-pymes-queue]] o un resultado de verificación ya registrado; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba de esta Feature habla con Supabase remoto, con Testnet, con Resend ni con el proveedor LLM. La cola web se ejercita con un puerto falso (§4.2); el adaptador HTTP valida el sobre con un cliente inyectable. `pnpm run test` es unit-only (sin `test:integration`).
- **Sin secretos ni PII.** Ningún email, contraseña, API key, token ni identificador de proyecto aparece en este documento; las variables y rutas se nombran, nunca sus valores.
- **Sin claims de producción.** La consola opera sobre datos sintéticos de la demo; KYC/KYB, ventas y conversión ARS→activo siguen simulados y Stellar sigue en Testnet. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado (Tasks #387 y #388)

Fuente: lectura del código en esta rama y bitácora (T1, T1b, T2, T3, T4; 2026-10-07).

- **Migración / modelo de lectura (T1)** — `supabase/migrations/20261007120000_create_admin_sme_request_queue_view.sql`: vista `public.admin_sme_request_queue` (`security_invoker = true`) que hace `LEFT JOIN lateral` de `sme_request` + `application_review` + `businesses` (por `owner_user_id`, con `order by created_at desc, id limit 1` para no multiplicar filas). Grants: `revoke all` a `anon, authenticated, service_role` y `grant select` sólo a `service_role`; incluye comentario de reversión. Se eligió una vista SQL porque el join no se puede resolver server-side con PostgREST sobre el esquema actual: `sme_request` y `businesses` no tienen FK directa (ambos cuelgan de `profile`), y PostgREST sólo permite ordenar un top-level por un embed *to-one* (verificado contra PostgREST 16.2 local: `order=businesses(name)` → `PGRST108`). La opción A (vista read-only) fue aprobada por el owner.
- **API — puerto y tipos (T1)** — `SmeRequestRepositoryPort.listAdminQueue(query)` + `AdminQueueQuery`/`AdminQueueItem`/`AdminQueuePage` y `MISSING_BUSINESS_LABEL = "Sin dato"` en `apps/api/src/application/ports/sme-request-repository-port.ts`.
- **API — caso de uso (T1/T1b)** — `application/use-cases/list-admin-sme-requests.ts`: valida y acota `page` (≥1, tope 100 000), `pageSize` (1..100), `sort` (`applicationId|name|sector|state|updatedAt`), `order` (`asc|desc`), un `state` de grupo de visualización (`pending|changes|approved|rejected`) y `q` (sanitiza los metacaracteres del filtro de PostgREST). Consulta inválida, incluido un `state` desconocido → `invalid_request` (400) **sin tocar el repositorio**.
- **API — adaptador (T1/T1b)** — `SupabaseSmeRequestRepository.listAdminQueue`: lee la vista con `select("*", { count: "exact" })`, `.order(...)`, `.or(...)` (búsqueda sobre nombre/id/rubro) y `.range(...)`, todo server-side; `count` ausente o fila malformada = `unavailable`; negocio faltante → `"Sin dato"`. Los **conteos globales por grupo** se obtienen con cuatro consultas count-only `HEAD` en paralelo (PostgREST no tiene `group by`); un conteo faltante o fallido es `unavailable` (nunca un 200 con KPIs inventados).
- **API — ruta (T1)** — `GET /sme-requests` en `sme-request.route.ts`, política `"GET /sme-requests": only("ADMIN")`. Respuesta `{ items: [{ applicationId, name, sector, state, updatedAt }], page, pageSize, total, counts }`; query malformada 400 `{ code: "invalid_request" }`; fallo de proveedor 503 `{ code: "unavailable" }` (nunca 200 vacío).
- **Web — login y guard (T2)** — `app/admin/page.tsx` (`AdminLoginScreen`), `app/admin/(console)/layout.tsx` (`AdminConsoleGate` + `AdminShell`), `application/admin/admin-guard.ts` (`adminLoginDecision`/`adminConsoleDecision`, puros). Login real: sólo `ADMIN` entra; un `ADMIN` ya firmado que visita `/admin` va a `/admin/pymes`; una cuenta no-admin (o desactivada) se rechaza con el mensaje genérico `Correo o contraseña incorrectos.` y se descarta la sesión que hubiera abierto, sin revelar la consola (D2). No se embarca la nota «Demo: cualquier correo y contraseña te dejan entrar.» ni `sessionStorage['vaqcrow-admin']`.
- **Web — shell (T2)** — `admin-shell.tsx`: aside con marca `Vaqcrow Admin` + `TESTNET · DEMO`, nav `PyMEs`/`Usuarios`, `ThemeSwitcher` y «Cerrar sesión»; barra superior con badge `TESTNET`, `NotificationBell` y chip de usuario (nombre + línea de rol «Administrador», D3). El badge «Pendientes» del nav usa `page.counts.pending` (global), nunca las filas de la página cargada.
- **Web — cola (T3/T1b)** — `application/admin/queue.ts` (selectores puros: agrupación de 6 estados del API en 4 del template, copys verbatim, filtros KPI, filtro/conteo server-side, `dd/mm/aaaa` con degradado a «Sin dato», toggle de orden, total de páginas), `application/ports/admin-queue-port.ts` (vendor-free y React-free; `ApplicationReviewState` importado type-only de `@vaqcrow/contracts`), `infrastructure/admin/http-admin-queue-gateway.ts` (+ `create-`/`unavailable-`), `state/use-admin-queue.ts` (SWR por query resuelta; `page: null` ante fallo) y `presentation/components/admin/pymes-queue.tsx` (KPIs como filtros `aria-pressed`, búsqueda server-side, tabla con orden `aria-sort`, estados con ícono+texto, acciones `Revisar solicitud`/`Ver detalle`, paginación y estados de carga/vacío/error con «Reintentar»).
- **Pruebas (T4)** — `apps/web/src/app/admin/admin-console.test.tsx` (20), `application/admin/admin-guard.test.ts` (9), `application/admin/queue.test.ts` (16), `infrastructure/admin/http-admin-queue-gateway.test.ts` (10) y los tests de API de T1/T1b (`list-admin-sme-requests.test.ts`, `supabase-sme-request-repository.test.ts`, `sme-request.route.test.ts`, `authorization.test.ts`).

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-07)

Rama de #386. El cierre del repo es `pnpm run verify` (lint && typecheck && lint:tests && typecheck:tests && test && build && boundaries && test:boundaries).

```sh
$ pnpm run verify
@vaqcrow/contracts:test:  Test Files  15 passed (15)      Tests  526 passed
@vaqcrow/domain:test:     Test Files   2 passed (2)       Tests  120 passed
@vaqcrow/ai:test:         Test Files   5 passed (5)       Tests  107 passed
@vaqcrow/api:test:        Test Files  76 passed (76)      Tests  1788 passed
@vaqcrow/web:test:        Test Files 162 passed (162)     Tests  1550 passed
test:boundaries:          Test Files  10 passed (10)      Tests  162 passed
EXIT_CODE=0
```

`pnpm run verify` **termina en verde (exit 0)**: lint, typecheck, lint:tests, typecheck:tests, test, build, boundaries y test:boundaries pasan.

En una corrida **anterior** del mismo gate, `@vaqcrow/web#test` falló con 19 fallas —18 `Test timed out in 5000ms` bajo la corrida paralela de `turbo run test` y 1 aserción sensible al orden— en 10 archivos **ajenos a #386**. Esos archivos pasan en aislamiento (158 tests) y la suite web completa pasa con `--maxWorkers=4` (1550 tests). Es **flakiness ambiental de la corrida paralela**, no una regresión: la re-ejecución del gate completo encadenado da **exit 0**.

```sh
$ pnpm --filter @vaqcrow/api test
 Test Files  76 passed (76)
      Tests  1788 passed (1788)
$ pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4
 Test Files 162 passed (162)
      Tests  1550 passed (1550)
```

La suite de #386 pasa en verde: `admin-console.test.tsx` (20), `admin-guard.test.ts` (9), `queue.test.ts` (16) y `http-admin-queue-gateway.test.ts` (10).

**No re-ejecutado aquí:** la suite de integración de `apps/api` (`test:integration`, credential-gated, nunca parte de `pnpm run test`), cualquier escritura remota de Supabase, Testnet y el recorrido Playwright.

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Login `login` sin la nota demo del template («cualquier correo y contraseña…») | `apps/web/src/app/admin/admin-console.test.tsx` — "shows the designed login view without the template's demo sign-in note" | Re-ejecutado (suite web) |
| Error de credenciales citado, sin sesión y sin navegación | `admin-console.test.tsx` — "shows the quoted wrong-credentials error and keeps no session" | Re-ejecutado (suite web) |
| Cuenta no-admin rechazada sin revelar la consola, sesión descartada | `admin-console.test.tsx` — "rejects a non-admin account without revealing the console" | Re-ejecutado (suite web) |
| `ADMIN` verificado entra a la cola; `ADMIN` firmado que visita `/admin` va directo a `/admin/pymes` | `admin-console.test.tsx` — "sends a verified ADMIN into the queue" / "sends a signed-in ADMIN visiting /admin straight to the queue" | Re-ejecutado (suite web) |
| Guard: visitante sin sesión y no-admin van a `/admin` sin montar la consola; un `ADMIN` ve el shell | `admin-console.test.tsx` — "denies a signed-out visitor…" / "denies a signed-in non-admin…" / "renders the shell for a verified ADMIN" | Re-ejecutado (suite web) |
| Decisión pura del guard (`wait`/`allow`/`deny`, `render`/`enter`) | `apps/web/src/application/admin/admin-guard.test.ts` | Re-ejecutado (suite web) |
| Shell: marca, `TESTNET · DEMO`, link `PyMEs` → `/admin/pymes`, chip con nombre + «Administrador» (D3), «Cerrar sesión» | `admin-console.test.tsx` — "renders the brand, nav, chip with the role line and logout" | Re-ejecutado (suite web) |
| Badge «Pendientes» y KPIs con el conteo **global** del servidor, no la página cargada (T1b) | `admin-console.test.tsx` — "shows the global pending count…" / "drives the KPI numbers from the global server counts…" | Re-ejecutado (suite web) |
| `Usuarios` renderizado como ítem inerte `disabled`, no un enlace muerto (#390) | `admin-console.test.tsx` — "renders Usuarios as an inert nav item instead of a dead link" | Re-ejecutado (suite web) |
| Cerrar sesión cierra la sesión y vuelve al login de `/admin` | `admin-console.test.tsx` — "closes the session and returns to the admin login" | Re-ejecutado (suite web) |
| Cola: título/subtítulo, 4 estados, `VQ-XXXX`, acciones `Revisar solicitud` (1 pendiente) / `Ver detalle` (3) | `admin-console.test.tsx` — "renders the title, subtitle, states and row actions" | Re-ejecutado (suite web) |
| KPIs como filtros server-side: `aria-pressed`, `state` en la query, vuelta a página 1 y segundo clic limpia | `admin-console.test.tsx` — "sets the server-side state filter through a KPI card and clears it on a second click" | Re-ejecutado (suite web) |
| Búsqueda server-side por `q` y reinicio a página 1 | `admin-console.test.tsx` — "searches through the port and resets to the first page" | Re-ejecutado (suite web) |
| Paginación y orden server-side (`page`, `sort`, `order`) | `admin-console.test.tsx` — "paginates and sorts server-side" | Re-ejecutado (suite web) |
| Estados honestos: vacío («No hay solicitudes.»), error saneado + «Reintentar», «Sin dato» sin negocio | `admin-console.test.tsx` — "shows an honest empty state" / "shows a sanitized error and recovers through retry" / "renders the honest 'Sin dato'…" | Re-ejecutado (suite web) |
| Modelo puro de la cola: agrupación de estados, copys verbatim, filtros/orden, `dd/mm/aaaa`, toggle de filtro y de orden | `apps/web/src/application/admin/queue.test.ts` | Re-ejecutado (suite web) |
| Gateway HTTP: sobre `{items,page,pageSize,total,counts}`, item/estado malformado → `unavailable`, transporte → `network`, todo non-200 → `unavailable` sin filtrar el mensaje del proveedor | `apps/web/src/infrastructure/admin/http-admin-queue-gateway.test.ts` | Re-ejecutado (suite web) |
| API: validación/acotado de la query, `state` desconocido → `invalid_request` sin tocar el repositorio, `unavailable` ante fallo | `apps/api/src/application/use-cases/list-admin-sme-requests.test.ts` | Re-ejecutado (suite API) |
| API: lectura de la vista, `.order`/`.or`/`.range`, `count` ausente → `unavailable`, fila malformada → `unavailable`, negocio faltante → `"Sin dato"`, conteos por grupo | `apps/api/src/infrastructure/adapters/supabase-sme-request-repository.test.ts` | Re-ejecutado (suite API) |
| API: `GET /sme-requests` responde 200/400/503 y el contrato del sobre | `apps/api/src/infrastructure/http/routes/sme-request.route.test.ts` | Re-ejecutado (suite API) |
| Autorización: `GET /sme-requests` sólo `ADMIN` en la matriz | `apps/api/src/infrastructure/http/authorization.test.ts` | Re-ejecutado (suite API) |
| Ninguna vista pública enlaza a `/admin` | `apps/web/src/application/navigation/shell-nav.test.ts` — "no view links to /admin"; `apps/web/src/presentation/components/app-header.test.tsx` — "never links to /admin and offers only sign-out" | Re-ejecutado (suite web) |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Migración aplicada local (2026-10-07).** El SQL exacto se aplicó a la base local del stack docker (por versiones de migración de otra rama ajenas al repo, `supabase migration up --local` no servía; no se hizo `repair`/`pull`). Verificado: `security_invoker=true`, sólo `service_role` con `SELECT`, y las queries del adapter (orden por name/sector/state/updated_at, `or(...ilike...)`, count exacto) responden 200.
- **Migración aplicada y verificada en el remoto (2026-10-07, MCP de Supabase).** El padre aplicó `20261007120000_create_admin_sme_request_queue_view.sql` al proyecto remoto (version alineado al del repo) y verificó: vista `relkind=v`, `security_invoker=true`, `service_role` con `SELECT` y `anon`/`authenticated` sin acceso; historial remoto con la versión del repo. Los advisors de seguridad no reportan hallazgos nuevos.

**Nunca ejercitado:** la consola `/admin` en un navegador contra el proyecto remoto; la cola con un `ADMIN` real en Testnet; Testnet o el proveedor LLM. Las pruebas de la cola usan un puerto falso (§2).

## 5. Límites y brechas vigentes

1. **`pnpm run verify` es flaky bajo la corrida paralela (§4.1).** Una corrida anterior falló en `test` con 19 fallas ajenas a #386 (timeouts de 5 s y una aserción sensible al orden) que pasan en aislamiento y con `--maxWorkers=4`; la re-ejecución del gate completo termina en **exit 0**. Se registra la flakiness ambiental sin ocultarla.
2. **La vista de revisión (acciones de fila) es de #410.** El botón se renderiza como lo diseña el template (`Revisar solicitud`/`Ver detalle`), con `onOpen` opcional, y **no navega** en esta rebanada.
3. **La vista `Usuarios` es de #390.** El ítem del nav es inerte y `disabled` hasta que exista su pantalla; no se inventó una pantalla de usuarios ni se publicó un enlace muerto.
4. **Sin corrida viva en navegador ni en Testnet.** El camino de datos es real (endpoint `ADMIN` + vista SQL), pero se ejercita con dobles deterministas en el gate de PR (§4).
5. **Desvío de tema.** Se reutiliza el `ThemeSwitcher` de **tres opciones** (claro/oscuro/sistema) ya establecido en la app, no el toggle de **dos estados** del template, porque el alcance autorizado pide reutilizar ese componente. Desvío registrado.
6. **Copy de estados no diseñados.** El template no diseña carga, vacío, error ni paginación; el copy es **español neutro redactado por el agente** («Cargando…», «No hay solicitudes.», «No hay PyMEs que coincidan con la búsqueda o el filtro.», «No pudimos cargar las solicitudes. No se modificó ningún dato.», «Reintentar», «Página X de Y», «Anterior»/«Siguiente»). Desvío registrado respecto del template.
7. **Borde no alcanzable hoy.** El grupo `pending` cubre los dos estados que el camino real produce en la cola (`awaiting_assessment` recién enviado y `human_review`); `draft` no aparece porque `submit_sme_request` inserta `awaiting_assessment`. Si un `draft` llegara a existir, el conteo y el filtro `pending` no lo incluirían (anotado en la bitácora, T1b).
8. **El remoto no se re-verificó en esta re-ejecución.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-07).

## 6. Preguntas abiertas y decisiones del owner

Las tres preguntas del issue («not designed in the template») se decidieron por el owner el **2026-10-07** (bitácora §Decisiones), antes de implementarse.

| Pregunta (issue #386) | Resolución | Fuente |
|---|---|---|
| Estados de carga, vacío y error de la tabla, y paginación/orden más allá de las cinco filas de muestra | **D1:** agregar paginación y orden además de estados honestos de carga/vacío/error. | Bitácora §Decisiones (D1) |
| Qué ve alguien que no es admin al abrir `/admin` y el comportamiento de expiración de sesión | **D2:** redirigir sin revelar — no-admin o cuenta desactivada vuelven al login de `/admin` con mensaje genérico; la sesión expirada vuelve al login de `/admin`. | Bitácora §Decisiones (D2) |
| La línea de rol del chip de usuario | **D3:** nombre + rol («Administrador»); no se inventa un cargo que no se recolecta (no se replica «Operadora · compliance» del template). | Bitácora §Decisiones (D3) |

**Desvíos documentados** (no son preguntas nuevas inventadas, sino desvíos respecto del template, registrados en la bitácora T2/T3 y en §5): el shell reutiliza el `ThemeSwitcher` de tres estados en vez del toggle de dos; el nav `Usuarios` se renderiza como control inerte `disabled` porque su vista es #390; y la copy de carga/vacío/error/paginación es español neutro porque el template no diseña esos estados.

## 7. Correcciones aplicadas durante el ciclo

- **T1b — filtro y conteo por estado server-side (seguimiento de T1).** El contrato de T1 no ofrecía filtro por estado ni conteo por estado, así que los KPIs y el badge «Pendientes» operaban sobre la página cargada. T1b lo corrige con `state` y `counts` globales del servidor (cuatro consultas count-only `HEAD`), sin agregar objetos SQL nuevos, y retira los selectores muertos `filterQueueItems`/`countQueueStates`. La limitación se registró en T3 como **dato, no diseño**, y no se expandió el backend en silencio.
- **Migración aplicada primero local y luego remota** en la misma unidad, con la version alineada al repo (§4.3).

La bitácora de #386 **no registra una revisión RDD nativa** a la fecha de este documento; la verificación que la respalda es la re-ejecución de §4.1 y las suites deterministas de §4.2. No se inventa una aprobación que no existe.

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #386) | Resultado | Fuente |
|---|---|---|---|
| 1 | "`/admin` shows the login view; only real `ADMIN` credentials enter; the wrong-credentials error is displayed as quoted." | ✅ **CUMPLIDO.** `/admin` renderiza la vista `login` del template; sólo un `ADMIN` verificado entra (a `/admin/pymes`); una cuenta no-admin o desactivada se rechaza con el error citado «Correo o contraseña incorrectos.» y se descarta la sesión. | Suite web re-ejecutada (§4.2); lectura de `admin-login-screen.tsx` y `admin-guard.ts` |
| 2 | "The PyMEs queue renders the KPI-card filters, search, table, states and actions exactly as the template designs them, from real data." | ✅ **CUMPLIDO (con dobles deterministas).** Los copys de KPIs, estados, columnas, acciones y búsqueda son verbatim del template; los KPIs son filtros `aria-pressed` y el conteo es global del servidor (T1b). El camino de datos es real (`GET /sme-requests` + vista SQL); las pruebas usan un puerto falso. **Sin corrida viva en navegador** (§5.4). | Suite web/API re-ejecutada (§4.2); lectura de `queue.ts`/`pymes-queue.tsx`/`list-admin-sme-requests.ts` |
| 3 | "No public page links to `/admin` and non-admins are denied." | ✅ **CUMPLIDO.** Ninguna vista pública enlaza a `/admin` (el nav público no lo menciona; lo prueban `shell-nav.test.ts` y `app-header.test.tsx`); el guard niega a visitante sin sesión y a no-admin sin montar la consola. | Suite web re-ejecutada (§4.2); grep de `/admin` fuera de las superficies de admin |
| 4 | "The template's demo sign-in note does not appear." | ✅ **CUMPLIDO.** No se embarca la nota «Demo: cualquier correo y contraseña te dejan entrar.» ni `sessionStorage['vaqcrow-admin']`; un test lo afirma explícitamente. | Suite web re-ejecutada (§4.2); grep del texto en `apps/*/src` |
| 5 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Fallos cubiertos: query malformada / `state` desconocido → 400 `invalid_request`; fallo de proveedor → 503 `unavailable`; sobre web inválido/estado desconocido/transporte → `unavailable`/`network` sin filtrar el mensaje del proveedor; carga fallida → error saneado con «Reintentar» y `page: null`; negocio faltante o fecha ilegible → «Sin dato»; conteo faltante → `unavailable`. Este documento es la evidencia. | Suites API/web re-ejecutadas (§4.2) |
| 6 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** Las tres preguntas se decidieron el 2026-10-07 (D1/D2/D3, §6) antes de implementarse. Los desvíos (tema de 3 estados, `Usuarios` inerte, copy neutra de estados no diseñados) están documentados como desvíos, no como preguntas inventadas. | Bitácora §Decisiones; suite web re-ejecutada |
| 7 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin valores de variables, keys, PII ni identificadores de proyecto en el repo, la bitácora ni este documento; la consola opera sobre datos sintéticos de la demo y Testnet. Nada afirma disponibilidad, SLA ni valor económico. | Revisión de este documento; grep de secretos en las superficies nuevas |

## 9. Riesgos, contradicciones y limitaciones aceptadas

- **Cierre manual de las Tasks.** GitHub no cierra un issue cuando la PR se mergea en una rama que no es la principal; el cierre de #387/#388/#389/#386 lo decide el owner. Nada está en `main`.
- **Flakiness ambiental del gate paralelo.** `pnpm run verify` falló una vez en `test` (§5.1) con fallas ajenas a #386 que pasan en aislamiento; la re-ejecución da exit 0. Artefacto ambiental, registrado sin ocultarlo.
- **Sin revisión RDD nativa registrada.** La bitácora de #386 no registra un ciclo de revisión nativa (§7); su verificación es la de §4.
- **El remoto no se re-verificó aquí.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-07).
- **Las acciones de fila no navegan.** La vista de revisión es #410; la de usuarios, #390. Es una dependencia registrada, no un olvido.

## 10. Estado de entrega y próximos pasos

- Este cambio es sólo documentación: este archivo y la actualización de [[odd/tasks/admin-login-shell-and-pymes-queue]] (registro T5). Se entrega en la rama de la Feature #386; **no se commitea aquí** — el padre revisa y commitea.
- La Feature #386 **no está en `main`** y no se cierra sola: el cierre lo decide el owner.

> [!todo] Condiciones antes del merge a `main` de la pila de #386
> 1. La flakiness de `pnpm run verify` bajo la corrida paralela (§5.1) queda registrada; el gate cierra en verde (exit 0) en la re-ejecución.
> 2. Implementar la vista de revisión (acciones de fila) en [#410](https://github.com/reyduar/Vaqcrow/issues/410) y la de usuarios en [#390](https://github.com/reyduar/Vaqcrow/issues/390), que #386 desbloquea.
> 3. Aprobar (o ajustar) la copy en español neutro de los estados de carga/vacío/error/paginación que el template no diseña (§5.6).
> 4. Ejercitar la consola `/admin` en un navegador contra el proyecto remoto con un `ADMIN` real, de forma acotada.
