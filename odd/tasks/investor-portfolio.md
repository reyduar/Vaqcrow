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

- [x] **WU1 — Modelo de lectura del portafolio (backend).** Contratos + vista SQL + port/adaptador + casos de uso + rutas AUTHENTICATED/INVERSOR + política. Aportes del inversor entre campañas + totales; distribuciones recibidas. Sin `apps/web`.
- [ ] **WU2 — Vista `/portfolio` (web).** Tarjeta de wallet, totales, posiciones con estados y orden, barras por sector, y la lista de distribuciones.
- [ ] **WU3 — Retiro y reembolso.** «Retirar mi aporte» (bóveda abierta) y «Reembolsar» (D1), reusando el motor de bóveda.
- [ ] **WU4 — Estados y guía.** Vacío, sin wallet/desconectada, errores de Freighter y fondos de Testnet (D2/D3). **Incluye habilitar que un `INVERSOR` persista su clave Stellar**: hoy `POST /profile/wallet` es `only("PYME")`, así que el portafolio queda vacío para un inversor real hasta que exista ese camino (hallazgo confirmado en WU1).
- [ ] **WU5 — Verificación y evidencia.** Suites, `verify`, y `docs/planning/investor-portfolio-evidence.md`.

Forecast: Feature grande. Entrega **feature-branch-chain**: cada work unit commitea en esta rama.

## Checks aplicables

- `pnpm --filter @vaqcrow/contracts test`, `pnpm --filter @vaqcrow/api test`, `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run boundaries`, `pnpm run test:boundaries`
- `pnpm run test:db` si el work unit toca el esquema o una vista.
- `pnpm run verify` al cierre de cada work unit.

## Progreso

### WU1 — Modelo de lectura del portafolio (commit `83b7fc6`)

Ruta: **delegado** (un writer; contrato + port + caso de uso + adaptador + ruta + política + 2 vistas SQL + pgTAP, 2+ archivos no triviales). Sin `apps/web`.

- **Diseño.** Endpoint `GET /portfolio` (**AUTHENTICATED → only("INVERSOR")**) que devuelve los aportes del inversor entre campañas, sus distribuciones y los totales. Contrato estricto y portable (`portfolio.ts`; XLM como string de 7 decimales; `xlmAmountSchema`). Dos vistas nuevas `security_invoker` sólo `service_role`: `investor_portfolio_position` (incluye campañas **liquidadas/reembolsables**: **no** filtra `state='open'`) e `investor_portfolio_distribution`. La **identidad se resuelve server-side** desde el principal verificado (clave Stellar del perfil); un `?investor=` de query se ignora (hay test). `totalDistributionsXlm` suma **sólo** distribuciones `confirmed` y es `null` (nunca `0.0000000`) si no hay ninguna; `raisedArs` nulo sin snapshot. Fallos saneados (`503`). Migración `20261009120000`.
- **RED/GREEN observado.** RED: contrato ausente; caso de uso ausente. GREEN: contracts **584** (21 archivos), api **2408** (113), `test:db` **21 archivos / 716 tests PASS** (`portfolio.sql` 48 aserciones); `typecheck` 8/8; `lint` sin errores (1 warning preexistente ajeno); `boundaries` sin violaciones (1062 módulos, 3481 dependencias); `test:boundaries` 164.
- **Verificación independiente (RDD off).** Un verifier read-only: **sin bloqueantes**. Confirmó identidad sólo del principal (`?investor=` ignorado), scoping por cuenta, vistas sólo `service_role`, incluir posiciones liquidadas, total confirmado-only con `null`, errores saneados y límites.
- **Hallazgo material (gestionado en WU4).** El único escritor de `public.profile.stellar_public_key` es `POST /profile/wallet`, hoy `only("PYME")`. Por eso un `INVERSOR` real obtiene un portafolio **vacío** hasta que exista un camino de conexión de wallet del inversor → se agrega a WU4.
- **Migración remota.** `20261009120000_create_investor_portfolio_views.sql` aplicada al **stack local**; la aplicación al **remoto queda pendiente de autorización del owner**.
- **Límite explícito.** Sin `apps/web` (la vista `/portfolio` es WU2).

- **Work-unit commit.** `83b7fc6 feat(api): add the investor portfolio read model (#426)`.
