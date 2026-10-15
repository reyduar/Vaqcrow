---
title: Real Testnet wallet balance
tags:
  - planning
  - evidence
  - wallet
  - stellar
date: 2026-10-15
status: delivered
---

# Feature #557 — Saldo real de Testnet en la tarjeta de la wallet

> [!info] Objetivo
> Que «Mi campaña» (`/company`) y «Mi portafolio» (`/portfolio`) muestren el saldo XLM **real** de la wallet conectada en Testnet, y que el saldo y el aviso de «Fondear tu wallet» reflejen la cuenta después de cargarla con Friendbot. Hallazgo del segundo test manual de punta a punta (Epic #555).

## Causa raíz

El saldo nunca se leía de la red. Los dos contenedores usaban por defecto `SimulatedWalletBalanceAdapter`, que devolvía siempre `"0.0000000"`: era un paso intermedio deliberado de #406/#407 (T1c) y la lectura real de Horizon había quedado como «unidad posterior» (`docs/planning/pyme-wallet-connection-evidence.md` §5.3). Como `fundingState` deriva «sin saldo» de ese valor, el aviso «Tu cuenta todavía no tiene XLM de Testnet» tampoco desaparecía aunque Friendbot hubiera fondeado la cuenta.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Sin variable `NEXT_PUBLIC_*` nueva: Horizon apunta a `https://horizon-testnet.stellar.org` por defecto, inyectable por constructor | Decisión asentada: los endpoints canónicos de Testnet son defaults, no variables obligatorias |
| D2 | HTTP plano con un `AxiosInstance` inyectable, no el SDK de Stellar | La regla `web-never-imports-server-stellar-sdk` deja el SDK fuera del bundle del navegador; axios es el idioma de los otros gateways de la web (`http-blog-gateway.ts`) |
| D3 | Un `404` de Horizon es saldo `0.0000000`, no un error | La cuenta nunca fondeada no existe en el ledger: es un cero real y mantiene el aviso de fondeo |
| D4 | El saldo se vuelve a leer al regresar a la pestaña (`visibilitychange` visible y `focus`), sin botón nuevo | Friendbot abre en otra pestaña (`target="_blank"`); el template no diseña un botón de refresco |
| D5 | Se elimina `SimulatedWalletBalanceAdapter` | Ningún código de producción lo usa; los tests usan su doble (`FakeWalletBalance`) |

## Cambios

**Web** (`c03912f`, `def81f4`)

- `apps/web/src/infrastructure/wallet/horizon-wallet-balance-adapter.ts` (nuevo): `GET /accounts/{id}` con el id codificado; toma la entrada `native` de `balances`; `404` → `0.0000000`; otro non-200 o cuerpo malformado → `unavailable`; fallo de transporte → `network`.
- `apps/web/src/state/use-refresh-on-return.ts` (nuevo): ejecuta el refresco al volver a la pestaña.
- `apps/web/src/presentation/components/pyme-onboarding/company-workspace.tsx` y `apps/web/src/presentation/components/portfolio/portfolio.tsx`: el adaptador de Horizon pasa a ser el default de producción y el saldo se refresca al volver.
- `apps/web/src/application/ports/wallet-balance-port.ts`: la documentación del puerto ya no dice que producción usa un adaptador determinista.
- Se eliminan `simulated-wallet-balance-adapter.ts` y su test.

**Docs alineados**

- `docs/planning/pyme-wallet-connection-evidence.md`: nota con fecha que remite a esta evidencia; el registro histórico de #406 queda intacto.

## Criterios de aceptación (verbatim del issue #557) → verificación

- **«A funded Testnet account shows its real balance on `/company` and `/portfolio`.»** → `horizon-wallet-balance-adapter.test.ts` («reads the account's native XLM balance from Horizon») y, por contenedor, «reads the linked account's balance from Horizon by default (#557)» en `company-workspace.test.tsx` y `portfolio.test.tsx`, que prueban que el default de producción es el adaptador de Horizon. Chequeo de solo lectura contra Horizon de Testnet (2026-10-15): la cuenta del hallazgo `GDPBT572…NWFCDR` respondió `200` con `[{"asset_type":"native","balance":"10000.0000000"}]`, la forma que el adaptador lee.
- **«An unfunded account shows `0` and the funding warning; after Friendbot, the balance updates and the warning clears without signing out.»** → «treats an account Horizon does not know (404, never funded) as an empty balance» y, por contenedor, «re-reads the balance when … returns to the tab after Friendbot (#557)»: primero `0,0000000 XLM` con el aviso, y después de `visibilitychange` `10.000,0000000 XLM` sin el aviso. Chequeo contra Horizon de Testnet: una clave aleatoria nunca fondeada respondió `404`.
- **«A Horizon error renders an unavailable state, not `0.0000000`.»** → «reports a Horizon error status as unavailable, never as a zero balance», «reports a malformed success body as unavailable» y «reports a transport failure as network»; con un error, la tarjeta muestra «—» (`formatBalanceXlm(null)`).
- **«`pnpm run verify` passes with no network dependency.»** → todos los tests inyectan un doble o reemplazan el módulo del adaptador con `vi.mock`; `pnpm run verify` sale con exit 0.
- **«Docs that describe the balance as simulated are updated.»** → la documentación del puerto y la nota en `pyme-wallet-connection-evidence.md`.

## Verificación

- RED observado antes de implementar: el test del adaptador falló porque el módulo no existía, y los cuatro tests de los contenedores fallaron al no encontrar `777,0000000 XLM` ni `10.000,0000000 XLM` mientras seguía activo el adaptador simulado.
- `pnpm run verify` (corrido en el árbol de trabajo, 2026-10-15) → **exit 0**: web **252 archivos / 2495 tests**, API **3179 tests**, IA 160 tests, raíz 185 tests, `✔ no dependency violations found (1396 modules, 4673 dependencies cruised)`.
- CORS: Horizon de Testnet responde `Access-Control-Allow-Origin` con el origen que recibe, así que la lectura desde el navegador no se bloquea; la web no define una Content-Security-Policy que la impida.
- Seguridad (OWASP Top 10:2025; LLM 2026 no aplica porque no toca IA): **sin hallazgos**. A05: el id va codificado en la ruta. A08: la respuesta de Horizon se valida (número finito) antes de usarla, y un error se ve como «—», nunca como cero. A10: cada fallo termina en un código tipado. Sin dependencias nuevas; el host es fijo y no hay URL provista por el usuario.

## Límites y notas

- El PR **no está mergeado** al escribir esta evidencia: los resultados de arriba son comandos corridos en el árbol de trabajo, no un estado de `main`.
- No se recorrió todavía el flujo manual en la web desplegada (Freighter nueva → Friendbot → volver a la pestaña); queda para la re-ejecución del Epic #555.
- Con Horizon caído, la tarjeta muestra «—», pero la guía de fondos sigue mostrando el aviso de «sin saldo»: `fundingState` trata un saldo desconocido como no fondeado (comportamiento previo, fijado por `portfolio-wallet-funding.regression.test.tsx`). Es un advisory, no un fallo de esta Feature.
- Al volver a la pestaña pueden dispararse `visibilitychange` y `focus` juntos, lo que hace dos lecturas idénticas: es inofensivo.
