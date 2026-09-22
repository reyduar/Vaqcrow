# Bitácora: custodia del fondeo por contrato de campaña

## Objetivo

Registrar cómo se pasó de *"Claimable Balance en evaluación"* a **"custodia del fondeo por contrato obligatoria"**, qué se descartó y con qué fundamento, y qué decisiones de diseño quedaron cerradas.

**Alcance de esta unidad: planificación.** No se instaló toolchain, no se escribió contrato, no se desplegó nada. Los documentos de planificación se actualizaron en la rama `New_Feat_Claimable_Balance`, que se usa como rama de trabajo documental y no como rama de feature.

## Punto de partida

El 2026-09-22 se había incorporado a los documentos una nota que proponía **Claimable Balance (CAP-23)** —operación clásica, sin contrato— como alternativa liviana para dar custodia con reembolso garantizado por fecha límite. Esa nota describía el flujo con dos reclamantes con predicados de tiempo y estaba marcada como "en evaluación, sin issue".

## Problema detectado en el diseño propuesto

El requisito real del producto, expresado por el owner, es más exigente que "reembolso por fecha límite":

1. La PyME **no** debe poder reclamar antes de que se alcance el objetivo.
2. Si el objetivo **se alcanzó**, el inversor **no** debe poder reclamar.
3. Si la PyME ya reclamó, el inversor no debe poder reclamar.
4. El inversor solo reclama si **no** se alcanzó el objetivo **y** pasó la fecha.

## Unidades de trabajo

### T1 — Verificación normativa de CAP-23

Se verificó contra la especificación normativa (`stellar/stellar-protocol`, CAP-0023, Status Final, protocol 14) y la documentación oficial, no contra la nota de planificación.

**Hallazgo central:** `ClaimPredicateType` tiene **seis tipos** —`UNCONDITIONAL`, `AND`, `OR`, `NOT`, `BEFORE_ABSOLUTE_TIME`, `BEFORE_RELATIVE_TIME`— y sus **únicas hojas son tiempo o "siempre"**. No existe predicado sobre saldos, banderas, estado de cuenta, otro balance ni oráculo.

**Consecuencia:** "el objetivo fue alcanzado" es **inexpresable on-chain**.

### T2 — Mapeo de las cuatro condiciones

| Condición | ¿On-chain? | Motivo |
|---|---|---|
| 1. La PyME no reclama antes del objetivo | ❌ | Un predicado temporal es verdadero o falso solo por reloj |
| 2. Si se alcanzó el objetivo, el inversor no reclama | ❌ | Igual |
| 3. Si la PyME ya reclamó, el inversor no puede | ✅ | Al reclamarse, el spec **borra** la entrada; el segundo recibe `CLAIM_CLAIMABLE_BALANCE_DOES_NOT_EXIST` |
| 4. El inversor solo reclama pasada la fecha | ✅ | `NOT(BEFORE_ABSOLUTE_TIME(D))`, evaluado contra el `closeTime` real |

**Trilema:** como las ventanas deben partirse por reloj, quien tenga la ventana temprana puede tomar los fondos de forma incondicional. Garantizar el reembolso del inversor exige que la ventana de la PyME cierre antes, lo que obliga a la PyME a tener ventana previa. **Ninguna partición de fechas cierra las dos puntas.**

### T3 — Soroban como única opción y riesgos de Testnet

Un contrato puede mantener el estado "objetivo alcanzado" y evaluarlo junto con el tiempo. **No es "la mejor opción": es la única en Stellar** para condicionalidad por objetivo. La elección es binaria.

Riesgos verificados:

- **Reset de Testnet:** borra *"accounts, trustlines, offers, smart contract data, etc."*. 2-4 veces por año, 17:00 UTC, aviso ≥2 semanas. Próxima fecha agendada: **2026-12-16**.
- **Versión:** protocolo **28** vivo en Testnet y Mainnet (`getVersionInfo`); `soroban-sdk` **28.0.0** es el major que le corresponde.
- **TTL:** el estado puede archivarse. Desde protocol 23 *"archived is not gone"* y cualquiera puede extender el TTL. **El TTL no es un mecanismo de seguridad** — la fecha se guarda en el valor y se compara contra el tiempo del ledger.

### T4 — Inventario de tooling y panorama MCP

**Equipo, verificado:** `rustup`, `rustc`, `cargo` y `stellar` **no instalados**; target `wasm32v1-none` inexistente. Docker 29.1.3, Node v26.8.1 y pnpm 11.27.0 presentes. Homebrew 7.0.6 presente; `stellar-cli` disponible en `homebrew-core` como `stable 28.0.0`.

**MCP:** **no existe MCP oficial que despliegue contratos.** Raven (SDF) expone solo `search` y `execute`. Los de comunidad que prometen deployment no están vetados. El despliegue lo hace la `stellar` CLI, scriptada.

**Acelerador:** red local con Docker (`stellar container start local`), que no se resetea y es determinista. **No reemplaza a Testnet para la evidencia**, porque no es pública.

### T5 — Reescritura de los documentos

`stellar-blockchain-requirements.md` (Partes 1, 2 y 3), `DEMO.md`, `product.md`, `README.md`, `AGENTS.md` y `CLAUDE.md`.

## Decisiones cerradas

| # | Decisión | Fundamento |
|---|---|---|
| **D1** | El fondeo se custodia en un **contrato**; CAP-23 queda descartado | CAP-23 no puede expresar condicionalidad por objetivo |
| **D2** | **Fábrica + una instancia de contrato por campaña**, no un contrato único compartido | En Soroban cada instancia tiene storage aislado y su propia dirección con su propio balance: con un contrato único la segregación de fondos es un asiento en un mapa. Con instancias, es a nivel ledger |
| **D3** | La bóveda se crea **al aprobar**, no al crear la solicitud | Al registrar habría que fondear cuentas de PyMEs que nunca se aprueban. Además, la existencia de la bóveda **es** la aprobación, visible on-chain |
| **D4** | El pago a la PyME ocurre **dentro de `contribute`**, en la transacción que cruza el objetivo | Vuelve el pago atómico y determinístico, sin ventana en que el objetivo esté alcanzado y los fondos disponibles |
| **D5** | Al alcanzar el objetivo, el estado pasa a `Settled` y **el ledger rechaza aportes posteriores** | El cierre real lo impone el contrato; la interfaz solo lo refleja |
| **D6** | `withdraw` habilitado mientras la campaña siga `Funding` | Retiro voluntario antes del objetivo, pedido por el owner |
| **D7** | `refund` y `sweep` **permissionless** en `Refunding` | El destino está fijado en el contrato: quien dispara no puede redirigir fondos. Permite cerrar el ciclo sin que el inversor esté online |
| **D8** | Reembolsos no reclamados: **barrido por lotes acotados** | Cierra el ciclo de custodia; el lote acotado evita superficie de ataque por consumo de recursos |
| **D9** | **Aviso + barrido**, no uno u otro | El aviso es UX; el barrido es la garantía. No se sustituyen |
| **D10** | La cuenta de la PyME se **fondea al aprobar**, con una clave pública que ella ya posee | Vaqcrow fondea, **nunca genera ni custodia el seed**. `CreateAccount` no requiere firma del destino |
| **D11** | La existencia de la cuenta de la PyME se **verifica al abrir la campaña**, no al liquidar | Transferir a una cuenta inexistente falla: la transacción que cruza el objetivo reventaría entera, con aportes de inversores ya dentro |
| **D12** | Freighter **real**, no simulado | `DEMO.md` ya lo manda: la firma real con Freighter está en la lista de lo que nunca se recorta |
| **D13** | La **distribución de revenue share** mantiene el camino clásico | Fuera del alcance de esta decisión; su extensión on-chain queda gateada |

## Avisos (advisories) y resolución

| # | Aviso | Resolución |
|---|---|---|
| A1 | El diagrama de CAP-23 hacía que el frontend construyera el XDR, contra la invariante "el frontend solo habla con `@stellar/freighter-api`" del mismo documento | Desaparece con el descarte; el diagrama nuevo pone la construcción del lado de la plataforma |
| A2 | La nota decía que crear un Claimable Balance reserva 0.5 XLM | **Incorrecto:** es `claimants.size() * baseReserve`, o sea **1 XLM con dos reclamantes**. Corregido en el registro del descarte |
| A3 | La nota omitía que **no hay mecanismo de recuperación** en CAP-23 | Agregado: si las cuentas reclamantes se fusionan o se pierden las claves, los fondos quedan varados |
| A4 | El documento declaraba `stellar contract deploy --sandbox` | **Ese no es el mecanismo:** es `stellar container start local`. Corregido |
| A5 | `dependency-cruiser` **no cubre Rust** | Las reglas solo miran `apps/*/src` y `packages/*/src`. Queda registrado como decisión abierta del issue canónico del contrato |
| A6 | Se afirmó que el pedido de "todo automático" chocaba con la aprobación humana de `DEMO.md` y #19 | **Retractado.** Se verificó el issue: #19 aprueba o rechaza **la solicitud de crédito**, no la transferencia. Las dos cosas son ortogonales y componen |
| A7 | Los documentos afirmaban lo contrario de la decisión en varios lugares (contrato como "stretch goal" recortable, incluso **primero en la línea de corte**) | Reescritos. El contrato pasó de primero en la línea de corte a la lista de lo que **nunca se recorta** |
| A8 | El plan de 14 días no tenía días de contrato ni de toolchain | Días 6 a 8 re-presupuestados, marcados como **provisionales** hasta el primer spike en Testnet |

## Descartado

- **Claimable Balance (CAP-23)** como mecanismo de custodia condicionada por objetivo. Registro del descarte en `docs/planning/stellar-blockchain-requirements.md`.
- **Clawback** como salida: `ClawbackClaimableBalance` exige un activo emitido con `AUTH_CLAWBACK_ENABLED` y lo ejecuta el emisor, no el creador. Para el activo nativo no existe emisor, y emitir un activo propio convertiría a Vaqcrow en custodio de facto.
- **Contrato único compartido** para todas las campañas.
- **Cuenta por campaña:** una dirección de contrato no es una cuenta y no necesita una.
- **Generar el keypair de la PyME desde la dapp:** violaría la no custodia de seeds.

## Estado

Documentos de planificación actualizados y verificados. **Sin commit, sin push, sin issues creados, sin toolchain instalado.** Los issues del enfoque nuevo y el de tooling se crean como paso siguiente, desde estos documentos.
