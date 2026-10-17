---
title: El ecosistema Stellar de Vaqcrow, de la bóveda a tu wallet
tags:
  - blog
  - stellar
  - soroban
  - horizon
  - freighter
  - rust
  - testnet
---

# El ecosistema Stellar de Vaqcrow, de la bóveda a tu wallet

Este artículo explica toda la tecnología de blockchain que usa Vaqcrow. Tiene dos partes. La primera es para cualquier persona: qué piezas hay, quién custodia el dinero de una campaña y qué pasa cuando la meta se alcanza o no. La segunda es para quien programa: cómo están escritos los contratos, qué papel cumple Rust y cómo se comunican los contratos, la API y la web.

> Es una demo. Todo corre en **Stellar Testnet**, una red de prueba: los activos que se mueven **no tienen valor económico**. El KYC/KYB, las ventas declaradas y la conversión entre pesos y activo son simulados. Lo real son las cuentas, los documentos subidos, los contratos desplegados y cada transacción firmada en Testnet. Nada de esto es una oferta de inversión ni una recomendación financiera.

## Parte 1 · Para todos

### El mapa en una imagen

![Diagrama: Vaqcrow despliega una bóveda por campaña; los inversores aportan desde Freighter; si se alcanza la meta todo pasa a la PyME en la misma transacción y, si vence sin meta, cada aporte vuelve a su inversor; después, cada mes, la PyME declara ventas, Vaqcrow calcula el 4,5 % y arma la transacción, la PyME firma en Freighter y cada inversor cobra su parte hasta 1,5 veces lo aportado.](/blog-assets/ecosistema-stellar.svg)

Si la imagen no se ve, este es el mismo recorrido en palabras:

1. Una persona de Vaqcrow aprueba la solicitud de la PyME y la plataforma **despliega una bóveda**: un contrato en Stellar, uno por campaña.
2. Los inversores **aportan** desde su wallet Freighter. El dinero queda **dentro del contrato**, no en una cuenta de Vaqcrow.
3. Si la campaña **alcanza su meta**, el contrato pasa todo a la cuenta de la PyME en la misma transacción.
4. Si la campaña **vence sin alcanzar la meta**, cada aporte se puede **reembolsar** a su inversor.
5. Con el capital en mano, **cada mes** la PyME declara sus ventas, Vaqcrow calcula cuánto le toca a cada inversor y la PyME **firma** el pago en Freighter.

### Las piezas, en una frase cada una

| Pieza | Qué es | Qué hace en Vaqcrow |
|---|---|---|
| **Stellar** | Una red pública de blockchain pensada para pagos: comisiones bajas y confirmación en segundos. | Es donde viven las cuentas, los aportes y los pagos. |
| **Testnet** | La red de prueba de Stellar. Funciona igual que la red principal, pero su dinero no vale nada. | Es la única red que usa la demo. |
| **XLM** | El activo nativo de Stellar. | Es el activo de prueba con el que se aporta y se paga. |
| **Soroban** | La plataforma de contratos inteligentes de Stellar. | Ejecuta la bóveda y la fábrica de bóvedas. |
| **Bóveda** | Un contrato inteligente: un programa que vive en la red y aplica reglas sin que nadie lo opere a mano. | Custodia los aportes de una campaña y aplica el todo o nada. |
| **Fábrica** | Otro contrato, que crea bóvedas. | Despliega una bóveda nueva por cada campaña aprobada. |
| **Freighter** | Una wallet: una extensión del navegador que guarda tu clave privada. | Es donde inversores y PyMEs firman. La clave nunca sale de ahí. |
| **Horizon y RPC** | Las dos puertas de entrada a la red para un programa. | La API de Vaqcrow las usa para leer el estado y enviar transacciones. |
| **Explorador** | Un sitio público para ver cualquier transacción ([stellar.expert](https://stellar.expert/explorer/testnet)). | Cada aporte, pago y despliegue tiene su enlace para verificarlo. |

### Quién custodia el dinero de una campaña

**El contrato, no una persona.** Esta es la idea más importante del artículo.

Mientras una campaña junta fondos, los aportes quedan **dentro de la bóveda**. Ninguna persona tiene una llave para moverlos: ni la PyME, ni el inversor, ni Vaqcrow. El contrato sólo los puede mandar a dos lugares:

- a la **cuenta de la PyME**, que quedó fijada al crear la bóveda y no se puede cambiar después;
- de vuelta a **cada inversor**, si la campaña no llega a su meta.

Vaqcrow es **no custodial**: nunca guarda claves privadas ni recibe el dinero de nadie. La plataforma **arma** las transacciones y las verifica, pero las firma la persona dueña de los fondos, en su propia wallet.

### Cómo viaja un aporte

1. El inversor elige una campaña y escribe el monto.
2. Vaqcrow le muestra una **revisión antes de firmar**: qué contrato, qué función (`contribute`) y qué monto.
3. Se abre Freighter. El inversor revisa la red, su cuenta y el monto, y **firma**.
4. La transacción viaja a Stellar. Primero figura como «Enviada · pendiente de confirmación» y después como confirmada. Enviada no es lo mismo que confirmada.

Hay tres reglas que conviene conocer:

- **Nadie puede tener más del 10 % de la meta.** Lo controla el propio contrato. Por eso una campaña necesita al menos diez inversores distintos para completarse.
- **No se puede aportar más de lo que falta para la meta.** Esta regla la aplica Vaqcrow **antes** de que firmes, no el contrato.
- **Mientras la campaña sigue abierta, podés retirar tu aporte** completo desde tu portafolio.

### Qué red usamos: Stellar Testnet

La demo corre sólo en **Testnet**. La configuración de la API rechaza la red principal: no hay forma de que la demo mueva dinero real por error.

- El XLM de prueba se consigue gratis con **Friendbot**, un servicio de la propia red de prueba. Lo explicamos paso a paso en [Freighter y Friendbot, paso a paso](/blog/freighter-y-friendbot-paso-a-paso).
- Testnet **se reinicia** cada tanto: se borran todas las cuentas y contratos. Después de un reinicio, Vaqcrow vuelve a desplegar su fábrica. El próximo reinicio anunciado es el **16 de diciembre de 2026**.

### Cuando la campaña alcanza su meta

El aporte que completa la meta hace todo en un solo paso. En esa **misma transacción**, el contrato:

1. registra el aporte;
2. marca la campaña como liquidada;
3. transfiere **todo lo reunido** a la cuenta de la PyME.

No hay un paso intermedio en el que alguien tenga que apretar un botón ni decidir nada. Desde ese momento la bóveda **rechaza cualquier aporte nuevo**, y un pago ya hecho no se puede revertir.

### Cuando la campaña no alcanza su meta

Si llega la fecha límite y la meta no se alcanzó, la campaña pasa a **«Reembolso disponible»**:

- Cada aporte se puede **reembolsar** a la misma cuenta que lo hizo. El contrato fija ese destino: nadie lo puede redirigir.
- El reembolso **no necesita permiso**: cualquiera puede pedirlo para cualquier inversor, y el dinero igual vuelve a ese inversor. Así nadie queda atrapado esperando a otra persona.
- El reembolso **no se dispara solo**: alguien tiene que enviar la transacción. El contrato además permite devolver aportes **en tandas de hasta 20 inversores** a la vez.

### El revenue share: cuándo y cómo devuelve la PyME

El revenue share empieza **después** de que la campaña alcanzó su meta y la PyME recibió el capital. Funciona **mes a mes**:

1. La PyME declara las ventas del mes desde «Mi campaña». En la demo, esas ventas son sintéticas.
2. Vaqcrow calcula, de forma determinística, el **4,5 % de esas ventas** y cuánto le toca a cada inversor **en proporción a lo que aportó**. La regla está versionada: `RS-2026-02`. **La IA no participa de este cálculo.**
3. Vaqcrow arma una transacción con **un pago para cada inversor**.
4. La PyME la revisa y la **firma en Freighter**.

El acuerdo tiene un final: cada inversor cobra hasta llegar a **1,5 veces lo que aportó**. Cuando todos llegan a ese tope, el acuerdo termina. Si la PyME vende menos, ese mes se reparte menos. Lo explicamos en detalle en [El revenue share de Vaqcrow, explicado en simple](/blog/revenue-share-explicado).

Un detalle importante: el revenue share **no lo cobra la bóveda**. Son pagos comunes de Stellar que firma la PyME. El contrato sólo custodia el dinero hasta que se cumple, o no, la meta.

## Parte 2 · Para developers

### Qué es Rust y qué papel cumple

[Rust](https://www.rust-lang.org/learn) es un lenguaje de programación compilado, sin recolector de basura, que verifica en tiempo de compilación cómo se usa la memoria. En un contrato eso importa por dos motivos: el binario resultante es chico y el compilador descarta familias enteras de errores antes de que el código llegue a la red.

Los contratos de Soroban se escriben en Rust con el SDK [`soroban-sdk`](https://docs.rs/soroban-sdk/latest/soroban_sdk/) y se compilan a **WebAssembly** (Wasm), que es lo que la red ejecuta. En Vaqcrow:

| Pieza | Valor | Dónde |
|---|---|---|
| Toolchain de Rust | `1.98.1` | `contracts/rust-toolchain.toml` |
| Target de compilación | `wasm32v1-none` | `contracts/rust-toolchain.toml` |
| SDK | `soroban-sdk = "28"`, fijado al protocolo 28 | `contracts/Cargo.toml` |
| Perfil de release | `opt-level = "z"`, LTO, `panic = "abort"` | `contracts/Cargo.toml` |

Rust sólo vive en la carpeta `contracts/`. La API y la web están escritas en TypeScript y hablan con los contratos a través de la red, no importando código Rust.

### Dos contratos: la fábrica y la bóveda

**La fábrica** (`contracts/campaign-factory`) crea bóvedas. Guarda dos datos: su dueño (la cuenta de la plataforma) y el hash del Wasm de la bóveda.

| Función | Quién autoriza | Qué hace |
|---|---|---|
| `__constructor(owner, vault_wasm)` | — | Fija el dueño y el código de bóveda que va a desplegar. |
| `deploy(salt, sme, token, goal, deadline)` | El dueño | Despliega una bóveda nueva desde el Wasm guardado y emite el evento `CampaignOpened`. |
| `predict(salt)` | — | Devuelve la dirección que tendrá la bóveda antes de desplegarla. |
| `owner()`, `vault_wasm()` | — | Lecturas. |

**La bóveda** (`contracts/campaign-vault`) es la máquina de estados de una campaña: `Funding` (fondeo abierto), `Settled` (liquidada) y `Refunding` (en reembolso).

| Función | Quién autoriza | Qué hace |
|---|---|---|
| `__constructor(sme, token, goal, deadline)` | — | Fija la cuenta de la PyME, el activo, la meta y la fecha límite. Rechaza una meta ≤ 0 o una fecha ya vencida. |
| `contribute(investor, amount)` | El inversor | Recibe el aporte. Exige `Funding` y fecha vigente, y que nadie pase del 10 % de la meta. Si el total llega a la meta, pasa a `Settled` y transfiere el total a la PyME **en la misma llamada**. |
| `withdraw(investor)` | El inversor | Devuelve el aporte completo mientras la campaña está en `Funding`. |
| `refund(investor)` | Nadie (sin permisos) | Tras la fecha límite y sin meta, devuelve el aporte a ese inversor. La primera llamada pasa la bóveda a `Refunding`. |
| `sweep(investors)` | Nadie (sin permisos) | Reembolso en tanda, hasta 20 inversores por llamada. |
| `state`, `total`, `goal`, `deadline`, `sme`, `token`, `contribution_of`, `contributors` | — | Lecturas. |

La bóveda publica los eventos `Contributed`, `Settled`, `Withdrawn` y `Refunded`, y define errores tipados, como `WrongState`, `DeadlinePassed`, `NothingToRefund` o `InvestorCapExceeded`. Los aportes de cada inversor viven en almacenamiento *persistent* y el resto en *instance*; el contrato extiende su TTL en cada escritura para que los datos no expiren mientras la campaña sigue viva.

El activo es un parámetro del constructor: cualquier token SEP-41 sirve. En la demo es el **Stellar Asset Contract (SAC) del XLM nativo**, que expone el activo clásico como un contrato.

### Cómo se despliegan

```sh
# 1. Compilar a Wasm y correr los tests
stellar contract build
cargo test

# 2. Crear, si todavía no existe, el contrato (SAC) del XLM nativo en la red
stellar contract asset deploy --asset native --source-account <CUENTA> --network testnet

# 3. Subir el código de la bóveda: la red devuelve su hash
stellar contract upload --wasm target/wasm32v1-none/release/campaign_vault.wasm \
  --source-account <CUENTA> --network testnet

# 4. Desplegar la fábrica con su dueño y el hash de la bóveda
stellar contract deploy --wasm target/wasm32v1-none/release/campaign_factory.wasm \
  --source-account <CUENTA> --network testnet \
  -- --owner=<PLATAFORMA> --vault_wasm=<HASH_DE_LA_BOVEDA>
```

Los scripts reales están en `contracts/scripts/` (`deploy-local.sh`, `campaign-smoke.sh`, `bootstrap-local-campaign.sh`). Usan [Stellar CLI](https://developers.stellar.org/docs/tools/cli) y pueden apuntar a una red local con la imagen `stellar/quickstart` o a Testnet.

Una vez desplegada la fábrica, **cada bóveda la despliega la API** cuando un admin aprueba una solicitud:

- El `salt` es el `SHA-256` del id de la solicitud. Así, la misma solicitud siempre produce la misma dirección, y reintentar el despliegue no crea una segunda bóveda.
- Si la cuenta de la PyME todavía no existe en la red, la plataforma la crea y la fondea con **2 XLM**, el mínimo para darla de alta. Ese monto no es dinero de la campaña.
- Esa transacción la firma la plataforma, que es la dueña de la fábrica. La PyME no firma nada en este paso.

Los contratos tienen **39 tests** en Rust con las `testutils` de `soroban-sdk`: 36 de la bóveda y 3 de la fábrica.

### De contrato a pantalla: contracts → API → web

| Capa | Tecnología | Qué hace |
|---|---|---|
| Contratos | Rust, `soroban-sdk`, Wasm | Custodian y aplican la regla todo o nada. |
| API | Fastify, TypeScript, [`@stellar/stellar-sdk`](https://github.com/stellar/js-stellar-sdk) 17 | Arma, simula, verifica y envía transacciones. Firma sólo lo que es de la plataforma. |
| Lectura y envío de contratos | [Stellar RPC](https://developers.stellar.org/docs/data/apis/rpc) | `simulateTransaction`, `prepareTransaction`, `sendTransaction` y `getTransaction` para la fábrica y las bóvedas. |
| Transacciones clásicas | [Horizon](https://developers.stellar.org/docs/data/apis/horizon) | Alta de la cuenta de la PyME y los pagos del revenue share. |
| Web | Next.js, [`@stellar/freighter-api`](https://docs.freighter.app/) 6 | Conecta la wallet y pide la firma. Nunca ve una clave privada. |
| Evidencia | [stellar.expert](https://stellar.expert/explorer/testnet) | La API arma el enlace de cada hash y la web lo muestra. |

El recorrido de un aporte, de punta a punta:

```text
web                     API                                    Stellar
 │ POST /campaigns/:id/invocations
 │ ─────────────────────▶ arma contract.call("contribute")
 │                        y la simula (prepareTransaction) ───▶ RPC
 │ ◀───────────────────── XDR sin firmar
 │
 │ Freighter: verifica la red y firma (signTransaction)
 │
 │ POST /campaigns/:id/invocations/submission  { signedXdr }
 │ ─────────────────────▶ verifica argumentos y firma
 │                        sendTransaction ─────────────────────▶ RPC
 │                        getTransaction, hasta confirmar ◀───── RPC
 │ ◀───────────────────── hash + enlace al explorador
```

Tres decisiones de diseño sostienen ese recorrido:

- **La API nunca firma por un usuario.** Devuelve la transacción sin firmar y, a la vuelta, verifica que lo firmado sea exactamente lo que armó antes de enviarlo.
- **La web verifica la red antes de firmar.** El adaptador de Freighter (`apps/web/src/infrastructure/wallet/freighter-wallet.ts`) compara la *passphrase* de la red activa en la wallet con la que espera la app y, si no coinciden, no pide la firma. Para vincular la wallet a la cuenta, la persona firma un mensaje de verificación (`signMessage`).
- **Puertos y adaptadores.** En `apps/api`, cada capacidad de Stellar es un puerto en `application/ports/` (por ejemplo `campaign-factory-port.ts` o `revenue-share-distribution-xdr-port.ts`) con su implementación en `infrastructure/adapters/`. Los tests de pull request usan dobles locales y nunca dependen de Testnet.

El pago mensual sigue el mismo patrón con otra herramienta: la API arma una transacción **clásica** con la cuenta de la PyME como origen y **una operación `payment` por inversor**, la PyME la firma en Freighter y la API la verifica y la envía por Horizon.

### Lo que el contrato no hace

Conviene decirlo con la misma claridad que lo que sí hace:

- **El tope de «no aportar más de lo que falta» no está en el contrato.** Lo aplica la API antes de armar la transacción. El contrato sólo limita a cada inversor al 10 % de la meta.
- **El revenue share no está en el contrato.** Es un cálculo de la plataforma y una transacción clásica que firma la PyME.
- **El plazo máximo del acuerdo no está implementado** en la demo.
- **Sólo Testnet.** La configuración rechaza la red principal.

## Dónde seguir aprendiendo

**Para empezar con Stellar**

- [Stellar Learn](https://stellar.org/learn): conceptos de la red en lenguaje llano.
- [Documentación para developers](https://developers.stellar.org/docs): el punto de entrada oficial.
- [Redes de Stellar](https://developers.stellar.org/docs/learn/fundamentals/networks): Testnet, la red principal y Friendbot.
- [Cuentas](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts) y [operaciones](https://developers.stellar.org/docs/learn/fundamentals/transactions/list-of-operations).
- [El protocolo de consenso de Stellar](https://developers.stellar.org/docs/learn/fundamentals/stellar-consensus-protocol).

**Para escribir contratos**

- [Primeros pasos con contratos](https://developers.stellar.org/docs/build/smart-contracts/getting-started).
- [Contratos de ejemplo](https://developers.stellar.org/docs/build/smart-contracts/example-contracts) y el repositorio [soroban-examples](https://github.com/stellar/soroban-examples).
- [Stellar Asset Contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract): cómo un activo clásico se usa desde un contrato.
- [Referencia de `soroban-sdk`](https://docs.rs/soroban-sdk/latest/soroban_sdk/).
- [The Rust Programming Language](https://doc.rust-lang.org/book/), el libro oficial de Rust.

**Para conectar una app**

- [Guía de frontend para dApps](https://developers.stellar.org/docs/build/guides/dapps/frontend-guide).
- [Documentación de Freighter](https://docs.freighter.app/).
- [`js-stellar-sdk`](https://github.com/stellar/js-stellar-sdk) y su [referencia](https://stellar.github.io/js-stellar-sdk/).
- [Stellar RPC](https://developers.stellar.org/docs/data/apis/rpc) y [Horizon](https://developers.stellar.org/docs/data/apis/horizon).

**Herramientas y comunidad**

- [Stellar CLI](https://developers.stellar.org/docs/tools/cli) y [Stellar Lab](https://developers.stellar.org/docs/tools/lab), para probar transacciones desde el navegador.
- [stellar.expert](https://stellar.expert/explorer/testnet), el explorador de Testnet.
- [Versiones de software de la red](https://developers.stellar.org/docs/networks/software-versions), para saber qué protocolo corre en cada red.
- El [Discord de developers de Stellar](https://discord.gg/stellardev) y el [Stellar Community Fund](https://communityfund.stellar.org/).

## Referencias en el código de Vaqcrow

- Contratos: `contracts/campaign-factory/src/lib.rs`, `contracts/campaign-vault/src/lib.rs` y `contracts/README.md`.
- Configuración de red: `apps/api/src/application/config/stellar-config.ts`.
- Despliegue de bóvedas: `apps/api/src/application/use-cases/open-campaign.ts` y `apps/api/src/infrastructure/adapters/stellar-campaign-factory.ts`.
- Aportes: `apps/api/src/infrastructure/adapters/stellar-campaign-vault-invocation.ts`.
- Revenue share: `apps/api/src/infrastructure/adapters/stellar-revenue-share-distribution-xdr.ts`.
- Wallet: `apps/web/src/infrastructure/wallet/freighter-wallet.ts`.
- Alcance de Stellar en el proyecto: `docs/planning/stellar-blockchain-requirements.md`.

## En resumen

Vaqcrow pone la regla más delicada de una campaña, **todo o nada**, dentro de un contrato escrito en Rust que nadie puede operar a mano. Usa Stellar Testnet para que todo sea verificable en un explorador público sin mover dinero real, y deja cada firma en manos de las personas, desde su propia wallet. La IA sólo asesora: no aprueba campañas, no calcula pagos y no mueve fondos.
