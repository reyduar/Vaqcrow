# Bitácora — Feature #422: Detalle de campaña y aportes

Rama: `Vaqcrow#422_Feat_Show_campaign_detail_and_handle_contributions`, creada desde la punta de #414 (`77e6b25`).

## Objetivo

Entregar la página de detalle de campaña (template `Vaqcrow Detalle PyME.dc.html`) y el flujo de aporte: compuerta de cuenta, modal «Revisión antes de firmar», redirección a la wallet, y el KYC simulado del inversor en el primer aporte. El detalle sólo muestra campañas **publicadas** (misma definición que el marketplace de #414).

## Problema y por qué

El marketplace (#414) lista campañas y su CTA apunta a `/campaigns/<id>`, que hoy **no existe** (404 provisional). El inversor no puede ver la evidencia y el riesgo de una PyME ni aportar. La Feature #422 cierra ese lado y desbloquea #426 (Mi portafolio).

## Decisiones del owner (2026-10-08)

| # | Pregunta del issue | Resolución |
|---|---|---|
| D1 | Estados «Meta alcanzada», «Reembolso disponible», cerrada/vencida (el template sólo diseña «Fondeo abierto»). | **Derivar** de `campaign.state` + `deadline`, reusando el copy de `evidence-timeline` («Fondeo abierto / Meta alcanzada / Reembolso disponible»); una campaña vencida bajo la meta es reembolsable, como ya trata `campaign-workspace.tsx`. |
| D2 | Dónde aparece el KYC simulado del inversor (el template no lo diseña). | **Interstitial una sola vez** tras el primer «Aportar a la campaña», auto-aprobado; deja el modal del template intacto. |
| D3 | Quién fija plazo y aporte mínimo. | El plazo se fija al **abrir la bóveda** (form de la PyME en «Mi campaña»), como hoy; el detalle sólo lo **muestra**. El mínimo se **muestra** («10 XLM de prueba»); no se agrega `min_contribution` al contrato en esta Feature. |
| D4 | Errores del modal y acción «Retirar». | Reusar `TransactionReviewModal` + `campaign-vault-errors`; reusar `withdraw` gateado en `state==="funding"` y aporte ≠ 0. «Saldo insuficiente» no es detectable hoy (el adapter de saldo simula 0): se acepta el fallo genérico hasta que exista un balance real. |

## Alcance autorizado

- Endpoint de detalle (contract + port + adapter + caso de uso + ruta + política) y vista `/campaigns/[id]` con la **compuerta de cuenta** (abrir el detalle exige sesión; el template la diseña).
- Secciones del template: breadcrumb + nombre + tagline + badges (KYC aprobado `SIMULADO`, riesgo), imagen «Imagen representativa», «Sobre la PyME», «Destino de los fondos», «Evidencia de ventas», «Recomendación de IA», «Decisión humana», «Términos», aside «Aportar a la campaña».
- Flujo de aporte reubicado desde `/funding` (`campaign-workspace.tsx`): modal de revisión, firma en Freighter, «Enviada · pendiente de confirmación» y confirmación por ledger.
- KYC simulado del inversor (interstitial, primer aporte).
- Acción «Retirar» en el aside cuando corresponde.
- Tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- **Sin PII** en el wire público del detalle; el detalle exige sesión.
- Fuente visual: `Vaqcrow Detalle PyME.dc.html` (template manda; `demo-ui.md` §2 en reglas de confianza/accesibilidad).
- Nunca prometer retorno; riesgo siempre texto + ícono; `SIMULADO`/`DEMO`/`TESTNET`; «Sin dato / faltante» nunca es cero.
- `packages/contracts` portable; `apps/web` consume sólo contratos; `presentation/` no importa contratos salvo type-only; `application/` (web) sin React.
- **Datos no persistidos** (tagline, empleados, usos-de-fondos con %) → fallback honesto «Sin dato»/omitir; agregarlos al onboarding queda como follow-up, no se inventan.
- No custodial: Vaqcrow nunca firma por el inversor; el aporte lo firma Freighter.

## Tareas

- [x] **WU1 — Modelo de lectura y endpoint de detalle.** Contract `campaignDetail` + port + adaptador (vista SQL `service_role`) + caso de uso + ruta AUTHENTICATED + política, con el **estado derivado** y los campos persistidos; «Sin dato» para los ausentes. Sin `apps/web`.
- [x] **WU2 — Vista `/campaigns/[id]` (web).** Compuerta de cuenta, secciones del template, estados (carga/error/404/no-sesión) y variantes por estado de campaña.
- [ ] **WU3 — Flujo de aporte.** Modal «Revisión antes de firmar» reusado + redirección a wallet + «Enviada · pendiente de confirmación» + confirmación por ledger.
- [ ] **WU4 — KYC simulado del inversor.** Interstitial one-shot en el primer aporte, `SIMULADO`, auto-aprobado.
- [ ] **WU5 — «Retirar».** Acción en el aside gateada por estado/aporte ≠ 0.
- [ ] **WU6 — Verificación y evidencia.** Suites, `verify`, y `docs/planning/campaign-detail-and-contributions-evidence.md`.

Forecast: Feature grande (varios work units). Entrega **feature-branch-chain**: cada work unit commitea en esta rama; la estrategia de PR se decide antes del primer PR.

## Checks aplicables

- `pnpm --filter @vaqcrow/contracts test`, `pnpm --filter @vaqcrow/api test`, `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run boundaries`, `pnpm run test:boundaries`
- `pnpm run test:db` si el work unit toca el esquema o una vista.
- `pnpm run verify` al cierre de cada work unit.

## Progreso

### WU1 — Modelo de lectura y endpoint de detalle (commit `9c3a5b9`)

Ruta: **delegado** (un writer; contrato + port + caso de uso + adaptador + ruta + política + vista SQL + pgTAP, 2+ archivos no triviales). Sin `apps/web`. El writer devolvió **partial**: faltaba cablear el adaptador en el composition root (`apps/api/src/index.ts`, fuera de su superficie); el orquestador lo completó inline (una importación + una instancia + un campo de dependencia).

- **Diseño.** Contract `campaignDetailSchema` (estricto, portable, sin PII; reusa `campaignIdSchema`, `riskBandSchema` y la regla de `imageUrl` API-relativa del marketplace). Vista `public.marketplace_campaign_detail` (`security_invoker=true`, `revoke all` + `select` sólo `service_role`) con la **misma** regla de publicación de #414 (`campaign_deployment.state='confirmed'` **y** `campaign.state='open'`), y el lateral de la imagen **idéntico** al de `20261008202537` (`kind='photo'`). Endpoint `GET /marketplace/campaigns/:campaignId` **AUTHENTICATED** (compuerta de cuenta); `400` id no-UUID, `404` no publicada/desconocida, `503` saneado. Estado **derivado** `funding | settled | refunding`, alineado al vocabulario que ya renderiza la web (`evidence-timeline`) y gatea `campaign-workspace`; `raisedArs` nulo sin snapshot (nunca 0) y `fundedPercentBps` clampado con `BigInt`.
- **Hallazgo.** La dirección de la bóveda **sí** está persistida: `campaign.contract_address`. Los campos no persistidos por el template (tagline, empleados, usos-de-fondos con %) viajan como `null` → «Sin dato» en la web.
- **RED/GREEN observado.** El writer no capturó un RED separado (superficie nueva; lo declaró de forma honesta). GREEN: contracts **562** (19 archivos), api **2336** (106), `test:db` **19 archivos / 608 tests PASS** (incluye `marketplace_campaign_detail.sql`, 74 aserciones; `campaign_persistence.sql` ok tras agregar `drop view` a su reversión). `typecheck` limpio; `boundaries` sin violaciones (995 módulos, 3232 dependencias); `test:boundaries` 164.
- **Verificación independiente (RDD off).** Un verifier read-only: **sin bloqueantes**. Confirmó ruta AUTHENTICATED + `MATRIX` alineado, regla de publicación, sin PII en el wire, estado alineado y cableado real en `index.ts`. Advisories (cobertura): sin test unitario del adaptador (se ejercita por la ruta), el pgTAP no afirma explícitamente la ausencia de columnas PII, y `image_object_path` embebe el UUID del dueño en una vista sólo `service_role` (mismo patrón aceptado de #414; nunca viaja al wire).
- **Migración.** `20261008220000_create_marketplace_campaign_detail_view.sql` probada en el stack local y luego, con **autorización explícita del owner**, **aplicada al proyecto remoto** (2026-10-08) vía el MCP, con el `version` del historial **alineado al repositorio** (`20261008220000`). Verificado en el remoto: vista con `security_invoker=true`, **29 columnas**, `SELECT` sólo `service_role` y **cero** grants a `anon`/`authenticated`; advisors sin hallazgos nuevos.
- **Límite explícito.** Sin `apps/web` (la vista `/campaigns/[id]` es WU2).

### WU2 — Vista `/campaigns/[id]` (commit `4967b1f`)

Ruta: **delegado** (un writer; port + gateway + factory + hook + controlador + vista + página + tests, 2+ archivos no triviales). Ningún archivo previo modificado.

- **Diseño.** Ruta **pública** `/campaigns/[id]` (`AppShell`) que monta un contenedor cliente; **anónimo** renderiza la **compuerta** del template («Ingresá para ver esta campaña» + links a `/login` y `/signup`) **sin hacer ningún fetch**; con sesión, el controlador pide el detalle. Capa de datos calcada de #414: `campaign-detail-port` (contrato espejado con `imageSrc` **absoluto**, códigos `unavailable|network|unauthenticated|not_found`), gateway HTTP con Bearer (401/403→`unauthenticated`, 404→`not_found`), factory con sesión perezosa y hook SWR (clave sólo con `port && enabled`; nunca fabrica datos). Estados mutuamente excluyentes: compuerta → carga → `not_found` → error+reintentar → detalle.
- **Fallbacks honestos.** «Destino de los fondos» y «Evidencia de ventas» **no** están expuestos por el endpoint todavía → renderizan un «Sin dato» explícito, sin inventar porcentajes ni KPIs (no se llama a la ruta privada de ventas de la PyME). «Empleados» queda como «Sin dato» (no persistido). `raisedArs`/`assessment`/`decision`/`riskBand` nulos → «Sin dato»/«Riesgo sin dato», nunca `ARS 0`.
- **Fuera de WU2.** El CTA «Aportar a la campaña» se **omite** a propósito (no se deja un control inerte): el flujo de aporte es WU3.
- **RED/GREEN observado.** RED: 4 módulos nuevos sin resolver. GREEN: enfocados **6 archivos / 45 tests**; web **196 archivos / 1989 tests**; `typecheck` limpio; `lint` sin errores (1 warning preexistente ajeno); `boundaries` sin violaciones (1012 módulos, 3285 dependencias); `test:boundaries` 164.
- **Verificación independiente (RDD off).** Un verifier read-only: **PASS, sin bloqueantes**. Confirmó que el anónimo no dispara el fetch (la clave SWR queda `null`), los estados no se solapan, los «Sin dato» no son cero, el mapeo de errores y el `imageSrc` absoluto, la ausencia deliberada del CTA y los límites. Advisories: `vaultAddress` viaja en el port pero todavía no se renderiza (se usará en el modal de WU3); la docstring del port decía «no PII» y viaja el `actor` (nombre de display del admin que el template diseña) → **corregida** en el mismo work unit.
- **Límite explícito.** Sin flujo de aporte (WU3), sin KYC del inversor (WU4), sin «Retirar» (WU5).

- **Work-unit commit.** `4967b1f feat(web): add the campaign detail view with the account gate (#422)`.
