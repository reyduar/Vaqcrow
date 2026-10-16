---
title: XLM two decimals and ARS
tags:
  - planning
  - evidence
  - wallet
  - format
date: 2026-10-16
status: delivered
---

# Feature #572 — XLM con 2 decimales y equivalente ARS simulado

> [!info] Objetivo
> Que todo monto en XLM se lea con 2 decimales y que «Saldo disponible», en `/portfolio` y `/company`, muestre su equivalente aproximado en ARS a la cotización vigente, marcado como simulado. Viene del test manual del inversor (Epic #568). Bitácora: [[odd/tasks/xlm-two-decimals-and-ars|xlm-two-decimals-and-ars]].

## Hallazgo del owner (verbatim)

> Donde exista valores XML coomo en las paginas de Mi portafolio/Mi Campaña el Saldo disponible en XML muestre el valor con 2 decimales despues de la coma y ademas me gustaria ver en un label el equivalente de XML en Pesos Argentinos.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | 2 decimales en **todos** los montos en XLM, con un solo formateador (`application/format/xlm.ts`) (owner, opción «a») | Que en una misma pantalla no convivan 2 y 7 decimales. Se eliminan cuatro formateadores duplicados |
| D2 | La revisión antes de firmar muestra el monto **exacto** | La pantalla nunca puede decir otro número que el de la transacción que se firma en Freighter |
| D3 | El equivalente usa la cotización **vigente** con un endpoint nuevo, `GET /rates/current` (owner, opción «a») | Un saldo de wallet no pertenece a ninguna campaña, así que la cotización congelada de cada campaña no sirve |
| D4 | El endpoint expone solo `version`, `effectiveAt`, `usdToArs` y `stroopsPerUsd` | El autor y la fuente son metadatos de admin |
| D5 | Label «≈ ARS …» con un badge `SIMULADO` pegado | `demo-ui.md` §2: «Badge `SIMULADO` contiguo al origen sintético». La conversión ARS↔activo es simulada |
| D6 | La conversión se hace con enteros (bigint) y se trunca a ARS enteros; sin cotización no hay label | El dinero nunca pasa a `number`, y nunca se muestra un valor inventado |

## Cambios

- **Formateador** (`57913e6`):
  - `apps/web/src/application/format/xlm.ts`. Los `format.ts` de `portfolio`, `company` y `reports` lo reexportan, y `wallet-card.tsx` lo usa directo.
  - Por arrastre, la evidencia de admin también pasa a 2 decimales.
  - Se recalcularon 51 montos esperados en 20 archivos de test.
- **API** (`09456fb`):
  - `GET /rates/current` en `rate-table.route.ts`, con política `AUTHENTICATED`.
  - Registrada en la matriz `authorization.test.ts` y en `openapi/route-registry.ts`; se regeneró `apps/api/openapi.json`.
- **Web** (`c394375`):
  - Conversión y tipos: `application/ports/rate-port.ts`, `application/format/ars.ts`.
  - Lectura: `infrastructure/rates/http-rate-gateway.ts` y `create-rate-port.ts`; `state/use-current-rate.ts`.
  - Pantalla: `WalletCard` recibe `balanceArs`; `Portfolio` y `CompanyWorkspace` aceptan un `rates` inyectable.

## Criterios de aceptación (verbatim del issue #572) → verificación

- **«`formatBalanceXlm(10000.1234567)` and the other screens show `10.000,12 XLM`.»**
  - `xlm.test.ts`: «renders a canonical 7-decimal XLM with 2 decimals and the unit» da `10.000,12 XLM`.
  - `wallet-card.test.tsx` da `4.120,50 XLM`.
  - Los contenedores muestran `10.000,00 XLM` y `777,00 XLM`.
- **«The signing review shows the exact amount.»**
  - `campaign-withdraw.test.tsx`: «shows the exact amount to sign, never the 2-decimal display rounding (#572)» muestra `9998.3398722`, nunca `9.998,34`.
  - El modal de aporte muestra el monto tal como se tipeó.
- **««Saldo disponible» shows «≈ $ … ARS (conversión simulada)» with the current rate, and nothing invented when the rate is missing.»**
  - La forma quedó como «≈ ARS 1.400» con un badge `SIMULADO` pegado, porque §2 de `demo-ui.md` pide el badge (D5).
  - Tests: `wallet-card.test.tsx` (con y sin el valor), `portfolio.test.tsx` y `company-workspace.test.tsx` («shows the balance's simulated ARS equivalent at the current rate (#572)»), y «hides the ARS equivalent when no rate is in effect».
- **«The new endpoint refuses anonymous callers and returns only the rate.»** → `rate-table.route.test.ts`: 401 sin token, sin llegar al repositorio; 200 solo con los cuatro campos públicos, para PYME e INVERSOR; 404 `not_found`; 503 `unavailable`.
- **«`pnpm run verify` passes.»**
  - `pnpm run verify` (árbol de trabajo, 2026-10-16) → **exit 0**: web 2521, API 3220, contracts 759, `✔ no dependency violations found (1416 modules, 4725 dependencies cruised)`.
  - Playwright `test:e2e` → 41/41.

## Verificación

- **RED observado antes de cada cambio:**
  - Los módulos nuevos no existían (`xlm`, `ars`, `http-rate-gateway`).
  - Ruta: 5/5 en rojo. Además, los gates de la matriz de autorización y de OpenAPI fallaron hasta registrar la ruta.
  - El label de la tarjeta y los dos contenedores fallaron.
  - Los tests de «sin label» pasaban desde antes, porque describen el comportamiento previo.
- **Seguridad** (OWASP Top 10:2025; el LLM Top 10 2026 no aplica porque no toca IA): **sin hallazgos**.
  - A01: la lectura es `AUTHENTICATED` y no expone metadatos de admin.
  - A05/A08: el cuerpo se valida (enteros no negativos) antes de convertirlo a `BigInt`.
  - A10: ningún fallo se muestra como un valor.

## Límites y notas

- La cotización es la tabla simulada que carga el admin, no una cotización de mercado. Por eso el label dice «≈» y lleva `SIMULADO`.
- Si no hay una cotización vigente en el remoto, el label no aparece. Para verlo en la web desplegada, el admin tiene que haber cargado una tasa.
- Lint: 0 errores y 7 warnings previos en archivos ajenos (`apps/web/src/verifier-wu2b/…`).
- El PR **no está mergeado** al escribir esta evidencia: los resultados de arriba son del árbol de trabajo. Falta ver el label en `/portfolio` y `/company` desplegados.
