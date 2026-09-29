# Evidencia de cierre de la Feature #28 — Issue #91

> Documento de cierre de Feature. Consolida evidencia verificable de las Tasks [#89](https://github.com/reyduar/Vaqcrow/issues/89) y [#90](https://github.com/reyduar/Vaqcrow/issues/90) y registra una reproducción local sobre `30c40d6`. No ejecuta una distribución real en Testnet, no altera código de runtime y no sustituye los registros de iteración [[odd/tasks/implement-testnet-revenue-share-distribution|#89]] y [[odd/tasks/test-testnet-revenue-share-distribution|#90]].

## 1. Contexto y objetivo

La Feature [#28](https://github.com/reyduar/Vaqcrow/issues/28) implementa la firma y distribución del revenue share en Testnet: la PyME revisa y firma con Freighter una **transacción clásica de distribución**; el backend verifica el XDR firmado, lo envía de forma asíncrona y conserva el hash, los destinatarios y los montos. Es el paso 10 de la historia vertical de [[docs/planning/DEMO|DEMO.md]]: la IA no calcula la obligación, no la aprueba ni mueve fondos.

La distribución es **una sola transacción clásica con un pago nativo por destinatario**. El cálculo que la origina pertenece a la Feature [#27](https://github.com/reyduar/Vaqcrow/issues/27): esta Feature consume `(accountId, amountStroops)` provistos por el llamador y no recalcula la obligación.

La Task [#91](https://github.com/reyduar/Vaqcrow/issues/91) cierra la evidencia: reúne el alcance entregado por [#89](https://github.com/reyduar/Vaqcrow/issues/89), sus pruebas determinísticas de [#90](https://github.com/reyduar/Vaqcrow/issues/90), las rutas de implementación y la reproducción local actual. La implementación llegó por PR [#345](https://github.com/reyduar/Vaqcrow/pull/345), merge local `bd06df6`; las pruebas por PR [#346](https://github.com/reyduar/Vaqcrow/pull/346), merge local `30c40d6`.

## 2. Cómo leer esta evidencia

- **Hechos verificados:** se derivan de los commits locales, archivos versionados y comandos de §5 ejecutados el 2026-09-29 sobre `30c40d6`, antes de modificar este documento.
- **Hechos simulados de la demo:** se identifican expresamente como tales. Los destinatarios son datos sintéticos rotulados `SIMULADO`; no existe un registro real de inversionistas.
- **Trabajo futuro:** se formula como futuro y no como capacidad entregada. La ejecución real en Testnet, la bóveda Soroban y el registro de inversionistas son trabajo posterior; la calificación legal/contable de la operación permanece fuera del alcance.
- **Reproducción local:** los comandos no requieren Supabase, Stellar Testnet, Horizon, proveedor LLM, Freighter, credenciales ni datos sensibles. Las suites determinísticas usan dobles declarados a mano y keypairs descartables; `pnpm run verify` usa sus suites determinísticas y no incluye `test:integration`.

> [!important] Frontera de la unidad
> Esta evidencia documenta una **secuencia de distribución no custodial verificable y determinística**, no una distribución ejecutada en Testnet. Ninguna transacción real, ninguna conexión a Horizon y ninguna firma de wallet en vivo forman parte de esta reproducción.

## 3. Implementación trazable

| Límite entregado | Ruta verificable | Hecho comprobado |
|---|---|---|
| Contrato de cable | `packages/contracts/src/revenue-share-distribution.ts`, `packages/contracts/src/revenue-share-distribution-id.ts` | Los `terms` son exactamente los hechos que la envoltura firmada compromete (identidad de red, cuenta origen, secuencia, memo, expiración y los destinatarios `(accountId, amountStroops)`); `applicationId` es metadata declarada fuera de los `terms`. El dinero es un `bigint` representado como string decimal; el memo está acotado a 28 **bytes** UTF-8. Los estados son `submitted`, `confirmed`, `failed`; la razón de fallo está presente exactamente cuando el estado es `failed`, y solo el vocabulario cerrado `stellar-failure-reason` cruza el límite. |
| Constructor y verificador multi-pago | `apps/api/src/application/ports/revenue-share-distribution-xdr-port.ts`, `apps/api/src/infrastructure/adapters/stellar-revenue-share-distribution-xdr.ts` | Primer constructor/verificador multi-pago del repositorio: un pago nativo por destinatario, **sensible al orden**, ligado a la passphrase declarada. Rechaza fee-bumps, cantidad de operaciones incorrecta, destinos/montos/orden incorrectos, memo incorrecto, expiración, activos no nativos y envolturas sin firma. El adaptador solo verifica (`Keypair.fromPublicKey`); no firma ni lee claves secretas. |
| Persistencia | `apps/api/src/application/ports/revenue-share-distribution-repository-port.ts`, `apps/api/src/infrastructure/adapters/supabase-revenue-share-distribution-repository.ts`, `supabase/migrations/20260929170119_create_revenue_share_distribution.sql` | Registro padre + **filas hijas de destinatarios inmutables** (sin UPDATE/DELETE), clave de idempotencia `transaction_hash` (replay exacto versus conflicto), transiciones terminales condicionales (`WHERE state = 'submitted'`), RLS con grants acotados y UPDATE limitado por columna. |
| Casos de uso y superficie HTTP | `apps/api/src/application/use-cases/prepare-revenue-share-distribution.ts`, `submit-revenue-share-distribution.ts`, `get-revenue-share-distribution.ts`, `apps/api/src/infrastructure/http/routes/revenue-share-distribution.route.ts` | `prepare` es sin estado (no persiste nada); `submit` verifica y luego persiste. Estados HTTP: **202** primera presentación, **200** replay exacto, **409** conflicto de idempotencia, **404** no encontrado, **422** XDR rechazado con la razón redactada, **503** no disponible, **400** cuerpo inválido. |
| Confirmación asíncrona | `apps/api/src/application/use-cases/confirm-revenue-share-distributions.ts`, `apps/api/src/infrastructure/scheduling/confirmation-policy.ts`, `apps/api/src/infrastructure/scheduling/confirmation-scheduler.ts` | Transición asíncrona `submitted → confirmed/failed`, compartiendo **un solo** scheduler y **un solo** backoff con el flujo de funding-intent (`D5` de #89). |
| Flujo web | `apps/web/src/infrastructure/distribution/http-revenue-share-distribution-gateway.ts`, `apps/web/src/application/distribution/demo-distribution-recipients.ts`, `apps/web/src/presentation/components/distribution-workspace.tsx`, `apps/web/src/app/(demo)/distribution/page.tsx` | Conectar Freighter → prepare → modal de revisión → firmar → submit → estado. Los destinatarios son un fixture sintético congelado que lleva su propio rótulo `SIMULADO`; la passphrase siempre proviene de la respuesta preparada, nunca de una constante del componente. |

Los commits locales de la implementación son `624722c` (contrato), `14e897e` (adaptador XDR), `e03732a` (repositorio y migración), `33c94a4` (casos de uso y ruta), `8c1f260` y `2b75f55` (confirmación y deduplicación) y `1712902` (web), entregados por el PR [#345](https://github.com/reyduar/Vaqcrow/pull/345). El endurecimiento de [#90](https://github.com/reyduar/Vaqcrow/issues/90) llegó en `65f3a00` y su secuencia end to end en `19bfc0f`, entregados por el PR [#346](https://github.com/reyduar/Vaqcrow/pull/346).

> [!important] Límite de las entradas
> La distribución no calcula la obligación: recibe `(accountId, amountStroops)` del llamador. La regla, la tasa y el cálculo pertenecen a la Feature #27. El `contributorId` del motor es un string de dominio opaco y **no** es un campo de la transacción.

> [!note] Endurecimiento de #90
> Los `terms` ahora exigen que ningún destinatario coincida con la cuenta origen, de modo que `submit` —el límite autoritativo— rechaza lo que `prepare` ya rechazaba. El snapshot de lectura aplica las mismas reglas de destinatarios y `sourceAccountId` usa `stellarAccountIdSchema`.

## 4. Cobertura determinística

- **Contrato (`packages/contracts/src/revenue-share-distribution.test.ts`):** 143 pruebas que fijan la forma estricta de los `terms`, el dinero como string decimal, el tope de memo en bytes UTF-8, las reglas de destinatarios (distintos y nunca iguales al origen), la ubicación de `applicationId` fuera de los `terms`, la equivalencia de la razón de fallo con el estado `failed` y el endurecimiento de #90 sobre `prepare`, `terms` y el snapshot.
- **Secuencia end to end (`apps/api/src/infrastructure/http/revenue-share-distribution-sequence.test.ts`):** 7 pruebas que ejercen la ruta real, los casos de uso reales y los adaptadores reales —`SupabaseRevenueShareDistributionRepository`, `StellarRevenueShareDistributionXdr`, `StellarLedger`, `StellarTransaction`— duplicando **solo** PostgREST y Horizon. Cubren prepare sin persistencia; submit firmado (202, padre + filas hijas persistidas con los stroops exactos); replay exacto (200 sin filas duplicadas); envoltura que no coincide con los montos declarados (422, repositorio vacío); `submitted → confirmed` con la evidencia de Horizon; `submitted → failed` con una razón sanitizada que nunca es el código crudo de Horizon; y `submitted` sin movimiento de estado cuando el puerto de transacción no está disponible, con reanudación en el siguiente tick.
- **Suites de soporte:** la suite de la ruta, la del repositorio, la del adaptador XDR y la de confirmación completan los escenarios de rechazo, fallback y fronteras de backoff. Los adaptadores usan envolturas firmadas reales con keypairs descartables; nunca se toca Testnet, Horizon ni Freighter en vivo.

Ninguna prueba de la puerta PR depende de Supabase, Stellar Testnet, Horizon, un proveedor LLM ni una credencial. El doble de PostgREST espeja los defaults, el insert anidado y el update condicional de la migración; ese espejo es un riesgo real que la suite de integración opcional verifica desde el otro lado, no una confianza implícita.

## 5. Resultados de verificación observados

Reproducido localmente el 2026-09-29 sobre `30c40d6` antes de modificar este documento:

```sh
$ pnpm --filter @vaqcrow/contracts exec vitest run src/revenue-share-distribution.test.ts

 ✓ src/revenue-share-distribution.test.ts (143 tests) 17ms

 Test Files  1 passed (1)
      Tests  143 passed (143)
   Duration  572ms
```

```sh
$ pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/revenue-share-distribution-sequence.test.ts

 ✓ src/infrastructure/http/revenue-share-distribution-sequence.test.ts (7 tests) 111ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Duration  1.40s
```

```sh
$ pnpm --filter @vaqcrow/api test

 Test Files  47 passed (47)
      Tests  944 passed (944)
   Duration  6.19s
```

```sh
$ pnpm run verify

 Tasks:    5 successful, 5 total   # lint
 Tasks:    8 successful, 8 total   # typecheck
 Tasks:    8 successful, 8 total   # workspace test
 Tasks:    5 successful, 5 total   # build
 ✔ no dependency violations found (498 modules, 1561 dependencies cruised)
 Test Files  9 passed (9)
      Tests  93 passed (93)         # test:boundaries
```

El comando compuesto terminó con **exit 0**. La suite completa informó además, por paquete: contratos 13 archivos/487 tests, dominio 2/120, IA 5/107, API 47/944 y web 103/737. El único warning de lint fue preexistente: `apps/web/src/infrastructure/http/fetch-http-client.ts:8`, `_request` sin usar (`@typescript-eslint/no-unused-vars`); hubo 0 errores. Las líneas `stderr` de repositorios Supabase durante los tests son fixtures de sanitización de errores, no una conexión de integración ni un fallo del gate.

## 6. Mapeo de criterios de aceptación

| Criterio (verbatim, issue #91) | Resultado |
|---|---|
| "Evidence identifies Feature #28, verification commands, and observed results." | ✅ PASS — §1 identifica la Feature #28 y sus Tasks #89/#90/#91, con sus PRs y merges locales; §5 contiene los cuatro comandos ejecutados y sus resultados observados, incluido `pnpm run verify` con exit 0. |
| "Evidence is traceable to implementation and focused tests." | ✅ PASS — §3 vincula contrato, constructor/verificador multi-pago, persistencia, casos de uso, superficie HTTP, confirmación asíncrona y flujo web con sus rutas versionadas; §4 y §5 enlazan esas rutas con las suites focalizadas 1 archivo/143 tests y 1 archivo/7 tests, y con la suite de API 47/944. |
| "Sensitive data and unsupported production claims are excluded." | ✅ PASS — el documento no contiene secretos, tokens, semillas, PII, XDR innecesario ni rutas absolutas; §§1–2 y §7 delimitan la distribución como secuencia determinística no ejecutada en Testnet, los destinatarios como datos sintéticos `SIMULADO` y la ejecución real como verificación operativa futura. |

## 7. Límites conocidos y trabajo futuro

1. **Nunca se ejecutó una distribución real en Testnet.** La Feature prueba la construcción, la verificación, el envío asíncrono y la reanudación con dobles declarados a mano y keypairs descartables. Una corrida real contra Testnet y Horizon permanece como verificación operativa manual, no como capacidad demostrada por esta evidencia.
2. **No hay registro real de inversionistas.** Los destinatarios son datos de demostración con rótulo `SIMULADO` y cuentas sintéticas. Mapear las asignaciones del motor a claves públicas que cada inversionista controle requiere un registro real, que es trabajo futuro.
3. **La regla, la tasa y el cálculo pertenecen a la Feature #27.** Esta Feature consume `(accountId, amountStroops)` provistos por el llamador y no recalcula la obligación.
4. **La bóveda Soroban no forma parte de este slice.** El alcance de `stellar-blockchain-requirements.md` (un contrato Rust con `soroban-sdk`, una bóveda por campaña, payout atómico y reembolsos sin permiso) sigue siendo trabajo posterior; esta distribución es la vía de pagos clásicos para el reparto de revenue share.
5. **`R3-read-model-strictness` queda como trabajo posterior, no entregado.** El review de #90 dejó un `WARNING` no bloqueante: el snapshot ahora rechaza un destinatario igual al origen, pero una fila escrita con el esquema de `terms` más laxo de #89 podría fallar el parseo del snapshot al leerla. En la práctica `prepare` siempre rechazó el autopago y la verificación de la envoltura liga a los destinatarios, por lo que el flujo de la demo no puede producir tal fila; una reconciliación defensiva del camino de lectura queda como seguimiento.
6. **La calificación legal, contable y fiscal de la operación no está cubierta.** La distribución es una demostración de ingeniería, no una operación financiera habilitada en Argentina.

> [!warning] Alcance de la demo
> La distribución demuestra una secuencia no custodial verificable y determinística, no disponibilidad, legalidad, SLA, un registro de inversionistas real ni una operación financiera en Argentina. Vaqcrow continúa siendo una demostración no apta para producción.

## 8. Estado de entrega

Los merges locales `bd06df6` y `30c40d6` confirman que #89 y #90 están incorporados a la base actual. Esta Task #91 aporta el documento de cierre y conserva su rama propuesta hasta que el flujo de revisión y merge ocurra; no se presenta como entregada por este documento. La frontera de rollback de esta unidad es exclusivamente documental: `docs/planning/testnet-revenue-share-distribution-evidence.md`, el ajuste de roadmap de #89/#90 y `odd/tasks/document-evidence-for-testnet-revenue-share-distribution.md`.

### Próximo paso

Revisar y mergear la unidad documental de #91. Solo después podrá cerrarse la Feature #28 y habilitarse el trabajo de #29 y #30; ese cierre no se afirma aquí como realizado.
