# Bitácora — Feature #438: retiro del recorrido de seis pasos y camino a `main`

Rama: `Vaqcrow#438_Feat_Retire_the_scripted_six_step_demo_journey_routes`, creada desde la punta de #434 (`fda3a27`). Sub-issues: #439 (implementar) · #440 (probar) · #441 (evidencia).

## Objetivo

Retirar las seis rutas del recorrido guionado (`/request`, `/ai-assessment`, `/approval`, `/funding`, `/distribution`, `/evidence`, bajo `apps/web/src/app/(demo)/`) con su engine, store, layout, tests y fixtures sin uso, **después** de que cada dato que mostraban tenga reemplazo en la app por roles. #438 es además la entrega que lleva toda la pila (#369/#378/#398/#399/#402/#406/#410/#414/#422/#426/#430/#434) a `main` (Opción A).

## Problema y por qué

La app por roles ya cubre el flujo, pero `/evidence` es la única pantalla que junta la prueba verificable en Testnet (link al explorador de la bóveda, hash de cada distribución, reconciliación). Borrarla sin reemplazo dejaría a los roles sin la evidencia pública que justifica usar blockchain en la demo. El mapeo además mostró que dos hashes **nunca se persistieron**: el del despliegue de la bóveda y el de cada aporte.

## Decisiones del owner (2026-10-09)

| # | Pregunta | Resolución |
|---|---|---|
| D1 | Bloque de la landing «Recorré la demo completa… Empezar el recorrido». | **Se elimina en forma definitiva.** La landing de #418 nunca lo implementó; no se agrega. |
| D2 | Dónde vive la evidencia Testnet del recorrido. | **Repartida por rol**, sin página pública dedicada; `/evidence` se borra sólo después de verificar el reemplazo de cada dato. |
| D3 | Huecos de evidencia sin reemplazo (link a la bóveda, hash de distribución del inversor, reconciliación). | **Cubrir todos**, dándole a la transparencia la máxima relevancia en cada rol. El **admin** tiene la cadena completa por campaña, a la que se llega desde la lista de PyMEs; el owner autorizó diseñarla con los tokens y componentes del template (sin colores inventados). |
| D4 | Estrategia de entrega. | **`feature-branch-chain`**, como en #434: PRs por porción contra la rama de #438. |

## Datos (de los mapeos)

- **Sin links vivos** a las seis rutas fuera de `(demo)`; el journey store no se reusa: `/company` usa `useSmeRequestState` (sin provider).
- **Hashes no persistidos:** `campaign_contribution` es una fila acumulada por inversor (`20260923183356_create_campaign_persistence.sql:33-43`), sin hash; `campaign_deployment` no guarda el hash que devuelve `CampaignFactoryPort.deploy` (`campaign-factory-port.ts:39-42`). Los aportes y despliegues **anteriores** a este cambio quedan «Sin dato» (nunca cero).
- **Ya persistido:** `revenue_share_distribution.transaction_hash`; `campaign.contract_address`; `campaign.reconciliation_status` + `last_reconciled_at`.
- **Reconciliación:** la única lectura (`GET /campaigns/:id`) llama a la cadena y escribe el espejo; no hay lectura del estado guardado sin cadena.
- **Explorador:** la API arma las URL (`explorer-url.ts`, `StellarConfig.explorerUrl`, indefinida en `local`); la web sólo renderiza el `explorerUrl` que recibe. Se mantiene: la web no conoce la red.
- **Rutas ADMIN sin llamador web** tras el borrado (`POST /assessments`, `…/assessment`, `…/manual-review`, `…/decisions`): se registran como seguimiento; #438 no las borra.
- **Trampa:** `apps/web/playwright.config.ts:59` (`/request`) y `playwright.live.config.ts:55` (`/funding`) usan rutas del recorrido como URL de readiness.
- `apps/web/e2e-live/campaign-vault.live.spec.ts` maneja `/funding`; se retira y el aporte vía UI queda sin e2e live (U9 aporta por API): hueco registrado.

## Tareas

Porción A — transparencia (backend)
- [x] **WU1** Persistir hashes: `campaign_deployment.transaction_hash` (desde `factory.deploy().hash`) y tabla `campaign_contribution_transaction` (hash, campaña, inversor, monto, observado) escrita al confirmar un aporte; RLS + grants `service_role` en la misma migración; reversión en `supabase/tests/campaign_persistence.sql`. Local → remoto con autorización del owner.
- [x] **WU2** Ruta ADMIN de evidencia por solicitud (`GET /application-reviews/:applicationId/evidence`, en `route-policy.ts` + MATRIX de `authorization.test.ts`): decisión, despliegue (hash + URL), bóveda (dirección + URL), aportes[], distribuciones[] (`listByCampaign`), reconciliación guardada sin llamar a la cadena. Contrato en `packages/contracts` (+ barrel).
- [x] **WU3** Roles: `transactionHash` + `explorerUrl` en distribuciones de portafolio, informes y mis campañas; hashes de aporte en portafolio/informes; `vaultExplorerUrl` en portafolio, mis campañas y detalle de campaña. Vistas con columnas agregadas al final; contratos y rutas.

Porción B — transparencia (web)
- [x] **WU4** Vista admin `/admin/pymes/[applicationId]/evidence`: línea de tiempo de la cadena completa (reusa `EvidenceTimeline`, builder por arrays sin la entrada «Caso simulado»), link «Evidencia» desde la fila de la cola y desde la revisión.
- [x] **WU5** Inversor, PyME y detalle de campaña: `HashDisplay` con link al explorador en aportes, distribuciones y bóveda; «Sin dato» para lo histórico.

Porción C — retiro
- [x] **WU6** RED: test de que las seis rutas no se sirven y nada las enlaza. GREEN: borrar `(demo)/`, código muerto (inventario del mapeo), e2e del recorrido, `campaign-vault.live.spec.ts` y sus soportes, handlers del stub; readiness de Playwright a rutas vivas.
- [x] **WU7** Docs: README, `DEMO.md`, `docs/architecture/*`, `demo-tasks-list.md`, `odd/tasks/*` vigentes y los gemelos `AGENTS.md`/`CLAUDE.md`. Las `*-evidence.md` no se reescriben.

Porción D — cierre
- [ ] **WU8** Evidencia `docs/planning/retire-scripted-journey-evidence.md` (#441, en español) y PR de la pila a `main` (decisión del owner).
  - [x] Documento de evidencia (`890e2d8`).
  - [ ] PR de la pila a `main`: abierta por el orquestador (número pendiente).

## Pronóstico de entrega

Unas 2.000 líneas autoradas sin el borrado (WU1 ~250, WU2 ~450, WU3 ~350, WU4 ~450, WU5 ~250, WU7 ~250) más el borrado de WU6 (miles de líneas eliminadas). Supera el umbral de ~400: se entrega como `feature-branch-chain`, una PR por work unit.

## Checks aplicables

- `pnpm run verify` (lint, typecheck, test, build, boundaries, test:boundaries) por work unit; reintentar timeouts bajo carga.
- Migraciones: `supabase migration up --local` → `pnpm run test:db` → remoto vía MCP con `version` alineado.
- `@vaqcrow/contracts` se construye antes de los tests de `apps/api`.
- RDD apagado: verificación independiente tras cada writer.

## Pendientes del owner

- Copy de la vista de evidencia admin y de los estados «Sin dato» (owner-pending, diseñado con el template). Listas completas: WU4 («Copy pendiente del owner»), WU5 y WU5b.
- Tras el merge a `main`: re-apuntar `STELLAR_CAMPAIGN_FACTORY_ID` en Railway a `CCDNM6W4…SV7J` (`application-review-and-vault-deployment-evidence.md:308`).
- Seguimiento: rutas ADMIN sin llamador web (`POST /assessments`, `…/assessment`, `…/manual-review`, `…/decisions`); #438 no las borra.
- Seguimiento: el aporte, retiro y reembolso vía UI quedan sin e2e live (se borró `campaign-vault.live.spec.ts`; U9 aporta por API).
- Copy: `application/distribution/derivation-failure-copy.ts` (vivo en la firma de distribución de la PyME) dice «Retome el recorrido…» en tres mensajes.
- El dataset simulado de ventas de la API ya no tiene gemelo web: la guarda `tests/monthly-sales-feed-parity*` se borró en WU6 y nada compara las dos copias.
- Opcional: `CHECK (^[0-9a-f]{64}$)` en `revenue_share_distribution.transaction_hash`, como ya tienen los hashes de despliegue y de aporte (WU2/WU3: hoy no hay filas mal formadas).

## Progreso

### WU1 — Persistir el hash de despliegue y el de cada aporte

- **Commit:** `8452329` — `feat(api): persist vault deploy and contribution transaction hashes (#438)`.
- **Ruta:** delegada (writer único; trigger de escritura: 2+ archivos no triviales — migración, puerto, adaptador, ruta, use case).
- **Migración:** `supabase/migrations/20261009150000_persist_vault_transaction_hashes.sql`.

**RED → GREEN**

- RED: 10 tests nuevos fallando antes de implementar (`vitest run` sobre `open-campaign.test.ts`, `supabase-campaign-repository.test.ts`, `campaign.route.test.ts`, `campaign-dependencies.test.ts`: «Tests 10 failed | 89 passed (99)»).
- GREEN: los mismos cuatro archivos «Tests 99 passed (99)»; `tsc --noEmit` de `apps/api` sin errores.
- pgTAP: la migración se aplicó local antes de correr la suite, así que su RED no se observó por separado; las 18 aserciones nuevas pasan (ver Verificación).

**Decisiones de diseño**

1. **Hash de despliegue en `campaign.deploy_transaction_hash`, no en `campaign_deployment`.** `open-campaign` es el único punto que ve `factory.deploy().hash` y escribe la fila `campaign` en el mismo paso; lo recorren tanto el despliegue por aprobación admin (#410, que usa `campaign_deployment`) como `POST /campaigns` (que no la usa). Una sola columna cubre ambos caminos sin cambiar el contrato de `openCampaign`. Nullable con chequeo `^[0-9a-f]{64}$`; el grant de tabla existente de `service_role` (`select, insert, update`) ya cubre la columna. Queda `NULL` para las campañas anteriores **y** para una bóveda adoptada de un intento previo (su hash nunca se vio): «Sin dato», nunca un valor inventado.
2. **Hash de aporte en dos pasos, porque `GET /campaigns/:id/transactions/:hash` no conoce el monto.** Esa ruta sólo recibe el hash y lee el agregado del inversor; el monto de **esa** transacción no es derivable de ahí (un delta del agregado sería frágil). La ruta de envío (`POST /campaigns/:id/invocations/submission`) sí tiene hash, inversor y monto del sobre firmado ya verificado. Por eso: (a) el envío registra la fila **antes** de mandar la transacción (`insert … on conflict (transaction_hash) do nothing`); si el registro falla responde 503 sin haber enviado nada, así que reintentar con el mismo sobre es seguro; registrar después del envío dejaría una transacción en vuelo sin registro y un 503 invitando a reenviar. (b) el sondeo, al ver `success` y tras reconciliar, estampa `observed_at` con un `UPDATE … WHERE transaction_hash = $1 AND campaign_id = $2 AND observed_at IS NULL`; una repetición no matchea filas (idempotente) y un hash no registrado (withdraw, refund, ajeno) es no-op. Si la confirmación falla responde 503 para que el sondeo reintente. Sólo las filas con `observed_at` son evidencia de aporte.
3. **Sin columna `kind`: sólo `contribute`.** En `withdraw`/`refund` el monto lo decide el contrato y no viaja en el sobre (`amountStroops` es `null`), así que no hay monto observable que cumpla `amount_stroops > 0`; no se registran.
4. **Puerto aparte, mismo adaptador.** `CampaignContributionTransactionPort` vive en `campaign-repository-port.ts` en vez de agrandar `CampaignRepositoryPort`, para no romper los dobles de ese puerto en tests fuera del alcance (reconcile, derive-revenue-share, marketplace). `SupabaseCampaignRepository` implementa ambos y `buildCampaignDependencies` inyecta la misma instancia como `contributionTransactions`.
5. **Grants:** RLS habilitado sin políticas; `revoke all … from anon, authenticated, service_role`; `grant select, insert` y `grant update (observed_at, last_correlation_id)` a `service_role`. Hash, campaña, inversor y monto quedan inmutables tras el insert; no hay `DELETE`. `ON CONFLICT DO NOTHING` sólo requiere `INSERT`. Errores mapeados a `{ code: "unavailable" }` sin `message`/`details`/`hint` (test con `fakeError` que verifica que «sensitive» no llega al log).

**Verificación**

- `pnpm --filter @vaqcrow/contracts build`: ok.
- `pnpm --filter @vaqcrow/api test`: «Test Files 121 passed (121) · Tests 2539 passed (2539)».
- `pnpm run env:docker:status`: Supabase local, Quickstart y API sanos.
- `supabase migration up --local`: aplicó `20261009150000_persist_vault_transaction_hashes.sql`.
- `pnpm run test:db`: «Files=23, Tests=846 … Result: PASS» (`campaign_persistence.sql` con `plan(39)`: columna y chequeo de formato del hash de despliegue, tabla, RLS, sin privilegios para `anon`/`authenticated`, sin `DELETE` ni `UPDATE` de monto para `service_role`, insert-or-ignore idempotente y confirmación ejecutados como `service_role`, y la reversión que la quita antes de `campaign`).
- `pnpm run verify`: exit 0 en la primera corrida (una advertencia de lint preexistente en `@vaqcrow/web`, ajena a este cambio).
- **Remoto (2026-10-09, autorización del owner):** aplicada vía MCP `apply_migration` (registrada como `20261009234352`) y `version` alineado a `20261009150000` en `supabase_migrations.schema_migrations`. Verificado en el remoto: columna `campaign.deploy_transaction_hash` presente; `campaign_contribution_transaction` con RLS activo y 0 políticas; grants de tabla `service_role: SELECT, INSERT` (ninguno para `anon`/`authenticated`); `UPDATE` sólo de columna `service_role: observed_at, last_correlation_id`.

**Verificación independiente** (RDD apagado; riesgo `medium`, `review_due_reason: slice_budget_reached`): PASS con notas. Recorrió el diff `fda3a27..4edb50c` y re-ejecutó `@vaqcrow/api test` (121 archivos / 2539 tests), `test:db` (23 / 846, PASS), `boundaries` (sin violaciones). Notas de baja severidad: el upsert de PostgREST bajo el grant de columna sólo está probado a nivel SQL (la suite de integración no corrió); el registro usa `command.*` en vez de `verification.value.*` (iguales por el chequeo exacto de argumentos).

**Advertencias**

- `observed_at` es el instante de la lectura de cadena que confirmó el éxito (`chainState.observedAt`), no el cierre del ledger.
- Los aportes enviados antes de este cambio no tienen fila: se muestran «Sin dato».

### WU2 — Ruta ADMIN con la cadena de evidencia Testnet por solicitud

- **Commit:** `178fc2a` — `feat(api): serve the admin Testnet evidence chain per application (#438)`.
- **Ruta:** delegada (writer único; trigger de escritura: 2+ archivos no triviales — contrato, puertos, use case, adaptadores, ruta, composición).
- **Superficie agregada con autorización del owner:** `apps/api/src/index.ts` no estaba en las superficies iniciales; sin él la ruta quedaba registrada en `buildApp` pero no servida en producción. El owner autorizó sólo los 2 imports y la clave `adminApplicationEvidence` de `buildApp`.
- **Sin migración:** todo se lee de columnas existentes (WU1 incluida).

**Qué entrega**

`GET /application-reviews/:applicationId/evidence`, `only("ADMIN")`, sólo lectura. Contrato `AdminApplicationEvidence` en `packages/contracts/src/admin-application-evidence.ts` (exportado en el barrel): `applicationId`, `applicationState`, `smeReference`, `companyName | null`; `decision | null` (`actor`, `outcome`, `reason`, `approvedLimitArs`, `decidedAt`); `deployment | null` (`state`, `campaignId | null`); `vault | null` (`contractAddress`, `vaultExplorerUrl`, `deployTransactionHash`, `deployExplorerUrl`, `state` en vocabulario `funding|settled|refunding`, `goalStroops`, `totalStroops`, `deadline`); `contributions[]` (hash, inversor, monto, `observedAt`, `explorerUrl`); `distributions[]` (id, estado, período, hash, `explorerUrl`, total y cantidad de destinatarios, `createdAt`, `confirmedAt`, `ledgerSequence`, `failureReason`); `reconciliation | null` (`status`, `lastReconciledAt`, `lastDivergedAt`). Stroops como string decimal; hashes hex de 64 en minúscula; un link de despliegue sin hash es irrepresentable (refine).

**RED → GREEN**

- Contrato: RED (módulo inexistente) → 12/12.
- Use case `get-admin-application-evidence`: RED (módulo inexistente) → 18/18. Se corrigió un error del propio test: un parámetro por defecto tragaba el `undefined` explícito de la base del explorador.
- `SupabaseCampaignRepository.listObservedContributionTransactions`: 4 fallando → 23/23 (el test de reconciliación guardada es de caracterización y pasó de entrada).
- `SupabaseRevenueShareDistributionRepository.listByCampaign`: 3 fallando → 55/55.
- Ruta (200, 200 con nulls, 401, 403 PYME/INVERSOR, 400, 404, 503 saneado, extremo a extremo con base de explorador indefinida → links `null`): RED (módulo inexistente) → verde.
- `buildAdminApplicationEvidenceDependencies`: 2 fallando → 8/8.
- `contractExplorerUrl`: el helper se escribió antes que su test; su RED no se observó.

**Decisiones de diseño**

1. **Puertos de lectura separados, sin agrandar los existentes** (lección de WU1): `CampaignContributionTransactionReadPort` (`observed_at IS NOT NULL`, orden `observed_at` + hash) y `RevenueShareDistributionCampaignReadPort.listByCampaign` (todos los estados, orden `created_at` + id). Los implementan los adaptadores Supabase existentes; ningún doble escrito a mano se rompió. `supabase-admin-application-evidence.ts` no hizo falta: el use case compone repositorios existentes.
2. **La campaña se lee por `campaigns.findByApplicationId`**, no por el `campaignId` del despliegue: cubre tanto el despliegue por aprobación admin como `POST /campaigns`. La reconciliación es la **guardada** en el espejo; no se llama a la cadena.
3. **404 vs 200:** revisión o solicitud inexistente → 404 (igual que `…/context`); sin decisión, despliegue, campaña o empresa → 200 con `null`/listas vacías; solicitud legada sin dueño → `companyName: null` sin leer empresas; cualquier otra lectura fallida → 503 `{ code: "unavailable" }` (nunca una cadena parcial).
4. **Links al explorador armados en la API** (`transactionExplorerUrl` y el nuevo `contractExplorerUrl` en `explorer-url.ts`) desde `StellarConfig.explorerUrl`; con base indefinida (`local`) todos son `null`. La web no conoce la red.
5. **Cableado independiente de `campaignVault.enabled`:** `buildAdminApplicationEvidenceDependencies` (en `campaign-dependencies.ts`) sólo lee Supabase, sin firmante ni cadena.
6. **Desvío del brief:** `transactionHash` de distribución quedó **no nulo** (el brief pedía nullable): el tipo del registro y la columna `revenue_share_distribution.transaction_hash` son `NOT NULL`, así que `null` no puede ocurrir. Su `explorerUrl` sí es nullable.
7. **Supuesto no verificado:** `revenue_share_distribution.transaction_hash` no tiene chequeo de formato en la base; la regla hex minúscula del contrato confía en el hash que produce el XDR. Los hashes de despliegue y de aporte sí tienen `CHECK (^[0-9a-f]{64}$)` (WU1).

**Verificación**

- `pnpm --filter @vaqcrow/contracts build`: ok.
- `pnpm --filter @vaqcrow/contracts test`: «Test Files 24 passed (24) · Tests 646 passed (646)».
- `pnpm --filter @vaqcrow/api test` (con `index.ts` cableado): «Test Files 124 passed (124) · Tests 2588 passed (2588)».
- `pnpm run verify`: primera corrida exit 1 por 3 errores de lint en el test nuevo del use case (`_omitted` sin uso), corregidos con un helper `without()`; segunda corrida exit 0; tras cablear `index.ts`, tercera corrida exit 0 («no dependency violations found (1256 modules, 4150 dependencies cruised)»; única advertencia la preexistente `_request` de `@vaqcrow/web`).

**Advertencias**

- La ruta no tiene llamador web todavía: la vista admin llega en WU4.
- Los aportes y despliegues anteriores a WU1 se ven como `null`/lista vacía («Sin dato»).

**Verificación independiente** (RDD apagado): PASS con notas. Recorrió el diff `71cb45f..3c8a7a1` y re-ejecutó `@vaqcrow/contracts test` (24 archivos / 646 tests), `@vaqcrow/api test` (124 / 2588), `boundaries` (sin violaciones, 1256 módulos) y `lint` (5/5). Confirmó `only("ADMIN")` con fila en la MATRIX (401/403), que no hay llamada a la cadena, el filtro `observed_at IS NOT NULL`, el alcance por campaña y la sanitización de errores. Notas de baja severidad: `campaign.application_id` no es único, y con dos campañas `maybeSingle()` responde 503 (falla cerrado, comportamiento previo); la ruta no re-parsea su salida con el contrato en runtime; `companyName` asume una empresa por PyME.

### WU3 — Hashes de Testnet y links al explorador para inversor, PyME y detalle de campaña

- **Commit:** `aa79d1e` — `feat(api): expose Testnet hashes and explorer links to investors, PyMEs and campaign detail (#438)`.
- **Ruta:** delegada (writer único; trigger de escritura: 2+ archivos no triviales — migración, contratos, puertos, use cases, adaptadores, rutas, composición).
- **Migración:** `supabase/migrations/20261009160000_expose_transaction_hashes_in_role_views.sql`. Sin cambios en `apps/web` salvo objetos de fixture de tests (la UI llega en WU5).

**Qué entrega**

| Superficie | Campos nuevos (requeridos, nullable donde corresponde) |
|---|---|
| `GET /portfolio` (`portfolio.ts`) | posición: `vaultExplorerUrl \| null`, `transactions[]` (`transactionHash`, `amountXlm`, `observedAt`, `explorerUrl \| null`); distribución: `transactionHash` (no nulo), `explorerUrl \| null` |
| `GET /reports` (`investor-report.ts`) | `latestDistributions[]`: `transactionHash`, `explorerUrl \| null`; nuevo `contributionTransactions[]` (`date`, `pyme`, `amountXlm`, `transactionHash`, `explorerUrl`, `vaultAddress`, `vaultExplorerUrl`) filtrado por el rango del informe |
| `GET /my-campaigns` (`my-campaigns.ts`) | campaña: `vaultExplorerUrl \| null`; distribución: `transactionHash`, `explorerUrl \| null` |
| `GET /marketplace/campaigns/:id` (`campaign-detail.ts`) | `vaultExplorerUrl \| null` junto a `vaultAddress` (refine: un link sin dirección de bóveda es irrepresentable) |

Exportados en el barrel: `testnetTransactionHashSchema` (hex de 64 en minúscula), `explorerUrlSchema` (`z.url().nullable()`), `portfolioContributionTransactionSchema`, `reportContributionTransactionSchema` y sus tipos.

**Migración (resumen para el remoto)**

- `create or replace view` con `transaction_hash` **agregada al final** (ninguna columna existente cambia de nombre, tipo ni posición): `investor_portfolio_distribution`, `investor_report_distribution` y `my_campaign_distribution` (esta última agrupa por distribución; sumar `d.transaction_hash` al `GROUP BY` no cambia filas porque `distribution_id` es la clave).
- Vista **nueva** `investor_contribution_transaction`: `investor_account_id`, `transaction_hash`, `campaign_id`, `campaign_name`, `vault_address`, `amount_stroops`, `observed_at`, desde `campaign_contribution_transaction` (WU1) con `observed_at IS NOT NULL`, `join campaign` y lateral LEFT a la empresa (mismo criterio que #426/#430).
- Las cuatro con `security_invoker = true` re-declarado; grants re-declarados: `revoke all … from public, anon, authenticated, service_role` y `grant select … to service_role`. Postgres conserva el ACL en un `replace`, pero se re-declara para que la migración sea autoevidente.
- Reversión: `drop view investor_contribution_transaction`; las tres vistas modificadas se revierten con `drop` + cuerpos originales (un `replace` no puede quitar columnas). `supabase/tests/campaign_persistence.sql` dropea la vista nueva antes de `campaign_contribution_transaction`.
- Verificación remota sugerida: las cuatro vistas con `reloptions` `security_invoker=true`, `SELECT` sólo para `service_role` (nada para `anon`/`authenticated`), la columna `transaction_hash` última en las tres vistas, y `version` alineado a `20261009160000`.

**RED → GREEN**

- pgTAP: RED observado antes de la migración («Files=23, Tests=831 … Result: FAIL»: `portfolio.sql` 30-31, `investor_report.sql` 21, `my_campaigns.sql` 31 — columna/vista inexistentes); GREEN tras `supabase migration up --local`: «Files=23, Tests=869 … Result: PASS» (+23 aserciones: `portfolio.sql` 48→67, `investor_report.sql` 52→54, `my_campaigns.sql` 60→62).
- Contratos: «Tests 28 failed | 45 passed (73)» → 661/661 en el paquete.
- Use cases: portafolio 9 fallando → 13/13 (el RED se observó con `git stash` del use case: se implementó antes de correr el test por primera vez); informe 9 fallando → 19/19; mis campañas 7 fallando → 10/10; detalle 7 fallando → 14/14.
- Adaptadores: portafolio 3 → 8/8; informes 4 → 9/9; mis campañas 2 → 9/9.
- Rutas (con el use case anterior vía `git stash`): portafolio 5 fallando → 10/10; informes 9 → 15/15; mis campañas 3 → 9/9; marketplace 1 → 14/14. Cubren links con base, `null` sin base, 503 saneado y aislamiento del inversor (un `?investor=`/`?account=` ajeno se ignora; el adaptador se llama una sola vez con la cuenta del principal y el hash ajeno no aparece en la respuesta).

**Decisiones de diseño**

1. **Una vista nueva compartida, no dos.** `investor_contribution_transaction` sirve al portafolio (agrupa por `campaign_id`) y al informe (lista con PyME y bóveda). El aislamiento es el de las demás vistas de rol: `service_role` sólo, y la API filtra por la cuenta que resuelve del principal verificado; el pgTAP prueba que el alcance de un inversor no contiene el hash de otro y que un envío no observado no aparece.
2. **Portafolio: transacciones por posición** (`transactions[]` en cada posición, de la más vieja a la más nueva) y no una lista plana: la posición ya es «mi aporte a esta campaña», y el hash prueba ese aporte. Una transacción cuya campaña no es una posición (campaña no desplegada) se descarta.
3. **Montos en XLM canónico (`amountXlm`), no `amountStroops`.** Los contratos de portafolio, informe y mis campañas usan XLM de 7 decimales en todos sus montos; mezclar stroops en el mismo contrato obligaría a la web a convertir. (El contrato admin de WU2 sí usa stroops, coherente con su propio vocabulario.)
4. **Informe: lista nueva `contributionTransactions`** filtrada por el mes de `observed_at` dentro del rango, de la más nueva a la más vieja. El informe no tenía filas de aporte; el KPI `contributedXlm` sigue saliendo del agregado `campaign_contribution`. `isEmpty` ahora también es `false` si el rango sólo tiene una transacción observada (su mes puede diferir del `coalesce(last_observed_at, created_at)` del agregado). `/reports/sales-by-pyme` no lee transacciones.
5. **Puertos ampliados, no separados** (a diferencia de WU1/WU2): los dobles escritos a mano de estos puertos viven todos dentro de las superficies de WU3 y se actualizaron; un puerto aparte habría duplicado la composición en cuatro factories sin beneficio.
6. **`explorerBaseUrl: string | undefined` requerido** en las cuatro dependencias (mismo patrón que WU2), cableado en `apps/api/src/index.ts` desde `config.stellar.explorerUrl`; obliga a cablearlo y con base indefinida (`local`) todos los links son `null` pero los hashes se devuelven igual. En el marketplace se agregó a `MarketplaceRouteDependencies` (lo usa sólo el detalle); los fixtures de `authorization.test.ts` y `build-app.test.ts` pasan `undefined`.
7. **Hash de distribución no nulo con regla hex de 64**, igual que WU2: la columna es `NOT NULL`; una fila con hash mal formado hace fallar el parseo y la ruta responde 503 (falla cerrado), nunca un hash inventado.
8. **Detalle de campaña sin cambio de vista:** `marketplace_campaign_detail` ya expone `vault_address`; el link se arma en el use case. Por eso `marketplace_campaign_detail.sql` no cambió.
9. **Fixtures web:** sólo los objetos de cuatro tests de gateway (`http-portfolio-gateway`, `http-report-gateway`, `http-my-campaigns-gateway`, `http-campaign-detail-gateway`), con `explorerUrl: null` para no meter URLs de red en `apps/web`; en `http-my-campaigns-gateway.test.ts` también la expectativa que replica la distribución tal cual llega (el gateway la pasa sin transformar).

**Verificación**

- `pnpm --filter @vaqcrow/contracts build`: ok.
- `pnpm --filter @vaqcrow/contracts test`: «Test Files 24 passed (24) · Tests 661 passed (661)».
- `pnpm --filter @vaqcrow/api test`: «Test Files 124 passed (124) · Tests 2617 passed (2617)».
- `pnpm --filter @vaqcrow/web test`: «Test Files 255 passed (255) · Tests 2430 passed (2430)».
- `pnpm run env:docker:status`: Supabase local, Quickstart y API sanos.
- `supabase migration up --local`: aplicó `20261009160000_expose_transaction_hashes_in_role_views.sql`.
- `pnpm run test:db`: «Files=23, Tests=869 … Result: PASS».
- `pnpm run verify`: corrida 1 exit 1 (11 errores de lint por desestructuraciones `_x` sin uso en tests nuevos → helper `without()`); corrida 2 exit 2 (typecheck: índice posiblemente `undefined` en dos tests de contratos → `!`); corrida 3 exit 1 por timeout de 5 s en `pyme-onboarding-wizard.test.tsx` (ajeno, bajo carga); corrida 4 (reintento) exit 0 («no dependency violations found (1256 modules, 4156 dependencies cruised)»; única advertencia la preexistente de `@vaqcrow/web`).
- **Remoto (2026-10-09, autorización del owner):** aplicada vía MCP `apply_migration` y `version` alineado a `20261009160000`. Verificado en el remoto: las cuatro vistas con `security_invoker=true`; `SELECT` sólo para `service_role` (nada para `anon`/`authenticated`); `transaction_hash` es la última columna de las tres vistas modificadas. Antes de aplicar se comprobó que `revenue_share_distribution` no tiene filas con un hash fuera de `^[0-9a-f]{64}$` (0 filas en total).

**Verificación independiente** (RDD apagado): PASS con notas. Recorrió `7a1ae8e..dc9cb13`; ningún camino deja a un inversor ver hashes o distribuciones de otro, ni a una PyME campañas ajenas (cuenta resuelta desde el principal verificado; parámetros de query ignorados). Vistas sólo agregan columnas al final; reversión correcta. Re-ejecutó contracts (661), api (2617), web (2430), `test:db` (869, PASS), `boundaries` y `test:boundaries` (164). Notas: `revenue_share_distribution.transaction_hash` no tiene CHECK de formato en la base y la API no re-parsea su respuesta, así que un hash mal formado rompería la lectura en el cliente (hoy no hay filas); las transacciones de aporte sin posición se descartan en el portafolio.

**Advertencias**

- Los aportes anteriores a WU1 no tienen fila: la posición muestra `transactions: []` y el informe no los lista («Sin dato»).
- `observed_at` es el instante de la lectura de cadena que confirmó el éxito, no el cierre del ledger (heredado de WU1).

### WU4 — Vista admin de la cadena de evidencia Testnet por solicitud

- **Commit:** `d165c28` — `feat(web): show the admin Testnet evidence chain per application (#438)`.
- **Ruta:** delegada (writer único; trigger de escritura: 2+ archivos no triviales — builder, puerto, gateway, hook, componentes, ruta, enlaces, e2e).
- **Desvío del plan:** la tarea decía «reusa `EvidenceTimeline`»; como ese componente y `application/evidence/evidence-timeline.ts` se borran en WU6, la vista se construyó con módulos admin nuevos (`application/admin/evidence.ts`, `presentation/components/admin/evidence-chain.tsx`) sin importar nada de `(demo)`.

**Qué entrega**

- Ruta `/admin/pymes/[applicationId]/evidence` (hereda `AdminConsoleGate` + `AdminShell`) y `adminEvidencePath()` junto a `adminReviewPath()`.
- Lectura de `GET /application-reviews/:applicationId/evidence` con el contrato `adminApplicationEvidenceSchema` (estricto: un campo de más o mal formado, o un `applicationId` distinto del pedido, es `unavailable`); 404 → `not_found`; id no UUID v4 → `not_found` sin request; transporte → `network`. Hook `useAdminEvidence` (SWR, mismo patrón que `useAdminReview`).
- Cadena vertical de seis pasos, de la más vieja a la más nueva: 1 · Solicitud → 2 · Decisión humana → 3 · Despliegue de la bóveda → 4 · Aportes → 5 · Distribuciones → 6 · Reconciliación; encabezado «Evidencia: {empresa}» con referencia e id, pill de estado, badge TESTNET y la nota canónica `microcopy.hashTechnicalOnly`.
- Enlaces: «Evidencia» por fila en la cola (`aria-label` «Evidencia de {PyME}», contiene el texto visible) y «Ver evidencia Testnet» en el encabezado de la revisión (sólo con la solicitud cargada). Migas «PyMEs / Revisión / Evidencia».
- e2e: el stub sirve `GET …/evidence` (decisión y despliegue del propio doble; sin bóveda ni links) y un test navega cola → evidencia → revisión → evidencia.

**RED → GREEN**

- Builder `evidence.test.ts`: RED (módulo inexistente) → 16/16.
- Gateway `http-admin-review-gateway-evidence.test.ts`: 6 fallando (`getEvidence` inexistente) → 6/6.
- Hook `use-admin-evidence.test.tsx`: RED (módulo inexistente) → 5/5.
- `evidence-chain.test.tsx` se escribió antes del componente pero se corrió por primera vez ya implementado: su RED no se observó (7/7).
- `evidence-view.test.tsx` + `admin-evidence.test.tsx`: RED (módulos inexistentes) → 7/7 (un test se corrigió: «Aprobada» aparece dos veces, en la pill y en el paso 1).
- Enlaces (`admin-console.test.tsx`, `admin-review.test.tsx`): 2 fallando → verdes.
- e2e `admin-review.spec.ts`: el test nuevo falló en frío porque `next dev` compila la ruta en la primera visita y la espera por defecto no alcanzó; pasó al reintentar y se le dio `timeout: 30_000` a esa primera navegación (comentado). Corrida completa 5/5.

**Decisiones de diseño**

1. **Puerto aparte `AdminEvidencePort`** (lección de WU1/WU2), en `admin-review-port.ts`: agrandar `AdminReviewPort` rompía seis dobles escritos a mano fuera de las superficies (`admin-review-ai/decision/deployment/kyc.test.tsx`, `use-admin-review.test.tsx`, `use-admin-deployment.test.tsx`). `HttpAdminReviewGateway` y el null object implementan ambos; `createBrowserAdminEvidencePort()` vive en `create-admin-review-port.ts`.
2. **Template:** la pantalla no está diseñada; se compuso sólo con piezas existentes. Tarjetas de paso como las secciones de la revisión (`rounded-card`, `border-page-border`, `bg-raised`, padding 22 px, título 18 px bold numerado «N · …» como «3 · Decisión humana»); badges de `Vaqcrow Sistema.dc.html` §04 vía `Badge` (tonos `trust-*`, «Evidencia faltante» con `remove-circle-outline`, «Pendiente de confirmación» con reloj, «Confirmada» con check, TESTNET con `microcopy.testnetBadge`); `AdminStatePill` del `ST` de `Vaqcrow Admin.dc.html`; `HashDisplay` para contrato y hash de despliegue; la fila compacta «CDLZ…7Q4K Explorador» del diálogo «Revisión antes de firmar» (mono truncado + link con `open-outline` y `aria-label` completo) para aportes y distribuciones; filas separadas por `border-t` como el «Registro de auditoría»; `dl` de dos columnas (140 px) que colapsa a una en móvil; `EmptyState`, `ErrorState`, `Skeleton`; `FOCUS_RING` de la consola. Única disposición nueva: el riel conector con un marcador por paso (superficie de tono + ícono, decorativo: el estado va en texto en el badge). Sin colores nuevos.
3. **Reglas de confianza (`demo-ui.md` §2):** verde sólo para lo registrado o confirmado en el ledger (bóveda confirmada, aportes observados, distribución confirmada, «Conciliado»); una distribución `submitted` es «Enviada · pendiente de confirmación» (copy reusado de `application/company/distributions.ts`) en tono de precaución y su «Confirmada» dice «Pendiente de confirmación»; «Divergente» en crítico con ícono de alerta; todo estado es texto + ícono.
4. **«Sin dato», nunca cero:** hash de despliegue `null` → «Sin dato» + «Evidencia faltante»; límite aprobado `null`, ledger `null` y empresa `null` → «Sin dato»; listas vacías → `EmptyState`; sin decisión, despliegue o reconciliación → estado neutro con ícono de faltante. `explorerUrl` `null` → hash sin link (la web no conoce la red).
5. **Montos y fechas:** stroops → XLM con `formatStroopsAsXlm` (bigint) + `formatXlmAmount` («250,5000000 XLM», siete decimales como el template); fechas `dd/mm/aaaa hh:mm UTC` en UTC para que el mismo instante se lea igual en cualquier entorno. Motivo de una distribución fallida con el vocabulario cerrado de `failureReasonCopy` (`application/funding/`, que sobrevive a WU6 porque lo usa `company-sign-distribution.tsx`).
6. **Despliegue sin bóveda espejada:** se muestra el estado del registro (`pending`/`deploying`/`failed`) sin hechos ni pruebas; con bóveda espejada el paso es «Bóveda confirmada» aunque no haya fila de despliegue (camino `POST /campaigns`).

**Copy pendiente del owner** (diseñada sin template, en `EVIDENCE_COPY` y el builder): «Evidencia: {empresa}», «Evidencia» / «Evidencia de {PyME}» (cola), «Ver evidencia Testnet» (revisión), títulos «1 · Solicitud» … «6 · Reconciliación», «Sin decisión registrada» + «Todavía nadie registró una decisión sobre esta solicitud.», «Sin despliegue registrado», «Bóveda confirmada», descripción del despliegue («La plataforma despliega la bóveda en Stellar Testnet después de la aprobación; el destino de los fondos es la cuenta de la PyME y es inmutable.»), «{n} confirmado(s) en el ledger», «Sin aportes confirmados», «Todavía no hay aportes confirmados» + cuerpo, «{c} de {n} confirmadas», «Sin distribuciones», «Todavía no hay distribuciones» + cuerpo, «Sin período», «Pendiente de confirmación», «Conciliado» / «Divergente», «Sin conciliación registrada», «Es el último estado guardado al leer la bóveda; esta vista no consulta la red.», «Sin divergencias registradas», términos («Decidió», «Razón», «Límite aprobado», «Fecha», «Estado de la bóveda», «Meta», «Aportado», «Plazo», «Inversor», «Observado», «Total», «Destinatarios», «Enviada», «Confirmada», «Ledger», «Motivo»), «Cargando evidencia…», «No pudimos cargar la evidencia.» + «No se modificó ningún dato. Podés reintentar.», «Volver a PyMEs».

**Verificación**

- `pnpm --filter @vaqcrow/contracts build`: ok.
- `pnpm --filter @vaqcrow/web test`: «Test Files 261 passed (261) · Tests 2474 passed (2474)».
- `pnpm --filter @vaqcrow/web typecheck`: primera corrida exit 2 (ids de fixture sin la marca `ApplicationId` en cuatro tests nuevos → `as AdminApplicationEvidence["applicationId"]`); luego sin errores.
- `pnpm --filter @vaqcrow/web lint`: 0 errores; una advertencia nueva (constante sin uso en un test) corregida; queda sólo la preexistente `_request` de `fetch-http-client.ts`.
- `pnpm --filter @vaqcrow/web exec playwright test e2e/admin-review.spec.ts`: corrida 1 «1 failed, 4 passed» (compilación en frío, ver arriba); tras el ajuste «5 passed».
- `pnpm run verify`: exit 0 en la primera corrida («no dependency violations found (1270 modules, 4219 dependencies cruised)»; `test:boundaries` 164/164).

**Advertencias**

- Las distribuciones y aportes reales sólo aparecen con datos de WU1 en adelante; lo anterior se ve vacío o «Sin dato».
- El e2e cubre la navegación y el estado sin bóveda; la cadena con bóveda, aportes y distribuciones está cubierta por tests de componente, no por e2e.


**Verificación independiente** (RDD apagado): PASS con notas. Recorrió `1b092ee..8f33da7`: ningún import de módulos que borra WU6; contratos sólo type-only en `presentation/`; todas las clases de color resuelven a tokens `--color-*` de `globals.css` (sin hex ni paleta de Tailwind); «Sin dato» nunca como cero; estados con texto + ícono; links externos con `target=_blank`, `rel`, `aria-label` y foco; la página vive bajo `(console)` (`AdminConsoleGate`); el gateway mapea `not_found`/`unavailable`/`network` sin filtrar texto. Re-ejecutó web test (261 / 2474), typecheck, lint (0 errores), `boundaries` y `test:boundaries` (164). Nota baja, código previo: `HashDisplay` no tiene `FOCUS_RING` en su link y su nombre accesible es genérico, así que en «Despliegue» hay dos links con el mismo nombre. Se corrige en WU5, que usa `HashDisplay` en todas las vistas por rol.

### WU5 — Hashes de Testnet y links al explorador en las vistas por rol

- **Commit:** `4a5db4e` — `feat(web): show Testnet hashes and explorer links to investors, PyMEs and campaign visitors (#438)`.
- **Ruta:** delegada (writer único; trigger de escritura: 2+ archivos no triviales — puertos, gateways, selectores, componentes de portafolio, informes, PyME y detalle).
- **Superficies ampliadas (decisión del owner: opción A).** El brief suponía que los gateways web ya entregaban los campos de WU3: los **parseaban** con el contrato, pero los mappers (`toPosition`, `toCampaign`, `toDetail` y el armado del informe) copian campo por campo y los puertos web no los declaraban, así que nada llegaba a `presentation/`. El writer se detuvo sin escribir y el owner eligió la opción A: campos **requeridos** en los cuatro puertos web (un gateway que olvide mapear un campo falla en typecheck en vez de mostrar «Sin dato» en silencio). Se agregaron a las superficies los cuatro puertos (`application/ports/{portfolio,report,my-campaigns,campaign-detail}-port.ts`), los cuatro gateways y sus tests, y ediciones sólo de fixtures en `state/use-{portfolio,investor-report,my-campaigns,campaign-detail,company-distribution-signing}.test.*`, `pyme-onboarding/company-workspace.test.tsx` y `application/campaign/campaign-{contribution,withdraw}.test.ts` (estos dos últimos no necesitaron cambios). El typecheck no pidió ningún otro archivo.

**Qué entrega**

- **Puertos y gateways:** `PortfolioPosition.vaultExplorerUrl` + `transactions[]`; `PortfolioDistribution`, `ReportLatestDistribution` y `MyCampaignDistribution` con `transactionHash` + `explorerUrl`; `InvestorReport.contributionTransactions[]`; `MyCampaign.vaultExplorerUrl`; `CampaignDetail.vaultExplorerUrl`. Los gateways los pasan tal cual llegan; la web sigue sin armar URLs de explorador.
- **`ExplorerProof`** (`presentation/components/explorer-proof.tsx`, nuevo): la fila compacta «CDLZ…7Q4K Explorador» que WU4 usaba sólo en la cadena admin (`InlineProof`), extraída y compartida. Valor truncado visible (o `displayValue` del llamador), valor completo en `title` y en `sr-only`; link sólo si la API mandó URL, con `target=_blank`, `rel="noreferrer noopener"`, anillo de foco compartido y `aria-label` «Ver {qué prueba} {valor completo} en el explorador (abre en una pestaña nueva)» (formato que ya fijaba el test de la cadena admin y que usa el template en el diálogo «Revisión antes de firmar»); valor `null` → «Sin dato» o el nodo `missing` del llamador (la cadena admin conserva su badge «Evidencia faltante»). `evidence-chain.tsx` ahora usa `ExplorerProof`.
- **`HashDisplay` (nota del verificador de WU4):** el link lleva `FOCUS_RING` y un nombre accesible que dice qué prueba: prop opcional `proofLabel` (por defecto el `label`), nombre «Ver en el explorador: {qué prueba} (abre en una pestaña nueva)». En «3 · Despliegue de la bóveda» los dos links se distinguen: «contrato de la bóveda» vs «transacción de despliegue de la bóveda». Story `WithProofLabel`.
- **Inversor `/portfolio`:** cada posición cierra con una fila de prueba a todo el ancho de la tarjeta: «Bóveda» + dirección corta + «Ver en el explorador» (nombre «Ver bóveda de {PyME} …»), y «Tus transacciones de aporte»: monto propio, día (UTC) y hash + link de cada aporte observado, de la más vieja a la más nueva. Sin transacciones (aporte anterior a WU1) → «Hash del aporte: Sin dato», nunca cero. Nota `microcopy.hashTechnicalOnly` una vez bajo «Mis aportes en PyMEs». «Distribuciones»: hash + link por fila y la nota canónica una vez.
- **Inversor `/reports`:** «Últimas distribuciones» suma la columna «Transacción» (hash + link). Sección nueva «Aportes en el período» (fecha, PyME, monto, transacción, bóveda con link, badge TESTNET, nota canónica una vez, vacío «Sin aportes confirmados en el período.»), con los datos ya filtrados por la API para el período elegido. El CSV suma «Hash de la transacción» y «Explorador» a las distribuciones y una sección «Aportes confirmados» (fecha, PyME, monto XLM canónico, hash, explorador, bóveda, explorador de la bóveda); URL `null` → celda vacía.
- **PyME `/company`:** en «Bóveda y distribuciones», la línea «Bóveda CDLZ…7Q4K» del template ahora es una `ExplorerProof` con «Ver bóveda en el explorador» (nombre «Ver bóveda de {campaña} …»). En «Distribuciones», hash + link por fila y la nota canónica una vez. `company-sign-distribution` no cambió (sigue mostrando la recién firmada).
- **Detalle de campaña:** en el `dl` de términos del aside, fila «Bóveda» con la dirección corta y «Ver bóveda en el explorador» si `vaultExplorerUrl` no es `null`; sin bóveda → «Sin dato». Los badges TESTNET/SIMULADO no cambiaron.

**RED → GREEN**

- Gateways: 4 tests nuevos fallando con las fuentes revertidas («Tests 4 failed | 40 passed (44)») → 44/44.
- Typecheck tras volver requeridos los campos: errores sólo en fixtures dentro de las superficies; corregidos, `tsc --noEmit` limpio y suite web 261/2478 verde antes de tocar la UI.
- `ExplorerProof`: RED (módulo inexistente) → 6/6; `displayValue`: 1 fallando → 7/7.
- `HashDisplay` + cadena admin: 3 fallando → 24/24.
- Selectores (`portfolio/proofs`, `reports/contribution-transactions`, filas de distribución de informes y PyME, columnas del CSV): RED (2 módulos inexistentes + 5 tests) → 748/748 en `application/`; un test de igualdad exacta de la fila PyME se actualizó con los dos campos nuevos.
- Componentes (tarjeta de posición, distribuciones de portafolio, lista de bóvedas y distribuciones PyME, últimas distribuciones, aportes del período, aside del detalle): 9 fallando + 1 archivo sin módulo → verdes. `company-dashboard.test.tsx` se ajustó: «Bóveda CDLZ…N4B2» ahora es etiqueta y valor en nodos separados.
- Después de ajustar `HashDisplay`, `evidence-timeline.test.tsx` (fuera de superficie, se borra en WU6) falló: buscaba `/Ver en el explorador/`. Se cambió el nombre accesible para que **empiece por el texto visible** («Ver en el explorador: …», WCAG 2.5.3) en vez de tocar ese test; pasa sin cambios.

**Decisiones de diseño**

1. **Una fila de prueba compartida.** El template no dibuja hashes en Portafolio, Informes ni Detalle; la única forma compacta que dibuja es la fila de contrato del diálogo «Revisión antes de firmar» (`Vaqcrow Sistema.dc.html`: mono truncado + «Explorador» con `open-outline` y `aria-label` con el valor completo), que WU4 ya había adoptado. Se reusa en todas las vistas; `HashDisplay` (caja con copiar) queda para las pruebas de paso del admin.
2. **Direcciones de bóveda 4…4, hashes 10…8.** El template escribe la bóveda como «CDLZ…7Q4K» (`Vaqcrow Portafolio.dc.html`, modo PyME; `Sistema`, diálogo) y el hash con `slice(0, 10)…slice(-8)` (`Sistema`, «Hash y copia»). `ExplorerProof` acepta `displayValue` y las vistas pasan `formatShortAddress` para la bóveda.
3. **Nota canónica una vez por sección.** `microcopy.hashTechnicalOnly` bajo «Mis aportes en PyMEs», en «Distribuciones» (inversor y PyME) y en «Aportes en el período», sólo cuando hay filas. En «Últimas distribuciones» se conserva el pie del template (`Vaqcrow Informes.dc.html:190`, «Un hash de Testnet demuestra ejecución técnica, no una inversión real.»), que ya dice lo mismo: el template prevalece.
4. **Nombres accesibles distinguibles.** En una lista cada link incluye su hash o la PyME/campaña («Ver bóveda de {nombre} …»), así dos links de la misma sección nunca comparten nombre.
5. **Fechas en UTC** (`formatDate` nuevo en `application/portfolio/format.ts`, mismo criterio que el informe) para que el día observado se lea igual en cualquier entorno.
6. **Distribuciones anidadas en «Bóveda y distribuciones» sin hash:** la prueba vive en la sección agregada «Distribuciones», como pedía el brief, para no duplicar el mismo hash en la pantalla.
7. **Fronteras:** `application/` sigue sin React; `presentation/` no importa contratos (sólo puertos); ningún literal de passphrase ni URL armada en la web (los tests usan `https://explorer.example/...`); sólo tokens de `globals.css`.

**Copy pendiente del owner** (el template no la dibuja): «Tus transacciones de aporte», «Hash del aporte», «Hash» (distribuciones del inversor y de la PyME), «Bóveda» como etiqueta en tarjeta y aside, «Ver bóveda en el explorador» (PyME y detalle), columna «Transacción» en «Últimas distribuciones», sección «Aportes en el período» con sus columnas «Fecha / PyME / Monto / Transacción / Bóveda» y su vacío «Sin aportes confirmados en el período.», encabezados del CSV («Hash de la transacción», «Explorador», «Aportes confirmados», «Monto (XLM)», «Bóveda», «Explorador de la bóveda») y el nombre accesible de `HashDisplay` («Ver en el explorador: {qué prueba} (abre en una pestaña nueva)»).

**Verificación**

- `pnpm --filter @vaqcrow/contracts build`: ok.
- `pnpm --filter @vaqcrow/web test`: primera corrida «1 failed | 2509 passed» (`evidence-timeline.test.tsx`, ver arriba); tras el ajuste «Test Files 268 passed (268) · Tests 2510 passed (2510)».
- `pnpm --filter @vaqcrow/web typecheck`: sin errores.
- `pnpm --filter @vaqcrow/web lint`: 0 errores; sólo la advertencia preexistente `_request` de `fetch-http-client.ts`.
- `pnpm run verify`: exit 0 en la primera corrida («no dependency violations found (1283 modules, 4275 dependencies cruised)»; `test:boundaries` 164/164; web 2510, api 2617, contracts 661).

**Advertencias**

- Los aportes anteriores a WU1 no tienen fila: la posición muestra «Sin dato» para el hash y el informe no los lista.
- Sin e2e nuevo: la cobertura es de componente y de gateway; `e2e/evidence-dashboard.spec.ts` (se borra en WU6) sigue buscando `/Ver en el explorador/`, compatible con el nuevo nombre de `HashDisplay`.


**Verificación independiente** (RDD apagado): PASS con notas. Recorrió `fc54865..62a6c3c`: los cuatro gateways mapean todos los campos nuevos y los puertos los exigen; la web no arma URLs de explorador nuevas; «Sin dato» nunca como cero; sin link cuando `explorerUrl` es null; nombres accesibles distintos en listas; nota canónica una vez por sección; sólo tokens de `globals.css`; sin filtrado de cuentas en la web. Re-ejecutó web test (268 / 2510), typecheck, lint (0 errores), `boundaries` y `test:boundaries` (164). Notas: (1) baja, a11y: en `ExplorerProof` el texto visible «Ver en el explorador» no aparece contiguo en el nombre accesible (WCAG 2.5.3 débil); (2) baja: en `PositionProof` una posición que mezcla aportes con y sin hash lista sólo los que tienen hash sin avisar que hay aportes previos sin dato; (3) previa a #438: `escapeCsvField` (`application/reports/export.ts`) no neutraliza prefijos de fórmula `= + - @`, y el nombre de la PyME llega al CSV.

### WU5b — Correcciones de la verificación de WU5

- **Commit:** `b338759` — `fix(web): neutralize CSV formulas, disclose unhashed contributions and align proof link names (#438)`.
- **Ruta:** delegada (writer único; corrige las tres notas de la verificación independiente de WU5, autorizadas por el owner).
- **Superficie ampliada (autorización explícita del owner):** `apps/web/src/presentation/components/company/company-distributions.test.tsx`, sólo la aserción de la línea 63 al nuevo formato de nombre accesible. El writer se detuvo sin commitear al ver que era el único test fuera de superficie que fallaba; el owner lo autorizó y se aplicó ese único cambio.

**Qué corrige**

1. **Inyección de fórmulas en el CSV** (nota 3, previa a #438). `escapeCsvField` (`application/reports/export.ts`) ahora pasa primero por `neutralizeFormula`: un campo que empieza con `=`, `+`, `-`, `@`, TAB o CR recibe un `'` adelante (guía OWASP de CSV injection) y después se aplica el quoting RFC 4180 de siempre. Se aplica a **todos** los campos: los nombres de PyME, sector y campaña son texto de terceros, y el resto (fechas, períodos, XLM canónico, conteos, hashes, URLs) nunca empieza con esos caracteres, así que no hay una lista de «campos de texto» que mantener sincronizada. Única excepción: un decimal negativo puro (`/^-\d+(?:\.\d+)?$/`) queda numérico; `-2+3` y `+1` se neutralizan.
2. **Aportes sin hash en una posición mixta** (nota 2). `unhashedContributionLine` (`application/portfolio/proofs.ts`, puro) compara `contributionXlm` con la suma de los `amountXlm` de las transacciones con hash, en stroops `bigint` vía `xlmToStroops` (sin errores de float: 0,3 − 0,1 − 0,1 da exactamente 0,1). Devuelve `null` si las transacciones cubren el total o si no hay ninguna (la tarjeta sigue con «Hash del aporte: Sin dato»); con remanente, «Aportes anteriores sin hash registrado: X XLM · Sin dato»; si un monto no se puede leer exacto, «Hay aportes anteriores sin hash registrado», sin número. `PositionProof` muestra la línea bajo la lista; los comentarios de ambos archivos describen ahora este comportamiento.
3. **Nombre accesible de `ExplorerProof`** (nota 1, WCAG 2.5.3). `explorerLinkName(linkText, proofLabel, value)` arma «{texto visible}: {qué prueba} {valor} (abre en una pestaña nueva)», empezando contiguo por el texto visible, como `HashDisplay`. Los links «Ver bóveda en el explorador» (lista de bóvedas PyME, detalle de campaña, cadena admin) pasan su `linkText` y quedan «Ver bóveda en el explorador: bóveda de …»; ningún componente que usa `ExplorerProof` necesitó cambios. Ningún e2e afirmaba el formato viejo.

**RED → GREEN**

- CSV: 1 fallando (casos `=HYPERLINK`, `+1`, `-2+3`, `@SUM`, TAB, CR y sección de ventas; valores planos y negativo puro sin cambios) → 13/13.
- Posición: 5 fallando (todo con hash, nada con hash, mixto, monto ilegible; tarjeta mixta y completa) → 17/17.
- Nombre accesible: 9 fallando en 8 archivos de test → verdes; quedaba 1 en `company-distributions.test.tsx` (fuera de superficie, ver arriba) → verde tras la autorización.

**Copy pendiente del owner:** «Aportes anteriores sin hash registrado: {X} XLM · Sin dato», «Hay aportes anteriores sin hash registrado» y el formato de nombre accesible «{texto visible}: {qué prueba} {valor} (abre en una pestaña nueva)».

**Verificación**

- `pnpm --filter @vaqcrow/contracts build`: ok.
- `pnpm --filter @vaqcrow/web test`: «Test Files 268 passed (268) · Tests 2518 passed (2518)».
- `pnpm --filter @vaqcrow/web typecheck`: sin errores.
- `pnpm --filter @vaqcrow/web lint`: 0 errores; sólo la advertencia preexistente `_request`.
- `pnpm run verify`: exit 0 en la primera corrida tras el cambio autorizado (contracts 661, domain 120, ai 143, api 2617, web 2518; «no dependency violations found (1283 modules, 4276 dependencies cruised)»; `test:boundaries` 164/164). Una corrida anterior, con la aserción fuera de superficie aún sin actualizar, falló sólo en ese test.

**Verificación independiente de WU5b** (RDD apagado): PASS con notas. Recorrió `81751f2..26d2625`: la guarda pasa por todas las celdas (`csvRow`), la matemática en stroops `bigint` es exacta, y todos los `ExplorerProof` arman el nombre desde el texto visible. Re-ejecutó web test (268 / 2518), typecheck, lint y `boundaries`. Nota baja, cerrada en el commit `4bbe99c` (inline, RED→GREEN: un test nuevo falló y luego 47/47 en `application/reports`): el prefijo de fórmula ahora también se detecta detrás de espacios o saltos de línea iniciales, en sus variantes de ancho completo (＝＋－＠) y con el pipe DDE `|`. Notas informativas sin cambio: si los aportes con hash suman más que el total de la posición, la línea de «sin hash» no aparece (nunca inventa un número); `xlmToStroops` rechaza cero.

### WU6 — Retiro de las seis rutas, su engine y el código muerto

- **Commit:** `709fc28` — `feat(web)!: retire the scripted six-step demo journey routes (#438)`. `feat!` y no `refactor`: las seis URL dejan de servirse y eso es un contrato visible para el usuario (`BREAKING CHANGE` en el cuerpo).
- **Ruta:** delegada (writer único; borrado de 170+ archivos y poda en `src/`, `e2e/`, `e2e-live/` y `tests/`).
- **404, no redirección:** las seis rutas simplemente no existen y Next responde 404; no se decidió ninguna redirección y no se agregó.
- **Superficie ampliada (autorización explícita del owner):** `tests/monthly-sales-feed-parity.ts` y `.test.ts` (borrados), `tests/testing-and-ci-gates.test.ts` y `tests/web-holds-no-network-passphrase.test.ts`. El writer se detuvo sin commitear cuando `verify` falló en `typecheck:tests`; el owner autorizó estos cuatro archivos tal como se propusieron.

**RED → GREEN**

- RED: `apps/web/src/app/retired-journey-routes.test.ts` (3 tests): (a) ningún `page.*` resuelve a una de las seis rutas (se descartan los grupos `(…)`); (b) ningún archivo de `apps/web/src` contiene una de las seis rutas como literal exacto (seguido de comilla, `?` o `#`); (c) el propio matcher no confunde `/sme-requests`, `` `/application-reviews/${id}/evidence` `` ni `` `/admin/pymes/${id}/evidence` ``. Antes del borrado: 2 fallando, ~50 archivos ofensores.
- GREEN: 3/3 tras el borrado. Ajustes de tests vivos: `demo-navbar` (test e historias) y `trust-banner.test.tsx` apuntan a rutas por rol (`/explore`, `/company`, `/portfolio`, `/reports`, `/admin`); `route-gate.test.ts` usa `/help` como ruta neutra (`/login` no sirve: redirige al usuario con sesión).

**Inventario borrado** (cada módulo verificado con un recorrido del grafo de imports desde todas las rutas vivas y `proxy.ts`)

| Área | Archivos | Líneas (+/−) |
|---|---|---|
| `app/(demo)/` | 22 | +0 / −1126 |
| `presentation/` | 83 | +55 / −7375 |
| `state/` | 25 | +9 / −2145 |
| `application/` | 39 | +9 / −2796 |
| `infrastructure/` | 18 | +14 / −1007 |
| `src/test/route-harness.tsx` | 1 | −68 |
| `e2e/` | 10 | +11 / −1191 |
| `e2e-live/` | 5 | −491 |
| `tests/` (raíz) | 4 | +8 / −58 |
| Total (`git diff --stat 3ca174c 709fc28`) | 212 | +190 / −16265 |

- Componentes: los 25 del recorrido (shell, progreso, navegación de pasos, workspaces de solicitud/IA/decisión/campaña/distribución/evidencia, paneles y formularios) con sus tests e historias, más `text-area` (sin importador restante).
- Estado: `demo-journey`, `journey-url-sync`, `use-demo-step`, `use-assessment`, `use-persisted-assessment`, `use-human-decision`, `use-manual-review-context`, `journey-store`, `journey-store-provider`. `use-sme-request.ts` queda sólo con `useSmeRequestState`.
- Aplicación: `assessment/assessment-view`, `decision/*`, `distribution/derivation-format`, `evidence/{evidence-review,evidence-timeline,review-mapper}`, `fixtures/*` (las historias de `bar-chart` y `campaign-card` llevan los datos inline), `navigation/{demo-steps,journey-params}`, `trust/step-disclosures`, `ports/{assessment,human-decision,manual-review}-gateway`.
- Infraestructura: `assessment/`, `decision/`, `manual-review/`.
- Podas parciales: `review-view-model.ts` sin `EvidenceReviewItem`/`ReviewItemKind`/`ReviewEvidence`; `infrastructure/sme/default-gateway.ts` sin la rama sin token (`accessToken` obligatorio; el único llamador, el gateway del navegador, siempre lo pasa).

**Código muerto desde antes de #438** (mismo recorrido sobre un `git archive` de `3ca174c` contando `(demo)` como vivo: ya inalcanzables, 13 módulos, borrados con sus tests e historias): `funding-workspace`, `use-funding-intent`, `infrastructure/funding/{default-gateway,http-funding-intent-gateway}`, `funding-intent-errors`, `ports/funding-intent-gateway`, `workspace-status`, `workspace-view-model`, `custody-note`, `timeline`, `chip-toggle-group`, `combo-box`, `infrastructure/http/fetch-http-client`.

**Se conserva, con quién lo importa**

- `application/distribution/derivation-failure-copy.ts` ← `company/distribution-signing.ts`.
- `application/funding/failure-reason-copy.ts` ← `company-sign-distribution.tsx`, `admin/evidence.ts`; `application/funding/xlm-amount.ts` ← `campaign/campaign-contribution.ts`, `portfolio/proofs.ts`.
- `application/evidence/submit-sme-request.ts` y `review-view-model.ts` ← `pyme-onboarding/review-step` (componente y aplicación); `sme-request-errors.ts` ← `submit-sme-request.ts`.
- `demo-navbar.tsx` conserva `singleLineNav`/`testnetLabel`: sus tests afirman ambos modos; sólo se quitaron los comentarios del recorrido.
- `e2e/support/stub-campaign-routes.mjs` y `stub-distribution-routes.mjs`: ningún spec vivo los ejercita, pero reflejan endpoints que usan funciones vivas (aporte/retiro de campaña, firma de distribución).
- Comentarios: ~15 archivos que nombraban módulos borrados se reescribieron (sólo comentarios), incluidos dos de `apps/api` (`submit-sme-request.ts`, `route-application-assessment.ts`).

**e2e**

- Stub: borrados `guided-journey`, `full-journey`, `human-decision`, `distribution-step`, `evidence-dashboard` y `campaign-vault`. `stub-api-server.mjs` sin `/__seed-assessment`, assessment POST/GET, decision POST/GET ni la exención sin Bearer para `sme:SYN-`; `stub-admin-review-routes.mjs` toma todas las decisiones (aplicación desconocida → 404 veraz); `targets.ts` sin `DEMO_APPLICATION_ID`; readiness de `playwright.config.ts` → `/login`.
- Live: borrados `campaign-vault.live.spec.ts`, `support/ui-actions.ts`, `support/campaign-api.ts`, `seedApprovedApplication`/`runPsql` (`support/db.ts`) y `DEMO_APPLICATION_ID`/`xlmToStroops` (`support/live-targets.ts`); `admin-review.live.spec.ts` no usa ninguno. Readiness de `playwright.live.config.ts` → `/login`. El aporte vía UI queda sin e2e live (hueco ya registrado).

**Guardas de la raíz (`tests/`)**

- `monthly-sales-feed-parity.*`: borrado; comparaba la copia web de las ventas sintéticas con la de la API y la copia web ya no existe.
- `testing-and-ci-gates.test.ts`: fija `APPLICATION_ID` (lo afirma `pyme-onboarding.spec.ts`) y `BUSINESS_CREATED_AT` en vez de `DECIDED_AT`/`CORRELATION_ID`; el recorrido de fuentes e2e espera `admin-review.spec.ts` y `pyme-onboarding.spec.ts`.
- `web-holds-no-network-passphrase.test.ts`: espera `campaign-contribution.tsx`, `use-campaign-vault.ts` y `use-company-distribution-signing.ts`, los flujos de firma que reciben el passphrase en la respuesta de la API. Ajuste sobre la propuesta: `company-sign-distribution.tsx` y `http-campaign-gateway.ts` existen pero no manejan el passphrase; el hook que lo maneja sí.

**Seguimiento del owner:** `derivation-failure-copy.ts` (vivo en la firma de distribución de la PyME) sigue diciendo «Retome el recorrido…» en tres mensajes. Cambiarlo es un cambio de copy visible y queda pendiente del owner. Siguen sin llamador web las rutas ADMIN ya registradas.

**Verificación**

- `pnpm --filter @vaqcrow/contracts build`: ok.
- `pnpm --filter @vaqcrow/web test`: «Test Files 194 passed (194) · Tests 1964 passed (1964)».
- `pnpm --filter @vaqcrow/web typecheck`: sin errores (tras `next build`, que regenera `.next/types` con referencias viejas a `(demo)`).
- `pnpm --filter @vaqcrow/web lint`: sin errores ni advertencias.
- `pnpm --filter @vaqcrow/web build`: ok; rutas `/`, `/_not-found`, `/admin`, `/admin/pymes`, `/admin/pymes/[applicationId]`, `/admin/pymes/[applicationId]/evidence`, `/campaigns/[id]`, `/company`, `/explore`, `/login`, `/portfolio`, `/reports`, `/signup`. Ninguna de las seis.
- `pnpm run verify`: la primera corrida falló en `typecheck:tests` (la guarda de paridad importaba el fixture borrado). Después de la autorización: exit 0 sin reintentos (contracts 661, domain 120, ai 143, api 2617, web 1964; «no dependency violations found (1073 modules, 3602 dependencies cruised)»; `test:boundaries` 163/163).
- `pnpm --filter @vaqcrow/web exec playwright test` (stub): 14 passed, 0 failed.

**Verificación independiente de WU6** (RDD apagado): PASS con notas. Recorrió `3ca174c..8c17f55`: sólo quedan las 12 páginas por rol (`next build` no lista ninguna de las seis rutas); ningún literal de las seis rutas en `apps/web/src`, `e2e`, `e2e-live` ni en las configs de Playwright; los módulos podados no afectan a sus llamadores vivos; confirmó 3 de los 13 módulos muertos antes de #438; `apps/api` sólo cambió comentarios; ningún doc ni `*-evidence.md` tocado. Confirmó que `campaign-contribution.tsx`, `use-campaign-vault.ts` y `use-company-distribution-signing.ts` son los que manejan la passphrase (el guard real es el escaneo AST de toda la web, sin cambios). Re-ejecutó typecheck, web test (194 / 1964), lint, `boundaries`, `test:boundaries` (163) y `next build`. Notas: (1) el matcher no detectaba subrutas (`/funding/${id}`): cerrado en `3213933` (RED: 1 test falló; GREEN: 3/3); (2) el guard sólo escanea `apps/web/src`, no `next.config` (hoy sin redirects); (3) al borrar `tests/monthly-sales-feed-parity*`, el dataset simulado de ventas de la API queda sin gemelo web: se registra en WU7.

### WU7 — Alinear la documentación con el recorrido retirado

- **Commit:** `14f0735` — `docs: align the docs with the retired scripted journey (#438)`.
- **Ruta:** delegada (writer único; trigger de escritura: 2+ archivos no triviales). Sin RED: cambio sólo de documentación; el chequeo es estructural (`cmp`, barrido `rg`) más `pnpm run verify`.

**Qué se tocó y por qué**

| Archivo | Cambio |
|---|---|
| `README.md` | «Recorrido vertical completo», «Límites actuales», «Diseño», la hoja de ruta y Playwright: en `main` sigue el recorrido; la rama de #438 lo retira (404, sin redirección), la evidencia queda por rol y la cadena admin en `/admin/pymes/[applicationId]/evidence`; los specs e2e vivos son por rol. |
| `AGENTS.md` / `CLAUDE.md` | Estado de los módulos por rol (ramas apiladas, no «not implemented»); la nota de Zustand apunta al patrón sobreviviente `session-store.ts`/`session-store-provider.tsx` (el `journey-store` se borró); Opción A habla de evidencia acotada al ensayo; decisión asentada nueva de #438 (D1, D2/D3, hashes persistidos, migraciones `20261009150000`/`20261009160000`, «Sin dato», rama fuera de `main`). Gemelos idénticos. |
| `docs/planning/DEMO.md` | Las tres menciones del recorrido «en `main`» aclaran que la rama de #438 ya lo retiró y dónde vive la evidencia; D1 registrado. |
| `docs/planning/demo-tasks-list.md` | #418: la pregunta del bloque de la landing queda resuelta por D1. #438: preguntas resueltas (D1, D2/D3, 2026-10-09), «Rama e implementación» con los work units y sus commits; #439/#440 explican que se entregaron como WU de la rama de #438; #441 pendiente (WU8). Las entradas históricas de #5/#16 no se tocaron. |
| `docs/planning/demo-run-preflight.md` | Opción A: la «página de evidencia» pasa a evidencia acotada al ensayo, y la cadena admin por solicitud. |
| `docs/architecture/environments.md` | §12: el ensayo en vivo es U9 (`admin-review.live.spec.ts`); se quitó la tabla y la advertencia sobre `(demo)/funding/page.tsx` y `campaign-vault.live.spec.ts`, con un aviso del hueco del aporte vía UI; sin el conteo «17 tests». §13: las páginas sin sesión, ya no «las rutas del recorrido». |
| `docs/architecture/identity-and-rls-boundaries.md` | §9: la ruptura de los gateways sin token ya se cerró en la rama de #438. |
| `docs/architecture/deploy-planning.md` | Nota fechada sobre la estructura e2e planificada (anterior a #438) con los specs reales. |
| `odd/tasks/application-review-and-vault-deployment.md` | Dos notas fechadas «2026-10-10 — #438», sin borrar texto: el spec live que bloqueaba la fábrica con tope se retiró, y la exención `sme:SYN-` del stub ya no existe. |

**Dejados como historia, sin cambios**

- `docs/planning/*-evidence.md`: nunca se editan.
- `odd/tasks/*.md` restantes (28 archivos con menciones a las seis rutas, `(demo)`, `full-journey` o «seis pasos»): son registros de cómo se hizo el trabajo. Sólo `application-review-and-vault-deployment.md` tenía afirmaciones vigentes que #438 cambió. `supabase-auth-roles-rls.md` («la demo desplegada (recorrido de seis pasos) sigue funcionando») sigue siendo cierto mientras `main` no reciba la pila.
- `demo-tasks-list.md` #5 y #16 (Epics/Features cerradas del recorrido) y `docs/architecture/monorepo.md` («journey crítico» genérico).
- Fuera de las superficies (registrados en «Pendientes del owner»): `docs/guides/freighter-and-testnet-walkthrough.md`, `docs/design/demo-ui.md`, `docs/design/claude-design-brief.md`, `docs/design/claude-design-continuation-pack.md`.

**Verificación**

- `cmp AGENTS.md CLAUDE.md`: sin diferencias.
- Barrido `rg` (seis rutas, `(demo)`, `journey-store`, `full-journey`, `campaign-vault.live`, `evidence-workspace`) en Markdown fuera de `*-evidence.md` y `odd/`: las menciones que quedan en README, gemelos, `DEMO.md`, `demo-run-preflight.md`, `environments.md` y `demo-tasks-list.md` describen `main` o el retiro; las restantes están en los cuatro archivos fuera de superficie listados arriba.
- `pnpm run verify`: exit 0 en la primera corrida (contracts 661, domain 120, ai 143, api 2617, web 1964; «no dependency violations found (1073 modules, 3602 dependencies cruised)»; `test:boundaries` 163/163).

### WU7b — Guía del operador y notas de diseño

- **Commit:** `13ea32f` — `docs: rewrite the Freighter and Testnet walkthrough for the role workflows (#438)`.
- **Decisión del owner (2026-10-10):** reescribir la guía viva del operador para los flujos por rol y agregar notas fechadas, sin reescribir la historia, en los tres documentos de diseño que WU7 había dejado fuera de superficie.
- **Ruta:** delegada (writer único; trigger de escritura: guía reescrita + tres notas + bitácora). Sin RED: cambio sólo de documentación; el chequeo es estructural (barrido `rg`, `cmp`) más `pnpm run verify`.

**Qué se tocó**

| Archivo | Cambio |
|---|---|
| `docs/guides/freighter-and-testnet-walkthrough.md` | Reescrita: callout «2026-10-10 — #438: qué cambió» (las seis rutas responden 404, sin redirección; la rama no está en `main`), ruta rápida, tabla de los tres roles y qué firma cada uno, y el recorrido PyME (alta «Soy PyME», wizard «Registrar mi PyME», «Enviar a revisión» con Freighter obligatorio) → ADMIN (`/admin`, cola, revisión, «Aprobar con límite», despliegue) → INVERSOR (`/explore`, `/campaigns/[id]`, KYC simulado, «Aportar a la campaña», «Firmar en Freighter», «Enviada · pendiente de confirmación») → PyME (`/company`, «Declarar ventas», «Revisar y firmar») → evidencia por rol y cadena admin. Se conservan Freighter, Testnet, Friendbot, la regla no custodia, la passphrase, los tres estados, el reembolso sin permisos, «Qué NO hacer» y la corrección del 2026-09-25. Se quitó la nota de la fecha límite a las 00:00 UTC (el plazo ahora sale del wizard). |
| `docs/design/demo-ui.md` | Nota «2026-10-10 — #438» antes de la tabla pantalla → ruta: rutas retiradas, vale la regla de rutas en inglés, evidencia por rol y cadena admin. |
| `docs/design/claude-design-brief.md` | Nota fechada bajo el aviso inicial: brief histórico, sus rutas «heredadas» se retiraron. |
| `docs/design/claude-design-continuation-pack.md` | Nota fechada bajo el aviso inicial: pack histórico, `/request` y `/funding` se retiraron. |

**Verificado contra el código** (rama de #438, sin ejecución en vivo)

- Rutas: árbol de `apps/web/src/app` (`/`, `/login`, `/signup`, `/company`, `/portfolio`, `/reports`, `/explore`, `/campaigns/[id]`, `/admin`, `/admin/pymes`, `/admin/pymes/[applicationId]`, `/admin/pymes/[applicationId]/evidence`).
- Alta e ingreso: «Soy PyME» / «Soy inversor», «Nombre completo» / «Nombre o Razón Social», rechazo por selector incorrecto y redirección `INVERSOR` → `/portfolio`, `PYME` → `/company` (`application/auth/auth-form.ts`); `/admin` es la pantalla de ingreso y lleva a `/admin/pymes` (`admin-guard.ts`).
- Wizard: pasos «KYC», «Registro PyME», «Evaluación AI», «Revisión humana»; «Iniciar verificación simulada», «KYC aprobado · SIMULADO», «Siguiente paso», «Completar con datos de ejemplo», «Enviar a evaluación AI», «Continuar» / «Corregir datos», «Conectar Freighter», «Obligatorio», «Enviar a revisión», «En proceso», «Solicitud enviada · en revisión.» (`application/pyme-onboarding/*-step.ts`). Conectar la wallet firma un **mensaje** (`wallet.signMessage` del challenge, `wallet-connection.ts`), no una transacción; la guía lo dice así.
- Admin: «Pendiente de revisión», «Revisar solicitud» (`queue.ts`); «1 · KYC/KYB», «2 · Recomendación de IA» con «Consultiva · no aprueba», «3 · Decisión humana», «Aprobar con límite», «Registrar decisión» → «Confirmar» (`kyc.ts`, `assessment.ts`, `decision.ts`); estados del despliegue hasta «Bóveda confirmada / PyME publicada», «Actualizar», «Desplegar», «Reintentar» (`deployment.ts`). La aprobación dispara el despliegue en segundo plano (`record-human-decision.ts`); el alta de la cuenta de la PyME con 2 XLM sigue en `open-campaign.ts`.
- Inversor: «Ver evidencia y riesgo» → `/campaigns/{id}` (`marketplace/view-model.ts`), «Ingresá para ver esta campaña», «Aportar a la campaña», sin wallet → `/portfolio`, «Firmar en Freighter», «Enviada · pendiente de confirmación», «Retirar mi aporte» / «Reembolsar» (`portfolio/actions.ts`), estados «Fondeo abierto» / «Meta alcanzada» / «Reembolso disponible» (`company/campaign-state.ts`).
- PyME: «Bóveda y distribuciones», «Distribuciones», «Enviar declaración», «Consultar estado», «Ver la transacción en el explorador», «Cálculo determinístico; la IA no calcula esta obligación» (`company/copy.ts`, `company-declare-sales.tsx`, `company-sign-distribution.tsx`).

**Etiquetas owner-pending** (marcadas en la guía con una nota al pie, sin inventar copy): «Aprobar y continuar» (KYC del inversor, #422), «Declarar ventas» y «Revisar y firmar» (#434), «Tus transacciones de aporte», «Aportes en el período» y «Ver bóveda en el explorador» (WU5), «Evidencia», «Ver evidencia Testnet» y los títulos «1 · Solicitud» … «6 · Reconciliación» de la cadena admin (WU4).

**Verificación**

- Barrido `rg -n '"?/(request|ai-assessment|approval|funding|distribution|evidence)\b' docs/guides docs/design`: las menciones que quedan están en las notas fechadas, en el texto histórico de los dos briefs y de `demo-ui.md`; tres falsos positivos del patrón (`/admin/pymes/[applicationId]/evidence` en la guía; «warnings/evidence» y «distribution-pending» en un prompt en inglés de `demo-ui.md`).
- `cmp AGENTS.md CLAUDE.md`: sin diferencias (no se tocaron).
- `pnpm run verify`: exit 0 en la primera corrida (contracts 661, domain 120, ai 143, api 2617, web 1964; «no dependency violations found (1073 modules, 3602 dependencies cruised)»; `test:boundaries` 163/163).

### WU8 — Documento de evidencia

- **Commit:** `890e2d8` — `docs(evidence): close Feature #438 with the journey retirement evidence (#441)`.
- **Ruta:** delegada (writer único; documento de evidencia + bitácora). Sin RED: cambio sólo de documentación.
- **Nombre del archivo:** `retire-scripted-journey-evidence.md`, como fijaron `demo-tasks-list.md` (#441) y esta bitácora; el issue #441 pide `retire-scripted-demo-journey-evidence.md`. La diferencia queda declarada en el documento (criterio 2 de #441, ⚠️).
- **Mapeo:** 17 criterios citados textualmente (#438: 7, #439: 3, #440: 3, #441: 4): 13 ✅, 4 ⚠️, 0 ❌. Los ⚠️: #438 «replacement features are live…» (verificados en la rama, no desplegados en `main`), #438 «Required evidence and failure behavior…» (aporte/retiro/reembolso desde la UI sin e2e live), #439 «matching the template screens and copy…» (vistas sin pantalla en el template, copy owner-pending) y #441 (nombre del archivo).

**Verificación re-ejecutada para el documento** (2026-10-10, árbol de trabajo en `295eae2`)

- `pnpm run verify`: exit 0 en la primera corrida, sin reintentos (contracts 661, domain 120, ai 143, api 2617, web 1964; lint sin advertencias; «no dependency violations found (1073 modules, 3602 dependencies cruised)»; `test:boundaries` 163/163).
- `pnpm --filter @vaqcrow/web build`: ok; 13 rutas (`/`, `/_not-found`, `/admin`, `/admin/pymes`, `/admin/pymes/[applicationId]`, `/admin/pymes/[applicationId]/evidence`, `/campaigns/[id]`, `/company`, `/explore`, `/login`, `/portfolio`, `/reports`, `/signup`), ninguna de las seis.
- `pnpm --filter @vaqcrow/web exec vitest run src/app/retired-journey-routes.test.ts`: 3/3.
- `pnpm --filter @vaqcrow/web exec playwright test` (stub): 14 passed.
- `pnpm run env:docker:status`: Supabase local, Quickstart y API sanos.
- `supabase migration list --local`: `20261009150000` y `20261009160000` aplicadas en la base local.
- `pnpm run test:db`: «Files=23, Tests=869 … Result: PASS».
- El remoto no se consultó: se cita la verificación del 2026-10-09 (WU1, WU3).

**Pendiente:** la PR de la pila a `main` la abre el orquestador con autorización del owner; su número se agrega aquí y en el documento de evidencia.
