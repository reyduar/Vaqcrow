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
- [x] **WU2 — Vista `/reports` (web).** Selector de período (3 presets generados desde los datos + rango personalizado), KPI cards con badge de fuente, gráfico mensual + tabla accesible, bloque «Ventas declaradas por PyME» con error propio, «Últimas distribuciones», estados vacío/carga.
- [x] **WU3 — Export.** Descarga CSV + imprimir-a-PDF (estilos de impresión, sin deps nuevas).
- [x] **WU4 — Acceso.** Gate de ruta para todos los autenticados + política; revisar el menú.
- [x] **WU5 — Verificación y evidencia.** Suites, `verify`, `docs/planning/investor-reports-evidence.md`.

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
- **Migración remota.** `20261009130000_create_investor_report_views.sql` probada en local y luego, con **autorización explícita del owner**, **aplicada al proyecto remoto** (2026-10-09) vía MCP, con el `version` del historial **alineado al repositorio** (`20261009130000`). Verificado en el remoto: 3 vistas con `security_invoker=true` (**4 / 10 / 7** columnas), `SELECT` sólo `service_role` y cero grants a `anon`/`authenticated`; advisors sin clase nueva.
- **Límite explícito.** Sin `apps/web` (la vista `/reports` es WU2).
- **Advisories (no bloqueantes).** `Number(bigint)` para ARS (seguro bajo 2^53, sin test de borde); `shareXlm` nunca `null` en la práctica (camino nullable sin test e2e); rama no alcanzable de `parseRangeQuery`.

- **Work-unit commit.** `bc165df feat(api): add the investor report read model (#430)`.

### WU2 — Vista `/reports` (web) (commit `1d25a3a`)

Ruta: **delegado** (un writer; port + gateway(s) + factory + null object + 2 hooks SWR + helpers puros + componentes + página, 2+ archivos no triviales). Sin export (WU3) ni gate (WU4).

- **Diseño.** Capa de datos calcada del cuarteto del portafolio (`application/ports/report-port.ts` + `infrastructure/reports/**`): bearer, errores saneados (`unavailable`/`network`/`unauthenticated`), `imageSrc` absoluta, `from`/`to` (`null/null` = default del API). Dos lecturas SWR independientes (`["report",from,to]` y `["report-sales",from,to]`) → el bloque de ventas puede fallar sin tumbar el resto. Helpers puros (`application/reports/`): presets desde `availableRange` (últimos 6 / 3 / 1 mes), etiquetas `es-AR` (abril – septiembre 2026), KPIs con badge `TESTNET`/`SIMULADO`, serie mensual (`confirmed`/`pending`/`none`, alturas), distribuciones/ventas. Componentes: selector de período (presets + rango personalizado desde/hasta, validado contra `availableRange`), grilla de KPIs, gráfico mensual (sólido/rayado/punteado **nunca sólo color** + «Ver tabla accesible» Mes/XLM/Estado), bloque de ventas con **error propio** (`No pudimos cargar este bloque` / `El resto del informe está actualizado.` / `Reintentar`), «Últimas distribuciones», estado vacío (`Sin datos para <período>` + CTA), skeleton y el control `Exportar` **presentacional** (el mecanismo es WU3).
- **RED/GREEN observado.** RED: módulos puros/infra/estado/presentación ausentes. GREEN: contracts build OK; web enfocado **74/74** (12 archivos); `tsc --noEmit` limpio; `lint` 1 warning preexistente ajeno; `boundaries` sin violaciones (1163 módulos / 3796 deps).
- **Verificación independiente (RDD off).** Un verifier read-only: **7/7 PASS**, sin bloqueantes. Confirmó patrón/ports, presets desde `availableRange`, encodings + tabla accesible, badges, honestidad `null`≠`0`, error propio de ventas con lecturas independientes, ausencia de WU3/WU4 y boundaries.
- **Límite explícito.** Sin export (WU3) ni gate de ruta (WU4); el `Exportar` es presentacional.
- **Advisories (no bloqueantes, a endurecer en WU5).** Sin test del selector de rango personalizado (validación fuera-de-rango/invertido); los encodings del gráfico no se asertan (sólo la leyenda); el CTA del estado vacío no se clickea; `report-latest-distributions`/`report-kpi-grid` sin test dedicado; estados loading/vacío del bloque de ventas sin test.

- **Work-unit commit.** `1d25a3a feat(web): add the investor reports view (#430)`.

### WU3 — Export (commit `d954395`)

Ruta: **delegado** (un writer; builder CSV puro + helper browser + control + wiring + print CSS). Sin deps nuevas.

- **Diseño.** `buildReportCsv(report, sales?)` puro (React-free): XLM canónico tal cual, `null` → celda vacía (nunca `0`), escaping RFC-4180, CRLF, BOM UTF-8, orden determinístico; la sección de ventas sólo si hay datos. `downloadCsv` (Blob + `createObjectURL` + anchor temporal + `revokeObjectURL`, SSR-guarded) y `printReport` (`window.print`). El control `Exportar` ofrece **Descargar CSV** y **Imprimir / PDF** (deshabilitado mientras carga). Estilos `@media print` (sólo bloque de impresión en `globals.css`: oculta chrome/acciones, formato de tablas) — **sin cambios en pantalla**.
- **RED/GREEN observado.** RED: módulos `export.ts`/`csv-download.ts` ausentes + el control viejo renderizaba el mensaje de deshabilitado. GREEN: web enfocado **81/81** (12 archivos); `tsc` limpio; `lint` 1 warning preexistente ajeno; `boundaries` sin violaciones (1169 módulos / 3809 deps).
- **Verificación independiente (RDD off).** Un verifier read-only: **6/6 PASS**, sin bloqueantes.
- **Advisories / owner-pending.** Copy del control (`Descargar CSV`/`Imprimir / PDF`/`Preparando…`) owner-pending (el template sólo diseña un `Exportar` deshabilitado); `header, footer { display:none }` en print es selector global (seguro hoy, sin contenido de informe con esos elementos).
- **Criterio superseded aplicado.** El criterio del issue *"export remains disabled with the quoted message"* queda **superseded** por D2: la exportación es funcional.

- **Work-unit commit.** `d954395 feat(web): add the report export (#430)`.

### WU4 — Acceso para todos los autenticados (commit `c2e4d45`)

Ruta: **delegado** (un writer; cambio del gate + matcher del proxy + tests). Sin componentes.

- **Diseño.** Nuevo grupo `AUTHENTICATED_PATHS = ["/reports"]` en `route-gate.ts` (cualquier rol firmado); un anónimo va al `/login` neutro (sin rol preseleccionado, porque `authHref` exige rol). Se incluye en `GATED_PATHS` y se agrega `/reports/:path*` al `matcher` del proxy (server ↔ cliente en acuerdo). `PROTECTED` queda intacto (`/portfolio` INVERSOR, `/company` PYME). El menú **no** cambia (D1 es sobre el acceso; la entrada para otros roles queda owner-pending, el template no la diseña).
- **RED/GREEN observado.** RED: 4 fallos (anónimo `/reports` → `/login` en ambos archivos, `/reports/ventas`, y `GATED_PATHS` sin `/reports`). GREEN: route-gate **42/42**; `proxy.test.ts` **13/13** (matcher ↔ `GATED_PATHS`); `tsc` limpio; `lint` sin errores; `boundaries` verde (1169 módulos).
- **Verificación.** Spot-check del padre (lectura del gate + re-run enfocado 55/55); la verificación independiente completa se integra en WU5.
- **Owner-pending.** Entrada de menú para PYME/ADMIN (hoy `/reports` es alcanzable por URL pero sólo el menú INVERSOR lo enlaza).

- **Work-unit commit.** `c2e4d45 feat(web): allow every authenticated role to open the reports (#430)`.

### WU5 — Verificación y evidencia

- **Cierre de la Feature.** `pnpm run verify` → **exit 0** tras los reintentos por el **flake de carga** (los suites pasan aislados: web **2270**, api **2455**; `test:boundaries` **164/164**; `boundaries` limpio). Nota: el flake se manifestó alternando entre `@vaqcrow/api:test` y `@vaqcrow/web:test` bajo la carga de turbo; cada suite pasa por separado.
- **Evidencia.** `docs/planning/investor-reports-evidence.md` (español, 9 secciones, estructura del hermano #426): los **6 criterios de aceptación de #430 citados textualmente**, cada uno mapeado a evidencia; registra **D2 supersede el criterio "export remains disabled"**; límites, advisories y copy owner-pending; deja explícito que **nada está en `main`** (pila con #426, Opción A con #438) y que la migración remota quedó aplicada con autorización del owner.

- **Work-unit commit.** `docs(evidence): close Feature #430 with the investor reports evidence (#433)`.
