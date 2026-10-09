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

- [ ] **WU1 — Modelo de lectura «mis campañas» + declaración de ventas (backend).** Contrato + port/adaptador (vistas `service_role`) + caso de uso + ruta `only("PYME")` que devuelve las campañas del PyME (vigente + históricas) con estado, fondeo/aportantes, distribuciones y ventas declaradas. Extender `POST /businesses/:id/sales-periods` para aceptar montos declarados (+ anomalía). Publicar los 3 eventos. Sin `apps/web`.
- [ ] **WU2 — Dashboard `/company` (web).** Wallet card, stats (ARS+XLM), «Bóveda y distribuciones» (lista de campañas + sort), «Ventas declaradas · 2026», «Distribuciones», estados (En revisión / Requiere cambios / Rechazada / vacío).
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

_(pendiente)_
