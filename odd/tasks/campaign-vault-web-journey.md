# Bitácora: bóveda de campaña en el recorrido web

## Objetivo

Llevar la bóveda de campaña al recorrido web: abrir la bóveda al aprobar, permitir que un inversor aporte firmando con Freighter una invocación de contrato, mostrar el estado de la campaña leído de la cadena y permitir el reembolso sin permisos. Task [#247](https://github.com/reyduar/Vaqcrow/issues/247) de la Feature [#237](https://github.com/reyduar/Vaqcrow/issues/237).

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | La API arma y simula las invocaciones de contrato; la web sólo transporta XDR opaco y firma con Freighter | La web no puede importar `@stellar/stellar-sdk` (regla `web-never-imports-server-stellar-sdk`) y Soroban exige simulación para footprint y fees |
| D2 | La cuenta de la plataforma crea la cuenta de la PyME (`CreateAccount`) sobre la clave pública que la PyME ya tiene en Freighter; Friendbot sólo fondea la cuenta de plataforma y las wallets de inversores en local/Testnet | Decidido en `stellar-blockchain-requirements.md` y confirmado por el usuario (2026-09-24); la cuenta de plataforma ya firma `deploy()` como dueña de la fábrica |
| D3 | La clave secreta de la plataforma entra como variable tipada `Secret` | Mismo patrón que `LLM_API_KEY`; nunca llega a un log |
| D4 | La red `local` (Quickstart) sólo se admite con `APP_ENV=local` | El criterio de #237 exige correr el recorrido de forma determinística contra la red local sin abrir la API a redes arbitrarias en la demo |
| D5 | La bóveda se abre en un paso explícito posterior a la aprobación, idempotente por `salt` derivado de `applicationId` | Separa la decisión humana (auditada) de la operación on-chain; un reintento predice la misma dirección con `predict(salt)` |
| D7 | La clave pública de la PyME se captura al abrir la bóveda (la PyME conecta Freighter tras la aprobación) y se guarda en el espejo de la campaña | La API no expone `POST /sme-requests` (la web lo llama, pero nada crea `application_review` en producción); elegido por el usuario el 2026-09-24 para mantener #247 acotado. El endpoint de solicitudes queda como seguimiento aparte |
| D8 | La API firma con la clave operativa de la plataforma sólo en un archivo auditado (`platform-signer.ts`); el escáner de no-custodia de #23 lo admite únicamente ahí y un test fija esa excepción | La garantía de #23 protege que Vaqcrow nunca tenga claves de usuarios; eso no cambia. La plataforma necesita su propia clave para `CreateAccount` y `factory.deploy` (dueña de la fábrica). Elegido por el usuario el 2026-09-24 frente a un script operativo fuera de la API |
| D6 | El espejo de Supabase se actualiza sólo con hechos leídos de la cadena (`reconcileCampaign`) | La cadena es autoritativa para el dinero (#239) |

## Configuración

- TDD: estricto (sesión); runner `pnpm --filter <workspace> exec vitest run`.
- Rama base: `Vaqcrow#247_Task_Implement_the_campaign_vault_journey_in_the_web`.
- Skills cargadas: `dapp`, `smart-contracts`.
- Estrategia de entrega: `ask-on-risk` → cadena **apilada a `main`** (`stacked-to-main`, elegida por el usuario el 2026-09-24). Ramas: la primera es la rama base; las siguientes `…-02-<slug>`, `…-03-<slug>`. Cada PR declara el orden de merge estricto de abajo hacia arriba (lección de #273/#274 → #275).

## Tareas

- [x] **U1 — Configuración Stellar para Soroban.** Red `local` (sólo `APP_ENV=local`), URL de Soroban RPC, dirección de la fábrica y del token (SAC nativo), clave de plataforma como `Secret`. Ruta: writer delegado.
- [x] **U2 — Clave pública de la PyME en la campaña.** Columna `sme_account_id` en `campaign` (migración probada en docker y aplicada al remoto), campo en el puerto/adaptador de campaña y esquemas compartidos en `packages/contracts` para abrir la bóveda y para el estado de campaña. La captura con Freighter va en U6 (D7). Ruta: writer delegado.
- [x] **U3 — Adaptadores Soroban.** Puertos en `application/`; lector de estado de la bóveda (`state`, `total`, `contribution_of`), constructor+simulación de `contribute`/`withdraw`/`refund`, verificación del XDR firmado y envío/sondeo por RPC. Ruta: writer delegado.
- [x] **U4 — Apertura de la bóveda.** Caso de uso: verificar/crear la cuenta de la PyME → `factory.deploy` firmado por la plataforma → `campaign.create` en el espejo. Ruta: writer delegado.
- [x] **U5 — Rutas HTTP de campaña.** Estado (lee cadena + reconcilia), preparar invocación, enviar; cableado en `index.ts`. Ruta: writer delegado.
- [x] **U6 — Web de campaña.** Gateway, hook y workspace con los tres estados, aporte, retiro y reembolso sin permisos; copy en español. Ruta: writer delegado.
- [x] **U7 — Arranque de la red local.** Script que despliega SAC + fábrica en Quickstart y deja las direcciones para el perfil docker. Ruta: writer delegado.
- [x] **U8 — Documento explicativo en español** (pedido del usuario): qué significa fondear una cuenta, los dos pares de claves y por qué fondea la plataforma. Ruta: inline.

## Hallazgos

- La web llama a `POST /sme-requests`, pero la API no implementa esa ruta; ninguna ruta de producción crea filas de `application_review`.

- `apps/api/src/index.ts` no cablea hoy las dependencias de `funding-intent`; queda obsoleto con este cambio.
- Las direcciones de Testnet de #245 valen hasta el reset del 2026-12-16.

## Verificación

### U1
- RED: 29 fallos en `config-matrix.test.ts` antes de implementar (red, Horizon, RPC, explorador, bóveda); 5 fallos en `stellar-horizon.test.ts` contra la firma anterior. GREEN: 111/111 y 6/6.
- `pnpm --filter @vaqcrow/api test` — 27 archivos, 565 tests (re-ejecutado por el padre).
- `pnpm run lint`, `typecheck`, `boundaries` (321 módulos, 0 violaciones), `test:boundaries` 75/75 — verdes según el writer. El escáner de no-custodia detectó un parámetro llamado `secretKey` en un test; se renombró.
- Decisión: `StellarConfig.explorerUrl` es `string | undefined` (indefinido sólo en `local`), porque ni la URL de Horizon ni el explorador de Testnet sirven como explorador de la red local.
- Revisión del padre: los issues de `STELLAR_PLATFORM_SECRET_KEY` sólo nombran la variable; `local` fuera de `APP_ENV=local` produce `unsupported`.
- Pendiente del usuario: líneas nuevas en `.env.docker.example` / `.env.cloud.example` (`STELLAR_RPC_URL`, `STELLAR_CAMPAIGN_FACTORY_ID`, `STELLAR_TOKEN_CONTRACT_ID`, `STELLAR_PLATFORM_SECRET_KEY`).

### U2
- RED: `campaign.test.ts` 46/46 fallando antes de existir el módulo; `tsc --noEmit` con 3 errores al exigir `smeAccountId` en el puerto. GREEN: 46/46; typecheck limpio.
- Migración `20260924132528_add_campaign_sme_account.sql`: dos ejecuciones locales con exit 0 y 0 errores; columna `NOT NULL` y constraint `campaign_sme_account_id_format_check` presentes.
- `pnpm run test:db` — 21/21 pgTAP. El writer pasó la descripción de `throws_ok` en la posición del mensaje esperado; el padre lo corrigió con la forma de cuatro argumentos.
- Remoto: aplicada con `apply_migration` (0 filas en `campaign` verificadas antes). La herramienta registró la versión `20260924132528`; el archivo del repo se renombró a esa versión para que el historial coincida sin escribir en `supabase_migrations`.
- Paridad: huella `71d51434770fe4801930701d5b14f36f|127` idéntica en local y remoto.

### U3
- Puertos `campaign-vault-chain-port.ts` (lectura; mapeo `funding|settled|refunding` → `open|settled|refundable`) y `campaign-vault-invocation-port.ts` (preparar, verificar, enviar, resultado). Adaptadores `soroban-rpc.ts`, `stellar-campaign-vault-chain.ts`, `stellar-campaign-vault-invocation.ts`; `stellar-horizon.ts` expone `allowsPlainHttp` para reutilizar la misma regla en RPC.
- RED→GREEN por comportamiento: soroban-rpc 5/5, puerto de cadena 2/2, lector 9/9, invocación 30/30. El writer corrigió dos errores en sus propios tests (no en la implementación).
- `pnpm --filter @vaqcrow/api test` — 31 archivos, 611 tests; `pnpm run test:boundaries` — 75/75, incluido el escáner de no-custodia (re-ejecutados por el padre). Lint, typecheck, boundaries (332 módulos, 0 violaciones) y build verdes según el writer.
- Revisión del padre de `verify`: rechaza fee-bump, exige una única invocación al contrato/función esperados, compara argumentos, controla la cuenta origen salvo en `refund`, el vencimiento y la firma de la cuenta origen.
- Nota para U5: la ruta debe pasar siempre `sourceAccountId` en `contribute`/`withdraw` (sólo `refund` lo omite); si no, el control de origen queda abierto.
- Supuesto sin verificar en red: el enum `State` sin datos se decodifica como `ScVal::U32`; se valida en U7 contra Quickstart.
- Tamaño: ~1.640 líneas (dos puertos, tres adaptadores y cobertura exhaustiva por rama); excede las 400 del presupuesto sin partición cohesiva menor → se declara en el PR (`size:exception`).

### U4
- Escáner de no-custodia: `PLATFORM_SIGNER_FILES` con una única entrada (`platform-signer.ts`); `Keypair.fromSecret` sigue prohibido en cualquier otra ruta y los nombres de material secreto siguen prohibidos también ahí. Cabecera reescrita citando D8.
- `PlatformSigner`: `reveal()` una sola vez en el constructor, clave en campo privado `#signingKey`, sólo expone `publicKey` y `sign()`; `toString`/`toJSON` devuelven un marcador fijo.
- Puertos `stellar-account-port.ts` y `campaign-factory-port.ts`; `findByApplicationId` en el repositorio de campaña. Adaptadores `stellar-platform-account.ts` (Horizon: existencia vía `loadAccount`, `CreateAccount` con sondeo acotado) y `stellar-campaign-factory.ts` (Soroban RPC: `predict`, `deploy` firmado por la plataforma).
- Caso de uso `open-campaign.ts`: aprobada → `predict(salt = SHA-256(applicationId))` → replay si ya existe → crear la cuenta de la PyME si falta (2 XLM) y re-verificar → `deploy` → leer la bóveda (debe estar en `funding` y coincidir) → registrar en el espejo.
- RED→GREEN: escáner 14/14, firmante 5/5, cuenta 8/8, fábrica 7/7, repositorio 10/10, caso de uso 10/10.
- `pnpm run test:boundaries` 79/79 y `pnpm --filter @vaqcrow/api test` 644/644 (re-ejecutados por el padre); lint, typecheck, boundaries (342 módulos, 0 violaciones), build y `pnpm run verify` verdes según el writer.
- Tamaño: ~1.700 líneas; mismo `size:exception` que U3.
- Revisión RDD (lente de confiabilidad): `correction_required` con un hallazgo CRITICAL válido, `R3-open-campaign-retry-not-idempotent` — tras un deploy confirmado y una falla posterior, el reintento no encontraba fila en el espejo y redeployaba con el mismo `salt`, fallando para siempre. Corrección en `0eb6f0d`: sonda de la dirección predicha antes del deploy (adopta la bóveda existente; `not_found` → deploy; otra respuesta → `unavailable` sin desplegar). RED: 2 tests nuevos + 4 ajustados fallando; GREEN: 12/12 y API 646/646.
- Plan de corrección declarado: 80 líneas; corrección real: 104 (presupuesto congelado 200).
- Tras la corrección, el STATUS vinculado devolvió el estado terminal `captured_artifacts_unverifiable` (lineage `review-1bf004b35f589d76`). Pendiente de decisión del usuario.

### U5
- Esquemas compartidos: `prepareContractInvocationCommandSchema`, `submitContractInvocationCommandSchema` (campos declarados y anulables), refinamiento común (contribute exige monto; withdraw/refund lo prohíben; contribute/withdraw exigen origen nulo o igual al inversor; refund acepta cualquiera), respuesta de envío y estado de transacción.
- Rutas `campaign.route.ts` (registradas sólo con dependencias): `POST /campaigns` (201/200/404/409/422/503/400), `GET /campaigns/:id` (lee cadena y reconcilia; 503 si la cadena no responde), `POST …/invocations` (409 `campaign_not_funding`), `POST …/invocations/submission` (202; 422 sin detalles internos), `GET …/transactions/:hash`.
- Composición: `infrastructure/campaign-dependencies.ts` construye las dependencias sólo si la bóveda está habilitada; deriva el SAC nativo con `Asset.native().contractId(networkPassphrase)` si falta `STELLAR_TOKEN_CONTRACT_ID`.
- Invariante verificado por el padre: el envío verifica con `sourceAccountId = investorAccountId` para contribute/withdraw (`campaign.route.ts:417`), fijado por tests (líneas 549 y 566); refund lo omite.
- RED→GREEN: contratos 21 fallos → 325/325; rutas 31 fallos → 34/34 (dos errores de fixtures corregidos). Desvío: `campaign-dependencies` (5 tests) se escribió junto con la implementación tras el corte por límite de uso.
- El writer se cortó una vez por límite de uso de la sesión (HTTP 429) y se retomó con su contexto.
- `pnpm --filter @vaqcrow/api test` 685/685 y `pnpm run test:boundaries` 79/79 (re-ejecutados por el padre); lint, typecheck, boundaries (345 módulos, 0 violaciones), build y `pnpm run verify` verdes según el writer.

### U6
- Puerto `campaign-gateway.ts` + adaptador HTTP (parsea con `@vaqcrow/contracts`), hook `use-campaign-vault.ts` (preparar → firmar con Freighter y guarda de red → enviar → sondeo acotado → refresco), `campaign-workspace.tsx` con apertura de campaña (la PyME conecta Freighter; D7), estados `Funding`/`Settled`/`Refunding` desde la API, aporte sólo en `funding`, retiro y reembolso sin permisos para cualquier dirección. `funding/page.tsx` usa el nuevo workspace y guarda el id en `?campaign=`.
- El writer se detuvo por el watchdog (600 s sin progreso) mientras corría la suite web con la máquina cargada (load ~39); el padre completó la verificación y corrigió:
  - Lint `react-hooks`: `setState` síncrono en el effect de carga → carga con cancelación, escritura de estado sólo al llegar la respuesta y `isLoadingCampaign` derivado de la clave cargada.
  - Mocks de `next/navigation` en `trust-disclosures.integration.test.tsx` y `prohibited-terms.test.tsx` (la página ahora usa `useRouter`/`useSearchParams`).
- `pnpm --filter @vaqcrow/web test` 73 archivos, 454/454; `pnpm run test:boundaries` 79/79; lint y typecheck sin errores; `pnpm --filter @vaqcrow/web build` verde; `pnpm run test:e2e` 8/8 (todo re-ejecutado por el padre). `pnpm run boundaries`: 360 módulos, 0 violaciones.

### U7
- `contracts/scripts/bootstrap-local-campaign.sh` (`pnpm env:docker:bootstrap`): levanta Quickstart si no está sano, fondea la identidad `vaqcrow-platform` (clave en el keystore del Stellar CLI), despliega el SAC nativo, sube el wasm de la bóveda y despliega la fábrica; escribe sólo datos públicos en `contracts/.local-deployment.json` (ignorado por git).
- `generate-docker-env.sh`: si existe ese archivo, escribe el bloque Stellar local y toma la clave de plataforma del keystore sin imprimirla (revisado por el padre). `docker-compose.local-network.yml` traduce las URLs host→contenedor sólo cuando `.env.docker` es de red local, para no romper el perfil de Testnet.
- `bash -n` y `shellcheck` sin hallazgos; lint verde; `test:boundaries` 79/79; boundaries 360 módulos, 0 violaciones (según el writer).
- Nota: el contenedor Quickstart `vaqcrow-local` había terminado con código 137 (probablemente sin memoria bajo carga alta); el bootstrap lo relanza si no responde.
- Verificación end-to-end (2026-09-24) contra Quickstart y Supabase local, con el contenedor de la API del perfil docker; ver "Verificación end-to-end en red local".

### U8
- `docs/architecture/stellar-accounts-and-keys.md` (español): qué es fondear una cuenta, los dos pares de claves, el paso a paso de la apertura, por qué fondea la plataforma y no Friendbot, y cómo se protege la clave de la plataforma. Enlazado desde `environments.md` §11.

## Verificación end-to-end en red local (2026-09-24)

Pasos del usuario: `pnpm env:docker:bootstrap` (fábrica `CAOIRF2GG3NWAWS5HZOLAM5V2RYD7YYL5ZUCBBJCXP5KUJSYSR5JIFDW`, SAC nativo `CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4`, plataforma `GBO2UKUZ4KCI3ELPZLJTT74XFHSH5OWCCGGVWBNVUZCUKC3VFGDV6ZVQ`) → `./scripts/env/generate-docker-env.sh --force` → `pnpm env:docker:up` (exit 0, API healthy).

Comprobaciones del padre (datos sintéticos sólo en red y base locales; identidades de prueba `vaqcrow-demo-sme` sin fondear y `vaqcrow-demo-investor` fondeada, en el keystore del CLI; el CLI firma en lugar de Freighter):

| Paso | Resultado |
|---|---|
| Cuenta de la PyME antes de abrir | 404 en Horizon (no existe) |
| `POST /campaigns` (objetivo 100 XLM) | 201, bóveda `CCFF6HM5GRQCONCCEBNZVC7ULVXV6RQKCMUPLSYRV2UYW63XJMIWYQQE` en `funding`: la decodificación de `State` como `U32` (supuesto de U3) queda validada |
| Cuenta de la PyME después | existe con 2 XLM (`CreateAccount` de la plataforma antes del deploy) |
| Repetir `POST /campaigns` | 200, sin redesplegar |
| Preparar `contribute` 30 XLM → firmar → `submission` | 200 → XDR firmado → 202 `accepted` → `success` |
| `GET /campaigns/:id?investor=` | `funding`, total 30 XLM, aporte propio 30 XLM |
| `contribute` 70 XLM (cruza el objetivo) | `success`; estado `settled`, total 100 XLM |
| Saldo de la PyME | 2 → 102 XLM (pago en la misma transacción) |
| `contribute` tras liquidar | 409 `campaign_not_funding` |

Observación para #248: tras un aporte legítimo, la primera reconciliación marca `diverged` (el espejo va un paso atrás de la cadena, semántica heredada de #239) y la lectura siguiente vuelve a `in_sync`. No es un error, pero registra como anomalía un desfase esperado; conviene distinguir "espejo desactualizado por un hecho nuevo" de "divergencia".

No ejercitado todavía en red: `withdraw`, `refund` sin permisos tras el plazo y la firma real con Freighter en el navegador (quedan para #248).

## Entrega (cadena apilada a `main`)

| PR | Rama | Commits |
|---|---|---|
| [#278](https://github.com/reyduar/Vaqcrow/pull/278) | base | `5737359` (U1), `9743035` (D7) |
| [#279](https://github.com/reyduar/Vaqcrow/pull/279) | `-02-sme-account` | `39e3651` (U2) |
| [#280](https://github.com/reyduar/Vaqcrow/pull/280) | `-03-soroban-adapters` | `1ceb9d1` (U3), `9938784` (D8) |
| [#281](https://github.com/reyduar/Vaqcrow/pull/281) | `-04-open-vault` | `77e8711` (U4), `0eb6f0d` (corrección), `cd2c546` |
| [#282](https://github.com/reyduar/Vaqcrow/pull/282) | `-05-http-routes` | `a4cc763` (U5) |
| [#283](https://github.com/reyduar/Vaqcrow/pull/283) | `-06-web-workspace` | `5fa7568` (U6) |
| [#284](https://github.com/reyduar/Vaqcrow/pull/284) | `-07-local-bootstrap` | `5a5da30` (U7), `e307bce` (U8), `f683e3e` (evidencia), este registro — `Closes #247` |

Orden de merge estricto de abajo hacia arriba; tras cada merge, confirmar que el PR siguiente quedó con base `main` antes de mergearlo (lección de #273/#274 → #275). La revisión de la rama acumulada no pudo correr (`lens_context_budget_exceeded`, 8.865 líneas): la cobertura es la de cada slice.
