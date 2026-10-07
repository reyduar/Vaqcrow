# Bitácora — Feature #410: revisión, aprobación y despliegue de la bóveda

Rama de integración: `Vaqcrow#410_Feat_Review_applications_and_approve_to_deploy_and_publish_the_vault`.
Base: rama de integración de #406, ya reconciliada y cerrada en GitHub.

## Objetivo

Entregar la revisión admin de una solicitud real —evidencia KYC/KYB, recomendación consultiva de IA y decisión humana— y hacer que «Aprobar con límite» dispare exactamente un despliegue de bóveda firmado por la plataforma, con la clave pública de la PyME como destino inmutable, seguido de la publicación de la campaña cuando Testnet confirme.

## Problema y por qué

La pila anterior ya permite que la PyME complete la solicitud, conecte Freighter y llegue a revisión. Falta cerrar el lado humano: el admin debe inspeccionar la evidencia, registrar una decisión atribuida y convertir una aprobación en un despliegue/p publicación idempotente, sin que la IA apruebe ni Vaqcrow custodie claves.

## Alcance autorizado

- Reutilizar las rutas y puertos existentes de solicitud, assessment, decisión humana, notificaciones y campañas/vault.
- Agregar acceso admin seguro para visualizar o descargar PDFs, imágenes y fotos privadas.
- Implementar la revisión, validaciones, auditoría, despliegue idempotente, estados pendientes/fallidos y notificaciones que el owner decida.
- Mantener la firma de `factory.deploy` exclusivamente en la plataforma y el destino de la PyME inmutable.
- Actualizar tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- La IA es consultiva: nunca aprueba, calcula obligaciones ni transfiere fondos.
- No se solicitan, almacenan ni transportan seeds o claves privadas de la PyME.
- Testnet y proveedores externos quedan fuera del gate determinista; los checks PR usan dobles.
- No inventar estados, copy ni flujos que el template no diseñe sin decisión explícita del owner.
- No afirmar merge en `main` ni una rehearsal real de Testnet sin evidencia observada.

## Decisiones del owner

| # | Pregunta abierta del issue | Estado |
|---|---|---|
| D1 | ¿El admin puede inspeccionar PDFs, imágenes y fotos o sólo ver sus nombres? | **Resuelta (2026-10-06):** autorizado visor/descarga segura, con autorización admin, Storage privado y sin URLs públicas. |
| D2 | ¿Cómo se comunica «Pedir», «Requiere cambios» y «Rechazada» a la PyME? | **Resuelta (2026-10-06):** cada resultado se envía al correo registrado de la PyME y como notificación en la campana del header. Al abrirla, la app lleva al paso «Revisión humana» del wizard, donde se muestra el detalle accionable del pedido, los cambios requeridos o el rechazo. Se reutiliza #382 para email/campana; no se inventa una ruta nueva. |
| D3 | ¿Qué estados y acciones expone el review durante/después del deployment? | **Resuelta (2026-10-06):** `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada`. Un fallo muestra `Despliegue fallido`, permite **Reintentar** y ofrece **Ver detalle** en modo solo lectura. La publicación ocurre sólo después de la confirmación de Testnet. |
| D4 | ¿Qué controla «Límite aprobado» y quién define deadline/mínimo de contribución? | **Resuelta (2026-10-06):** el admin no ingresa ni modifica límites; la PyME define los términos del proyecto durante el registro. La plataforma impone un máximo de USD 50.000 equivalentes por campaña y un máximo por inversor igual al menor de 10% del objetivo y USD 5.000 equivalentes. |
| D5 | ¿Se espera a #386 antes de tocar #410? | **Resuelta (2026-10-06):** se autoriza implementar backend-first en paralelo; la integración con la consola admin queda para después de #386. |
| D6 | ¿Cómo se convierte el tope USD a ARS/XLM mientras la conversión siga simulada? | **Resuelta (2026-10-06):** tabla de tasas configurable por ADMIN, actualizada manualmente ahora y reemplazable por una fuente confiable en el futuro. Cada tasa tendrá versión, vigencia, autor, origen `manual`/`provider` y valores enteros de precisión fija; los términos de cada campaña guardarán el snapshot usado. |
| D7 | ¿Cómo se comporta «Límite aprobado (ARS)» si el admin no ingresa límites (D4)? | **Resuelta (2026-10-07):** se muestra de solo lectura, precargado con el objetivo declarado por la PyME (`company.goalArs`), y la UI lo envía como `approvedLimitArs` al aprobar. El contrato no cambia. |
| D8 | ¿Los veredictos por documento («Válido / Pedir / Inválido») se persisten? | **Resuelta (2026-10-07):** sí, de verdad: tabla nueva con RLS y escritura sólo `service_role`, endpoint ADMIN y actor tomado del principal verificado. Cierra AC2. |

## Tareas

- [x] **T0 — Resolver preguntas abiertas.** D1–D4 resueltas antes de implementar los flujos afectados.
- [ ] **T1 — Revisión admin.** Se divide en T1a backend-first (contexto de solicitud, viewer privado, KYC/KYB por documento, assessment consultivo y decisión API) y T1b integración con la consola admin después de #386.
- [ ] **T2 — Persistencia y auditoría.** Decisión atribuida al admin autenticado, transiciones condicionales e idempotencia.
- [ ] **T3 — Aprobación y vault.** Vincular la public key persistida, resolver la tasa vigente y snapshotearla en los términos, validar los términos de la PyME contra los topes duros y la regla anti-concentración, llamar al engine existente de `POST /campaigns`, evitar redeploy en replay y publicar sólo tras confirmación. Exponer `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada`, más `Despliegue fallido`, **Reintentar** y **Ver detalle** solo lectura.
- [ ] **T4 — Notificaciones y fallos.** Implementar email al correo registrado y notificación en la campana para pedido, cambios requeridos, rechazo y aprobación; al abrirla, navegar al paso «Revisión humana» con el detalle correspondiente. Resolver además los estados pending/failure sin sobreafirmar resultados.
- [ ] **T5 — Verificación y evidencia.** Suites deterministas, boundaries, evidencia en español y cierre manual de #411/#412/#413/#410.

## Checks aplicables

- `pnpm --filter @vaqcrow/api test`
- `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `pnpm run boundaries`
- `pnpm run test:boundaries`
- `pnpm run test:db` cuando una migración cambie el esquema; primero local docker y luego remoto según la política del repositorio.

## Progreso

### T1a — Visor privado de documentos para admin (commit: `62d88fb`)

- **RED.** El focused run falló inicialmente con la ruta GET sin registrar y el nuevo lookup de repositorio ausente; una ejecución adicional ejercitó una excepción del repositorio que debía degradar a `503`.
- **GREEN.** `GET /storage/uploads?path=` quedó restringido a `ADMIN`, exige descriptor persistido, descarga mediante `StoragePort`, devuelve bytes con `private, no-store`, `nosniff` y filename seguro, y mapea fallos a `400`/`404`/`503` sanitizados. POST/DELETE de PyME no cambian.
- **Verificación.** `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/routes/storage.route.test.ts src/infrastructure/adapters/supabase-pyme-document-repository.test.ts` → **40 passed**; `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/authorization.test.ts` → **251 passed**.
- **RDD.** El assess indicó `medium`/`slice_budget_reached`, pero el STATUS nativo devolvió `rdd_disabled`; no se creó autoridad de review ni se modificó la preferencia del owner. La verificación de T1a queda respaldada por RED/GREEN, tests del worker y el spot-check del padre.

### T1b — Contexto agregado de revisión admin (commit: `3cac86a`)

- **RED.** Los focused tests fallaron antes de implementar porque no existían el módulo del caso de uso ni la ruta registrada.
- **GREEN.** `GET /application-reviews/:applicationId/context` quedó restringido a `ADMIN` y compone snapshot de revisión, solicitud con owner resuelto server-side, empresa opcional, descriptores privados, assessment opcional y última decisión opcional. IDs inválidos responden `400`, recursos desconocidos `404` y fallos de dependencias `503` saneados. Las ausencias opcionales no se convierten en falsos errores.
- **Verificación.** Suite enfocada del caso de uso/ruta → **17 passed**; autorización → **258 passed**; `pnpm --filter @vaqcrow/api typecheck` → **pass**.
- **RDD.** El assess acumulado indicó `medium`/`slice_budget_reached`; el STATUS nativo volvió a devolver `rdd_disabled`, sin crear autoridad de review ni modificar la preferencia del owner.

### T3 backend-first — tabla de tasas y guardrails enteros (commit: `004f2d9`)

- **RED.** Los focused tests nuevos fallaron antes de la implementación: faltaban el módulo de validación, el adaptador y el registro HTTP; las rutas devolvían `404`.
- **GREEN.** Se agregó `fx_rate` con RLS/grants sólo para `service_role`, campos enteros (`usd_to_ars` y `stroops_per_usd`), versión primaria e índice de vigencia. `POST /admin/rates` y `GET /admin/rates/current` están restringidos a `ADMIN`, atribuyen el autor al principal verificado, serializan `bigint` como strings y mapean conflictos/fallos a errores saneados. La validación pura aplica sin floats el máximo de USD 50.000 y el máximo individual `min(10% del objetivo, USD 5.000)`.
- **Verificación observada.** `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/campaign-guardrails.test.ts src/infrastructure/adapters/supabase-rate-table-repository.test.ts src/infrastructure/http/routes/rate-table.route.test.ts` → **6 passed**; `pnpm --filter @vaqcrow/api typecheck` → **pass**; `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/authorization.test.ts src/infrastructure/http/routes/campaign.route.test.ts` → **297 passed**.
- **Límite explícito.** Este slice no conecta todavía el snapshot de tasa a `campaign` ni invoca los guardrails desde `openCampaign`/contribuciones: los contratos actuales de términos sólo transportan `goalStroops`/`deadline`, y la autoridad de vault permanece en el engine existente. La integración de aprobación, snapshot histórico y reserva atómica de contribuciones requiere el siguiente work unit con esos seams.

- **Work-unit commit.** `004f2d9 feat(api): add admin FX rate guardrails`.

### Próximo work unit — T3a: snapshot de tasa y tope de campaña

Diseño verificado contra los seams actuales:

- `campaign-vault::contribute` ya lee `goal` del storage; el tope por inversor puede aplicarse dentro de `contribute` sin cambiar el constructor ni el `deploy` de la fábrica.
- Con el objetivo acotado a USD 50.000 equivalentes, `min(10% del objetivo, USD 5.000)` equivale exactamente a `10% del objetivo`, así que el contrato no necesita la tasa para el tope individual.
- `POST /campaigns` (`openCampaign`) es el punto de creación: ahí se resuelve la tasa vigente, se valida el tope de campaña y se snapshotearla.
- `campaign` y `CampaignRecord` no tienen campos de snapshot de tasa; requieren migración y mapeo.

T3a se limita al lado servidor (determinista, sin Testnet): migración de snapshot, puerto/repositorio/mapeo, validación en `openCampaign` con la tasa vigente y preflight de concentración en la preparación de aportes.

T3b (siguiente) aplica el tope individual atómico en `campaign-vault::contribute` con tests Rust y el paso de redeploy documentado, sin afirmar Testnet sin evidencia observada.

### T3a — Snapshot de tasa y tope de campaña (server-side)

- **RED.** Los focused tests nuevos fallaron antes de implementar: **10 failed / 66 passed**. El adaptador no persistía ni leía las columnas de snapshot; `openCampaign` no resolvía la tasa ni aplicaba los guardrails; la ruta no mapeaba `rate_unavailable`/`goal_limit_exceeded` ni hacía el preflight de concentración.
- **GREEN.**
  - Migración `20261006130000_add_campaign_rate_snapshot.sql`: agrega a `public.campaign` las columnas nullable `fx_rate_version bigint`, `usd_to_ars bigint`, `stroops_per_usd bigint` y la restricción `campaign_rate_snapshot_all_or_none` (las tres NULL o las tres NOT NULL). Sin backfill, sin FK (el snapshot es una copia, no una referencia viva) y sin cambios de grants/RLS: el grant a nivel de tabla ya cubre las columnas nuevas.
  - `CampaignRecord` gana `rateSnapshot?`; el adaptador Supabase lo mapea en insert y lectura y **omite las tres columnas** cuando no hay snapshot, dejando intacto el comportamiento previo.
  - `openCampaign` resuelve la tasa vigente vía `RateTableRepositoryPort`, valida `goalStroops <= 50_000 USD * stroopsPerUsd` con los guardrails enteros existentes (sin floats) y persiste el snapshot. Los códigos saneados `rate_unavailable` (503) y `goal_limit_exceeded` (422) se mapean en la ruta, sin texto del proveedor.
  - Preflight best-effort por inversor (`min(10% del objetivo, USD 5_000)`) en la preparación de `contribute`: usa el snapshot del mirror más la contribución leída de la cadena y responde `422 investor_limit_exceeded` antes de preparar. **No es atómico** (T3b) y se omite si la campaña no tiene snapshot (campañas previas a #410) en lugar de estimarlo con la tasa vigente.
  - La respuesta HTTP no expone campos nuevos (`apps/web` y `packages/contracts` sin tocar).
- **Idempotencia preservada.** El replay (`findByApplicationId` con fila existente) y la adopción de una bóveda ya desplegada no consultan la tabla de tasas: el snapshot se resuelve sólo en el camino de deploy nuevo.
- **Verificación observada.**
  - `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/open-campaign.test.ts src/infrastructure/adapters/supabase-campaign-repository.test.ts src/infrastructure/http/routes/campaign.route.test.ts` → **76 passed** (tras el RED de 10 failed / 66 passed).
  - `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/campaign-dependencies.test.ts src/infrastructure/http/authorization.test.ts src/infrastructure/http/build-app.test.ts` → **296 passed**.
  - `pnpm --filter @vaqcrow/api typecheck` → **pass**.
  - Migración local: `supabase migration up --local` aplicó `20261006120000_create_fx_rate` y `20261006130000_add_campaign_rate_snapshot`; `pnpm run test:db` → 13/14 archivos ok, con `campaign_persistence.sql` **ok**. Falla ambiental **preexistente y ajena** en `pyme_documents_bucket.sql` (subtests 9, 16, 18: `have: 9, want: 3`) por 6 objetos preexistentes en el bucket local `pyme-documents` creados 2026-10-06 01:41–02:25 UTC, antes de este work unit; la migración de `campaign` no participa de ese conteo. No se aplicó ninguna migración remota ni se tocó Testnet.
- **Límite explícito.** El tope individual sólo se verifica best-effort en la API (UX); la aplicación atómica y autoritativa queda en `campaign-vault::contribute` (T3b).

- **Work-unit commit.** `fc0673b feat(api): snapshot campaign FX rate and enforce goal cap`.

### T3b — Tope individual atómico en `campaign-vault::contribute`

- **RED.** Se agregaron tests Rust que ejercitan el tope (exactamente en el tope, un stroop por encima y una segunda contribución del mismo inversor que lo excede) y se corrieron desde `contracts/`. El run falló al compilar con `error[E0599]: no variant, associated function, or constant named `InvestorCapExceeded` found for enum `Error`` (dos ocurrencias, `campaign-vault/src/test.rs:226` y `:252`). Ese error de compilación por la variante inexistente es la señal RED esperada; no hubo un fallo de aserción previo.
- **GREEN.**
  - `Error` gana la variante **apendizada** `InvestorCapExceeded = 10`; las variantes 1–9 no se reordenan ni renumeran (sus códigos son ABI público).
  - `contribute` lee `goal` y rechaza con esa variante cuando `previous + amount > goal / 10`, **antes de cualquier escritura de estado o transferencia**. El orden effects-before-interactions y el resto del comportamiento no cambian.
  - El comentario del contrato deja explícito el razonamiento: con el objetivo acotado a USD 50.000-equivalentes en la creación (#410/T3a), `min(10% del objetivo, USD 5.000)` se reduce exactamente a `10% del objetivo`, así que el contrato no necesita la tasa FX.
  - No se tocó la firma del constructor ni los argumentos de `factory::deploy`; no se tocaron `apps/api` ni `apps/web`.
- **Verificación observada.**
  - `cargo test` (desde `contracts/`) → **39 passed; 0 failed** (`campaign-factory` 3 + `campaign-vault` 36). Los cuatro tests nuevos del tope y los cinco de liquidación reescritos pasan.
  - `stellar contract build` (desde `contracts/`) → **build completo**. `campaign_vault.wasm` optimizado 8.708 bytes, sha256 `966f5b89c1f690488e87bb550a69dac7a8b1e6a84261be867ef98b9b9895dce4`.
  - Los tests de liquidación se reescribieron para llegar al objetivo con diez inversores distintos (el tope lo exige); `GOAL` de test subió a `10_000` y su tope es `1_000`. `cargo test` regeneró los snapshots versionados de `contracts/campaign-vault/test_snapshots/`, un reflejo determinista del nuevo objetivo y de los flujos de liquidación (por ejemplo, la entry del goal pasa de `i128: 1000` a `i128: 10000`).
- **Paso de operador para Testnet (documentado, NO ejecutado).** El hash del wasm de la bóveda cambió, así que una fábrica ya desplegada seguiría creando bóvedas con el wasm viejo, sin tope. La fábrica guarda `VaultWasm` en el constructor y no tiene setter: para hacer efectivo el tope hay que **redesplegar la fábrica apuntando al wasm nuevo** (`966f5b89…`) y **re-apuntar `STELLAR_CAMPAIGN_FACTORY_ID`**, con el mismo procedimiento que tras un reset de Testnet (`contracts/README.md`). Las bóvedas ya desplegadas conservan su wasm y no adquieren el tope. No se ejecutó ningún despliegue, redeploy ni publicación en este work unit.
- **Límite explícito.** T3b es sólo el guardrail on-chain autoritativo; la integración con el flujo de aprobación (`T1`/`T2`), las notificaciones (`T4`) y la consola admin (#386) siguen pendientes.

- **Work-unit commit.** `53621e0 feat(contracts): cap investor contribution at a tenth of the goal`.

## T4a — Notificaciones de decisión a la PyME (backend-first)

Diseño verificado contra los seams actuales:

- El catálogo tenía `pyme.changes_requested` y `pyme.approved_published`, pero **no** `pyme.rejected`, y `NOTIFICATION_AUDIENCE` resolvía por rol: un evento `pyme.*` se repartía a **todas** las PyME, no a la dueña de la solicitud.
- `SmeRequestRepositoryPort.findByApplicationId` devuelve `ownerUserId`, el destinatario correcto.
- `NotificationPublisher` ya hacía entrega best-effort con email por el mismo port.

- **RED.** Los focused tests nuevos fallaron antes de implementar: **14 failed / 103 passed (5 archivos)**. Fallos observados: `renderInApp("pyme.rejected")` y `renderEmail` del mismo evento lanzaban `unhandled notification event type` desde `assertNever`; la completitud del catálogo fallaba al comparar 14 eventos contra 13; `SupabaseNotificationRepository.resolveRecipientsByUserIds is not a function`; el publisher no direccionaba (llamaba al path por rol); `recordHumanDecision` no publicaba en `changes_requested`/`rejected` aplicados (2 tests); la ruta de decisión no componía las dependencias de notificación.
- **GREEN.**
  - Direccionamiento explícito: `NotificationRepositoryPort.resolveRecipientsByUserIds(userIds)` resuelve **sólo** los perfiles activos entre los ids indicados y une sus emails de Auth (mismo `joinRecipients` que el path por rol; input vacío o sin match es `ok` con lista vacía, fallo del proveedor es `unavailable`). `NotificationEvent` gana `recipientUserIds?`; el publisher usa el path direccionado cuando está presente y el path por rol (sin cambios) cuando no. `admin.new_application` sigue por rol.
  - Evento faltante: `pyme.rejected` agregado a `NOTIFICATION_EVENT_TYPES`, `NotificationPayload`, `NOTIFICATION_AUDIENCE` (PYME) y `renderInApp` (título «Tu solicitud fue rechazada», copy español y CTA «Ver mi campaña» → `/company`). Copy sigue **pendiente del owner** como el resto del catálogo.
  - Publicación en la decisión: `recordHumanDecision` acepta un tercer colaborador opcional (`smeRequests` + `notifications`) y, sólo en un apply real, publica `pyme.changes_requested` / `pyme.rejected` direccionado al `ownerUserId` con `eventKey application:<applicationId>:decision:<decisionId>:<outcome>`. `approved` **no** publica aquí (pertenece al unit de despliegue/publicación, D3). El replay (`applied: false`) no publica; un owner no resuelto, un lookup caído o un publisher que lanza **nunca** fallan la decisión. Si el owner no se resuelve, se omite la notificación en lugar de difundir a todas las PyME.
  - Wiring: `registerHumanDecisionRoute` acepta las dependencias opcionales; `build-app` expone `humanDecisionNotifications` y `index.ts` compone `smeRequestRepository` + `notificationPublisher`. La forma y el mapeo de estados de la respuesta de decisión no cambian.
  - Los dobles de test que implementan `NotificationRepositoryPort` (`notification-publisher.test.ts`, `notification.route.test.ts`, `build-app.test.ts`) se actualizaron sólo para el nuevo método requerido.
- **REFACTOR.** `joinRecipients` se extrajo para compartir la unión perfil→email entre ambos paths, y el log de `listEmailsById` dejó de nombrar una operación específica de rol. Tests enfocados siguen verdes.
- **Verificación observada.**
  - RED: `pnpm --filter @vaqcrow/api exec vitest run <5 archivos>` → **14 failed / 103 passed**.
  - GREEN: `pnpm --filter @vaqcrow/api exec vitest run <7 archivos>` → **149 passed**; con `authorization.test.ts` → **421 passed (8 archivos)**.
  - `pnpm --filter @vaqcrow/api typecheck` → **pass**.
- **Límite explícito.** Fuera de T4a (documentado, no implementado): la notificación de **aprobación/publicación** pertenece al unit de estados de despliegue (D3), y la navegación de la campana al paso «Revisión humana» es UI (#386). No se tocaron contratos Rust, `apps/web`, `packages/contracts`, Testnet ni migraciones (remotas o locales).

- **Work-unit commit.** `50fc044 feat(api): notify PyME owner of decision outcomes`.

## T5a — Deadline de la PyME persistido (backend-first)

Diseño verificado contra los seams actuales:

- Hallazgo: el template de onboarding (`Vaqcrow Onboarding PyME.dc.html`) diseña solo «Meta de financiamiento (ARS)» y «Revenue share propuesto (%)»; **no diseña un campo de plazo**, y `businesses` hoy guarda `goal_ars` y `revenue_share` pero ningún deadline. `openCampaign` recibe el deadline por el body de `POST /campaigns`.

Decisión del owner (2026-10-06): la PyME define el deadline (opción 2). Se registra como decisión explícita que **excede lo que el template diseña**; el campo del wizard queda como pregunta abierta para cuando se toque esa pantalla y **no se inventa UI ahora**.

Alcance de T5a (backend-first, sin UI):
1. Migración local: `deadline timestamptz` nullable en `public.businesses`, sin backfill.
2. El comando/registro de empresa acepta `deadline` opcional (ISO), lo persiste y lo lee; el comportamiento previo queda intacto cuando falta.
3. Tests deterministas; no se tocan `apps/web` ni `packages/contracts`.

- **RED.** Los focused tests nuevos fallaron antes de implementar: **12 failed / 47 passed (3 archivos)**. Fallos observados con salida real: `validateBusinessDraft` rechazaba `deadline` como clave desconocida (`{ field: "body", code: "invalid" }`); `createBusiness` no llegaba al repositorio con un deadline; el adaptador no persistía ni leía la columna; la ruta respondía `400` con cuerpo inválido en lugar de `201` (deadline válido) o `{ field: "deadline", code: "invalid_format" }` (malformado).
- **GREEN.**
  - Migración `20261006140000_add_business_deadline.sql`: `deadline timestamptz` nullable con `add column if not exists`, sin backfill, sin FK y sin cambios de grants/RLS — el grant a nivel de tabla ya cubre la columna nueva y RLS sigue enabled / zero policies / `service_role`-only. Comentario de reversión incluido.
  - `BusinessDraft`/`BusinessRecord` ganan `deadline?: string | null` (`null`/ausente = ninguno).
  - `validateBusinessDraft` acepta `deadline` opcional como ISO 8601 con offset explícito (`Z` o `±HH:MM`; regex más round-trip de `Date.parse` para rechazar fechas imposibles) y devuelve `{ field: "deadline", code: "invalid_format" }` saneado para cualquier valor provisto que no sea válido; `null`/ausente lo omite, dejando el comportamiento previo intacto. `createBusiness` lo pasa a través sin cambios.
  - El adaptador Supabase inserta `deadline` sólo cuando viene (omitir la columna deja NULL) y lo lee de vuelta sólo cuando es string; un valor no-string en disco se degrada a `unavailable` (fila malformada).
  - `business.route.ts` no cambió: la validación vive en el caso de uso, así que el deadline válido fluye a `201` y el malformado a la forma saneada `400 { errors: [{ field, code }] }` ya existente.
- **REFACTOR.** Sin refactor adicional; el diff es mínimo y sigue el patrón de columna opcional del snapshot de tasa de T3a (`...(absent ? {} : { ... })`).
- **Verificación observada.**
  - RED: `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/business.test.ts src/infrastructure/adapters/supabase-business-repository.test.ts src/infrastructure/http/routes/business.route.test.ts` → **12 failed / 47 passed**.
  - GREEN: mismo comando → **59 passed (3 archivos)**; suite completa `pnpm --filter @vaqcrow/api test` → **1996 passed (88 archivos)**.
  - `pnpm --filter @vaqcrow/api typecheck` → **pass**.
  - Migración local: `supabase migration up --local` aplicó `20261006140000_add_business_deadline.sql`; la columna quedó verificada como `timestamp with time zone` nullable y los grants de `service_role` intactos (`select`/`insert`/`update`, sin `delete`). `pnpm run test:db` → 13/14 archivos ok, con `businesses_ownership.sql` **ok**; falla ambiental **preexistente y ajena** en `pyme_documents_bucket.sql` (subtests 9, 16, 18: `have: 9, want: 3`, los mismos objetos locales preexistentes de T3a). No se aplicó ninguna migración remota ni se tocó Testnet.
- **Límite explícito.** Backend-first: no se tocó `apps/web` ni `packages/contracts`; el campo de plazo del wizard queda como pregunta abierta y no se inventó UI. T5b conecta aprobación→deploy desde los términos persistidos (goal ARS→stroops vía la tasa, deadline del negocio, public key del wallet), publica `pyme.approved_published` tras la confirmación y expone los estados de despliegue.

- **Work-unit commit.** `d5a8e2a feat(api): persist the PyME campaign deadline`.

## Próximo paso

T5a quedó implementado (deadline persistido backend-first). Sigue T5b (aprobación→deploy + estados y notificación de publicación tras la confirmación de Testnet). Falta además el paso de operador de T3b (redesplegar/re-apuntar la fábrica) y el campo de plazo del wizard.

## Migraciones aplicadas al proyecto remoto (2026-10-06/07)

Autorizado por el owner, se aplicaron al proyecto remoto Supabase las tres migraciones que estaban solo en local y se verificó esquema, grants/RLS e historial:

- `20261006120000_create_fx_rate` — tabla `fx_rate` con RLS y grants `service_role` (`select`/`insert`, sin `update`/`delete`); `anon`/`authenticated` sin acceso.
- `20261006130000_add_campaign_rate_snapshot` — columnas nullable y constraint `campaign_rate_snapshot_all_or_none` presentes.
- `20261006140000_add_business_deadline` — `businesses.deadline timestamptz` nullable; grants de `businesses` intactos (`select`/`insert`/`update`, sin `delete`).
- `20261006150000_create_campaign_deployment` — tabla `campaign_deployment` con RLS y `service_role` `select`/`insert`/`update` (sin `delete`), PK, FK a `application_review` `on delete restrict`, checks de `state`/`attempts` y trigger de `updated_at`; `anon`/`authenticated` sin acceso.

El CLI no está linkeado al remoto y `.env.cloud` no trae la contraseña de base, así que se aplicaron vía el MCP de Supabase. El MCP registra un version generado; cada version se alineó al del repositorio con un `update` sobre `supabase_migrations.schema_migrations`, de modo que el historial remoto coincide exactamente con `supabase/migrations/`. Los advisors de seguridad no reportan hallazgos nuevos (el INFO de RLS-sin-policy es el patrón service_role-only ya usado por todas las tablas).

## Próximo work unit — T5b: aprobación → deploy con lifecycle persistido

Decisión del owner (2026-10-06): modelo 2, lifecycle persistido observable.

Contrato:

- Tabla `public.campaign_deployment` (una fila por aplicación): `application_id` PK, `state` (`pending`/`deploying`/`confirmed`/`failed`), `attempts`, `last_error` (código saneado, nunca texto del proveedor), `campaign_id` nullable, `last_correlation_id`, timestamps; RLS on y `service_role` select/insert/update.
- Puerto + adaptador `CampaignDeploymentRepositoryPort` con `findByApplicationId`, `markPending` (idempotente), `beginAttempt`, `markConfirmed`, `markFailed`.
- Caso de uso `deployApprovedCampaign`: sólo con la aplicación aprobada; resuelve owner (`sme_request`), términos del negocio (deadline requerido; `goal_ars`→stroops vía la tasa vigente con los guardrails enteros de T3a), public key del wallet; llama al engine existente `openCampaign` (idempotente); en éxito marca `confirmed` + publica `pyme.approved_published` a la PyME; en fallo marca `failed` con código saneado. Replay de `confirmed` no redespliega.
- Endpoints ADMIN: `POST /application-reviews/:applicationId/deployment` (desplegar/reintentar) y `GET /application-reviews/:applicationId/deployment` (detalle de sólo lectura).
- Disparo: una decisión `approved` aplicada marca `pending` y avanza el deploy best-effort, sin bloquear ni romper la respuesta de la decisión.

Fuera de T5b: la consola admin (#386) que muestra los estados, y el listado de marketplace (#414).

### T5b — Aprobación → deploy con lifecycle persistido (backend-first)

- **RED.** Los focused tests nuevos fallaron antes de implementar: **16 failed / 23 passed (4 archivos)**. Módulos `deploy-approved-campaign` y `supabase-campaign-deployment-repository` inexistentes; las rutas `/application-reviews/:id/deployment` respondían 404; el disparo de deploy no existía; y la matriz de autorización sumó **16 failed / 296 passed** en `authorization.test.ts`, más el caso nuevo de la ruta de decisión. Total RED observado: 33 fallos.
- **GREEN.**
  - Migración local `20261006150000_create_campaign_deployment.sql`: tabla `public.campaign_deployment` con `application_id` PK → `application_review(application_id) on delete restrict`, `state` (`pending`/`deploying`/`confirmed`/`failed`), `attempts`, `last_error`, `campaign_id`, `last_correlation_id`, timestamps y trigger de `updated_at`; RLS on, cero policies y `service_role` select/insert/update (sin delete); comentario de reversión. Aplicada localmente (`supabase migration up --local`) y cubierta por el pgTAP nuevo `supabase/tests/campaign_deployment.sql` → **27/27**; aplicada también al remoto y verificada.
  - Puerto + adaptador `CampaignDeploymentRepositoryPort`: `markPending` es insert-if-absent (una violación única devuelve la fila existente; nunca pisa una confirmada); `beginAttempt` lee estado/attempts y hace el UPDATE condicional `state in ('pending','failed')`, así un intento concurrente no puede duplicar el incremento; `markConfirmed` fija `campaign_id`; `markFailed` guarda sólo el código saneado. Los errores de Postgres colapsan a `unavailable` sin texto del proveedor.
  - Caso de uso `deployApprovedCampaign`: sólo `approved`; el replay de `confirmed` devuelve la fila sin redesplegar ni notificar; resuelve owner (`sme_request`), deadline y `goal_ars` del negocio, y la public key del wallet; convierte ARS→stroops con enteros (ver desvío) y valida con `validateCampaignGuardrails`; llama a `openCampaign`; en éxito `markConfirmed` y publica `pyme.approved_published` direccionado al owner con `eventKey application:<id>:deployment:confirmed`; en fallo `markFailed` con código saneado. Deadline ausente, empresa ausente, clave ausente y tasa inusable son fallos saneados, nunca excepciones; un `markFailed` que falla no cambia el resultado.
  - HTTP ADMIN: `POST /application-reviews/:applicationId/deployment` y `GET /application-reviews/:applicationId/deployment` (detalle de sólo lectura con `lastError`/`campaignId`, sin `lastCorrelationId`), registrados en `route-policy.ts`, `build-app.ts` e `index.ts`.
  - Disparo: `recordHumanDecision` acepta un cuarto colaborador opcional `DecisionDeploymentDependencies`; en un apply `approved` invoca `onApproved` sin esperarlo (fire-and-forget) y traga rechazos/throws, así que nunca bloquea ni rompe la respuesta de decisión. La ruta pasa el colaborador; `index.ts` compone `deployApprovedCampaign`.
- **DESVÍO DOCUMENTADO (conversión ARS→stroops).** La fórmula del encargo `goalUsdScaled = goalArs * RATE_SCALE / usdToArs; goalStroops = goalUsdScaled * stroopsPerUsd / RATE_SCALE` es inconsistente con la convención del repositorio: `RateSnapshot.usdToArs` se almacena **ya escalado por RATE_SCALE** (ver el puerto y `rate-table.route.test.ts`, que publica `120000000` para 120 ARS/USD), mientras `stroopsPerUsd` es nativo; la fórmula literal subescala el objetivo por 1e6 (5.000 USD → 0,005 XLM). Se implementó la conversión correcta preservando los dos pasos y añadiendo la escala de almacenamiento una sola vez: `goalUsdScaled = goalArs * RATE_SCALE * RATE_SCALE / usdToArs`; `goalStroops = goalUsdScaled * stroopsPerUsd / RATE_SCALE`, ambas divisiones truncan hacia cero. Un test fija el caso real: 12.000.000 ARS a 1.200 ARS/USD y 10.000.000 stroops/USD → 100.000.000.000 stroops.
- **REFACTOR.** La resolución del owner pasó de un sentinel de string a un resultado discriminado (`{ ok, ownerUserId }`), eliminando la colisión entre el id y el sentinel.
- **Verificación observada.**
  - RED: `pnpm --filter @vaqcrow/api exec vitest run <4 archivos>` → **16 failed / 23 passed**; `authorization.test.ts` + `human-decision.route.test.ts` → **17 failed / 295 passed**.
  - GREEN: 6 archivos + `build-app.test.ts` → **402 passed (7 archivos)**.
  - Suite completa: `pnpm --filter @vaqcrow/api test` → **2065 passed (91 archivos)**.
  - `pnpm --filter @vaqcrow/api typecheck` → **pass**.
  - `pnpm run boundaries` → **sin violaciones** (833 módulos, 2693 dependencias).
  - `pnpm run test:boundaries` → **164 passed (10 archivos)**.
- **Límite explícito.** Backend-first: no se tocó `apps/web`, `packages/contracts`, `contracts/` (Rust) ni Testnet. La migración `campaign_deployment` se aplicó localmente (pgTAP 27/27) y **también al proyecto remoto** (verificado esquema, grants/RLS e historial). La consola admin (#386) y el listado de marketplace (#414) quedan fuera.

- **Work-unit commit.** `0b0abff feat(api): deploy approved campaigns with a persisted lifecycle`.

## T5 — Verificación y evidencia de cierre

Redacción del documento de cierre de Feature [[docs/planning/application-review-and-vault-deployment-evidence|Evidencia de cierre de la Feature #410]] (español, misma estructura que el hermano de #382) y re-ejecución del gate local en este árbol de trabajo (2026-10-06). **Este work unit es sólo documentación: no toca código de producción.**

### Verificación re-ejecutada (2026-10-06)

- `pnpm run verify` → **PASA (exit 0)**. En la primera corrida falló en el gate de lint por dos errores **reales de producción** de #410, en archivos que **no existen en `main`** (defecto de esta rama, no ambiental): `supabase-rate-table-repository.ts:48` (`_error` sin usar, T3) y `storage.route.ts:84` (`no-control-regex`, regex de `contentDisposition`, T1a). Se corrigieron en el mismo work unit (saneo sin regex de control y parámetro eliminado); la re-ejecución del gate completo encadenado da **exit 0**.
- Gates re-ejecutados **por separado** (todos verdes): `pnpm run typecheck` → 8/8; `pnpm run lint:tests` → sin hallazgos; `pnpm run typecheck:tests` → sin hallazgos; `pnpm run test` → 8/8 con `@vaqcrow/api` **2065 passed (91 archivos)**; `pnpm run build` → 5/5; `pnpm run boundaries` → sin violaciones (833 módulos, 2693 dependencias); `pnpm run test:boundaries` → **164 passed (10 archivos)**.
- `pnpm run test:db` → **14/15 archivos ok** (Files=15, Tests=415). `campaign_deployment.sql`, `campaign_persistence.sql` y `businesses_ownership.sql` **ok**; la única falla es `pyme_documents_bucket.sql` (subtests 9, 16, 18: `have: 9, want: 3`), **ambiental y preexistente** por objetos ajenos en el bucket local, ya documentada en T3a y ajena al esquema de #410.
- **No ejecutado:** Testnet, escrituras remotas de Supabase, `test:integration`, Playwright.

### Hallazgo de verificación (corregido en este work unit)

El gate de lint de `pnpm run verify` falló en la primera corrida por dos errores de producción de #410 (§ arriba), defectos de esta rama. Se corrigieron en el mismo work unit — `contentDisposition` sanea sin regex de caracteres de control y el método `error()` del repo de tasas pierde el parámetro sin usar — y `pnpm run verify` pasa **exit 0**. Los tests enfocados de ambos archivos siguen verdes (31 passed).

### Estado honesto de los criterios de aceptación

- **AC1 — NO ENTREGADO** (frontend, depende de #386). El backend lo habilita con el contexto agregado de revisión (T1b) y el visor privado (T1a).
- **AC2 — PARCIAL.** `record_human_decision` persiste y atribuye la decisión humana con motivo/límite y su auditoría (transición condicional desde `human_review`, idempotente); los veredictos por documento son UI (#386).
- **AC3 — CUMPLIDO.** `deployApprovedCampaign` (T5b) despliega una vez vía `openCampaign`, publica sólo tras la confirmación y un replay confirmado es no-op.
- **AC4 — PARCIAL.** `changes_requested`/`rejected` (T4a) y `approved_published` (T5b) notifican a la PyME; `admin.pending_transaction` **no tiene productor**.
- **AC5 — CUMPLIDO.** La IA es consultiva; el deploy sólo corre para un `approved` humano.
- **AC6 — CUMPLIDO** por el documento de evidencia.
- **AC7 — PARCIAL.** D1–D6 decididas antes de implementar; el campo de plazo del wizard sigue abierto y no se inventó UI.
- **AC8 — CUMPLIDO.** Sin secretos ni claims de producción.

### Entrega

Nada en `main`; el trabajo vive en la rama de integración, **bloqueado de forma nativa por #386** (abierta). Las cuatro migraciones (`fx_rate`, snapshot de `campaign`, `businesses.deadline`, `campaign_deployment`) están aplicadas y verificadas en el proyecto remoto. El paso de operador de T3b (redeploy/re-apuntado de la fábrica en Testnet) sigue **pendiente y no ejecutado**.

## Próximo paso

T1a, T1b, T3, T3a, T3b, T4a, T5a, T5b y T5 implementados. Faltan: corregir los dos errores de lint de `apps/api` que dejan `verify` en rojo; el paso de operador de T3b (redesplegar/re-apuntar la fábrica); el productor del evento `admin.pending_transaction` (AC4); el campo de plazo del wizard (AC7); y la consola admin #386 que expone la vista de revisión y los estados de despliegue (AC1/AC2). El listado de marketplace #414 queda fuera.

## T3c — Smoke de CI respeta el tope por inversor (`campaign-smoke.sh`)

El job `contracts` de `.github/workflows/ci.yml` corre `contracts/scripts/campaign-smoke.sh`, que todavía aportaba 400 + 600 desde la **misma** cuenta con `GOAL=1000`. Con el tope `goal/10 = 100` de T3b, el aporte de 400 es rechazado y el job se rompería en cualquier PR de esta rama. La corrección es sólo del script: no se toca el contrato Rust, cuyo comportamiento ya está cubierto por `cargo test`.

- **Cambios.**
  - `invoke_as <cuenta> ...` firma la invocación con la cuenta indicada; `invoke` delega en la cuenta por defecto. `contribute` exige la autorización del inversor, así que cada aporte lo firma su propia clave.
  - `ensure_identity <nombre>` generaliza el patrón existente del deployer: genera y fondea con Friendbot **sólo si la clave no existe**, así una re-ejecución en la red local persistente reutiliza las identidades. No se agrega ninguna dependencia externa.
  - **Campaña A** (`GOAL=1000`, tope 100): diez inversores distintos de 100. El tope se afirma mientras la campaña sigue `Funding`: el inversor 01 aporta sus 100 (aceptado) y un segundo aporte de 100 es rechazado por el tope —el rechazo no puede ser por saldo, porque el primero ya movió tokens reales—; el script además exige que el error sea `Error(Contract, #10)` y que el total no se mueva. Tras nueve aportes (900) la campaña sigue `Funding`; el décimo la liquida en 1000.
  - **Campaña B** (`GOAL_B=3000`, tope 300): un inversor propio aporta 300, dentro del tope; el deadline vence sin objetivo y el `refund` permissionless (lo dispara el deployer, no el inversor) devuelve 300 y pasa a `Refunding`.
  - Se conservan `set -euo pipefail`, `fail`/`ok`, la lectura del reloj del ledger y el margen de 45 s + `sleep 60`.
- **Verificación observada (2026-10-07, red local `vaqcrow-local`).**
  - `cargo test` (desde `contracts/`) → **39 passed; 0 failed** (`campaign-factory` 3 + `campaign-vault` 36).
  - `./contracts/scripts/campaign-smoke.sh` → **pasó de punta a punta en la red local**: tope rechazado con `#10`, 9×100 = 900 sigue `Funding`, el décimo liquida en 1000, campaña B reembolsa 300 y pasa a `Refunding`. Segunda corrida consecutiva → volvió a pasar **sin** imprimir "no identity yet", es decir reutilizó las identidades (fondeo idempotente).
  - `shellcheck contracts/scripts/campaign-smoke.sh` → **sin hallazgos**.
- **Límite explícito.** No se tocaron el contrato Rust (`campaign-vault`/`campaign-factory`), `apps/web`, `apps/api`, `packages/contracts`, migraciones locales ni remotas, ni Testnet. La primera corrida real en Testnet sería el propio job de CI.

- **Work-unit commit.** `73d0833 test(contracts): respect the investor cap in the campaign smoke`.

## Fase UI — vista de revisión en la consola admin (desde 2026-10-07)

La rama de #410 integra la línea #382/#386 por merge `f930365` (decisión del owner, 2026-10-07): la vista de revisión se construye dentro de la consola `/admin` de #386. Mapa de la exploración: el backend está completo; no existe la ruta `/admin/pymes/[applicationId]` y la fila de la cola llama a un `onOpen` que nadie pasa. El gateway legado `http-human-decision-gateway.ts` envía `actor` en el body y la API lo rechaza con 400: el flujo admin usa un gateway propio.

Ruta por tarea: cada work unit toca 2+ archivos no triviales → **delegado** (un único writer), con spot-check del parent antes del commit.

- [x] **U1 — Persistir veredictos por documento (backend, D8).** Migración (tabla + RLS + grants atómicos, `service_role`-only), port + adapter Supabase, `PUT`/`GET` ADMIN sobre la solicitud, actor del principal, idempotente; probar local (`test:db`) y aplicar al remoto con autorización explícita.
- [x] **U2 — Ruta y contexto de revisión (web).** Port/gateway/factory/null-object/hook del contexto (`GET /application-reviews/:id/context`), ruta `/admin/pymes/[applicationId]`, navegación desde la cola, encabezado «Revisión: {nombre}», breadcrumb, badge de estado y estados cargando/no encontrada/error.
- [x] **U3 — Sección 1 · KYC/KYB.** Filas por documento con «Válido / Pedir / Inválido» persistidos (U1), badge `SIMULADO` y visor privado por blob autenticado (D1, sin URLs públicas).
- [x] **U4 — Sección 2 · Recomendación de IA.** Riesgo, confianza «0,72», razones, anomalías, preguntas sugeridas, pie modelo/fecha/correlación; caso sin assessment.
- [x] **U5 — Sección 3 · Decisión humana.** Radiogroup, razón ≥ 10 con error inline, límite de solo lectura (D7), alertdialog «Cancelar / Confirmar», línea «Registrada por…», modo solo lectura si ya hay decisión, `409 state_conflict` honesto.
- [ ] **U6 — Panel de despliegue (D3).** Estados `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada` / `Despliegue fallido`, **Reintentar**, **Ver detalle** y polling; códigos 422/503 con copy honesto.
- [ ] **U7 — Verificación y evidencia.** Stub e2e (contexto, veredictos, despliegue, storage), `pnpm run verify`, evidencia AC1/AC2 actualizada.

Forecast: ~2.000–2.600 líneas autoradas en total (por encima de ~400).

### Entrega de la fase UI

Estrategia elegida por el owner (2026-10-07): **`feature-branch-chain`**. El tracker es la rama de #410 en `f930365` (PR borrador no-merge #453 → rama de #406); cada work unit es una rama hija `…vault-0N-<slug>` creada desde la anterior, con su PR contra la rama padre inmediata.

| Slice | Rama | Commits | PR | Base | Líneas |
|---|---|---|---|---|---|
| U1 | `…vault-02-document-verdicts` | `5cdc1a6`, `af8556e` | #454 | tracker | 1397 (`size:exception`) |
| U2 | `…vault-03-review-route` | `06dfa53`, `ea57be9` | #455 | `-02` | 1164 (`size:exception`) |
| U3 | `…vault-04-kyc-section` | `84a881c`, `edc160f` + registro | #456 | `-03` | ver PR |
| U4 | `…vault-05-ai-section` | `dea2071` + registro | #457 | `-04` | ver PR |
| U5 | `…vault-06-decision-section` | `91999f3` + registro | #458 | `-05` | ver PR |

`size:exception` de U1/U2: una sola pasada de slicing no encontró un corte cohesivo bajo 400 líneas (U1: la API sola son ~968; U2: la capa de datos sola supera 400; los tests son el 57 % / 43 % de cada slice).

### U1 — Veredictos por documento persistidos (backend)

Ruta: **delegado** (un writer; migración + contrato + port/adapter + caso de uso + ruta + contexto, 2+ archivos no triviales). Sin cambios en `apps/web`.

- **RED.**
  - Contrato: `pnpm --filter @vaqcrow/contracts exec vitest run src/document-verdict.test.ts` → **1 archivo fallido, sin tests** (módulo `document-verdict.js` inexistente).
  - pgTAP: `supabase test db --local supabase/tests/document_verdict.sql` antes de la migración → **falla en el subtest 1** (`document_verdict` no existe; el plan no llegó a correr).
  - API: los 6 archivos enfocados (adapter, caso de uso, ruta, contexto use case/ruta, `authorization.test.ts`) → **5 archivos fallidos / 1 pasado; 28 failed / 306 passed**: módulos `supabase-document-verdict-repository` y `set-document-verdict` inexistentes, `PUT …/verdict` respondía 404, el contexto no traía `documentVerdicts`, la matriz de autorización no encontraba la ruta y el preflight CORS no permitía `PUT`.
- **GREEN.**
  - Contrato `packages/contracts/src/document-verdict.ts`: `documentVerdictValueSchema` (`valid`/`request`/`invalid`), `pymeDocumentIdSchema` (uuid), comando estricto `{ verdict }` (un `actor` en el body es inválido, nunca se ignora en silencio) y forma de lectura estricta `{ documentId, verdict, actor, updatedAt }`; exportados desde el índice.
  - Migración `20261007130000_create_document_verdict.sql`: `public.document_verdict` con PK `(application_id, document_id)`, FKs `on delete restrict` a `application_review` y `pyme_document`, `verdict` con check, `actor` no nulo (1–120 tras `btrim`), `actor_user_id` uuid no nulo (sin FK a propósito: la atribución sobrevive cambios de cuenta), timestamps, índice en `document_id` para la FK y trigger propio `set_document_verdict_updated_at` (search_path vacío, `security invoker`, sin `execute` para public/anon/authenticated). En la misma migración: RLS on, cero policies, `revoke all` a public/anon/authenticated/service_role y `grant select, insert, update` sólo a `service_role` (sin delete). pgTAP `supabase/tests/document_verdict.sql` → **34/34**.
  - Puerto `DocumentVerdictRepositoryPort` (`listByApplication`, `setVerdict`) y adaptador Supabase: semántica de valor actual sin upsert — INSERT; ante `23505` un UPDATE condicional `verdict <> $nuevo`; si no afecta filas es un replay y devuelve la fila existente con `applied: false` (no re-sella actor ni `updated_at`). `23503` → `not_found`; cualquier otro error de Postgres → `unavailable`, con `message`/`details`/`hint` sólo en el log del servidor.
  - Caso de uso `setDocumentVerdict`: sólo `awaiting_assessment`/`human_review` permiten editar; otro estado → `state_conflict` con `actualState` y sin escribir. El documento debe pertenecer al owner de la solicitud (`sme_request.ownerUserId` + `pyme_document.listByOwner`), si no `not_found`; owner ausente (fila legada) → `unavailable`, igual que el contexto. Actor = `displayName` + `userId` del principal verificado.
  - HTTP ADMIN: `PUT /application-reviews/:applicationId/documents/:documentId/verdict` → `200 { applied, verdict }`; 400 `invalid_request`, 404, 409 `{ code: "state_conflict", actualState }`, 503 `unavailable` saneado (también ante un throw). Registrada en `route-policy.ts`, `build-app.ts` e `index.ts`. CORS suma `PUT` a los métodos permitidos (la consola web lo necesita en el preflight).
  - Contexto: `GET /application-reviews/:applicationId/context` incluye `documentVerdicts: [...]`; un fallo al leerlos hace el contexto `503`, coherente con el resto de dependencias sin ausencia legítima.
- **REFACTOR.** El input del caso de uso pasó a llamarse `SetDocumentVerdictRequest` para no colisionar con `SetDocumentVerdictInput` del puerto; `route-policy.test.ts` acepta `PUT` en el formato de claves.
- **Desvío menor.** No se creó un caso de uso `listDocumentVerdicts` separado: el contexto lee el puerto directamente, como hace con los demás repositorios; envolverlo no agregaba lógica.
- **Verificación observada.**
  - `pnpm --filter @vaqcrow/contracts test` → **545 passed (16 archivos)**.
  - `pnpm --filter @vaqcrow/api test` → **2151 passed (95 archivos)**.
  - `pnpm run typecheck` → **8/8**.
  - `pnpm run lint` → **5/5 sin errores** (1 warning preexistente en `apps/web`, `_request` sin usar, ajeno a U1).
  - `pnpm run boundaries` → **sin violaciones** (871 módulos, 2822 dependencias).
  - `supabase migration up --local` → aplicó `20261007120000_create_admin_sme_request_queue_view.sql` (pendiente en el stack local) y `20261007130000_create_document_verdict.sql`.
  - `pnpm run test:db` → Files=16, Tests=449; todo **ok** salvo `pyme_documents_bucket.sql` (subtests 9, 16, 18: `have: 9, want: 3`), **ambiental y preexistente** (objetos sobrantes en el bucket local).
- **Límite explícito.** Migración aplicada sólo **localmente**; el remoto queda pendiente de la autorización explícita (parent). Entre la verificación de estado y la escritura no hay lock: si una decisión cierra la revisión en ese instante, un veredicto puede quedar grabado justo después; es aceptable porque el veredicto es consultivo y no mueve la decisión. No se tocó `apps/web`.

- **Work-unit commit.** `5cdc1a6 feat(api): persist per-document review verdicts`. Migración remota (autorizada por el owner, 2026-10-07): `20261007130000_create_document_verdict` aplicada vía MCP; historial alineado al version del repo con `update` sobre `supabase_migrations.schema_migrations`; verificado RLS on, 0 policies, grants sólo `service_role` select/insert/update, constraints PK/FKs/checks presentes; advisors sin hallazgos nuevos (sólo el INFO RLS-sin-policy del patrón service_role-only).

### U2 — Ruta y contexto de revisión (web)

Ruta: **delegado** (un writer; port + gateway + factory + null object + hook + ruta + vista + cola, 2+ archivos no triviales). Sin cambios en `apps/api` ni `packages/*`.

- **RED.** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` sobre los 5 archivos enfocados (gateway, modelo `review`, hook, vista/ruta, cola) → **5 archivos fallidos; 2 failed / 19 passed**: los módulos `http-admin-review-gateway`, `application/admin/review`, `use-admin-review`, `review-view` y la página `[applicationId]` no existían, y la cola seguía rindiendo botones sin destino (`findByRole("link", { name: "Revisar solicitud" })` no encontraba nada).
- **GREEN.**
  - Puerto `application/ports/admin-review-port.ts` (sin vendor ni React): `AdminReviewContext` con `applicationId`, `state`, `smeRequest`, `company` (nullable; `deadline` ausente → `null`), `documents` (con `objectPath`, la clave del visor privado de T1a, nunca una URL pública), `documentVerdicts` (U1), `assessment` y `latestHumanDecision` (nullables). El `ownerUserId` no cruza el borde. Códigos `not_found` / `unavailable` / `network`.
  - Gateway `infrastructure/admin/http-admin-review-gateway.ts` con Bearer (mismo patrón que la cola): valida con los schemas de `@vaqcrow/contracts` (`applicationReviewSnapshotSchema`, `smeRequestSchema`, `applicationAssessmentReadSchema`, `humanDecisionRecordSchema`, `documentVerdictRecordSchema`) y a mano la empresa y los descriptores de documento. 404 → `not_found`; otro no-200 → `unavailable`; cuerpo malformado o contexto de otra solicitud → `unavailable`; throw → `network`. Un id que no es UUID v4 es `not_found` sin request (la API respondería 400 y la vista mostraría un error reintentable sin sentido). Más `create-admin-review-port.ts` (sesión lazy) y `unavailable-admin-review-port.ts` (null object).
  - Hook `state/use-admin-review.ts`: SWR con clave `["admin-review", applicationId]`; a diferencia de la cola expone `errorCode` porque `not_found` tiene su propio estado sin reintento. Un fallo nunca deja un contexto viejo.
  - Modelo puro `application/admin/review.ts`: `adminReviewPath` (`/admin/pymes/{id}` con `encodeURIComponent`) y `reviewHeaderFor` → «Revisión: {nombre}», «{rubro} · {id}» y el badge con el mapa `ST` de la cola; empresa ausente o en blanco → «Sin dato».
  - Ruta `app/admin/(console)/pymes/[applicationId]/page.tsx` (Next 16: `params` es una `Promise`, se hace `await`) que rinde `presentation/components/admin/review-view.tsx`: breadcrumb `nav[aria-label="Ruta"]` «PyMEs / Revisión» con «PyMEs» como link a `/admin/pymes`, H1, sub-línea, badge `md` (30px, como el template), estados cargando (`role="status"`), no encontrada y error (`role="alert"` + «Reintentar»), y cuatro slots (`kyc`, `assessment`, `decision`, `deployment`) en las dos columnas del template para U3–U6; un slot ausente no rinde nada.
  - Navegación: las acciones de la cola («Revisar solicitud» / «Ver detalle») pasan de `<button onClick={onOpen}>` (que nadie cableaba) a `next/link` hacia `adminReviewPath(id)`; se quitó la prop `onOpen`. La shell ya resaltaba PyMEs para `/admin/pymes/*`.
- **REFACTOR.** El badge de estado (`StatePill`) y los mapas de íconos/tonos salieron de `pymes-queue.tsx` a `admin-state-pill.tsx` con tamaños `sm` (fila de la cola) y `md` (encabezado de revisión); la cola no cambió su salida.
- **Verificación observada.**
  - Foco: 6 archivos (gateway, modelo, hook, vista/ruta, cola, `queue.test.ts`) → **77 passed**.
  - `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **169 archivos, 1635 passed**.
  - `pnpm run typecheck` → **8/8**.
  - `pnpm run lint` → **5/5 sin errores** (1 warning preexistente, `_request` sin usar, ajeno a U2).
  - `pnpm run boundaries` → **sin violaciones** (889 módulos, 2871 dependencias).
  - `pnpm --filter @vaqcrow/web build` → compila; `/admin/pymes/[applicationId]` aparece como ruta dinámica (`ƒ`).
- **Preguntas abiertas.**
  - **Fecha «enviada el dd/mm/aaaa».** El template la muestra, pero el contexto de la API no expone fecha de envío (`smeRequest` sólo trae `smeReference`, total y período). La sub-línea la omite en vez de inventarla; `reviewHeaderFor` ya acepta `submittedAt` para cuando el owner decida exponerla (sería un cambio de API).
  - **Copy de «no encontrada», error y carga.** El template no diseña estos estados para la vista `review`. Se usó copy mínima y neutral, alineada a la cola: «No encontramos esta solicitud.» (sin reintento), «No pudimos cargar la solicitud. No se modificó ningún dato.» + «Reintentar», y «Cargando…». Sin H1 en esos estados. A confirmar por el owner.
  - **Panel de despliegue.** El template no ubica el panel de D3; el slot `deployment` quedó debajo de la decisión en la columna angosta, a confirmar en U6.
- **Límite explícito.** No se tocaron `apps/api` ni `packages/*`. Las secciones 1–3 y el despliegue no tienen contenido todavía (U3–U6); no se probó contra la API real (sólo dobles).

- **Work-unit commit.** `06dfa53 feat(web): add the admin application review route`.

### U3 — Sección 1 · KYC/KYB y visor privado (web)

Ruta: **delegado** (un writer; puerto + gateway + null object + modelo + hook + adaptador de ventana + sección + composición, 2+ archivos no triviales). Sin cambios en `apps/api` ni `packages/*`.

- **RED.** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` sobre los 4 archivos enfocados (gateway, modelo `kyc`, sección/ruta `admin-review-kyc.test.tsx`, `document-window`) → **4 archivos fallidos; 22 failed / 22 passed**: `setDocumentVerdict`/`downloadDocument` no existían en el gateway (`is not a function`) y los módulos `application/admin/kyc`, `presentation/components/admin/application-review` e `infrastructure/admin/document-window` no existían.
- **GREEN.**
  - Puerto `admin-review-port.ts`: `setDocumentVerdict(applicationId, documentId, verdict)` → `{ ok, applied, verdict }` o `state_conflict` (con `actualState`) / `not_found` / `unavailable` / `network`; `downloadDocument(objectPath)` → `{ ok, file: Blob }` o `unavailable` / `network`. Puerto aparte `document-window-port.ts` (`OpenDocumentWindow`, `PendingDocumentWindow`) para que `state/` no dependa de `infrastructure/`.
  - Gateway HTTP (mismo patrón axios + Bearer de la sesión lazy): `PUT /application-reviews/:applicationId/documents/:documentId/verdict` con body exactamente `{ verdict }` (el actor nunca viaja); 200 validado con `documentVerdictRecordSchema` y `documentId` coincidente; 404 → `not_found`; 409 → `state_conflict` sólo si `actualState` es un estado conocido (si no, `unavailable`); otro no-200 o cuerpo malformado → `unavailable`; throw → `network`; ids no UUID → `not_found` sin request. `GET /storage/uploads` con `params: { path }` y `responseType: "blob"`; cualquier no-200 o cuerpo que no sea `Blob` → `unavailable`; path vacío no hace request. El null object devuelve `unavailable` en las tres operaciones.
  - Modelo puro `application/admin/kyc.ts`: filas en el orden del template (CUIT → contrato → ventas), luego fotos («Foto 1…n») y por último kinds desconocidos («Documento»). Títulos del template donde el kind coincide: `cuit` → «Constancia de CUIT», `articles-of-incorporation` → «Contrato social», `sales-declarations` → «Declaraciones de ventas»; subtítulo = nombre real del archivo (nunca el texto sintético del template). Sin fila para «Documento de identidad» (KYC simulado, no hay archivo) ni para un obligatorio ausente. Mapa «Válido»=`valid`, «Pedir»=`request`, «Inválido»=`invalid`; editable sólo en `awaiting_assessment`/`human_review`.
  - Hook `state/use-kyc-review.ts`: un guardado a la vez (todos los toggles deshabilitados mientras guarda y en estados no editables); tras un 200 muestra el veredicto del registro que devolvió la API y llama a `reload()` (SWR revalida); ese registro local sólo aplica al contexto contra el que se escribió, así el dato re-leído siempre gana. 409 y 404 también recargan (el badge y los toggles reflejan el estado real).
  - Visor (D1) `infrastructure/admin/document-window.ts`: PDF/JPG/PNG abren en pestaña nueva abierta **sincrónicamente en el click** (evita el bloqueo de popups) y apuntada al `blob:` cuando llegan los bytes, con `opener = null`; otro tipo, bytes servidos con un tipo no inline o pestaña bloqueada → descarga con `<a download>`. El object URL se revoca a los 60 s. Si la descarga falla, la pestaña se cierra. Nunca se arma una URL pública ni un `<a href>` al endpoint.
  - Sección `kyc-section.tsx`: «1 · KYC/KYB» + badge `SIMULADO` (borde punteado), fila con ícono, título, archivo, botón «Abrir» (`aria-label` «Abrir {título}») y `role="group"` «Estado de {título}» con toggles `aria-pressed`. Botones de 44 px (template: 36 px) por el área táctil mínima de `demo-ui.md` §5.6, como el selector de tema. Los veredictos persistidos siguen visibles (deshabilitados) en estados decididos; «Abrir» sigue disponible.
  - Composición `application-review.tsx` (cliente): un único puerto para el contexto y las escrituras, rinde `ReviewView` con el slot `kyc`; la página `/admin/pymes/[applicationId]` (server component, no puede pasar funciones como props) rinde esta composición.
- **REFACTOR.** Los tipos de la ventana del visor pasaron de `infrastructure/` a `application/ports/document-window-port.ts`; `kycVerdictFailureMessage` recibe directamente `SetDocumentVerdictFailure`. Los fakes de `AdminReviewPort` de U2 (`admin-review.test.tsx`, `use-admin-review.test.tsx`) suman los dos métodos nuevos.
- **Verificación observada.**
  - Foco: 4 archivos → **78 passed**; con `src/infrastructure/admin`, `src/application/admin`, `src/app/admin` y el hook de U2 → **11 archivos, 152 passed**.
  - `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **172 archivos, 1691 passed**.
  - `pnpm run typecheck` → **8/8**.
  - `pnpm run lint` → **5/5 sin errores** (1 warning preexistente, `_request` sin usar, ajeno a U3).
  - `pnpm run boundaries` → **sin violaciones** (903 módulos, 2905 dependencias).
  - `pnpm --filter @vaqcrow/web build` → compila; `/admin/pymes/[applicationId]` sigue como ruta dinámica (`ƒ`).
- **Preguntas abiertas.**
  - **«Contrato social» vs «Estatuto».** El template titula la fila «Contrato social»; el wizard (decisión del owner U1) llama al mismo slot `articles-of-incorporation` «Estatuto». Se usó el título del template, como pide la regla de fuente visual; a confirmar si el admin debe ver el mismo nombre que cargó la PyME.
  - **Fotos.** El template no diseña filas para las fotos opcionales. Se reutilizó el patrón de fila («Foto 1…n», ícono de imagen, archivo como subtítulo) para poder abrirlas (D1) y marcarles un veredicto (la API lo acepta); a confirmar si las fotos llevan veredicto o sólo visor.
  - **«Documento de identidad».** La fila del template no tiene un archivo detrás (KYC simulado) y no se renderiza; a confirmar si debe aparecer como fila informativa sin toggles.
  - **Ubicación del control «Abrir».** El template sólo muestra nombres; se eligió un botón secundario «Abrir» entre el texto y el grupo de toggles.
  - **Atribución del veredicto.** El registro trae `actor` y `updatedAt`, pero la fila del template no tiene lugar para ellos; no se muestran.
  - **Tono verde de «Válido».** El template usa `--ok-s/--ok-t` para «Válido» presionado; `demo-ui.md` §2 reserva el verde para resultados confirmados en el ledger. Se siguió el template (con ícono, texto y `aria-pressed`, nunca color solo), igual que el precedente «Aprobada» de la cola; a confirmar.
  - **Copy no diseñada.** «No hay documentos cargados.», «Esta solicitud ya tiene una decisión registrada. No se modificó ningún dato.» (409 con estado decidido), «Esta solicitud no admite cambios en su estado actual. No se modificó ningún dato.» (409 con otro estado), «No encontramos este documento en la solicitud. No se modificó ningún dato.» (404), «No pudimos guardar el estado del documento. No se modificó ningún dato.» (503/red) y «No pudimos abrir el documento.» (visor). Mínima y neutral, a confirmar por el owner.
- **Límite explícito.** No se tocaron `apps/api` ni `packages/*`. Sólo dobles: no se probó contra la API real ni en un navegador real (apertura de pestaña, bloqueo de popups y visor de PDF del navegador quedan para el stub e2e de U7). Secciones 2–3 y despliegue siguen vacías (U4–U6).

- **Work-unit commit.** `edc160f feat(web): add the KYC/KYB review section and private viewer`.

### U4 — Sección 2 · Recomendación de IA (web)

Ruta: **delegado** (un writer; modelo puro + sección + composición + tests, 2+ archivos no triviales). Sin cambios en `apps/api` ni `packages/*`.

- **RED.** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4 src/application/admin/assessment.test.ts src/app/admin/admin-review-ai.test.tsx` → **2 archivos fallidos; 6 failed**: el módulo `application/admin/assessment` no existía (el archivo de modelo no llegó a recolectar tests) y la composición no rendía ningún H2 «2 · Recomendación de IA».
- **GREEN.**
  - Modelo puro `application/admin/assessment.ts` (sin React; sólo importa tipos de `@vaqcrow/contracts`): `assessmentSectionFor(read | null)` devuelve el estado vacío o la vista con chip de riesgo (`low`/`medium`/`high` → «Riesgo bajo/medio/alto», ícono propio por banda y tono neutral/caution/critical — «medio» es el `--warn` del template; bajo/alto siguen los tonos del panel legado; nunca verde, que `demo-ui.md` §2 reserva para lo confirmado en el ledger), «Confianza 0,72» (`formatAssessmentConfidence`: dos decimales con coma; 0 → «0,00», 1 → «1,00»), una lista única en el orden del template (razones → «Anomalía: …» → «Faltante: …» → «Pregunta sugerida: …») y el pie «{modelo} · dd/mm/aaaa hh:mm» (`formatAssessmentTimestamp`, zona `America/Argentina/Buenos_Aires` fija para que no dependa del reloj del visor; ilegible → «Sin dato»). Usa `metadata.model` y `recordedAt`.
  - Sección `presentation/components/admin/assessment-section.tsx`: encabezado con ícono `analytics`, H2 «2 · Recomendación de IA» y «Consultiva · no aprueba» (12 px, secundario, como el template); chips de riesgo (texto + ícono `aria-hidden`) y confianza; `ul` con anomalías en `text-trust-caution` (el `--warn-t` del template); pie monoespaciado. Sin ningún botón: la sección no decide nada. Una evaluación con `metadata.source = "simulated"` lleva el badge `SIMULADO` (patrón de U3) contiguo al modelo en el pie.
  - Sin assessment: se mantienen título y «Consultiva · no aprueba» y se muestra «Todavía no hay ninguna evaluación de IA registrada para esta solicitud.» (copy existente de `human-decision-workspace.tsx`), sin chips, lista ni pie.
  - Composición `application-review.tsx`: el slot `assessment` rinde la sección (sólo lee el contexto; no usa `reload` ni el puerto).
- **REFACTOR.** No se movieron `riskLabel`/`confidencePercent` del panel legado: el legado muestra porcentaje («72 %») y el template decimal («0,72»), así que no encajaban; el panel legado quedó intacto.
- **Verificación observada.**
  - Foco: `assessment.test.ts` + `src/app/admin/` → **5 archivos, 61 passed**.
  - `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **174 archivos, 1707 passed**.
  - `pnpm run typecheck` → **8/8**.
  - `pnpm run lint` → **5/5 sin errores** (1 warning preexistente, `_request` sin usar, ajeno a U4).
  - `pnpm run boundaries` → **sin violaciones** (908 módulos, 2921 dependencias).
  - `pnpm --filter @vaqcrow/web build` → compila; `/admin/pymes/[applicationId]` sigue como ruta dinámica (`ƒ`).
- **Preguntas abiertas.**
  - **«corr» del pie.** El template cierra con «corr 7f3a-91c2», pero `ApplicationAssessmentRead` (lo que trae el contexto) no tiene correlation ID: sólo `assessmentId`, `metadata` y `recordedAt`. El pie omite el segmento en vez de inventarlo o rotular el `assessmentId` como correlación; `demo-ui.md` §2 (Trazabilidad) pide el correlation ID, así que exponerlo sería un cambio de API/contrato.
  - **Modelo vs versión de prompt.** El template muestra un solo identificador («evaluador-v1»); se usó `metadata.model`. `promptVersion` no se muestra.
  - **Fecha del pie.** Se usa `recordedAt` (persistencia); `metadata.generatedAt` (generación) queda sin mostrar. Zona horaria fija de Argentina, a confirmar.
  - **Anomalías.** El contrato no trae texto libre como el del template («junio ≈ 1,8× la tendencia…»), sólo `type`, `evidenceRef` y `severity`. Se rinde «Anomalía: valor atípico|contradicción en {ref} · a revisar|informativa» para no ocultar datos; copy a confirmar.
  - **Evidencia de las razones.** El template muestra sólo el texto; se agregó una línea secundaria monoespaciada «Evidencia: {refs}» porque el operador debe poder ver qué evidencia cita la IA (`demo-ui.md` §3) y el panel legado ya la mostraba. A confirmar.
  - **Riesgo bajo/alto e íconos.** El template sólo diseña «Riesgo medio» y sin ícono; tonos de bajo/alto e íconos (información / alerta / advertencia) son del panel legado y de la regla «nunca sólo color».
  - **`SIMULADO` y estado sin assessment.** No diseñados en esta vista; se aplicó `demo-ui.md` §2 (Simulación explícita) y la copy existente del flujo legado. Los estados «procesando / inválida / timeout / respaldo» del brief (pantalla 17) no tienen dato en el contexto (sólo assessment o `null`) y no se representan.
- **Límite explícito.** No se tocaron `apps/api` ni `packages/*`. Sólo dobles: no se probó contra la API real ni en un navegador real. Sección 3 y despliegue siguen vacías (U5–U6).

- **Work-unit commit.** `dea2071 feat(web): add the AI recommendation review section`.

### U5 — Sección 3 · Decisión humana (web)

Ruta: **delegado** (un writer; puerto + gateway + null object + modelo + hook + sección + composición + lectura opcional de sesión, 2+ archivos no triviales). Sin cambios en `apps/api` ni `packages/*`.

- **RED.** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4 src/application/admin/decision.test.ts src/infrastructure/admin/http-admin-review-gateway-decision.test.ts src/app/admin/admin-review-decision.test.tsx` → **3 archivos fallidos; 20 failed**: el módulo `application/admin/decision` no existía (el archivo de modelo no llegó a recolectar tests), `recordDecision` no existía en el gateway (`is not a function`) y la composición no rendía ningún H2 «3 · Decisión humana».
- **GREEN.**
  - Puerto `admin-review-port.ts`: `recordDecision(applicationId, { decisionId, outcome, reason, approvedLimitArs })` → `{ ok, applied, decision }` o `state_conflict` (con `actualState`) / `idempotency_conflict` / `invalid_request` / `not_found` / `unavailable` / `network`. El null object devuelve `unavailable`.
  - Gateway HTTP (axios + Bearer de la sesión lazy, como U3): `POST /application-reviews/:applicationId/decisions` con el body **reconstruido clave por clave** — exactamente `{ decisionId, outcome, reason, approvedLimitArs }`, nunca `actor` (aunque el llamador lo cuele). 201/200 validados con `humanDecisionRecordSchema` y con `applicationId`/`decisionId` coincidentes; 409 → `state_conflict` (sólo con un estado conocido) o `idempotency_conflict`, cualquier otro 409 → `unavailable`; 400 → `invalid_request`; 404 → `not_found`; otro no-2xx o cuerpo malformado → `unavailable`; throw → `network`; id no UUID v4 → `not_found` sin request. No se reutiliza el gateway legado `http-human-decision-gateway.ts` (envía `actor`).
  - Modelo puro `application/admin/decision.ts`: opciones del template en orden («Aprobar con límite» / «Requiere cambios» / «Rechazar», tonos ok/info/err sólo en el ícono), aviso fijo tomado de `microcopy.humanDecision`, validación espejo del contrato (razón recortada 10–1000; decisión obligatoria; aprobar exige límite), `approvedLimitFor(company)` (D7: `goalArs` si es entero seguro positivo, si no `null`), `formatApprovedLimit` («12.000.000»), `buildDecisionRequest` (exactamente las cuatro claves; `approvedLimitArs` `null` salvo aprobación), `decisionFingerprint`, cuerpo del diálogo («{Aprobada con límite ARS X | Requiere cambios | Rechazada}. Queda atribuida a {admin} y visible para la PyME y los aportantes.»), línea «Registrada por {actor} · dd/mm/aaaa hh:mm · {Aprobada|Requiere cambios|Rechazada}» (reutiliza `formatAssessmentTimestamp` de U4, zona Argentina) y mensajes de falla.
  - Hook `state/use-admin-decision.ts`: «Registrar decisión» valida (errores inline sólo después del primer intento, como `tried` del template) y abre la confirmación; sólo «Confirmar» escribe. Cada envío confirmado lleva un `crypto.randomUUID()`; ante `unavailable`/`network` el mismo payload reintenta **con el mismo `decisionId`** (la API responde el replay sin duplicar); `idempotency_conflict`, otros errores o un payload editado usan uno nuevo. Éxito → muestra el registro devuelto por la API y llama a `reload()` (badge, bloqueo de KYC y sección se actualizan); el `latestHumanDecision` re-leído gana después. 409 `state_conflict` y 404 también recargan. Una falla conserva el formulario y no afirma nada.
  - Sección `presentation/components/admin/decision-section.tsx`: borde de 2 px, ícono de persona, H2, aviso fijo; `role="radiogroup"` «Decisión» con radios nativos (teclado nativo) en tarjetas de 46 px; «Razón» con placeholder del template, `maxLength` 1000, `aria-invalid` y `aria-describedby` al error inline; «Límite aprobado (ARS)» **de solo lectura** (`readOnly` + `aria-readonly`) con el objetivo formateado; «Registrar decisión» de 50 px (con «Registrando…» mientras escribe); `AlertDialog` de HeroUI (`role="alertdialog"`, foco atrapado, sin cierre por fondo/Escape) titulado «Registrar decisión» con «Cancelar» / «Confirmar». Sin empresa: «Aprobar con límite» deshabilitado, el límite muestra «Sin dato» y una nota visible explica por qué. Con decisión registrada (o estado final): sólo lectura con la línea `role="status"`, decisión, razón y límite (si aprobó), sin formulario.
  - Nombre del admin: `useOptionalDisplayName()` en `session-store-provider.tsx` lee el `displayName` del principal verificado (el mismo que muestra `admin-shell.tsx`) sin lanzar fuera del provider; sólo redacta el diálogo. El actor registrado viene siempre del servidor.
  - Composición `application-review.tsx`: slot `decision` con puerto, `reload` y nombre.
- **REFACTOR.** Los fakes de `AdminReviewPort` de U2–U4 (`admin-review.test.tsx`, `admin-review-kyc.test.tsx`, `admin-review-ai.test.tsx`, `use-admin-review.test.tsx`) suman `recordDecision`. Una aserción del test de modelo («nunca afirma registro») estaba mal escrita (su regex coincidía con «No se registró tu decisión.») y se reemplazó por una positiva: cada mensaje de falla dice «no se registró» o «No pudimos confirmar».
- **Verificación observada.**
  - Foco: 3 archivos → **39 passed**.
  - `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **177 archivos, 1746 passed**.
  - `pnpm run typecheck` → **8/8**.
  - `pnpm run lint` → **5/5 sin errores** (1 warning preexistente, `_request` sin usar, ajeno a U5).
  - `pnpm run boundaries` → **sin violaciones** (916 módulos, 2957 dependencias).
  - `pnpm --filter @vaqcrow/web build` → compila; `/admin/pymes/[applicationId]` sigue como ruta dinámica (`ƒ`).
- **Preguntas abiertas.**
  - **Copy de validación.** El template sólo marca `aria-invalid` (borde rojo) y no tiene texto de error; tampoco avisa si no se eligió decisión (el click no hace nada). Se agregaron «Elegí una decisión.» (copy del flujo legado), «La razón debe tener al menos 10 caracteres.» y «Máximo 1000 caracteres.» (legado) para no depender sólo del color.
  - **Límite de solo lectura (D7).** Se agregó la nota «Es el objetivo que declaró la PyME; no se edita.» y, sin empresa, «No se puede aprobar: la PyME no tiene un objetivo de financiamiento registrado.» con el límite en «Sin dato». No diseñadas.
  - **Fuera de `human_review`.** El template no diseña el estado `awaiting_assessment` (la API rechaza decisiones ahí): el formulario se ve deshabilitado con «La decisión se habilita cuando la solicitud está en revisión humana.».
  - **Vista de solo lectura.** El template sólo muestra la línea «Registrada por…»; se agregó una lista con decisión, razón y límite porque la razón «queda visible» según el propio placeholder. Un estado final sin fila de decisión muestra «Esta solicitud ya tiene una decisión registrada.».
  - **Fecha de la línea.** El template usa «dd/mm hh:mm» (hora local); se usó `dd/mm/aaaa hh:mm` en zona Argentina, como el pie de IA de U4.
  - **Diálogo sin nombre.** Si la sesión no trae `displayName`, el cuerpo dice «Queda atribuida a tu cuenta de administrador…» (verdadero: el servidor atribuye al principal verificado).
  - **Mensajes de error.** 409 decidido: «Esta solicitud ya tiene una decisión registrada. No se registró tu decisión.»; 409 en otro estado: «Esta solicitud ya no está pendiente de revisión humana, por lo que no se registró tu decisión.» (legado); 404 e inválido: copy legado; `idempotency_conflict`: «No pudimos registrar la decisión. No se registró nada; podés reintentar.»; 503/red: «No pudimos confirmar que la decisión se haya registrado. Reintentar es seguro: si ya se guardó, no se duplica.». A confirmar por el owner.
  - **Verde en «Aprobar con límite».** El ícono usa `--ok-t` como el template; misma pregunta que U3 frente a `demo-ui.md` §2 (nunca color solo: hay texto).
- **Límite explícito.** No se tocaron `apps/api` ni `packages/*`. Sólo dobles: no se probó contra la API real ni en un navegador real (foco del `AlertDialog`, `crypto.randomUUID` en contexto seguro). El despliegue posterior a una aprobación lo dispara el servidor y lo muestra U6; esta sección no lo representa.

- **Work-unit commit.** `91999f3 feat(web): add the human decision review section`.

### U6 — Panel de despliegue (web)

Ruta: **delegado** (un writer; puerto + gateway + null object + modelo + hook con polling + sección + composición, 2+ archivos no triviales). Sin cambios en `apps/api` ni `packages/*`.

- **RED.** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4 src/application/admin/deployment.test.ts src/infrastructure/admin/http-admin-review-gateway-deployment.test.ts src/state/use-admin-deployment.test.tsx src/app/admin/admin-review-deployment.test.tsx` → **4 archivos fallidos; 21 failed**: `getDeployment`/`deploy` no existían en el gateway (`is not a function`), y los módulos `application/admin/deployment` y `state/use-admin-deployment` no existían (sus tres archivos no llegaron a recolectar tests).
- **GREEN.**
  - Puerto `admin-review-port.ts`: `CampaignDeploymentState`, `AdminDeployment` (`campaignId`/`lastError` en `null` cuando la API los omite), `getDeployment(applicationId)` → `{ ok, deployment }` o `not_found` (404: no hay despliegue registrado) / `unavailable` / `network`; `deploy(applicationId)` → `{ ok, deployment }` o `DeployFailureCode` (`application_not_found`, `application_not_approved`, los cuatro 422, `rate_unavailable`, `unavailable`, `network`). El null object devuelve `unavailable` en ambos.
  - Gateway HTTP (axios + Bearer, como U3/U5): `GET` y `POST /application-reviews/:applicationId/deployment` (POST con body vacío `{}`). El sobre `{ deployment }` se valida campo por campo: mismo `applicationId`, estado conocido, `attempts` entero ≥ 0, `campaignId` UUID v4 si viene, `lastError` string si viene, timestamps string; cualquier desvío → `unavailable`. POST: 404 → `application_not_found`, 409 → `application_not_approved`, 422 sólo con un código documentado (otro 422 → `unavailable`), 503 `rate_unavailable` o `unavailable`, otro no-2xx → `unavailable`; throw → `network`; id no UUID v4 → `not_found`/`application_not_found` sin request. Estados y códigos verificados contra `campaign-deployment.route.ts` y `deploy-approved-campaign.ts`.
  - Modelo puro `application/admin/deployment.ts`: rótulos D3 textuales (`Pendiente de confirmación`, `Desplegando bóveda`, `Bóveda confirmada / PyME publicada`, `Despliegue fallido`), tono `success` **sólo** para `confirmed` (pendiente neutral, desplegando info, fallido critical) y un ícono distinto por estado; **Reintentar** sólo en `failed`; copy fijo por `lastError` (un código desconocido nunca se repite: «No quedó registrado el motivo del fallo.»); los fallos de plataforma (`rate_unavailable`, `unavailable`) dicen «no depende de la PyME»; mensajes de reintento que nunca afirman una bóveda confirmada; detalle de solo lectura (intentos, último error si falló, ID de campaña si está confirmada, «Registrado» y «Última actualización» en `dd/mm/aaaa hh:mm`, zona Argentina, con `formatAssessmentTimestamp` de U4); `deploymentPanelVisible` (aprobada o con registro) y `deploymentShouldPoll` (sólo `pending`/`deploying`).
  - Hook `state/use-admin-deployment.ts`: SWR con clave `["admin-deployment", applicationId, reviewState]` (una aprobación registrada en la vista vuelve a leer); un 404 es la lectura `missing`, no un error; `refreshInterval` como función del último dato: sondea cada `pollIntervalMs` (por defecto 4 s, inyectable) sólo mientras `pending`/`deploying`, y se detiene con `confirmed`/`failed`/`missing`, al desmontar o con la pestaña oculta. `retry` hace un único `POST` a la vez (un `ref` frena el doble click antes del re-render), revalida el panel y llama a `reload()` del contexto.
  - Sección `presentation/components/admin/deployment-section.tsx`: ícono, H2 «Despliegue de la bóveda», badge `TESTNET` (contexto de red, `demo-ui.md` §2), estado como `Badge` con ícono + texto dentro de `role="status"`, mensaje honesto; **Reintentar** (`isLoading` → «Reintentando…» y deshabilitado en vuelo); **Ver detalle** como botón con `aria-expanded`/`aria-controls` que muestra un `<dl>` de solo lectura; error del reintento en `role="alert"`. Sin registro (404) o con lectura fallida: texto honesto + «Actualizar» (sólo re-lee). No rinde nada si la revisión no está aprobada y no hay registro.
  - Composición `application-review.tsx`: slot `deployment` (debajo de la decisión, columna angosta, como lo dejó U2) con puerto, `reload` y `deploymentPollIntervalMs` inyectable.
- **REFACTOR.** Los fakes de `AdminReviewPort` de U2–U5 (`admin-review.test.tsx`, `admin-review-kyc.test.tsx`, `admin-review-ai.test.tsx`, `admin-review-decision.test.tsx`, `use-admin-review.test.tsx`) suman `getDeployment` (404) y `deploy` (`unavailable`).
- **Verificación observada.**
  - Foco: 4 archivos → **55 passed**.
  - `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **181 archivos, 1801 passed**.
  - `pnpm run typecheck` → **8/8**.
  - `pnpm run lint` → **5/5 sin errores** (1 warning preexistente, `_request` sin usar, ajeno a U6).
  - `pnpm run boundaries` → **sin violaciones** (925 módulos, 2995 dependencias).
  - `pnpm --filter @vaqcrow/web build` → compila; `/admin/pymes/[applicationId]` sigue como ruta dinámica (`ƒ`).
- **Preguntas abiertas.**
  - **Ubicación y título.** El template no diseña el panel de D3: quedó debajo de la decisión en la columna angosta (slot de U2) con el título «Despliegue de la bóveda» y el badge `TESTNET`. A confirmar por el owner.
  - **Aprobada sin registro (GET 404).** El disparo tras la aprobación es fire-and-forget, así que justo después de aprobar puede no existir la fila todavía. Decisión conservadora: **no** se muestra «Pendiente de confirmación» (no hay registro que lo respalde), **no** se ofrece un botón de despliegue (D3 sólo define Reintentar tras un fallo) y **no** se sondea; se muestra «Todavía no hay un despliegue registrado para esta aprobación. Puede tardar unos segundos en aparecer; actualizá para volver a consultar.» con «Actualizar» (sólo re-lee). Si el disparo falló antes de `markPending`, el admin queda sin acción: ¿se habilita un «Desplegar» explícito (el `POST` lo admite)?
  - **Copy no diseñado.** Mensajes por estado, textos por `lastError`, mensajes de reintento, «Consultando el estado del despliegue…», «No pudimos leer el estado del despliegue…», «Ver detalle» / «Ocultar detalle» y los rótulos del detalle son propios. A confirmar.
  - **`deploying` trabado.** La API rechaza un `POST` mientras la fila está en `deploying` (`503 unavailable`) y el panel sigue sondeando sin ofrecer Reintentar; no hay timeout de «trabado» en la UI ni en la API.
  - **«PyME publicada».** Se usa el rótulo D3 textual en `confirmed`; la publicación en el marketplace (#414) no está implementada, sólo la notificación `pyme.approved_published`.
  - **ID de campaña.** Se muestra el `campaignId` interno (UUID); el contract id de la bóveda y el hash de la transacción no viajan en este endpoint, así que el detalle no ofrece un enlace verificable al ledger (`demo-ui.md` §2, trazabilidad).
- **Límite explícito.** No se tocaron `apps/api` ni `packages/*`. Sólo dobles: no se probó contra la API real, Testnet ni en un navegador real (el polling real, el tiempo del `POST` síncrono contra Testnet y el foco quedan para el stub e2e de U7).

- **Work-unit commit.** _pendiente_

## Guardrails adoptados

- El producto actual es **revenue share**, no acciones ni bonos; no se debe presentar la demo como una emisión de valores negociables.
- La PyME define el objetivo, deadline y mínimo durante el registro; la plataforma valida que el objetivo no supere **USD 50.000 equivalentes** mediante el tipo de cambio simulado/configurado de la demo.
- Un inversor no puede superar el menor de **10% del objetivo de la campaña** y **USD 5.000 equivalentes**. Así una sola persona nunca puede comprar el 100% del proyecto; con un objetivo de USD 50.000, el máximo individual sería USD 5.000.
- El límite debe aplicarse server-side y de forma atómica al reservar/aplicar aportes; la UI sólo lo comunica. El contrato o engine debe rechazar también cualquier aporte que lo exceda.
- La conversión se toma de una tabla de tasas: versión, `effectiveAt`, autor, origen, `usdToArs` y `stroopsPerUsd` como enteros de precisión fija. Una campaña conserva el snapshot; cambiar la tabla sólo afecta nuevos proyectos o cotizaciones aún no confirmadas.
- Estos números son una política conservadora de demo, no asesoramiento legal ni una afirmación de que sean los límites regulatorios aplicables al revenue share. La normativa argentina distingue crowdfunding de valores negociables y exige clasificación legal antes de producción.
