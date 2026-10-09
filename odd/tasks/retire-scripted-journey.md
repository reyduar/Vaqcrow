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
- [ ] **WU2** Ruta ADMIN de evidencia por solicitud (`GET /application-reviews/:applicationId/evidence`, en `route-policy.ts` + MATRIX de `authorization.test.ts`): decisión, despliegue (hash + URL), bóveda (dirección + URL), aportes[], distribuciones[] (`listByCampaign`), reconciliación guardada sin llamar a la cadena. Contrato en `packages/contracts` (+ barrel).
- [ ] **WU3** Roles: `transactionHash` + `explorerUrl` en distribuciones de portafolio, informes y mis campañas; hashes de aporte en portafolio/informes; `vaultExplorerUrl` en portafolio, mis campañas y detalle de campaña. Vistas con columnas agregadas al final; contratos y rutas.

Porción B — transparencia (web)
- [ ] **WU4** Vista admin `/admin/pymes/[applicationId]/evidence`: línea de tiempo de la cadena completa (reusa `EvidenceTimeline`, builder por arrays sin la entrada «Caso simulado»), link «Evidencia» desde la fila de la cola y desde la revisión.
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
- **Remoto:** pendiente — lo aplica el orquestador con autorización del owner, con `version` `20261009150000`.

**Advertencias**

- `observed_at` es el instante de la lectura de cadena que confirmó el éxito (`chainState.observedAt`), no el cierre del ledger.
- Los aportes enviados antes de este cambio no tienen fila: se muestran «Sin dato».
