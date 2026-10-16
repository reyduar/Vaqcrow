# Feature #572 — XLM con 2 decimales y equivalente ARS simulado

Objetivo: que todo monto en XLM se lea con 2 decimales y que «Saldo disponible» muestre su equivalente aproximado en ARS a la cotización vigente, marcado como simulado. Rama `Vaqcrow#572_Feat_Show_XLM_amounts_with_2_decimals_and_a_simulated_ARS_equivalent`. Un PR (`ask-on-risk`). Runner: vitest (web/API).

## Specs

- **S1** — Hallazgo del owner (2026-10-16), verbatim: «Donde exista valores XML coomo en las paginas de Mi portafolio/Mi Campaña el Saldo disponible en XML muestre el valor con 2 decimales despues de la coma y ademas me gustaria ver en un label el equivalente de XML en Pesos Argentinos.»
- **S2** — Decisión del owner (2026-10-16), opción «a», o sea **todos** los montos en XLM: 2 decimales en `es-AR` con un **solo** formateador en `apps/web/src/application/format/`, que reemplaza los duplicados (`wallet-card.tsx`, `application/{portfolio,company,reports}/format.ts`). **Excepción:** la revisión antes de firmar en Freighter muestra el monto exacto. Esa revisión es `formatStroopsAsXlm` en `campaign-withdraw.tsx` y `company-sign-distribution.tsx`, y el monto tipeado en el modal de `campaign-contribution.tsx`.
- **S3** — Decisión del owner (2026-10-16), opción «a», o sea la cotización **vigente**: un endpoint de solo lectura `GET /rates/current`, `AUTHENTICATED`, que expone solo `version`, `effectiveAt`, `usdToArs` y `stroopsPerUsd` (nunca `authorUserId` ni `source`). Sin cotización responde `404 { code: "not_found" }`; si falla el repositorio, `503 { code: "unavailable" }`.
- **S4** — Debajo de «Saldo disponible», en `/portfolio` y `/company`, va «≈ ARS …» con un badge `SIMULADO` pegado. Es una regla de confianza de `demo-ui.md` §2: «Badge `SIMULADO` contiguo al origen sintético». La conversión se hace con enteros (bigint): `stroops × usd_to_ars / (stroops_per_usd × 1.000.000)`. Si no hay cotización o no hay saldo, no se muestra el label: nunca un valor inventado.
- **S5** — `pnpm run verify` pasa. La copy pasa `public-copy-prohibited-terms.test.ts`. Evidencia en `docs/planning/xlm-two-decimals-and-ars-evidence.md`.

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|---|---|---|---|---|
| T1 | S2 | inline | hecho | ver L3 |
| T2 | S3 | inline | hecho | ver L4 |
| T3 | S4 | inline | hecho | ver L5 |
| T4 | S5 | inline | hecho (falta verlo desplegado) | ver L6 |

Ruta inline: no se dispara ningún writer, porque las unidades se encadenan.

## Log

- **L1** (2026-10-16) — Pedido: el hallazgo S1. El owner eligió «a» (todos los montos), «a» (cotización vigente) y respondió «merged, seguí con #572».
- **L2** (2026-10-16) — Mapa:
  - `formatStroopsAsXlm` (sin ceros finales) se usa en las firmas y en `admin/evidence.ts`. Los formateadores de 7 decimales están en `wallet-card.tsx` y en `{portfolio,company,reports}/format.ts`.
  - `GET /admin/rates/current` es solo para `ADMIN` (`route-policy.ts:122`).
  - La variante `simulado` del `Badge` usa texto oscuro y no contrasta sobre el violeta de la tarjeta. Se usa una pastilla blanca punteada, con el mismo estilo que el chip «CONGELADA» de la misma tarjeta.
  - La tarjeta ya dice «Activo de prueba sin valor económico». El equivalente ARS es la conversión simulada que `demo-ui.md` §2 ya reconoce como dato simulado.
- **L3** (2026-10-16) — T1: `apps/web/src/application/format/xlm.ts` (`formatXlmValue`, `formatXlmAmount`; `es-AR`, 2 decimales).
  - `{portfolio,company,reports}/format.ts` reexportan del módulo único y conservan sus nombres, así que no cambian los puntos de uso. `company` lo importa porque `formatApproxXlmAmount` lo usa.
  - `wallet-card.tsx` usa el módulo único: si no hay saldo o no es un número, muestra «—».
  - Por arrastre, la evidencia de admin (`admin/evidence.ts`) también pasa a 2 decimales.
  - RED: el módulo no existía. GREEN 5/5.
  - Los 51 montos de 7 decimales que esperaban 20 archivos de test se recalcularon con redondeo half-up y se renombraron 6 títulos.
  - Se corrigió `not.toContain("0,0000000")`: como `"0,00"` también aparece dentro de `"1.000,00"`, pasó a `not.toMatch(/(^|[^\d.])0,00 XLM/)`.
  - Comportamiento previo: «shows the exact amount to sign…» en `campaign-withdraw.test.tsx`, con `9998.3398722` en el modal de firma.
  - Web 2506/2506, lint limpio.
- **L4** (2026-10-16) — T2: `GET /rates/current` en `rate-table.route.ts`, que reutiliza `RateTableRepositoryPort.findCurrent`.
  - Responde `{ rate: { version, effectiveAt, usdToArs, stroopsPerUsd } }`, sin `authorUserId` ni `source`.
  - `not_found` → 404; cualquier otro error → 503 `unavailable`, saneado.
  - Política `AUTHENTICATED`. Se registró en la matriz `authorization.test.ts` y en `openapi/route-registry.ts` (tag `Wallet`), y se regeneró `apps/api/openapi.json` con 60 paths.
  - RED: 5/5 en rojo. Además, los gates de la matriz de autorización y de OpenAPI fallaron hasta registrar la ruta.
  - El test del anónimo usa `buildApp` sin auth, porque `buildAppAs` agrega un bearer a todo pedido.
  - GREEN: ruta 7/7, API 3220/3220, lint y typecheck limpios.
  - Las menciones de `/admin/rates/current` en `docs/` están en evidencias históricas, que no se tocan.
  - OWASP Top 10:2025, A01: solo lectura, autenticada, y sin metadatos de admin. **Sin hallazgos.**
- **L5** (2026-10-16) — T3, en la web:
  - **Conversión:** `application/ports/rate-port.ts` (`XlmArsRate` con bigint) y `application/format/ars.ts` (`xlmToArs` con enteros y truncado; `formatApproxArs` → «≈ ARS 4.666.724»). Da `null` si falta la cotización, el saldo es `null`, el formato es inválido (`1e3`, `-1`, más de 7 decimales) o `stroopsPerUsd` es `0`.
  - **Gateway:** `infrastructure/rates/http-rate-gateway.ts` sobre `GET /rates/current`, con el Bearer del principal. 404 → `not_found`; 401/403 → `unauthenticated`; otro status → `unavailable`; un cuerpo mal formado → `unavailable`; un fallo de transporte → `network`. `create-rate-port.ts` usa el null object si no hay base URL.
  - **Hook:** `state/use-current-rate.ts` lee la cotización una vez por montaje; si algo falla, devuelve `null`.
  - **Tarjeta:** `WalletCard` recibe `balanceArs` y muestra «≈ ARS …» con la pastilla `SIMULADO` pegada, en blanco punteado. Si el valor es `null`, no muestra nada.
  - **Contenedores:** `Portfolio` (le pasa `balanceArs` a `PortfolioWallet`) y `CompanyWorkspace`; los dos aceptan un `rates` inyectable y por defecto usan el puerto del browser, como sus otros puertos.
  - **RED:** los 4 archivos nuevos no existían; el label de `WalletCard` y los dos contenedores fallaron. Los tests de «sin label» pasaban, porque describen el comportamiento previo.
  - En `portfolio.test` el assert de `SIMULADO` se acotó al contenedor del label, porque la página tiene otros badges `SIMULADO`.
  - **GREEN:** web 2521/2521; typecheck limpio; lint con 0 errores y 7 warnings, todos previos y en archivos ajenos (`verifier-wu2b/…`).
  - **OWASP Top 10:2025:** sin hallazgos. A01: la lectura va con el token del principal. A05/A08: el cuerpo se valida antes de convertirlo a `BigInt`. A10: un fallo nunca se muestra como un valor.
- **L6** (2026-10-16) — T4: `pnpm run verify` → exit 0 (web 2521, API 3220, `no dependency violations`). Playwright `test:e2e` → 41/41. Evidencia escrita en `docs/planning/xlm-two-decimals-and-ars-evidence.md`. Risk: none. Es el cambio de formato pedido más un endpoint nuevo de solo lectura; ningún contrato existente se rompe, así que no hace falta un verificador independiente. **Pendiente:** el PR y ver el label en lo desplegado, que necesita una cotización vigente en el remoto.
