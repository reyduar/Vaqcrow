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
- [ ] **U4 — Apertura de la bóveda.** Caso de uso: verificar/crear la cuenta de la PyME → `factory.deploy` firmado por la plataforma → `campaign.create` en el espejo. Ruta: writer delegado.
- [ ] **U5 — Rutas HTTP de campaña.** Estado (lee cadena + reconcilia), preparar invocación, enviar; cableado en `index.ts`. Ruta: writer delegado.
- [ ] **U6 — Web de campaña.** Gateway, hook y workspace con los tres estados, aporte, retiro y reembolso sin permisos; copy en español. Ruta: writer delegado.
- [ ] **U7 — Arranque de la red local.** Script que despliega SAC + fábrica en Quickstart y deja las direcciones para el perfil docker. Ruta: writer delegado.
- [ ] **U8 — Documento explicativo en español** (pedido del usuario): qué significa fondear una cuenta, los dos pares de claves y por qué fondea la plataforma. Ruta: inline.

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
