# Bitácora — Feature #382: notificaciones in-app y email con Resend

## Objetivo

Entregar la campana de notificaciones in-app (con contador de no leídas y el modal del template) para los tres roles —ADMIN, PYME e INVERSOR— más el envío de email por la **API de Resend**, detrás de un puerto y un adaptador, con el catálogo de eventos definido por el owner. La entrega es **idempotente por evento** y **un fallo de email nunca bloquea la acción de origen**. Feature [#382](https://github.com/reyduar/Vaqcrow/issues/382) del Epic [#377](https://github.com/reyduar/Vaqcrow/issues/377).

## Ramas y entrega

- **Rama de integración:** `Vaqcrow#382_Feat_Deliver_in_app_notifications_and_Resend_email`, creada desde la punta de la pila #398/#399/#400/#401 y #406/#407/#408/#409 (`be6b758`, tip de #409).
- **Opción A del owner (vigente):** nada llega a `main` todavía; toda la pila se mergea junta con **#438** al final. No hay PR ni merge en esta Feature.
- **Slices locales (unidades de trabajo revisables):** T1a (migración) → T1b (API puertos/adaptadores/config) → T1c (API rutas) → T1d (web campana + modal) → T2 (#384 pruebas) → T3 (#385 evidencia).
- **Forecast de líneas (heurística ~400/tarea, no un tope):** la Feature es grande (migración + API + web + docs). Se cuenta el acumulado del branch; sin merge no hay PR que dividir. Si el acumulado se dispara, se registran los slices en vez de forzar un split artificial.

## Fuente de diseño

Template exportado por el owner en `docs/design/template/` (directorio ignorado por git):

- `Vaqcrow Admin.dc.html` — **única** pantalla que diseña la campana y el modal:
  - Campana (línea 55): botón `44×44`, `aria-label="{{ notifAria }}"` = `"Notificaciones, N sin leer"`, ícono `notifications-outline`, badge de no leídas (`background: var(--accent)`, `min-width:18px`, `border-radius:999px`, `font-size:11px`).
  - Modal (líneas 122–126): overlay + `role="dialog"` `aria-modal="true"` `aria-labelledby`, título "Notificaciones", subtítulo "N sin leer" / "Todo leído", lista con acordeón (`aria-expanded`), tag **NUEVA**, hora ("Hoy · 09:42"), cuerpo, CTA opcional.
  - Estado (líneas 171–173): `markAll` marca todo leído; `notifSub` = "N sin leer"/"Todo leído"; `notifAria` = "Notificaciones, N sin leer".
- `docs/design/design_handoff_vaqcrow/` — handoff de diseño (README, brief, screens).

> [!warning] La campana solo está diseñada en el shell de Admin
> El template **no** dibuja la campana en los headers de PYME ni de INVERSOR. El owner decidió (2026-10-04) replicar **exactamente** la campana y el modal de Admin en el header público existente para PYME e INVERSOR. La pantalla `/admin` todavía no existe (es [#386](https://github.com/reyduar/Vaqcrow/issues/386)); el componente se construye igual y su montaje en Admin espera a esa Feature.

## Decisiones del owner (2026-10-04)

| # | Pregunta (issue #382, «Not designed in the template») | Resolución (owner) |
|---|---|---|
| a | Dónde va la campana en el header público de PYME/INVERSOR | **Exactamente como el template de Admin.** Se replica la campana + modal de `Vaqcrow Admin.dc.html` para los tres roles; en PYME/INVERSOR se monta en el header público (`AppHeader`). El montaje en Admin espera a #386. |
| b | Copy de notificaciones de PyME/inversor y plantillas de email (asunto, cuerpo, remitente, idioma) | **El agente redacta el borrador** en español neutro (voseo); **el owner lo aprueba**. Cubre los textos de los eventos de PyME/inversor (el template solo diseña los 4 de admin) y el email. Remitente candidato: `Vaqcrow <no-reply@vaqcrow.com>` (dominio verificado en Resend). |
| c | Preferencias, baja (unsubscribe), agrupación (batching) y página completa | **Solo el modal.** Sin panel de preferencias, sin unsubscribe (email transaccional), sin batching (un email por evento), sin página `/notifications`. |

## Catálogo de eventos (13; lo define el owner, issue #382)

| Rol destinatario | Evento |
|---|---|
| ADMIN | nueva solicitud; transacción pendiente; meta alcanzada; operador invitado |
| PYME | cambios requeridos; aprobada/publicada; meta alcanzada; declarar ventas del mes; distribución lista para firmar |
| INVERSOR | aporte confirmado; meta alcanzada; distribución recibida; reembolso disponible |

**Seam registrado:** #382 entrega el puerto, el catálogo, la persistencia y la entrega. Las Features que **levantan** los eventos publican por ese puerto; la primera consumidora real es [#402](https://github.com/reyduar/Vaqcrow/issues/402) (envío a revisión → notifica al admin). Por eso, en #382 no hay call-sites de producción todavía: la verificación es con dobles (tests) y el contrato del puerto.

## Arquitectura (seams a construir)

- **Puertos (API, `apps/api/src/application/ports/`):** `NotificationPublisher` (mapea evento → destinatario(s), persiste la notificación in-app y dispara el email; idempotente por evento; no deja que un fallo de email rompa la acción de origen) y `EmailPort` (envío saneado, nunca lanza hacia el llamador).
- **Adaptadores (API, `infrastructure/adapters/`):** repositorio Supabase de notificaciones (`service_role`, errores saneados) y `ResendEmailAdapter` (API HTTP de Resend).
- **Migración:** tabla de notificaciones por destinatario, con RLS (cada usuario lee solo lo suyo; admin lee lo dirigido a admin), clave de idempotencia por evento y `read_at`. Patrón del repo: `service_role`-only, RLS on, grants explícitos, `CHECK`/`UNIQUE`; local-docker → remoto en la misma unidad, reconciliando `schema_migrations`.
- **Rutas API:** listar notificaciones del principal, contador de no leídas, marcar una leída y marcar todas. Toda ruta nueva se suma a `route-policy.ts` **y** a sus tests pinneados (`route-policy.test.ts`, `authorization.test.ts`, `build-app.test.ts`).
- **Web:** componente campana + modal fiel al template, puerto/adaptador HTTP, y montaje en `AppHeader` para PYME/INVERSOR. Estado de servidor vía SWR si el repo ya lo usa (verificar antes de escribir).
- **Email:** es la **API de Resend**, distinta del SMTP de Supabase Auth ya configurado (confirmación de cuenta). La API key y el remitente son variables de entorno; `scripts/demo/preflight` y los módulos de config de la API cambian juntos.

## TDD

- Modo: **activado** (RED observado antes del GREEN).
- Runners: Vitest (API y web), pgTAP (`pnpm run test:db`) para migración/RLS, y Testing Library para la campana/modal. Los tests del PR **nunca** llaman a Resend vivo, a Supabase, a Testnet ni al LLM: usan dobles.
- Skills a cargar antes de escribir: `supabase`, `supabase-postgres-best-practices` (migración/RLS), `heroui-react` y `frontend-design` (UI), `zustand` si se toca estado de cliente.

## Tareas

- [ ] **T1 (#383) — Implementar.**
  - [x] **T1a — Migración + pgTAP.** `supabase/migrations/20261004200000_create_notifications.sql` (84 líneas) + `supabase/tests/notifications.sql` (204 líneas, `plan(57)`). `public.notification`: `id uuid`, `recipient_user_id → profile.user_id on delete cascade`, `event_key`, `event_type` (sin `CHECK` a propósito: el catálogo evoluciona y se valida en la aplicación), `title`, `body`, `cta_label`, `cta_href`, `read_at`, `email_sent_at`, `created_at`; `unique (event_key, recipient_user_id)` (idempotencia in-app) + índice `(recipient_user_id, created_at desc)` y parcial de no leídas. RLS on con **una** política (`notification_select_own`, SELECT para `authenticated` scoped a `recipient_user_id = auth.uid()`); escrituras solo `service_role`; sin grants por defecto a `anon`/`authenticated`. Ruta: delegada (writer acotado; migración + pgTAP).
    - RED (`pnpm run test:db` antes de aplicar): `relation "public.notification" does not exist`, `Tests: 34 Failed: 34`. GREEN: `pnpm run test:db` → `Files=13, Tests=337`, `Result: PASS`; `supabase db advisors --local` → `No issues found`.
    - **Remoto (MCP de Supabase, 2026-10-04):** `apply_migration` OK; historial reconciliado de `20261004233452` a `20261004200000`. Verificado: `rls_on=true`, 1 política, 11 columnas, `anon` sin SELECT, `authenticated` con SELECT y sin INSERT, `service_role` con INSERT.
    - Commit: `ff24d68 feat(db): add the notifications table with per-recipient RLS`.
  - [x] **T1b — API puertos/adaptadores/config.** Se dividió en dos unidades:
    - [x] **T1b-1 — Config + puertos + catálogo.** `email-config.ts` (slice opcional: `RESEND_API_KEY` Secret, `EMAIL_FROM` default `Vaqcrow <no-reply@vaqcrow.com>`, `APP_BASE_URL` default `http://localhost:3001`; campo `enabled`), cableado en `api-config.ts` (+ `api-config.test.ts` y `config-matrix.test.ts`); puertos vendor-free `email-port.ts`, `notification-repository-port.ts`, `notification-publisher-port.ts`; catálogo puro `notification-catalogue.ts` (13 eventos, audiencia, `renderInApp`, `renderEmail(payload, appBaseUrl)` con guarda de exhaustividad). Espejo en `scripts/demo/preflight/preflight.mjs` (check `email` + `RESEND_API_KEY` en `SECRET_ENV_NAMES`) y `scripts/env/generate-docker-env.sh` (`APP_BASE_URL`). RED (imports sin resolver) → GREEN foco `Test Files 7 passed, Tests 289`; suite API `71 archivos / 1655`; `typecheck` 8/8; `lint` 0; `boundaries` 0. Commit `f1366d4 feat(api): add the notification catalogue, ports and email config`.
    - [x] **T1b-2 — Adaptadores + caso de uso.** `SupabaseNotificationRepository` (service_role, errores saneados; `insertIfAbsent` con `onConflict` + `ignoreDuplicates`; `markRead`/`markAllRead` condicionales), `ResendEmailAdapter` (+ `UnavailableEmailPort` y factory por config; nunca lanza; 400/422→`invalid`, 401/403/429/5xx→`unavailable`, throw→`network`) y `NotificationPublisher` (fan-out por audiencia, idempotente por `(event_key, recipient)`, email best-effort que nunca rompe la acción de origen; sólo el mismatch `type`/`payload.type` lanza). RED → GREEN foco `38`; suite API `74 archivos / 1693`; `typecheck` 8/8; `lint` 0; `boundaries` 0. Commit `181bec2 feat(api): add the notification repository, Resend adapter and publisher`.
      - **Descubrimiento (verificado):** `public.profile` **no tiene** columna `email` (la migración `20260930180000` la omite a propósito; el trigger `handle_new_user` sólo la usa como fallback de `display_name`). Decisión: mantener el email **sólo en `auth.users`** (sin migración ni PII duplicada en tablas de app); el adaptador resuelve los destinatarios con el join de Auth Admin. Documentado en el adaptador.
      - **Gap a resolver en T1c:** `resolveRecipientsByRole` devuelve `[]` ante un fallo (indistinguible de "sin destinatarios") y `insertIfAbsent` devuelve `{inserted:false,id:""}`; endurecer el canal de error del puerto.
  - [x] **T1c — API rutas + canal de error.** Puertos endurecidos (`resolveRecipientsByRole`/`insertIfAbsent` devuelven resultado discriminado; `PublishSummary` suma `failed`). Rutas `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:notificationId/read` (400 si no es UUID, 404 si es ajeno/inexistente), `POST /notifications/read-all`, todas `AUTHENTICATED` y con el destinatario siempre de `principal.userId`. Cableado en `build-app.ts`/`index.ts` + `route-policy.ts` y tests pinneados. RED (404 en vez de 400/200; formas viejas) → GREEN foco `20 archivos / 623`; suite API `75 / 1734`; `typecheck` 8/8; `lint` 0; `boundaries` 0. Commit `e4d30bf feat(api): add the notification routes and harden the repository error channel`.
    - **Gap residual (documentado).** Sólo se endurecieron `resolveRecipientsByRole`/`insertIfAbsent`. `listByRecipient`/`countUnread`/`markRead`/`markAllRead` siguen devolviendo vacío/0/false ante un fallo del proveedor, así que las lecturas no distinguen una caída de "sin datos". Candidato a unidad posterior (o a resolver si la revisión lo marca).
  - [x] **T1d — Web campana + modal.** `notification-port.ts` (vendor-free), `http-notification-gateway.ts` + factory/null-object, hook SWR `use-notifications.ts` (list + contador con mutaciones optimistas y rollback), `notification-bell.tsx` (campana 44×44 con badge, `aria-label="Notificaciones, N sin leer"`; modal `role="dialog" aria-modal aria-labelledby`, subtítulo "N sin leer"/"Todo leído", acordeón `aria-expanded` + tag NUEVA, hora "Hoy · 09:42", cuerpo, CTA, "Marcar todas como leídas"; Escape/overlay cierran y devuelven el foco) y montaje en `app-header.tsx` sólo para PYME/INVERSOR (ADMIN espera #386). RED → GREEN foco `26`; suite web `158 / 1493`; `typecheck` 8/8; `lint` 0; `boundaries` 0. Commit `653b97a feat(web): add the notification bell and modal`.
    - **Desvíos documentados (para la revisión):** (1) ícono por fila genérico (`IoNotificationsOutline`): el contrato no lleva ícono y el template sólo dibuja 4 íconos de admin, así que no se inventó un mapa de 13; (2) sin copy de estado vacío/cargando/error (el template no los diseña; el estado vacío sólo muestra "Todo leído"); (3) el modal no tiene focus-trap completo (sólo Escape/overlay y foco de entrada/salida), como `account-menu.tsx`.
  - [x] **T1e — Endurecimiento (hallazgos RDD).** Dos unidades: **API+preflight** (commit `4ff8bef`) y **web** (commit `1503a8d`).
    - **(a)** `email-config.ts` valida `EMAIL_FROM`/`APP_BASE_URL` **solo cuando el slice está habilitado** (clave presente); `APP_BASE_URL` es **requerido fuera de `local`** cuando está habilitado (fail-closed en vez de links a loopback). `api-config` pasa el entorno; tests de `email-config`/`api-config`/`config-matrix` actualizados.
    - **(b)** El preflight normaliza la barra final de `APP_BASE_URL` y agrega un **test cruzado** (`tests/demo-preflight.test.ts`) que compara sus constantes con las del módulo de la API.
    - **(c)** `NotificationEvent` pasa a `{ eventKey } & NotificationPayload`: el tipo no puede discrepar; se elimina el chequeo runtime de mismatch.
    - **(d)** `listEmailsById` **falla cerrado** (unavailable) si agota el tope de páginas con la última llena.
    - **(e)** El timeout de Resend ahora cubre también la lectura del cuerpo.
    - **(f)** Test nuevo: un `markEmailSent` que lanza no impide contar el email como enviado.
    - **(i)** El puerto de repositorio devuelve resultados discriminados en las lecturas; las rutas devuelven **`503 { code: "unavailable" }`** ante un fallo del proveedor (ya no un `200` vacío). El gateway web ya mapea cualquier no-200 a un código saneado.
    - **(g)** La campana consume `loadFailed`: con carga fallida el `aria-label` es **`Notificaciones no disponibles`** y el subtítulo **`No pudimos cargar tus notificaciones.`** (copy nuevo, **pendiente de aprobación del owner**). **(h)** El hook tolera que falle el contador conservando la lista (deriva `unread` de los ítems).
    - Verificación: `pnpm run verify` → 5/5 tareas; API `75 archivos / 1748`; web `158 / 1495`; `test:boundaries` `162`.
    - **Cambios de comportamiento (intencionales):** fuera de `local`, la API no arranca si el email está habilitado y falta `APP_BASE_URL`; y un deploy sin `NEXT_PUBLIC_API_BASE_URL` muestra la campana como "no disponibles" en vez de "0 sin leer".
- [x] **T2 (#384) — Probar.** Auditoría de la cobertura ya escrita en T1 (no reescritura) y cierre del único gap real: el mapeo evento→audiencia del `NotificationPublisher` sólo se ejercitaba con un evento ADMIN. Se agregaron **3 casos** deterministas en `notification-publisher.test.ts` (un evento PYME y uno INVERSOR resuelven su propia audiencia y persisten su propio copy/CTA; más una secuencia INVERSOR→PYME→ADMIN que resuelve cada rol desde el evento que recibe). `InMemoryNotificationRepository` ahora registra el rol pedido (`resolvedRoles`) y su firma pasa a `resolveRecipientsByRole(role: Role)`. **Sin cambio de producción**: los casos pasan contra la implementación existente (son de caracterización; no hubo RED porque el comportamiento ya estaba, sólo no probado).
  - **Evento→destinatario por cada entrada del catálogo:** mapa completo en `notification-catalogue.test.ts` (`it.each` sobre las 13 entradas afirma `NOTIFICATION_AUDIENCE[type]`; también "cubre cada tipo exactamente una vez"); integración por rol en `notification-publisher.test.ts` (ADMIN ya existía; PYME e INVERSOR nuevos).
  - **Idempotencia en replay + aislamiento del fallo de email:** `notification-publisher.test.ts` (replay `inserted:0/skipped:1` sin segundo email; un email que lanza o devuelve `ok:false` se cuenta y no rompe al resto; un `markEmailSent` que lanza no desmarca el envío); `supabase-notification-repository.test.ts` (conflicto en `insertIfAbsent` → `inserted:false` + read-back del id); pgTAP `notifications.sql` (`unique (event_key, recipient_user_id)` → `23505`).
  - **Contador de no leídas, marcar una/todas, accesibilidad del modal:** rutas `notification.route.test.ts`; repositorio `supabase-notification-repository.test.ts` (`countUnread`, `markRead`, `markAllRead`); hook `use-notifications.test.tsx`; modal `notification-bell.test.tsx` (badge y `aria-label="Notificaciones, N sin leer"`, `aria-expanded` de la campana y del acordeón de fila, foco de entrada al `Cerrar` del diálogo, foco de retorno a la campana en Escape/overlay/cerrar).
  - **RLS: un usuario no lee lo ajeno:** pgTAP `notifications.sql` (autenticado como A ve exactamente su fila; la de B cuenta 0); rutas `notification.route.test.ts` (`listByRecipient`/`markRead`/`markAllRead` reciben siempre `principal.userId`, y un `recipientUserId` de body/query se ignora); repositorio (`listByRecipient` filtra por `recipient_user_id`). A nivel de ruta **no** se agregó nada: la ruta delega el filtrado en el repositorio (no filtra en memoria), así que su contrato observable es "consulta sólo por el principal" — ya probado; el filtrado real vive en la query + RLS.
  - Verificación: `pnpm --filter @vaqcrow/api test` → `75 archivos / 1751` (era 1748, +3); `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → `158 archivos / 1495`; `pnpm run typecheck` 8/8; `pnpm run lint` 5/5 (1 warning preexistente en `fetch-http-client.ts`, ajeno a esta unidad); `pnpm run boundaries` sin violaciones (768 módulos). `pnpm run test:db` **no** se re-ejecutó: no se tocó el suite pgTAP.
  - Commit: `test(notifications): close the remaining #384 coverage gaps`.
- [ ] **T3 (#385) — Evidencia.** `docs/planning/in-app-notifications-and-resend-email-evidence.md` (en español), con cada criterio de aceptación citado textualmente y su fuente de verificación. Alinear `CLAUDE.md`/`AGENTS.md` (gemelos), `docs/architecture/environments.md` y `docs/planning/DEMO.md`.

## Revisión RDD (2026-10-04)

El rango completo de T1 (42 archivos / 4618 líneas) **superó el presupuesto de contexto del revisor** (`lens_context_budget_exceeded`, sin autoridad creada). Se dividió en tres candidatos, cada uno revisado en un worktree aislado y aprobado con autoridad `burned`.

| Candidato | Unidades | Base → head | Riesgo | Líneas | Lentes | Linaje | Resultado |
|---|---|---|---|---|---|---|---|
| c1 | T1a + T1b-1 | `dbc5fff` → `f1366d4` | high | 1449 (16 archivos) | 4 (risk, resilience, readability, reliability) | `review-65e45503120982ab` | `approved` |
| c2 | T1b-2 | `f1366d4` → `181bec2` | medium | 1496 (6 archivos) | 1 (reliability) | `review-b3b6d23785f0cfce` | `approved` |
| c3 | T1c + T1d | `f6ad839` → `653b97a` | medium | 1755 (26 archivos) | 1 (reliability) | `review-273a2e6da95c1f6e` | `approved` |

Transporte del reviewer: en c1 la lente `readability` devolvió vacío dos veces y capturó al 3.º intento; en c3 la lente `reliability` falló una vez (`opencode_reviewer_result_refused`) y capturó en el reintento. El resto capturó a la primera.

**Hallazgos no bloqueantes** (todos `informational`, ninguno abrió corrección; quedan como trabajo posterior):

- **c1/R4-1** (`email-config.ts:36`, WARNING): `DEFAULT_APP_BASE_URL` apunta al loopback y no tiene guarda por `APP_ENV`; un deploy con `RESEND_API_KEY` pero sin `APP_BASE_URL` arma los links de email contra `localhost`.
- **c1/R4-2** (`email-config.ts:74-80`, WARNING): un `EMAIL_FROM`/`APP_BASE_URL` inválido hace fallar el arranque **aunque el email esté deshabilitado**, contradiciendo el contrato "el email nunca debe impedir el boot".
- **c1/R2-001 + R3-001** (`preflight.mjs:62-72`, WARNING/SUGGESTION): el preflight **duplica** los defaults y la regex de `email-config.ts`, unidos solo por un comentario "keep in sync"; ya deriva (el preflight no normaliza la barra final de `APP_BASE_URL`).
- **c1/R2-002 + R3-002** (`notification-publisher-port.ts:20-22`, SUGGESTION): `NotificationEvent` lleva el tipo dos veces (`type` y `payload.type`) y la invariante "deben coincidir" no la expresa el tipo.
- **c2/R3-skip-failure-conflation** (`notification-publisher.ts:61-69`, WARNING): `PublishSummary.skipped` confunde un fallo real de inserción con un replay idempotente.
- **c2/R3-email-directory-cap-truncation** (`supabase-notification-repository.ts:281-302`, SUGGESTION): `listEmailsById` corta a 50 páginas (>10.000 usuarios) en silencio.
- **c2/R3-body-read-outside-deadline** (`resend-email-adapter.ts:81-99`, SUGGESTION): el timeout cubre el `fetch` pero no la lectura del cuerpo de la respuesta.
- **c3/R3-BELL-LOAD-FAILURE** (`notification-bell.tsx:72`, WARNING): la campana no consume `loadFailed`; una carga fallida se ve igual que una bandeja vacía ("0 sin leer" / "Todo leído").
- **c3/R3-LOAD-PARTIAL-FAILURE** (`use-notifications.ts:40-43`, SUGGESTION): `load` trata lista y contador como una sola lectura atómica; si falla el contador se pierde la lista ya obtenida.

**Gaps residuales ya registrados en T1c** (fuera del alcance de la revisión): `listByRecipient`/`countUnread`/`markRead`/`markAllRead` siguen devolviendo vacío/0/false ante un fallo del proveedor.

## Próximo paso

**T2 (#384)** cerrado (auditoría + 3 casos de audiencia por rol). Ahora **T3 (#385)**: `docs/planning/in-app-notifications-and-resend-email-evidence.md` (en español), con cada criterio de aceptación citado textualmente y su fuente de verificación, más la alineación de `CLAUDE.md`/`AGENTS.md` (gemelos), `docs/architecture/environments.md` y `docs/planning/DEMO.md`. Los hallazgos no bloqueantes de la revisión RDD quedan como trabajo posterior (candidatos a una unidad de endurecimiento).
