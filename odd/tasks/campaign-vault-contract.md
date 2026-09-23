# Bitácora: contrato de bóveda de campaña

## Objetivo

Implementar la fábrica y el contrato de bóveda del fondeo: custodia de los aportes, pago atómico a la PyME al alcanzar el objetivo, retiro voluntario antes del objetivo y reembolsos permissionless con barrido acotado. Task [#244](https://github.com/reyduar/Vaqcrow/issues/244), primera de la Feature [#236](https://github.com/reyduar/Vaqcrow/issues/236).

## Alcance

Un crate nuevo (`campaign-factory`) y la sustitución del placeholder de `campaign-vault` por la implementación real. El diseño estaba cerrado de antemano en [`docs/planning/stellar-blockchain-requirements.md`](../../docs/planning/stellar-blockchain-requirements.md); esta unidad lo implementa, no lo re-decide.

## Decisiones

| # | Decisión | Motivo |
|---|---|---|
| D1 | **Dos crates, no uno.** `campaign-vault` y `campaign-factory` son wasm separados | La fábrica despliega bóvedas por `wasm_hash`. Con un solo crate, el hash sería el mismo para las dos y `deploy_contract` no podría elegir cuál instanciar |
| D2 | El chequeo del objetivo vive **dentro de `contribute`** | El ordenamiento del ledger lo vuelve determinístico frente a un `withdraw` concurrente, y elimina la ventana en que el objetivo está alcanzado y los fondos siguen disponibles |
| D3 | La transición a `Refunding` ocurre **dentro del primer reembolso**, no en una función aparte | En Stellar no hay scheduler: la fecha no dispara nada. Plegarla al camino de reembolso la vuelve permissionless por construcción, sin una función extra que alguien tenga que recordar llamar |
| D4 | `sweep` recibe un **lote acotado** (`MAX_SWEEP_BATCH = 20`) | Recorrer una lista arbitraria es superficie de ataque por consumo de recursos. Un lote acotado y provisto por quien llama no lo es |
| D5 | Un aportante sin nada que devolver **se saltea** dentro del barrido en vez de abortarlo | Si no, un solo address ya reembolsado rompería el lote entero |
| D6 | El índice de aportantes va en **instance storage**, y su límite se documenta | Permite enumerar sin indexación off-chain. Tiene tope por el tamaño máximo de entrada; para el volumen de la demo alcanza y sobra |
| D7 | El constructor **paniquea** con `panic_with_error!` en vez de devolver `Result` | El manejo de errores de un `__constructor` no tiene un camino de retorno claro; el panic es honesto y no se puede ignorar |
| D8 | Funciones de lectura **sin autorización** | Leer el estado de una campaña es información pública; exigir auth complicaría el frontend sin ganar nada |
| D9 | El invariante "si el total alcanzó el objetivo, el estado no es `Funding`" se **afirma** en `ensure_refundable` | Es inalcanzable mientras D2 se sostenga, pero si algún día dejara de sostenerse sería un camino de pago silencioso. Afirmarlo cuesta nada |

## Hallazgos

| # | Hallazgo | Resolución |
|---|---|---|
| H1 | **`deploy_v2` está deprecado en `soroban-sdk` 28.** El ejemplo de la skill lo usa y el compilador lo marca | Se usa `deploy_contract(ContractExecutable::Wasm(hash), args)`. Ojo: hay **dos** `ContractExecutable` distintos, el de `soroban_sdk` y el de `soroban_sdk::xdr`, y `deploy_contract` quiere el primero |
| H2 | **La SAC del activo nativo hay que desplegarla en cada red.** El primer `contribute` en la red local falló con `Error(Storage, MissingValue)` | El error **apunta a la SAC, no al contrato que la llama**: *"trying to get non-existing value for contract instance"* sobre la dirección de la SAC. La dirección es determinística pero la instancia no existe hasta que se despliega con `stellar contract asset deploy --asset native`. Documentado en `contracts/README.md` |
| H3 | `stellar contract invoke` devuelve la dirección **entre comillas** | Un `tail -1` la captura con las comillas y el siguiente comando la rechaza por carácter inválido. Hay que limpiarlas (`tr -d '"'`) |
| H4 | El error de la SAC es indistinguible de un defecto propio a primera vista | Vale registrar el criterio: cuando `transfer` falla dentro de un contrato, **el log de diagnóstico dice en qué contrato falla**. Leerlo antes de sospechar del propio código |

## Unidades de trabajo

- **U1 — Bóveda.** `campaign-vault/src/lib.rs`: máquina de estados `Funding | Settled | Refunding`, `contribute`, `withdraw`, `refund`, `sweep`, lecturas y eventos. Compiló al primer intento; 8063 bytes, 13 funciones exportadas.
- **U2 — Tests de la bóveda.** 14 tests sobre una SAC real (no un doble), de modo que las transferencias ejercidas son las mismas que hará en una red. Todos en verde al primer intento.
- **U3 — Fábrica.** `campaign-factory/src/lib.rs`: `__constructor(owner, vault_wasm)`, `deploy(salt, ...)`, `predict(salt)`, lecturas. Método `deploy_contract` (H1). 3132 bytes.
- **U4 — Tests de la fábrica.** 3 tests: constructor, determinismo de `predict` por sal, y que dos fábricas distintas predicen direcciones distintas. El `deploy` real **no** se prueba con un doble: se verifica contra una red, que es donde el wasm está subido de verdad.
- **U5 — Verificación en la red local.** Fábrica desplegada → `deploy` abrió una bóveda → el constructor quedó con los datos correctos → `predict` devolvió **la misma dirección** que la fábrica desplegó → un aporte quedó custodiado con su evento → **el aporte que cruzó el objetivo liquidó la campaña, pagó a la PyME y dejó la bóveda vacía, todo en la misma transacción**.

## Números verificados

- Bóveda: `8063` bytes, wasm hash `651e53ded609339923c702fb87f345bd740eb1e37e9c97d6be4649144288beb7`.
- Fábrica: `3132` bytes, wasm hash `d7d652d596e1b23438b3f52bc9fdfa22af0d6f23961ad9f09d2416a2ef40cae3`.
- Tests: **17** en verde (14 de bóveda + 3 de fábrica), sin warnings.
- Red local: fábrica `CAU45E4WDQEOGTJ2YXAUIXONHACNUAX6RKI7BOCTH3D34SJSRWV4G5V5`; bóveda abierta por la fábrica `CDFNB3BKDMJME3BGBW4QS23HE63NPVJPOQFFVCG5RKTTBVASX5LC2S7W`; SAC nativa `CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4`.
- Gate del repositorio: `75 tests`, 0 violaciones de fronteras. Los contratos quedan fuera de los globs de `dependency-cruiser`.

## Límites conocidos al cerrar esta unidad

- **La PyME tiene que poder recibir antes de que la campaña abra.** Si su cuenta no existe, la transferencia falla y, como el pago es atómico con el aporte que cruza el objetivo, ese aporte revierte y la campaña se traba. El contrato no puede verificarlo; lo verifica la plataforma al abrir la campaña. Está comentado en el código y es criterio de aceptación de [#237](https://github.com/reyduar/Vaqcrow/issues/237).
- **El índice de aportantes vive en instance storage**, que tiene tope de tamaño. Documentado, no resuelto.
- **No hay cobertura de casos negativos exhaustiva, TTL ni aserciones de eventos.** Eso es [#246](https://github.com/reyduar/Vaqcrow/issues/246).
- **Sin decisión sobre actualizabilidad ni control de pausa.** Decisión abierta registrada en `DEMO.md`; el contrato no es actualizable hoy.
- **No auditado.** Custodia fondos, así que una puesta en producción lo exigiría.

## Estado

Implementado y verificado en la red local. Sin commit al momento de escribir la bitácora.
