# Evidencia de cierre de la Feature #406 — Issue #409

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#407](https://github.com/reyduar/Vaqcrow/issues/407) (implementación) y [#408](https://github.com/reyduar/Vaqcrow/issues/408) (pruebas) de la Feature [#406](https://github.com/reyduar/Vaqcrow/issues/406) ("Feature: Connect the PyME Freighter wallet before review", Epic [#374](https://github.com/reyduar/Vaqcrow/issues/374)), conserva las verificaciones locales realizadas durante la iteración y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/pyme-wallet-connection|Bitácora: conexión de la wallet Freighter de la PyME]].

> [!warning] Estado de entrega: la implementación y la evidencia están completas en la rama de integración; #406 no está en `main`
> La rama activa `Vaqcrow#406_Feat_Connect_the_PyME_Freighter_wallet_before_review` está en el tip `0c740f8`. Los commits de implementación, pruebas y evidencia de #407/#408/#409 son ancestros de esta base actual; no hay trabajo de #406 integrado en `main`. El owner cerró manualmente #407, #408, #409 y #406 el 2026-10-06. La demo desplegada desde `main` todavía no conecta Freighter.

## 1. Contexto y objetivo

La Feature #406 permite que una PyME conecte (o cree) Freighter, demuestre que controla la cuenta firmando un challenge de un solo uso y guarde su public key en el perfil antes de que la solicitud llegue a revisión del admin. La key es el **destino inmutable** de la bóveda cuando el admin aprueba, y la conexión es no-custodial: Vaqcrow nunca recibe ni guarda un seed ni una clave privada. Entrega además el **wallet card** del template y un adaptador de Freighter **reutilizable por los flujos de inversor** a través del puerto existente. Depende de [#398](https://github.com/reyduar/Vaqcrow/issues/398) (wizard de alta de la PyME; evidencia en [[docs/planning/pyme-onboarding-wizard-and-document-upload-evidence|Evidencia de #398]]).

| Task | Rama/base de referencia | Estado integrado (2026-10-06) |
|---|---|---|
| #406 — Feature | `Vaqcrow#406_Feat_Connect_the_PyME_Freighter_wallet_before_review` (`0c740f8`) | implementación, pruebas y evidencia completas; cerrado manualmente 2026-10-06 |
| #407 — implementar | rama de integración actual (`0c740f8`) | T1a/T1b/T1c completos en commits históricos; cerrado manualmente 2026-10-06 |
| #408 — probar | rama de integración actual (`0c740f8`) | pruebas y cobertura completas en el historial; cerrado manualmente 2026-10-06 |
| #409 — documentar | rama de integración actual (`0c740f8`) | evidencia presente y reconciliada; cerrado manualmente 2026-10-06 |

La Feature #406 y sus Tasks fueron cerradas manualmente el 2026-10-06; esta documentación no afirma que estén mergeadas en `main`.

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-04 durante la iteración, en el árbol histórico que tenía la rama de #409 sobre `67e76d1`, con su línea de salida real (§4.1). (b) **Bitácora** — una entrada fechada de [[odd/tasks/pyme-wallet-connection]] o el resultado de una revisión RDD; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba de esta Feature habla con Freighter real, con Testnet/Horizon ni con el proyecto Supabase remoto. Las pruebas de aplicación y de componentes usan dobles (`FakeWallet`, `FakeWalletConnection`); el smoke de Playwright instala un emulador local de Freighter (`apps/web/e2e/support/freighter-emulator`) y un stub de `/profile/wallet*` bajo un fixture que falla si el navegador toca cualquier host no local. Sólo `pnpm run test:db` toca una base, y es el stack local del perfil docker.
- **Sin secretos.** Ningún email, contraseña, seed, clave privada, token ni identificador de proyecto aparece en este documento; las variables se nombran, nunca sus valores.

## 3. Qué quedó implementado (Task #407)

Fuente: bitácora (T1a/T1b/T1c, 2026-10-04), decisiones del owner y lectura del código en los commits históricos de implementación listados en el addendum de reconciliación.

- **Migración y pgTAP (T1a)** — `supabase/migrations/20261004120000_add_profile_wallet_and_challenge.sql`: `profile.stellar_public_key text` (nullable, `check ~ '^G[A-Z2-7]{55}$'`) y `public.wallet_challenge` (`challenge_id` uuid PK, `owner_user_id → profile` cascade, `nonce`, `created_at`, `expires_at`, `consumed_at` nullable) con RLS encendida, **cero políticas** y grants explícitos: `service_role` es el único lector/escritor, `anon`/`authenticated` sin acceso. pgTAP `supabase/tests/wallet_connection.sql` (plan 44; toca estructura, grants, escritura como `service_role` y lectura del dueño por RLS). Aplicada al remoto (MCP de Supabase, 2026-10-04) con el historial reconciliado a `20261004120000`; verificado columna, RLS on, 0 políticas y grants. Commit `7e75d5c` (docs `f13ff70`).
- **API (T1b)** — rutas `POST /profile/wallet/challenge` (emite el mensaje a firmar, `201 { challengeId, message }`), `POST /profile/wallet` (verifica y guarda, `200 { publicKey, frozen }`) y `GET /profile/wallet`, las tres `only("PYME")` en `route-policy.ts` y con el dueño tomado de `request.principal.userId`, nunca del cuerpo. Puerto `wallet-repository-port` (challenge create/find/consume condicional, `readPublicKey`/`writePublicKey`, `isFrozen`) + `wallet-signature-port`; adaptadores `supabase-wallet-repository` (`service_role`, errores saneados a `{ code }`) y `stellar-wallet-signature` (**SEP-53** `Keypair.verifyMessage`). La firma se verifica contra el `nonce` del challenge; la key se guarda en `profile.stellar_public_key`. **Inmutabilidad:** `isFrozen` recorre `sme_request.owner_user_id → application_id → campaign`, y `POST /profile/wallet` responde `409 wallet_frozen` si el dueño ya tiene bóveda. Errores `400/404/409/503` saneados, sin `message`/`details`. Commit `d111ba4` (docs `7284c68`).
- **Web (T1c)** — `WalletPort.signMessage` (SEP-53) sumado al puerto existente y `FreighterWallet` con la red `TESTNET` como regla de vinculación (una wallet en otra red se rechaza) y clasificación de errores; `FakeWallet` como doble. Puertos `wallet-connection`/`wallet-balance` + adaptadores (`http-wallet-connection-gateway`, `create-wallet-connection-port`, `unavailable-*`, `simulated-wallet-balance-adapter`); modelo puro `connectAndStoreWallet` (conecta → challenge → firma → guarda, con `stage` para copy honesto); `wallet-card` fiel al template (`Vaqcrow Portafolio.dc.html:116-137`): «Freighter conectada de forma no custodial», `STELLAR TESTNET`, «Saldo disponible», «Activo de prueba sin valor económico», key acortada con Copiar/Copiada, Explorador y Desconectar, más estado `CONGELADA` con motivo visible. Cableado en `review-step` (el paso 4 «Revisión humana» del wizard; el envío exige la key **persistida** server-side) y en `/company` (monta la card). Commit `578aa92` (docs `8509e5e`).
- **Corrección R3-001/002/003 (T1b)** — `d208a50` mueve el consumo del challenge **antes** de escribir la key (si el write falla, el challenge ya quedó quemado: fail-closed), mapea el update sin filas a `not_found` (`PGRST116`) y ejercita la rama de fallo de `isFrozen`.

**Desvíos y seams registrados** (vs. el texto del issue):

1. **El nombre `WalletConnectionPort` del issue corresponde al `WalletPort` del repo.** El puerto y el adaptador de Freighter ya existían y los consumen los flujos de inversor; #406 **no** crea un puerto nuevo, extiende el existente con `signMessage` (SEP-53). Bitácora §«Hechos de la exploración».
2. **El saldo XLM es un adaptador simulado determinista.** `SimulatedWalletBalanceAdapter` devuelve siempre `0.0000000` (la cuenta Testnet se trata como sin fondos, uno de los casos nombrados por el owner) sin consultar Horizon. La regla de frontera prohíbe el SDK de Stellar en la web; un adaptador real por `fetch` es una unidad posterior.
3. **El link del explorador se arma en la web.** `walletAccountExplorerUrl` (`https://stellar.expert/explorer/testnet/account/<key>`); la API no devuelve un link de cuenta.
4. **Tres tests fuera de la superficie declarada** cambiaron mecánicamente porque `WalletPort` sumó un método (`workspace-status.test.tsx`, `workspace-view-model.test.ts`, `pyme-onboarding-wizard.test.tsx`).

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-04)

Las pruebas se re-ejecutaron el 2026-10-04 en el árbol histórico de #409 sobre `67e76d1`, con Node `v24.21.0` y la base de datos del stack local del perfil docker en marcha (`test:db` sólo usa Postgres). La rama de integración actual está en `0c740f8`; este addendum no inventa una nueva ejecución de las suites.

```sh
$ pnpm --filter @vaqcrow/api test
 Test Files  69 passed (69)
      Tests  1588 passed (1588)

$ pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4
 Test Files  154 passed (154)
      Tests  1464 passed (1464)

$ pnpm run test:db
 /…/supabase/tests/wallet_connection.sql .................... ok
 (+ 11 archivos previos, todos ok)
All tests successful.
Files=12, Tests=280
Result: PASS

$ pnpm run boundaries
✔ no dependency violations found (740 modules, 2340 dependencies cruised)

$ pnpm --filter @vaqcrow/api typecheck
exit 0

$ pnpm --filter @vaqcrow/web typecheck
exit 0
```

**No re-ejecutado aquí:** `pnpm run verify` completo ni el smoke de Playwright `test:e2e`; su resultado de la iteración se toma de la bitácora (`test:e2e` 41 pasan, T1c). La suite de tests de contratos (`packages/*`) no la cambia esta Feature.

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Migración: columna nullable con el `CHECK` de la key, tabla `wallet_challenge`, RLS on / 0 políticas / grants `service_role`, FK al perfil, escritura como `service_role` y lectura del dueño por RLS | `supabase/tests/wallet_connection.sql` | Re-ejecutado (`test:db`); RED en bitácora T1a |
| Challenge: emisión, firma válida que guarda la key, replay/expiración, clave distinta, orden consumo-antes-de-escritura, `isFrozen` fallido | `apps/api/src/application/use-cases/wallet.test.ts` | Re-ejecutado (`apps/api`); RED en bitácora T1b y corrección `d208a50` |
| Rutas: `only("PYME")`, `201`/`200`, `400`/`404`/`409 wallet_frozen`/`503`, sin filtrar texto del proveedor, dueño desde el principal | `apps/api/src/infrastructure/http/routes/wallet.route.test.ts` | Re-ejecutado (`apps/api`); RED en bitácora T1b/T2 |
| Adaptador Supabase: violación de `CHECK` → `invalid_request`, update sin filas (`PGRST116`) → `not_found`, cualquier otro error → `unavailable`; `isFrozen` por `sme_request → campaign` | `apps/api/src/infrastructure/adapters/supabase-wallet-repository.test.ts` | Re-ejecutado (`apps/api`); RED en bitácora T1b/T2 y corrección `d208a50` |
| Verificación SEP-53 (`Keypair.verifyMessage`) y red equivocada | `apps/api/src/infrastructure/adapters/stellar-wallet-signature.test.ts` | Re-ejecutado (`apps/api`) |
| Secuencia web conecta → challenge → firma → guarda; `stage` honesto por fallo; copy de los cuatro estados de Freighter; URL del explorador | `apps/web/src/application/pyme-onboarding/wallet-connection.test.ts` | Re-ejecutado (suite web); RED en bitácora T1c |
| `FreighterWallet`: no instalado, conexión rechazada, red equivocada, `signMessage`/`signTransaction` exigen Testnet; `FakeWallet` | `apps/web/src/infrastructure/wallet/freighter-wallet.test.ts` | Re-ejecutado (suite web) |
| Wallet card: título, `STELLAR TESTNET`, saldo en `es-AR` con 7 decimales (`0,0000000 XLM`), key acortada + Copiar/Copiada, Explorador, Desconectar y `CONGELADA` que no permite desconectar | `apps/web/src/presentation/components/wallet-card.test.tsx` | Re-ejecutado (suite web); RED en bitácora T2 (formato `es-AR`) |
| Portón de envío del wizard: sin key **persistida** avisa y no envía; con key persistida envía | `apps/web/src/application/pyme-onboarding/review-step.test.ts`, `.../presentation/.../review-step.test.tsx` | Re-ejecutado (suite web) |
| Smoke de navegador: ingreso PYME → wizard → Freighter (emulador local) → envío, contra los dobles locales | `apps/web/e2e/pyme-onboarding.spec.ts` + `e2e/support/freighter-emulator` | Bitácora T1c (`test:e2e` 41); **no re-ejecutado aquí** |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Remoto (MCP de Supabase, 2026-10-04):** migración `20261004120000` aplicada y verificada; historial reconciliado de `20261004180651` a `20261004120000`; columna presente, RLS on, 0 políticas, grants de `service_role` OK y `authenticated` sin acceso.
- **SEP-53 confirmado contra las versiones instaladas:** `@stellar/freighter-api@6.0.1` expone `signMessage` y `@stellar/stellar-sdk@17.1.0` trae `Keypair.verifyMessage`.
- **Freighter en el navegador real:** una comprobación manual con la extensión real queda como paso humano (la estrategia de pruebas del issue la declara manual); aquí sólo corre el emulador.

**Nunca ejercitado:** conexión, firma, challenge ni almacenamiento contra **Freighter real** ni contra el proyecto Supabase **remoto** con un navegador; tampoco una lectura real de Horizon (el saldo es simulado, §3.2).

## 5. Límites y brechas vigentes

1. **Criterio 2 integrado.** El portón del envío del wizard se apoya en la conexión **persistida** (`review-step.tsx:132`, verificado también en el smoke), `POST /profile/wallet` se niega a reemplazar una key congelada (`409 wallet_frozen`) y el `POST /sme-requests` de #402 lee la key almacenada del principal verificado y devuelve `409 { code: "wallet_required" }` cuando falta. El enforcement server-side pertenece a #402, no a la implementación de #406; el seam histórico quedó cerrado en la base integrada actual.
2. **La revisión RDD nativa de T1c quedó incompleta.** La lente devolvió vacío (`opencode_task_output_empty`) y el ciclo cerró con `stop`/`unachievable_lens_slot`, linaje `review-dbfbdad83184babc`; fue un fallo de transporte del reviewer, no una aprobación inventada ni una regresión de código. Reintentable. Ver §7.
3. **Saldo XLM simulado.** `SimulatedWalletBalanceAdapter` siempre devuelve `0.0000000`; no hay lectura real de Horizon (unidad posterior; la frontera prohíbe el SDK en la web). El link del explorador se arma en la web (§3.3).
4. **Hallazgos no bloqueantes de T1b** ya corregidos en `d208a50`, pero conviene reintentar su revisión para confirmarlo de forma independiente.
5. **Reemplazabilidad acotada.** Antes del deploy la PyME puede desconectar/reconectar y guardar otra key; una vez desplegada la bóveda queda congelada. El admin ve la key **acortada** como destino inmutable (no hay pantalla de revisión de wallet en esta Feature; la muestra la revisión del admin de #402/#410).
6. **Contrato `SmeRequest`** sin cambios: la key vive en `profile`, no viaja en la solicitud.
7. **Sin comprobación contra el remoto de la conexión.** La firma y el almacenamiento se probaron con dobles y contra el stack local (`test:db`), no contra el proyecto remoto con un navegador real.

## 6. Preguntas abiertas y decisiones del owner

| Pregunta (issue #406, «Not designed in the template (open question)») | Resolución | Fuente |
|---|---|---|
| "States for Freighter not installed and guidance to create a wallet (the template only says "Conectar Freighter"), user rejects the connection, wrong network, and an unfunded Testnet account." | **DECIDIDA (1, 2026-10-04): estados honestos por caso, en español neutro.** No instalado con guía para crear la wallet (`unavailable`); usuario que rechaza (`rejected`); red equivocada que pide Testnet (`network_mismatch`); cuenta sin fondos (`0,0000000 XLM` visible) que **no** bloquea guardar la key. Implementada en `WALLET_KIND_COPY` / `WALLET_CONNECTION_COPY`. | Bitácora §Decisiones 1; comentario del owner en #406 |
| "How the PyME changes or replaces the key before approval, and what the admin review shows about the key." | **DECIDIDA (2, 2026-10-04): reemplazable hasta el deploy.** Antes de que exista la bóveda la PyME puede desconectar/reconectar y guardar una key nueva; una vez desplegada la bóveda queda **congelada** (`isFrozen`, `409 wallet_frozen`). La revisión admin muestra la key **acortada** como destino inmutable. | Bitácora §Decisiones 2; comentario del owner en #406 |
| "Where in the PyME wizard the connect step sits (the template places it only in the account-created next steps)." | **DECIDIDA (3, 2026-10-04): paso 4 «Revisión humana» del wizard** (como D12 y el código actual) **+ wallet card en `/company`** (Mi campaña), según DEMO.md. | Bitácora §Decisiones 3; comentario del owner en #406 |

Decisiones del owner registradas durante la Feature (bitácora, 2026-10-04):

| # | Decisión | Estado |
|---|---|---|
| D1 | Estados honestos de Freighter por caso (no instalado, rechazo, red equivocada, cuenta sin fondos que no bloquea la key), copy en español neutro. | vigente |
| D2 | Key reemplazable hasta el deploy de la bóveda; congelada después; el admin ve la key acortada. | vigente |
| D3 | Paso de conexión en el paso 4 «Revisión humana» del wizard + wallet card en `/company`. | vigente |

## 7. Correcciones aplicadas durante el ciclo y revisiones RDD

1. **Hallazgos de la revisión RDD de T1b** — R3-001 (`WARNING`: se guardaba la key antes de consumir el challenge, no atómico y con challenge reutilizable), R3-002 (`SUGGESTION`: la rama de fallo de `isFrozen`/503 no se ejercía) y R3-003 (`SUGGESTION`: el test de `writePublicKey` modelaba la fila ausente como `{data:null,error:null}` cuando `supabase-js .single()` devuelve `PGRST116`). Los tres se resolvieron en `d208a50` (consumo antes de la escritura, mapeo `PGRST116` a `not_found`, rama de `isFrozen` ejercitada).

Revisiones RDD:

| Candidato | Linaje | Resultado | Fuente |
|---|---|---|---|
| T1b (base `f13ff70`, `medium`, 14 archivos, 1720 líneas, `slice_budget_reached`) | `review-5ccd94f879b8079e` | `approved`, `burned`, autoridad `burned`; 3 hallazgos no bloqueantes → `d208a50` | Bitácora |
| T1c (base `d208a50`, `medium`, 26 archivos, 1670 líneas, `slice_budget_reached`) | `review-dbfbdad83184babc` | **incompleta** — `stop`/`unachievable_lens_slot` (`opencode_task_output_empty`) | Bitácora |

El assess de T2 (#408) cerró en `medium`/`under_budget` (bitácora T2).

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #406) | Resultado | Fuente |
|---|---|---|---|
| 1 | "A PyME can connect Freighter and its public key is stored after the control challenge; the wallet card matches the template." | ✅ **CUMPLIDO con dobles.** `connectAndStoreWallet` conecta Freighter → pide el challenge → firma → guarda; la API verifica la firma SEP-53 contra el `nonce` del challenge de un solo uso, lo consume y escribe `profile.stellar_public_key`. El wallet card sigue `Vaqcrow Portafolio.dc.html:116-137` (título no-custodial, `STELLAR TESTNET`, «Saldo disponible», «Activo de prueba sin valor económico», key acortada + Copiar/Copiada, Explorador, Desconectar, `CONGELADA`). No se probó contra Freighter real ni el remoto (§5.7). | Suite `apps/api` y web re-ejecutada; Playwright citado de bitácora |
| 2 | "Submission to review is rejected without a stored public key." | ✅ **CUMPLIDO en la base integrada actual.** El portón del wizard exige la conexión persistida (`review-step.tsx:132`), `POST /profile/wallet` responde `409 wallet_frozen` al intentar reemplazar una key con bóveda y el `POST /sme-requests` de #402 lee la key del principal verificado y responde `409 { code: "wallet_required" }` si falta. Históricamente, este enforcement pertenece a #402 y no fue agregado por #406. | Lectura del código y contrato actual de #402; bitácora T1b para el seam histórico |
| 3 | "The key cannot change after the vault deployment; no seed or private key is ever requested, sent or stored." | ✅ **CUMPLIDO.** `isFrozen` recorre `sme_request.owner_user_id → application_id → campaign`; con bóveda, `POST /profile/wallet` responde `409 wallet_frozen` (no cambia la key). El flujo sólo usa la public key y una firma SEP-53 de mensaje; `FreighterWallet` nunca pide ni devuelve seed, mnemonic ni clave privada. | Suite `apps/api` y web re-ejecutada; lectura del código |
| 4 | "The Freighter adapter is reusable by investor flows through the port." | ✅ **CUMPLIDO.** `WalletPort` (`wallet-port.ts:41`) + adaptador `FreighterWallet` ya los consumen `funding-workspace`, `distribution-workspace`, `campaign-workspace` y `workspace-status`; #406 no crea un puerto nuevo y suma `signMessage` (SEP-53) al existente. | Lectura del código + `boundaries` re-ejecutado |
| 5 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Fallos cubiertos: Freighter no instalado/rechazo/red equivocada/desconocido, challenge inválido/expirado/replay/clave distinta, `isFrozen` fallido, `409 wallet_frozen`, `503` de persistencia, `400/404/503` de ruta, fallo al copiar la cuenta; este documento es la evidencia. | Suite `apps/api`, web y `test:db` re-ejecutadas; §4.2 |
| 6 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** Las tres preguntas se decidieron el 2026-10-04 (D1–D3, §6) antes de implementarse: estados honestos de Freighter, key reemplazable hasta el deploy, y el paso de conexión en el wizard paso 4 + wallet card en `/company`. Ninguna se inventó. | Bitácora §Decisiones; comentario del owner en #406 |
| 7 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin valores de variables ni seeds/claves en el repo, la bitácora ni este documento; el saldo XLM es explícitamente simulado y rotulado «Activo de prueba sin valor económico»; `STELLAR TESTNET`; Vaqcrow sigue no-custodial y no mueve fondos. | Revisión de este documento; suite re-ejecutada |

## 9. Riesgos, contradicciones y limitaciones aceptadas

- **Cierre manual de las Tasks.** GitHub no cierra un issue cuando la PR se mergea en una rama que no es la principal; el owner cerró #407/#408/#409 y #406 manualmente el 2026-10-06. Ninguno está en `main`.
- **Revisión nativa de T1c sin completar.** No hay resultado de lente por un defecto del transporte del reviewer (§5.2); su verificación es la de la bitácora T1c y la re-ejecución de §4.1.
- **El criterio 2 pertenece a #402 y está cerrado en la base integrada.** El seam histórico quedó resuelto: `POST /sme-requests` lee la key del principal verificado y devuelve `409 { code: "wallet_required" }` si falta (§5.1 y §8). No se atribuye este enforcement a #406.
- **El remoto no se re-verificó aquí.** Todo lo del proyecto remoto proviene de la bitácora (2026-10-04).

## 10. Estado de entrega y próximos pasos

- Este pase es sólo documentación: reconcilia este archivo, la bitácora y las entradas de #406–#409 en `demo-tasks-list.md` con la rama de integración en `0c740f8`. La evidencia histórica se entregó en `be6b758`; no se agregó implementación ni commit nuevo en este pase.
- La implementación, las pruebas y la evidencia están completas en la rama de integración; GitHub cerró #407/#408/#409 y #406 manualmente el 2026-10-06. La Feature #406 **no está en `main`**.

> [!info] Limitaciones y verificaciones manuales preservadas
> 1. El criterio 2 ya está cerrado en la base integrada por #402; no es una tarea pendiente de implementación de #406.
> 2. La revisión RDD nativa de T1c quedó incompleta por transporte (`opencode_task_output_empty`), sin inventar una aprobación (§5.2).
> 3. No se comprobó la conexión con Freighter real ni contra el proyecto Supabase remoto mediante un navegador (§5.7).
> 4. El saldo continúa provisto por `SimulatedWalletBalanceAdapter`; una lectura real de Horizon por `fetch` queda como trabajo posterior (§5.3).
> 5. Estas limitaciones no autorizan a afirmar un merge en `main` ni una rehearsal remota.

## Addendum de reconciliación (2026-10-06)

No se agregó implementación nueva en este pase: se reconcilió el estado documental con la rama de integración actual `Vaqcrow#406_Feat_Connect_the_PyME_Freighter_wallet_before_review` en `0c740f8`. Los work units históricos que ya son ancestros de la base actual son: `7e75d5c` (migración + tabla de challenge), `d111ba4` (API, challenge firmado, perfil y destino congelado), `d208a50` (consumo antes de escritura y correcciones RDD), `578aa92` (adaptador Freighter, flujo de conexión, wallet card y cableado), `4128ad8` (pruebas adicionales) y `be6b758` (evidencia). La base también contiene `3d8553e` de #402, que aporta el enforcement server-side de `wallet_required`. No se realizó una rehearsal real con Freighter/navegador ni contra Supabase remoto; el saldo sigue simulado. GitHub cerró manualmente #407, #408, #409 y #406 el 2026-10-06. La documentación no afirma merge en `main`.
