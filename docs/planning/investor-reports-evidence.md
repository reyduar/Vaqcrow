# Evidencia de cierre de la Feature #430 — Issue #433

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#431](https://github.com/reyduar/Vaqcrow/issues/431) (implementación), [#432](https://github.com/reyduar/Vaqcrow/issues/432) (pruebas) y [#433](https://github.com/reyduar/Vaqcrow/issues/433) (evidencia) de la Feature [#430](https://github.com/reyduar/Vaqcrow/issues/430) ("Feature: Deliver investor reports"), mapea cada criterio de aceptación de la Feature, **citado textualmente**, a su resultado, a la fuente de ese resultado y al comando exacto detrás de él. La bitácora de iteración que lo alimenta es [[odd/tasks/investor-reports|Bitácora: informes del inversor]].

> [!warning] Estado de entrega: nada de #430 está en `main`
> El trabajo vive en la rama de integración `Vaqcrow#430_Feat_Deliver_investor_reports`, apilada sobre la punta de #426. Nada llega a `main`: la **Opción A del owner** mergea la pila junta con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)). No hay PR ni merge en esta Feature; los commits WU1–WU4 son **locales** y este documento **no** reporta un estado mergeado ni de CI. La única pieza que ya está aplicada en el **proyecto remoto** es la migración de vistas de WU1, con autorización explícita del owner (§3.1).

> [!info] 2026-10-10 — Mergeado en `main` vía [#466](https://github.com/reyduar/Vaqcrow/pull/466) (merge `2b7e0d5`).

## 1. Contexto y objetivo

La Feature #430 entrega la vista **«Informes»** (template `Vaqcrow Informes.dc.html`): selector de período, KPIs con badge de fuente, gráfico de distribuciones mensuales con su tabla accesible, «Ventas declaradas por PyME» con error propio, «Últimas distribuciones», estados vacío/carga y exportación. Antes de esta Feature `/reports` era un **404 pendiente**: existía el ítem de menú `Informes → /reports` en `shell-nav.ts` (menú INVERSOR) sin ruta ni datos; el inversor no tenía un informe de su actividad.

Reutiliza el motor existente (el modelo de lectura del portafolio de #426, la wallet Freighter de #406, las notificaciones de #382 y la convención de capas de datos de la web) y agrega: un **modelo de lectura del informe** (backend, dos endpoints), la **vista `/reports`** (web), la **exportación funcional** (CSV + imprimir-a-PDF) y el **gate de ruta** para todos los roles autenticados (decisión D1 del owner). #430 es el paso previo a #438 (camino a `main`).

| Task | Rama | Estado del issue |
|---|---|---|
| #431 — implementar | `Vaqcrow#430_Feat_Deliver_investor_reports` | abierto; WU1–WU4 |
| #432 — probar | (misma rama de la Feature) | abierto |
| #433 — documentar | (misma rama de la Feature) | este documento |

La Feature #430 depende de #426 y desbloquea a #438. El cierre lo decide el owner.

## 2. Cómo leer esta evidencia

- **Fuentes, siempre nombradas.** (a) **Bitácora** — una entrada fechada de [[odd/tasks/investor-reports]] por work unit (WU1–WU4), cada una con su commit y sus resultados RED/GREEN; se **cita**, no se re-ejecutó al escribir este documento. (b) **Verificación independiente por work unit (RDD off)** — un verificador read-only por WU, con su conteo PASS/FAIL. (c) **Cierre de la Feature** — los comandos de cierre (`pnpm run verify`, `pnpm run boundaries`, `pnpm run test:boundaries`) y su resultado, registrados en el handoff de cierre. Este documento **no** re-ejecuta las suites: nombra el comando exacto y su fuente.
- **Dobles, no proveedores.** Ninguna prueba PR-gated habla con Testnet, Horizon, RPC de Soroban, el LLM, Resend ni Supabase remoto. Las pruebas de API y de la web usan dobles y fixtures; sólo `pnpm run test:db` toca una base, y es el stack local.
- **Sin secretos.** Ningún email, contraseña, seed, clave privada, API key ni token aparece en este documento; las variables se nombran, nunca sus valores. No se introducen `seeds`, PII ni `SUPABASE_*`.
- **Sin claims de producción.** Todo corre sobre **Testnet** y sin valor económico; las distribuciones y las ventas son **simuladas**; el revenue share es de demo; el «hash» de Testnet demuestra ejecución técnica, no una inversión real. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado

Fuente: bitácora (WU1–WU4, 2026-10-09).

### 3.1 WU1 — Modelo de lectura del informe (backend) (commit `bc165df`, bitácora `2a1fe8a`, migración remota `2d5ff4e`)

Dos endpoints de lectura, ambos **`AUTHENTICATED`** (todos los roles, D1): `GET /reports` (KPIs + serie mensual + últimas distribuciones) y `GET /reports/sales-by-pyme` (ventas declaradas de las PyMEs con aporte del inversor, para el bloque con error propio). Contrato en `packages/contracts` (estricto, portable, **sin PII**); port + adaptador + casos de uso + rutas + política. `from`/`to` en `YYYY-MM` (default = últimos 6 meses hasta el último período disponible) y `availableRange` (`firstPeriod`/`lastPeriod`) para que la web arme presets y rango personalizado. La **identidad se resuelve server-side** desde el `profile.stellar_public_key` del principal verificado; un `?investor=` de query se **ignora**. Agregación **determinística**, en **bigint**, XLM canónico de 7 decimales; `null` nunca es `0`. Aportes fechados por `coalesce(last_observed_at, created_at)` (**aproximación documentada**: `campaign_contribution` es una fila acumulada por campaña+inversor, sin fecha por evento); distribuciones por `period`. Tres vistas nuevas `security_invoker` con grants **sólo `service_role`** (`investor_report_contribution` / `_distribution` / `_sales_by_pyme`). Errores saneados (`400`/`401`/`503`). La IA no calcula ninguna obligación.

**Verificación (WU1).** `pnpm --filter @vaqcrow/contracts test` → **604** (22 archivos) · `pnpm --filter @vaqcrow/api test` → **2455** (116) · `pnpm run test:db` → **22 archivos / 768 tests PASS** (`investor_report.sql`, 52 aserciones) · `tsc` limpio · `boundaries` sin violaciones (1117 módulos / 3668 deps). Verificador independiente: **7/7 PASS**, sin bloqueantes.

**Migración remota.** `20261009130000_create_investor_report_views.sql` probada en local y luego, con **autorización explícita del owner**, **aplicada al proyecto remoto** (2026-10-09) vía MCP, con el `version` del historial **alineado al repositorio** (`20261009130000`). Verificado en el remoto: 3 vistas con `security_invoker=true` (**4 / 10 / 7** columnas), `SELECT` sólo `service_role` y cero grants a `anon`/`authenticated`; advisors sin clase nueva.

> [!info] Gotcha aplicado
> La reversión de `supabase/tests/campaign_persistence.sql` dropea las 3 vistas nuevas **antes** de sus tablas base (mismo patrón que #426), para que el teardown del stack local no falle por dependencias.

### 3.2 WU2 — Vista `/reports` (web) (commit `1d25a3a`, bitácora `174327d`)

Capa de datos calcada del cuarteto del portafolio (`application/ports/report-port.ts` + `infrastructure/reports/**`): bearer, errores saneados (`unavailable`/`network`/`unauthenticated`), `imageSrc` absoluta, `from`/`to` (`null/null` = default del API). **Dos lecturas SWR independientes** (`["report",from,to]` y `["report-sales",from,to]`) para que el bloque de ventas pueda fallar sin tumbar el resto del informe. Helpers **puros** (`apps/web/src/application/reports/`): presets generados desde `availableRange` (últimos 6 / 3 / 1 mes), etiquetas `es-AR` (abril – septiembre 2026), KPIs con badge `TESTNET`/`SIMULADO`, serie mensual (`confirmed`/`pending`/`none`). Componentes: selector de período (presets + rango personalizado desde/hasta, validado contra `availableRange`), grilla de KPIs, gráfico mensual (sólido/rayado/punteado, **nunca sólo color**) + «Ver tabla accesible» (Mes / XLM / Estado), bloque «Ventas declaradas por PyME» con **error propio** (`No pudimos cargar este bloque` / `El resto del informe está actualizado.` / `Reintentar`), «Últimas distribuciones», estado vacío (`Sin datos para <período>` + CTA) y skeleton de carga.

**Verificación (WU2).** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **74/74** (12 archivos) · `tsc --noEmit` limpio · `lint` 1 warning preexistente ajeno · `boundaries` sin violaciones (1163 módulos / 3796 deps). Verificador independiente: **7/7 PASS**, sin bloqueantes.

### 3.3 WU3 — Export (commit `d954395`, bitácora `0a0f60c`)

Exportación **funcional** (decisión D2): `buildReportCsv(report, sales?)` **puro** (React-free) — XLM canónico tal cual, `null` → celda vacía (nunca `0`), escaping RFC-4180, CRLF, BOM UTF-8, orden determinístico; la sección de ventas sólo si hay datos. `downloadCsv` (Blob + `createObjectURL` + anchor temporal + `revokeObjectURL`, SSR-guarded) y `printReport` (`window.print`). El control `Exportar` ofrece **Descargar CSV** y **Imprimir / PDF** (deshabilitado mientras carga). Estilos `@media print` (sólo bloque de impresión en `globals.css`: oculta chrome/acciones, formato de tablas) — **sin cambios en pantalla**. **Sin dependencias nuevas.**

**Verificación (WU3).** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **81/81** (12 archivos) · `tsc` limpio · `lint` 1 warning preexistente ajeno · `boundaries` sin violaciones (1169 módulos / 3809 deps). Verificador independiente: **6/6 PASS**, sin bloqueantes.

### 3.4 WU4 — Acceso para todos los autenticados (commit `c2e4d45`, bitácora `94e166b`)

Nuevo grupo `AUTHENTICATED_PATHS = ["/reports"]` en `route-gate.ts` (cualquier rol firmado); un anónimo va al `/login` neutro (sin rol preseleccionado). Se incluye en `GATED_PATHS` y se agrega `/reports/:path*` al `matcher` del proxy, de modo que servidor y cliente coinciden. `PROTECTED` queda **intacto** (`/portfolio` INVERSOR, `/company` PYME). El menú **no** cambia (D1 es sobre el acceso; la entrada para otros roles queda owner-pending, el template no la diseña).

**Verificación (WU4).** `route-gate` **42/42**; `proxy.test.ts` **13/13** (matcher ↔ `GATED_PATHS`); `tsc` limpio; `lint` sin errores; `boundaries` verde (1169 módulos). Spot-check del padre (lectura del gate + re-run enfocado 55/55); la verificación independiente completa se integra en WU5/cierre.

### 3.5 Rutas y migración

| Método y ruta | Autorización | Resultado |
|---|---|---|
| `GET /reports` | `AUTHENTICATED` | KPIs + serie mensual + últimas distribuciones del período, del inversor verificado |
| `GET /reports/sales-by-pyme` | `AUTHENTICATED` | ventas declaradas de las PyMEs con aporte (bloque con error propio) |
| `GET /reports` (web) | autenticado (todos los roles) | vista `/reports`; anónimo → `/login` |
| `GET /reports/sales-by-pyme` (web) | autenticado (todos los roles) | lectura SWR independiente del bloque de ventas |

Migración (probada en local y **aplicada al proyecto remoto** con autorización del owner, con el `version` alineado al repositorio): `20261009130000_create_investor_report_views`.

## 4. Qué quedó probado

### 4.1 Resultados RED/GREEN por work unit

Fuente: [[odd/tasks/investor-reports]] (cada entrada cita su commit).

| WU | Comando(s) y resultado | Commit |
|---|---|---|
| WU1 | contracts → **604** (22 archivos) · api → **2455** (116) · `test:db` → **22 archivos / 768 tests PASS** · `tsc` limpio · `boundaries` sin violaciones (1117 / 3668) | `bc165df` |
| WU2 | web enfocado `vitest run --maxWorkers=4` → **74/74** (12 archivos) · `tsc --noEmit` limpio · `boundaries` sin violaciones (1163 / 3796) | `1d25a3a` |
| WU3 | web enfocado → **81/81** (12 archivos) · `tsc` limpio · `boundaries` sin violaciones (1169 / 3809) | `d954395` |
| WU4 | route-gate **42/42** · `proxy.test.ts` **13/13** · `tsc` limpio · `boundaries` verde (1169) | `c2e4d45` |

**Cierre de la Feature.** `pnpm run verify` → **exit 0** tras el **único retry documentado** (el *flake* conocido de un *timeout* de carga de la suite web bajo turbo, archivo ajeno al cambio). Las suites pasan **standalone**: web **2270**, api **2455**; `pnpm run test:boundaries` → **164/164**; `pnpm run boundaries` → sin violaciones.

### 4.2 Verificación independiente por work unit (RDD off)

Tras cada writer delegado corrió un verificador read-only:

| WU | Resultado | Hallazgo |
|---|---|---|
| WU1 | **7/7 PASS** | Confirmó audiencia `AUTHENTICATED` + MATRIX, identidad server-side (`?investor=` ignorado), agregación honesta (`null` ≠ `0`), vistas `service_role`-only, rutas/errores saneados, wiring en `index.ts` y ausencia de cambios web. |
| WU2 | **7/7 PASS** | Confirmó el patrón port/gateway/factory/null-object, presets desde `availableRange`, encodings del gráfico + tabla accesible, badges, honestidad `null` ≠ `0`, error propio de ventas con lecturas independientes y boundaries. |
| WU3 | **6/6 PASS** | Confirmó el CSV puro (RFC-4180, BOM, `null` → vacío), el print/PDF, la ausencia de dependencias nuevas y los estilos `@media print`. |
| WU4 | spot-check del padre | Lectura del gate + re-run enfocado **55/55**; la verificación independiente completa se integra en el cierre. |

### 4.3 Cobertura

- **contracts**: contrato estricto y portable del informe (`null` ≠ `0`, XLM de 7 decimales; sin PII).
- **api**: `GET /reports` y `GET /reports/sales-by-pyme` (identidad del principal, `?investor=` ignorado, vistas sólo `service_role`, agregación determinística bigint, aportes por `coalesce(last_observed_at, created_at)`, distribuciones por `period`, errores saneados).
- **web**: capa de datos (códigos saneados, `imageSrc` absoluta, bearer), helpers puros (presets, KPIs, serie, distribuciones/ventas), la vista (selector de período, KPIs con badge, gráfico + tabla accesible, bloque de ventas con error propio, últimas distribuciones, estados vacío/carga), el export (CSV + print/PDF) y el gate de acceso.

### 4.4 No re-ejecutado

- **Testnet / Horizon / RPC**: la generación real de distribuciones sobre Testnet queda como **verificación operativa manual** (fuera del gate; requiere red real).
- **`test:integration`** contra Supabase remoto (fuera del gate).
- **Re-ejecución de las suites para este documento**: los números de §4.1 se citan de la bitácora y del cierre de la Feature; el único chequeo re-ejecutado al escribirlo fue la verificación estructural de este documento (§7).

## 5. Límites, advisories y copy owner-pending

- **(a) «Aportado en el período» es una aproximación.** `campaign_contribution` es una fila acumulada por campaña+inversor, sin fecha por evento: la fecha sale de `coalesce(last_observed_at, created_at)` y se **documenta** como aproximación; el aporte es acumulado, no una serie por evento.
- **(b) Copy owner-pending.** El template no diseña el rango personalizado, el control de export ni las notas de estado de ventas; sus textos son placeholders mínimos y honestos, **pendientes de aprobación/reemplazo por el owner**: etiquetas del rango personalizado («Personalizado», «Desde», «Hasta»), etiquetas del control de export («Descargar CSV», «Imprimir / PDF», «Preparando…»), notas de estado de ventas por PyME, y la línea del estado vacío que el template no cita textualmente.
- **(c) Sin entrada de menú para PYME/ADMIN.** D1 permite el acceso a todos los roles autenticados, pero `/reports` hoy es alcanzable **sólo por URL** para PYME/ADMIN: el menú sólo enlaza la entrada INVERSOR (el template no diseña la entrada para otros roles). Owner-pending.
- **(d) Brechas de cobertura de tests (WU2, no bloqueantes).** Sin test del selector de rango personalizado (validación fuera-de-rango/invertido); los encodings del gráfico no se asertan (sólo la leyenda); el CTA del estado vacío no se clickea; `report-latest-distributions` / `report-kpi-grid` sin test dedicado; estados loading/vacío del bloque de ventas sin test.
- **(e) `Number(bigint)` para ARS.** La conversión para montos ARS es segura bajo **2^53**; un valor por encima **no está cubierto por un test de borde**.
- **(f) Estado «Calculada · sin firmar».** El template muestra ese estado en «Últimas distribuciones», pero **no está respaldado por datos persistidos**; se renderiza desde el vocabulario disponible sin fabricar un estado nuevo.

## 6. Decisiones del owner

| # / fecha | Pregunta del issue (no diseñada en el template) | Resolución |
|---|---|---|
| D1 — 2026-10-09 | Informes para PYME o ADMIN (el template los reserva a inversores). | **Todos los roles autenticados** (PYME, INVERSOR, ADMIN). Supersede el «reservado a inversores» del template; implica el widen del gate de ruta y la política `AUTHENTICATED`. |
| D2 — 2026-10-09 | Export funcional vs. deshabilitado. | **Export funcional**: descarga **CSV** + **imprimir-a-PDF** (estilos de impresión), **sin dependencias nuevas**. **Supersede el criterio de aceptación** del issue *"export remains disabled with the quoted message"* (§7, criterio 2). |
| D3 — 2026-10-09 | Rangos personalizados. | **Sí**: además de los 3 presets, rango **desde/hasta**. |
| D4 — 2026-10-09 | Cómo se generan los períodos (el template fija 2026). | Los presets se generan **desde el rango de datos del inversor** (últimos meses con aportes/distribuciones), **sin año fijo** en el código. |

Ninguna pregunta abierta del issue quedó sin decidir antes de implementarse.

> [!warning] Criterio superseded por D2
> El criterio de aceptación *"Empty-period, loading and partial-error states behave as designed; export remains disabled with the quoted message"* queda **parcialmente superseded** por D2: los estados vacío/carga/error sí se comportan como fueron diseñados, pero la exportación **pasa a ser funcional** en lugar de permanecer deshabilitada con el mensaje citado. La evidencia lo registra explícitamente (criterio 2, §7).

## 7. Mapeo de criterios de aceptación (issue #430, citados textualmente)

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The report reproduces KPIs, chart, accessible table, sales block and latest distributions from real data for the selected period." | ✅ **CUMPLIDO.** WU1 entrega el read model real (KPIs, serie mensual, últimas distribuciones, ventas por PyME; vistas `service_role`, identidad server-side) y WU2 la vista que reproduce KPIs con badge, gráfico mensual, «Ver tabla accesible», bloque de ventas y «Últimas distribuciones» para el período seleccionado. | §3.1–3.2; suites WU1/WU2; verificación independiente 7/7 + 7/7 |
| 2 | "Empty-period, loading and partial-error states behave as designed; export remains disabled with the quoted message." | ⚠️ **PARCIALMENTE SUPERSEDED (D2).** Los estados vacío (`Sin datos para <período>`), carga (skeleton) y error de bloque (el bloque de ventas falla sin tumbar el resto, con `Reintentar`) se comportan como diseñado. La segunda mitad —*export remains disabled con el mensaje citado*— queda **superseded**: por decisión **D2** la exportación es **funcional** (CSV + imprimir-a-PDF), no deshabilitada. | §3.2–3.3, §6 (D2); suites WU2/WU3 |
| 3 | "Pending and confirmed distributions are distinguishable without color; figures carry the right source badge." | ✅ **CUMPLIDO.** El gráfico distingue «Confirmada» (sólido), «Pendiente de confirmación» (rayado) y «Sin distribución» (punteado) **sin depender del color** (encodings + tabla accesible Mes/XLM/Estado); KPIs y cifras llevan el badge de fuente `TESTNET`/`SIMULADO`. | §3.2; suite WU2 (74/74); verificación independiente 7/7 |
| 4 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Suites por WU (contracts 604, api 2455, `test:db` 22/768, web 74/74 · 81/81, route-gate 42/42, proxy 13/13) + cierre (`pnpm run verify` exit 0 tras 1 retry) + `test:boundaries` 164/164; fallos saneados (`400`/`401`/`503`; web `unavailable`/`network`/`unauthenticated`); error propio del bloque de ventas; sin filtrar `message`/`details`/`hint` ni secretos. | §4.1–4.3 |
| 5 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** D1–D4 (§6) resuelven las preguntas abiertas del issue (acceso de roles, export funcional, rango personalizado, generación de presets); ninguna se inventó. | §6 |
| 6 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin secretos, seeds ni PII; Testnet sin valor económico; distribuciones y ventas simuladas y rotuladas `SIMULADO`/`TESTNET`; el «hash» de Testnet demuestra ejecución técnica, no una inversión real; sin claims de producción. | Revisión de este documento |

## 8. Riesgos, contradicciones y limitaciones aceptadas

- **Criterio 2 superseded.** La exportación funcional (D2) contradice el texto original del criterio; se registra de forma explícita en §6 y §7 en lugar de declararlo cumplido sin más.
- **Verificación de UI sin navegador.** Los tests son de componente (jsdom), no E2E; la generación real de distribuciones sobre Testnet queda como verificación operativa manual.
- **Aproximación de fecha de aporte.** «Aportado en el período» usa `coalesce(last_observed_at, created_at)` sobre una fila acumulada; no hay fecha por evento.
- **Copy owner-pending** (rango personalizado, control de export, notas de ventas, línea del estado vacío) y **sin entrada de menú** para PYME/ADMIN son las brechas de fidelidad declaradas.
- **Brechas de cobertura** de WU2 (§5d) y **`Number(bigint)` > 2^53** sin test de borde (§5e) quedan como deuda de pruebas.
- **Estado «Calculada · sin firmar»** no está respaldado por datos persistidos (§5f).
- **El *flake* de carga** de la suite web bajo turbo obligó a un retry del cierre; los WU verdes y las suites standalone no lo reprodujeron.

## 9. Estado de entrega y próximos pasos

- **Nada de #430 está en `main`.** Todo vive en la rama de integración, apilada sobre #426; los commits WU1–WU4 son locales. El merge sigue atado a la **Opción A** (junto con #438).
- **Camino a `main`:** #426 → #430 → #438. La migración de #430 quedó **aplicada al remoto** con autorización del owner (la única pieza en el remoto).
- El cierre de la Feature lo decide el owner; esta sección sólo registra su decisión.
