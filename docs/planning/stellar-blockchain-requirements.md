# Requisitos de blockchain Stellar para Vaqcrow

> **Documento completo — 2026-09-14.** Las 4 partes están completas y verificadas.

## Índice

- [Parte 1 — Decisión, alcance y fundamentos](#parte-1)
  - [1. Resumen de la decisión](#resumen-de-la-decision)
  - [2. Mapa canónico de issues](#mapa-canonico-de-issues)
  - [3. Ruta conceptual de aprendizaje recomendada](#ruta-conceptual-de-aprendizaje)
  - [4. Referencias oficiales](#referencias-oficiales)
- [Parte 2 — Preparación del equipo y herramientas](#parte-2)
  - [1. Alcance obligatorio y opcional](#alcance-de-preparacion)
  - [2. Comprobaciones obligatorias sin instalación](#comprobaciones-obligatorias)
  - [3. Dependencias del proyecto](#dependencias-del-proyecto)
  - [4. Preparación segura de Freighter](#preparacion-de-freighter)
  - [5. Prerrequisitos opcionales para contratos inteligentes](#prerrequisitos-opcionales)
  - [6. Decisión de lenguajes y herramientas](#decision-de-herramientas)
  - [7. Distinción arquitectónica de `packages/contracts`](#distincion-de-packages-contracts)
  - [8. Lista de seguridad](#lista-de-seguridad)
  - [9. Referencias oficiales de preparación](#referencias-oficiales-de-preparacion)
- [Parte 3 — Plan de pruebas y gates de decisión](#parte-3)
  - [1. Plan de pruebas obligatorio de transferencias Testnet](#pruebas-obligatorias-testnet)
    - [a. Unit tests determinísticos sin red](#unit-tests-sin-red)
    - [b. Preflight manual acotado en Testnet](#preflight-testnet)
    - [c. Pruebas negativas](#pruebas-negativas)
    - [d. Checklist de evidencia y limpieza](#checklist-evidencia)
  - [2. Plan de pruebas opcional de smart contracts Soroban](#pruebas-opcionales-soroban)
  - [3. Gates de decisión](#gates-de-decision)
    - [a. Definition of ready antes de #74](#dor-antes-de-74)
    - [b. Gate separado antes de issues Soroban](#gate-soroban)
- [Parte 4 — Cierre, skills, seguridad y verificación](#parte-4)
  - [1. Tabla de skills recomendadas](#skills-recomendadas)
  - [2. Convenios de seguridad y arquitectura](#convenios-seguridad)
  - [3. Fuentes oficiales consolidadas](#fuentes-oficiales-consolidadas)
  - [4. Definition of ready consolidada](#dor-consolidada)
  - [5. Checklist de verificación final](#checklist-verificacion-final)

<a id="parte-1"></a>
## Parte 1 — Decisión, alcance y fundamentos

<a id="resumen-de-la-decision"></a>
### 1. Resumen de la decisión

| Alcance | Decisión |
|---|---|
| **Obligatorio** | El camino base de Vaqcrow utiliza pagos clásicos en **Stellar Testnet**, construidos y verificados con `@stellar/stellar-sdk`, enviados y consultados mediante **Horizon**, y autorizados por la persona usuaria mediante **Freighter**. El fondeo y la distribución de revenue share deben funcionar por este camino. **No se requiere ningún contrato inteligente.** |
| **Opcional** | **Soroban y los contratos inteligentes de Stellar son únicamente trabajo de extensión**. Solo pueden considerarse después de que el fondeo y la distribución clásicos estén estables; no sustituyen, condicionan ni retrasan el camino obligatorio. |

<a id="mapa-canonico-de-issues"></a>
### 2. Mapa canónico de issues

Los siguientes enlaces y títulos se verificaron contra GitHub en modo de solo lectura el **2026-09-14**. Los títulos canónicos se conservan en su idioma original y todos los issues enumerados están abiertos.

#### Epics principales

| Issue canónico | Función en el alcance |
|---|---|
| [#7 — `Epic: Stellar funding and confirmation`](https://github.com/reyduar/Vaqcrow/issues/7) | Agrupa el fondeo clásico y su confirmación en Stellar. |
| [#8 — `Epic: Revenue-share calculation and distribution`](https://github.com/reyduar/Vaqcrow/issues/8) | Agrupa los prerrequisitos de ventas y cálculo, y la distribución clásica en Testnet. |

#### Features y tareas del núcleo

| Feature canónica | Tareas canónicas | Clasificación |
|---|---|---|
| [#23 — `Feature: Encapsulate Stellar and Freighter integration`](https://github.com/reyduar/Vaqcrow/issues/23) | [#74 — `Task: Implement Stellar and Freighter integration`](https://github.com/reyduar/Vaqcrow/issues/74)<br>[#75 — `Task: Test Stellar and Freighter integration`](https://github.com/reyduar/Vaqcrow/issues/75)<br>[#76 — `Task: Document evidence for Stellar and Freighter integration`](https://github.com/reyduar/Vaqcrow/issues/76) | Integración blockchain. |
| [#24 — `Feature: Build, verify and submit funding intent`](https://github.com/reyduar/Vaqcrow/issues/24) | [#77 — `Task: Implement funding intent submission and XDR verification`](https://github.com/reyduar/Vaqcrow/issues/77)<br>[#78 — `Task: Test funding intent submission and XDR verification`](https://github.com/reyduar/Vaqcrow/issues/78)<br>[#79 — `Task: Document evidence for funding intent submission and XDR verification`](https://github.com/reyduar/Vaqcrow/issues/79) | Integración blockchain. |
| [#25 — `Feature: Confirm Stellar transactions asynchronously`](https://github.com/reyduar/Vaqcrow/issues/25) | [#80 — `Task: Implement asynchronous Stellar confirmation`](https://github.com/reyduar/Vaqcrow/issues/80)<br>[#81 — `Task: Test asynchronous Stellar confirmation`](https://github.com/reyduar/Vaqcrow/issues/81)<br>[#82 — `Task: Document evidence for asynchronous Stellar confirmation`](https://github.com/reyduar/Vaqcrow/issues/82) | Integración blockchain. |
| [#26 — `Feature: Implement monthly sales feed`](https://github.com/reyduar/Vaqcrow/issues/26) | [#83 — `Task: Implement monthly sales feed`](https://github.com/reyduar/Vaqcrow/issues/83)<br>[#84 — `Task: Test monthly sales feed`](https://github.com/reyduar/Vaqcrow/issues/84)<br>[#85 — `Task: Document evidence for monthly sales feed`](https://github.com/reyduar/Vaqcrow/issues/85) | **Prerrequisito de ventas y dominio; no es una integración blockchain.** |
| [#27 — `Feature: Calculate versioned revenue share deterministically`](https://github.com/reyduar/Vaqcrow/issues/27) | [#86 — `Task: Implement deterministic revenue-share calculation`](https://github.com/reyduar/Vaqcrow/issues/86)<br>[#87 — `Task: Test deterministic revenue-share calculation`](https://github.com/reyduar/Vaqcrow/issues/87)<br>[#88 — `Task: Document evidence for deterministic revenue-share calculation`](https://github.com/reyduar/Vaqcrow/issues/88) | **Prerrequisito de dominio; no es una integración blockchain.** |
| [#28 — `Feature: Sign and distribute revenue share on Testnet`](https://github.com/reyduar/Vaqcrow/issues/28) | [#89 — `Task: Implement Testnet revenue-share distribution`](https://github.com/reyduar/Vaqcrow/issues/89)<br>[#90 — `Task: Test Testnet revenue-share distribution`](https://github.com/reyduar/Vaqcrow/issues/90)<br>[#91 — `Task: Document evidence for Testnet revenue-share distribution`](https://github.com/reyduar/Vaqcrow/issues/91) | Integración blockchain. |

#### Trabajo transversal

| Feature canónica | Tareas canónicas | Relación con el camino Stellar |
|---|---|---|
| [#14 — `Feature: Establish typed configuration and secret boundaries`](https://github.com/reyduar/Vaqcrow/issues/14) | [#44 — `Task: Implement typed configuration and secret boundaries`](https://github.com/reyduar/Vaqcrow/issues/44)<br>[#45 — `Task: Test establish typed configuration and secret boundaries`](https://github.com/reyduar/Vaqcrow/issues/45)<br>[#46 — `Task: Document evidence establish typed configuration and secret boundaries`](https://github.com/reyduar/Vaqcrow/issues/46) | Configuración de red y límites de secretos. |
| [#15 — `Feature: Set up deterministic testing and CI gates`](https://github.com/reyduar/Vaqcrow/issues/15) | [#47 — `Task: Implement set up deterministic testing and ci gates`](https://github.com/reyduar/Vaqcrow/issues/47)<br>[#48 — `Task: Test set up deterministic testing and ci gates`](https://github.com/reyduar/Vaqcrow/issues/48)<br>[#49 — `Task: Document evidence set up deterministic testing and ci gates`](https://github.com/reyduar/Vaqcrow/issues/49) | Pruebas reproducibles sin dependencia de Testnet. |
| [#29 — `Feature: Expose decision and transaction evidence dashboard`](https://github.com/reyduar/Vaqcrow/issues/29) | [#92 — `Task: Implement evidence dashboard`](https://github.com/reyduar/Vaqcrow/issues/92)<br>[#93 — `Task: Test evidence dashboard`](https://github.com/reyduar/Vaqcrow/issues/93)<br>[#94 — `Task: Document evidence for evidence dashboard`](https://github.com/reyduar/Vaqcrow/issues/94) | Evidencia de transacciones y estados. |
| [#30 — `Feature: Integrate the complete vertical demo journey`](https://github.com/reyduar/Vaqcrow/issues/30) | [#95 — `Task: Implement complete vertical demo journey`](https://github.com/reyduar/Vaqcrow/issues/95)<br>[#96 — `Task: Test complete vertical demo journey`](https://github.com/reyduar/Vaqcrow/issues/96)<br>[#97 — `Task: Document evidence for complete vertical demo journey`](https://github.com/reyduar/Vaqcrow/issues/97) | Integración del recorrido completo. |
| [#31 — `Feature: Add resilience telemetry and truthful fallbacks`](https://github.com/reyduar/Vaqcrow/issues/31) | [#98 — `Task: Implement resilience telemetry and fallbacks`](https://github.com/reyduar/Vaqcrow/issues/98)<br>[#99 — `Task: Test resilience telemetry and fallbacks`](https://github.com/reyduar/Vaqcrow/issues/99)<br>[#100 — `Task: Document evidence for resilience telemetry and fallbacks`](https://github.com/reyduar/Vaqcrow/issues/100) | Reintentos, observabilidad y estados veraces. |
| [#33 — `Feature: Rehearse the demo and package evidence`](https://github.com/reyduar/Vaqcrow/issues/33) | [#104 — `Task: Implement demo rehearsal and evidence packaging`](https://github.com/reyduar/Vaqcrow/issues/104)<br>[#105 — `Task: Test demo rehearsal and evidence packaging`](https://github.com/reyduar/Vaqcrow/issues/105)<br>[#106 — `Task: Document evidence for demo rehearsal and evidence packaging`](https://github.com/reyduar/Vaqcrow/issues/106) | Validación operativa y evidencia final. |

**Ausencia explícita:** actualmente no existe un issue canónico dedicado a implementar un contrato inteligente o una integración Soroban. Ese trabajo no forma parte del camino obligatorio y requeriría una decisión y un issue independientes si se autorizara como extensión.

<a id="ruta-conceptual-de-aprendizaje"></a>
### 3. Ruta conceptual de aprendizaje recomendada

El aprendizaje debe seguir este orden; cada etapa presupone el dominio de la anterior:

1. **Cuentas, claves y no custodia:** distinguir dirección pública, clave secreta, firmantes y umbrales; comprender que Vaqcrow prepara y verifica transacciones, mientras la persona usuaria conserva sus claves.
2. **Redes y passphrases:** diferenciar Testnet de Public Network, reconocer sus datos y activos independientes, y entender que la passphrase participa en el hash que se firma.
3. **XLM, activos y trustlines:** separar el activo nativo de los activos emitidos, identificar código y emisor, y comprender el consentimiento explícito que representa una trustline.
4. **Transacciones clásicas:** estudiar operaciones, XDR, cuenta fuente, sequence number, fees, timebounds, memos y firmas antes de construir un flujo de pago.
5. **Freighter:** comprender la solicitud de acceso, la revisión por la persona usuaria y la firma de un XDR para una red explícita, sin exponer la clave secreta a Vaqcrow.
6. **Horizon y confirmación asíncrona:** usar Horizon para consultar cuentas y operaciones, enviar transacciones clásicas y separar la recepción inicial del resultado confirmado o fallido.
7. **Idempotencia y reintentos:** correlacionar cada intención interna con su hash y estado, consultar antes de repetir, reutilizar de forma segura la misma transacción firmada cuando corresponda y evitar crear pagos nuevos ante resultados inciertos.
8. **Solo después, Soroban:** estudiar autorización, almacenamiento `Persistent`/`Temporary`/`Instance` y TTL, eventos, recursos y fees, aritmética determinística, y riesgos de actualización y administración. Estos conceptos pertenecen únicamente a una posible extensión, no al requisito base.

<a id="referencias-oficiales"></a>
### 4. Referencias oficiales

Fuentes oficiales consultadas y verificadas el **2026-09-14**:

- [SDKs cliente de Stellar](https://developers.stellar.org/docs/tools/sdks/client-sdks): alcance de `@stellar/stellar-sdk`, construcción de transacciones y acceso a Horizon.
- [Cuentas](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts) y [redes](https://developers.stellar.org/docs/networks): cuentas, firmantes, sequence numbers, Testnet, Public Network y passphrases.
- [Activos](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets): XLM, activos emitidos, precisión y relación con trustlines.
- [Operaciones y transacciones](https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions): operaciones, XDR, fees, secuencias, timebounds, memos y firmas.
- [Firma con Freighter](https://docs.freighter.app/extension-freighter-api/signing.md): revisión y firma de XDR con red o passphrase explícita.
- [Horizon](https://developers.stellar.org/docs/data/apis/horizon) y [envío de transacciones](https://developers.stellar.org/docs/data/apis/horizon/api-reference/submit-a-transaction): consulta, envío y reenvío seguro de una transacción ya incluida.
- [Autorización](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization), [almacenamiento y TTL](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival), [eventos](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/events), [recursos y fees](https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering), [tipos numéricos](https://developers.stellar.org/docs/learn/fundamentals/contract-development/types/built-in-types) y [actualización de contratos](https://developers.stellar.org/docs/build/guides/conventions/upgrading-contracts): fundamentos y riesgos que solo aplican a una eventual extensión Soroban.

<a id="parte-2"></a>
## Parte 2 — Preparación del equipo y herramientas

Esta parte define qué debe comprobarse y prepararse en un equipo de desarrollo. No afirma que Git, Node.js, pnpm, Freighter, Rust o Stellar CLI ya estén instalados, y no registra ninguna instalación realizada.

<a id="alcance-de-preparacion"></a>
### 1. Alcance obligatorio y opcional

| Camino | Preparación del equipo | Regla de entrada |
|---|---|---|
| **Obligatorio: pagos clásicos** | Git, Node.js, pnpm, un navegador compatible con Freighter, una cuenta descartable en Stellar Testnet y acceso a Horizon. El código utiliza TypeScript, `@stellar/stellar-sdk` y `@stellar/freighter-api`. | Es el único camino necesario para implementar y demostrar fondeo y distribución. |
| **Opcional: contratos inteligentes** | Rust `1.84.0` o superior, `rustup`, `cargo`, el target `wasm32v1-none`, Stellar CLI y `soroban-sdk`. | Solo se prepara si el stretch goal recibe autorización después de estabilizar los pagos clásicos. No bloquea el camino obligatorio. |

<a id="comprobaciones-obligatorias"></a>
### 2. Comprobaciones obligatorias sin instalación

Estas órdenes son de solo lectura. Deben ejecutarse antes de implementar para registrar las versiones disponibles; si alguna falla, el equipo no está listo y debe resolver el requisito por separado, sin improvisar una instalación dentro de la comprobación.

```bash
command -v git
git --version

command -v node
node --version

command -v pnpm
pnpm --version
```

La preparación del navegador se verifica en el propio navegador, porque una orden de terminal no demuestra de forma fiable que una extensión esté instalada, habilitada y autorizada. La comprobación obligatoria consiste en confirmar que:

- se utiliza **Chrome, Firefox o Brave**, navegadores presentados por el sitio oficial de Freighter para la extensión;
- la extensión oficial se abre y aparece habilitada;
- Freighter muestra una dirección pública y la red **Testnet** antes de cualquier firma;
- el navegador puede acceder a la aplicación local mediante el origen seguro que exija Freighter durante la implementación.

<a id="dependencias-del-proyecto"></a>
### 3. Dependencias del proyecto

| Dependencia | Lado propietario | Regla de instalación durante la implementación |
|---|---|---|
| `@stellar/stellar-sdk` | **Backend**: construcción y verificación de XDR, Horizon, envío y consulta de transacciones clásicas. | Debe declararse en el `package.json` del workspace backend que la utiliza y quedar registrada en el lockfile del workspace. |
| `@stellar/freighter-api` | **Frontend**: detección de Freighter, autorización, lectura de dirección/red y solicitud de firma. | Debe declararse en el `package.json` del workspace frontend que la utiliza y quedar registrada en el lockfile del workspace. |

Ambas dependencias se incorporarán mediante los manifiestos del workspace cuando se ejecuten las tareas de implementación correspondientes. **No deben instalarse globalmente** ni agregarse durante esta fase de comprobación del equipo.

<a id="preparacion-de-freighter"></a>
### 4. Preparación segura de Freighter

1. Seguir la [guía oficial de instalación](https://docs.freighter.app/extension-freighter-api/installation.md) e instalar la extensión únicamente desde sus enlaces oficiales: [Chrome Web Store](https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk) para Chrome o Brave, o [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/freighter/) para Firefox.
2. Crear en Freighter una wallet o cuenta **descartable y exclusiva para Testnet**; no importar una cuenta que custodie fondos reales.
3. Seleccionar **Testnet** y verificar visualmente tanto la red como la dirección pública activa antes de fondear o firmar.
4. Fondear solamente con XLM de prueba mediante [Stellar Lab/Friendbot oficial](https://lab.stellar.org/account/fund) o tooling oficial equivalente. Friendbot requiere la **dirección pública**, nunca la seed o clave privada.
5. Cuando resulte práctico, usar cuentas descartables separadas para los roles de inversor, PyME y distribución. Esta separación reduce errores de guion y hace visible quién autoriza cada operación.
6. Verificar desde la integración, cuando exista, que `getAddress()` coincide con la dirección esperada y que `getNetwork()` devuelve `TESTNET` con su passphrase correspondiente antes de solicitar una firma.

Vaqcrow nunca debe solicitar, recibir, copiar ni mostrar la seed, frase de recuperación o clave privada. La persona usuaria revisa y firma el XDR dentro de Freighter; la aplicación solo recibe la dirección pública y el resultado de la firma autorizada.

<a id="prerrequisitos-opcionales"></a>
### 5. Prerrequisitos opcionales para contratos inteligentes

> **No ejecutar este bloque para el camino obligatorio.** Solo corresponde al stretch goal Soroban autorizado. Las órdenes de instalación se documentan como prerrequisitos futuros; no se ejecutaron al preparar este documento.

Primero se comprueba que el toolchain de Rust existe y que `rustc` es **`1.84.0` o superior**:

```bash
command -v rustup
rustup --version

command -v rustc
rustc --version

command -v cargo
cargo --version
```

Con un toolchain compatible, el target requerido se agrega para ese toolchain y luego se verifica entre los targets instalados:

```bash
rustup target add wasm32v1-none
rustup target list
```

El target debe aparecer como `wasm32v1-none (installed)`. Como su instalación es específica de cada toolchain, debe volver a comprobarse después de actualizar Rust.

La orden oficial solicitada para instalar Stellar CLI desde Cargo y su comprobación posterior son:

```bash
cargo install --locked stellar-cli
stellar version
```

`soroban-sdk` no es una herramienta global: se declara como dependencia del `Cargo.toml` del eventual workspace Rust y cada contrato la referencia desde su propio manifiesto. La versión se fijará de forma compatible con Stellar CLI y la red cuando el stretch goal tenga un issue canónico.

<a id="decision-de-herramientas"></a>
### 6. Decisión de lenguajes y herramientas

| Camino | Stack decidido | Exclusiones |
|---|---|---|
| **Pagos clásicos obligatorios** | TypeScript + `@stellar/stellar-sdk` + Horizon + Freighter mediante `@stellar/freighter-api`. | No necesita framework de contratos ni Stellar RPC para cumplir el alcance base. |
| **Contratos inteligentes opcionales** | Rust + `soroban-sdk` + Stellar CLI, con Stellar RPC cuando exista una implementación autorizada. | No se utilizarán Solidity, Hardhat, Foundry ni Truffle: son herramientas del ecosistema EVM y no forman parte del stack de contratos Stellar decidido. |

<a id="distincion-de-packages-contracts"></a>
### 7. Distinción arquitectónica de `packages/contracts`

`packages/contracts` pertenece al monorepo TypeScript y contiene **esquemas, tipos públicos y contratos de comunicación entre web y API**. El nombre `contracts` se refiere a contratos de software, no a programas on-chain: ese paquete no contiene Rust, `soroban-sdk`, artefactos Wasm ni lógica desplegable en Stellar.

Si se autoriza el stretch goal, el contrato inteligente debe vivir en un workspace o directorio Rust independiente, identificado por sus propios `Cargo.toml` y fuentes `.rs`. Su ubicación y nombre se decidirán en el issue canónico correspondiente; no se reutilizará `packages/contracts` para evitar mezclar límites de API con código on-chain.

<a id="lista-de-seguridad"></a>
### 8. Lista de seguridad

- [ ] Todas las cuentas y wallets usadas por la demo son descartables y exclusivas de Testnet.
- [ ] Ninguna cuenta de demo contiene fondos reales y ninguna operación apunta a Public Network.
- [ ] Ninguna seed, frase de recuperación o clave privada aparece en el repositorio, archivos `.env`, logs, fixtures, historial de terminal o entradas de la aplicación.
- [ ] Vaqcrow y sus formularios solicitan únicamente direcciones públicas; nunca solicitan secretos de wallet.
- [ ] La red y la passphrase se declaran de forma explícita al construir, decodificar, verificar y solicitar la firma de una transacción.
- [ ] La dirección pública y la red activa se vuelven a verificar antes de cada firma de demostración.
- [ ] Cuando sea práctico, inversor, PyME y distribución utilizan cuentas descartables separadas.

<a id="referencias-oficiales-de-preparacion"></a>
### 9. Referencias oficiales de preparación

Fuentes oficiales consultadas y verificadas el **2026-09-14**:

- [Git: `git version`](https://git-scm.com/docs/git-version), [Node.js: `--version`](https://nodejs.org/api/cli.html#-v---version) y [pnpm CLI](https://pnpm.io/pnpm-cli): órdenes de comprobación de disponibilidad y versión.
- [Workspaces de pnpm](https://pnpm.io/workspaces) y [`pnpm add`](https://pnpm.io/cli/add): dependencias declaradas por proyecto, manifiestos del workspace y diferencia respecto de una instalación global.
- [SDKs cliente de Stellar](https://developers.stellar.org/docs/tools/sdks/client-sdks): `@stellar/stellar-sdk` para construir transacciones y comunicarse con Horizon.
- [Instalación de Freighter](https://docs.freighter.app/extension-freighter-api/installation.md), [sitio oficial de Freighter](https://www.freighter.app) y [guía frontend de Stellar](https://developers.stellar.org/docs/build/guides/dapps/frontend-guide): tiendas oficiales, navegadores presentados para la extensión y requisito de origen seguro.
- [Conexión](https://docs.freighter.app/extension-freighter-api/connecting.md), [lectura de dirección y red](https://docs.freighter.app/extension-freighter-api/reading-data.md) y [firma](https://docs.freighter.app/extension-freighter-api/signing.md): detección, autorización, dirección pública, red, passphrase y firma mediante Freighter.
- [Redes y Friendbot](https://developers.stellar.org/docs/networks) y [fondeo de cuentas en Stellar Lab](https://developers.stellar.org/docs/tools/lab/account): Testnet, passphrase, XLM sin valor real y fondeo oficial mediante dirección pública.
- [Preparación para contratos inteligentes](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup): Rust `1.84.0` o superior, `rustup`, `cargo` y target `wasm32v1-none` por toolchain.
- [Uso básico de rustup](https://rust-lang.github.io/rustup/basics.html), [targets con rustup](https://rust-lang.github.io/rustup/cross-compilation.html), [versión de rustc](https://doc.rust-lang.org/rustc/command-line-arguments.html#-v--version-print-a-version) y [versión de Cargo](https://doc.rust-lang.org/cargo/commands/cargo-version.html): comprobación del toolchain y de los targets instalados.
- [Instalación de Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli) y [manual de Stellar CLI](https://developers.stellar.org/docs/tools/cli/stellar-cli): órdenes `cargo install --locked stellar-cli` y `stellar version`.
- [Estructura de un contrato Stellar](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world): workspace Rust, manifiestos Cargo y dependencia `soroban-sdk`.

<a id="parte-3"></a>
## Parte 3 — Plan de pruebas y gates de decisión

Esta parte define las pruebas obligatorias del camino clásico, las pruebas opcionales de Soroban y los gates de decisión que controlan cuándo puede avanzar cada camino.

<a id="pruebas-obligatorias-testnet"></a>
### 1. Plan de pruebas obligatorio de transferencias Testnet

Todas las pruebas de esta sección son **obligatorias**. Deben ejecutarse y documentarse antes de considerar completa la integración clásica. El orden entre los bloques es secuencial: los unit tests sin red se verifican primero, luego el preflight en Testnet, luego las pruebas negativas y finalmente la evidencia se archiva.

<a id="unit-tests-sin-red"></a>
#### a. Unit tests determinísticos sin red

Estas pruebas no dependen de Testnet, Horizon ni Freighter. Verifican la lógica de construcción y validación de transacciones de forma aislada y repetible.

| Categoría | Qué se verifica | Criterio de aceptación |
|---|---|---|
| **Construcción de XDR** | La función que construye la transacción clásica (operaciones, fees, secuencia, memos, timebounds) genera un XDR válido. | El XDR decodifica sin errores y contiene los campos exactos esperados. |
| **Firma y verificación** | La verificación de firma admite una transacción correctamente firmada y rechaza una transacción con firma alterada o ausente. | Se prueban al menos dos casos positivos (firmas distintas) y dos negativos (firma alterada, firma ausente). |
| **Validación de memo** | Se verifican los distintos tipos de memo soportados (`none`, `text`, `id`, `hash`, `return`) y sus límites de longitud. | Un memo que excede el límite o contiene caracteres inválidos produce un error controlado. |
| **Validación de dirección** | La validación de direcciones Stellar acepta direcciones válidas de Testnet y rechaza cadenas malformadas, direcciones de otras redes y cadenas vacías. | Se prueban al menos 3 direcciones válidas y 4 inválidas con motivos distintos. |
| **Validación de activo** | Se verifican las funciones que construyen `Asset` a partir de código y emisor, incluyendo el caso del activo nativo (XLM). | Se prueban activos nativos, emitidos y un caso con código inválido. |
| **Idempotencia de construcción** | Dados los mismos parámetros de entrada, la función de construcción produce la misma transacción base (mismo XDR decodificable). | Se ejecutan al menos 3 construcciones idénticas y se compara el XDR decodificado. |

Estas pruebas deben ejecutarse en el pipeline de CI sin conexión de red y sin mocks externos. La infraestructura de pruebas del monorepo (issue [#47 — `Task: Implement set up deterministic testing and ci gates`](https://github.com/reyduar/Vaqcrow/issues/47)) es la base que las sustenta.

<a id="preflight-testnet"></a>
#### b. Preflight manual acotado en Testnet

Este flujo se ejecuta una vez por cada escenario de demostración (fondeo de inversor, distribución a PyME, distribución de revenue share). Es manual, observado y documentado con capturas de cada paso.

| Paso | Acción | Verificación explícita |
|---|---|---|
| 1 | Abrir Freighter en el navegador y seleccionar **Testnet**. | Freighter muestra `TESTNET` y la dirección pública activa. |
| 2 | Verificar que la dirección en Freighter coincide con la dirección esperada para el rol (inversor, PyME o distribución). | `getAddress()` retorna la dirección registrada en los fixtures. |
| 3 | El backend construye la transacción (operación, fees, secuencia, memo, timebounds) sin tocar la clave privada. | La transacción construida se puede decodificar y contiene los campos correctos. |
| 4 | El frontend solicita a Freighter la revisión y firma del XDR. La persona usuaria revisa la transacción en el popup de Freighter. | Freighter muestra los detalles de la operación y la persona usuaria confirma. |
| 5 | El backend recibe el XDR firmado y revalida los invariantes: misma red, misma secuencia, mismo destino, mismo monto, mismo memo, mismo activo, timebounds vigentes. | Si algún invariante falla, la transacción no se envía y se registra el motivo. |
| 6 | El backend envía la transacción firmada a Horizon mediante `POST /transactions`. | Horizon responde con `hash` y estado `submitted` o `pending`. |
| 7 | El backend polla Horizon mediante `GET /transactions/:hash` hasta obtener estado `completed` o `failed`. | Se documenta el número de intentos de polling y el estado final. |
| 8 | Se registra el hash de la transacción y se construye el enlace al explorador de Stellar Lab. | El enlace abre la transacción en el explorador y muestra el resultado correcto. |

**Reintentos:** si Horizon responde con un error de red o timeout, el backend debe reintentar el polling con backoff exponencial, con un máximo de 5 intentos. Si todos fallan, se registra el estado como `timeout` y se documenta el último error.

**Seguridad:** en ningún paso la clave privada abandona Freighter. El backend solo manipula XDR construidos y firmados; nunca recibe ni almacena secretos.

<a id="pruebas-negativas"></a>
#### c. Pruebas negativas

Las pruebas negativas verifican que el sistema rechaza correctamente condiciones inválidas o adversas. Cada caso debe producir un error controlado, no una falla no manejada.

| Categoría | Casos requeridos | Comportamiento esperado |
|---|---|---|
| **Rechazo de firma** | La persona usuaria rechaza la firma en Freighter. | El frontend recibe el rechazo, el backend no intenta enviar, el estado queda `rejected`. |
| **Red incorrecta** | Freighter está configurado en Mainnet o en una red distinta a Testnet. | El backend rechaza la transacción antes de solicitar firma; o rechaza el XDR firmado después de la revalidación. |
| **XDR alterado** | Se modifica un byte del XDR construido antes de enviarlo a Horizon. | Horizon rechaza la transacción; el backend registra el error y no reintenta. |
| **Cuenta fuente incorrecta** | La transacción construida usa una cuenta fuente distinta a la que Freighter firma. | La revalidación posterior a la firma detecta la discrepancia y aborta. |
| **Destino incorrecto** | Se cambia la dirección destino de la operación. | La revalidación detecta el cambio y aborta. |
| **Activo incorrecto** | Se usa un activo distinto al esperado. | La revalidación detecta el cambio y aborta. |
| **Monto incorrecto** | Se modifica el monto de la operación. | La revalidación detecta el cambio y aborta. |
| **Memo incorrecto** | Se modifica el contenido o tipo del memo. | La revalidación detecta el cambio y aborta. |
| **Timebound expirado** | La transacción tiene un `timeBounds.maxTime` en el pasado. | Horizon rechaza la transacción; el backend registra el error `expired`. |
| **Secuencia obsoleta** | La secuencia de la transacción no coincide con la secuencia actual de la cuenta en Horizon. | Horizon rechaza la transacción con error de secuencia; el backend reconstruye o rechaza. |
| **Duplicación / idempotencia** | Se intenta enviar la misma transacción firmada dos veces. | La segunda recepción retorna la misma respuesta que la primera (idempotencia de Horizon). No se crea una nueva transacción. |
| **Saldo insuficiente** | La cuenta fuente no tiene suficientes XLM para cubrir la operación y los fees. | Horizon rechaza la transacción con error de fondos; el backend registra y no reintenta. |
| **Trustline faltante** | Se intenta enviar un activo emitido para el que la cuenta destino no tiene trustline. | Horizon rechaza la transacción; el backend registra el error específico. |
| **Horizon caído / timeout** | Horizon no responde o tarda más de 10 segundos. | El backend aplica backoff exponencial (máximo 5 intentos), registra cada intento y retorna estado `timeout`. |

Cada caso negativo debe tener al menos una prueba automatizada para las categorías verificables sin red (rechazo de firma, XDR alterado, secuencia obsoleta, idempotencia) y una prueba manual documentada para las categorías que requieren interacción con Freighter (red incorrecta, rechazo de firma por la persona usuaria).

<a id="checklist-evidencia"></a>
#### d. Checklist de evidencia y limpieza

Al finalizar cada ejecución del preflight manual, se completa la siguiente evidencia:

| Evidencia | Formato | Ubicación |
|---|---|---|
| Hash de cada transacción enviada | Texto con enlace al explorador de Stellar Lab | Archivo de evidencia de la demo o dashboard de evidencia (issue [#92 — `Task: Implement evidence dashboard`](https://github.com/reyduar/Vaqcrow/issues/92)). |
| Estado final de cada transacción | `completed` o `failed` con código de error si aplica | Mismo archivo de evidencia. |
| Captura de pantalla de Freighter en cada firma | Imagen | Directorio de evidencia de la demo. |
| Log de cada intento de polling de Horizon | Texto con timestamps | Logs de la aplicación o archivo de evidencia. |
| Dirección pública y rol de cada cuenta usada | Tabla | Registro visible en el dashboard de evidencia. |

**Limpieza y rotación de cuentas descartables:**

- Las cuentas de Testnet usadas en cada demo son descartables y no se reutilizan entre demos sin un reinicio explícito.
- Después de cada demo, se fondean nuevas cuentas con Friendbot para la siguiente ejecución.
- Las cuentas anteriores no se borran (Testnet no lo requiere), pero se registran como inactivas en el registro de evidencia.
- Si se detecta que una cuenta descartable acumuló fondos reales por error, se documenta el incidente y se descarta la cuenta.

<a id="pruebas-opcionales-soroban"></a>
### 2. Plan de pruebas opcional de smart contracts Soroban

> **Esta sección NO es requerida para el camino obligatorio.** Solo se ejecuta si el stretch goal Soroban recibe autorización después de estabilizar los pagos clásicos. Si existe algún riesgo de que las pruebas de Soroban retrasen la demo clásica, se aplica el gate de la [sección 3.b](#gate-soroban) y se elimina esta sección del plan.

#### a. Unit tests Rust locales

Las pruebas unitarias del contrato se ejecutan con `cargo test` dentro del workspace Rust del contrato. El entorno de prueba de Soroban (`Env::default()`) simula la blockchain localmente sin necesidad de una red.

| Qué se verifica | Criterio |
|---|---|
| Funciones públicas del contrato con entradas válidas. | Retornan el valor esperado. |
| Funciones públicas con entradas inválidas o fuera de rango. | Retoran error controlado o panic esperado. |
| Autorizaciones: el contrato solicita autorización de la cuenta correcta. | Las pruebas usan `env.mock_all_auths()` o auths explícitas y verifican que se solicitaron a las cuentas correctas. |
| Almacenamiento: los valores escritos en `PersistentStorage`, `TemporaryStorage` o `InstanceStorage` se leen correctamente después de la escritura. | Round-trip de lectura-escritura verificado. |
| TTL: las entradas temporales expiran después del TTL configurado. | Se avanza el tiempo del `Env` y se verifica que la entrada ya no existe. |
| Eventos: el contrato emite los eventos esperados con los datos correctos. | Se capturan los eventos del `Env` y se comparan con los esperados. |

#### b. Build WASM

El contrato se compila a Wasm con `stellar contract build`. El artefacto resultante se verifica:

| Verificación | Criterio |
|---|---|
| El archivo `.wasm` existe en `target/wasm32v1-none/release/`. | La compilación termina sin errores. |
| El tamaño del `.wasm` no excede el límite de la red (128 KB en Mainnet, valor que puede cambiar). | Se registra el tamaño; si excede el límite, se optimiza o se reduce. |
| El `.wasm` contiene la especificación / interfaz del contrato. | Se verifica con `stellar contract inspect` o herramienta equivalente. |

#### c. Deploy local/sandbox o Testnet aislado

| Opción | Cuándo usarla | Riesgo |
|---|---|---|
| **Sandbox local** (`stellar contract deploy --sandbox`) | Desarrollo iterativo rápido; no toca Testnet. | No valida comportamiento real de red. |
| **Testnet aislado** (`stellar contract deploy --network testnet`) | Validación final antes de la demo. | Consume XLM de prueba; requiere cuentas descartables separadas. |

En ambos casos se registra el `contract ID` asignado y la transacción de deploy.

#### d. Invocación y pruebas del contrato

| Categoría | Qué se verifica | Herramienta |
|---|---|---|
| **Invocación básica** | La función del contrato se invoca con parámetros válidos y retorna el resultado esperado. | `stellar contract invoke` o tests Rust con el cliente generado. |
| **Autorización** | Las funciones que requieren autorización la solicitan a la cuenta correcta; la persona usuaria o el test la aprueban. | `env.mock_all_auths()` en tests; invocación manual con Freighter en Testnet. |
| **Storage y TTL** | Los valores persistidos se leen después de la escritura; las entradas temporales expiran según el TTL. | Tests Rust con avance de tiempo; invocación manual y re-lectura. |
| **Eventos** | Los eventos emitidos por el contrato contienen los datos correctos y se pueden consultar. | Tests Rust con `env.events().all()`; consulta vía Horizon o RPC en Testnet. |
| **Recursos y fees** | La invocación no excede los límites de recursos de la red; los fees son razonables. | `--cost` o inspección de la transacción resultante. |
| **Upgrades** | El contrato puede actualizarse sin perder estado. | Deploy de una segunda versión con el mismo contract ID y verificación de estado. |

#### e. Captura de contract ID y evidencia

| Evidencia | Formato |
|---|---|
| Contract ID | Texto con enlace al explorador. |
| Transacción de deploy | Hash con enlace al explorador. |
| Transacciones de invocación | Hashes con enlaces al explorador. |
| Logs de pruebas Rust | Salida de `cargo test` archivada. |

#### f. Gate explícito go/no-go

Antes de iniciar cualquier trabajo de pruebas Soroban, se evalúa:

- [ ] Los pagos clásicos (fondeo, distribución) están estables y documentados.
- [ ] La demo clásica se ha ejecutado al menos una vez completa sin errores.
- [ ] Existe un issue canónico aprobado para el contrato inteligente específico.
- [ ] El equipo tiene capacidad adicional sin riesgo para la demo clásica.

Si cualquiera de estos ítems no se cumple, **no se inician las pruebas de Soroban**. El stretch goal se pospone hasta que el camino obligatorio esté completamente validado.

<a id="gates-de-decision"></a>
### 3. Gates de decisión

Los gates de decisión controlan el avance entre fases. Son binarios: se cumple o no se cumple. No hay excepciones parciales.

<a id="dor-antes-de-74"></a>
#### a. Definition of ready antes de #74

El issue [#74 — `Task: Implement Stellar and Freighter integration`](https://github.com/reyduar/Vaqcrow/issues/74) no puede iniciarse hasta que se cumplan **todos** los siguientes condiciones:

| # | Condición | Fuente de verificación |
|---|---|---|
| 1 | El equipo tiene Git, Node.js y pnpm instalados y verificados (Parte 2, sección 2). | Registro de comprobación del equipo. |
| 2 | Freighter está instalado, habilitado y configurado en Testnet con una cuenta descartable fondeada (Parte 2, sección 4). | Captura de pantalla o registro de la preparación. |
| 3 | Las dependencias `@stellar/stellar-sdk` y `@stellar/freighter-api` están declaradas en los manifiestos del workspace correspondiente (Parte 2, sección 3). | Inspección de los archivos `package.json`. |
| 4 | Los unit tests determinísticos sin red están escritos y pasan (Parte 3, sección 1.a). | Salida de la suite de pruebas en CI. |
| 5 | El issue [#23 — `Feature: Encapsulate Stellar and Freighter integration`](https://github.com/reyduar/Vaqcrow/issues/23) está abierto y asignado. | Estado del issue en GitHub. |
| 6 | La lista de seguridad de Parte 2, sección 8 está completa y verificada. | Checklist firmado por al menos una persona del equipo. |

Si alguna condición no se cumple, el issue #74 permanece bloqueado y se resuelve la dependencia antes de continuar.

<a id="gate-soroban"></a>
#### b. Gate separado antes de issues Soroban

Ningún issue de contratos inteligentes o integración Soroban puede crearse o iniciarse hasta que se cumplan **todos** los siguientes condiciones:

| # | Condición | Fuente de verificación |
|---|---|---|
| 1 | El camino clásico completo (fondeo, confirmación, distribución) está implementado y verificado. | Issues #74–#91 cerrados con evidencia documentada. |
| 2 | La demo clásica se ha ejecutado al menos una vez completa sin errores en Testnet. | Registro de la ejecución de la demo. |
| 3 | El issue canónico para el contrato inteligente específico está aprobado y priorizado. | Estado del issue en GitHub. |
| 4 | El equipo tiene capacidad adicional confirmada sin riesgo para el camino clásico. | Decisión explícita del equipo o responsable. |
| 5 | El toolchain de Rust y Stellar CLI están instalados y verificados (Parte 2, sección 5). | Registro de comprobación del equipo. |

Si cualquiera de estas condiciones no se cumple, no se crea ningún issue Soroban. El stretch goal se pospone indefinidamente hasta que el camino obligatorio esté completamente validado y el equipo tenga capacidad.

**Regla de emergencia:** si en algún momento durante el desarrollo de Soroban se detecta que el camino clásico se ha degradado o que las pruebas de Soroban retrasan la demo, se detiene inmediatamente el trabajo de Soroban y se regresa al camino clásico. La prioridad absoluta es la demo funcional con pagos clásicos.

<a id="parte-4"></a>
## Parte 4 — Cierre, skills, seguridad y verificación

Esta parte consolida las skills recomendadas, los convenios de seguridad y arquitectura, las fuentes oficiales, la definition of ready y el checklist de verificación final del documento.

<a id="skills-recomendadas"></a>
### 1. Tabla de skills recomendadas

Las skills se cargan en el agente de IA según la tarea en curso. Ninguna skill garantiza correctness ni reemplaza pruebas automatizadas o revisión humana. La selección se basa en la relevancia para Stellar, la reputación del maintainer y la cobertura de los escenarios de Vaqcrow.

| Skill | Repositorio | Foco | Evidencia (2026-09-14) | Evaluación de confianza | Instalación (Claude Code) | Cuándo cargarla |
|---|---|---|---|---|---|---|
| **stellar-dev** | [stellar/stellar-dev-skill](https://github.com/stellar/stellar-dev-skill) | Dapp frontend, smart contracts, assets, data/APIs, agentic payments, standards (SEPs/CAPs). Incluye sub-skills: `dapp`, `smart-contracts`, `assets`, `data`, `agentic-payments`, `zk-proofs`, `standards`, `cross-chain`. | 51 estrellas, 50 forks, 284 commits, Apache-2.0, mantenida por Stellar Foundation. | **Alta** — oficial, activa, evals incluidos, documentación cita fuentes oficiales. | `/plugin marketplace add stellar/stellar-dev-skill` → `/plugin install stellar-dev@stellar-dev` | Cualquier tarea de Stellar: frontend, contratos, assets, API, integración. |
| **setup-stellar-contracts** | [OpenZeppelin/openzeppelin-skills](https://github.com/OpenZeppelin/openzeppelin-skills) | Setup de proyecto Stellar/Soroban, dependencias OpenZeppelin, patrones de importación. | 210 estrellas, 32 forks, 42 commits, AGPL-3.0, mantenida por OpenZeppelin. | **Alta** — oficial, activa, cubre setup y dependencias de OpenZeppelin para Stellar. | `/plugin marketplace add OpenZeppelin/openzeppelin-skills` → `/plugin install openzeppelin-skills` | Solo si se autoriza Soroban: setup de proyecto, dependencias, patrones de contratos. |
| **develop-secure-contracts** | [OpenZeppelin/openzeppelin-skills](https://github.com/OpenZeppelin/openzeppelin-skills) | Desarrollo seguro de contratos: tokens, acceso, pausable, reentrancy, governance, upgrades. Soporta Stellar. | Misma reputación que setup-stellar-contracts. | **Alta** — oficial, cubre seguridad y patrones de contratos Stellar. | `/plugin marketplace add OpenZeppelin/openzeppelin-skills` → `/plugin install openzeppelin-skills` | Solo si se autoriza Soroban: desarrollo y revisión de seguridad de contratos. |

**Skills genéricas (opcionales, secundarias):**

| Skill | Repositorio | Foco | Cuándo cargarla |
|---|---|---|---|
| **find-skills** | (disponible localmente) | Descubrir e instalar skills nuevas. | Cuando se necesite una skill no listada. |
| **skill-creator** | (disponible localmente) | Crear skills nuevas. | Solo si se documenta un patrón repetible del proyecto. |

**Nota importante:** Las skills de Stellar Foundation y OpenZeppelin son complementarias, no contradictorias. `stellar-dev` cubre el espectro completo de Stellar (dapps, contratos, APIs, assets). `setup-stellar-contracts` y `develop-secure-contracts` profundizan en el setup y la seguridad de contratos con las librerías de OpenZeppelin. Para Vaqcrow, la skill primaria es `stellar-dev` (camino clásico y general). Las skills de OpenZeppelin solo se cargan si se autoriza Soroban.

<a id="convenios-seguridad"></a>
### 2. Convenios de seguridad y arquitectura

Los siguientes convenios consolidan las reglas de seguridad y arquitectura que atraviesan las 4 partes del documento. Están alineados con Clean Architecture: los adaptadores interfieran con el mundo exterior, los dominios y aplicaciones permanecen puros.

#### Frontend

| Convenio | Regla | Referencia |
|---|---|---|
| **Freighter como único adaptador** | El frontend solo interactúa con Stellar a través de `@stellar/freighter-api`. No existe `@stellar/stellar-sdk` en el frontend. | Parte 2, sección 3; [SDKs cliente de Stellar](https://developers.stellar.org/docs/tools/sdks/client-sdks). |
| **No SDK en dominio/aplicación** | La capa de dominio y la capa de aplicación del frontend no importan ni usan `@stellar/stellar-sdk`. Solo los adaptadores de infraestructura la usan. | Clean Architecture: los adaptadores interfieran, el dominio no depende de frameworks. |
| **Solo direcciones públicas** | El frontend solicita y muestra únicamente direcciones públicas. Nunca solicita, recibe ni almacena seeds, claves privadas o frases de recuperación. | Parte 2, sección 4; [Firma con Freighter](https://docs.freighter.app/extension-freighter-api/signing.md). |
| **Red explícita** | El frontend verifica y muestra la red activa (`TESTNET`) antes de cada firma. La passphrase se declara de forma explícita. | Parte 2, sección 4; [Redes](https://developers.stellar.org/docs/networks). |

#### Backend

| Convenio | Regla | Referencia |
|---|---|---|
| **XDR/Horizon como único adaptador** | El backend solo interactúa con Stellar a través de `@stellar/stellar-sdk` para construir, verificar y enviar XDR, y para consultar Horizon. No existe `@stellar/freighter-api` en el backend. | Parte 2, sección 3. |
| **No SDK en dominio/aplicación** | La capa de dominio y la capa de aplicación del backend no importan ni usan `@stellar/stellar-sdk`. Solo los adaptadores de infraestructura la usan. | Clean Architecture. |
| **Enteros para montos** | Todos los montos se representan como enteros (stroops, no XLM). Nunca se usa punto flotante para cantidades monetarias. Un XLM = 10,000,000 stroops. | [Activos](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets): precisión de activos. |
| **Operaciones permitidas (allowlist)** | Solo se firman y envían las operaciones tipificadas en los adaptadores del proyecto. No se admiten operaciones genéricas ni arbitrarias. | Parte 3, sección 1.c: pruebas negativas. |
| **Red/passphrase explícitos** | La red y la passphrase se declaran de forma explícita al construir, decodificar, verificar y enviar transacciones. No se asume la red por defecto. | Parte 2, sección 8; [Redes](https://developers.stellar.org/docs/networks). |
| **Verificación server-side de XDR firmado** | Después de recibir el XDR firmado de Freighter, el backend revalida invariantes: misma red, misma secuencia, mismo destino, mismo monto, mismo memo, mismo activo, timebounds vigentes. | Parte 3, sección 1.b, paso 5. |
| **Sin estado confirmed manual** | El estado `confirmed` solo proviene de Horizon (`GET /transactions/:hash` con status `completed`). Nunca se marca manualmente. | Parte 3, sección 1.b, paso 7; [Retrieve a Transaction](https://developers.stellar.org/docs/data/apis/horizon/api-reference/retrieve-a-transaction). |
| **Observabilidad con errores sanitizados** | Los errores de Horizon y de la aplicación se registran con contexto (timestamp, intento, categoría). Los secretos, seeds y datos sensibles nunca aparecen en logs. | Parte 3, sección 1.c; Parte 1, issue [#31](https://github.com/reyduar/Vaqcrow/issues/31). |

#### Global

| Convenio | Regla | Referencia |
|---|---|---|
| **No seeds ni claves privadas en ningún lugar** | No aparecen en el repositorio, archivos `.env`, logs, fixtures, historial de terminal, entradas de la aplicación ni capturas de pantalla. | Parte 2, sección 8; [Firma con Freighter](https://docs.freighter.app/extension-freighter-api/signing.md). |
| **Cuentas descartables** | Todas las cuentas usadas en demo y pruebas son descartables y exclusivas de Testnet. No se reutilizan sin reinicio explícito. | Parte 2, sección 4; Parte 3, sección 1.d. |
| **No Ethereum/EVM** | No se utilizan Solidity, Hardhat, Foundry ni Truffle para contratos Stellar. Son herramientas del ecosistema EVM y no forman parte del stack decidido. | Parte 2, sección 6. |

<a id="fuentes-oficiales-consolidadas"></a>
### 3. Fuentes oficiales consolidadas

Todas las fuentes oficiales fueron consultadas y verificadas el **2026-09-14**. Se presentan deduplicadas, agrupadas por categoría.

#### Stellar Foundation

| Fuente | URL |
|---|---|
| SDKs cliente de Stellar | https://developers.stellar.org/docs/tools/sdks/client-sdks |
| Cuentas | https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/accounts |
| Redes | https://developers.stellar.org/docs/networks |
| Activos | https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets |
| Operaciones y transacciones | https://developers.stellar.org/docs/learn/fundamentals/transactions/operations-and-transactions |
| Horizon | https://developers.stellar.org/docs/data/apis/horizon |
| Envío de transacciones (Horizon) | https://developers.stellar.org/docs/data/apis/horizon/api-reference/submit-a-transaction |
| Retrieve a Transaction (Horizon) | https://developers.stellar.org/docs/data/apis/horizon/api-reference/retrieve-a-transaction |
| Guía frontend de Stellar | https://developers.stellar.org/docs/build/guides/dapps/frontend-guide |
| Preparación para contratos inteligentes | https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup |
| Hello World (contratos) | https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world |
| Autorización (Soroban) | https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization |
| Almacenamiento y TTL (Soroban) | https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival |
| Eventos (Soroban) | https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/events |
| Recursos y fees (Soroban) | https://developers.stellar.org/docs/learn/fundamentals/fees-resource-limits-metering |
| Tipos numéricos (Soroban) | https://developers.stellar.org/docs/learn/fundamentals/contract-development/types/built-in-types |
| Actualización de contratos (Soroban) | https://developers.stellar.org/docs/build/guides/conventions/upgrading-contracts |
| Instalación de Stellar CLI | https://developers.stellar.org/docs/tools/cli/install-cli |
| Manual de Stellar CLI | https://developers.stellar.org/docs/tools/cli/stellar-cli |

#### Stellar Foundation — Lab / Friendbot

| Fuente | URL |
|---|---|
| Stellar Lab — fondeo de cuentas | https://lab.stellar.org/account/fund |
| Stellar Lab — explorador de transacciones | https://lab.stellar.org |

#### Freighter

| Fuente | URL |
|---|---|
| Sitio oficial de Freighter | https://www.freighter.app |
| Instalación de Freighter | https://docs.freighter.app/extension-freighter-api/installation.md |
| Conexión (connecting) | https://docs.freighter.app/extension-freighter-api/connecting.md |
| Lectura de dirección y red | https://docs.freighter.app/extension-freighter-api/reading-data.md |
| Firma (signing) | https://docs.freighter.app/extension-freighter-api/signing.md |

#### Rust / Cargo

| Fuente | URL |
|---|---|
| Uso básico de rustup | https://rust-lang.github.io/rustup/basics.html |
| Cross-compilation con rustup | https://rust-lang.github.io/rustup/cross-compilation.html |
| Versión de rustc | https://doc.rust-lang.org/rustc/command-line-arguments.html#-v--version-print-a-version |
| Versión de Cargo | https://doc.rust-lang.org/cargo/commands/cargo-version.html |

#### Herramientas de desarrollo

| Fuente | URL |
|---|---|
| Git: `git version` | https://git-scm.com/docs/git-version |
| Node.js: `--version` | https://nodejs.org/api/cli.html#-v---version |
| pnpm CLI | https://pnpm.io/pnpm-cli |
| Workspaces de pnpm | https://pnpm.io/workspaces |
| `pnpm add` | https://pnpm.io/cli/add |

#### Skills de IA

| Fuente | URL |
|---|---|
| stellar-dev-skill (Stellar Foundation) | https://github.com/stellar/stellar-dev-skill |
| openzeppelin-skills (OpenZeppelin) | https://github.com/OpenZeppelin/openzeppelin-skills |
| setup-stellar-contracts (OpenZeppelin) | https://github.com/OpenZeppelin/openzeppelin-skills/blob/main/skills/setup-stellar-contracts/SKILL.md |
| develop-secure-contracts (OpenZeppelin) | https://github.com/OpenZeppelin/openzeppelin-skills/blob/main/skills/develop-secure-contracts/SKILL.md |
| Raven MCP Server (Stellar) | https://raven.stellar.buzz |
| skills.stellar.org | https://skills.stellar.org |

<a id="dor-consolidada"></a>
### 4. Definition of ready consolidada

La siguiente checklist consolida todas las condiciones necesarias para iniciar el trabajo de integración Stellar. Se extrae de la [sección 3.a de la Parte 3](#dor-antes-de-74) y se referencia el origen de cada condición.

| # | Condición | Origen | Verificación |
|---|---|---|---|
| 1 | Git, Node.js y pnpm están instalados y verificados. | Parte 2, sección 2 | Registro de comprobación del equipo. |
| 2 | Freighter está instalado, habilitado y configurado en Testnet con una cuenta descartable fondeada. | Parte 2, sección 4 | Captura de pantalla o registro de la preparación. |
| 3 | Las dependencias `@stellar/stellar-sdk` y `@stellar/freighter-api` están declaradas en los manifiestos del workspace correspondiente. | Parte 2, sección 3 | Inspección de los archivos `package.json`. |
| 4 | Los unit tests determinísticos sin red están escritos y pasan. | Parte 3, sección 1.a | Salida de la suite de pruebas en CI. |
| 5 | El issue [#23](https://github.com/reyduar/Vaqcrow/issues/23) está abierto y asignado. | Parte 1, sección 2 | Estado del issue en GitHub. |
| 6 | La lista de seguridad de Parte 2, sección 8 está completa y verificada. | Parte 2, sección 8 | Checklist firmado por al menos una persona del equipo. |
| 7 | No existen cuentas reales en los archivos de configuración ni en los fixtures de prueba. | Convenio global | Búsqueda de direcciones reales en el repositorio. |
| 8 | El pipeline de CI está operativo y ejecuta las pruebas sin conexión de red. | Parte 3, sección 1.a; issue [#47](https://github.com/reyduar/Vaqcrow/issues/47) | Ejecución exitosa en CI. |

Si alguna condición no se cumple, el issue [#74](https://github.com/reyduar/Vaqcrow/issues/74) permanece bloqueado. No hay excepciones.

<a id="checklist-verificacion-final"></a>
### 5. Checklist de verificación final

Esta es la auto-verificación que el autor del documento ejecuta antes de considerarlo completo. Cada ítems se verifica con evidencia concreta.

| # | Verificación | Evidencia |
|---|---|---|
| 1 | Todos los enlaces internos del documento resuelven. | Verificación automatizada: 27 anchors verificados, 0 faltantes. |
| 2 | La separación obligatorio/opcional es consistente en las 4 partes. | Revisión de que cada mención de "obligatorio" y "opcional" sigue la definición de Parte 1, sección 1. |
| 3 | No hay direcciones de cuentas reales, credenciales, seeds ni datos sensibles de entorno en el documento. | Búsqueda de patrones de direcciones Stellar (`G...`), seeds (`S...`), frases de recuperación, tokens API. |
| 4 | Todos los comandos documentados coinciden con la documentación oficial. | Verificación contra las fuentes oficiales de Stellar, Freighter, Rustup y Cargo (2026-09-14). |
| 5 | No se recomienda ningún tooling Ethereum/EVM para contratos Stellar. | Búsqueda de menciones a Solidity, Hardhat, Foundry, Truffle en el documento. |
| 6 | El `git status` muestra solo las entradas esperadas. | Verificación: `M docs/planning/DEMO.md`, `?? docs/planning/demo-tasks-list.md`, `?? docs/planning/stellar-blockchain-requirements.md`. |
| 7 | El documento no contiene caracteres CJK o secuencias de codificación inválidas. | Verificación automatizada: 0 caracteres CJK encontrados. |
| 8 | La tabla de skills incluye solo repositorios verificados y activos. | Verificación de GitHub: stellar-dev-skill (51★, 284 commits), openzeppelin-skills (210★, 42 commits). |

**Resultado de la verificación (2026-09-14):** Los 8 ítems pasan. El documento se considera completo.
