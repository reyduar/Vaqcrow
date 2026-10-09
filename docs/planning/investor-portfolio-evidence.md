# Evidencia de cierre de la Feature #426 — Issue #429

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#427](https://github.com/reyduar/Vaqcrow/issues/427) (implementación), [#428](https://github.com/reyduar/Vaqcrow/issues/428) (pruebas) y [#429](https://github.com/reyduar/Vaqcrow/issues/429) (evidencia) de la Feature [#426](https://github.com/reyduar/Vaqcrow/issues/426) ("Feature: Deliver the investor portfolio"), mapea cada criterio de aceptación de la Feature, **citado textualmente**, a su resultado, a la fuente de ese resultado y al comando exacto detrás de él. La bitácora de iteración que lo alimenta es [[odd/tasks/investor-portfolio|Bitácora: portafolio del inversor]].

> [!warning] Estado de entrega: nada de #426 está en `main`
> El trabajo vive en la rama de integración `Vaqcrow#426_Feat_Deliver_the_investor_portfolio`, apilada sobre la punta de #422. Nada llega a `main`: la **Opción A del owner** mergea la pila junta con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)). No hay PR ni merge en esta Feature; los commits WU1–WU4 son **locales** y este documento **no** reporta un estado mergeado ni de CI.

## 1. Contexto y objetivo

La Feature #426 entrega la vista del inversor **«Mi portafolio»** (template `Vaqcrow Portafolio.dc.html`, modo inversor): tarjeta de wallet no custodial, totales, «Mis aportes en PyMEs» con estados y orden, «Aportes por sector» y «Distribuciones». Sólo con sesión de rol `INVERSOR`; `/portfolio` era un esqueleto (`PageHeading`) y el inversor que había aportado no veía sus posiciones, sus distribuciones recibidas ni podía retirar o reembolsar desde un solo lugar.

Reutiliza el motor existente (persistencia de campaña, bóveda/despliegue de #410, wallet Freighter de #406, notificaciones de #382 y el motor de invocación de bóveda `useCampaignVault` que ya usaba `campaign-workspace.tsx`) y agrega: un **modelo de lectura** del portafolio (backend), la **vista `/portfolio`** (web), el **retiro y reembolso**, y los **estados** de vacío/sin wallet/errores de Freighter/fondos de Testnet — incluida la habilitación de que un `INVERSOR` persista su propia clave Stellar (hoy el único escritor es `POST /profile/wallet`, que era `only("PYME")`; sin ese camino un inversor real obtiene un portafolio vacío, hallazgo confirmado en WU1).

| Task | Rama | Estado del issue |
|---|---|---|
| #427 — implementar | `Vaqcrow#426_Feat_Deliver_the_investor_portfolio` | abierto; WU1–WU4 |
| #428 — probar | (misma rama de la Feature) | abierto |
| #429 — documentar | (misma rama de la Feature) | este documento |

La Feature #426 depende de #422 y desbloquea a #430 (Informes). El cierre lo decide el owner.

## 2. Cómo leer esta evidencia

- **Fuentes, siempre nombradas.** (a) **Bitácora** — una entrada fechada de [[odd/tasks/investor-portfolio]] por work unit (WU1–WU4), cada una con su commit y sus resultados RED/GREEN; se **cita**, no se re-ejecutó al escribir este documento. (b) **Verificación independiente por work unit (RDD off)** — un verificador read-only por WU, con su conteo PASS/FAIL y las correcciones acotadas. (c) **Cierre de la Feature** — los comandos de cierre (`pnpm run verify`, `pnpm run boundaries`, `pnpm run test:boundaries`) y su resultado, registrados en el handoff de cierre. Este documento **no** re-ejecuta las suites: nombra el comando exacto y su fuente.
- **Dobles, no proveedores.** Ninguna prueba PR-gated habla con Testnet, Horizon, RPC de Soroban, el LLM ni Supabase remoto. Las pruebas de API y de la web usan dobles y fixtures; sólo `pnpm run test:db` toca una base, y es el stack local.
- **Sin secretos.** Ningún email, contraseña, seed, clave privada, API key ni token aparece en este documento; las variables se nombran, nunca sus valores. No se introducen `seeds`, PII ni `SUPABASE_*`.
- **Sin claims de producción.** Todo corre sobre **Testnet** y sin valor económico; las posiciones, distribuciones y ventas son **simuladas**; el revenue share es de demo. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado

Fuente: bitácora (WU1–WU4, 2026-10-08/09).

### 3.1 WU1 — Modelo de lectura del portafolio (commit `83b7fc6`)

Contract `packages/contracts/src/portfolio.ts` (estricto, portable, **sin PII**): `xlmAmountSchema` canónico (string decimal con **exactamente 7 decimales**, nunca un `number`), `PortfolioPositionStatus` (`funding | settled | refunding`, el mismo vocabulario de `campaignDetailStatusSchema`) y el resto del read model. Endpoint `GET /portfolio` (**AUTHENTICATED → `only("INVERSOR")`**). Dos vistas nuevas `security_invoker` con grants **sólo `service_role`**: `investor_portfolio_position` (que **no** filtra `campaign.state = 'open'`: incluye campañas liquidadas y reembolsables) e `investor_portfolio_distribution`. La **identidad se resuelve server-side** desde el `profile.stellar_public_key` del principal verificado; un `?investor=` de query se **ignora** (hay test). `totalDistributionsXlm` suma **sólo** distribuciones `confirmed` y es `null` (nunca `0.0000000`) si no hay ninguna; `raisedArs` nulo sin snapshot. Fallos saneados (`503`). Archivos: `route-policy.ts`, `portfolio-repository-port.ts`, `get-investor-portfolio.ts` (+ test), `supabase-portfolio-repository.ts` (+ test), `portfolio.route.ts` (+ test), migración `20261009120000_create_investor_portfolio_views.sql` y `supabase/tests/portfolio.sql`.

**Migración remota.** `20261009120000_create_investor_portfolio_views.sql` probada en local y luego, con **autorización explícita del owner**, **aplicada al proyecto remoto** (2026-10-09), con el `version` del historial **alineado al repositorio** (`20261009120000`). Verificado en el remoto: ambas vistas con `security_invoker=true` (**17** y **8** columnas), `SELECT` sólo `service_role` y **cero** grants a `anon`/`authenticated`; advisors sin clase nueva.

### 3.2 WU2 — Vista `/portfolio` (commit `d02a8f5`)

Vista **read-only** con capa de datos calcada del resto de la web (port → gateway HTTP con `Authorization: Bearer` → factory → null object) + hook SWR `["portfolio"]` (`shouldRetryOnError:false`, `revalidateOnFocus:false`). Helpers **puros** (`apps/web/src/application/portfolio/`): `status` (etiquetas que espejan `campaign-detail-view.tsx:69-71` — «Fondeo abierto»/«Meta alcanzada»/«Reembolso disponible»; sólo el cuerpo de `funding` lleva la `closeDate` real en `dd/mm/aaaa`, `settled`/`refunding` renderizan sólo la etiqueta), `sort` (`recent` = orden del API; `state` = rank estable `funding→settled→refunding`, empates conservan el orden del API), `sectors` (**BigInt** sobre XLM canónico, porcentaje entero, descendente, total cero → `[]`) y `format` (es-AR, 7 decimales). Componentes presentacionales: totales (`totalDistributionsXlm` nulo → «Sin dato», nunca `0`), tarjeta de posición (imagen, nombre, meta, `SIMULADO`, «Mi aporte», «% de la meta» + barra, bloque de estado, «Ver campaña»), barras de sector y lista de distribuciones. La wallet card se monta **sólo con clave**; la ruta ya está gateada `INVERSOR` por `(app)/layout.tsx` + `RouteGate`.

### 3.3 WU3 — Retiro y reembolso (commit `b90a96c`)

Un único componente `PortfolioPositionAction`, parametrizado por la operación derivada del **`status` del portafolio** (`positionActionFor`: `funding`→retirar, `refunding`→reembolsar, `settled`→ninguna). Reusa el motor `useCampaignVault` (`withdraw`/`refund`, sin monto), el `TransactionReviewModal` y el `TransactionStatusList` (D4: último estado de la tx por tarjeta; el historial completo queda para #430). La **disponibilidad del reembolso** es el estado derivado server-side `refunding` — el API ya pliega «funding vencido bajo la meta» ahí (`get-investor-portfolio.ts:102-108`) —, de modo que la web nunca re-chequea un deadline. **No** se bifurcó `campaign-withdraw.tsx`. Corrección acotada post-verificación: (1) un resultado post-firma **inconcluso** (timeout del poll → `unavailable`, `network`, `unknown`) ya **no** se rotula «Fallida»; sólo un fallo definido (`refused`/`not_funding`) lo hace; (2) se eliminó el único import `application/ → presentation/` del repo (era type-only) moviendo `positionActionDescriptionRows`/`positionActionStatusItems` a `presentation`.

### 3.4 WU4 — Estados y wallet del inversor (commit `84fd356`)

**API.** Las tres rutas de wallet se abrieron a `only("PYME", "INVERSOR")` — `POST /profile/wallet/challenge`, `POST /profile/wallet` y `GET /profile/wallet` —, **sin `ADMIN`**. Las rutas y casos de uso ya eran role-agnósticos (resuelven el dueño del principal verificado) e `isFrozen` es `false` sin `sme_request`, así que un `INVERSOR` persiste su propia clave sin efecto privilegiado. Se actualizó la **MATRIX** de `authorization.test.ts` (exact-match contra `ROUTE_POLICY_KEYS`) y el bloque de `wallet.route.test.ts` que exigía 403 para no-PYME → ahora INVERSOR permitido, ADMIN 403.

**Web.** Reusa `connectAndStoreWallet` + `WALLET_KIND_COPY`/`WALLET_CONNECTION_COPY` (sin duplicar copy) y construye una **tarjeta modo conectar** con la guía de fondos de Testnet (Friendbot + Stellar Laboratory) y un **estado vacío** con CTA «Explorar PyMEs» → `/explore`. Correcciones acotadas: (1) **honestidad del estado vacío** — `GET /portfolio` devuelve 200 con portafolio vacío sintético cuando no hay clave persistida, así que «Todavía no aportaste» se gatea a `wallet !== null && contributions.length === 0` y **toda la superficie de datos** (totales, posiciones, sectores, distribuciones) se gatea a una wallet conocida: sin wallet sólo se muestra la tarjeta de conexión; se endurece además el assert del body de `GET /profile/wallet` del inversor (`{ publicKey: null, frozen: false }`). (2) El commit `f477d77` tipa el arreglo de requests del test de la ruta de wallet (fix de tipos, sin cambio de comportamiento).

### 3.5 Rutas y migración

| Método y ruta | Autorización | Resultado |
|---|---|---|
| `GET /portfolio` | `INVERSOR` | posiciones + distribuciones + totales del inversor verificado |
| `POST /profile/wallet/challenge` | `PYME`, `INVERSOR` | desafío de conexión (sin `ADMIN`) |
| `POST /profile/wallet` | `PYME`, `INVERSOR` | persiste la clave Stellar del principal verificado |
| `GET /profile/wallet` | `PYME`, `INVERSOR` | clave propia; sin registro `{ publicKey: null, frozen: false }` |

Migración (probada en local y **aplicada al proyecto remoto** con autorización del owner, con el `version` alineado al repositorio): `20261009120000_create_investor_portfolio_views`.

## 4. Qué quedó probado

### 4.1 Resultados RED/GREEN por work unit

Fuente: [[odd/tasks/investor-portfolio]] (cada entrada cita su commit).

| WU | Comando(s) y resultado | Commit |
|---|---|---|
| WU1 | `pnpm --filter @vaqcrow/contracts test` → **584** (21 archivos) · `pnpm --filter @vaqcrow/api test` → **2408** (113) · `pnpm run test:db` → **21 archivos / 716 tests PASS** (`portfolio.sql`, 48 aserciones) · `pnpm run typecheck` 8/8 · `pnpm run boundaries` sin violaciones (1062 módulos / 3481 deps) · `pnpm run test:boundaries` **164** | `83b7fc6` |
| WU2 | `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **56/56** (12 archivos) · `tsc --noEmit` limpio · `pnpm run boundaries` sin violaciones (1098 / 3582) · `pnpm run test:boundaries` **164/164** | `d02a8f5` |
| WU3 | `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **65/65** (11 archivos) · `tsc --noEmit` limpio · `pnpm run boundaries` sin violaciones (1103 / 3613) | `b90a96c` |
| WU4 | `pnpm --filter @vaqcrow/api test` → **366/366** (authorization 351 + wallet.route 15) · `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4` → **85/85** (13 archivos) · `tsc --noEmit` limpio · `pnpm run boundaries` sin violaciones (1108 / 3636) | `84fd356` |

**Cierre de la Feature.** `pnpm run verify` → **exit 0** tras el **único retry documentado** (el *flake* conocido de un *timeout* de 5 s de la suite web bajo la carga de turbo, archivo ajeno al cambio). `pnpm run boundaries` → sin violaciones. `pnpm run test:boundaries` → **164/164**. `lint` sin errores (1 warning preexistente ajeno).

### 4.2 Verificación independiente por work unit (RDD off)

Tras cada writer delegado corrió un verificador read-only:

| WU | Resultado | Hallazgo |
|---|---|---|
| WU1 | sin bloqueantes | confirmó identidad del principal (`?investor=` ignorado), scoping por cuenta, vistas sólo `service_role`, posiciones liquidadas incluidas, total confirmado-only con `null`, errores saneados |
| WU2 | **8/8 PASS** | sin bloqueantes |
| WU3 | **8/8 PASS** | 2 advisories reales accionados en la corrección (honestidad del resultado inconcluso; layering `application/ → presentation/`) |
| WU4 | **7/8 PASS** | 1 **FAIL** real: el estado vacío se mostraba sin wallet → accionado (gate del `EmptyState` y de toda la superficie de datos + assert del body de `GET /profile/wallet`) |

### 4.3 Cobertura

- **contracts**: `portfolio.ts` (estricto, portable; XLM 7 decimales; estados `funding|settled|refunding`; sin PII).
- **api**: `GET /portfolio` (identidad del principal, `?investor=` ignorado, vistas sólo `service_role`, posiciones liquidadas/reembolsables incluidas, total confirmado-only con `null`, `503` saneado); política `INVERSOR` y MATRIX de autorización; rutas de wallet abiertas a `PYME`+`INVERSOR` (ADMIN 403).
- **web**: helpers puros (status, sort, sectors, format, distribution-state), capa de datos (códigos saneados, `imageSrc` absoluta), la vista (estados vacío/sin wallet/carga/error), el retiro y el reembolso (gate por `status`, reuso del motor, sent ≠ confirmed, inconcluso ≠ «Fallida»), la tarjeta modo conectar, los errores de Freighter reusados y la guía de fondos de Testnet.

### 4.4 No re-ejecutado

- **Testnet / Horizon / RPC**: el aporte/retiro/reembolso reales sobre Testnet quedan como **verificación operativa manual** (fuera del gate; requieren Freighter y red reales).
- **`test:integration`** contra Supabase remoto (fuera del gate).
- **Re-ejecución de las suites para este documento**: los números de §4.1 se citan de la bitácora y del cierre de la Feature; el único chequeo re-ejecutado al escribirlo fue la verificación estructural de este documento (§7).

## 5. Límites, advisories y copy owner-pending

- **(a) Copy owner-pending.** El template no diseña el estado vacío, la tarjeta en modo conectar ni la guía de fondos de Testnet; sus textos (y los estados/mensajes no diseñados) son placeholders mínimos y honestos, **pendientes de aprobación/reemplazo por el owner**.
- **(b) `Desconectar` es local.** En la wallet card oculta la tarjeta y vuelve al modo conectar; el desconectado **persistido** necesita una ruta de API nueva, fuera de alcance.
- **(c) Cuerpos `settled`/`refunding` sólo etiqueta.** El template referencia un número de ledger de liquidación que **no** se persiste; se renderiza sólo la etiqueta, sin fabricar el número (copy owner-pending).
- **(d) «Recientes» = orden del API.** El read model no trae una fecha por aporte (`contributedAt` real es candidato para **#430**), así que el orden «Recientes» refleja el orden del API.
- **(e) Copy de distribución `failed`.** Reusa «Fallida» del vocabulario de la evidencia; owner-pending.
- **(f) Copy de error del modal.** Ante un resultado inconcluso post-envío, el modal puede mostrar un copy contradictorio; es **preexistente y sistémico** en `campaign-withdraw` (no de esta Feature), registrado como follow-up.
- **Sin paginación** en la vista del portafolio (una sola grilla). **Sin historial por transacción persistido**: la tarjeta muestra el último estado de la tx (D4); el historial completo por-transacción queda para #430.

## 6. Decisiones del owner

| # / fecha | Pregunta del issue (no diseñada en el template) | Resolución |
|---|---|---|
| D1 — 2026-10-08 | Acción «Reembolsar» y estado «Reembolso disponible». | **Acción en la tarjeta de posición**, reusando el motor `refund` y la regla ya existente de `campaign-workspace` (bóveda en `refunding`, o `funding` vencido bajo la meta). |
| D2 — 2026-10-08 | Confirmación del retiro / portafolio vacío / sin wallet o desconectada. | Reusar `TransactionReviewModal` para el retiro; **estado vacío propio + CTA «Explorar PyMEs»**; mostrar la wallet card en **modo conectar** cuando no hay wallet. |
| D3 — 2026-10-08 | Errores de Freighter y fondos de Testnet. | Reusar **tal cual** `WALLET_KIND_COPY` + `WALLET_CONNECTION_COPY` (no-instalada, rechazada, red equivocada) y un texto corto con **Friendbot de Testnet + Stellar Laboratory**. |
| D4 — 2026-10-08 | Historial por transacción y destino del explorador. | Por tarjeta de campaña con el **último estado de la tx** (`TransactionStatusList`); el historial completo por-transacción se difiere a **#430**. «Explorador» → `stellar.expert/explorer/testnet/account/<clave>`; «Ver campaña» → la ruta de #422. |

Ninguna pregunta abierta del issue quedó sin decidir antes de implementarse.

## 7. Mapeo de criterios de aceptación (issue #426, citados textualmente)

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The investor portfolio reproduces the wallet card, totals, positions, statuses, sorting, sector bars and distributions on real data." | ✅ **CUMPLIDO.** La vista reproduce la tarjeta de wallet, totales, posiciones (con estados y orden), barras por sector y distribuciones sobre el read model real (vistas `service_role`); la capa de wallet/estados no diseñados queda **owner-pending** (§5a). | §3.1–3.4; suites WU2/WU4; verificación independiente |
| 2 | "\"Retirar mi aporte\" withdraws through Freighter only while funding is open and ends in \"Enviada · pendiente de confirmación\"." | ✅ **CUMPLIDO.** `positionActionFor` ofrece retirar **sólo** con `status="funding"`; la firma pasa por Freighter (`useCampaignVault.withdraw` + `TransactionReviewModal`) y el flujo termina en «Enviada · pendiente de confirmación» (sent ≠ confirmed). | §3.3; suite web WU3 (65/65) |
| 3 | "Pending, confirmed and goal-reached statuses reflect ledger state; the page never shows a return promise." | ✅ **CUMPLIDO.** Los estados se derivan server-side del espejo confirmado del ledger (`deriveStatus`: `settled`/`refundable`/meta/`deadline`); «Enviada» se fija al firmar y la confirmación sólo con el poll del ledger; ningún texto promete retorno. | §3.1, §3.3; suites api/web |
| 4 | "Refund behavior is not implemented until the owner decides the open question." | ✅ **CUMPLIDO — el owner lo decidió (D1, 2026-10-08).** Con la pregunta abierta resuelta, el reembolso **sí** se implementa: la acción vive en la tarjeta de posición y reusa el motor `refund` de la bóveda y la regla ya existente de `campaign-workspace`; la disponibilidad es el estado derivado `refunding` (§3.3, §6). | §3.3, §6; suite web WU3 |
| 5 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Suites por WU + cierre (`pnpm run verify` exit 0 tras 1 retry) + `test:db` (21/716); fallos saneados (`503`; web `unavailable`/`network`/`unauthenticated`); sin filtrar `message`/`details`/`hint` ni secretos; 8/8 · 8/8 · 7/8 y el FAIL accionado. | §4.1–4.3 |
| 6 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** D1–D4 (§6) resuelven las cuatro preguntas abiertas del issue (reembolso, estados vacío/sin-wallet/confirmación, errores de Freighter/fondos de Testnet, historial y explorador); ninguna se inventó. | §6 |
| 7 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin secretos, seeds ni PII; Testnet sin valor económico; posiciones/distribuciones simuladas y rotuladas `SIMULADO`; sin claims de producción. | Revisión de este documento |

## 8. Riesgos, contradicciones y limitaciones aceptadas

- **Verificación de UI sin navegador.** Los tests son de componente (jsdom), no E2E; el retiro/reembolso reales sobre Testnet quedan como verificación operativa manual.
- **Copy owner-pending** (estado vacío, tarjeta de conexión, guía de fondos, cuerpos de distribución) son las brechas de fidelidad declaradas.
- **Historial por-transacción e `contributedAt`** dependen de #430; hoy «Recientes» refleja el orden del API.
- **El *flake* del *timeout* de 5 s** de la suite web bajo la carga de turbo obligó a un retry del cierre; los WU verdes y `test:db` no lo reprodujeron.

## 9. Estado de entrega y próximos pasos

- **Nada de #426 está en `main`.** Todo vive en la rama de integración, apilada sobre #422; los commits WU1–WU4 son locales. El merge sigue atado a la **Opción A** (junto con #438).
- **Camino a `main`:** #426 → #430 → #438. La migración de #426 quedó **aplicada al remoto** con autorización del owner.
- El cierre de la Feature lo decide el owner; esta sección sólo registra su decisión.
