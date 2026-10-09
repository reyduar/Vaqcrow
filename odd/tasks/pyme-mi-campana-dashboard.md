# Bitácora — Feature #434: Mi campaña de la PyME

Rama: `Vaqcrow#434_Feat_Deliver_the_PyME_Mi_campaña_dashboard`, creada desde la punta de #430 (`74237b1`).

## Objetivo

Entregar el dashboard **«Mi campaña»** de la PyME (template `Vaqcrow Portafolio.dc.html`, **modo pyme**, líneas ~266-291): tarjeta de wallet, stats («Fondeado» / «Aportantes»), «Bóveda y distribuciones» (vigentes e históricas) con sort, «Ventas declaradas · 2026», «Distribuciones» con la acción «Revisar y firmar», la declaración mensual de ventas, el dinero en ARS + equivalente XLM, y los estados de la solicitud.

## Problema y por qué

`/company` hoy sólo renderiza un heading, el botón «Registrar mi PyME» y —si hay wallet— la `WalletCard`. La PyME no ve el estado de su bóveda, sus ventas declaradas, sus distribuciones ni puede firmarlas. #434 cierra el lado PyME y es prerequisito de #438 (camino a `main`).

## Decisiones del owner (2026-10-09)

| # | Pregunta del issue | Resolución |
|---|---|---|
| D1 | Entrada de la declaración mensual + validación/anomalía. | **Combinar simulado + real**: datos simulados para la demo **y** el form preparado para **montos reales** (helper «Completar con datos de ejemplo», como el wizard de onboarding). El `POST /businesses/:id/sales-periods` debe aceptar montos declarados. |
| D2 | Pantalla/modal «Revisar y firmar». | **Reusar el flujo actual**: `prepare` → `TransactionReviewModal` → Freighter → `submit`, por distribución dentro de la lista (el `distribution-workspace` ya lo hace). |
| D3 | Bóvedas históricas y varias campañas por PyME. | **Listar todas** (vigente + históricas) en «Bóveda y distribuciones». |
| D4 | Convención de doble visualización ARS + XLM. | **ARS principal + «≈ X XLM»** con la conversión sintética existente (`fx_rate`), badge `SIMULADO`. |
| D5 | Cargar fondos en la wallet de la PyME (no diseñado). | **Guía/atajo friendbot de Testnet** (no custodial: Vaqcrow no mueve fondos). |
| D6 | Vistas de la PyME (En revisión / Requiere cambios / Rechazada) y vacío previo. | **Todas**, reusando `EmptyState` y el estado de la `sme_request`. |

## Alcance autorizado

- **Lectura «mis campañas»** (backend): campañas del PyME (vigente + históricas) con su estado, aportantes, fondeo, distribuciones y ventas declaradas; contrato + port/adaptador (vistas `service_role`) + caso de uso + ruta `only("PYME")`.
- **Declaración mensual**: extender `POST /businesses/:id/sales-periods` para aceptar montos declarados (+ reglas de anomalía), con helper demo en la web.
- **Eventos**: publicar `pyme.goal_reached`, `pyme.distribution_ready`, `pyme.declare_sales` (definidos pero sin publicar).
- **Vista `/company`**: las secciones del template, ARS+XLM, sort, estados, guía friendbot, y el reuso del flujo de firma.
- Tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- La regla determinística vive en `packages/domain`; la IA nunca calcula obligaciones.
- Sólo la PyME dueña firma sus distribuciones; `sent ≠ confirmed`.
- No custodial; una sola conversión ARS/XLM sintética rotulada `SIMULADO`.
- Nunca prometer retorno; `SIMULADO`/`TESTNET`/`DEMO`; «Sin dato / faltante» nunca es cero.
- `packages/contracts` portable; `apps/web` consume sólo contratos; `presentation/` no importa contratos salvo type-only; `application/` (web) sin React.

## Datos (del mapeo)

- `/company` hoy: heading + botón + `WalletCard` condicional; sin stats/bóveda/ventas/distribuciones.
- Motor de distribuciones reutilizable: `packages/domain/src/revenue-share.ts`, `prepare/submit/get` use cases, rutas `POST /revenue-share-distributions` + `/submission` + `GET /:id`; preparar/submit `only("PYME")`, get `only("PYME","ADMIN")`. La firma es **web** (Freighter); el backend verifica/somete.
- Ventas: `GET`/`POST /businesses/:id/sales-periods` (`only("PYME")`), `business_sales_period`; el POST hoy sólo re-persiste la serie simulada (no acepta montos).
- ARS↔XLM: `fx_rate` (RateTableRepositoryPort) + `stellar-amounts.ts`; la derivación de distribución ya trae un bloque `conversion` sintético.
- Múltiples campañas por PyME **permitidas** (sin unique en `campaign.application_id` ni `businesses.owner_user_id`).
- Notificaciones: `pyme.goal_reached`/`pyme.distribution_ready`/`pyme.declare_sales` definidos, **sin publicar**.
- Componentes reusables: `kpi-tile`, `bar-chart` (status `reported|missing|anomalous`), `distribution-workspace` (flujo completo + «Revisar y firmar»), `transaction-review-modal`, `transaction-status-list`, `wallet-card`, `empty-state`, `distribution-derivation` (bloque ARS/XLM).

## Tareas

- [x] **WU1a — Modelo de lectura «mis campañas» (backend).** Contrato + port/adaptador (vistas `service_role`) + caso de uso + ruta `only("PYME")` que devuelve las campañas del PyME (vigente + históricas) con estado, fondeo/aportantes, distribuciones (ARS+XLM) y ventas declaradas. Sin `apps/web`.
- [x] **WU1b — Declaración de ventas (backend).** `POST /businesses/:id/sales-periods` acepta montos declarados (además del demo `{}`); sin eventos (diferidos a otro WU por sus puntos de disparo).
- [x] **WU2 — Dashboard `/company` (web).** Wallet card, stats (ARS+XLM), «Bóveda y distribuciones» (lista de campañas + sort), «Ventas declaradas · 2026», «Distribuciones». Slots (sin cablear) para declaración (WU3) y «Revisar y firmar» (WU4); estados de la solicitud y guía friendbot → WU5.
- [ ] **WU3 — Declaración mensual (web).** Form preparado para montos reales + helper «Completar con datos de ejemplo»; reusa el POST extendido.
- [ ] **WU4 — Revisar y firmar (web).** Reuso del flujo `distribution-workspace` (`TransactionReviewModal` + Freighter), por distribución.
- [ ] **WU5 — Estados y guía.** Vistas de estado + vacío previo + guía friendbot de Testnet.
- [ ] **WU6 — Verificación y evidencia.** Suites, `verify`, `docs/planning/pyme-mi-campana-dashboard-evidence.md`.

Forecast: Feature grande. Entrega **feature-branch-chain**.

## Checks aplicables

- `pnpm --filter @vaqcrow/contracts test`, `pnpm --filter @vaqcrow/api test`, `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run boundaries`, `pnpm run test:boundaries`
- `pnpm run test:db` si el work unit toca el esquema o una vista.
- `pnpm run verify` al cierre de cada work unit.

## Progreso

### WU1a — Modelo de lectura «mis campañas» (commit `ab9e8ea`)

Ruta: **delegado** (un writer; contrato + port + caso de uso + adaptador + ruta + política + 3 vistas SQL + pgTAP + wiring, 2+ archivos no triviales). Sin `apps/web`.

- **Diseño.** Endpoint `GET /my-campaigns` (**`only("PYME")**). Devuelve **todas** las campañas del PyME (vigente + históricas, D3), cada una con: nombre/sector/ciudad/imagen, `vaultAddress`, estado (`funding`/`settled`/`refunding`), `goalArs`, `raisedArs` (nulo sin snapshot), `fundedPercentBps`, `deadline`, `contributorsCount`, distribuciones (`amountArs` **y** `amountXlm`, D4) y la serie de ventas declaradas. **Dato dueño**: `campaign.application_id → sme_request.application_id → sme_request.owner_user_id`; la empresa es la `businesses` más nueva de ese dueño. Identidad desde `request.principal.userId`. Conversión ARS↔XLM con el snapshot de FX persistido (misma fórmula que el portafolio `raisedArs`); `null`, nunca `0`. 3 vistas `security_invoker` sólo `service_role`. Errores saneados (`401`/`403`/`503`).
- **RED/GREEN observado.** RED: contrato/uso de caso/adaptador/ruta ausentes. GREEN: contracts **617** (23 archivos), api **2485** (119), `test:db` **23 archivos / 828 tests PASS** (`my_campaigns.sql` 60 aserciones), `tsc` limpio, `boundaries` sin violaciones (1178 módulos / 3840 deps).
- **Verificación independiente (RDD off).** Un verifier read-only: **7/7 PASS**, sin bloqueantes. Confirmó `only("PYME")`+MATRIX, scoping por dueño sin fuga, honestidad (XLM 7-dec, `null`≠`0`, snapshot FX), vistas `service_role`-only, rutas/errores saneados y wiring.
- **Gotcha aplicado.** La reversión de `campaign_persistence.sql` dropea las 3 vistas nuevas antes de sus tablas base.
- **Advisories (no bloqueantes).** Orden de campañas por `created_at desc` del adaptador (no re-sorteado en el caso de uso); `Number(bigint)` para ARS sin guarda >2^53; sin test de "body ignorado" (GET sin body); forma 200 validada en casos de uso/contrato, no en la ruta.
- **Migración remota.** `20261009140000_create_my_campaigns_views.sql` probada en local y luego, con **autorización explícita del owner**, **aplicada al proyecto remoto** (2026-10-09) vía MCP, con el `version` del historial **alineado al repositorio** (`20261009140000`). Verificado en el remoto: 3 vistas con `security_invoker=true` (**18 / 6 / 5** columnas), `SELECT` sólo `service_role` y cero grants a `anon`/`authenticated`; advisors sin clase nueva.
- **Límite explícito.** Sin `apps/web` (el dashboard es WU2).

- **Work-unit commit.** `ab9e8ea feat(api): add the PyME my-campaigns read model (#434)`.

### WU1b — Declaración de ventas (commit `140d1e7`)

Ruta: **delegado** (un writer; contrato + caso de uso + ruta dual-path + tests). Eventos **diferidos**.

- **Diseño (D1).** `POST /businesses/:id/sales-periods` con **dos caminos**: cuerpo `{}` = refresh simulado del proveedor (demo, sin cambios); cuerpo `{ periods: [{ period: YYYY-MM, salesArs: int≥0 | null }] }` = **montos declarados** (validado estricto, ownership como hoy, persistido con `source: "declared"`). `null` = mes faltante (`status: "missing"`), nunca `0`. **Regla de anomalía determinística** (documentada): un mes es `anomalous` si su monto es **≥ 2×** o **≤ ½** del promedio de los meses reportados previos de la misma declaración; el primer mes queda `reported`. Respuesta `200 { businessId, periods }`; `400` payload inválido; `401/404/503` saneados.
- **RED/GREEN observado.** RED: contrato (15 casos), caso de uso (módulo ausente), ruta (6 casos). GREEN: contracts **633**, api **2516**, `test:db` **828**, `tsc` limpio, `boundaries` sin violaciones (1181 módulos / 3852 deps).
- **Verificación.** Spot-check del padre (lectura de la ruta dual-path + re-run enfocado 44/44); la verificación independiente se integra en WU6.
- **Eventos diferidos (puntos de disparo reportados).** `pyme.declare_sales` → tras persistir la declaración en `sales-feed.route.ts`; `pyme.goal_reached` → reconciliación/detección de meta (`reconcile-campaign.ts`); `pyme.distribution_ready` → derivación/preparación de distribución. Ninguno se publica hoy.
- **Advisories.** El response declarado no tiene contrato compartido (la superficie aprobada del barrel se limitó al request); `Number(bigint)` para ARS (patrón preexistente); el adapter de ventas quedó como *characterization* (sin cambio de comportamiento).

- **Work-unit commit.** `140d1e7 feat(api): allow the PyME to declare monthly sales (#434)`.

### WU2 — Dashboard `/company` (web) (commit `a4b17a3`)

Ruta: **delegado** (un writer; port + gateway + factory + null object + hook SWR + helpers puros + componentes + container + workspace, 2+ archivos no triviales). Sin declaración ni firma (WU3/WU4) ni estados/guía (WU5).

- **Diseño.** Capa de datos calcada del cuarteto del portafolio contra `GET /my-campaigns`: bearer, errores saneados, `imageSrc` absoluta. Hook SWR `["my-campaigns"]`. Helpers puros: formatos ARS (`es-AR`) + «≈ N XLM» (7 dec) + fecha; copy de estado de campaña; sort `Recientes`/`Por estado`; series de ventas (`reported`/`missing`/`anomalous`); distribuciones (ARS+XLM, `needsSignature`); stats. Componentes: stats (`Fondeado` + nota, `Aportantes`), «Bóveda y distribuciones» (lista de todas las campañas + sort + bloque de bóveda), «Ventas declaradas · 2026» (bar-chart), «Distribuciones» + footnote. Slots presentacionales deshabilitados («Disponible próximamente») para declaración y firma. Estados loading/error+retry/vacío previo. Se preservan el wallet card, «Registrar mi PyME» y el wizard.
- **RED/GREEN observado.** RED: `application/company` (6 archivos) sin resolver. GREEN: web enfocado **67/67** (11 archivos); contracts build OK; `tsc` limpio; `lint` sin errores (1 warning preexistente); `boundaries` sin violaciones (1218 módulos / 3949 deps).
- **Verificación independiente (RDD off).** Un verifier read-only: **7/7 PASS**, sin bloqueantes. Corregida inline la desviación de copy del footnote (punto final sobrante respecto al template).
- **Advisories / owner-pending.** `Aportantes` suma conteos por campaña (puede sobrecontar cuentas en varias campañas); un gráfico de ventas por campaña con datos (el template diseña una sola); copy de los slots «Declarar ventas»/«Revisar y firmar»/«Disponible próximamente», vacío previo y «Sin distribuciones» owner-pending; el estado de la solicitud (En revisión/Requiere cambios/Rechazada) no se obtuvo limpiamente → diferido a WU5 (no inventado).

- **Work-unit commit.** `a4b17a3 feat(web): add the PyME Mi campaña dashboard (#434)`.
