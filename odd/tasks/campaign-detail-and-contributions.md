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
- [x] **WU3 — Flujo de aporte.** Modal «Revisión antes de firmar» reusado + redirección a wallet + «Enviada · pendiente de confirmación» + confirmación por ledger.
- [x] **WU4 — KYC simulado del inversor.** Interstitial one-shot en el primer aporte, `SIMULADO`, auto-aprobado.
- [x] **WU5 — «Retirar».** Acción en el aside gateada por estado/aporte ≠ 0.
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

### WU3 — Flujo de aporte (commit `c22f9f1`)

Ruta: **delegado** (un writer; helper puro + hook de wallet + componente de aporte + wiring en la vista, 2+ archivos no triviales). Sin tocar `/funding`, la API ni los contratos.

- **Diseño.** Reusa el **motor de invocación** existente (`useCampaignVault`: prepare→sign→submit→poll→refresh), el `TransactionReviewModal` compartido y `campaign-vault-errors`. CTA «Aportar a la campaña» **sólo** con `status==="funding"` + rol **INVERSOR** + `vaultAddress` presente (una PyME no aporta a su propia campaña; ADMIN nunca es INVERSOR). **Sin wallet** conectada → navega a `/portfolio` (conectar/crear Freighter); **con wallet** → abre «Revisión antes de firmar» con el contrato **truncado**, `Función contribute`, `Custodia` y el mínimo «10 XLM de prueba». Regla de aporte **pura** (`campaign-contribution.ts`, mínimo `100000000` stroops = 10 XLM, Testnet, vault id) validada antes de abrir el modal. «Enviada · pendiente de confirmación» se fija en el **momento de la firma** (sent ≠ confirmed); la confirmación aparece recién con el poll del ledger; luego «Aportar de nuevo». Sin cambios de contrato (`min_contribution` no se agregó, D3); no se inventa un error de «saldo insuficiente» (D4).
- **RED/GREEN observado.** RED: módulo puro ausente (import sin resolver). GREEN: enfocados **4 archivos / 29 tests** (helper 9, hook 4, detalle 8, aporte 8); web **199 archivos / 2010 tests**; `typecheck` limpio; `lint` sin errores (1 warning preexistente ajeno); `boundaries` sin violaciones (1020 módulos, 3329 dependencias); `test:boundaries` 164.
- **Verificación independiente (RDD off).** Un verifier read-only: **PASS, sin bloqueantes**. Confirmó el doble gate, la redirección sin wallet, el mínimo, el sent-vs-confirmed, la ausencia de secretos, y que no se tocó `/funding` ni los contratos. Advisories (cobertura): el rol ADMIN no tiene test propio; el aviso «Enviada…» queda tras confirmar (por diseño); `setReview(null)` en render (patrón derivado guardado).
- **Seams para WU4/WU5.** WU4: insertar el interstitial de KYC una sola vez antes de `setReview`. WU5: agregar «Retirar» junto al bloque de aporte (el disclaimer ya se renderiza) reusando `withdraw`.
- **Desvío.** El campo de monto vive en el aside, no dentro del modal (el `TransactionReviewModal` compartido renderiza valores y no colecta input, y está fuera de la superficie); el modal igual muestra el monto y el mínimo.

- **Work-unit commit.** `c22f9f1 feat(web): add the campaign contribution flow to the detail (#422)`.

### WU2b — Evidencia de ventas persistida (commit `445fb9b`)

Ruta: **delegado** (un writer) + **corrección acotada del orquestador**. Decisión del owner: **opción 1** (tabla persistida), tras descubrirse que la serie mensual **no estaba persistida** (la servía un provider simulado en memoria).

- **Diseño.** Tabla `public.business_sales_period` (PK `(business_id, period)`, FK cascade, check de formato/período, `sales_ars` nulo ⇔ mes faltante, RLS on **0 policies**, grants sólo `service_role`) sembrada con la **salida del provider determinista** (misma que ve la PyME) en la **creación de la empresa** (best-effort: nunca bloquea el alta) y por un **backfill idempotente** `seed:sales-periods:docker|cloud` (nunca en un GET ni en el arranque). La vista `marketplace_campaign_detail` se recreó **agregando** la serie al final (`security_invoker`, grants re-afirmados). Contract + port + adaptador + caso de uso + web: `salesEvidence` (estricto, nulable; mes faltante `null`, jamás 0; promedio excluye faltantes; `Distribución estimada/mes` sólo de valores persistidos y rotulada «estimada»; `SIMULADO`); la sección renderiza KPIs + gráfico (mes faltante = barra «Sin dato» punteada) + tabla de fuente, con el fallback honesto si `salesEvidence` es nulo.
- **RED/GREEN observado.** RED: contracts (schema ausente) 8 fallidos; caso de uso 4 fallidos. GREEN: contracts **567** (19 archivos), api **2339** (106), web **2014** (199), `test:db` **19 archivos / 628 tests PASS**; `typecheck` 8/8; `lint` sin errores; `boundaries` sin violaciones (1024 módulos, 3344 dependencias); `test:boundaries` 164.
- **Verificación independiente (RDD off) — un bloqueante, corregido.** El verifier marcó que, tras `POST /businesses/:id/sales-periods`, el provider avanzaba en memoria pero la tabla persistida **no**, así que el feed mostraba 9 meses y el detalle 8 (**divergencia alcanzable** desde el POST que usa el runbook). Corrección del orquestador: la ruta de ventas ahora **re-persiste la serie del provider** tras un registro aplicado (best-effort, sin fallar la respuesta; no re-persiste en un replay) + 3 tests (re-persist, replay idempotente, fallo de persistencia no rompe el 201). Otras advisories (no bloqueantes): el check SQL de período es más laxo que el contrato; falta test unitario del adaptador; el seed CLI es una superficie nueva declarada.
- **Migración remota.** `20261008230000_create_business_sales_period.sql` se probó en local y luego, con **autorización explícita del owner**, se **aplicó al proyecto remoto** (2026-10-08) vía MCP, con el `version` **alineado al repositorio** (`20261008230000`). Verificado en el remoto: `business_sales_period` con RLS on, **0 policies**, PK `(business_id, period)` y grants sólo `service_role` (`select`/`insert`/`update`); la vista `marketplace_campaign_detail` con `security_invoker=true`, **30 columnas** (con `sales_months`) y **cero** grants a `anon`/`authenticated`; advisors sin clase nueva.

- **Work-unit commit.** `445fb9b feat(api): persist and serve the PyME's sales evidence in the detail (#422)`.

### WU4 — KYC simulado del inversor

Ruta: **delegado** (un writer; contrato + port + caso de uso + adaptador + ruta + política + migración + pgTAP + web: port/gateway/factory/hook/interstitial + wiring y tests, 2+ archivos no triviales). El writer actualizó también esta bitácora para registrar el copy.

- **Decisión aplicada (D2).** El KYC del inversor es **simulado y auto-aprobado en el primer aporte**; aparece como **interstitial one-shot** tras «Aportar a la campaña», **antes** del modal de revisión, y una vez aprobado no vuelve a aparecer. No hay paso de admin ni rechazo.
- **Diseño.** Tabla `public.investor_kyc` (`user_id` PK → `profile` cascade, `approved_at`/`created_at` default `now()`, `simulado` default `true`), RLS on **0 policies**, grants sólo `service_role` (`select`/`insert`; `revoke all` previo). `GET /investor-kyc` y `POST /investor-kyc` **AUTHENTICATED** (cualquier rol), dueño siempre `request.principal.userId` (body/query ignorado). `GET` de un registro ausente es `{ approved:false, approvedAt:null, simulado:true }`, nunca error; `POST` idempotente: `201` al crear, `200` en replay, sin duplicar; el campo `created` es sólo del status, no del body (contrato estricto). Contract `investorKycSchema` (estricto, portable). Web calcado de favoritos: port → gateway HTTP con Bearer (200/201 éxito, 401/403→`unauthenticated`) → factory con sesión perezosa (null object sin base URL) → hook SWR `useInvestorKyc` (clave sólo con `port && canContribute`; expone `approved`, `isLoading`, `approve()`). En `campaign-contribution.tsx`, tras las verificaciones pre-firma y la wallet, si `approved` es falso se abre el `InvestorKycInterstitial`; al confirmar se llama `approve()` y recién entonces `openReview()`. El botón de aporte queda deshabilitado mientras `isLoading` (estado de KYC desconocido) y mientras la wallet carga.
- **Copy (owner-pending).** El template no diseña KYC de inversor, así que el copy es un placeholder mínimo y honesto: eyebrow «Antes de aportar», título «Verificación de identidad», badge **`SIMULADO`**, nota «No es una verificación real», cuerpo «Es tu primer aporte. En esta demo la verificación de identidad del inversor es simulada: no se revisa ningún documento real ni se valida tu identidad.» + «Al continuar, la simulación queda aprobada en tu cuenta y no vuelve a pedirse.», error «No pudimos registrar la verificación simulada. Reintentá.», botones «Aprobar y continuar» / «Cancelar». **Pendiente de aprobación/reemplazo por el owner.**
- **RED/GREEN observado.** RED: contracts (schema ausente) 5 fallidos; casos de uso (módulos ausentes) sin resolver. GREEN: contracts **572** (20 archivos), api **2381** (110), web **2043** (203), `test:db` **20 archivos / 668 tests PASS** (incluye `investor_kyc.sql`, 40 aserciones). Enfocados web **52** (campaign-detail + hook + infra kyc). `typecheck` 8/8; `lint` sin errores (1 warning preexistente ajeno); `boundaries` sin violaciones (1048 módulos, 3414 dependencias); `test:boundaries` 164.
- **Migración local.** `20261008240000_create_investor_kyc.sql` probada con `supabase migration up --local` y `pnpm run test:db` (verde). **No** se aplicó al proyecto remoto en este work unit (requiere autorización explícita del owner, como en WU1/WU2b).
- **Límite/seam.** No rompe WU3 (min 10, sin wallet → `/portfolio`, sent ≠ confirmed); el KYC nunca se pide a una PyME (el hook queda inactivo cuando `canContribute` es falso). El interstitial sólo se dispara desde el flujo de aporte.

### WU5 — «Retirar» (commit `562ad6f`)

Ruta: **delegado** (un writer; helper puro + componente + wiring en el aside + tests). Sin tocar `/funding`, la API ni los contratos.

- **Decisión aplicada (D4).** «Retirar» reusa el motor de bóveda (`useCampaignVault.withdraw`), el `TransactionReviewModal` compartido (Función `withdraw`) y `campaign-vault-errors`. El control aparece **sólo** con `status==="funding"` + rol **INVERSOR** + **aporte ≠ 0** (un aporte desconocido/nulo **nunca** se toma como cero: el control queda oculto). Sin wallet → `/portfolio` (igual que el aporte). La contribución propia se lee del read encadenado de la campaña con la clave pública del inversor persistida (el writer envuelve el `connect` del motor para no abrir Freighter); `sent ≠ confirmed` se conserva (la confirmación sale sólo del poll del ledger) y los fallos se sanean.
- **Copy (owner-pending).** El template no diseña el control de retiro: placeholder mínimo y honesto («Retirar mi aporte» / «Retirando…» / «Retirar de nuevo»; modal «Retirar tu aporte de {campaña}»; aviso «Enviada · pendiente de confirmación» reusado). **Pendiente de aprobación/reemplazo por el owner.**
- **RED/GREEN observado.** RED: módulos ausentes (import sin resolver). GREEN: enfocados **4 archivos / 40 tests** (gate 9, componente 13, detalle 10, aporte 13); web **205 archivos / 2066 tests**; `typecheck` limpio; `lint` sin errores (1 warning preexistente ajeno); `boundaries` sin violaciones (1053 módulos, 3448 dependencias); `test:boundaries` 164.
- **Verificación independiente (RDD off).** Un verifier read-only: **PASS, sin bloqueantes**. Confirmó el gate (unknown ≠ zero), el reuso del motor/modal, sent ≠ confirmed, el saneo y que `/funding`/API/contratos no se tocaron. Advisories: la rama «sin wallet → `/portfolio`» es efectivamente inalcanzable en producción (sin clave no hay `investorContributionStroops`, así que el control queda oculto; coincide con el flujo de aporte, el test la cubre con un doble); «Enviada…» persiste tras un envío fallido (mismo patrón que el aporte, copy owner-pending).
- **Límite.** Sin migraciones (web-only). Falta WU6 (evidencia).

- **Work-unit commit.** `562ad6f feat(web): add the withdraw action to the campaign detail (#422)`.
