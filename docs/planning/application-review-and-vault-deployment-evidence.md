# Evidencia de cierre de la Feature #410 — Issue #413

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#411](https://github.com/reyduar/Vaqcrow/issues/411) (implementación), [#412](https://github.com/reyduar/Vaqcrow/issues/412) (pruebas) y [#413](https://github.com/reyduar/Vaqcrow/issues/413) (evidencia) de la Feature [#410](https://github.com/reyduar/Vaqcrow/issues/410) ("Feature: Review applications and approve to deploy and publish the vault"), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/application-review-and-vault-deployment|Bitácora: revisión, aprobación y despliegue de la bóveda]].

> [!warning] Estado de entrega: nada de #410 está en `main`
> El trabajo vive en la rama de integración `Vaqcrow#410_Feat_Review_applications_and_approve_to_deploy_and_publish_the_vault`, apilada sobre las ramas de integración de #406/#399 y de #402. Nada llega a `main`: la Feature está **bloqueada de forma nativa por [#386](https://github.com/reyduar/Vaqcrow/issues/386)** (la consola `/admin` todavía no existe) y por la **Opción A del owner** (la pila se mergea junta con el retiro del recorrido de seis pasos, [#438](https://github.com/reyduar/Vaqcrow/issues/438)). No hay PR ni merge en esta Feature y este documento no reporta un estado mergeado. La demo desplegada desde `main` todavía no muestra la revisión real ni despliega bóvedas desde la aprobación.

> [!info] Actualización 2026-10-07: fase UI (U1–U7)
> Las secciones 1–9 registran el cierre **backend-first** del 2026-10-06 y se conservan como registro histórico. Después, la rama de #410 integró la consola `/admin` de #386 (merge `f930365`) y construyó la vista de revisión en una cadena de work units U1–U7. La §10 documenta esa fase y trae la **tabla de criterios vigente** (§10.5), que reemplaza a la de la §7 donde difieren (criterios 1 y 2). Nada de eso está en `main`.

> [!important] Alcance backend-first
> Por decisión del owner (D5, 2026-10-06) #410 se implementa **backend-first en paralelo**: la API, la persistencia, los guardrails y el despliegue idempotente se entregan ahora; la integración con la consola admin (la vista de revisión de las secciones 1–3 y los veredictos por documento) queda para después de #386. Por eso varios criterios de aceptación están **PARCIALES o no entregados** por dependencia de frontend, y así se declaran aquí.

## 1. Contexto y objetivo

La Feature #410 cierra el lado humano de la solicitud de financiamiento: el admin inspecciona la evidencia KYC/KYB de una solicitud real, recibe una recomendación **consultiva** de la IA y registra una decisión atribuida. «Aprobar con límite» dispara **exactamente un** despliegue de bóveda **firmado por la plataforma**, con la clave pública de la PyME como destino inmutable, y publica la campaña **sólo tras la confirmación de Testnet**. Un replay de una aprobación confirmada **no vuelve a desplegar**.

La entrega reutiliza las rutas y puertos existentes (solicitud, assessment, decisión humana, notificaciones, campañas/bóveda) y agrega: acceso admin seguro a documentos privados, contexto agregado de revisión, tabla de tasas con guardrails enteros, snapshot de tasa por campaña, un tope individual atómico on-chain, notificaciones de decisión, deadline de la PyME persistido y un ciclo de vida de despliegue persistido e idempotente.

| Task | Rama | Estado del issue |
|---|---|---|
| #411 — implementar | `Vaqcrow#410_Feat_Review_applications_and_approve_to_deploy_and_publish_the_vault` | abierto; T1a, T1b, T3, T3a, T3b, T4a, T5a, T5b |
| #412 — probar | (misma rama de la Feature) | abierto |
| #413 — documentar | (misma rama de la Feature) | este documento |

La Feature #410 sigue abierta y **bloqueada por #386**: su cierre lo decide el owner. **Seam registrado:** #410 consume #382 (publicador de notificaciones y campana) y #402 (envío a revisión humana); el primer consumidor de sus estados de despliegue es la consola admin (#386) y el listado de marketplace (#414).

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el **2026-10-06** en este árbol de trabajo (rama de #413), con su línea de salida real (§4.1). (b) **Bitácora** — una entrada fechada de [[odd/tasks/application-review-and-vault-deployment]]; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba PR-gated habla con Testnet, Horizon, RPC de Soroban, la API de Resend, el LLM ni Supabase remoto. Las pruebas de API usan dobles y fixtures; `cargo test` corre el contrato en local; sólo `pnpm run test:db` toca una base, y es el stack local del perfil docker (§4.1).
- **Sin secretos.** Ningún email, contraseña, seed, clave privada, API key, token ni contraseña de base aparece en este documento; las variables se nombran, nunca sus valores.
- **Sin claims de producción.** El despliegue es sobre **Testnet** y sin valor económico; la conversión ARS↔activo sigue **simulada**; el revenue share es de demo. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado

Fuente: bitácora (T1a, T1b, T3, T3a, T3b, T4a, T5a, T5b, 2026-10-06).

- **T1a — visor privado de documentos para admin** (`62d88fb`) — `GET /storage/uploads?path=` restringido a `ADMIN`; exige un descriptor persistido, descarga mediante `StoragePort` y devuelve bytes con `private, no-store`, `nosniff` y filename seguro, mapeando fallos a `400`/`404`/`503` saneados. Los POST/DELETE de la PyME no cambian. Es el habilitante backend de la inspección de evidencia del criterio 1.
- **T1b — contexto agregado de revisión admin** (`3cac86a`) — `GET /application-reviews/:applicationId/context` restringido a `ADMIN`; compone snapshot de revisión, solicitud con owner resuelto server-side, empresa opcional, descriptores privados, assessment opcional y última decisión opcional. IDs inválidos → `400`, recursos desconocidos → `404`, fallos de dependencias → `503` saneados; las ausencias opcionales **no** se convierten en falsos errores. Es el contrato de datos de la vista de revisión del criterio 1.
- **T3 — tabla de tasas y guardrails enteros** (`004f2d9`) — tabla `fx_rate` (RLS/grants sólo `service_role`, campos enteros `usd_to_ars`/`stroops_per_usd`, versión primaria e índice de vigencia); `POST /admin/rates` y `GET /admin/rates/current` restringidos a `ADMIN`, autor atribuido al principal verificado, `bigint` serializado como strings. La validación pura aplica con enteros (sin floats) el máximo de **USD 50.000** por campaña y el máximo individual `min(10% del objetivo, USD 5.000)`.
- **T3a — snapshot de tasa y tope de campaña** (`fc0673b`) — migración `20261006130000_add_campaign_rate_snapshot.sql`: columnas nullable `fx_rate_version`/`usd_to_ars`/`stroops_per_usd` en `campaign` con la restricción `campaign_rate_snapshot_all_or_none` (las tres NULL o las tres NOT NULL), sin backfill ni FK. `openCampaign` resuelve la tasa vigente, valida el tope con decimales enteros y persiste el snapshot; códigos saneados `rate_unavailable` (503) y `goal_limit_exceeded` (422). El replay y la adopción de una bóveda existente **no** consultan la tasa.
- **T3b — tope individual atómico on-chain** (`53621e0`) — `campaign-vault::contribute` gana la variante apendizada `InvestorCapExceeded = 10` (las variantes 1–9 no se reordenan: son ABI público) y rechaza cuando `previous + amount > goal / 10` **antes de cualquier escritura o transferencia**. No cambian la firma del constructor ni los argumentos de `factory::deploy`. El wasm cambió (sha256 `966f5b89…`), lo que obliga a un **paso de operador pendiente** (redeploy/re-apuntado de la fábrica) que **no se ejecutó** (§5.6).
- **T4a — notificaciones de decisión a la PyME** (`50fc044`) — direccionamiento explícito por destinatario (`resolveRecipientsByUserIds`) en vez del fan-out por rol; evento faltante `pyme.rejected` agregado al catálogo; `recordHumanDecision` publica `pyme.changes_requested`/`pyme.rejected` direccionado al `ownerUserId` con `eventKey application:<id>:decision:<decisionId>:<outcome>`, **sólo** en un apply real; el replay y los fallos de owner/lookup/publisher nunca fallan la decisión. `approved` no publica aquí.
- **T5a — deadline de la PyME persistido** (`d5a8e2a`) — migración `20261006140000_add_business_deadline.sql`: `deadline timestamptz` nullable en `businesses`, sin backfill; `BusinessDraft`/`BusinessRecord` aceptan `deadline` ISO 8601 opcional (con offset explícito) y el adaptador lo persiste/lee, degradando una fila malformada a `unavailable`. La validación vive en el caso de uso, así que el comportamiento previo queda intacto cuando falta.
- **T5b — aprobación → deploy con lifecycle persistido** (`0b0abff`) — migración `20261006150000_create_campaign_deployment.sql`: tabla `public.campaign_deployment` (una fila por aplicación) con `state` (`pending`/`deploying`/`confirmed`/`failed`), `attempts`, `last_error` (código saneado), `campaign_id`, `last_correlation_id`, timestamps; RLS on, cero policies y `service_role` select/insert/update. El caso de uso `deployApprovedCampaign` sólo corre para una aplicación `approved`: resuelve owner, deadline y `goal_ars` del negocio y la public key del wallet; convierte ARS→stroops con enteros; valida con `validateCampaignGuardrails`; llama al engine existente `openCampaign` (idempotente); en éxito marca `confirmed` y publica `pyme.approved_published` al owner; en fallo marca `failed` con código saneado. **Replay de `confirmed` es no-op** (no redespliega ni notifica). HTTP `POST`/`GET /application-reviews/:applicationId/deployment` (ADMIN), el `GET` sin exponer `lastCorrelationId`. El disparo desde una decisión `approved` es **fire-and-forget**: nunca bloquea ni rompe la respuesta de la decisión.
- **Desvío documentado (conversión ARS→stroops).** La fórmula literal del encargo subescalaba el objetivo (5.000 USD → 0,005 XLM) porque `RateSnapshot.usdToArs` ya viene escalado por `RATE_SCALE`; T5b implementa la conversión correcta en dos pasos con la escala de almacenamiento aplicada una sola vez (divisiones que truncan hacia cero) y fija el caso real 12.000.000 ARS a 1.200 ARS/USD y 10.000.000 stroops/USD → **100.000.000.000 stroops**.

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-06)

Rama de #413, Node `v24.21.0`, stack local del perfil docker en marcha (`test:db` sólo usa Postgres local).

```sh
$ pnpm run verify
$ pnpm run lint && pnpm run typecheck && pnpm run lint:tests && pnpm run typecheck:tests && pnpm run test && pnpm run build && pnpm run boundaries && pnpm run test:boundaries
# todos los gates verdes
exit 0
```

`pnpm run verify` **pasa (exit 0)**. En la primera corrida de este work unit falló en el gate de lint por dos errores **reales de producción** introducidos por #410 — `storage.route.ts:84` (`no-control-regex`, T1a) y `supabase-rate-table-repository.ts:48` (`_error` sin usar, T3) — ambos en archivos que **no existen en `main`**, así que el defecto era de esta rama, no ambiental. Se corrigieron en el mismo work unit (saneo de `contentDisposition` sin regex de caracteres de control, y eliminación del parámetro sin usar) y el gate completo encadenado da **exit 0**. Gates individuales re-ejecutados:

```sh
$ pnpm run typecheck
 Tasks:    8 successful, 8 total

$ pnpm run lint:tests
$ eslint tests/            # sin hallazgos

$ pnpm run typecheck:tests
$ tsc -p tsconfig.tests.json --noEmit   # sin hallazgos

$ pnpm run test
 @vaqcrow/api:test:  Test Files  91 passed (91)
 @vaqcrow/api:test:       Tests  2065 passed (2065)
 Tasks:    8 successful, 8 total

$ pnpm run build
 Tasks:    5 successful, 5 total

$ pnpm run boundaries
✔ no dependency violations found (833 modules, 2693 dependencies cruised)

$ pnpm run test:boundaries
 Test Files  10 passed (10)
      Tests  164 passed (164)
```

```sh
$ pnpm run test:db
 admin_rls_scope.sql ........................ ok
 businesses_ownership.sql ................... ok
 campaign_deployment.sql .................... ok
 campaign_persistence.sql ................... ok
 notifications.sql .......................... ok
 pyme_documents_bucket.sql .................. # Failed 3/20 subtests (9, 16, 18): have 9, want 3
 (resto de los archivos) .................... ok
Files=15, Tests=415,  2 wallclock secs
Result: FAIL
```

`test:db` deja **14/15 archivos ok**. La única falla es `pyme_documents_bucket.sql` — **ambiental y preexistente**: el bucket local `pyme-documents` tiene 6 objetos ajenos dejados por corridas anteriores (la corrida de T3a ya la documenta con los mismos subtests 9/16/18 y el mismo `have: 9, want: 3`). La migración `campaign_deployment` de #410 no participa de ese conteo. El pgTAP nuevo `campaign_deployment.sql` pasa **ok** en esta corrida; la bitácora registra su detalle como **27/27** (T5b).

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Visor privado admin: descriptor requerido, bytes con `private, no-store`/`nosniff`, filename seguro, `400`/`404`/`503` saneados, POST/DELETE de PyME sin cambios | `apps/api/src/infrastructure/http/routes/storage.route.test.ts`, `supabase-pyme-document-repository.test.ts` | Re-ejecutado (suite API); RED/GREEN en bitácora T1a |
| Contexto de revisión admin: composición de snapshot, owner server-side, empresa/assessment/decisión opcionales, `400`/`404`/`503`, ausencias sin falso error | `apps/api/src/application/use-cases/get-admin-review-context.test.ts`, ruta | Re-ejecutado (suite API); bitácora T1b |
| Guardrails enteros: tope de campaña USD 50.000 y `min(10%, USD 5.000)` sin floats; rutas de tasa ADMIN con autor atribuido y `bigint` como string | `campaign-guardrails.test.ts`, `supabase-rate-table-repository.test.ts`, `rate-table.route.test.ts` | Re-ejecutado (suite API); RED/GREEN en bitácora T3 |
| Snapshot de tasa en `openCampaign`: `rate_unavailable`/`goal_limit_exceeded`, persistencia y lectura de las tres columnas, omisión si no hay snapshot, replay sin consultar la tasa | `open-campaign.test.ts`, `supabase-campaign-repository.test.ts`, `campaign.route.test.ts` | Re-ejecutado (suite API); bitácora T3a |
| Tope individual atómico on-chain: exactamente en el tope, un stroop por encima y segunda contribución del mismo inversor que lo excede; `InvestorCapExceeded` antes de escritura/transferencia | `contracts/campaign-vault/src/test.rs` (`cargo test`) | Bitácora T3b: **39 passed / 0 failed** (`cargo test` desde `contracts/`), `stellar contract build` completo |
| Notificaciones de decisión: `pyme.changes_requested`/`pyme.rejected` direccionadas al owner, `pyme.rejected` en el catálogo, replay sin publicar, owner no resuelto/lookup caído/publisher que lanza nunca fallan la decisión | `notification-publisher.test.ts`, `human-decision.route.test.ts` | Re-ejecutado (suite API); RED/GREEN en bitácora T4a |
| Deadline de la PyME: validación ISO 8601 con offset, persistencia/lectura, fila malformada → `unavailable`, `201`/`400 { field: "deadline" }` | `business.test.ts`, `supabase-business-repository.test.ts`, `business.route.test.ts` | Re-ejecutado (suite API); bitácora T5a |
| Despliegue de aprobación: sólo `approved`; replay de `confirmed` no redespliega ni notifica; resolución de owner/deadline/goal/public key; conversión ARS→stroops; `markFailed` con código saneado; `pyme.approved_published` tras confirmar | `deploy-approved-campaign.test.ts`, `supabase-campaign-deployment-repository.test.ts`, `application-review-deployment.route.test.ts` | Re-ejecutado (suite API, 2065 passed); bitácora T5b (GREEN 402 en 7 archivos) |
| Autorización: las rutas nuevas (`/storage/uploads`, `/application-reviews/:id/context`, `/admin/rates*`, `/application-reviews/:id/deployment`) son `ADMIN`; la matriz completa sigue verde | `authorization.test.ts` | Re-ejecutado (suite API); bitácora T1a/T1b/T3/T5b |
| Esquema y RLS/grants de las migraciones nuevas: `fx_rate`, snapshot de `campaign`, `businesses.deadline`, `campaign_deployment` | `supabase/tests/*.sql` | Re-ejecutado (`test:db`, 14/15 ok); bitácora T5b (`campaign_deployment.sql` 27/27) |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Migraciones aplicadas al proyecto remoto (2026-10-06/07).** Aplicadas vía el MCP de Supabase y verificadas (esquema, grants/RLS e historial reconciliado con `supabase/migrations/`): `20261006120000_create_fx_rate`, `20261006130000_add_campaign_rate_snapshot`, `20261006140000_add_business_deadline` y `20261006150000_create_campaign_deployment`. Los advisors de seguridad no reportan hallazgos nuevos (el INFO de RLS-sin-policy es el patrón `service_role`-only de todas las tablas).
- **Contrato Rust:** `cargo test` **39 passed / 0 failed** y `stellar contract build` completo (bitácora T3b), con el wasm de `campaign-vault` de sha256 `966f5b89…`. **No re-ejecutado aquí.**
- **Testnet:** **no se ejecutó ningún** despliegue, redeploy, publicación ni transacción real. El despliegue idempotente de T5b se prueba con dobles; la confirmación de Testnet es un borde real que no se tocó.

**Nunca ejercitado:** un despliegue o publicación reales en Testnet; la vista de revisión admin contra datos reales (es frontend, espera #386); el visor de documentos abierto desde una consola admin real.

## 5. Límites y brechas vigentes

1. **La Feature está bloqueada por #386 (abierta).** La consola `/admin` no existe; todo lo visual (vista de revisión de secciones 1–3, veredictos por documento, diálogo de confirmación, estados de despliegue) depende de esa Feature. Por eso los criterios 1 y 2 no se cierran aquí (§7).
2. **El gate de lint de `pnpm run verify` se corrigió en este work unit.** La primera corrida falló por dos errores de producción de #410 (`storage.route.ts` `no-control-regex`; `supabase-rate-table-repository.ts` `no-unused-vars`), en archivos que **no existen en `main`**: eran defectos de esta rama. Se corrigieron (saneo sin regex de control y parámetro eliminado) y `pnpm run verify` pasa **exit 0** (§4.1).
3. **Falla ambiental preexistente de `test:db`.** `pyme_documents_bucket.sql` falla por 6 objetos ajenos en el bucket local `pyme-documents` (subtests 9/16/18: `have: 9, want: 3`), documentada ya en T3a; `campaign_deployment.sql`, `campaign_persistence.sql` y `businesses_ownership.sql` pasan. No es una regresión de #410.
4. **Criterio 4 parcial: el evento admin de despliegue pendiente no tiene productor.** `pyme.changes_requested`, `pyme.rejected` (T4a) y `pyme.approved_published` (T5b) sí publican; el `admin.pending_transaction` que describe «un despliegue pendiente notifica a los admins» **no tiene call-site todavía**. Es la brecha nombrada del criterio 4.
5. **T3b — paso de operador pendiente y no ejecutado.** El tope individual atómico cambió el wasm de la bóveda, así que una fábrica ya desplegada seguiría creando bóvedas sin tope. Hacerlo efectivo en Testnet exige **redesplegar la fábrica apuntando al wasm nuevo y re-apuntar `STELLAR_CAMPAIGN_FACTORY_ID`** (mismo procedimiento que tras un reset de Testnet, `contracts/README.md`). **No se ejecutó** ningún despliegue ni redeploy.
6. **Campo de plazo del wizard sin UI.** El deadline se persiste backend-first (T5a) porque la PyME lo define, pero el template **no diseña** ese campo: queda como pregunta abierta y **no se inventó UI** (§6).
7. **La revisión visual de #410 no se ejercitó.** No hay un navegador ni la consola admin; la evidencia visual del criterio 1 no existe aún.

## 6. Preguntas abiertas y decisiones del owner

Decisiones registradas en la bitácora (2026-10-06) antes de implementar los flujos afectados:

| # | Pregunta abierta del issue | Resolución | Fuente |
|---|---|---|---|
| D1 | ¿El admin puede inspeccionar PDFs, imágenes y fotos o sólo ver sus nombres? | **Resuelta:** visor/descarga segura, con autorización admin, Storage privado y sin URLs públicas. | Bitácora §Decisiones |
| D2 | ¿Cómo se comunica «Pedir», «Requiere cambios» y «Rechazada» a la PyME? | **Resuelta:** email al correo registrado + notificación en la campana; al abrirla, la app lleva al paso «Revisión humana» del wizard con el detalle. Reutiliza #382. | Bitácora §Decisiones |
| D3 | ¿Qué estados y acciones expone el review durante/después del deployment? | **Resuelta:** `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada`; un fallo muestra `Despliegue fallido` con **Reintentar** y **Ver detalle** (sólo lectura). La publicación ocurre sólo tras la confirmación de Testnet. | Bitácora §Decisiones |
| D4 | ¿Qué controla «Límite aprobado» y quién define deadline/mínimo de contribución? | **Resuelta:** el admin no ingresa límites; la PyME define los términos. La plataforma impone el máximo de USD 50.000 equivalentes por campaña y el máximo por inversor `min(10% del objetivo, USD 5.000)`. | Bitácora §Decisiones |
| D5 | ¿Se espera a #386 antes de tocar #410? | **Resuelta:** se autoriza implementar backend-first en paralelo; la integración con la consola admin queda para después de #386. | Bitácora §Decisiones |
| D6 | ¿Cómo se convierte el tope USD a ARS/XLM mientras la conversión siga simulada? | **Resuelta:** tabla de tasas configurable por ADMIN (versión, vigencia, autor, origen `manual`/`provider`, enteros de precisión fija); cada campaña guarda el snapshot usado. | Bitácora §Decisiones |

**Pregunta que permanece abierta:** el **campo de plazo del wizard**. El owner decidió que la PyME define el deadline (T5a), pero el template de onboarding sólo diseña «Meta de financiamiento (ARS)» y «Revenue share propuesto (%)»; no hay campo de plazo. Se persiste backend-first y **no se inventa UI**; queda para cuando se toque esa pantalla.

## 7. Mapeo de criterios de aceptación

> [!note] Tabla del cierre backend-first (2026-10-06)
> Se conserva como registro de ese momento. La tabla vigente, tras la fase UI, es la §10.5.

| # | Criterio (verbatim, issue #410) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The review view reproduces sections 1 to 3, validations and the confirmation dialog, on real applications." | ❌ **NO ENTREGADO (frontend, depende de #386).** La vista es de la consola admin. El backend la habilita con el contexto agregado de revisión (`/application-reviews/:id/context`, T1b) y el visor privado de documentos (`/storage/uploads`, T1a); sin #386 no hay superficie visual sobre solicitudes reales. | Lectura de rutas; bitácora T1a/T1b; §5.1 |
| 2 | "Per-document verdicts, the human decision with reason and limit, and the audit entry are persisted and attributed." | ⚠️ **PARCIAL.** La decisión humana con motivo/límite y su entrada de auditoría se persisten y **se atribuyen al admin autenticado** mediante el RPC `record_human_decision` (transición condicional desde `human_review`, idempotente). Los veredictos por documento «Válido/Pedir/Inválido» son **UI y dependen de #386**. | Suite API re-ejecutada; bitácora T3/T5b; §5.1 |
| 3 | "Approval deploys exactly one vault with the PyME's public key as immutable destination, then publishes the campaign; a replayed approval does not redeploy." | ✅ **CUMPLIDO.** `deployApprovedCampaign` (#410/T5b) toma la public key server-side, despliega **una sola vez** vía `openCampaign` (idempotente), **publica sólo tras la confirmación**, y un replay confirmado es **no-op**. La firma de `factory.deploy` sigue siendo sólo de la plataforma; la public key de la PyME es el destino inmutable. | Suite API re-ejecutada (2065); bitácora T5b; §4.2 |
| 4 | "Changes-requested, rejection and approval notify the PyME; a pending deployment notifies admins." | ⚠️ **PARCIAL.** `pyme.changes_requested`/`pyme.rejected` notifican a la PyME (T4a) y la aprobación publica `pyme.approved_published` al confirmar (T5b). El evento admin de «despliegue pendiente» (`admin.pending_transaction`) **no tiene productor todavía**. | Suite API re-ejecutada; bitácora T4a/T5b; §5.4 |
| 5 | "The AI recommendation never approves or transfers funds." | ✅ **CUMPLIDO.** La IA es consultiva; el despliegue sólo corre para una revisión `approved` (decisión humana). Ninguna ruta de IA aprueba, calcula obligaciones ni mueve fondos. | Lectura de `deployApprovedCampaign`; bitácora T5b |
| 6 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Fallos cubiertos con códigos saneados: `400`/`404`/`503` del visor y del contexto; `rate_unavailable` (503) y `goal_limit_exceeded` (422) en `openCampaign`; `investor_limit_exceeded` (422) en el preflight de contribución; `InvestorCapExceeded` on-chain; deadline/empresa/clave ausentes y tasa inusable son fallos saneados, nunca excepciones; un `markFailed` que falla no cambia el resultado; el disparo fire-and-forget nunca bloquea la decisión. Este documento es la evidencia. | Suite API y `test:db` re-ejecutadas; bitácora T1a/T1b/T3/T3a/T3b/T5b |
| 7 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ⚠️ **PARCIAL.** D1–D6 se decidieron antes de implementar los flujos afectados y ninguna se inventó. **Excepción nombrada:** el campo de plazo del wizard sigue **abierto** (el owner decidió que la PyME define el deadline, pero el template no diseña el campo): se persiste backend-first y no se inventó UI. | Bitácora §Decisiones; §6 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin secretos, seeds ni PII en el repo, la bitácora ni este documento; el despliegue es de Testnet sin valor económico y la conversión ARS↔activo sigue simulada; nada afirma disponibilidad, SLA ni valor económico. | Revisión de este documento; suites re-ejecutadas |

## 8. Riesgos, contradicciones y limitaciones aceptadas

- **Bloqueo nativo por #386.** La Feature no puede cerrar su parte visual hasta que exista la consola admin; está declarado como dependencia registrada, no como olvido.
- **Lint rojo en la rama de integración.** Dos errores de lint en código de producción de #410 mantienen `pnpm run verify` en rojo aunque el resto de los gates pase (§5.2). Es un defecto real a corregir antes del merge a `main`.
- **Falla ambiental de `test:db`.** Restringida a `pyme_documents_bucket.sql` por objetos ajenos en el bucket local (§5.3); no afecta al esquema de #410.
- **Criterio 4 medido de forma parcial.** El evento admin de despliegue pendiente no tiene productor (§5.4).
- **Paso de operador de Testnet sin ejecutar.** El tope on-chain sólo es efectivo en Testnet tras redesplegar/re-apuntar la fábrica (§5.5); no se afirma que esté activo.
- **El remoto no se re-verificó aquí.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-06/07).

## 9. Estado de entrega y próximos pasos

- Este cambio es **sólo documentación**: este archivo y la bitácora [[odd/tasks/application-review-and-vault-deployment]]. Commit en la rama de la Feature #410; no hay PR ni merge.
- La Feature #410 **no está en `main`**, está **bloqueada por #386** y su cierre lo decide el owner.

> [!todo] Condiciones antes del merge a `main` de la pila de #410
> 1. Resolver #386 (consola `/admin`) y montar la vista de revisión, los veredictos por documento y los estados de despliegue: cierra los criterios 1 y 2.
> 2. Corregir los dos errores de lint de `apps/api` que dejan `verify` en rojo (§5.2) y volver a correr `pnpm run verify` completo.
> 3. Agregar el productor del evento admin de despliegue pendiente (`admin.pending_transaction`), cerrando el criterio 4.
> 4. Ejecutar el paso de operador de T3b (redeploy/re-apuntado de la fábrica en Testnet) y verificar el tope de forma acotada.
> 5. Definir el campo de plazo del wizard cuando se toque la pantalla de onboarding (§6).
> 6. Re-ejecutar `pnpm run test:db` en un stack local limpio para apartar la falla ambiental del bucket (§5.3).

## 10. Fase UI (U1–U7): vista de revisión en la consola admin

Fuente: bitácora [[odd/tasks/application-review-and-vault-deployment|§Fase UI]] (U1–U6, 2026-10-07) y re-ejecución en este árbol de trabajo (U7, 2026-10-07).

### 10.1 Cadena de entrega

La rama de #410 integró la consola `/admin` de #386 por merge `f930365` (decisión del owner, 2026-10-07) y la vista de revisión se construyó dentro de ella. Estrategia del owner: **`feature-branch-chain`**, cada work unit en una rama hija con su PR contra la rama padre inmediata. Todos los PR están **abiertos**; ninguno está mergeado y **nada de esta fase está en `main`**.

| Slice | Contenido | Commit(s) | PR | Base |
|---|---|---|---|---|
| Tracker | rama de #410 en `f930365` (borrador, no se mergea) | — | [#453](https://github.com/reyduar/Vaqcrow/pull/453) | rama de #406 |
| U1 | veredictos por documento persistidos (API, migración, contrato) | `5cdc1a6`, `af8556e` | [#454](https://github.com/reyduar/Vaqcrow/pull/454) | tracker |
| U2 | ruta `/admin/pymes/[applicationId]`, contexto y encabezado | `06dfa53`, `ea57be9` | [#455](https://github.com/reyduar/Vaqcrow/pull/455) | `-02` |
| U3 | sección «1 · KYC/KYB» y visor privado | `84a881c`, `edc160f`, `06e798a` | [#456](https://github.com/reyduar/Vaqcrow/pull/456) | `-03` |
| U4 | sección «2 · Recomendación de IA» | `dea2071`, `0fdff8d` | [#457](https://github.com/reyduar/Vaqcrow/pull/457) | `-04` |
| U5 | sección «3 · Decisión humana» y `alertdialog` | `91999f3`, `3bd54fa` | [#458](https://github.com/reyduar/Vaqcrow/pull/458) | `-05` |
| U6 | panel de despliegue de la bóveda (D3) | `398627c`, `8796cb8` | [#459](https://github.com/reyduar/Vaqcrow/pull/459) | `-06` |
| U7 | e2e del flujo admin, verificación y esta evidencia | _pendiente_ | #460 (U7) | `-07` |

El PR anterior [#452](https://github.com/reyduar/Vaqcrow/pull/452) (cierre backend-first) se mergeó en la rama de #406, no en `main`.

### 10.2 Decisiones del owner de la fase UI

| # | Pregunta | Resolución | Fuente |
|---|---|---|---|
| D7 | ¿Cómo se comporta «Límite aprobado (ARS)» si el admin no ingresa límites (D4)? | **Resuelta (2026-10-07):** de solo lectura, precargado con el objetivo declarado por la PyME (`company.goalArs`), enviado como `approvedLimitArs` al aprobar. El contrato no cambia. | Bitácora §Decisiones |
| D8 | ¿Los veredictos por documento («Válido / Pedir / Inválido») se persisten? | **Resuelta (2026-10-07):** sí, con tabla nueva (RLS on, escritura sólo `service_role`), endpoint ADMIN y actor tomado del principal verificado. | Bitácora §Decisiones |

### 10.3 Migración remota

`20261007130000_create_document_verdict` (U1) se probó primero en el stack local (pgTAP `supabase/tests/document_verdict.sql` **34/34**) y luego, con autorización explícita del owner, se **aplicó al proyecto remoto el 2026-10-07** vía el MCP de Supabase. Verificado entonces: RLS on, 0 policies, grants sólo `service_role` `select`/`insert`/`update`, PK/FKs/checks presentes, historial de migraciones alineado con la versión del repositorio y advisors sin hallazgos nuevos (sólo el INFO de RLS-sin-policy del patrón `service_role`-only). **Fuente:** bitácora U1; **no se re-verificó el remoto en U7.**

### 10.4 Verificación re-ejecutada en este árbol de trabajo (U7, 2026-10-07)

Rama `…vault-08-verification-evidence` (contiene U1–U6), Node `v24.21.0`. Todo con dobles: ningún comando de U7 tocó Supabase remoto, Testnet, Horizon, el LLM ni Resend.

**E2E del flujo admin (nuevo, `apps/web/e2e/admin-review.spec.ts`).** Corre contra el doble de la API (`e2e/support/stub-admin-review-routes.mjs`, enganchado en `stub-api-server.mjs`) y el doble de Supabase Auth (`stub-supabase-server.mjs`, que suma `POST /__seed-admin` para crear un `ADMIN` confirmado, como el seed manual del super admin). Las formas de respuesta siguen las rutas reales (`admin-review-context.route.ts`, `document-verdict.route.ts`, `human-decision.route.ts`, `campaign-deployment.route.ts`, `storage.route.ts`, cola `GET /sme-requests`); el doble exige un Bearer y rechaza con `400` un body de decisión que no tenga exactamente `{ decisionId, outcome, reason, approvedLimitArs }`.

```sh
$ pnpm --filter @vaqcrow/web exec playwright test admin-review.spec.ts
  ✓ an admin opens an application from the queue, reviews it, approves it and sees the vault deployment
  ✓ a decision recorded elsewhere while the form is open is refused with 409 and nothing is claimed
  ✓ an already-approved application opens read-only with its deployment state
  3 passed

$ pnpm --filter @vaqcrow/web exec playwright test      # suite e2e completa
  44 passed (1.1m)
exit 0
```

Qué prueba el primer escenario, en un Chromium real: el admin ingresa por `/admin` → cola `/admin/pymes` → «Revisar solicitud» → encabezado «Revisión: Panadería Horizonte SRL» y las secciones «1 · KYC/KYB», «2 · Recomendación de IA» y «3 · Decisión humana»; marca «Válido» en «Constancia de CUIT» (`aria-pressed` pasa a `true` tras persistir); «Abrir Foto 1» hace un `GET /storage/uploads?path=…` con `Authorization: Bearer` y abre una pestaña nueva en un `blob:` (nunca una URL pública); el límite muestra «12.000.000» de solo lectura (D7); una razón de menos de 10 caracteres se rechaza en línea sin abrir el diálogo; el `alertdialog` dice «Aprobada con límite ARS 12.000.000. Queda atribuida a Admin Vaqcrow…»; tras «Confirmar», la línea `role="status"` «Registrada por Admin Vaqcrow · … · Aprobada» viene del servidor, el body enviado tiene exactamente las cuatro claves (sin `actor`) y los veredictos quedan deshabilitados; el panel de despliegue muestra «Despliegue fallido» con el motivo honesto de la tasa ausente, **Reintentar** lo lleva a «Bóveda confirmada / PyME publicada» y **Ver detalle** muestra el ID de campaña. El segundo escenario prueba el `409 state_conflict` honesto («Esta solicitud ya tiene una decisión registrada. No se registró tu decisión.») y la recarga al registro real; el tercero, la apertura de solo lectura de una solicitud ya aprobada.

**Gate completo.**

```sh
$ pnpm run verify          # 1.ª corrida
 @vaqcrow/web:test:  Test Files  2 failed | 179 passed (181)
 @vaqcrow/web:test:       Tests  2 failed | 1799 passed (1801)
exit 1

$ pnpm run verify          # 2.ª corrida, sin cambios entre ambas
lint            Tasks: 5 successful, 5 total   (0 errores, 1 warning preexistente `_request` en apps/web)
typecheck       Tasks: 8 successful, 8 total
test            domain 120 · contracts 545 · ai 143 · api 2151 (95 archivos) · web 1801 (181 archivos)
build           Tasks: 5 successful, 5 total
boundaries      ✔ no dependency violations found (925 modules, 2995 dependencies cruised)
test:boundaries Test Files 10 passed (10) · Tests 164 passed (164)
exit 0
```

Las dos fallas de la primera corrida fueron **timeouts de 5 s** bajo la carga paralela de turbo (`auth-screen.test.tsx` «renders the template's two panels in signup mode» y `pyme-onboarding-wizard.test.tsx` «persists the company and then sends the request from step 4»), en archivos que U7 no toca; la segunda corrida, sin cambios, da **exit 0**. Es la inestabilidad conocida del gate bajo carga, no una regresión de esta fase.

**No re-ejecutado en U7:** `pnpm run test:db` (U7 no cambia el esquema; la última corrida registrada es la de U1) ni nada contra el proyecto remoto.

### 10.5 Mapeo de criterios de aceptación (vigente)

| # | Criterio (verbatim, issue #410) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The review view reproduces sections 1 to 3, validations and the confirmation dialog, on real applications." | ⚠️ **PARCIAL.** La vista `/admin/pymes/[applicationId]` reproduce las secciones 1–3 del template, la validación de la razón (≥ 10, error en línea) y el `alertdialog` de confirmación, y se ejercitó en un navegador real (e2e de U7). Lo que falta para «on real applications»: sólo se probó con **dobles** (unitarias de U2–U6 y el e2e contra el stub), nunca contra la API desplegada ni con una solicitud real; y hay diferencias nombradas con el template (sin fecha «enviada el…» ni «corr» porque la API no los expone, copy no diseñada pendiente del owner, §10.6). | E2E y `verify` re-ejecutados (§10.4); bitácora U2–U6 |
| 2 | "Per-document verdicts, the human decision with reason and limit, and the audit entry are persisted and attributed." | ✅ **CUMPLIDO en la rama.** Veredictos por documento persistidos en `public.document_verdict`, atribuidos al admin verificado (`actor` + `actor_user_id`), idempotentes (U1; migración aplicada al remoto). La decisión con razón y límite (D7) se registra vía el RPC `record_human_decision` atribuida al principal verificado; la UI nunca envía `actor` (lo prueban la suite web y el e2e). La entrada de auditoría es la de la decisión humana (§7, criterio 2); el `audit_log` genérico sigue sin consumidores (`apps/api/src/index.ts`, `void auditLog`). | Suites API/web re-ejecutadas; e2e re-ejecutado; bitácora U1/U5 |
| 3 | "Approval deploys exactly one vault with the PyME's public key as immutable destination, then publishes the campaign; a replayed approval does not redeploy." | ✅ **CUMPLIDO** (sin cambios respecto de §7). El panel de U6 sólo lee y reintenta; no agrega otro camino de despliegue. U8 suma «Desplegar» y el reclamo de un intento abandonado sobre el mismo `POST …/deployment`, también sin otro camino. | Suite API re-ejecutada (2151); bitácora T5b/U6 |
| 4 | "Changes-requested, rejection and approval notify the PyME; a pending deployment notifies admins." | ⚠️ **PARCIAL** (sin cambios). `admin.pending_transaction` **sigue sin productor**. | Lectura de código; bitácora T4a/T5b |
| 5 | "The AI recommendation never approves or transfers funds." | ✅ **CUMPLIDO.** La sección 2 («Consultiva · no aprueba») no tiene ningún control; sólo la decisión humana confirmada escribe. | Suite web re-ejecutada; bitácora U4 |
| 6 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Además de §7: fallos de la UI con copy honesta (409 decidido/no editable, 404, 503/red sin afirmar registro, despliegue fallido con Reintentar, lectura de despliegue fallida), cubiertos por unitarias de U3–U6 y por el e2e (409 y despliegue fallido → confirmado). | Suites y e2e re-ejecutados (§10.4) |
| 7 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ⚠️ **PARCIAL.** D1–D8 decididas por el owner. **Excepciones nombradas:** el campo de plazo del wizard sigue abierto, y la fase UI dejó copy y estados no diseñados (vacíos, errores, ubicación del panel de despliegue, filas de fotos) implementados de forma mínima y neutral **a confirmar por el owner** (§10.6). No se afirma que estén decididos. **Actualización U13 (2026-10-08):** el campo de plazo **dejó de estar abierto**: el owner decidió una duración de 30/60/90 días elegida en el wizard, con el deadline calculado al desplegar (§10.6, 8); sólo su copy queda a confirmar. | Bitácora U2–U6, U13 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Los dobles e2e usan datos sintéticos y una clave publicable falsa; la contraseña del admin e2e es un literal de prueba contra el doble local, no una credencial real; el panel dice Testnet y «sin valor económico». | Revisión de este documento y de `apps/web/e2e/` |

### 10.6 Preguntas abiertas consolidadas (U2–U6)

1. **`deploying` trabado sin salida.** `apps/api/src/application/use-cases/deploy-approved-campaign.ts:122-126` rechaza un nuevo intento mientras la fila está en `deploying` (`unavailable`) y no hay timeout de «trabado» ni en la API ni en la UI: si el proceso muere a mitad de despliegue, el panel sondea indefinidamente sin ofrecer Reintentar.
   > [!info] Resuelto por U8 (2026-10-07, rama `…vault-09-stale-deployment-recovery`, commit pendiente)
   > Un `deploying` sin actualizarse durante más de 10 minutos (constante `DEPLOYMENT_STALE_AFTER_MS` en `apps/api/src/application/use-cases/deployment-staleness.ts`, reloj inyectable) se reclama con un `UPDATE` condicional (`state = 'deploying'`, los `attempts` leídos y `updated_at < corte`); un intento fresco responde `409 deployment_in_progress` en lugar de `503`; `GET …/deployment` expone `retryable` y el panel ofrece Reintentar con copy «Despliegue sin finalizar». Reclamar no duplica el despliegue porque `openCampaign` adopta la bóveda ya desplegada en la dirección determinista, y las escrituras terminales (`markConfirmed`/`markFailed`) sólo aplican si la fila sigue en `deploying` con el `last_correlation_id` del intento: un intento superado no pisa el resultado ni notifica. Sin migración. Verificado con unitarias de adaptador, caso de uso y ruta re-ejecutadas en el árbol de trabajo (`pnpm --filter @vaqcrow/api test` → 2178 passed) y `pnpm run verify` exit 0; sólo contra dobles, sin Supabase remoto ni Testnet.
2. **No hay acción explícita «Desplegar».** D3 sólo define Reintentar tras un fallo. Si el disparo fire-and-forget falla antes de crear la fila, el panel muestra «Todavía no hay un despliegue registrado…» con «Actualizar» y el admin queda sin acción, aunque `POST …/deployment` lo admitiría.
   > [!info] Resuelto por U8 (2026-10-07, misma rama, commit pendiente)
   > Con la revisión aprobada y `GET …/deployment` en 404, el panel ofrece **Desplegar** (el mismo `POST`, uno a la vez, «Desplegando…» deshabilitado). Verificado con la suite web re-ejecutada (`pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → 1815 passed) y un escenario e2e nuevo contra el doble (`pnpm --filter @vaqcrow/web exec playwright test admin-review.spec.ts` → 4 passed).
3. **La API no expone fecha de envío ni correlation ID** al contexto: el encabezado omite «enviada el dd/mm/aaaa» y el pie de IA omite «corr …» en vez de inventarlos (cambio de API/contrato si el owner los quiere).
4. **Copy no diseñada por el template**, implementada mínima y neutral, a confirmar: estados cargando/no encontrada/error de la vista (U2); mensajes de veredicto y visor (U3); textos de anomalías, evidencia de razones, riesgo bajo/alto (U4); errores de validación, nota del límite D7, vista de solo lectura (U5); título, ubicación, mensajes por estado y detalle del panel de despliegue (U6).
5. **Decisiones de presentación a confirmar:** «Contrato social» (template) vs «Estatuto» (wizard); si las fotos llevan veredicto o sólo visor; fila «Documento de identidad» sin archivo; tono verde de «Válido»/«Aprobar con límite» frente a `demo-ui.md` §2.
6. **«PyME publicada» sin marketplace.** El rótulo D3 se muestra en `confirmed`, pero la publicación en el marketplace (#414) no existe todavía; sólo la notificación `pyme.approved_published`.
7. **Trazabilidad al ledger.** El detalle muestra el `campaignId` interno; el contract id y el hash de la transacción no viajan por este endpoint, así que no hay enlace verificable al explorador.
8. **Campo de plazo del wizard (criterio 7).** Abierto desde T5a (el template no lo diseña).
   > [!info] Resuelto por U13 (2026-10-08, rama `…vault-13-campaign-duration`, commit pendiente)
   > Decisión del owner (opción a): la PyME elige **30, 60 o 90 días** en el paso 2; se persiste en `businesses.campaign_duration_days` (migración `20261008120000_add_business_campaign_duration.sql`, `smallint` nullable con `check in (30, 60, 90)`, sin cambios de grants/RLS) y el `deadline` de la bóveda se calcula **al desplegar**: momento del intento (truncado a segundos) + días; un reintento cuenta desde ese reintento y una bóveda ya desplegada se adopta con su deadline on-chain. Sin duración se usa el `deadline` legado de T5a; sin ninguno, `terms_unavailable`. Verificado: migración local + `pnpm run test:db` (`businesses_ownership.sql` ok; la falla preexistente de `pyme_documents_bucket.sql` sigue), `pnpm --filter @vaqcrow/api test` → 2227 passed, `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → 1833 passed, `playwright test` → 45 passed, `pnpm run verify` exit 0 (en la 2.ª corrida; la 1.ª cayó por 3 timeouts de web en archivos ajenos), todo re-ejecutado en el árbol de trabajo. En vivo (perfil docker, red Stellar local, no Testnet), dos corridas del ensayo `admin-review.live.spec.ts` (J `6f1b61cc`, K `bfa51d62`): el **primer** intento de despliegue confirmó (`attempts: 1`, sin el atajo del deadline por psql, retirado) y el `deadline` on-chain fue exactamente el segundo de la aprobación + 90 días (bóvedas `CAKZHNQR…MGS6` y `CAU2AX3Z…JD55`). **Pendiente:** la copy del campo (no diseñada, a confirmar por el owner) y aplicar la migración al proyecto remoto con autorización del owner.

### 10.7 Estado de entrega y próximos pasos

> [!important] Fábrica con tope desplegada en Testnet — **no activa** (2026-10-08)
> - Fábrica nueva `CCDNM6W4UHEYL27Y2YLDVINPV2DKXBE5FVZD6HSEFK2K7LF5V6WMSV7J`, leída de la red: `owner` = `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG` (la clave de plataforma, el mismo `owner` de la fábrica anterior) y `vault_wasm` = `966f5b89c1f690488e87bb550a69dac7a8b1e6a84261be867ef98b9b9895dce4` (wasm con el tope `goal/10` de T3b; build reproducible, 8.708 bytes).
> - Transacciones: upload `b2eec2379a2618fae57e8807a27b60167ccfd3cba17ef1520cbcee0b4a208df9`, deploy `2b63249f7771e29b46439780d3f39dae9841835a66a5f78e49f5ba67dc36cf92`. Pagó las fees la identidad CLI `vaqcrow-factory-deployer` (`GCOSKYEK2FB3YPK4MRXUDR6NNSNZOICFLNQATKSGCYUXV2WJIGJ5FI3N`, fondeada con Friendbot); el comando lo ejecutó el owner.
> - **Por qué no está activa:** Railway construye la API desde `main` (`6b9acbe`), que todavía tiene el recorrido guionado donde un solo inversor aporta el objetivo completo (`apps/web/e2e-live/campaign-vault.live.spec.ts:130`). Con el tope, ese aporte se rechaza con `Error(Contract, #10)`. El owner re-apuntó `STELLAR_CAMPAIGN_FACTORY_ID` en Railway y lo **revirtió** a la fábrica anterior `CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ` el mismo día, El deploy con la fábrica nueva (`8a3002b4`) estuvo activo unos 52 s (11:16:31–11:17:24 UTC) sin recibir ninguna petición HTTP (logs de Railway), hasta que lo reemplazó el deploy con la fábrica anterior (`870c3a1e`, `SUCCESS`): ninguna campaña se abrió contra la fábrica nueva.
> - **Cuándo activarla:** cuando la pila llegue a `main` con #438 (el recorrido por roles respeta el tope), re-apuntar `STELLAR_CAMPAIGN_FACTORY_ID` a `CCDNM6W4…SV7J` en Railway. Tras el reset de Testnet del 2026-12-16 hay que redesplegarla otra vez.

- **Nada de #410 está en `main`.** La cadena U1–U7 vive en ramas hijas con PR abiertos contra su padre inmediato; el merge a `main` sigue atado a la Opción A del owner (pila junto con el retiro del recorrido de seis pasos, #438).
- La Feature #410 sigue **abierta**; su cierre lo decide el owner.

> [!todo] Pendientes tras la fase UI
> 1. Ejercitar la vista contra la API desplegada con una solicitud real (cierra la parte «on real applications» del criterio 1), sin Testnet real salvo autorización explícita.
> 2. Decidir el `deploying` trabado (timeout o acción de recuperación) y si existe un «Desplegar» explícito (§10.6, 1–2). _Resuelto por U8 (§10.6, 1–2); queda confirmar con el owner la copy «Despliegue sin finalizar» y el umbral de 10 minutos._
> 3. Agregar el productor de `admin.pending_transaction` (criterio 4).
> 4. Confirmar con el owner la copy y los estados no diseñados (§10.6, 4–5) y el campo de plazo del wizard (criterio 7). _El campo de plazo se resolvió en U13 (§10.6, 8); queda confirmar su copy y aplicar su migración al remoto._
> 5. Ejecutar el paso de operador de T3b (redeploy/re-apuntado de la fábrica) cuando se autorice.
