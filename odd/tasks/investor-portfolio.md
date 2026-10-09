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
- [x] **WU2 — Vista `/portfolio` (web).** Tarjeta de wallet, totales, posiciones con estados y orden, barras por sector, y la lista de distribuciones.
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
- **Migración remota.** `20261009120000_create_investor_portfolio_views.sql` probada en local y luego, con **autorización explícita del owner**, **aplicada al proyecto remoto** (2026-10-09) vía MCP, con el `version` del historial **alineado al repositorio** (`20261009120000`). Verificado en el remoto: ambas vistas con `security_invoker=true` (**17** y **8** columnas), `SELECT` sólo `service_role` y **cero** grants a `anon`/`authenticated`; advisors sin clase nueva.
- **Límite explícito.** Sin `apps/web` (la vista `/portfolio` es WU2).

- **Work-unit commit.** `83b7fc6 feat(api): add the investor portfolio read model (#426)`.

### WU2 — Vista `/portfolio` (web) (commit `d02a8f5`)

Ruta: **delegado** (un writer; port + gateway + factory + null object + hook SWR + helpers puros + componentes presentacionales + vista + container + página, 2+ archivos no triviales). Sin backend.

- **Diseño.** Vista **read-only**. `PortfolioPort.get()` → `GET /portfolio` con `Authorization: Bearer`; errores saneados (`unauthenticated` en 401/403, `unavailable` en otro no-200 o cuerpo inválido, `network` en fallo de transporte); `imageUrl` (relativa al API) → `imageSrc` absoluta (relativa nula queda nula, irresoluble → nula). Hook SWR `["portfolio"]` (`shouldRetryOnError:false`, `revalidateOnFocus:false`). Helpers puros: `status` (etiquetas que espejan `campaign-detail-view.tsx:69-71`: `funding`/`settled`/`refunding` → «Fondeo abierto»/«Meta alcanzada»/«Reembolso disponible»; sólo el cuerpo de `funding` con la `closeDate` real en `dd/mm/aaaa`), `sort` (`recent` = orden del API; `state` = rank estable `funding→settled→refunding`, empates conservan el orden del API), `sectors` (**BigInt** sobre XLM canónico, porcentaje entero, descendente, total cero → `[]`), `format` (es-AR, 7 decimales), `distribution-state`. Componentes: totales (`totalDistributionsXlm` nulo → «Sin dato», nunca `0`), tarjeta de posición (imagen, nombre, meta, `SIMULADO`, «Mi aporte», «% de la meta» + barra, bloque de estado, «Ver campaña»), barras de sector, lista de distribuciones. La wallet card se monta **sólo con clave** (la tarjeta lee `WalletConnectionPort` + `WalletBalancePort`, espejando `company-workspace`); la ruta ya está gateada `INVERSOR` por `(app)/layout.tsx` + `RouteGate`.
- **RED/GREEN observado.** RED: módulos puros e infra ausentes antes de implementar. GREEN: contracts build OK; web enfocado **56/56** (12 archivos: puros 16, infra 13, estado 5, presentación 22); `tsc --noEmit` limpio; `lint` sin errores (1 warning preexistente ajeno); `boundaries` sin violaciones (1098 módulos / 3582 deps); `test:boundaries` 164/164. Excepción honesta: la capa presentacional se escribió contra el markup del template y sus tests son GREEN, sin RED capturado.
- **Verificación independiente (RDD off).** Un verifier read-only: **8/8 PASS**, sin bloqueantes; re-corrió las suites anteriores.
- **Advisories / owner-pending.** (a) los cuerpos de `settled`/`refunding` del template dependen de un número de ledger que **no existe** en los datos → se renderiza sólo la etiqueta (nada fabricado), copy owner-pending; (b) «Recientes» = orden del API porque el read model no trae fecha de aporte (un `contributedAt` real es candidato para #430); (c) el copy de distribución `failed` reusa «Fallida» de la evidencia, owner-pending; (d) el `Desconectar` de la wallet card en WU2 es un despido local — el desconectado real (persistido) y los estados vacío/sin-wallet/errores Freighter/fondos Testnet son WU4.
- **Límite explícito.** Sin retiro/reembolso (WU3) ni estados de vacío/sin-wallet/errores/carga de fondos (WU4).

- **Work-unit commit.** `d02a8f5 feat(web): add the investor portfolio view (#426)`.
