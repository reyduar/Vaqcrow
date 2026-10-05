# Evidencia de cierre de la Feature #382 — Issue #385

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#383](https://github.com/reyduar/Vaqcrow/issues/383) (implementación), [#384](https://github.com/reyduar/Vaqcrow/issues/384) (pruebas) y [#385](https://github.com/reyduar/Vaqcrow/issues/385) (evidencia) de la Feature [#382](https://github.com/reyduar/Vaqcrow/issues/382) ("Feature: Deliver in-app notifications and Resend email", Epic [#377](https://github.com/reyduar/Vaqcrow/issues/377)), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/in-app-notifications-and-resend-email|Bitácora: notificaciones in-app y email con Resend]].

> [!warning] Estado de entrega: nada de #382, #383, #384 ni #385 está en `main`
> El trabajo vive en la rama de integración `Vaqcrow#382_Feat_Deliver_in_app_notifications_and_Resend_email`, creada desde la punta de la pila #398/#399/#400/#401 y #406/#407/#408/#409 (`be6b758`, tip de #409). Por la **Opción A del owner**, nada llega a `main` todavía: toda la pila se mergea junta con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)). No hay PR ni merge en esta Feature, y este documento no reporta un estado mergeado. La demo desplegada desde `main` todavía no muestra la campana ni envía email transaccional desde la API.

## 1. Contexto y objetivo

La Feature #382 entrega la campana de notificaciones in-app —con contador de no leídas y el modal del template— para los tres roles (ADMIN, PYME e INVERSOR), más el envío de email por la **API de Resend** detrás de un puerto y un adaptador, con el catálogo de eventos definido por el owner (13 eventos). La entrega es **idempotente por evento** y **un fallo de email nunca bloquea la acción de origen**. La campana se construye a partir de la única pantalla del template que la diseña, `Vaqcrow Admin.dc.html`; el owner decidió (2026-10-04) replicarla exactamente y montarla en el header público de PYME e INVERSOR mientras el montaje en Admin espera a [#386](https://github.com/reyduar/Vaqcrow/issues/386) (la consola `/admin` todavía no existe).

| Task | Rama | Estado del issue (2026-10-04) |
|---|---|---|
| #383 — implementar | `Vaqcrow#382_Feat_Deliver_in_app_notifications_and_Resend_email` | abierto; T1a–T1e, tip `1b40ae9` (docs RDD) |
| #384 — probar | (misma rama de la Feature) | abierto; commit `7484571` |
| #385 — documentar | (misma rama de la Feature) | este documento |

La Feature #382 sigue abierta; su cierre lo decide el owner. **Seam registrado:** #382 entrega el puerto, el catálogo, la persistencia, la entrega y la campana. Las Features que *levantan* los eventos publican por ese puerto; la primera consumidora real es [#402](https://github.com/reyduar/Vaqcrow/issues/402) (envío a revisión → notifica al admin). Por eso en #382 **no hay call-sites de producción todavía**: la verificación es con dobles y con el contrato del puerto.

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-04 en este árbol de trabajo (rama de #385), con su línea de salida real (§4.1). (b) **Bitácora** — una entrada fechada de [[odd/tasks/in-app-notifications-and-resend-email]] o el resultado de una revisión RDD; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba de esta Feature habla con la API de Resend, con Supabase remoto, con Testnet ni con el LLM. El adaptador `ResendEmailAdapter` recibe un `fetch` inyectable y las pruebas pasan un doble; el repositorio de notificaciones usa el cliente de Supabase como doble en las pruebas de API. Sólo `pnpm run test:db` toca una base, y es el stack local del perfil docker (§4.1).
- **Sin secretos.** Ningún email, contraseña, API key, token ni identificador de proyecto aparece en este documento; las variables se nombran, nunca sus valores.
- **Sin claims de producción.** El envío de email es transaccional de demo; los links apuntan a la web de la demo; la liquidación y el dominio de Resend siguen siendo de Testnet/demo. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado (Tasks #383 y #384)

Fuente: bitácora (T1a–T1e, T2, 2026-10-04) y lectura del código en `1b40ae9`.

- **Migración y pgTAP (T1a)** — `supabase/migrations/20261004200000_create_notifications.sql` (84 líneas): tabla `public.notification` con `id uuid`, `recipient_user_id → profile.user_id on delete cascade`, `event_key text`, `event_type text` (**sin `CHECK` a propósito**: el catálogo evoluciona y se valida en la aplicación), `title`, `body`, `cta_label`, `cta_href`, `read_at`, `email_sent_at`, `created_at`; `unique (event_key, recipient_user_id)` como ancla de idempotencia in-app; índice `(recipient_user_id, created_at desc)` y parcial de no leídas. **RLS on con exactamente una política** (`notification_select_own`, `SELECT` para `authenticated` scopeado a `recipient_user_id = auth.uid()`); escrituras sólo `service_role`; grants explícitos en la misma migración (sin `anon`/`authenticated` por defecto) y sin `INSERT/UPDATE/DELETE` para `authenticated`. pgTAP `supabase/tests/notifications.sql` (`plan(57)`).
- **API — puertos, catálogo y config (T1b-1)** — `apps/api/src/application/config/email-config.ts`: slice opcional; `RESEND_API_KEY` (Secret), `EMAIL_FROM` (default `Vaqcrow <no-reply@vaqcrow.com>`), `APP_BASE_URL` (default `http://localhost:3001`, sin barra final); campo `enabled = RESEND_API_KEY presente`. Cableado en `api-config.ts` (+ `api-config.test.ts`, `config-matrix.test.ts`). Puertos vendor-free `email-port.ts`, `notification-repository-port.ts`, `notification-publisher-port.ts`. Catálogo puro `notification-catalogue.ts`: 13 eventos con audiencia (`NOTIFICATION_AUDIENCE`), `renderInApp`, `renderEmail(payload, appBaseUrl)` y guarda de exhaustividad (`assertNever`). Espejo en `scripts/demo/preflight/preflight.mjs` (check `email`; `RESEND_API_KEY` en `SECRET_ENV_NAMES`) y `scripts/env/generate-docker-env.sh` (`APP_BASE_URL`).
- **API — adaptadores y caso de uso (T1b-2)** — `SupabaseNotificationRepository` (service_role, errores saneados; `insertIfAbsent` con `onConflict` + `ignoreDuplicates`; `markRead`/`markAllRead` condicionales; resuelve destinatarios por rol contra `profile` y lee el email desde Auth Admin, porque `public.profile` no tiene columna `email` a propósito). `ResendEmailAdapter` (+ `UnavailableEmailPort` y `createEmailPort` por config): `POST https://api.resend.com/emails` con la key como bearer, `fetch` inyectable, timeout de 5 s que también cubre la lectura del cuerpo, y `send` **nunca lanza** (400/422→`invalid`, 401/403/429/5xx→`unavailable`, throw/timeout→`network`). `NotificationPublisher`: fan-out por audiencia, idempotente por `(event_key, recipient)`, email best-effort que nunca rompe la acción de origen; `NotificationEvent` es `{ eventKey } & NotificationPayload`, así que el tipo no puede discrepar.
- **API — rutas (T1c)** — `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:notificationId/read` (400 si no es UUID, 404 si es ajeno/inexistente) y `POST /notifications/read-all`, las cuatro `AUTHENTICATED` en `application/authorization/route-policy.ts`, con el destinatario siempre tomado de `request.principal.userId` (un `recipientUserId` de body/query se ignora). Un fallo del proveedor es `503 { code: "unavailable" }`, nunca un 200 vacío. Cableado en `build-app.ts`/`index.ts` y tests pinneados.
- **Web — campana y modal (T1d)** — `notification-port.ts` (vendor-free), `http-notification-gateway.ts` + factory/null-object, hook SWR `use-notifications.ts` (lista + contador con `loadFailed` y mutaciones optimistas con rollback), `notification-bell.tsx` (campana 44×44 con badge, `aria-label="Notificaciones, N sin leer"`; modal `role="dialog" aria-modal aria-labelledby`, subtítulo «N sin leer»/«Todo leído», acordeón `aria-expanded` + tag NUEVA, hora `Hoy · 09:42`, cuerpo, CTA, «Marcar todas como leídas»; Escape/overlay cierran y devuelven el foco) y montaje en `app-header.tsx` **sólo para PYME/INVERSOR**; el montaje en Admin espera a #386.
- **Endurecimiento (T1e)** — (a) `EMAIL_FROM`/`APP_BASE_URL` se validan **sólo cuando el slice está habilitado** y `APP_BASE_URL` es **requerido fuera de `local`** cuando está habilitado (fail-closed en vez de links a loopback); (b) el preflight normaliza la barra final y suma un test cruzado (`tests/demo-preflight.test.ts`); (c) `NotificationEvent` pasa a `{ eventKey } & NotificationPayload` (invariante por tipo); (d) `listEmailsById` falla cerrado al agotar el tope de páginas; (e) el timeout de Resend cubre la lectura del cuerpo; (f) un `markEmailSent` que lanza no desmarca el envío; (g) la campana consume `loadFailed`; (h) una falla del contador conserva la lista; (i) las lecturas devuelven resultados discriminados y las rutas responden `503` ante un fallo del proveedor.
- **Pruebas (T2)** — auditoría de la cobertura ya escrita en T1 y cierre del único gap real: el mapeo evento→audiencia del publisher sólo se ejercitaba con un evento ADMIN. Se agregaron 3 casos deterministas (un evento PYME y uno INVERSOR resuelven su propia audiencia y persisten su propio copy/CTA, más una secuencia INVERSOR→PYME→ADMIN). **Sin cambio de producción**: los casos pasan contra la implementación existente (caracterización).

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-04)

Rama de #385, Node `v24.21.0`, stack local del perfil docker en marcha (`test:db` sólo usa Postgres local).

```sh
$ pnpm --filter @vaqcrow/api test
 Test Files  75 passed (75)
      Tests  1751 passed (1751)

$ pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4
 Test Files  158 passed (158)
      Tests  1495 passed (1495)

$ pnpm run test:db
 /…/supabase/tests/notifications.sql ........................ ok
 (+ 12 archivos previos, todos ok)
All tests successful.
Files=13, Tests=337,  1 wallclock secs
Result: PASS

$ pnpm run test:boundaries
 Test Files  10 passed (10)
      Tests  162 passed (162)

$ pnpm run boundaries
✔ no dependency violations found (768 modules, 2436 dependencies cruised)

$ pnpm run verify
exit 0
 Tasks:    5 successful, 5 total   (lint)
 Tasks:    8 successful, 8 total   (typecheck)
 Tasks:    8 successful, 8 total   (lint:tests + typecheck:tests)
 Tasks:    5 successful, 5 total   (test + build + boundaries + test:boundaries)
```

**No re-ejecutado aquí:** la suite de integración de `apps/api` (`test:integration`, credential-gated, nunca parte de `pnpm run test`) y el recorrido Playwright; no los toca esta Feature.

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Migración: columnas, `unique (event_key, recipient_user_id)` → `23505` en replay, RLS on / 1 política, grants explícitos; un usuario autenticado ve sólo su fila y la de otro cuenta 0 | `supabase/tests/notifications.sql` | Re-ejecutado (`test:db`); RED en bitácora T1a |
| Catálogo: 13 entradas; `NOTIFICATION_AUDIENCE[type]` por cada entrada y cobertura exacta de cada tipo una vez; copy por evento y link absoluto en `renderEmail` | `apps/api/src/application/notifications/notification-catalogue.test.ts` | Re-ejecutado (suite API) |
| Evento→destinatario por rol (ADMIN + PYME + INVERSOR) y secuencia multi-rol; replay `inserted:0/skipped:1` sin segundo email; email que lanza o `ok:false` se cuenta y no rompe al resto; `markEmailSent` que lanza no desmarca el envío | `apps/api/src/application/use-cases/notification-publisher.test.ts` | Re-ejecutado (suite API); casos nuevos de T2 |
| Adaptador Resend: 200/201→`ok`, 400/422→`invalid`, 401/403/429/5xx→`unavailable`, throw/timeout→`network`, timeout de la lectura del cuerpo; la URL del request es la constante del endpoint; la key va sólo en el header | `apps/api/src/infrastructure/adapters/resend-email-adapter.test.ts` | Re-ejecutado (suite API) |
| Repositorio Supabase: conflicto en `insertIfAbsent` → `inserted:false` + read-back del id; `countUnread`/`markRead`/`markAllRead`; `listByRecipient` filtra por `recipient_user_id`; errores saneados | `apps/api/src/infrastructure/adapters/supabase-notification-repository.test.ts` | Re-ejecutado (suite API) |
| Rutas: las cuatro `AUTHENTICATED`, `400`/`404`/`503`, sin filtrar texto del proveedor, el destinatario siempre es `principal.userId` y un `recipientUserId` de body/query se ignora | `apps/api/src/infrastructure/http/routes/notification.route.test.ts` | Re-ejecutado (suite API); tests pinneados de `route-policy` |
| Hook web: `loadFailed`, deriva de `unread` si falla el contador conservando la lista, optimismo y rollback | `apps/web/src/state/use-notifications.test.tsx` | Re-ejecutado (suite web) |
| Campana/modal: badge y `aria-label="Notificaciones, N sin leer"`, `aria-expanded` de la campana y del acordeón, tag NUEVA, hora, foco de entrada al `Cerrar` del diálogo y retorno a la campana en Escape/overlay; «Notificaciones no disponibles» / «No pudimos cargar tus notificaciones.» con carga fallida | `apps/web/src/presentation/components/notification-bell.test.tsx` | Re-ejecutado (suite web); copy de fallo owner-pending (§5) |
| Gateway web: cualquier no-200 mapea a un código saneado; la factory cae al null-object sin `NEXT_PUBLIC_API_BASE_URL` | `apps/web/src/infrastructure/notifications/http-notification-gateway.test.ts`, `create-notification-port.test.ts` | Re-ejecutado (suite web) |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Remoto (MCP de Supabase, 2026-10-04):** migración `20261004200000` aplicada; historial reconciliado de `20261004233452` a `20261004200000`; verificado `rls_on=true`, 1 política, 11 columnas, `anon` sin `SELECT`, `authenticated` con `SELECT` y sin `INSERT`, `service_role` con `INSERT`.
- **Resend real:** no se ejercitó ningún envío contra la API viva. El adaptador se prueba con `fetch` inyectable (§4.2) y el preflight valida la configuración sin enviar nada.

**Nunca ejercitado:** un envío real contra la API de Resend; la campana contra el proyecto Supabase remoto con un navegador; el montaje en la consola `/admin` (espera a #386).

## 5. Límites y brechas vigentes

1. **La revisión nativa de T1e + T2 (c4) no se completó.** El rango `653b97a` → HEAD (24 archivos / 950 líneas, `medium`, linaje `review-82f7f33a20000784`) tenía una única lente (`review-reliability`) que devolvió vacío en tres intentos (`opencode_task_output_empty`); se declaró el slot no alcanzable (`capture-unachievable`) y el ciclo cerró con **`stop` / `unachievable_lens_slot`**. **No se inventó aprobación.** Es un defecto del transporte del runtime (resultado de sub-agente vacío), no una regresión de código; reintentable con `capture-unachievable --withdraw=true` + relanzar la lente.
2. **Criterio 1 parcial: el montaje en Admin espera a #386.** La campana/modal y las rutas sirven a cualquier rol (las cuatro rutas son `AUTHENTICATED`; RLS y el repositorio aíslan por destinatario), pero **hoy sólo se monta en el header público de PYME e INVERSOR** (`app-header.tsx`). La consola `/admin` no existe todavía; el componente queda listo para su montaje. El aislamiento por usuario sí está probado (§4.2).
3. **Desvíos documentados respecto del template.** (a) el ícono por fila es el genérico de notificaciones: el contrato no lleva ícono y el template sólo dibuja 4 íconos de admin, así que no se inventó un mapa de 13; (b) no hay copy de estado vacío/cargando/error diseñado por el template (el estado vacío sólo muestra «Todo leído»); (c) el modal no tiene *focus trap* completo (sólo Escape/overlay y foco de entrada/salida), como `account-menu.tsx`.
4. **Copy de fallo de carga pendiente de aprobación.** Con carga fallida la campana anuncia «Notificaciones no disponibles» y el modal dice «No pudimos cargar tus notificaciones.»: es copy **redactado por el agente** (el template no diseña ese estado) y queda **owner-pending**. El copy del catálogo de eventos sí fue aprobado por el owner (decisión b).
5. **Gap residual de lecturas (T1c).** Sólo se endurecieron `resolveRecipientsByRole`/`insertIfAbsent`. `listByRecipient`/`countUnread`/`markRead`/`markAllRead` sí devuelven resultados discriminados y las rutas responden `503` (T1e/i), pero cualquier consumidor que no sea la ruta debe respetar ese contrato. Candidato a unidad posterior.
6. **Sin call-site de producción todavía.** La Feature entrega el puerto y el catálogo; el primer productor real es #402. Hasta entonces, publicar no ocurre en runtime de la demo.
7. **Hallazgos no bloqueantes de la revisión RDD** de c1/c2/c3 quedan como trabajo posterior: `DEFAULT_APP_BASE_URL` loopback sin guarda por `APP_ENV` (resuelto en T1e/a), duplicación de defaults/regex entre preflight y `email-config` (mitigada con test cruzado), conflatión de `skipped` por fallo de inserción, tope de 50 páginas en `listEmailsById`.

## 6. Preguntas abiertas y decisiones del owner

| Pregunta (issue #382, «Not designed in the template (open question)») | Resolución | Fuente |
|---|---|---|
| "Where in the public header of PYME/INVERSOR the bell goes" | **DECIDIDA (a, 2026-10-04): exactamente como el template de Admin.** Se replica la campana + modal de `Vaqcrow Admin.dc.html` para los tres roles; en PYME/INVERSOR se monta en el header público (`AppHeader`), y el montaje en Admin espera a #386. | Bitácora §Decisiones (a) |
| "The notification and email copy templates (subject, body, sender, language)" | **DECIDIDA (b, 2026-10-04): el agente redacta el borrador en español neutro (voseo) y el owner lo aprueba.** Cubre los textos de los eventos de PyME/inversor (el template sólo diseña los 4 de admin) y el email. Remitente `Vaqcrow <no-reply@vaqcrow.com>` (dominio verificado en Resend). | Bitácora §Decisiones (b) |
| "Preferences, unsubscribe, batching and a full page" | **DECIDIDA (c, 2026-10-04): sólo el modal.** Sin panel de preferencias, sin unsubscribe (email transaccional), sin agrupación (un email por evento), sin página `/notifications`. | Bitácora §Decisiones (c) |

Decisiones del owner registradas durante la Feature (bitácora, 2026-10-04):

| # | Decisión | Estado |
|---|---|---|
| a | Campana + modal de Admin replicadas para los tres roles; montadas en el header público en PYME/INVERSOR; Admin espera #386. | vigente |
| b | El agente redacta el copy de eventos/email; el owner lo aprueba. Remitente verificado `no-reply@vaqcrow.com`. | vigente (copy de fallo de carga todavía pendiente, §5.4) |
| c | Sólo el modal: sin preferencias, sin unsubscribe, sin batching, sin página completa. | vigente |

## 7. Correcciones aplicadas durante el ciclo y revisiones RDD

El rango completo de T1 (42 archivos / 4618 líneas) **superó el presupuesto de contexto del revisor** (`lens_context_budget_exceeded`, sin autoridad creada). Se dividió en tres candidatos, cada uno revisado en un worktree aislado y aprobado con autoridad `burned`.

| Candidato | Unidades | Base → head | Riesgo | Lentes | Linaje | Resultado |
|---|---|---|---|---|---|---|
| c1 | T1a + T1b-1 | `dbc5fff` → `f1366d4` | high | 4 (risk, resilience, readability, reliability) | `review-65e45503120982ab` | `approved` |
| c2 | T1b-2 | `f1366d4` → `181bec2` | medium | 1 (reliability) | `review-b3b6d23785f0cfce` | `approved` |
| c3 | T1c + T1d | `f6ad839` → `653b97a` | medium | 1 (reliability) | `review-273a2e6da95c1f6e` | `approved` |
| **c4** | **T1e + T2** | `653b97a` → HEAD | medium | 1 (reliability) | `review-82f7f33a20000784` | **incompleta** — `stop` / `unachievable_lens_slot` (`opencode_task_output_empty`) |

Los hallazgos no bloqueantes de c1/c2/c3 (`informational`, ninguno abrió corrección) se listan en §5.7; los cambios de comportamiento de T1e son intencionales: fuera de `local` la API no arranca si el email está habilitado y falta `APP_BASE_URL`, y un deploy sin `NEXT_PUBLIC_API_BASE_URL` muestra la campana como «no disponibles» en vez de «0 sin leer».

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #382) | Resultado | Fuente |
|---|---|---|---|
| 1 | "A bell with unread count and the template modal is available to ADMIN, PYME and INVERSOR and shows only that user's notifications." | ⚠️ **PARCIAL.** La campana y el modal están implementados y son fieles al template; las cuatro rutas son `AUTHENTICATED` para cualquier rol y el aislamiento por usuario se cumple (RLS `recipient_user_id = auth.uid()` + el repositorio filtra por destinatario + la ruta toma siempre `principal.userId`). **El montaje en Admin espera a #386**: hoy sólo se monta en el header público de PYME e INVERSOR porque `/admin` no existe (§5.2). | Suite API/web y `test:db` re-ejecutadas; lectura de `app-header.tsx`/`route-policy.ts`; bitácora T1d |
| 2 | "Every event in the owner's catalogue can be published through the port and produces an in-app notification and an email through the Resend adapter." | ✅ **CUMPLIDO con dobles.** El catálogo tiene los 13 eventos del owner con su audiencia; `NotificationPublisher.publish` resuelve el rol desde el evento, persiste la fila in-app por destinatario y dispara el email por `EmailPort`/`ResendEmailAdapter`. Verificado evento→audiencia por cada entrada y por rol. **No ejercitado contra Resend real** (§4.3). | Suites API y web re-ejecutadas (§4.2); lectura del código |
| 3 | "A replayed event does not duplicate notifications or emails; a failing email does not fail the originating action." | ✅ **CUMPLIDO.** `unique (event_key, recipient_user_id)` + `insertIfAbsent` → un replay devuelve `inserted:false`/`skipped:1` y **no** reenvía email; pgTAP prueba el `23505`. Un email que devuelve `ok:false` o lanza se cuenta en `emailsFailed` y `publish` **nunca lo propaga**; un `markEmailSent` que lanza no desmarca el envío. | Suite API y `test:db` re-ejecutadas; §4.2 |
| 4 | "Pull-request tests use an email double; no live Resend call exists in `pnpm run test`." | ✅ **CUMPLIDO.** `ResendEmailAdapter` recibe un `fetch` inyectable; las pruebas pasan un doble y sólo afirman que la URL del request es la constante del endpoint. `pnpm run test` es unit-only (sin `test:integration`). La única mención a `api.resend.com` fuera del adaptador está en su propio comentario/constante. | Suites re-ejecutadas; grep de `api.resend.com`/`RESEND_ENDPOINT` en `apps/*/src` |
| 5 | "Resend credentials are environment-only and documented in the profile docs and preflight." | ✅ **CUMPLIDO (esta unidad completa la documentación).** `email-config.ts` lee `RESEND_API_KEY`/`EMAIL_FROM`/`APP_BASE_URL` sólo del entorno y envuelve la key en `Secret`; el preflight suma el check `email` y `RESEND_API_KEY` a `SECRET_ENV_NAMES`. `CLAUDE.md`/`AGENTS.md` y `docs/architecture/environments.md` documentan las variables y la regla fail-closed en este mismo commit. | Lectura del código; §3; commit de esta unidad |
| 6 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Fallos cubiertos: proveedor `unavailable` → `503`, email `invalid`/`unavailable`/`network`/timeout sin romper la acción, id idóneo pero ajeno → `404`, UUID malformado → `400`, `markEmailSent`/contador fallidos tolerados, carga web fallida visible, y `APP_BASE_URL` faltante fuera de `local` que impide el arranque con email habilitado. Este documento es la evidencia. | Suites API/web y `test:db` re-ejecutadas; §4.2 |
| 7 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** Las tres preguntas se decidieron el 2026-10-04 (a/b/c, §6) antes de implementarse: ubicación de la campana, autoría/aprobación del copy y alcance «sólo el modal». Ninguna se inventó. | Bitácora §Decisiones; comentario del owner en #382 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin valores de variables, keys ni PII en el repo, la bitácora ni este documento; el email es transaccional de demo y los links apuntan a la web de la demo; nada afirma disponibilidad, SLA ni valor económico. | Revisión de este documento; suites re-ejecutadas |

## 9. Riesgos, contradicciones y limitaciones aceptadas

- **Cierre manual de las Tasks.** GitHub no cierra un issue cuando la PR se mergea en una rama que no es la principal; el cierre de #383/#384/#385 lo decide el owner. Ninguno está en `main`.
- **Revisión nativa de T1e/T2 sin completar.** No hay resultado de lente por un defecto del transporte del reviewer (§5.1); su verificación es la de la bitácora T1e/T2 y la re-ejecución de §4.1.
- **Criterio 1 medido de forma parcial.** La campana no está montada en Admin hasta #386 (§5.2). No es un olvido: es una dependencia registrada.
- **Copy de fallo de carga sin aprobar.** Dos cadenas nuevas quedan owner-pending (§5.4).
- **El remoto no se re-verificó aquí.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-04).

## 10. Estado de entrega y próximos pasos

- Este cambio es sólo documentación: este archivo, la alineación de `CLAUDE.md`/`AGENTS.md` (gemelos), `docs/architecture/environments.md`, `docs/planning/DEMO.md` y la bitácora. Commit en la rama de la Feature #382; no hay PR ni merge.
- La Feature #382 **no está en `main`** y no se cierra sola: el cierre lo decide el owner.

> [!todo] Condiciones antes del merge a `main` de la pila de #382
> 1. Montar la campana en la consola `/admin` y cubrir ADMIN de punta a punta (#386), cerrando el criterio 1.
> 2. Aprobar (o ajustar) el copy de fallo de carga «Notificaciones no disponibles» / «No pudimos cargar tus notificaciones.» (§5.4).
> 3. Reintentar la revisión RDD nativa de T1e + T2 cuando el transporte del reviewer vuelva a funcionar (§5.1).
> 4. Confirmar el primer call-site de producción (#402) publicando por el puerto, y ejercitar un envío real contra Resend de forma acotada.
> 5. Evaluar los hallazgos no bloqueantes pendientes (§5.7): tope de páginas de `listEmailsById`, conflatión de `skipped`.
