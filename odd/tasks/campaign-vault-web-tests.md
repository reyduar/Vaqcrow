# Bitácora: tests del recorrido de la bóveda en la web

## Objetivo

Cubrir el recorrido de campaña en la web con tests de componentes para los tres estados y un recorrido determinístico en navegador, sin Testnet. Task [#248](https://github.com/reyduar/Vaqcrow/issues/248) de la Feature [#237](https://github.com/reyduar/Vaqcrow/issues/237).

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | Dos recorridos de Playwright: uno gateado por PR contra el doble local de la API con Freighter emulado, y uno opt-in (`test:e2e:live`, fuera de CI y de `verify`) contra la API del perfil docker y la red local | `DEMO.md` §11: las pruebas de PR no dependen de red; la comprobación contra cadena real corre aparte, como `test:integration` |
| D2 | Freighter se emula con un `addInitScript` que responde el protocolo de `@stellar/freighter-api` v6 por `window.postMessage` (respuesta con `messagedId`, errata de la librería) | Sin ganchos de test en código de producción |
| D3 | `sme_account_unavailable` (422) pasa a ser un tipo de error propio con copy de estado bloqueado | #248 exige que se vea como bloqueo previo a la apertura, no como pago fallido; hoy todo 422 se muestra como rechazo genérico |
| D4 | En el recorrido live, la firma la hace el proceso de Playwright (fuera de `apps/*/src`) con una identidad de prueba de la red local, expuesta a la página por `exposeFunction` | La web no puede importar `@stellar/stellar-sdk`; la clave nunca entra a la página ni al repositorio |

## Configuración

- TDD: estricto (sesión); runner `pnpm --filter @vaqcrow/web exec vitest run` y Playwright.
- Rama: `Vaqcrow#248_Task_Test_the_campaign_vault_journey_in_the_web`, desde `main`.

## Tareas

- [x] **T1 — Estado bloqueado por cuenta de la PyME.** Tipo de error `sme_account_unavailable`, copy, render en el workspace y tests (RED primero). Ruta: writer delegado.
- [x] **T2 — Huecos de componente/hook.** Contribución revertida (`failed`), Freighter ausente vía workspace, transición en vivo `funding` → `settled` que retira el aporte. Ruta: writer delegado (junto con T1).
- [x] **T3 — Recorrido Playwright gateado.** Emulación de Freighter, rutas de campaña en el doble de la API (determinístico: sin `Date.now`/`Math.random`), spec del camino crítico y errores. Ruta: writer delegado.
- [ ] **T4 — Recorrido live opt-in.** `e2e-live/` + config propia + `test:e2e:live` contra la API docker y Quickstart; ejecutado por el padre. Ruta: writer delegado + verificación inline.

## Verificación

### T1 + T2
- T1 (RED → GREEN): 4 tests nuevos fallaban contra el mapeo genérico (tipo, mensaje, hook `openCampaign`, alerta del componente). Se agregó el tipo `sme_account_unavailable` y su copy: "No se pudo crear ni verificar la cuenta de la PyME en Stellar: la bóveda no se abrió, no se desplegó nada y no se movieron fondos. Podés reintentar." El resto de los 422 siguen como `refused`.
- T2: contribución revertida (`failed` → alerta, sin reclamar éxito, aporte disponible), Freighter ausente vía workspace y transición en vivo `funding` → `settled` (sin remontar la región) quedaron en verde al primer intento: el comportamiento ya era correcto; no se fabricó un RED.
- `vitest run src/application/campaign src/state src/presentation/components/campaign-workspace.test.tsx` — 8 archivos, 74 tests (re-ejecutado por el padre). Lint y typecheck de web sin errores; boundaries 360 módulos, 0 violaciones.

### T3
- `apps/web/e2e/support/freighter-emulator.ts`: un único listener por test (`addInitScript`) que responde el protocolo de `@stellar/freighter-api` 6.0.1 (verificado en el bundle: `FREIGHTER_EXTERNAL_MSG_REQUEST`/`_RESPONSE`, `messagedId`, `REQUEST_ACCESS`, `REQUEST_NETWORK_DETAILS`, `SUBMIT_TRANSACTION`, `apiError` en el sobre) leyendo el escenario desde `sessionStorage`; `installed: false` no responde y deja que el timeout real de 2 s de la librería produzca "no instalado".
- `apps/web/e2e/support/stub-campaign-routes.mjs` (conectado en `stub-api-server.mjs`, reiniciado por `/__reset`): escenarios elegidos por la cuenta declarada — PyME bloqueada → 422 `sme_account_unavailable`; inversor con transacción `failed`; resto muta el estado de forma síncrona. Sin `Date.now`/`Math.random` (sólo contadores).
- `apps/web/e2e/campaign-vault.spec.ts` — 9 tests: apertura bloqueada y exitosa, aporte, aporte que cruza la meta → `Settled` sin controles de aporte, reembolso para otro inversor, Freighter ausente, red equivocada, firma rechazada y contribución revertida.
- Hallazgo del writer (en su propio test, no en producción): el anunciador de rutas de Next (`div role="alert"`) chocaba con `getByRole("alert")`; se acotó a `p[role="alert"]`.
- `pnpm run test:e2e` 17/17 y `pnpm run test:boundaries` 79/79 (re-ejecutados por el padre); lint y typecheck sin errores; `pnpm run test` 462/462 según el writer. Sin cambios en `apps/web/src`.

### T4
- Suite opt-in `apps/web/e2e-live/` + `playwright.live.config.ts` + `pnpm test:e2e:live` (fuera de `turbo`, CI y `verify`; `testing-and-ci-gates.test.ts` no la ve). Firma: el emulador de Freighter llama a `vaqcrowLiveSign` (`page.exposeFunction`) y la firma ocurre en el proceso de Playwright con identidades `Keypair.random()` fondeadas por Friendbot; la clave nunca llega a la página. Semilla de solicitudes aprobadas por `docker exec … psql`. Documentado en `environments.md` §12.
- **Bug de producción 1 (API, `e1872d1`):** `reconcile()` escribía aportes de monto 0 (inversor conectado que nunca aportó); el constraint `campaign_contribution_amount_stroops_check` los rechaza → toda lectura `GET /campaigns/:id?investor=` de un no-aportante daba 503. Arreglo: saltear montos ≤ 0.
- **Bug de producción 2 (web, `b6c1ff1`):** el formulario de reembolso exigía `state === "refunding"`, pero el contrato entra en `Refunding` recién con el primer `refund` tras el plazo: el primer reembolso era inalcanzable desde la UI. Arreglo: habilitarlo también en `funding` con el plazo vencido (reloj en estado, cada 5 s).
- Bug del propio test: el plazo con milisegundos no coincidía con el `u64` en segundos del contrato (`vault_state_mismatch`); se redondea al segundo.
- Resultado live (2 corridas del writer, contenedor de la API con la imagen anterior): (a) apertura por UI con creación de la cuenta de la PyME verificada en Horizon — pasa; (b) aporte/retiro, (c) meta → `settled`, (d) reembolso tras el plazo — fallan por el bug 1 (el contenedor no incluye el arreglo). Pendiente: reconstruir el contenedor (`pnpm env:docker:up`, lo corre el usuario) y re-ejecutar la suite.
- `pnpm run verify` verde, API 686/686, web 463/463, boundaries 0 violaciones, `test:boundaries` 79/79, `test:e2e` 17/17 (según el writer); tests de los dos arreglos re-ejecutados por el padre (11/11 y 13/13).
- Seguimiento: tras un retiro total, la cadena queda en 0 pero el espejo conserva la última fila positiva (el arreglo no escribe nada); lo correcto sería borrar la fila.
- `apps/web/AGENTS.md` y `apps/web/CLAUDE.md` los genera `next dev` (Next 16); no se versionan.
