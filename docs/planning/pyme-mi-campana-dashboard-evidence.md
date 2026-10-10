# Evidencia de cierre de la Feature #434 — Issue #437

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#435](https://github.com/reyduar/Vaqcrow/issues/435) (implementación), [#436](https://github.com/reyduar/Vaqcrow/issues/436) (pruebas) y [#437](https://github.com/reyduar/Vaqcrow/issues/437) (evidencia) de la Feature [#434](https://github.com/reyduar/Vaqcrow/issues/434) ("Feature: Deliver the PyME Mi campaña dashboard"), mapea cada criterio de aceptación de la Feature, **citado textualmente**, a su resultado, a la fuente de ese resultado y al comando exacto detrás de él. La bitácora de iteración que lo alimenta es [[odd/tasks/pyme-mi-campana-dashboard|Bitácora: Mi campaña de la PyME]].

> [!warning] Estado de entrega: nada de #434 está en `main`
> El trabajo vive en la rama `Vaqcrow#434_Feat_Deliver_the_PyME_Mi_campaña_dashboard`, creada desde la punta de #430 (`74237b1`). Nada llega a `main`: la **Opción A del owner** mergea la pila junta con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)). No hay PR ni merge en esta Feature; los commits WU1a–WU5 son **locales** y este documento **no** reporta un estado mergeado ni de CI. La única pieza que ya está aplicada en el **proyecto remoto** es la migración de vistas de WU1a, con autorización explícita del owner (§3.1).

> [!info] 2026-10-10 — Mergeado en `main` vía [#466](https://github.com/reyduar/Vaqcrow/pull/466) (merge `2b7e0d5`).

## 1. Contexto y objetivo

La Feature #434 entrega el dashboard **«Mi campaña»** (template `Vaqcrow Portafolio.dc.html`, **modo pyme**): tarjeta de wallet no custodial, stats («Fondeado» / «Aportantes»), «Bóveda y distribuciones» (vigentes e históricas) con orden «Recientes» / «Por estado», «Ventas declaradas · 2026», «Distribuciones» con la acción «Revisar y firmar», la declaración mensual de ventas, el dinero en **ARS + equivalente XLM** rotulado `SIMULADO`, y los estados de la solicitud antes y después de la decisión. `/company` era, antes de esta Feature, un `PageHeading` con el botón «Registrar mi PyME» y —si había wallet— la `WalletCard`: la PyME no veía el estado de su bóveda, sus ventas declaradas, sus distribuciones ni podía firmarlas.

Reutiliza el motor existente (la persistencia de campaña, la bóveda/despliegue de #410, la wallet Freighter de #406, el motor de distribución `prepare → TransactionReviewModal → Freighter → submit` del `distribution-workspace`, la convención de capas de datos de la web y las notificaciones de #382) y agrega: un **modelo de lectura «mis campañas»** (backend), la **extensión de la declaración de ventas** (backend), la **vista `/company`** (web), la **entrada de declaración real**, el **reuso del flujo de firma a nivel campaña**, los **estados de la solicitud** y la **guía de fondos de Testnet**. #434 es prerequisito de #438 (camino a `main`).

| Task | Rama propuesta | Estado del issue |
|---|---|---|
| #435 — implementar | `Vaqcrow#435_Task_Implement_the_PyME_Mi_campaña_dashboard` | abierto; WU1a–WU5 |
| #436 — probar | `Vaqcrow#436_Task_Test_the_PyME_Mi_campaña_dashboard` | abierto |
| #437 — documentar | `Vaqcrow#437_Task_Document_evidence_for_the_PyME_Mi_campaña_dashboard` | abierto; este documento |

La Feature #434 depende de #406 y #410 y desbloquea a #438. El cierre lo decide el owner.

## 2. Cómo leer esta evidencia

- **Fuentes, siempre nombradas.** (a) **Bitácora** — una entrada fechada de [[odd/tasks/pyme-mi-campana-dashboard]] por work unit (WU1a–WU5), cada una con su commit y sus resultados RED/GREEN; se **cita**, no se re-ejecutó al escribir este documento. (b) **Verificación independiente por work unit (RDD off)** — un verificador read-only por WU, con su conteo PASS/FAIL. (c) **Cierre de la Feature** — los comandos de cierre (`pnpm run verify`, `pnpm run boundaries`, `pnpm run test:boundaries`) y su resultado, registrados en el handoff de cierre. Este documento **no** re-ejecuta las suites: nombra el comando exacto y su fuente.
- **Dobles, no proveedores.** Ninguna prueba PR-gated habla con Testnet, Horizon, RPC de Soroban, el LLM, Resend ni Supabase remoto. Las pruebas de API y de la web usan dobles y fixtures; sólo `pnpm run test:db` toca una base, y es el stack local.
- **Sin secretos.** Ningún email, contraseña, seed, clave privada, API key ni token aparece en este documento; las variables se nombran, nunca sus valores. No se introducen `seeds`, PII ni `SUPABASE_*`.
- **Sin claims de producción.** Todo corre sobre **Testnet** y sin valor económico; las distribuciones y las ventas son **simuladas**; el revenue share es de demo; el «hash» de Testnet demuestra ejecución técnica, no una inversión real. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado

Fuente: bitácora (WU1a–WU5, 2026-10-09).

### 3.1 WU1a — Modelo de lectura «mis campañas» (backend) (commit `ab9e8ea`, bitácora `131dfef`, registro de migración remota `847bcb1`)

Endpoint `GET /my-campaigns` (**`only("PYME")`**). Devuelve las campañas del PyME **vigente + históricas** (decisión D3): nombre/sector/ciudad/imagen, `vaultAddress`, estado (`funding`/`settled`/`refunding`), `goalArs`, `raisedArs` (nulo sin snapshot), `fundedPercentBps`, `deadline`, `contributorsCount`, distribuciones (`amountArs` **y** `amountXlm`, decisión D4) y la serie de ventas declaradas. El **dato dueño** se resuelve server-side: `campaign.application_id → sme_request.application_id → sme_request.owner_user_id`, y la empresa es la `businesses` más nueva de ese dueño; la **identidad** sale de `request.principal.userId` (nunca del request). La conversión ARS↔XLM usa el snapshot FX persistido (misma fórmula que el `raisedArs` del portafolio); un valor ausente es `null`, **nunca `0`**. Tres vistas nuevas `security_invoker` con grants **sólo `service_role`** (`my_campaign_summary` / `my_campaign_distribution` / `my_campaign_sales`). Errores saneados (`401`/`403`/`503`). Contrato en `packages/contracts` (estricto, portable, sin PII); port + adaptador + caso de uso + ruta + política. Sin `apps/web` (el dashboard es WU2).

**Verificación (WU1a).** `pnpm --filter @vaqcrow/contracts test` → **617** (23 archivos) · `pnpm --filter @vaqcrow/api test` → **2485** (119) · `pnpm run test:db` → **23 archivos / 828 tests PASS** (`my_campaigns.sql`, 60 aserciones) · `tsc` limpio · `pnpm run boundaries` sin violaciones (1178 módulos / 3840 deps). Verificador independiente: **7/7 PASS**, sin bloqueantes (confirmó `only("PYME")` + MATRIX, scoping por dueño sin fuga, honestidad XLM 7-dec / `null` ≠ `0` / snapshot FX, vistas `service_role`-only, rutas/errores saneados y wiring).

**Migración remota.** `20261009140000_create_my_campaigns_views.sql` probada en local y luego, con **autorización explícita del owner**, **aplicada al proyecto remoto** (2026-10-09) vía MCP, con el `version` del historial **alineado al repositorio** (`20261009140000`). Verificado en el remoto: 3 vistas con `security_invoker=true` (**18 / 6 / 5** columnas), `SELECT` sólo `service_role` y **cero** grants a `anon`/`authenticated`; advisors sin clase nueva.

> [!info] Gotcha aplicado
> La reversión de `supabase/tests/campaign_persistence.sql` dropea las 3 vistas nuevas **antes** de sus tablas base, para que el teardown del stack local no falle por dependencias.

### 3.2 WU1b — Declaración de ventas (backend) (commit `140d1e7`)

`POST /businesses/:id/sales-periods` con **dos caminos** (decisión D1): cuerpo `{}` = refresh simulado del proveedor (demo, sin cambios); cuerpo `{ periods: [{ period: "YYYY-MM", salesArs: int ≥ 0 | null }] }` = **montos declarados** (validado estricto, ownership como hoy, persistido con `source: "declared"`). Un `null` significa **mes faltante** (`status: "missing"`), **nunca `0`**. **Regla de anomalía determinística** (documentada): un mes es `anomalous` si su monto es **≥ 2×** o **≤ ½** del promedio de los meses reportados previos de la misma declaración; el primer mes queda `reported`. Respuesta `200 { businessId, periods }`; `400` payload inválido; `401/404/503` saneados. La regla determinística vive en `packages/domain`; la IA no calcula obligaciones.

**Verificación (WU1b).** `pnpm --filter @vaqcrow/contracts test` → **633** · `pnpm --filter @vaqcrow/api test` → **2516** · `pnpm run test:db` → **828** · `tsc` limpio · `pnpm run boundaries` sin violaciones (1181 módulos / 3852 deps). Spot-check del padre (lectura de la ruta dual-path + re-run enfocado **44/44**); la verificación independiente se integra en WU6.

### 3.3 WU2 — Dashboard `/company` (web) (commit `a4b17a3`)

Capa de datos calcada del cuarteto del portafolio contra `GET /my-campaigns`: bearer, errores saneados, `imageSrc` absoluta; hook SWR `["my-campaigns"]`. Helpers **puros** (`apps/web/src/application/company/`): formatos ARS (`es-AR`) + «≈ N XLM» (7 decimales) + fecha; copy de estado de campaña; orden «Recientes» / «Por estado»; series de ventas (`reported`/`missing`/`anomalous`); distribuciones (ARS + XLM, `needsSignature`); stats. Componentes: stats («Fondeado» + nota, «Aportantes»), «Bóveda y distribuciones» (lista de **todas** las campañas + orden + bloque de bóveda), «Ventas declaradas · 2026» (`bar-chart`), «Distribuciones» + footnote. Estados loading / error+retry / vacío previo. Se preservan la wallet card, «Registrar mi PyME» y el wizard. Slots presentacionales (declaración WU3, firma WU4) deshabilitados.

**Verificación (WU2).** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **67/67** (11 archivos) · contracts build OK · `tsc` limpio · `lint` sin errores (1 warning preexistente ajeno) · `boundaries` sin violaciones (1218 módulos / 3949 deps). Verificador independiente: **7/7 PASS**, sin bloqueantes (falla inline corregida: punto final de más en el footnote respecto del template).

### 3.4 WU3 — Declaración mensual (web) (commit `291e64d`)

Panel «Declarar ventas» cableado en el slot de WU2: un **form de montos reales** por mes (vacío = `Sin dato` → `null`, nunca `0`) + botón **«Completar con datos de ejemplo»**; al enviar llama al `POST /businesses/:id/sales-periods` extendido (cuerpo exactamente `{ periods }`, sólo el declarado; 200 = éxito) y **recarga** el dashboard. El `businessId` sale del read existente `GET /businesses/mine` (`BusinessPort.getMyBusiness`), porque `GET /my-campaigns` no expone el businessId.

**Verificación (WU3).** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **96/96** (13 archivos) · contracts build OK · `tsc` limpio · `lint` sin errores · `boundaries` sin violaciones (1233 módulos / 4001 deps) · regresión del workspace **5/5**. Spot-check del padre (gateway: sólo `{ periods }`, 200 = éxito).

### 3.5 WU4 — Revisar y firmar (commits `0d146c9` + `f66a578`)

Acción **a nivel campaña**: se ofrece «Revisar y firmar» cuando la campaña está **`settled`** (meta alcanzada); reusa el motor de distribución (`prepare` → `TransactionReviewModal` → Freighter → `submit` → `TransactionStatusList`). El `prepare` deriva la obligación del último período reportado; si ya está distribuido, el motor responde su propio `already_distributed` (manejado). `sourceAccountId` = la conexión persistida (`GET /profile/wallet`); `applicationId` se resuelve vía `CampaignGateway.getCampaign(campaignId)` (el read model no lo trae). `sent ≠ confirmed`; guarda de in-flight.

**Corrección semántica (commit `f66a578`, severidad HIGH).** Un `revenue_share_distribution.submitted` **ya está firmado y enviado** (`signed_xdr` + `transaction_hash`), NO «pendiente de tu firma». Se corrigió el vocabulario (`submitted` → «Enviada · pendiente de confirmación») y se movió «Revisar y firmar» de la fila de distribución al **nivel campaña** (`settled`), porque el estado «Calculada · pendiente de tu firma» del template **no tiene fuente persistida** (es una obligación *derivable* que el `prepare` produce on-demand). Tests negativos: `funding`/`refunding` no ofrecen la acción aunque tengan un `submitted`.

**Verificación (WU4).** `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **94/94** (12 archivos) · `tsc` limpio · `lint` sin errores · `boundaries` sin violaciones (1241 módulos / 4061 deps). Spot-checks del padre.

### 3.6 WU5 — Estados y guía (commits `97913c2` + `47ed532` + `ec175f3`)

**Banner de estado de la solicitud** (decisión D6): se agregó `findReviewStateByApplicationId` al port de `sme-request` (lectura `service_role` de `application_review.state`), el read `GET /sme-requests/:applicationId` (PYME) ahora devuelve el `state` owner-scoped, y la web lo lleva al banner (En revisión / Requiere cambios / Rechazada / Aprobada / Sin enviar), reusando `EmptyState` y el estado de la `sme_request`. Como `/company` no tiene `applicationId`, `CompanyWorkspace` **captura el id del submit del wizard** envolviendo el gateway (limitación B1, §5). **Guía de fondos de Testnet** (decisión D5): Friendbot + nota no custodial + badge `TESTNET`.

**Verificación (WU5).** `pnpm --filter @vaqcrow/contracts test` → **634** · `pnpm --filter @vaqcrow/api test` → **2524** · `pnpm run test:db` → **828** · `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **139/139** · `tsc` (api + web) limpio · `boundaries` sin violaciones (1248 módulos / 4088 deps). El commit `47ed532` fue un fix de lint en un test de WU1a; `ec175f3` quitó un literal de network passphrase de un fixture de test.

### 3.7 Rutas y migración

| Método y ruta | Autorización | Resultado |
|---|---|---|
| `GET /my-campaigns` | `only("PYME")` | campañas del PyME (vigente + históricas) con estado, fondeo/aportantes, distribuciones (ARS + XLM) y ventas declaradas; identidad server-side |
| `POST /businesses/:id/sales-periods` | `only("PYME")` (ownership) | dual-path: `{}` demo vs `{ periods }` declarado con `source:"declared"` y anomalía determinística |
| `GET /businesses/mine` | `only("PYME")` | business más nuevo del dueño (usado por WU3 para el `businessId`) |
| `GET /sme-requests/:applicationId` | `only("PYME")` | ahora incluye `application_review.state` owner-scoped (WU5) |
| `GET /my-campaigns` (web) | PYME | vista `/company`; anónimo → `/login` |
| `POST /revenue-share-distributions` (prepare/submit) | `only("PYME")` | reuso del motor existente (WU4); `sent ≠ confirmed` |

Migración (probada en local y **aplicada al proyecto remoto** con autorización del owner, con el `version` alineado al repositorio): `20261009140000_create_my_campaigns_views`.

## 4. Qué quedó probado

### 4.1 Resultados RED/GREEN por work unit

Fuente: [[odd/tasks/pyme-mi-campana-dashboard]] (cada entrada cita su commit).

| WU | Comando(s) y resultado | Commit |
|---|---|---|
| WU1a | contracts → **617** (23 archivos) · api → **2485** (119) · `test:db` → **23 archivos / 828 tests PASS** (`my_campaigns.sql`, 60 aserciones) · `tsc` limpio · `boundaries` sin violaciones (1178 / 3840) | `ab9e8ea` |
| WU1b | contracts → **633** · api → **2516** · `test:db` → **828** · `tsc` limpio · `boundaries` sin violaciones (1181 / 3852) | `140d1e7` |
| WU2 | web enfocado `vitest run --maxWorkers=4` → **67/67** (11 archivos) · contracts build OK · `tsc` limpio · `boundaries` sin violaciones (1218 / 3949) | `a4b17a3` |
| WU3 | web enfocado → **96/96** (13 archivos) · `tsc` limpio · `boundaries` sin violaciones (1233 / 4001) · workspace **5/5** | `291e64d` |
| WU4 | web enfocado → **94/94** (12 archivos) · `tsc` limpio · `boundaries` sin violaciones (1241 / 4061) | `0d146c9` + `f66a578` |
| WU5 | contracts → **634** · api → **2524** · `test:db` → **828** · web enfocado → **139/139** · `tsc` (api+web) limpio · `boundaries` sin violaciones (1248 / 4088) | `97913c2` + `47ed532` |

**Cierre de la Feature.** `pnpm run verify` → **exit 0** tras el **único retry documentado** (el *flake* conocido de un *timeout* de carga de la suite web bajo turbo, archivo ajeno al cambio). Las suites pasan **standalone**: web → **255 archivos**; `pnpm run test:boundaries` → **164/164**; `pnpm run boundaries` → sin violaciones.

### 4.2 Verificación independiente por work unit (RDD off)

Tras cada writer delegado corrió un verificador read-only:

| WU | Resultado | Hallazgo |
|---|---|---|
| WU1a | **7/7 PASS** | Confirmó `only("PYME")` + MATRIX, scoping por dueño sin fuga, honestidad (XLM 7-dec, `null` ≠ `0`, snapshot FX), vistas `service_role`-only, rutas/errores saneados y wiring. |
| WU2 | **7/7 PASS** | Confirmó el patrón port/gateway/factory/null-object, los helpers puros (formatos, orden, series, distribuciones), la fidelidad de copy del template y los boundaries. |
| WU1b / WU3 / WU4 / WU5 | spot-check del padre | Re-run enfocado y lectura de ruta/gateway (ver cada subsección de §3); la verificación independiente completa se integra en el cierre (WU6). |

### 4.3 Cobertura

- **contracts**: contrato estricto y portable del read model «mis campañas» (XLM canónico de 7 decimales, `null` ≠ `0`; sin PII) y del request declarado de ventas (validación estricta `YYYY-MM` + `int ≥ 0 | null`).
- **api**: `GET /my-campaigns` (identidad server-side, scoping por dueño, vistas sólo `service_role`, `null` ≠ `0`, snapshot FX, errores saneados); `POST /businesses/:id/sales-periods` dual-path con `source:"declared"` y anomalía determinística ≥2×/≤½; `GET /sme-requests/:applicationId` con `application_review.state` owner-scoped; política `only("PYME")` y MATRIX.
- **web**: capa de datos (códigos saneados, bearer, `imageSrc` absoluta), helpers puros (ARS + «≈ N XLM» `SIMULADO`, orden, series `reported`/`missing`/`anomalous`, distribuciones `needsSignature`, textos de estado), la vista `/company` (stats, bóveda + distribuciones, ventas, estados vacío/carga/error), la declaración mensual (form real + helper demo), el reuso del flujo de firma a nivel campaña y el banner de estado de la solicitud + guía friendbot.

### 4.4 No re-ejecutado

- **Testnet / Horizon / RPC**: la firma y el envío reales de una distribución sobre Testnet (y la guía friendbot) quedan como **verificación operativa manual** (fuera del gate; requieren Freighter y red reales).
- **`test:integration`** contra Supabase remoto (fuera del gate).
- **Re-ejecución de las suites para este documento**: los números de §4.1 se citan de la bitácora y del cierre de la Feature; el único chequeo re-ejecutado al escribirlo fue la verificación estructural de este documento (§7).

## 5. Límites, advisories y copy owner-pending

- **(a) Fechas y períodos derivados de la campaña.** La ventana demo de 8 meses de «Ventas declaradas · 2026» y la nota «cierra el …» de «Fondeado» derivan del `deadline` de la campaña (sin reloj de pared) — design choice registrada; el orden de campañas es el `created_at desc` del adaptador, no re-sorteado en el caso de uso. «Aportantes» suma conteos por campaña y **puede sobrecontar** cuentas presentes en varias campañas.
- **(b) «Revisar y firmar» a nivel campaña vs. la fila del template.** El template muestra la distribución «Calculada · pendiente de tu firma» como una **fila**; hoy la acción se ofrece a nivel **campaña** (`settled`) porque el read model no expone la obligación *derivable* que el `prepare` produce on-demand. Agregar una señal derivada al backend queda como decisión abierta.
- **(c) Limitación B1 del banner.** El `applicationId` se captura **en sesión** (wrapping del submit del wizard); ante un reload sin submit previo, el banner no aparece. Un `findReviewStateByOwner` / `GET /my-application` lo haría robusto (follow-up).
- **(d) `GET /businesses/mine` devuelve el más nuevo.** Con varias campañas/negocios, la declaración puede apuntar a otro negocio que la tarjeta clickeada; follow-up recomendado: exponer `businessId` en `my-campaigns`.
- **(e) Copy owner-pending.** El template no diseña el panel de declaración, los textos de estado de la solicitud, la guía friendbot ni las filas de revisión de distribución; sus textos son placeholders mínimos y honestos, **pendientes de aprobación/reemplazo por el owner**.
- **(f) Eventos `pyme.*` definidos pero no publicados.** `pyme.goal_reached`, `pyme.distribution_ready` y `pyme.declare_sales` están definidos, con sus puntos de disparo reportados (`reconcile-campaign.ts`, derivación/preparación de distribución, `sales-feed.route.ts`), pero **ninguno se publica hoy** (diferidos).
- **(g) `Number(bigint)` para ARS.** La conversión de montos ARS es segura bajo **2^53**; un valor por encima **no está cubierto por un guarda ni un test de borde** (patrón preexistente).
- **(h) Contrato del response declarado.** El response del `POST` declarado no tiene contrato compartido (la superficie aprobada del barrel se limitó al request). Sin test de «body ignorado» en el GET; la forma 200 se valida en casos de uso/contrato, no en la ruta. Vaciar un mes prellenado envía `null` → `missing` (sobrescribe), a confirmar.

## 6. Decisiones del owner

| # / fecha | Pregunta del issue (no diseñada en el template) | Resolución |
|---|---|---|
| D1 — 2026-10-09 | Entrada de la declaración mensual + validación/anomalía. | **Combinar simulado + real**: datos simulados para la demo **y** el form preparado para **montos reales** (helper «Completar con datos de ejemplo»); el `POST /businesses/:id/sales-periods` acepta montos declarados con `source:"declared"` y anomalía determinística. |
| D2 — 2026-10-09 | Pantalla/modal «Revisar y firmar». | **Reusar el flujo actual** (`prepare` → `TransactionReviewModal` → Freighter → `submit`), a **nivel campaña** (`settled`); el estado «Calculada · pendiente de tu firma» del template no tiene fuente persistida (§3.5, §5b). |
| D3 — 2026-10-09 | Bóvedas históricas y varias campañas por PyME. | **Listar todas** (vigente + históricas) en «Bóveda y distribuciones». |
| D4 — 2026-10-09 | Convención de doble visualización ARS + XLM. | **ARS principal + «≈ X XLM»** con la conversión sintética existente (`fx_rate`), badge `SIMULADO`. |
| D5 — 2026-10-09 | Cargar fondos en la wallet de la PyME (no diseñado). | **Guía/atajo friendbot de Testnet** (no custodial: Vaqcrow no mueve fondos). |
| D6 — 2026-10-09 | Vistas de la PyME (En revisión / Requiere cambios / Rechazada) y el vacío previo. | **Todas**, reusando `EmptyState` y el estado de la `sme_request` + banner de estado con `application_review.state`. |

Ninguna pregunta abierta del issue quedó sin decidir antes de implementarse.

> [!info] Corrección semántica de WU4 (D2)
> El estado `submitted` de una distribución **ya está firmado y enviado**, no «pendiente de tu firma»; se rotula «Enviada · pendiente de confirmación» y la acción «Revisar y firmar» se movió a nivel campaña (`settled`). Se registra aquí porque el vocabulario del template («Calculada · pendiente de tu firma») no está respaldado por datos persistidos.

## 7. Mapeo de criterios de aceptación (issue #434, citados textualmente)

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Mi campaña reproduces the wallet card, stats, vault and distribution list, declared-sales bars and distributions on real data." | ✅ **CUMPLIDO.** WU1a entrega el read model real (`GET /my-campaigns`, todas las campañas, vistas `service_role`, identidad server-side) y WU2 la vista `/company` que reproduce la wallet card, stats («Fondeado»/«Aportantes»), «Bóveda y distribuciones» con orden, «Ventas declaradas · 2026» (barras) y «Distribuciones»; WU3 cablea la declaración y WU4 la firma. | §3.1–3.5; suites WU1a/WU2/WU3; verificación independiente 7/7 + 7/7 |
| 2 | "A PyME can review a computed distribution and sign it in Freighter; the status moves from pending to confirmed only on ledger confirmation." | ✅ **CUMPLIDO.** WU4 reusa `prepare` → `TransactionReviewModal` → Freighter → `submit` a nivel campaña (`settled`); `sent ≠ confirmed` y el resultado muestra «Enviada · pendiente de confirmación» hasta la confirmación del ledger (poll). Corrección semántica `f66a578`: `submitted` no es «pendiente de firma». | §3.5; suite WU4 (94/94); §6 (D2) |
| 3 | "Money values show ARS plus a `SIMULADO` XLM equivalent; missing data is \"Sin dato\", never zero." | ✅ **CUMPLIDO.** WU1a expone `amountArs` + `amountXlm` (XLM 7 decimales); WU2 renderiza ARS (`es-AR`) + «≈ N XLM» rotulado `SIMULADO`; un valor ausente es `null` → «Sin dato», **nunca `0`** (vistas y contrato). | §3.1, §3.3; suites WU1a/WU2; verificación 7/7 |
| 4 | "Only the PyME can sign its distribution; Vaqcrow never holds keys or moves funds on its own." | ✅ **CUMPLIDO.** `GET /my-campaigns` es `only("PYME")` y la identidad es server-side; `prepare`/`submit` son `only("PYME")`; la firma es del PyME en Freighter; la guía friendbot es informativa y no custodial. | §3.1, §3.5, §3.6; suites api/web; verificación 7/7 |
| 5 | "Items under the open question heading are decided by the owner before implementation." | ✅ **CUMPLIDO.** D1–D6 (§6) resuelven las preguntas abiertas (declaración + anomalía, revisar y firmar, históricas/varias campañas, doble visualización ARS+XLM, fondos de Testnet, estados y vacío); ninguna se inventó. | §6 |
| 6 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Suites por WU (contracts 617/633/634, api 2485/2516/2524, `test:db` 23/828, web 67/67 · 96/96 · 94/94 · 139/139) + cierre (`pnpm run verify` exit 0 tras 1 retry, `test:boundaries` 164/164); fallos saneados (`400`/`401`/`403`/`404`/`503`; web `unavailable`/`network`/`unauthenticated`); anomalía determinística; sin filtrar `message`/`details`/`hint` ni secretos. | §4.1–4.3 |
| 7 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** Las seis preguntas abiertas del issue quedan decididas por el owner en D1–D6 (§6); los límites y el copy no diseñado se declaran owner-pending (§5). | §6 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin secretos, seeds ni PII; Testnet sin valor económico; ventas y distribuciones simuladas y rotuladas `SIMULADO`/`TESTNET`; el «hash» de Testnet demuestra ejecución técnica, no una inversión real; sin claims de producción. | Revisión de este documento |

## 8. Riesgos, contradicciones y limitaciones aceptadas

- **Verificación de UI sin navegador.** Los tests son de componente (jsdom), no E2E; la firma/envío reales de una distribución sobre Testnet quedan como verificación operativa manual.
- **«Revisar y firmar» a nivel campaña vs. la fila del template.** El estado «Calculada · pendiente de tu firma» no está respaldado por datos persistidos (§3.5, §5b): la acción se ofrece por campaña (`settled`), no por fila de distribución.
- **Limitación B1 del banner.** El `applicationId` se captura en sesión; sin submit previo tras un reload el banner no aparece (§5c). Un `findReviewStateByOwner` / `GET /my-application` lo haría robusto.
- **`GET /businesses/mine` devuelve el más nuevo.** Con varias campañas/negocios la declaración puede apuntar a otro negocio (§5d).
- **Eventos `pyme.*` no publicados.** Definidos, con puntos de disparo reportados, pero diferidos (§5f).
- **`Number(bigint)` > 2^53** sin guarda ni test de borde (§5g); contrato del response declarado ausente y sin test de «body ignorado» (§5h).
- **El *flake* de carga** de la suite web bajo turbo obligó a un retry del cierre; los WU verdes y las suites standalone no lo reprodujeron.
- **Nada de #434 está en `main`.** Los commits WU1a–WU5 son locales; el merge sigue atado a la **Opción A** (junto con #438). La única pieza en el remoto es la migración de WU1a.

## 9. Estado de entrega y próximos pasos

- **Nada de #434 está en `main`.** Todo vive en la rama `Vaqcrow#434_Feat_Deliver_the_PyME_Mi_campaña_dashboard`, apilada sobre la punta de #430 (`74237b1`); los commits WU1a–WU5 son **locales**. El merge sigue atado a la **Opción A** (junto con #438).
- **Camino a `main`:** #434 → #426 → #430 → #438. La migración de #434 (`20261009140000_create_my_campaigns_views`) quedó **aplicada al remoto** con autorización del owner, con el `version` alineado al repositorio.
- El cierre de la Feature lo decide el owner; esta sección sólo registra su decisión.
