# Bitácora — Feature #426: Portafolio del inversor (Mi portafolio)

Rama: `Vaqcrow#426_Feat_Deliver_the_investor_portfolio`, creada desde la punta de #422.

## Objetivo

Entregar la vista del inversor **«Mi portafolio»** (template `Vaqcrow Portafolio.dc.html`, modo inversor): tarjeta de wallet no custodial, totales, «Mis aportes en PyMEs» con estados y orden, «Aportes por sector» y «Distribuciones». Sólo con sesión de rol `INVERSOR`.

## Problema y por qué

`/portfolio` es hoy un esqueleto (`PageHeading`). El inversor que aportó no ve sus posiciones, sus distribuciones recibidas ni puede retirar/reembolsar desde un solo lugar. La Feature #426 cierra el lado inversor y desbloquea #430 (Informes).

## Decisiones del owner (2026-10-08)

| # | Pregunta del issue | Resolución |
|---|---|---|
| D1 | Acción «Reembolsar» y estado «Reembolso disponible». | **Acción en la tarjeta de posición**, reusando el motor `refund` y la regla ya existente de `campaign-workspace` (bóveda en `refunding`, o `funding` vencido bajo la meta). |
| D2 | Confirmación del retiro / portafolio vacío / sin wallet o desconectada. | Reusar `TransactionReviewModal` para el retiro; **estado vacío propio + CTA «Explorar PyMEs»**; mostrar la **`WalletCard` en modo conectar** cuando no hay wallet. |
| D3 | Errores de Freighter y fondos de Testnet. | Reusar **tal cual** `WALLET_KIND_COPY` + `WALLET_CONNECTION_COPY` (no-instalada, rechazada, red equivocada) y un texto corto con **friendbot de Testnet + Stellar Laboratory**. |
| D4 | Historial por transacción y destino del explorador. | Por tarjeta de campaña con el **último estado de la tx** (`TransactionStatusList`); el historial completo por-transacción se difiere a **#430**. «Explorador» de la wallet → `stellar.expert/explorer/testnet/account/<clave>`; «Ver campaña» → la ruta de #422. |

## Alcance autorizado

- **Endpoints nuevos de lectura del portafolio** (hoy no existen): los aportes de un inversor entre campañas + totales, y sus distribuciones recibidas. Contrato en `packages/contracts`, port + adaptador (vista SQL `service_role`) + caso de uso + ruta **AUTHENTICATED/INVERSOR** + política.
- **Vista `/portfolio`** con las secciones del template, estados (vacío, sin wallet, carga/error) y las acciones de retiro/reembolso.
- Tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- Estado **derivado de datos confirmados por el ledger**, nunca de supuestos del cliente.
- Nunca prometer retorno; `SIMULADO`/`DEMO`/`TESTNET`; riesgo texto + ícono; «Sin dato / faltante» nunca es cero.
- `packages/contracts` portable; `apps/web` consume sólo contratos; `presentation/` no importa contratos salvo type-only; `application/` (web) sin React.
- No custodial: Vaqcrow nunca firma por el inversor; el retiro/reembolso los firma Freighter.
- No inventar copy que el template no diseñe; lo no diseñado lo decide el owner (ya decidido, D1–D4).

## Tareas

- [ ] **WU1 — Modelo de lectura del portafolio (backend).** Contratos + vista SQL + port/adaptador + casos de uso + rutas AUTHENTICATED/INVERSOR + política. Aportes del inversor entre campañas + totales; distribuciones recibidas. Sin `apps/web`.
- [ ] **WU2 — Vista `/portfolio` (web).** Tarjeta de wallet, totales, posiciones con estados y orden, barras por sector, y la lista de distribuciones.
- [ ] **WU3 — Retiro y reembolso.** «Retirar mi aporte» (bóveda abierta) y «Reembolsar» (D1), reusando el motor de bóveda.
- [ ] **WU4 — Estados y guía.** Vacío, sin wallet/desconectada, errores de Freighter y fondos de Testnet (D2/D3).
- [ ] **WU5 — Verificación y evidencia.** Suites, `verify`, y `docs/planning/investor-portfolio-evidence.md`.

Forecast: Feature grande. Entrega **feature-branch-chain**: cada work unit commitea en esta rama.

## Checks aplicables

- `pnpm --filter @vaqcrow/contracts test`, `pnpm --filter @vaqcrow/api test`, `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run boundaries`, `pnpm run test:boundaries`
- `pnpm run test:db` si el work unit toca el esquema o una vista.
- `pnpm run verify` al cierre de cada work unit.

## Progreso

*(Se registra a medida que se completa cada work unit.)*
