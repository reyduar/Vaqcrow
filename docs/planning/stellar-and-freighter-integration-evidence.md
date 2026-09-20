# Evidencia de cierre de la Feature #23 — Issue #76

> Documento de cierre de Feature. Consolida y cita la evidencia ya verificada de las Tasks [#74](https://github.com/reyduar/Vaqcrow/issues/74) y [#75](https://github.com/reyduar/Vaqcrow/issues/75), agrega únicamente lo que ninguna de las dos documenta (el mapeo contra los criterios de aceptación propios de la Feature #23 y de sus tres Tasks, los límites operativos vigentes como conjunto, y las correcciones aplicadas durante el ciclo), y no re-deriva los números que ya quedaron asentados en la bitácora de iteración. No reemplaza a `odd/tasks/stellar-and-freighter-integration.md`, que sigue siendo la fuente de verdad de cómo se hizo el trabajo.

## 1. Contexto y objetivo

La Feature [#23](https://github.com/reyduar/Vaqcrow/issues/23) ("Feature: Encapsulate Stellar and Freighter integration") pide encapsular el contexto de Testnet, la obtención de cuenta pública y la firma no custodial. Sus tres criterios de aceptación son: que no exista una ruta de clave privada, que la red sea explícita, y que el rechazo sea recuperable.

Se entregó en tres Tasks, todas mergeadas y cerradas:

| Task | Issue | Entrega |
|---|---|---|
| Implementar | [#74](https://github.com/reyduar/Vaqcrow/issues/74) | PR [#191](https://github.com/reyduar/Vaqcrow/pull/191) y PR [#192](https://github.com/reyduar/Vaqcrow/pull/192) — commits `bee07a5`, `95ae734`, `a3c0d2b`, `d63390b`, `3dd563f`, `e83e8c0`, `ea4f2bf`; merges `72dc211` y `418bb20` |
| Probar | [#75](https://github.com/reyduar/Vaqcrow/issues/75) | PR [#193](https://github.com/reyduar/Vaqcrow/pull/193) — commits `20e4509`, `14ea664`, `c9dc5c3`, `7cadc53`, `6403c12`, `cc19106`; merge `24e1ed3` |
| Documentar evidencia | [#76](https://github.com/reyduar/Vaqcrow/issues/76) | este documento |

#74 se entregó como una **cadena de dos PRs apilados a `main`**: el adaptador de Freighter en `apps/web` (slice 1) y el adaptador de Horizon en `apps/api` (slice 2). El corte no fue cosmético — son dos workspaces aislados con dos SDKs distintos y sin dependencia entre ellos, así que ninguna slice toca un archivo de la otra y la revisión queda acotada a un workspace por vez.

La Feature se cierra manualmente al terminar #76 (GitHub no cierra Features al completarse sus sub-issues, mismo patrón que #11, #12, #13, #14, #15, #16, #17, #18 y #19). Al cerrarse habilita [#24](https://github.com/reyduar/Vaqcrow/issues/24) y [#28](https://github.com/reyduar/Vaqcrow/issues/28).

## 2. Cómo leer esta evidencia

- **Cada resultado nombra su fuente.** Las filas de la sección 4 se re-ejecutaron en este árbol de trabajo, o provienen de un run de CI citado con su identificador, o se midieron en el árbol de trabajo de la Task que las produjo — y cada fila dice cuál. Nada se infiere.
- **Comandos.** Requieren Node 24: `PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`. El repositorio activa `engine-strict`, así que cualquier otra versión corta la instalación.
- **Estado de merge.** Los tres PRs (#191, #192, #193) están **MERGED**; el estado de `main` sobre el que se re-ejecutó la sección 4 es `24e1ed3`.
- **Bitácora de iteración.** `odd/tasks/stellar-and-freighter-integration.md` es la bitácora de las tres Tasks: unidades de trabajo con hashes, ciclos RED→GREEN, decisiones, avisos y cómo se resolvió cada uno. Este documento la cita; no la reemplaza.
- **Documento operativo compañero.** `docs/planning/freighter-and-testnet-account-setup.md` es el runbook para preparar la billetera y la cuenta Testnet que el *preflight* manual necesita. Es el camino para ejecutar la verificación en Testnet que la sección 5 declara pendiente — no una condición para cerrar esta Feature.

## 3. Qué quedó implementado

**En `apps/web` — firma no custodial.** `wallet-port.ts` declara `WalletPort`, `WalletAccount` y `WalletError`, con `WalletFailureKind` = `rejected | unavailable | network_mismatch | unknown` y `recoverable` **derivado** del tipo (`kind !== "unknown"`), no afirmado en un comentario. `freighter-wallet.ts` es el adaptador real sobre `@stellar/freighter-api`, con la API inyectada para que un doble determinístico pueda ejercer cada rama. El workspace no importa ningún SDK de servidor: Freighter es su única superficie Stellar.

**En `apps/api` — consulta de cuentas públicas.** `ledger-port.ts` declara `LedgerPort` con un envelope de resultado (`{ ok: true, value } | { ok: false, error: { code } }`), siguiendo la convención que `ApplicationReviewRepositoryPort` ya estableció. `stellar-ledger.ts` envuelve `Horizon.Server`, se construye a partir de la configuración validada y expone la red a la que está atado. `stellar-amounts.ts` convierte el decimal de Horizon a stroops **sin pasar por punto flotante**: reensambla los dígitos como texto y parsea una sola vez con `BigInt`.

**La separación de SDKs está impuesta por máquina, no por convención.** `stellar-blockchain-requirements.md` (Parte 4 §2) exige que `@stellar/stellar-sdk` no exista en el frontend ni `@stellar/freighter-api` en el backend, y **antes de #75 ninguna regla lo verificaba**. Ahora hay dos reglas en `.dependency-cruiser.cjs` — `web-never-imports-server-stellar-sdk` y `api-never-imports-wallet-sdk` — con fixtures que prueban que disparan.

**La no custodia está verificada sobre el código.** `tests/stellar-non-custody.test.ts` recorre el AST de TypeScript de ambas apps y falla si alguna maneja material de clave.

Lo que agregó #75 son pruebas, reglas de frontera y un runbook: **ningún archivo de producción cambió de comportamiento**. Los únicos cambios en código no-test son las dos reglas de `.dependency-cruiser.cjs` y las correcciones de defectos que se detallan en la sección 7.

## 4. Qué quedó probado

| Verificación | Resultado observado | Fuente |
|---|---|---|
| `pnpm run verify` | Exit 0: lint, typecheck, test, build, boundaries, test:boundaries | Re-ejecutado en este árbol sobre `24e1ed3` |
| Boundaries | `no dependency violations found (227 modules, 529 dependencies cruised)` | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/domain test` | 1 archivo, 60 tests | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/contracts test` | 5 archivos, 101 tests | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/api test` | 10 archivos, 180 tests (163 antes de #74 + 15 de los adaptadores de #74 + 2 de #75) | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/web test` | 59 archivos, 330 tests (328 antes de #75 + 2 de #75) | Re-ejecutado en este árbol |
| `pnpm run test:boundaries` (suite raíz) | 5 archivos, 65 tests (52 antes de #75 + 5 de la separación de SDKs + 8 del escáner de no custodia) | Re-ejecutado en este árbol |
| RED de la slice 1 (adaptador Freighter) | 12 tests fallando, todos `Error: not implemented` desde el stub | Árbol de trabajo de #74 |
| GREEN de la slice 1 | 12/12 pasando; sin debilitar ninguna aserción | Árbol de trabajo de #74 |
| RED de la slice 2 (adaptador Horizon) | 8 tests fallando, `ledger.getAccount is not a function` | Árbol de trabajo de #74 |
| GREEN de la slice 2 | 15/15 pasando | Árbol de trabajo de #74 |
| RED de la separación de SDKs | 2 fallos: `expected 0 to be greater than or equal to 1` — los fixtures cruzaban la frontera y nada lo prohibía | Árbol de trabajo de #75 |
| GREEN de la separación de SDKs | 57/57 pasando, y `boundaries` limpio sobre el código real | Árbol de trabajo de #75 |
| **Anti-vacuidad de la separación de SDKs** | Un test afirma que **ambos** SDKs resuelven realmente desde `apps/*/src` a través de `node_modules`, así que las reglas juzgan dependencias reales y no patrones que dejaron de matchear | Re-ejecutado en este árbol |
| **Precisión del escáner de no custodia** | `Keypair.fromPublicKey` **no** se marca (la verificación de firmas contra claves públicas es trabajo legítimo de #24); prosa y patrones de redacción que nombran estas claves tampoco | Re-ejecutado en este árbol |
| **Anti-vacuidad del escáner de no custodia** | El escáner se apunta a las fuentes Stellar reales y se afirma que las encontró (>40 archivos, incluidos `stellar-ledger.ts` y `freighter-wallet.ts`), así que un resultado limpio significa algo | Re-ejecutado en este árbol |
| **El escáner de texto era inútil** | Marcaba el propio patrón de `redaction.ts` (que lista `privatekey`/`mnemonic` como claves a enmascarar) y el propio comentario del adaptador que dice que nunca pide una seed. Se reescribió sobre el AST, que no ve comentarios ni literales de regex | Árbol de trabajo de #75 |
| Passphrase declarada vs. la del SDK | `STELLAR_TESTNET_NETWORK_PASSPHRASE === Networks.TESTNET` | `stellar-ledger.test.ts`, re-ejecutado en este árbol |
| Run de CI `35534904962` (PR #191, `a3c0d2b`) | `success` | GitHub Actions |
| Run de CI `35535173609` (PR #192, `e83e8c0`) | `success` | GitHub Actions |
| Run de CI `35535341124` (PR #192, `ea4f2bf`) | `success` | GitHub Actions |
| Run de CI `35536445006` (PR #191, merge `72dc211`) | `success` | GitHub Actions |
| Run de CI `35536652676` (push a `main`, `418bb20`) | `success` | GitHub Actions |
| Run de CI `35537237212` (PR #193, `6403c12`) | `success` | GitHub Actions |
| Run de CI `35537445482` (PR #193, `cc19106`) | `success` | GitHub Actions |
| Run de CI `35537583036` (push a `main`, `24e1ed3`) | `success` | GitHub Actions |
| Escaneo local de patrones sobre este documento y el runbook | Sin hallazgos: sin seed de Stellar (`S` + 55 base32), sin JWT, sin bloque de clave privada, sin dirección `G` real. El único match del patrón de 40+ caracteres es el identificador de la extensión dentro de la URL del Chrome Web Store (`bcacfldlkkdogcmkkibnjlakofdplcbk`), no un token. El escáner de secretos de GitHub no está disponible porque el repositorio no tiene Advanced Security, así que este resultado proviene de un escaneo de patrones ejecutado localmente, no del escáner de la plataforma | Re-ejecutado en este árbol |

El escáner de no custodia y las dos reglas de frontera **no se declaran: se ejercen**. Un escáner que deja de matchear en silencio es el modo de falla real, así que los tres tienen un test que prueba que encuentran algo, y el escáner tiene además un test que prueba que **no** marca lo que debe dejar pasar.

## 5. Límites operativos vigentes

- **El *bounded Testnet check* no se ejecutó, y el gate de preparación de #74 nunca se cumplió.** Son dos hechos distintos y conviene no mezclarlos:
  1. **El gate de preparación quedó sin cumplir.** `stellar-blockchain-requirements.md` (Parte 3 §3.a) exige, *antes de empezar* #74, seis condiciones —entre ellas que Freighter esté instalado y configurado en Testnet con una cuenta descartable fondeada (condición 2) y que la lista de seguridad de la Parte 2 §8 esté firmada (condición 6)—. **Ninguna de esas dos se satisfizo** antes de #74, y el trabajo se hizo igual. Es una **desviación de proceso**, no un criterio de aceptación incumplido: el gate regula cuándo puede iniciarse una Task, y este documento la registra como tal en lugar de omitirla.
  2. **La verificación en Testnet no se ejecutó.** La estrategia de pruebas de #23 pide "Freighter double plus bounded Testnet check", y el *preflight* de la Parte 3 §1.b necesita la cuenta que la condición 2 describe. No existe ninguna observación en vivo.

  Todo lo que prueba la sección 4 corre sin Testnet, Horizon ni billetera: son dobles y fixtures determinísticos. Este documento **no declara** una observación en vivo que no existe, y es la razón por la que el *Definition of Done* de #23 se apoya en su cláusula de límites documentados. El runbook de `freighter-and-testnet-account-setup.md` es el camino para ejecutar lo que falta.
- **El origen de la passphrase que el navegador enviará a Freighter todavía no está cableado.** `WalletPort.signTransaction` la exige y **nadie llama al puerto**: la Feature [#24](https://github.com/reyduar/Vaqcrow/issues/24) decide si la app web la aprende de la respuesta del backend o de su propia configuración. La invariante que sí importa quedó fijada — la passphrase declarada por la API es igual a `Networks.TESTNET` — pero la costura entre los dos workspaces es de #24, no de esta Feature.
- **La UI muestra un solo estado de falla.** `workspace-status.tsx` distingue `connected` de `connection failed`, pero no distingue un rechazo de una billetera ausente, aunque el adaptador sí los clasifique. Llevar `WalletError.kind` a copy diferenciado pertenece a la Feature [#30](https://github.com/reyduar/Vaqcrow/issues/30). El criterio "el rechazo es recuperable" se sostiene igual: el fallo se recupera genéricamente y la persona puede reintentar.
- **El tipo `unknown` agrupa causas que no son recuperables por motivos distintos.** Una passphrase vacía es un error de quien llama, y una respuesta sin dirección es una billetera que contestó mal; ambas quedan en `unknown` con `recoverable: false`. Es correcto (ninguna se arregla reintentando) pero el llamador no puede distinguirlas entre sí. Si #24 necesita esa distinción, se agrega un kind entonces.
- **El escáner de no custodia es una verificación de código fuente, no una garantía de runtime.** Prueba que no hay constructores de clave, identificadores de material de clave ni seeds literales en las apps. No puede probar que un valor secreto no llegue por una ruta que el código no expresa — por ejemplo, una dependencia transitiva. Es la forma exigible del criterio, y su precisión está probada por tests.
- **`tests/**` de la raíz no pasa por typecheck ni lint.** No hay `tsconfig.json` raíz, y `turbo run lint` / `turbo run typecheck` solo recorren workspaces; los archivos nuevos de la suite raíz **se ejecutan** vía `test:boundaries` pero nunca se analizan estáticamente. Es el hueco del gate registrado en [#189](https://github.com/reyduar/Vaqcrow/issues/189); no se expandió el alcance acá.
- **Sin umbrales de cobertura.** Los gates exigen que los tests pasen, no un porcentaje. Decisión heredada del repositorio, no de esta Feature.

## 6. Resultado visible en la demo

El cambio visible es acotado y honesto: el componente de shell pasó de ser un placeholder que tiraba `not implemented` a poder conectar con Freighter de verdad, mostrando `connected` cuando la billetera concede acceso y `connection failed` cuando no.

El resultado más importante es de proceso, no de pantalla: **una billetera ausente ya no cuelga la interfaz**. Antes del cambio, `requestAccess()` no resolvía nunca sin extensión instalada y el botón quedaba en `connecting` para siempre; ahora falla de forma recuperable y nombrable. El *fallback* "Freighter no disponible" que `DEMO.md` declara como aceptable depende exactamente de eso.

El flujo de fondeo y el de distribución **no** cambian con esta Feature: son [#24](https://github.com/reyduar/Vaqcrow/issues/24) y [#28](https://github.com/reyduar/Vaqcrow/issues/28). Lo que esta Feature entrega es el suelo sobre el que esos dos se apoyan: adaptadores propios, red explícita y ninguna ruta de clave privada.

## 7. Correcciones aplicadas durante el ciclo

1. **Un defecto de producto encontrado por el gate completo, no por un test.** Al implementar el adaptador, `workspace-status.test.tsx` falló. No era una expectativa vieja: el componente ejercía el adaptador **real**, y `@stellar/freighter-api` fija un timeout de 2 s para `isConnected` pero **ninguno** para `requestAccess`, que solo resuelve cuando la extensión contesta. Sin extensión, `connect()` no terminaba nunca. Se corrigió probando disponibilidad antes de pedir acceso, y el componente ahora recibe el puerto inyectado para que su test use un doble determinístico.
2. **El SDK rechaza una URL de Horizon por HTTP plano.** `new Horizon.Server("http://…")` lanza `Cannot connect to insecure horizon server` salvo que se pase `allowHttp`. Eso chocaba de frente con #14, que **admite explícitamente** un Horizon loopback por HTTP para un doble local: los dos guards se contradecían. El adaptador deriva `allowHttp` del esquema. Lo encontró un test por construir el cliente real en vez de un doble.
3. **Una aserción propia que estaba mal.** `Number("9223372036854775807") === 9223372036854775807` es `true`, porque el literal numérico ya está redondeado al mismo double; la aserción no probaba nada. Se reescribió comparando `BigInt(Number(...))` contra el valor exacto.
4. **El escáner de no custodia, escrito primero sobre texto, era inútil.** Marcaba el patrón de claves sensibles de `redaction.ts` y el comentario del adaptador que dice que nunca pide una seed. Se reescribió sobre el AST de TypeScript.
5. **Una aserción de largo en un seed sintético.** El literal de prueba tenía 57 caracteres en vez de 56 (`S` + 55 base32), así que no matcheaba el patrón que el test decía verificar. Corregido el literal, no el patrón.

## 8. Mapeo de criterios de aceptación

Criterios citados verbatim de `gh issue view 23`, `74`, `75` y `76`.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | #23: "No private key path exists" | Cumplido | El adaptador de Freighter solo maneja dirección pública y XDR; `LedgerPort` no tiene forma de representar material de clave; `tests/stellar-non-custody.test.ts` recorre el AST de ambas apps y no encuentra constructores de clave, identificadores de secreto ni seeds literales. Sección 4; precisión del escáner probada con `Keypair.fromPublicKey` |
| 2 | #23: "network is explicit" | Cumplido | `signTransaction` exige la passphrase sin default y rechaza una vacía; verifica la red de la billetera **antes** de pedir firma; el adaptador de Horizon se construye desde la configuración cerrada a Testnet y expone la red a la que está atado; un test fija la passphrase igual a `Networks.TESTNET`. Secciones 3 y 4 |
| 3 | #23: "rejection is recoverable." | Cumplido | `recoverable` se deriva del tipo (`kind !== "unknown"`), así que `rejected` es recuperable por construcción; un test ejercita rechazo y reintento exitoso sobre el mismo adaptador; el shell ya no cuelga ante una billetera ausente. Secciones 4 y 7.1; el copy diferenciado queda como límite en la sección 5 |
| 4 | #74: "Feature #23 behavior is implemented within its documented boundary." | Cumplido | Adaptadores propios en `infrastructure/`; `application/` sin SDKs de proveedor; la separación de SDKs está impuesta por dos reglas de dependency-cruiser con anti-vacuidad. Sección 3 |
| 5 | #74: "Encapsulate Stellar SDK, Freighter, and Horizon behind owned adapters, pass the explicit Testnet passphrase for signing, and never request or store user seeds." | Cumplido | `FreighterWallet` sobre `@stellar/freighter-api`, `StellarLedger` sobre `@stellar/stellar-sdk` + Horizon, ambos detrás de puertos propios; la passphrase se pasa explícita en cada firma; ningún camino pide ni guarda una seed. Secciones 3 y 4 |
| 6 | #74: "Failure paths remain truthful and do not weaken security or human-control boundaries." | Cumplido | Una respuesta malformada de Horizon **no** se disfraza de `unavailable`; una billetera que contesta mal queda como no recuperable; una red distinta se detecta antes de pedir aprobación humana; el backend no puede firmar nada. Secciones 4 y 5 |
| 7 | #75: "Deterministic tests demonstrate the core behavior of Feature #23." | Cumplido | 12 tests del adaptador de Freighter, 15 del de Horizon y montos, 5 de la separación de SDKs y 8 del escáner de no custodia; todos con dobles y fixtures. Sección 4 |
| 8 | #75: "Validation, rejection, and fallback behavior is covered where applicable." | Cumplido | Validación: passphrase vacía, red distinta, monto malformado. Rechazo: firma rechazada, acceso rechazado. Fallback: billetera ausente, sonda que falla, Horizon inalcanzable, cuenta no fondeada, respuesta sin saldo nativo. Sección 4 |
| 9 | #75: "The focused suite passes without live external services or sensitive data." | Cumplido | Ningún test toca Testnet, Horizon ni una billetera; las 8 filas de CI de la sección 4 corren sin servicios vivos; toda fixture es sintética y literal |
| 10 | #76: "Evidence identifies Feature #23, verification commands, and observed results." | Cumplido | Este documento: secciones 1, 4 y 8 |
| 11 | #76: "Evidence is traceable to implementation and focused tests." | Cumplido | Cada fila de la sección 4 nombra su comando, su run de CI o el árbol donde se midió; los hashes de commit y los merges están en la sección 1 |
| 12 | #76: "Sensitive data and unsupported production claims are excluded." | Cumplido | Escaneo de contenido sensible limpio; ninguna afirmación de producción; el único resultado externo no ejecutado (el *bounded Testnet check*) se declara como no ejecutado en la sección 5 |

## 9. Riesgos y limitaciones aceptadas

1. **Gate de skills/MCP, registrado antes de tocar cualquier manifest o lockfile.** Para #74 **se mutaron dos manifiestos y el lockfile**, así que el gate aplicó: `skill_resolution: skill-registry`, con las skills `dapp` (cliente/SDK de Stellar y adaptador de Freighter) y `data` (consulta de Horizon) cargadas desde `.atl/skill-registry.md` antes de escribir código en cada área. `mcp_support: none`. Para #75 y #76 no se agregó ninguna dependencia y no se mutó ningún lockfile.
2. **La separación de SDKs se apoya en el nombre del paquete, no en su identidad.** Las reglas prohíben `@stellar/stellar-sdk` y `@stellar/freighter-api` por ruta de `node_modules`. Un paquete distinto que reexportara el SDK no quedaría cubierto. Es el mismo tipo de límite que el guard de Horizon de #14, y se acepta por el alcance de la demo.
3. **El escáner de no custodia no cubre dependencias transitivas.** Ver la sección 5.
4. **La verificación de la red de la billetera depende de lo que la billetera declara.** El adaptador compara `getNetwork().networkPassphrase` con la passphrase esperada; si una billetera mintiera sobre su red, la comparación no lo detectaría por sí sola. La revalidación del XDR firmado pertenece a #24 y es la defensa real.
5. **Los límites de la sección 5 son aceptados, no resueltos:** el *bounded Testnet check* sin ejecutar, la costura de la passphrase para #24, el copy diferenciado para #30, y `tests/**` fuera del análisis estático (#189).

## 10. Estado de entrega

- **#74** y **#75** están **CLOSED**; los PRs [#191](https://github.com/reyduar/Vaqcrow/pull/191), [#192](https://github.com/reyduar/Vaqcrow/pull/192) y [#193](https://github.com/reyduar/Vaqcrow/pull/193) están **MERGED** en `main`, cuyo estado verificado es `24e1ed3`.
- **#76** se cierra con este documento. **La Feature #23 queda pendiente de cierre manual** en el momento de escribir esto: GitHub no la cierra al completarse sus sub-issues, igual que ocurrió con las Features #11, #12, #13, #14, #15, #16, #17, #18 y #19. Se cerrará al mergear este PR, no antes.
- `docs/planning/demo-tasks-list.md` **no se toca en este cambio**, siguiendo el precedente de #62 y #179: el sync del roadmap pertenece a un commit posterior, cuando la Feature esté efectivamente cerrada.
- Al cerrarse, esta Feature habilita [#24](https://github.com/reyduar/Vaqcrow/issues/24) (construir, verificar y enviar la intención de fondeo) y [#28](https://github.com/reyduar/Vaqcrow/issues/28) (firmar y distribuir el revenue share en Testnet).
