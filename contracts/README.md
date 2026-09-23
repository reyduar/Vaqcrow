# Contratos de Stellar

Workspace Rust de los contratos de Vaqcrow. Vive **fuera del workspace de pnpm**: no es un paquete del monorepo TypeScript, turbo no lo construye y las reglas de `dependency-cruiser` no lo alcanzan —sus globs son `apps/*/src` y `packages/*/src`—. Por eso tiene su propio job de CI.

No se reutiliza `packages/contracts`: ese paquete es TypeScript y contiene contratos de API, no programas on-chain. Mezclarlos rompería el límite que el propio paquete declara.

> **Alcance.** El fondeo se custodia en un contrato, con una bóveda por campaña. La decisión, el motivo del descarte de Claimable Balance y la máquina de estados están en [`docs/planning/stellar-blockchain-requirements.md`](../docs/planning/stellar-blockchain-requirements.md).

## Estado actual

`campaign-vault/` es un **placeholder**, no la bóveda. Existe para que el workspace, el build, los tests, el despliegue y el CI queden probados de punta a punta. La máquina de estados real —custodia, pago atómico al alcanzar el objetivo, retiro y reembolsos con barrido— es [#244](https://github.com/reyduar/Vaqcrow/issues/244).

## Toolchain

Fijado en `rust-toolchain.toml`: **`rustc` 1.98.1** y el target **`wasm32v1-none`**. `rustup` lee ese archivo desde el directorio actual hacia arriba, así que **los comandos tienen que correr desde `contracts/`** para que el pin aplique.

Instalación desde cero:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32v1-none
brew install stellar-cli     # en macOS; también hay script, winget y cargo
```

> **`soroban-sdk` está fijado en `28` a propósito.** El major del SDK sigue a la versión del protocolo, y el protocolo vivo en Testnet y Mainnet es **28** (verificado con `getVersionInfo` el 2026-09-22). El scaffold de `stellar contract init` todavía genera `soroban-sdk = "27"`, **un major atrás**: no lo bajes para "coincidir con el scaffold".

## Red local

Es el carril de **desarrollo y CI**: nunca se resetea, despliega al instante y es determinista. Corre la imagen `stellar/quickstart:testing` en modo local, que **aplica los límites de Testnet**, así que lo que aprueba en local predice Testnet sin sorpresas de recursos ni fees.

```bash
./scripts/local-network.sh start        # levanta y espera health
./scripts/local-network.sh network-add  # registra la red `local` en la CLI
./scripts/local-network.sh stop
```

> [!warning] No pases `--enable-stellar-rpc`
> La documentación oficial de Stellar sugiere ese flag y **esta imagen lo rechaza**: el contenedor sale con `Unknown container arg --enable-stellar-rpc` antes de arrancar nada. `--local` solo ya levanta core, Horizon, Stellar RPC y Friendbot.

La red local **no reemplaza a Testnet para la evidencia**: no es pública, y nadie de afuera puede verificarla.

## Build, test y despliegue

```bash
./scripts/deploy-local.sh --goal=1000        # local, por defecto
NETWORK=testnet ./scripts/deploy-local.sh --goal=1000
```

El script fija el toolchain, verifica el target, genera y fondea la cuenta de despliegue si no existe, construye, corre los tests, imprime el **sha256 del Wasm** —la evidencia de reproducibilidad— y despliega con los argumentos del constructor que le pases.

> [!warning] Los argumentos del constructor van con `=`
> La forma que funciona es **`--goal=1000`**. La ayuda de la CLI dice `--arg-name value` (separado por espacio) y esa forma **falla** con `unexpected argument`. Con `=` la CLI mapea el nombre al argumento del `__constructor`.

Para construir o testear sin desplegar:

```bash
cd contracts
stellar contract build
cargo test
```

## Procedimiento tras un reset de Testnet

Testnet se resetea **2 a 4 veces por año**, a las 17:00 UTC, con aviso de al menos dos semanas. Un reset **borra todas las entradas del ledger, incluidos los datos de los contratos**: el contrato desplegado, su Wasm, su estado y las cuentas dejan de existir. La próxima fecha agendada es el **16 de diciembre de 2026**.

Nada de eso toca a la red local, así que el desarrollo y el CI no se interrumpen. Lo que hay que rehacer es la evidencia en Testnet:

1. **Anunciado el reset** (o al detectarlo): no empieces una campaña de demo cuya ventana lo atraviese. Si ya hay una en curso, dá por perdido su estado.
2. **Volver a levantar las cuentas.** Las cuentas descartables por rol —inversor, PyME, despliegue— se recrean y se fondean con Friendbot. El procedimiento de billetera y cuenta está en [`docs/planning/freighter-and-testnet-account-setup.md`](../docs/planning/freighter-and-testnet-account-setup.md).
3. **Volver a desplegar.** `NETWORK=testnet ./scripts/deploy-local.sh --goal=1000`. Como el build es reproducible, el Wasm vuelve a dar el **mismo sha256**: se puede verificar que se redesplegó exactamente el mismo código.
4. **Volver a sembrar.** Recrear los datos de la demo que vivían on-chain: las campañas, sus aportes y sus estados. El espejo off-chain se reconcilia contra la cadena, que es la fuente de verdad.
5. **Registrar la evidencia nueva.** Las direcciones y hashes anteriores dejan de ser válidos: la evidencia que se presente tiene que citar los del despliegue nuevo.

> [!important] El contrato no es un dato durable en Testnet
> Tratar el despliegue como algo que se puede rehacer en minutos, no como algo que persiste. Es la razón por la que el ciclo de la campaña de la demo conviene que quepa en una sola sesión: así un reset es indiferente.

## CI

El job `contracts` de [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) levanta la red local con la Action oficial `stellar/quickstart`, resuelve el toolchain fijado, construye, corre los tests y despliega en la red local. **No toca Testnet** y no necesita ningún secreto, igual que el resto de los gates de pull request.
