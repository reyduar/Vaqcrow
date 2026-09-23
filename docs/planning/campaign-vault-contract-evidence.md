# Evidencia de cierre de la Feature #236 — Issue #245

> Documento de cierre de Feature. Consolida y cita la evidencia ya verificada de las Tasks [#244](https://github.com/reyduar/Vaqcrow/issues/244) y [#246](https://github.com/reyduar/Vaqcrow/issues/246), agrega únicamente lo que ninguna de las dos documenta (el mapeo contra los criterios de aceptación propios de la Feature #236 y de sus tres Tasks, los límites operativos vigentes como conjunto, y las correcciones aplicadas durante el ciclo), y no re-deriva los números que ya quedaron asentados en la bitácora de iteración. No reemplaza a [`odd/tasks/campaign-vault-contract.md`](../../odd/tasks/campaign-vault-contract.md), que sigue siendo la fuente de verdad de cómo se hizo el trabajo.

## 1. Contexto y objetivo

La Feature [#236](https://github.com/reyduar/Vaqcrow/issues/236) ("Feature: Implement the campaign vault contract") entrega el **camino de fondeo** de la demo: un contrato que custodia los aportes de una campaña, decide la condición de objetivo contra el ledger y mueve los fondos. Nadie —ni la plataforma, ni la PyME— puede redirigirlos.

Es la segunda Feature del Epic [#235](https://github.com/reyduar/Vaqcrow/issues/235) y el punto donde el fondeo deja de ser un pago clásico verificado por XDR. La decisión, el descarte de Claimable Balance y la máquina de estados están en [`stellar-blockchain-requirements.md`](./stellar-blockchain-requirements.md).

Se entregó en tres Tasks:

| Task | Issue | Entrega |
|---|---|---|
| Implementar | [#244](https://github.com/reyduar/Vaqcrow/issues/244) | PR [#264](https://github.com/reyduar/Vaqcrow/pull/264) — commit `b4dfc33`, merge `cd96797` |
| Probar | [#246](https://github.com/reyduar/Vaqcrow/issues/246) | PR [#265](https://github.com/reyduar/Vaqcrow/pull/265) — commits `f749cc2` y `fd2ea52`, merge `3918923` |
| Documentar evidencia | [#245](https://github.com/reyduar/Vaqcrow/issues/245) | este documento |

**Dos contratos, no uno.** `campaign-vault` es una instancia **por campaña**; `campaign-factory` se despliega una vez, no custodia fondos y abre las bóvedas. Esa separación es lo que da **segregación de fondos a nivel ledger**: cada campaña es su propia dirección con su propio balance, en vez de un contrato compartido donde el dinero de cada campaña sería un asiento dentro de un mapa.

La Feature se cierra manualmente al terminar #245 (GitHub no cierra Features al completarse sus sub-issues, mismo patrón que #11 a #19, #23 y #238). Al cerrarse habilita [#237](https://github.com/reyduar/Vaqcrow/issues/237), la integración web.

## 2. Cómo leer esta evidencia

- **Cada resultado nombra su fuente.** Las filas de la sección 4 se re-ejecutaron en este árbol de trabajo, o provienen de un run de CI citado con su identificador, o de una corrida contra Testnet con las direcciones a la vista — y cada fila dice cuál. Nada se infiere.
- **El despliegue en Testnet sí se ejecutó.** A diferencia de la Feature #238, acá el criterio pedía Testnet explícitamente y **se cumplió**: las direcciones de la sección 4 existen en la red pública y se pueden consultar en el explorador.
- **Estado de merge.** Los PRs [#264](https://github.com/reyduar/Vaqcrow/pull/264) y [#265](https://github.com/reyduar/Vaqcrow/pull/265) están **MERGED**. El estado de `main` es `3918923`.
- **Bitácora de iteración.** [`odd/tasks/campaign-vault-contract.md`](../../odd/tasks/campaign-vault-contract.md) es la bitácora de #244: decisiones, hallazgos y límites. Este documento la cita; no la reemplaza.
- **Documento compañero.** [`contracts/README.md`](../../contracts/README.md) es el runbook del workspace: toolchain, red local, comandos y el procedimiento de redeploy tras un reset.

## 3. Qué quedó implementado

**`campaign-vault`.** Máquina de estados `Funding | Settled | Refunding` con esta superficie:

| Función | Autorización | Regla |
|---|---|---|
| `__constructor(sme, token, goal, deadline)` | ninguna (corre al desplegar) | Fija destino, activo, objetivo y fecha. **No vuelve a ejecutarse** |
| `contribute(investor, amount)` | el inversor | Solo en `Funding` y antes de la fecha. Suma el aporte y, si el total alcanza el objetivo, pasa a `Settled` y transfiere a la PyME **en la misma transacción** |
| `withdraw(investor)` | el inversor | Solo en `Funding`. Devuelve el aporte a la dirección registrada |
| `refund(investor)` | **ninguna** | Solo en `Refunding`. El destino lo fija el contrato |
| `sweep(investors)` | **ninguna** | Solo en `Refunding`. Lote **acotado a 20**; saltea a quien no tiene nada que devolver |
| Lecturas | ninguna | `state`, `total`, `goal`, `deadline`, `sme`, `token`, `contribution_of`, `contributors` |

**Tres decisiones que no son obvias y que sostienen el comportamiento:**

1. **El chequeo del objetivo vive dentro de `contribute`.** El ordenamiento del ledger lo vuelve determinístico frente a un `withdraw` concurrente, y elimina la ventana en que el objetivo está alcanzado y los fondos siguen disponibles.
2. **La transición a `Refunding` ocurre dentro del primer reembolso.** En Stellar no hay scheduler: la fecha no dispara nada. Plegarla al camino de reembolso la vuelve permissionless por construcción, sin una función extra que alguien tenga que recordar llamar.
3. **`refund` y `sweep` no piden autorización.** El destino está fijado en el contrato, así que quien dispara no puede redirigir un solo stroop. Eso es lo que permite que la plataforma cierre los reembolsos de quien nunca los pidió, sin que el inversor esté online.

**`campaign-factory`.** `__constructor(owner, vault_wasm)`, `deploy(salt, sme, token, goal, deadline) -> Address` autorizado por el owner, `predict(salt) -> Address`, y lecturas. Emite un evento por despliegue. **El `deploy` es la traza on-chain de la aprobación humana**: si no hay dirección de bóveda, no hay campaña.

## 4. Qué quedó probado

### Tests

| Verificación | Resultado observado | Fuente |
|---|---|---|
| `cargo test` — bóveda | **32 tests**, 0 fallos | Re-ejecutado en este árbol |
| `cargo test` — fábrica | **3 tests**, 0 fallos | Re-ejecutado en este árbol |
| Warnings de compilación | **ninguno** | Re-ejecutado en este árbol |
| `pnpm run verify` (gate del repo) | Exit 0 — **75 tests**, 0 violaciones de fronteras | Re-ejecutado en este árbol sobre `3918923` |
| Autorización registrada | `contribute` y `withdraw` registran exactamente al inversor; **`refund` y `sweep` no registran ninguna** | `contribute_is_authenticated_by_the_investor`, `refund_asks_for_no_authorization_at_all`, y sus pares |
| Defecto del índice de aportantes | **Corregido**: aportar, retirar y volver a aportar listaba al inversor dos veces | `the_index_survives_a_withdraw_and_a_new_contribution` |
| TTL de instancia | Se extiende de `4095` al objetivo `2073600` | `contributing_extends_the_instance_ttl` |
| Fecha vs expiración | Pasada la fecha el contrato sigue rechazando aportes: la fecha se impone por tiempo del ledger, **no** por expiración | `contributing_extends_the_instance_ttl`, `a_contribution_after_the_deadline_is_rejected` |

Los tests de la bóveda usan una **SAC real**, no un doble, así que las transferencias ejercidas son las mismas que hará en una red.

### Artefactos

| Contrato | Tamaño optimizado | Hash del Wasm |
|---|---|---|
| `campaign-vault` | 8090 bytes | `57d91ef0b0ff7c759c665f7722b4db649fbea3f58e4dc1b061bf90ee60e8ca0d` |
| `campaign-factory` | 3132 bytes | `d7d652d596e1b23438b3f52bc9fdfa22af0d6f23961ad9f09d2416a2ef40cae3` |

**El build es reproducible:** los dos hashes son los mismos en la red local y en Testnet, y la fábrica reporta `vault_wasm` igual al hash que se subió.

### Red local — recorrido completo de campaña

`contracts/scripts/campaign-smoke.sh`, que corre en CI:

```
== campaign A: the goal is reached ==
  ok  vault CAJLJYSFEYEXYRX4BL6653HU4ALV2EQZKYZPNXU7RJUOUKA4JFTB53G6, and predict agrees
  ok  400/1000 leaves it Funding
  ok  crossing the goal settled the campaign
  ok  a settled campaign rejects further contributions
== campaign B: the deadline passes without the goal ==
  ok  300/1000 contributed
  ok  the refund returned 300 and moved the campaign to Refunding
campaign smoke passed on 'local'
```

### Testnet — el criterio de despliegue, cumplido

El mismo script contra **Stellar Testnet**, con una cuenta descartable propia:

| | |
|---|---|
| Cuenta desplegadora | `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG` |
| SAC nativa | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| **Fábrica** | `CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ` |
| **Bóveda (campaña A)** | `CCOS3R3EDLYRJSV4DFEQVB7QYBMIGL3ORUDRLV4N2KFAZAL6HNSI47OY` |

```
ok  factory CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ
ok  vault CCOS3R3EDLYRJSV4DFEQVB7QYBMIGL3ORUDRLV4N2KFAZAL6HNSI47OY, and predict agrees
ok  crossing the goal settled the campaign
ok  a settled campaign rejects further contributions
ok  the refund returned 300 and moved the campaign to Refunding
campaign smoke passed on 'testnet'
```

Y **leído de vuelta desde Testnet**, que es lo que vuelve la dirección verificable y no una afirmación:

```
$ stellar contract invoke --id CDVSSQ55... --network testnet -- owner
"GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG"
$ stellar contract invoke --id CDVSSQ55... --network testnet -- vault_wasm
"57d91ef0b0ff7c759c665f7722b4db649fbea3f58e4dc1b061bf90ee60e8ca0d"

$ stellar contract invoke --id CCOS3R3E... --network testnet -- state
1                      # Settled
$ stellar contract invoke --id CCOS3R3E... --network testnet -- total
"1000"
$ stellar contract invoke --id CCOS3R3E... --network testnet -- goal
"1000"
```

La bóveda quedó **`Settled`** con su total de 1000: el objetivo se alcanzó en Testnet y el pago ocurrió. El `vault_wasm` que reporta la fábrica es el mismo hash que produce el build local.

### CI

| Run | Resultado | Fuente |
|---|---|---|
| `35893318669` (push a `main`, merge `3918923`) | `success` — los **tres** jobs | GitHub Actions |
| `35891988252` (PR #265) | `success` — los **tres** jobs, incluido `Contracts` en 3m45s | GitHub Actions |
| `35861182089` (PR #265, **antes** del arreglo) | `failure` en `Contracts` | GitHub Actions |
| `35856846111` (push a `main`, merge de #264) | `failure` en `Contracts` | GitHub Actions |

Las dos últimas filas no son ruido: documentan un defecto real y su corrección, en la sección 7.

## 5. Límites operativos vigentes

- **La cuenta de la PyME tiene que poder recibir antes de que la campaña abra.** Si no existe, la transferencia falla y, como el pago es atómico con el aporte que cruza el objetivo, **ese aporte revierte y la campaña se traba** — ningún aporte posterior puede alcanzar el objetivo tampoco. **El contrato no puede verificarlo**: no hay forma de consultar la existencia de una cuenta desde un contrato. Lo verifica la plataforma al abrir la campaña, y es **criterio de aceptación de [#237](https://github.com/reyduar/Vaqcrow/issues/237)**. Está comentado en el código.
- **El índice de aportantes vive en instance storage**, que tiene tope de tamaño. Documentado desde #244, no resuelto. Para el volumen de la demo alcanza y sobra.
- **Sin decisión sobre actualizabilidad ni control de pausa.** El contrato **no es actualizable** hoy. Es una decisión abierta registrada en `DEMO.md` y es un requisito para cualquier puesta en producción de un contrato que custodia fondos.
- **No auditado.** Custodia fondos; producción lo exigiría.
- **Testnet se resetea.** Las direcciones de la sección 4 son válidas **hasta el próximo reset** (el siguiente agendado es el **2026-12-16**), que borra los datos de los contratos. El procedimiento para redesplegar está en [`contracts/README.md`](../../contracts/README.md) y **no se ejercitó todavía**: no hubo ningún reset desde que existe el contrato.
- **La corrida contra Testnet falló una vez** antes de pasar, y **no puedo atribuir la causa con certeza**. La primera vez, la campaña B no llegó a abrir; el script **se tragaba el error** (`stderr` a `/dev/null`), así que no quedó registro. Se corrigió la visibilidad del error y se ensanchó el margen del deadline de 20 a 45 segundos, que era ajustado contra la latencia de Testnet. Después pasó. Es honesto decir que el arreglo del margen es **preventivo**: no está probado que fuera esa la causa.
- **Sin umbrales de cobertura.** Los gates exigen que los tests pasen, no un porcentaje. Decisión heredada del repositorio.

## 6. Resultado visible en la demo

**Todavía ninguno, y es correcto que así sea.** Esta Feature entrega el motor, no la pantalla: no hay nada nuevo que un espectador vea. El flujo de fondeo sigue sin ser operable desde la interfaz.

Lo que cambia es que **el camino de fondeo ya existe y está probado en la red pública**. Cuando [#237](https://github.com/reyduar/Vaqcrow/issues/237) conecte la interfaz, el momento que la demo va a mostrar —el aporte que cruza el objetivo y liquida a la PyME en la misma transacción— ya está verificado de punta a punta, local y en Testnet. Y el cierre de la campaña no depende de que la interfaz lo impida: **lo impone el ledger**.

## 7. Correcciones aplicadas durante el ciclo

1. **Un defecto real en el índice de aportantes, encontrado al escribir los tests.** Un inversor que **aporta, retira y vuelve a aportar quedaba listado dos veces**: la pertenencia se infería de que el aporte fuera cero, y después de retirar vuelve a ser cero. Se corrigió comprobando pertenencia (`Vec::contains`). El test de regresión es `the_index_survives_a_withdraw_and_a_new_contribution`. Lo encontró #246 probando código que #244 ya había mergeado.
2. **`deploy_v2` está deprecado en `soroban-sdk` 28.** El ejemplo de la skill lo usa y el compilador lo marca. Se pasó a `deploy_contract`. Hay **dos** `ContractExecutable` distintos —`soroban_sdk::` y `soroban_sdk::xdr::`— y `deploy_contract` quiere el primero.
3. **La SAC del activo nativo hay que desplegarla en cada red nueva.** El primer `contribute` falló con `Error(Storage, MissingValue)`, y **el error apuntaba a la SAC, no al contrato que la llamaba**: *"trying to get non-existing value for contract instance"*. Su dirección es determinística pero la instancia no existe hasta correr `stellar contract asset deploy --asset native`. Documentado en `contracts/README.md` porque **va a volver a morder después de un reset de Testnet**.
4. **El job de CI de contratos quedó desplegando la bóveda con los argumentos del placeholder.** En #264 cambió la firma del constructor y **no se actualizó el paso de CI que la desplegaba**, así que seguía llamando `deploy-local.sh --goal=1000`. El job falló en el PR **y en `main` después del merge** (runs `35861182089` y `35856846111`). **Se mergeó con el gate en rojo, y eso rompió `main`.** El arreglo no fue corregir el paso sino **eliminarlo**: `campaign-smoke.sh` ya despliega los dos contratos a través de la fábrica y corre el flujo completo, así que un despliegue suelto no agregaba nada salvo un segundo lugar donde mantener sincronizados los argumentos del constructor. `main` quedó reparado y verificado (run `35893318669`, los tres jobs en `success`).
5. **`stellar contract invoke` devuelve las direcciones entre comillas.** Un `tail -1` las captura con las comillas y el comando siguiente las rechaza por carácter inválido.
6. **El reloj del ledger no es el de la máquina.** La primera versión del smoke leía el `closeTime` una sola vez al principio y lo usaba para las dos campañas. La campaña A tardó lo suficiente para que el deadline de la B quedara en el pasado, y el constructor lo rechazó. Ahora relee el reloj justo antes de cada deadline.
7. **El smoke se tragaba sus propios errores.** `stderr` a `/dev/null` convertía un fallo en la mitad del recorrido en *nada*: el script salía con 1 y no decía por qué. Es el peor modo de falla posible en un script de prueba. Ahora imprime el error y sale.

## 8. Mapeo de criterios de aceptación

Criterios citados verbatim de `gh issue view 236`, `244`, `246` y `245`.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | #236: "Reaching the goal pays the SME in the same transaction that crosses the threshold" | Cumplido | Sección 4: evento `Settled` emitido en la misma invocación que cruzó el objetivo, en la red local y en Testnet. `the_contribution_that_crosses_the_goal_pays_the_whole_total`, `the_contribution_that_settles_publishes_settled_and_contributed` |
| 2 | #236: "Contributing after the goal is reached reverts" | Cumplido | Sección 4: `a settled campaign rejects further contributions`. El estado pasa a `Settled` dentro de `contribute` y el guard vive ahí mismo |
| 3 | #236: "Withdrawing before the goal returns the contribution" | Cumplido | `withdrawing_before_the_goal_returns_the_contribution`, `withdraw_is_authenticated_by_the_investor` |
| 4 | #236: "After the deadline without the goal, refund and sweep return contributions to the registered address" | Cumplido | `after_the_deadline_a_refund_returns_the_contribution`, `sweep_pays_a_batch_and_skips_addresses_with_nothing_to_return`; sección 4: verificado en Testnet con la campaña B |
| 5 | #236: "Sweeping does not rescue funds to anyone but the registered contributor" | Cumplido | `refund_is_permissionless_and_reaches_the_registered_address` y `refund_asks_for_no_authorization_at_all`: el destino lo fija el contrato y `sweep` no lo recibe como parámetro |
| 6 | #236: "`__constructor` cannot run twice" | Cumplido | El contrato usa `__constructor`, que el host no re-ejecuta; `constructor_records_the_campaign` y los dos tests de validación del constructor |
| 7 | #236: "The contract address is deterministic per `(deployer, salt)` and computable without deploying" | Cumplido | `predict_is_deterministic_per_salt`, y en la red local y en Testnet `predict` devolvió **la misma dirección** que la fábrica desplegó |
| 8 | #236: "The contract is deployed on Testnet and its address is verifiable in the explorer" | Cumplido | Sección 4: fábrica `CDVSSQ55…` y bóveda `CCOS3R3E…` desplegadas en Testnet y **leídas de vuelta desde la red** |
| 9 | #244: "Reaching the goal pays the SME in the same transaction that crosses the threshold" | Cumplido | Criterio 1 |
| 10 | #244: "Contributing after settlement reverts" | Cumplido | Criterio 2 |
| 11 | #244: "Withdrawing before the goal returns the contribution" | Cumplido | Criterio 3 |
| 12 | #244: "After the deadline without the goal, refund and sweep pay the registered address" | Cumplido | Criterio 4 |
| 13 | #244: "`__constructor` cannot run twice" | Cumplido | Criterio 6 |
| 14 | #244: "The address is deterministic per `(deployer, salt)` and computable without deploying" | Cumplido | Criterio 7 |
| 15 | #244: "The contract builds under the network's wasm size limit" | Cumplido | Sección 4: 8090 y 3132 bytes, muy por debajo del límite configurado |
| 16 | #246: "Every money path has a test that fails if the behaviour is removed" | Cumplido | 32 tests en la bóveda; cada camino del dinero —aporte, objetivo, retiro, reembolso, barrido— tiene al menos un test que afirma estado y balances, no valores de retorno |
| 17 | #246: "Every negative case above is covered" | Cumplido | Aportar tras liquidar, retirar tras liquidar, reembolsar antes de la fecha, barrido fuera del lote, doble reclamo, reembolsar a quien nunca aportó, lote vacío, monto cero o negativo, campaña liquidada que no se puede reembolsar |
| 18 | #246: "Auth is asserted on the functions that require it and absent on those that do not" | Cumplido | Sección 4: leído de `env.auths()`, que es lo que el entorno **registró**, no lo que el código dice |
| 19 | #246: "The suite runs green with no network access" | Cumplido | `cargo test` no toca red: la red local no participa y el gate del repo pasó con los tres jobs de CI sin Testnet |
| 20 | #246: "A local-network deploy and invoke is covered" | Cumplido | `campaign-smoke.sh` en CI: despliega la fábrica, abre una bóveda, aporta, liquida y reembolsa |
| 21 | #245: "The evidence document exists under `docs/planning/` and is written in Spanish" | Cumplido | Este documento |
| 22 | #245: "Every acceptance criterion of #236 is mapped with its verification" | Cumplido | Filas 1 a 8 |
| 23 | #245: "The contract address and hashes are recorded and verifiable" | Cumplido | Sección 4: direcciones de Testnet, hashes de los dos Wasm, y la lectura de vuelta desde la red |
| 24 | #245: "The honest limits are stated, not omitted" | Cumplido | Sección 5, incluidas la corrida que falló sin causa atribuida y la cuenta de la PyME que el contrato no puede verificar |
| 25 | #245: "No production claim is made that the contract does not support" | Cumplido | El contrato **no está auditado** y **no es actualizable**, y se dice. Ninguna afirmación de producción: se declara explícitamente que las direcciones de Testnet dejan de valer en el próximo reset |

## 9. Riesgos y limitaciones aceptadas

1. **Gate de skills/MCP, registrado antes de escribir el contrato.** Para #244 se crearon manifiestos Rust, así que el gate aplicó: `skill_resolution: skill-registry`, con la skill **`smart-contracts`** cargada desde `.atl/skill-registry.md` antes de escribir el contrato. `mcp_support: none` — las dudas de API se resolvieron contra el código del SDK y la documentación oficial, no contra un servidor MCP. Para #246 no se agregó ninguna dependencia.
2. **La cuenta de la PyME que el contrato no puede verificar.** Ver sección 5. Es el límite más serio del conjunto: convierte un error de preparación en una campaña trabada. El guard vive en #237.
3. **El contrato no es actualizable y no tiene pausa.** Ver sección 5. Deliberado: no se decidió, y decidirlo sin necesidad habría agregado superficie de ataque a un contrato que custodia fondos.
4. **Las direcciones de Testnet son efímeras.** Un reset las borra. Es la razón por la que el ciclo de la campaña de la demo conviene que quepa en una sola sesión.
5. **La corrida contra Testnet que falló sin causa atribuida.** Ver sección 5. El arreglo del margen es preventivo, no una corrección demostrada.
6. **El `CampaignOpened` de la fábrica no se afirma en tests de eventos.** La bóveda sí tiene aserciones de eventos; la fábrica verifica su `deploy` de punta a punta contra una red, que es más fuerte que una aserción de evento, pero la simetría falta.
7. **Los límites de la sección 5 son aceptados, no resueltos**, salvo el defecto del índice, que se corrigió.

## 10. Estado de entrega

- **#244** y **#246** están **MERGED** en `main` mediante [#264](https://github.com/reyduar/Vaqcrow/pull/264) y [#265](https://github.com/reyduar/Vaqcrow/pull/265); el estado verificado de `main` es `3918923`, con los tres jobs de CI en `success` (run `35893318669`). Las ramas de las Tasks se borraron, local y remotas.
- **#245** se cierra con este documento. **La Feature #236 queda pendiente de cierre manual** en el momento de escribir esto: GitHub no la cierra al completarse sus sub-issues, mismo patrón que las Features #11 a #19, #23 y #238. Se cerrará al mergear este PR, no antes.
- `docs/planning/demo-tasks-list.md` **no se toca en este cambio**, siguiendo el precedente de #62, #179 y la evidencia de #238.
- Al cerrarse, esta Feature habilita [#237](https://github.com/reyduar/Vaqcrow/issues/237) (integrar la bóveda en el recorrido web), que es el último tramo del camino crítico antes de la integración vertical.
