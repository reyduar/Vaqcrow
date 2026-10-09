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

- [ ] **WU1 — Modelo de lectura y endpoint de detalle.** Contract `campaignDetail` + port + adaptador (vista SQL `service_role`) + caso de uso + ruta AUTHENTICATED + política, con el **estado derivado** y los campos persistidos; «Sin dato» para los ausentes. Sin `apps/web`.
- [ ] **WU2 — Vista `/campaigns/[id]` (web).** Compuerta de cuenta, secciones del template, estados (carga/error/404/no-sesión) y variantes por estado de campaña.
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

*(Se registra a medida que se completa cada work unit.)*
