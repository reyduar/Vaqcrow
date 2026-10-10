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
- [ ] **WU5** Inversor, PyME y detalle de campaña: `HashDisplay` con link al explorador en aportes, distribuciones y bóveda; «Sin dato» para lo histórico.

Porción C — retiro
- [ ] **WU6** RED: test de que las seis rutas no se sirven y nada las enlaza. GREEN: borrar `(demo)/`, código muerto (inventario del mapeo), e2e del recorrido, `campaign-vault.live.spec.ts` y sus soportes, handlers del stub; readiness de Playwright a rutas vivas.
- [ ] **WU7** Docs: README, `DEMO.md`, `docs/architecture/*`, `demo-tasks-list.md`, `odd/tasks/*` vigentes y los gemelos `AGENTS.md`/`CLAUDE.md`. Las `*-evidence.md` no se reescriben.

Porción D — cierre
- [ ] **WU8** Evidencia `docs/planning/retire-scripted-journey-evidence.md` (#441, en español) y PR de la pila a `main` (decisión del owner).

## Pronóstico de entrega

Unas 2.000 líneas autoradas sin el borrado (WU1 ~250, WU2 ~450, WU3 ~350, WU4 ~450, WU5 ~250, WU7 ~250) más el borrado de WU6 (miles de líneas eliminadas). Supera el umbral de ~400: se entrega como `feature-branch-chain`, una PR por work unit.

## Checks aplicables

- `pnpm run verify` (lint, typecheck, test, build, boundaries, test:boundaries) por work unit; reintentar timeouts bajo carga.
- Migraciones: `supabase migration up --local` → `pnpm run test:db` → remoto vía MCP con `version` alineado.
- `@vaqcrow/contracts` se construye antes de los tests de `apps/api`.
- RDD apagado: verificación independiente tras cada writer.

## Pendientes del owner

- Copy de la vista de evidencia admin y de los estados «Sin dato» (owner-pending, diseñado con el template).
- Tras el merge a `main`: re-apuntar `STELLAR_CAMPAIGN_FACTORY_ID` en Railway a `CCDNM6W4…SV7J` (`application-review-and-vault-deployment-evidence.md:308`).
- Seguimiento: rutas ADMIN sin llamador web; e2e live del aporte vía UI.

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
