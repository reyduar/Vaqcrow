# Evidencia de cierre de la Feature #238 — Issue #241

> Documento de cierre de Feature. Consolida y cita la evidencia ya verificada de las Tasks [#242](https://github.com/reyduar/Vaqcrow/issues/242) y [#243](https://github.com/reyduar/Vaqcrow/issues/243), agrega únicamente lo que ninguna de las dos documenta (el mapeo contra los criterios de aceptación propios de la Feature [#238](https://github.com/reyduar/Vaqcrow/issues/238) y de sus tres Tasks, los límites operativos vigentes como conjunto, y las correcciones aplicadas durante el ciclo), y no re-deriva los números que ya quedaron asentados en la bitácora de iteración. No reemplaza a [`odd/tasks/soroban-campaign-vault-decision.md`](../../odd/tasks/soroban-campaign-vault-decision.md), que sigue siendo la fuente de verdad de cómo se decidió el enfoque.

## 1. Contexto y objetivo

La Feature [#238](https://github.com/reyduar/Vaqcrow/issues/238) ("Feature: Provision the Soroban toolchain and reproducible deployment") es la **primera de las cinco Features del Epic [#235](https://github.com/reyduar/Vaqcrow/issues/235)** y **bloquea a todas las demás**: sin toolchain no hay contrato, y sin contrato no hay camino de fondeo. El Epic declara esa dependencia explícitamente.

Es la primera Feature del proyecto que **no es TypeScript**. El fondeo dejó de ser un pago clásico y pasó a estar custodiado por un contrato; la decisión, el descarte de Claimable Balance y la máquina de estados están en [`stellar-blockchain-requirements.md`](./stellar-blockchain-requirements.md).

Se entregó en tres Tasks:

| Task | Issue | Entrega |
|---|---|---|
| Instalar y verificar el toolchain | [#242](https://github.com/reyduar/Vaqcrow/issues/242) | **Sin artefacto versionado**: es una instalación de entorno. La verificación de sus criterios vive en el [comentario de #242](https://github.com/reyduar/Vaqcrow/issues/242#issuecomment-5786984840) |
| Red local y despliegue reproducible | [#243](https://github.com/reyduar/Vaqcrow/issues/243) | PR [#262](https://github.com/reyduar/Vaqcrow/pull/262) — commit `3b16993`, merge `9730e0d` |
| Documentar evidencia | [#241](https://github.com/reyduar/Vaqcrow/issues/241) | este documento |

**Ubicación decidida: `contracts/` en la raíz del repositorio.** Era una decisión abierta P1 registrada en `demo-tasks-list.md` ("Definir la ubicación del workspace Rust del contrato y si `dependency-cruiser` lo cubre") y este trabajo la necesitaba, así que se tomó acá y no se postergó. Queda **fuera del workspace de pnpm** a propósito: turbo no lo construye y los globs de `dependency-cruiser` (`apps/*/src`, `packages/*/src`) no lo alcanzan — de ahí que tenga job de CI propio. No se reutiliza `packages/contracts`, que es TypeScript y contiene contratos de API.

La Feature se cierra manualmente al terminar #241 (GitHub no cierra Features al completarse sus sub-issues, mismo patrón que #11 a #19 y #23). Al cerrarse habilita [#236](https://github.com/reyduar/Vaqcrow/issues/236), el contrato de bóveda real.

## 2. Cómo leer esta evidencia

- **Cada resultado nombra su fuente.** Las filas de la sección 4 se re-ejecutaron en este árbol de trabajo, o provienen de un run de CI citado con su identificador, o se midieron en el árbol de la Task que las produjo — y cada fila dice cuál. Nada se infiere.
- **Comandos.** Requieren Node 24: el repositorio activa `engine-strict` y corta cualquier otra versión. El detalle de cómo se resolvió eso en esta máquina está en la sección 7.
- **Estado de merge.** El PR [#262](https://github.com/reyduar/Vaqcrow/pull/262) está **MERGED**; el estado de `main` sobre el que se re-ejecutó la sección 4 es `9730e0d`.
- **Bitácora de iteración.** [`odd/tasks/soroban-campaign-vault-decision.md`](../../odd/tasks/soroban-campaign-vault-decision.md) es la bitácora de la decisión de alcance que originó esta Feature: decisiones, avisos y cómo se resolvió cada uno. Este documento la cita; no la reemplaza.
- **Documento operativo compañero.** [`contracts/README.md`](../../contracts/README.md) es el runbook del workspace: toolchain, red local, comandos y el procedimiento de redeploy/reseed tras un reset de Testnet.

## 3. Qué quedó implementado

**En la máquina de desarrollo — el toolchain.** Rust por `rustup` con `rustc` 1.98.1, el target `wasm32v1-none`, y Stellar CLI 28.0.0 por Homebrew. Nada de esto estaba instalado antes de #242; el inventario previo lo registró como ausente.

**En `contracts/` — el workspace Rust.**

| Archivo | Qué hace |
|---|---|
| `Cargo.toml` | Workspace con `members = ["campaign-vault"]` y **`soroban-sdk = "28"`** |
| `rust-toolchain.toml` | Fija `channel = "1.98.1"` y `targets = ["wasm32v1-none"]` |
| `.gitignore` | Ignora `target`, `.soroban` y `.stellar` |
| `campaign-vault/` | Contrato **placeholder** con `__constructor(goal)`, `goal()` y 2 tests |
| `scripts/local-network.sh` | `start` / `stop` / `network-add` de la red local |
| `scripts/deploy-local.sh` | Build, test, sha256 del Wasm y despliegue |
| `README.md` | Toolchain, red local, comandos y el procedimiento de reset |

**`campaign-vault` es un placeholder, no la bóveda.** Existe para que el workspace, el compilador, el target, el `__constructor`, los tests, el despliegue y el job de CI queden probados de punta a punta. Lo que el placeholder **sí** prueba y #244 debe conservar: que el workspace compila para `wasm32v1-none` contra `soroban-sdk` 28, que el `__constructor` corre una sola vez, y que el contrato se despliega y es invocable. La máquina de estados real —custodia, pago atómico al alcanzar el objetivo, retiro, reembolsos y barrido— es [#244](https://github.com/reyduar/Vaqcrow/issues/244).

**En `.github/workflows/ci.yml` — un job nuevo.** `Contracts (build, test, deploy on a local network)` es el tercer job del workflow. Instala el toolchain desde una action, levanta la red local con la Action oficial `stellar/quickstart` en su tag `testing`, resuelve el pin de `rust-toolchain.toml`, registra la red, y corre el script de despliegue. **No toca Testnet y no necesita ningún secreto**, igual que los otros dos jobs.

**El `soroban-sdk` está fijado en 28 a propósito.** El major del SDK sigue a la versión del protocolo, y el protocolo vivo en Testnet y Mainnet es **28** (verificado con `getVersionInfo`). El scaffold de `stellar contract init` todavía genera `soroban-sdk = "27"`, **un major atrás**: subirlo es un requisito explícito de #244 y quedó comentado en el `Cargo.toml` para que nadie lo baje "para coincidir con el scaffold".

## 4. Qué quedó probado

| Verificación | Resultado observado | Fuente |
|---|---|---|
| `rustup --version` | `rustup 1.29.1 (d95a37b6a 2026-08-13)` | Comentario de #242 |
| `rustc --version` | `rustc 1.98.1 (48a229cea 2026-09-01)` | Comentario de #242 |
| `cargo --version` | `cargo 1.98.1 (797e8a9bc 2026-08-05)` | Comentario de #242 |
| `rustup target list --installed` | `aarch64-apple-darwin`, `wasm32v1-none` | Comentario de #242 |
| `rustup target list \| grep wasm32v1-none` | `wasm32v1-none (installed)` | Comentario de #242 |
| `stellar version` | `stellar 28.0.0 (300aaf69…)`, `stellar-xdr 28.0.0` | Comentario de #242 |
| Protocolo vivo de Testnet y Mainnet | `protocolVersion: 28` en ambas redes | `getVersionInfo` por RPC |
| Smoke del toolchain: `stellar contract init` + `build` | `hello_world.wasm`, 583 bytes, hash `32e1f4e2…` en 47.87s | Comentario de #242, directorio temporal |
| **Anti-vacuidad del smoke** | Dos builds independientes dieron el **mismo hash de Wasm** | Comentario de #242 |
| Red local: `getHealth` | `"status":"healthy"` | `scripts/local-network.sh start`, re-ejecutado en este árbol |
| Red local: `getVersionInfo` | `version: 28.0.1`, **`protocolVersion: 28`**, `captiveCoreVersion v28.0.1` | Re-ejecutado en este árbol |
| Red local: límites | Los logs registran `upgrades: soroban config 'testnet' limits` | Re-ejecutado en este árbol |
| Red local: Horizon y Friendbot | Horizon responde en `/`; Friendbot fondea y devuelve hash | Re-ejecutado en este árbol |
| `stellar contract build` (workspace real) | `campaign_vault.wasm`, **1200 bytes**, hash `de1788024d6ff61db74bd236bf0b30b707c747892ed08efa0644023aaa084af5`, 2 funciones exportadas | `scripts/deploy-local.sh`, re-ejecutado en este árbol |
| `cargo test` (workspace real) | `test result: ok. 2 passed; 0 failed` | `scripts/deploy-local.sh`, re-ejecutado en este árbol |
| **Reproducibilidad del build del contrato** | El script imprime el sha256 y despliega **ese mismo hash**: `de1788024d6ff6…` | `scripts/deploy-local.sh`, re-ejecutado en este árbol |
| `stellar contract deploy --network local` | `✅ Deployed! CB5SEOZEPMNFYEJO3TXUQOQOP5HUL7DBE7LIUAE626DHX5RXOD4ZPB5H` | Re-ejecutado en este árbol |
| `stellar contract invoke --id campaign-vault --network local -- goal` | `"1000"` | Re-ejecutado en este árbol |
| `pnpm run verify` | Exit 0: lint, typecheck, test, build, boundaries, test:boundaries | Re-ejecutado en este árbol sobre `9730e0d` |
| Boundaries | `no dependency violations found (311 modules, 840 dependencies cruised)` | Re-ejecutado en este árbol |
| Suite raíz (`test:boundaries`) | 6 archivos, **75 tests** | Re-ejecutado en este árbol |
| Run de CI `35805468278` (PR #262, `3b16993`) | `success` — los tres jobs, incluido `Contracts` | GitHub Actions |
| Run de CI `35806838570` (push a `main`, merge `9730e0d`) | `success` | GitHub Actions |
| **Anti-vacuidad del job de contratos** | El job nuevo corrió y pasó **en GitHub Actions**, no solo local: instala el toolchain, levanta la red, registra, construye, testea y despliega | Runs `35805468278` y `35806838570` |

El smoke del toolchain y el build del contrato real se hicieron en **directorios temporales fuera del repositorio**, y se borraron después. El `contracts/target/` local pesa ~1.3 GB y no se versiona.

## 5. Límites operativos vigentes

- **El despliegue en Testnet no se ejecutó.** No existe ninguna dirección ni ningún hash de contrato en Testnet. **Todo lo que prueba la sección 4 corre contra la red local.** El criterio de #241 lo admite explícitamente por su segunda vía —"evidenciado o declarado como limitación acotada"— y este documento toma esa vía: **no declara una observación en vivo que no existe**. El procedimiento para producirla está en [`contracts/README.md`](../../contracts/README.md), y es trabajo de la evidencia de #236, no de esta Feature.
- **La red local no es un sustituto de Testnet para la evidencia.** Corre la misma versión de protocolo y emula los límites de Testnet, pero **no es pública**: nadie de afuera puede verificarla. Para desarrollo y CI es superior —no se resetea, despliega al instante y es determinista—; para la evidencia de la demo no sirve.
- **El procedimiento de redeploy/reseed tras un reset de Testnet está documentado, pero no ejercitado.** Nunca ocurrió un reset desde que existe el contrato. El criterio pide documentarlo y eso está cumplido; que el procedimiento funcione es una inferencia razonable, no una observación.
- **El contrato es un placeholder.** No hay custodia, ni objetivo, ni pago atómico, ni reembolsos. Nada de lo que prueba esta Feature dice nada sobre la corrección de la bóveda: prueba que **el andamio funciona**.
- **`dependency-cruiser` no cubre el código Rust.** Las reglas de frontera del repositorio se aplican sobre `apps/*/src` y `packages/*/src`, así que el contrato queda **fuera de esa verificación automática**. Su frontera se sostiene por convención y por el job de CI propio (build, tests, tamaño del Wasm), no por `pnpm run boundaries`. Extender las reglas al directorio Rust sigue siendo una decisión abierta, y corresponde a #244.
- **El job de CI depende de actions de terceros.** `dtolnay/rust-toolchain` no es una action de GitHub ni de Stellar Foundation. Se usa porque el workflow **no puede referenciar un endpoint externo** (sección 7.4) y esa action resuelve el toolchain sin URL. Las otras dos —`stellar/stellar-cli` y `stellar/quickstart`— sí son oficiales.
- **No hay auditoría ni controles de emergencia.** Un contrato que custodia fondos y va a producción los exige. Esta Feature no custodia nada todavía; la decisión sobre actualizabilidad y pausa pertenece a #244 y quedó registrada como decisión abierta en `DEMO.md`.
- **Sin umbrales de cobertura.** Los gates exigen que los tests pasen, no un porcentaje. Decisión heredada del repositorio, no de esta Feature.

## 6. Resultado visible en la demo

**Ninguno, y conviene decirlo así.** Esta Feature no cambia nada de lo que se ve: no hay pantalla nueva, ni contrato en Testnet, ni campaña. Es infraestructura.

Lo que sí cambia es la capacidad de construir lo que se va a ver: existe el carril de contratos, existe la red local para iterar sin depender de Testnet, existe un despliegue reproducible, y existe un job de CI que impide que ese carril se rompa en silencio. El flujo de fondeo que `DEMO.md` describe sigue sin funcionar por contrato — eso es #236 y #237.

## 7. Correcciones aplicadas durante el ciclo

1. **`--enable-stellar-rpc` no existe.** El primer intento de levantar la red local siguió el ejemplo de la documentación oficial de Stellar y el contenedor **salió con `Unknown container arg --enable-stellar-rpc`**, sin arrancar nada. `--local` solo ya levanta core, Horizon, Stellar RPC y Friendbot. Quedó documentado en `contracts/README.md` y comentado en el script para que no se repita.
2. **Los argumentos del constructor van con `=`.** La ayuda de la CLI documenta `--arg-name value`, separado por espacio, y esa forma **falla** con `unexpected argument`. La que funciona es `--goal=1000`. El script además tolera un `--` inicial, porque pasárselo al script en vez de a la CLI hacía que el `--` viajara como argumento del constructor.
3. **`stellar contract init` fija `soroban-sdk = "27"`, un major atrás del protocolo vivo.** El scaffold no lo hace bien para la red actual. Se sube a 28 y se comenta el motivo en el `Cargo.toml`.
4. **El propio gate del repositorio encontró una violación real, dos veces.** `tests/testing-and-ci-gates.test.ts` afirma que el workflow de CI no puede contener `secrets.` ni `https?://`. El primer intento instalaba Rust con un script de arranque de rustup y **falló el test**; se reemplazó por una action. El segundo intento **volvió a fallar** porque la URL había quedado en un **comentario**, y el test lee el archivo crudo. Ninguna de las dos fue un falso positivo: el límite es real y está ahora comentado en el workflow.
5. **El `.gitignore` del scaffold ignora `target`, `.soroban` y `.stellar`, pero no `test_snapshots`.** Esos snapshots son golden files del framework de pruebas del SDK y van versionados; el `.gitignore` del workspace se alineó con el del scaffold en lugar de inventar una regla propia.
6. **El Node del entorno no coincidía con el que el repositorio exige, en ninguno de los dos shells.** El repo pide `>=24 <25` y activa `engine-strict`. En esta máquina convivían tres Node: el de Homebrew (26.8.1) lo agarraba un shell **no interactivo** y el default de nvm (20.19.0) un shell **interactivo** — ninguno era el 24. Se corrigió con `nvm alias default 24` y con `brew link --overwrite --force node@24`, y el gate corre en ambos. Se verificó además que **Node 26 no rompe el proyecto** (75 tests y las fronteras pasan bajo 26): el bloqueo era política del repositorio, no incompatibilidad, y el techo `<25` no tiene un motivo técnico documentado.

## 8. Mapeo de criterios de aceptación

Criterios citados verbatim de `gh issue view 238`, `242`, `243` y `241`.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | #238: "`rustc --version`, `rustup target list` and `stellar version` are recorded as evidence" | Cumplido | Sección 4, filas 2, 5 y 6; registrado en el comentario de #242 |
| 2 | #238: "The local network starts and a throwaway contract deploys to it" | Cumplido | Sección 4, filas 10 a 16: la red levanta sana y el contrato se despliega con dirección `CB5SEOZE…` |
| 3 | #238: "A CI job builds the contract without reaching Testnet" | Cumplido | Sección 3: el job `Contracts` corre contra la red local; sección 4: runs `35805468278` y `35806838570` en `success`. El workflow no referencia ningún endpoint externo ni secreto, y hay un test que lo impone |
| 4 | #238: "The deployment script is committed and reproducible" | Cumplido | `contracts/scripts/deploy-local.sh`, modo `755`; sección 4: el script imprime el sha256 y despliega ese mismo hash. Dos builds independientes coincidieron |
| 5 | #238: "The pinned `soroban-sdk` major is justified against the live protocol version" | Cumplido | Sección 3: fijado en 28 contra `protocolVersion: 28` verificado por `getVersionInfo`; el scaffold genera 27 y se documenta por qué se sube |
| 6 | #242: "`command -v rustup && rustup --version` recorded" | Cumplido | Sección 4, fila 1; comentario de #242 |
| 7 | #242: "`command -v rustc && rustc --version` recorded, at 1.84.0 or higher" | Cumplido | Sección 4, fila 2: `rustc 1.98.1`, muy por encima del piso de 1.84.0 |
| 8 | #242: "`rustup target list` shows `wasm32v1-none (installed)`" | Cumplido | Sección 4, fila 5 |
| 9 | #242: "`stellar version` recorded and matching protocol 28" | Cumplido | Sección 4, filas 6 y 7: CLI 28.0.0 contra protocolo 28 en ambas redes |
| 10 | #242: "The installed versions are written into the evidence document" | Cumplido | Sección 4, filas 1 a 6 de este documento |
| 11 | #243: "The local network starts and a throwaway contract deploys to it" | Cumplido | Sección 4, filas 10 a 16 |
| 12 | #243: "`stellar contract invoke` works against the local network" | Cumplido | Sección 4, fila 18: la invocación devuelve `"1000"` |
| 13 | #243: "A committed script rebuilds and redeploys reproducibly" | Cumplido | Sección 4, filas 14, 15 y 17 |
| 14 | #243: "The CI job builds and tests the contract with no Testnet access" | Cumplido | Sección 4, fila 16: `cargo test` corre dentro del script de CI; los runs citados no tocan Testnet |
| 15 | #243: "The redeploy-and-reseed procedure after a Testnet reset is documented" | Cumplido | [`contracts/README.md`](../../contracts/README.md), sección "Procedimiento tras un reset de Testnet", con la fecha del próximo reset. **No ejercitado**: ver sección 5 |
| 16 | #241: "The evidence document exists under `docs/planning/` and is written in Spanish" | Cumplido | Este documento |
| 17 | #241: "Installed versions are recorded with the command output" | Cumplido | Sección 4, filas 1 a 6, con la salida literal de cada orden |
| 18 | #241: "The local-network deploy is evidenced with an address and a hash" | Cumplido | Sección 4, filas 14 y 17: dirección `CB5SEOZEPMNFYEJO3TXUQOQOP5HUL7DBE7LIUAE626DHX5RXOD4ZPB5H` y hash `de1788024d6ff6…` |
| 19 | #241: "The Testnet result is either evidenced or declared as a bounded limitation" | Cumplido | Por la **segunda** vía: sección 5 lo declara como límite acotado. No se ejecutó ningún despliegue en Testnet y este documento no afirma que exista |
| 20 | #241: "The CI reference is recorded" | Cumplido | Sección 4: runs `35805468278` (PR) y `35806838570` (`main`), ambos `success` |

## 9. Riesgos y limitaciones aceptadas

1. **Gate de skills/MCP, registrado antes de crear los manifiestos.** Para #243 **se crearon `contracts/Cargo.toml` y `contracts/Cargo.lock`**, así que el gate aplicó: `skill_resolution: skill-registry`, con la skill **`smart-contracts`** cargada desde `.atl/skill-registry.md` antes de escribir el contrato, y la skill **`assets`** consultada para el trasfondo de operaciones clásicas. `mcp_support: none` — las dudas de API se resolvieron contra la documentación oficial y contra el comportamiento observado de la CLI, no contra un servidor MCP.
2. **El job de CI depende de una action de terceros.** Ver sección 5. Se acepta porque la alternativa —un script de arranque de rustup— viola una regla del repositorio que un test impone.
3. **La frontera del contrato no está verificada por máquina.** Ver sección 5: `dependency-cruiser` no lo alcanza.
4. **La fidelidad de la red local es un proxy, no una equivalencia demostrada.** Coinciden la versión de protocolo y los límites configurados; no está probado que todo comportamiento de Testnet se reproduzca. La evidencia real de Testnet es trabajo de #236.
5. **El `Cargo.lock` está versionado.** Es lo correcto para reproducibilidad, pero significa que cualquier cambio de dependencia transitiva aparece como diff. Decisión deliberada, no descuido.
6. **Los límites de la sección 5 son aceptados, no resueltos:** el despliegue en Testnet sin ejecutar, el procedimiento de reset sin ejercitar, la ubicación del workspace ya decidida pero la cobertura de `dependency-cruiser` todavía abierta, y el contrato siendo un placeholder.

## 10. Estado de entrega

- **#243** está **CLOSED**; el PR [#262](https://github.com/reyduar/Vaqcrow/pull/262) está **MERGED** en `main`, cuyo estado verificado es `9730e0d`. La rama de la Task se borró, local y remota.
- **#242** queda **pendiente de cierre** al mergear este documento: su último criterio —las versiones escritas en el documento de evidencia— se cumple con la sección 4 de acá, no antes.
- **#241** se cierra con este documento. **La Feature #238 queda pendiente de cierre manual** en el momento de escribir esto, mismo patrón que las Features anteriores: se cerrará al mergear este PR.
- `docs/planning/demo-tasks-list.md` **no se toca en este cambio**, siguiendo el precedente de #62 y #179: el sync del roadmap pertenece a un commit posterior, cuando la Feature esté efectivamente cerrada. Cuando se haga, tiene que registrar que la decisión P1 sobre la ubicación del workspace Rust quedó tomada: `contracts/` en la raíz.
- Al cerrarse, esta Feature habilita [#236](https://github.com/reyduar/Vaqcrow/issues/236) (implementar el contrato de bóveda de campaña), que es el camino crítico de la demo.
