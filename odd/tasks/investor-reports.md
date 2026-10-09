# Bitácora — Feature #430: Informes del inversor (Informes)

Rama: `Vaqcrow#430_Feat_Deliver_investor_reports`, creada desde la punta de #426 (`e4c82a8`).

## Objetivo

Entregar la vista **«Informes»** (template `Vaqcrow Informes.dc.html`): selector de período, KPIs con badge de fuente, gráfico de distribuciones mensuales (+ tabla accesible), ventas declaradas por PyME y últimas distribuciones, con exportación y rangos personalizados según la decisión del owner.

## Problema y por qué

`/reports` es hoy un **404 pendiente**: sólo existe el ítem de menú `Informes → /reports` en `shell-nav.ts` (menú INVERSOR), sin ruta ni datos. El inversor no tiene un informe de su actividad; #430 lo entrega y es el paso previo a #438 (camino a `main`).

## Decisiones del owner (2026-10-09)

| # | Pregunta del issue (no diseñada en el template) | Resolución |
|---|---|---|
| D1 | Informes para PYME o ADMIN (el template los reserva a inversores). | **Todos los roles autenticados** (PYME, INVERSOR, ADMIN). Supersede el "reservado a inversores" del template. Implica widen del gate de ruta y política `AUTHENTICATED`. |
| D2 | Export funcional vs. deshabilitado. | **Export funcional**: descarga **CSV** + **imprimir-a-PDF** (estilos de impresión), **sin dependencias nuevas**. **Supersede el criterio de aceptación** del issue *"export remains disabled with the quoted message"*. |
| D3 | Rangos personalizados. | **Sí**: además de los 3 presets, rango **desde/hasta**. |
| D4 | Cómo se generan los períodos (el template fija 2026). | Los presets se generan **desde el rango de datos del inversor** (últimos meses con aportes/distribuciones), sin año fijo en el código. |

> [!warning] Criterio superseded
> El criterio de aceptación *"Empty-period, loading and partial-error states behave as designed; export remains disabled with the quoted message"* queda **parcialmente superseded** por D2: la exportación pasa a ser funcional. La evidencia lo registra explícitamente.

## Alcance autorizado

- **Endpoints nuevos de lectura** (no existen): el informe del período (KPIs + serie mensual + últimas distribuciones) y las ventas declaradas por PyME (bloque con error propio). Contrato en `packages/contracts`, port + adaptador (vistas SQL `service_role`) + casos de uso + rutas + política.
- **Vista `/reports`** (web) con las secciones del template, presets + rango personalizado, export (CSV + imprimir-a-PDF) y estados (vacío/carga/error de bloque).
- **Gate de ruta** para permitir todos los roles autenticados (hoy `route-gate.ts` mapea path→rol único).
- Tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- Agregación **determinística, server-side**; la IA no calcula ninguna obligación.
- Nunca prometer retorno; `SIMULADO`/`TESTNET`; riesgo texto + ícono (nunca sólo color); **tabla accesible** además del gráfico; «Sin dato / faltante» nunca es cero.
- `packages/contracts` portable; `apps/web` consume sólo contratos; `presentation/` no importa contratos salvo type-only; `application/` (web) sin React.
- No custodial; sin secretos, seeds, PII ni claims de producción.
- No inventar copy que el template no diseñe; lo no diseñado lo decide el owner (D1–D4).

## Datos (del mapeo, `docs/...` + código)

- **Aportes**: `campaign_contribution` es **una fila acumulada** por `(campaign_id, investor_account_id)`, sin fecha por evento; sólo `created_at`/`last_observed_at` → **«Aportado en el período» se fecha por esa marca (aproximación, documentar)**.
- **Distribuciones**: `revenue_share_distribution` tiene `created_at`/`confirmed_at` + `period` `YYYY-MM` y estado `submitted|confirmed|failed`; el recipient tiene `amount_stroops` por `account_id`. Filtrado por período directo.
- **Ventas declaradas**: `business_sales_period` (`business_id`, `period` `YYYY-MM`, `sales_ars` nulo = faltante, `status`) — persistido, sólo `service_role`.
- No hay agregador de períodos reutilizable; se construye uno nuevo.

## Tareas

- [x] **WU1 — Modelo de lectura del informe (backend).** `GET /reports` (KPIs + serie mensual + últimas distribuciones del período) y `GET /reports/sales-by-pyme` (ventas declaradas de las PyMEs con aporte del inversor, para el bloque con error propio). Contrato + port/adaptador/vistas + casos de uso + rutas + política (`AUTHENTICATED`) + pgTAP. Sin `apps/web`.
- [ ] **WU2 — Vista `/reports` (web).** Selector de período (3 presets generados desde los datos + rango personalizado), KPI cards con badge de fuente, gráfico mensual + tabla accesible, bloque «Ventas declaradas por PyME» con error propio, «Últimas distribuciones», estados vacío/carga.
- [ ] **WU3 — Export.** Descarga CSV + imprimir-a-PDF (estilos de impresión, sin deps nuevas).
- [ ] **WU4 — Acceso.** Gate de ruta para todos los autenticados + política; revisar el menú.
- [ ] **WU5 — Verificación y evidencia.** Suites, `verify`, `docs/planning/investor-reports-evidence.md`.

Forecast: Feature grande (mayor que #426 por el alcance ampliado). Entrega **feature-branch-chain**: cada work unit commitea en esta rama.

## Checks aplicables

- `pnpm --filter @vaqcrow/contracts test`, `pnpm --filter @vaqcrow/api test`, `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run boundaries`, `pnpm run test:boundaries`
- `pnpm run test:db` si el work unit toca el esquema o una vista.
- `pnpm run verify` al cierre de cada work unit.

## Progreso

### WU1 — Modelo de lectura del informe (commit `bc165df`)

Ruta: **delegado** (un writer; contrato + port + 2 casos de uso + adaptador + 2 rutas + política + 3 vistas SQL + pgTAP + wiring, 2+ archivos no triviales). Sin `apps/web`.

- **Diseño.** Endpoints `GET /reports` y `GET /reports/sales-by-pyme`, **`AUTHENTICATED`** (todos los roles, D1). `from`/`to` en `YYYY-MM` (default = últimos 6 meses hasta el último período disponible); `availableRange` (`firstPeriod`/`lastPeriod`) para que la web arme presets y rango personalizado. KPIs (aportado, distribuciones confirmadas, pendientes, campañas con aporte), serie mensual (`confirmed`/`pending`/`none`) y últimas distribuciones (cap 5). Identidad **server-side** desde `profile.stellar_public_key` (un `?investor=` se ignora). Agregación determinística, **bigint**, XLM canónico de 7 decimales; `null` nunca es `0`. Aportes fechados por `coalesce(last_observed_at, created_at)` (**aproximación documentada**: `campaign_contribution` es una fila acumulada por campaña+inversor, sin fecha por evento); distribuciones por `period`. 3 vistas `security_invoker` sólo `service_role` (`investor_report_contribution`/`_distribution`/`_sales_by_pyme`). Errores saneados (`400`/`401`/`503`).
- **RED/GREEN observado.** RED: contrato ausente; 7 fallos del caso de uso (schema pre-build); 1 fallo de la serie vacía. GREEN: contracts **604** (22 archivos), api **2455** (116), `test:db` **22 archivos / 768 tests PASS** (`investor_report.sql` 52 aserciones), `tsc` limpio, `boundaries` sin violaciones (1117 módulos / 3668 deps).
- **Verificación independiente (RDD off).** Un verifier read-only: **7/7 PASS**, sin bloqueantes. Confirmó audiencia `AUTHENTICATED` + MATRIX, identidad server-side, agregación honesta, vistas `service_role`-only, rutas/errores saneados, wiring de producción en `index.ts`, y ausencia de cambios web.
- **Gotcha aplicado.** La reversión de `supabase/tests/campaign_persistence.sql` dropea las 3 vistas nuevas antes de sus tablas base (mismo patrón que #426).
- **Límite explícito.** Sin `apps/web` (la vista `/reports` es WU2). La migración está aplicada **sólo en local**; la remota queda pendiente de autorización del owner.
- **Advisories (no bloqueantes).** `Number(bigint)` para ARS (seguro bajo 2^53, sin test de borde); `shareXlm` nunca `null` en la práctica (camino nullable sin test e2e); rama no alcanzable de `parseRangeQuery`.

- **Work-unit commit.** `bc165df feat(api): add the investor report read model (#430)`.
