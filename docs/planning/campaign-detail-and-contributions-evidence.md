# Evidencia de cierre de la Feature #422 — Issue #425

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#423](https://github.com/reyduar/Vaqcrow/issues/423) (implementación), [#424](https://github.com/reyduar/Vaqcrow/issues/424) (pruebas) y [#425](https://github.com/reyduar/Vaqcrow/issues/425) (evidencia) de la Feature [#422](https://github.com/reyduar/Vaqcrow/issues/422) ("Feature: Show campaign detail and handle contributions"), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/campaign-detail-and-contributions|Bitácora: detalle de campaña y aportes]].

> [!warning] Estado de entrega: nada de #422 está en `main`
> El trabajo vive en la rama de integración `Vaqcrow#422_Feat_Show_campaign_detail_and_handle_contributions`, apilada sobre la punta de #414. Nada llega a `main`: la **Opción A del owner** mergea la pila junta con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)). No hay PR ni merge en esta Feature y este documento no reporta un estado mergeado.

## 1. Contexto y objetivo

La Feature #422 entrega la página de detalle de campaña (template `Vaqcrow Detalle PyME.dc.html`) y el flujo de aporte: compuerta de cuenta, modal «Revisión antes de firmar», redirección a la wallet y el KYC simulado del inversor en el primer aporte. El detalle sólo muestra campañas **publicadas** (misma definición que el marketplace de #414) y, por decisión del owner, **abrir el detalle exige cuenta** (la compuerta «Ingresá para ver esta campaña» del template).

Reutiliza el motor existente (persistencia de campaña, bóveda/despliegue de #410, wallet Freighter de #406, notificaciones de #382) y el motor de invocación de bóveda que ya usaba el recorrido guionado (`campaign-workspace.tsx`, que #438 retira). Agrega: un modelo de lectura de detalle, la foto/serie de ventas persistida, el flujo de aporte reubicado, el KYC del inversor y la acción «Retirar».

| Task | Rama | Estado del issue |
|---|---|---|
| #423 — implementar | `Vaqcrow#422_Feat_Show_campaign_detail_and_handle_contributions` | abierto; WU1–WU5 |
| #424 — probar | (misma rama de la Feature) | abierto |
| #425 — documentar | (misma rama de la Feature) | este documento |

La Feature #422 depende de #378, #406 y #414, y desbloquea a #426. El cierre lo decide el owner.

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el **2026-10-09** en este árbol de trabajo (rama de #422), con su salida real (§4). (b) **Bitácora** — una entrada fechada de [[odd/tasks/campaign-detail-and-contributions]]; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba PR-gated habla con Testnet, Horizon, RPC de Soroban, el LLM ni Supabase remoto. Las pruebas de API y de la web usan dobles y fixtures; sólo `pnpm run test:db` toca una base, y es el stack local.
- **Sin secretos.** Ningún email, contraseña, seed, clave privada, API key ni token aparece en este documento; las variables se nombran, nunca sus valores.
- **Sin claims de producción.** Todo corre sobre **Testnet** y sin valor económico; el KYC del inversor y las ventas son **simulados**; el revenue share es de demo. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado

Fuente: bitácora (WU1–WU5, 2026-10-08/09).

### 3.1 WU1 — Modelo de lectura y endpoint de detalle (`9c3a5b9`)

Contract `campaignDetailSchema` (estricto, portable, **sin PII**). Vista `public.marketplace_campaign_detail` (`security_invoker`, grants sólo `service_role`) con la **misma** regla de publicación de #414 (`campaign_deployment.state = 'confirmed'` **y** `campaign.state = 'open'`) y el lateral de imagen **idéntico** (`kind = 'photo'`). Endpoint `GET /marketplace/campaigns/:campaignId` **AUTHENTICATED** (la compuerta de cuenta), con `400` id no-UUID, `404` no publicada/desconocida y `503` saneado. Estado **derivado** `funding | settled | refunding`, alineado al vocabulario que ya usa la web; `raisedArs` nulo sin snapshot (nunca 0). Migración `20261008220000`.

### 3.2 WU2 — Vista `/campaigns/[id]` (`4967b1f`)

Ruta **pública** que monta la **compuerta** del template para anónimos (**sin hacer fetch**) y el detalle con sesión: header + breadcrumb + badges (riesgo texto+ícono, `SIMULADO`), imagen, «Sobre la PyME», «Destino de los fondos», «Evidencia de ventas», «Recomendación de IA» («Consultiva»), «Decisión humana», «Términos» y el aside (estado, fondeo, backers, cierre, avisos de riesgo y de retiro). Estados carga/error/404/compuerta mutuamente excluyentes. Capa de datos calcada de #414 (port → gateway HTTP con Bearer → factory → hook SWR).

### 3.3 WU2b — Evidencia de ventas persistida (`445fb9b`)

Tabla `public.business_sales_period` (PK `(business_id, period)`, RLS 0 policies, grants sólo `service_role`, mes faltante = `null` ⇔ `status='missing'`) sembrada con la **salida del mismo provider determinista** que ve la PyME: al crear la empresa (best-effort) y por un backfill idempotente `seed:sales-periods`. La vista de detalle se extendió con `sales_months`; la sección renderiza KPIs + gráfico (mes faltante = barra «Sin dato», nunca 0) + tabla de fuente, `SIMULADO`, con fallback honesto si no hay serie. Al registrar un período (`POST /businesses/:id/sales-periods`) la ruta **re-persiste** la serie para que el feed y el detalle nunca diverjan (corrección de un bloqueante de verificación). Migración `20261008230000`.

### 3.4 WU3 — Flujo de aporte (`c22f9f1`)

CTA «Aportar a la campaña» **sólo** con `status==="funding"` + rol **INVERSOR** + bóveda conocida. **Sin wallet** → `/portfolio`; **con wallet** → «Revisión antes de firmar» (contrato truncado, `Función contribute`, `Custodia`, mínimo «10 XLM de prueba»). Regla de aporte **pura** (mínimo 10 XLM, Testnet, vault id). Tras firmar: «Enviada · pendiente de confirmación» (sent ≠ confirmed); la confirmación aparece sólo con el poll del ledger; luego «Aportar de nuevo». Reusa el motor de invocación, el `TransactionReviewModal` y el saneo de errores; sin cambios de contrato (`min_contribution` no se agregó).

### 3.5 WU4 — KYC simulado del inversor (`8e45c5c`)

Tabla `public.investor_kyc` (PK `user_id` → `profile` cascade, RLS 0 policies, grants sólo `service_role`). `GET`/`POST /investor-kyc` **AUTHENTICATED** (dueño siempre del principal verificado; body/query ignorado); el `GET` de un registro ausente es `approved:false`, nunca error; el `POST` es idempotente (201 al crear, 200 en replay). En la web, un **interstitial one-shot** `SIMULADO` aparece **antes** del modal de revisión sólo si el inversor no está aprobado; al confirmar se aprueba y se abre la revisión; una vez aprobado no vuelve a pedirse. La verificación es **simulada y auto-aprobada** (sin paso de admin). Migración `20261008240000`.

### 3.6 WU5 — «Retirar» (`562ad6f`)

Control en el aside **sólo** con `status==="funding"` + rol INVERSOR + **aporte > 0** (un aporte desconocido/nulo **nunca** se toma como cero: el control queda oculto). Reusa `useCampaignVault.withdraw`, el `TransactionReviewModal` (Función `withdraw`) y `campaign-vault-errors`; sin wallet → `/portfolio`; `sent ≠ confirmed`. No toca `/funding`, la API ni los contratos.

### 3.7 Rutas y migraciones

| Método y ruta | Autorización | Resultado |
|---|---|---|
| `GET /marketplace/campaigns/:campaignId` | AUTHENTICATED | detalle de una campaña publicada |
| `GET`/`POST /investor-kyc` | AUTHENTICATED | KYC simulado del inversor (idempotente) |

Migraciones (todas probadas en local y **aplicadas al proyecto remoto** con autorización del owner, con el `version` alineado al repositorio): `20261008220000_create_marketplace_campaign_detail_view`, `20261008230000_create_business_sales_period`, `20261008240000_create_investor_kyc`.

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-09)

```sh
$ pnpm run verify                 # exit 0
$ pnpm run test:db                # 20 archivos / 668 tests, PASS
```

- **lint** sin errores (1 warning preexistente ajeno: `fetch-http-client.ts`).
- **typecheck** 8/8.
- **test** — `@vaqcrow/domain` 120 · `@vaqcrow/contracts` **572** (20 archivos) · `@vaqcrow/ai` 143 · `@vaqcrow/api` **2381** (110 archivos) · `@vaqcrow/web` **2066** (205 archivos).
- **build** 5/5.
- **boundaries** sin violaciones — **1053 módulos, 3448 dependencias**.
- **test:boundaries** — 10 archivos, **164 tests**.
- **test:db** — **20 archivos, 668 tests, PASS** (incluye `marketplace_campaign_detail.sql`, `business_sales_period` y `investor_kyc.sql`).

### 4.2 Verificación independiente por work unit (RDD off)

Tras cada writer delegado corrió un verificador read-only:

| WU | Resultado | Hallazgo |
|---|---|---|
| WU1 | sin bloqueantes | — |
| WU2 | sin bloqueantes | `vaultAddress` sin renderizar (se usa en el modal de WU3); docstring «no PII» ajustada por el `actor` |
| WU2b | **1 bloqueante** | divergencia feed/detalle tras registrar un período → corregido (re-persist en la ruta de ventas) |
| WU3 | sin bloqueantes | — |
| WU4 | sin bloqueantes | — |
| WU5 | sin bloqueantes | sin-wallet inalcanzable en producción (coincide con el aporte); aviso «Enviada…» persiste tras un fallo |

### 4.3 Cobertura

- **contracts**: `campaignDetail`, la evidencia de ventas y `investorKyc` (estrictos; mes faltante `null`; sin PII).
- **api**: detalle (publicación, `404`, estado derivado, conversión entera), ventas persistidas (RLS/grants, mes faltante, re-persist), KYC (idempotencia, dueño del principal, política AUTHENTICATED).
- **web**: capa de datos (códigos saneados, `imageSrc` absoluto, Bearer), la vista (compuerta, estados, secciones, «Sin dato»), aporte (mínimo, sin wallet, sent ≠ confirmed), KYC (interstitial one-shot), retiro (gate, reuso del motor, sent ≠ confirmed).

### 4.4 No re-ejecutado

- **Testnet / Horizon / RPC**: el aporte/retiro reales sobre Testnet quedan como **verificación operativa manual** (fuera del gate; requieren Freighter y red reales).
- **`test:integration`** contra Supabase remoto (fuera del gate).
- El **flake conocido**: `pnpm run verify` cayó una vez por un *timeout* de 5 s de `campaign-contribution.test.tsx` bajo la carga de turbo (archivo ajeno al cambio, pasa aislado); el retry pasó `exit 0`.

## 5. Límites y brechas

- **Copy owner-pending.** El template no diseña el KYC del inversor ni el control de retiro; sus textos (y los estados/mensajes no diseñados) son placeholders mínimos y honestos, **pendientes de aprobación/reemplazo por el owner**.
- **Datos no persistidos.** El tagline de la PyME, la cantidad de empleados y el «destino de los fondos» con porcentajes **no** se persisten; se renderizan como «Sin dato», nunca inventados. «Destino de los fondos» (usos) queda como «Sin dato».
- **Saldo insuficiente no detectable.** El adapter de saldo simula `0`, así que el modal no puede distinguir «saldo insuficiente»; se acepta el fallo genérico saneado (decisión D4).
- **Contrato del mínimo.** El aporte mínimo (10 XLM) se **muestra** y se valida en la vista; no se agregó `min_contribution` al contrato Soroban (decisión D3), así que el límite no es on-chain.
- **El CTA del marketplace** apuntaba a `/campaigns/<id>` de forma provisional; con esta Feature la ruta existe.
- **Sin paginación** en el detalle/listado (una sola grilla, D3 de #414).
- **`user_id` como PK** en `investor_kyc` y `business_sales_period` con owner: el guard de row-ownership R1-002 de las rutas PYME sigue su curso propio (no es de esta Feature).

## 6. Decisiones del owner

| # / fecha | Pregunta del issue | Resolución |
|---|---|---|
| D1 — 2026-10-08 | Estados «Meta alcanzada» / «Reembolso disponible» / cerrada-vencida. | **Derivar** de `campaign.state` + `deadline`, reusando el copy de `evidence-timeline` (`funding | settled | refunding`). |
| D2 — 2026-10-08 | Dónde aparece el KYC simulado del inversor. | **Interstitial one-shot** tras el primer «Aportar», antes del modal; auto-aprobado. |
| D3 — 2026-10-08 | Quién fija plazo y aporte mínimo. | El plazo se fija al **abrir la bóveda** (form de la PyME); el mínimo se **muestra** («10 XLM de prueba»), sin cambio de contrato. |
| D4 — 2026-10-08 | Errores del modal y «Retirar». | Reusar `TransactionReviewModal` + `campaign-vault-errors`; reusar `withdraw` gateado en `funding` + aporte ≠ 0. |
| Opción 1 — 2026-10-09 | Fuente de la «Evidencia de ventas» (nada persistido). | **Tabla persistida** `business_sales_period` sembrada desde el provider determinista + expuesta en el detalle. |

Ninguna pregunta abierta del issue quedó sin decidir antes de implementarse.

## 7. Mapeo de criterios de aceptación (issue #422, citados textualmente)

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The detail page reproduces every section, state and copy item above from real campaign data, behind sign-in." | ✅ **CUMPLIDO (con copy owner-pending).** La ruta reproduce las secciones del template con datos reales (persistidos) y una **compuerta de cuenta** para anónimos; el copy del KYC y del retiro, no diseñado por el template, queda **pendiente de aprobación del owner**. | §3.2–3.6; verificación independiente; suites |
| 2 | "Contributing without a wallet redirects to Mi portafolio; with wallet and funds the modal enforces the 10 XLM minimum and ends in \"Enviada · pendiente de confirmación\"." | ✅ **CUMPLIDO.** Sin wallet → `/portfolio`; con wallet el modal valida mínimo 10 XLM y el flujo termina en «Enviada · pendiente de confirmación». | Suite web; §3.4 |
| 3 | "A contribution is shown as confirmed only after ledger confirmation." | ✅ **CUMPLIDO.** «Enviada» se fija al firmar; la confirmación aparece sólo con el poll del ledger. | Suite web; §3.4 |
| 4 | "The investor's first contribution creates a simulated, auto-approved KYC record marked `SIMULADO`." | ✅ **CUMPLIDO.** `public.investor_kyc` se crea en el primer `POST /investor-kyc` (idempotente), `simulado=true`; el interstitial está rotulado `SIMULADO`. | §3.5; `test:db`; suite api/web |
| 5 | "Missing data renders as \"Sin dato\", never zero; no copy promises a return." | ✅ **CUMPLIDO.** `raisedArs`/`assessment`/`decision`/`riskBand`/mes faltante → «Sin dato», nunca 0; ningún texto promete retorno. | Suite web; §3.2–3.3 |
| 6 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Suites + `verify` (exit 0) + `test:db` (20/668); fallos saneados (`404`/`503`; web `unavailable`/`network`/`unauthenticated`); sin filtrar `message`/`details`/`hint` ni secretos. | §4.1, §4.3 |
| 7 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** D1–D4 y la fuente de la evidencia de ventas las decidió el owner (§6); ninguna se inventó. | §6 |
| 8 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin secretos, seeds ni PII; Testnet sin valor económico; KYC y ventas simulados; sin claims de producción. | Revisión de este documento |

## 8. Riesgos, contradicciones y limitaciones aceptadas

- **Verificación de UI sin navegador.** Los tests son de componente (jsdom), no E2E; el aporte/retiro reales sobre Testnet quedan como verificación operativa manual.
- **Consistencia feed ⇄ detalle** garantizada por la re-persistencia del provider en la ruta de ventas (WU2b); una falla de esa escritura es best-effort y podría dejar el detalle un mes atrás hasta el próximo registro o backfill.
- **Copy pendiente** (KYC/retiro) y **datos no persistidos** (tagline/empleados/usos) son las brechas de fidelidad declaradas.

## 9. Estado de entrega y próximos pasos

- **Nada de #422 está en `main`.** Todo vive en la rama de integración, apilada sobre #414; el merge sigue atado a la **Opción A** (junto con #438).
- **Camino a `main`:** #422 → #426/#434 → #438. Las migraciones de #422 quedaron **aplicadas al remoto** con autorización del owner.
- El cierre de la Feature lo decide el owner; esta sección sólo registra su decisión.
