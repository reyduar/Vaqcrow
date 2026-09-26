# Evidencia de cierre de la Feature #240 — Issue #260

> Documento de cierre de Feature. No re-deriva la implementación: consolida y cita los dos work units ya verificados de la Feature — [#258](https://github.com/reyduar/Vaqcrow/issues/258) (reescritura, commit `db6a1dc`) y [#259](https://github.com/reyduar/Vaqcrow/issues/259) (pruebas, commit `b7ef310`) — y agrega lo que ninguno de los dos documenta: la revisión afirmación por afirmación contra el contrato (§5), los hallazgos y su resolución (§6), la consistencia entre los dos documentos actualizados (§8) y el mapeo contra los criterios de aceptación propios del [#240](https://github.com/reyduar/Vaqcrow/issues/240) (§9). Se actualizó tras el merge: la Feature y sus Tasks se mergearon en `main` vía [PR #294](https://github.com/reyduar/Vaqcrow/pull/294), merge commit `57be415`.

## 1. Contexto y objetivo

El issue [#260](https://github.com/reyduar/Vaqcrow/issues/260) es la tercera y última Task de la Feature [#240](https://github.com/reyduar/Vaqcrow/issues/240) ("Reconcile trust disclosures with contract custody"), derivada de `docs/planning/DEMO.md` y del trabajo de avisos de confianza del [#17](https://github.com/reyduar/Vaqcrow/issues/17). La Feature existe porque el fondeo dejó de ser un pago directo: desde [#236](https://github.com/reyduar/Vaqcrow/issues/236) los aportes de una campaña quedan custodiados por una bóveda Soroban, y los avisos vigentes —que seguían diciendo que la persona conserva sus claves y que Vaqcrow nunca recibe su seed— no decían dónde vive la custodia durante la campaña ni cuáles son sus límites honestos.

El objetivo de este documento es dar a un revisor un único punto de entrada que confirme el cierre: qué se reconcilió y con qué respaldo del contrato, con qué comandos se verificó y qué resultado se observó, que ningún aviso promete más de lo que el contrato impone, y que las dos superficies documentales quedaron en lockstep. Es un cambio de copia, tests y documentación: no toca el contrato, la API ni la lógica de la bóveda.

## 2. Cómo leer esta evidencia

- **Regla de citación.** Las secciones 3 y 4 **citan** los work units y sus resultados; ninguna cifra se re-deriva salvo la re-ejecución fechada de §4.1, que es un gate de regresión de este propio cambio y no una fuente nueva.
- **Autoría nueva.** Las secciones 5, 6, 7, 8 y 9 son autoría de este documento: la revisión contra el contrato, los hallazgos, la consistencia entre documentos y el mapeo de criterios no existen en ningún artefacto previo.
- **Formato.** Los comandos aparecen en bloques ```sh``` con `$ <comando>` seguido de su salida real.
- **Fuente de cada resultado.** Todo resultado de §3/§4/§4.1 proviene de un **comando re-ejecutado en el árbol de trabajo** sobre el commit `b7ef310` (nodo `v24.21.0`), salvo lo que se indica en §4.2. La corrida de CI de este cambio se agrega en §4.2, ya sobre la rama pusheada: corre `.github/workflows/ci.yml` (`pnpm run verify`, Playwright y los contratos) y su resultado es de **CI**, no local.

## 3. Qué quedó implementado

Work unit #258 (commit `db6a1dc`), verificado en el árbol de trabajo:

- **Un sexto aviso canónico**, `contract-custody`, en `apps/web/src/application/trust/disclosures.ts`: id `"contract-custody"`, título `"Custodia por contrato"`, banner `"simulation"`, y el texto completo que se cita verbatim en §5 y §8. Los cinco avisos previos (`simulation`, `testnet`, `non-custody`, `human-ai`, `no-production`) quedaron **intactos y verbatim**: siguen siendo verdaderos.
- **Ubicación por ruta** en `apps/web/src/application/trust/step-disclosures.ts`, donde la persona usuaria encuentra la decisión de custodia y el camino de reembolso: `funding` pasa a `["testnet", "non-custody", "contract-custody"]` y `evidence` a `["simulation", "testnet", "non-custody", "contract-custody", "no-production"]`.
- **Reconciliación del checklist pre-firma** `microcopy.preSignCheck`, cuyo único consumidor es el paso de fondeo (hoy la bóveda, no el pago): pasó de `"Verifica cuenta, red, destino, activo, monto y memo en Freighter"` a `"Verifica cuenta, red, el contrato de la bóveda, el activo y el monto en Freighter"`. No quedó ninguna referencia al checklist de pago directo (`rg` en §8).
- **Documentos actualizados en lockstep**: `docs/planning/DEMO.md` §12 (+1 aviso) y `docs/design/demo-ui.md` §1 (comprensión en 30 s, punto 6), §2 (fila de la regla "Custodia" + bloque de avisos canónicos), §8 (líneas "Disclosures exactos" de Pantalla 4 y Pantalla 6) y §11 (regla persistente 8 + lista de avisos canónicos).
- **Alcance acotado**: la PR mergeada tiene 12 archivos y 450 adiciones / 13 eliminaciones. Esa cifra incluye el log de iteración `odd/tasks/trust-disclosures-contract-custody.md` (143 líneas) y este mismo documento de evidencia (181 líneas); el cambio de producto y pruebas —copia, tests y los dos documentos canónicos— es de ~139 líneas autoradas. No se tocó `docs/planning/demo-tasks-list.md` en esa PR; su sincronización de roadmap va aparte (issue #295).

## 4. Qué quedó probado

Work unit #259 (commit `b7ef310`), más el ciclo TDD de #258:

```sh
$ pnpm --filter @vaqcrow/web test      # #258, RED
 Test Files  5 failed | 68 passed (73)
      Tests  6 failed | 451 passed (457)
```

El RED fue exactamente el esperado: los seis fallos correspondían a las aserciones modificadas (el id nuevo, su ubicación por ruta y su render en `funding`/`evidence`), no a efectos colaterales.

- **Guarda semántica nueva** `apps/web/src/application/trust/contract-custody.test.ts` (16 tests): fija, de forma **independiente** (no derivada del propio módulo), cada afirmación que el comportamiento del contrato sostiene — custodia del contrato, clave inexistente, destino fijo, inmutabilidad, meta evaluada on-chain, liquidación atómica, ausencia de recuperación, ausencia de clawback, salida sólo por barrido, permanencia posible en el contrato, reembolso que exige transacción, `permissionless` y no auto-disparo — y prohíbe los sobrealcances que la demo no puede respaldar (auditado, listo para producción, legalidad, solvencia, rentabilidad, retorno, garantía).
- **Aserciones de render** en `funding/page.test.tsx` y `evidence/page.test.tsx`: la declaración de custodia y sus límites (`no hay recuperación ni clawback`, `no se dispara solo`, `sólo pueden salir por el barrido`) se afirman presentes donde la persona decide la custodia y donde se evidencia el reembolso.
- **Rotulado de simulación** afirmado como valor chequeado de forma independiente: `microcopy.testnetBadge` == `"TESTNET · Activos sin valor económico"`, `microcopy.testAssetNoValue` == `"Activo de prueba sin valor económico"`, y el banner del aviso == `"simulation"`.
- **Sensibilidad de la guarda probada por mutación**: al quitar la afirmación "no se dispara solo" de la copia, fallaron exactamente dos aserciones nuevas (`states that the refund is not self-firing` y el render de límites en `FundingPage`); restaurada la copia desde `HEAD`, todo volvió a verde. Una guarda que no puede fallar no prueba nada.

| Comando | Resultado observado | Fuente |
|---|---|---|
| `pnpm --filter @vaqcrow/web exec vitest run trust "app/(demo)/funding" "app/(demo)/evidence"` | exit 0 — 8 archivos / 57 tests | Comando re-ejecutado en el árbol de trabajo, `b7ef310` |
| `pnpm --filter @vaqcrow/web test` | exit 0 — 74 archivos / 483 tests | Comando re-ejecutado en el árbol de trabajo, `b7ef310` |
| mutación (copiar sin "no se dispara solo") | exactamente 2 fallos, ambos nuevos | Comando re-ejecutado en el árbol de trabajo, `b7ef310` |

### 4.1 Gate de regresión de este cambio (no es evidencia nueva)

```sh
$ nvm use v24.21.0
$ node -v
v24.21.0
$ git rev-parse --short HEAD
b7ef310

$ pnpm run lint
 Tasks:    5 successful, 5 total
  Time:    43ms >>> FULL TURBO

$ pnpm run typecheck
 Tasks:    8 successful, 8 total

$ pnpm run build
 Tasks:    5 successful, 5 total
  Time:    16.062s

$ pnpm run boundaries
✔ no dependency violations found (361 modules, 1075 dependencies cruised)

$ pnpm run test:boundaries
 Test Files  6 passed (6)
      Tests  79 passed (79)
```

`pnpm run verify` no se reporta como verde de punta a punta **en local**: su paso de tests falló por timeouts de 5 s bajo carga del host, no por este cambio. Se documenta como limitación acotada en §10, con su causa y su prueba de aislamiento; la corrida de CI sobre la rama pusheada (§4.2) pasó limpia y confirma el diagnóstico.

### 4.2 Corrida de CI de este cambio

Al abrir la PR #294, el CI del repositorio corrió sobre la rama y pasó en sus tres jobs:

```sh
$ gh pr checks 294 --repo reyduar/Vaqcrow
Contracts (build, test, deploy on a local network)	pass	4m12s
Playwright (deterministic, local double)	pass	1m39s
Quality gates (lint, types, tests, build, boundaries)	pass	2m20s
Vercel	pass	0
```

`Quality gates` ejecuta `pnpm run verify` en `ubuntu-latest`, sin la contención de carga del host local: que pase corrobora que el flake de §10 era del entorno, no de la copia.

## 5. Revisión afirmación por afirmación

Cada afirmación del aviso `contract-custody` contra lo que el contrato realmente impone en `contracts/campaign-vault/src/lib.rs`:

| Afirmación del aviso | Qué la respalda en el contrato | Veredicto |
|---|---|---|
| "los aportes los custodia el contrato, no una persona" | `contribute` transfiere a `env.current_contract_address()` (línea 189): los fondos quedan en la dirección de la propia bóveda, una instancia por campaña. | Respaldada |
| "nadie tiene una clave para moverlos" | No existe `upgrade`, `set_admin`, `pause`, `clawback` ni ninguna función mutadora de configuración en la bóveda ni en la fábrica. Las únicas salidas son el pago al `sme` y los reembolsos al inversor registrado. | Respaldada (matiz en §6, F4) |
| "sólo puede pagar al destino fijo definido al abrir la bóveda" | `DataKey::Sme` se escribe únicamente en `__constructor` (línea 132); `sme()` es de sólo lectura y `dataKey` no tiene claves mutables. | Respaldada |
| "ese destino es inmutable" | `__constructor` "runs once, at deploy time, and cannot run again" (línea 122); no hay setter. | Respaldada |
| "La meta la evalúa el contrato sobre el ledger" | `contribute` compara `total >= Self::goal(...)` en la línea 191, dentro del propio contrato. | Respaldada |
| "al alcanzarla, liquida a la PyME en la misma transacción" | La transferencia al `sme` ocurre dentro de la misma llamada a `contribute` (línea 195), sin ventana en la que la meta esté alcanzada y los fondos sigan disponibles. | Respaldada |
| "No hay recuperación ni clawback: no existe forma de revertir un pago ya liquidado" | Tras `State::Settled`, `withdraw` y `refund` devuelven `WrongState`; ninguna función revierte el pago. | Respaldada |
| "los fondos que nadie reclame sólo pueden salir por el barrido" | `sweep` (líneas 272–290) reembolsa un lote acotado (`MAX_SWEEP_BATCH = 20`) de inversores registrados. | Respaldada |
| "si no, pueden quedarse en el contrato" | Nada fuerza el reembolso: si nadie llama `refund`/`sweep`, el saldo permanece en la dirección de la bóveda. | Respaldada |
| "El reembolso por vencimiento … exige que alguien envíe la transacción" | `refund`/`sweep` son llamadas explícitas; no hay planificador que las dispare. | Respaldada |
| "es permissionless" | `refund` y `sweep` no tienen `require_auth` (líneas 261–290): cualquiera puede dispararlas. | Respaldada |
| "no se dispara solo" | `ensure_refundable` documenta "There is no scheduler on Stellar, so the deadline transition cannot fire on its own" (líneas 335–337). | Respaldada |
| "no una persona" + banner `"simulation"` | Ningún actor humano tiene control discrecional; la bóveda no es actualizable ni pausable. | Respaldada |

Los cinco avisos previos no requieren revisión contra el contrato de custodia: `simulation`, `testnet`, `non-custody`, `human-ai` y `no-production` siguen siendo verdaderos y no describen un pago directo. En particular, `non-custody` ("Vaqcrow construye y verifica la transacción y nunca recibe su seed") sigue siendo exacto: la plataforma construye y verifica la invocación, y la firma la aporta quien contribuye (`contribute` exige `investor.require_auth()`).

## 6. Hallazgos y cómo se resolvieron

- **F1 — Reconciliado, no suavizado.** El checklist pre-firma del paso de fondeo describía un pago directo ("destino, activo, monto y memo"). Se reconcilió a la invocación de la bóveda en la misma unidad que el aviso, en código y en `demo-ui.md` (Pantalla 4). `rg` confirma que no queda la redacción vieja (§8).
- **F2 — Cobertura desconectada del andamiaje narrativo (diferido, reportado, no oculto).** `docs/planning/DEMO.md` §3 y `docs/design/demo-ui.md` §8 "Contenido clave" de Pantalla 4 todavía describen el fondeo clásico retirado ("firma el XDR", "envía la transacción clásica", "secuencia, timeout"). No son bloques de aviso, y el issue acota `DEMO.md` a "los disclosure blocks" y `demo-ui.md` a sus secciones de avisos, así que **este cambio no los reescribe**; se reporta como hallazgo para un cambio posterior de narrativa de pantalla en lugar de declararlo resuelto. No es una afirmación de aviso sin respaldo, sino una deriva entre narrativa y aviso.
- **F3 — Contrato no auditado (consistencia verificada).** `DEMO.md` §4 registra el objetivo del producto real ("Contrato auditado, con controles de emergencia") y `campaign-vault-contract-evidence.md` §5 registra que el contrato de la demo **no es actualizable y no tiene pausa**. El aviso nuevo no afirma auditoría, controles de emergencia ni producción, así que la inconsistencia queda cerrada del lado del aviso.
- **F4 — Matiz considerado y respaldado en "nadie tiene una clave para moverlos".** El inversor puede retirar su propio aporte antes de la meta (`withdraw`, autenticado) y el contrato paga al `sme` al alcanzarla. Ninguna de las dos es una persona con una clave discrecional: son las reglas propias del contrato ejecutándose. La afirmación habla de claves, no de movimientos reglados, y se sostiene.
- **F5 — `microcopy.kycStatusLabel` sigue siendo copia muerta** (`disclosures.ts`), heredada de #17 y sin consumidor. Fuera del alcance de #240; se reporta sin tocarla.

## 7. Límites operativos vigentes

- **La bóveda de la demo no está auditada, no es actualizable y no tiene pausa.** Es el límite que el aviso declara como "no hay recuperación ni clawback" y que `DEMO.md` §14 (P1) deja abierto. El aviso no describe la bóveda como auditada ni lista para producción.
- **Sólo Testnet, sólo activos sin valor económico.** El contrato se despliega en Testnet; el aviso `testnet` y el rotulado persistente `TESTNET · Activos sin valor económico` siguen vigentes y sin cambios.
- **El reembolso no es auto-disparado.** Es una propiedad de diseño del contrato (`ensure_refundable`), no una carencia de la interfaz: la consola de fondeo ya ofrece el disparo permissionless tras el vencimiento.
- **La distribución de revenue share sigue por el camino clásico** (`DEMO.md` §7), y su paso conserva sus avisos de pago (`submittedNotConfirmed`, `hashTechnicalOnly`), ajenos a la custodia por contrato.

## 8. Consistencia entre los dos documentos actualizados

El texto canónico se replica en cuatro superficies. Para probar que no derivan, se compara el párrafo completo, en cada archivo, contra el valor de `disclosures.ts`, normalizando sólo los marcadores de markdown `**` y `>`:

```sh
$ python3 - <<'PY'
import re
src = open("apps/web/src/application/trust/disclosures.ts", encoding="utf-8").read()
full = re.search(r'"contract-custody": Object\.freeze\(\{.*?text: "([^"]+)"', src, re.S).group(1)
norm = lambda s: s.replace("**", "").replace(">", "").strip().strip('",“”')
for f in ["apps/web/src/application/trust/disclosures.ts", "docs/planning/DEMO.md", "docs/design/demo-ui.md"]:
    s = open(f, encoding="utf-8").read()
    hits = 0
    for m in re.finditer(re.escape("Custodia por contrato"), s):
        seg = s[m.start():m.start() + len(full) + 200]
        end = min([x for x in (seg.find("\n"), seg.find("”")) if x != -1] or [len(seg)])
        if norm(seg[:end]) == full:
            hits += 1
    print(f"{f}: {hits} exact")
PY
apps/web/src/application/trust/disclosures.ts: 1 exact
docs/planning/DEMO.md: 1 exact
docs/design/demo-ui.md: 2 exact
```

Resultado observado: **el texto es idéntico** en las cuatro superficies canónicas — `disclosures.ts` (`text`), `DEMO.md` §12, `demo-ui.md` §2 y `demo-ui.md` §11. Las coincidencias que el extractor no cuenta como exactas son, en cada caso, texto que no pretende ser el párrafo canónico: en `disclosures.ts`, el campo `title` (`"Custodia por contrato"`, sólo el encabezado); en `DEMO.md`, la fila preexistente de la matriz §4 ("Custodia por contrato | Real en Testnet …"); y en `demo-ui.md`, el punto 6 de §1 y la fila de la regla "Custodia" de §2, que parafrasean a propósito.

```sh
$ rg -n "destino, activo, monto y memo en Freighter" apps/web/src docs/design/demo-ui.md docs/planning/DEMO.md
$ echo "exit=$?"
exit=1
```

`exit=1` (sin coincidencias): no queda ninguna redacción del checklist de pago directo en el código, el diseño ni `DEMO.md`. La única aparición de ese texto en el repositorio es la cita histórica de este propio documento (§3), donde se registra el valor anterior.

## 9. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #240) | Resultado |
|---|---|---|
| 1 | "Every disclosure that described a direct payment is reconciled with contract custody" | ✅ PASS — el checklist pre-firma del paso de fondeo (el único aviso que describía un pago directo) se reconcilió a la invocación de la bóveda; `rg` en §8 confirma que no queda la redacción vieja; el nuevo aviso declara la custodia del contrato (§5) |
| 2 | "The custody-during-campaign nuance is stated explicitly, not left implied" | ✅ PASS — el aviso `contract-custody` lo dice con todas las letras ("Durante la campaña, los aportes los custodia el contrato, no una persona") y se agrega al punto 6 de `demo-ui.md` §1, a la regla "Custodia" de §2 y a la regla persistente 8 de §11 |
| 3 | "The no-recovery and no-clawback limits are stated" | ✅ PASS — "No hay recuperación ni clawback" está en el texto canónico y se afirma en `contract-custody.test.ts` (`no hay recuperación`, `ni clawback`) y en el render de `funding`/`evidence` (§4) |
| 4 | "No disclosure claims a guarantee the contract does not provide" | ✅ PASS — revisión afirmación por afirmación (§5): 13/13 respaldadas; la guarda prohíbe auditado, producción, legalidad, solvencia, rentabilidad, retorno y garantía; ningún aviso describe la bóveda como auditada |
| 5 | "Simulation labels remain accurate" | ✅ PASS — los rótulos `TESTNET · Activos sin valor económico`, `Activo de prueba sin valor económico` y `SIMULADO` quedaron afirmados como valores independientes (§4) y sin cambios; el aviso nuevo usa el banner `simulation`, que nunca selecciona un estado de éxito |

## 10. Riesgos y limitaciones aceptadas

**Flake de timeout por carga del host — ajeno a este cambio.** `pnpm run verify` falló en su paso de tests con timeouts del default de 5000 ms (5 a 8 según la corrida) en archivos que este cambio no toca (`campaign-workspace`, `human-decision-form`, `sales-evidence-table`, `sme-request-workspace`, `layout.traversal`), siempre en el primer test de cada archivo, que carga el costo de transformación. La causa es carga del host, no la copia: con load average 15–22 los mismos 5 archivos pasan aislados (38/38) y la suite completa pasa al re-ejecutarla (74 archivos / 483 tests). Es la misma clase ya documentada como flake preexistente en `trust-disclosures-and-synthetic-fixtures-evidence.md` §9. Este cambio no modificó `testTimeout` ni ningún archivo de esos componentes. CI corre `pnpm run verify` sobre `ubuntu-latest`, sin esa contención local.

**CI sobre la rama pusheada.** `.github/workflows/ci.yml` corrió al abrir la PR #294 y pasó en sus tres jobs (`Quality gates`, `Playwright` y `Contracts`), además del deploy de Vercel (ver §4.2). Eso deja el flake local como una limitación del entorno de desarrollo, no del cambio.

## 11. Estado de entrega

Con este documento completo, la Feature [#240](https://github.com/reyduar/Vaqcrow/issues/240) quedó cerrada al mergear su rama: [PR #294](https://github.com/reyduar/Vaqcrow/pull/294), merge commit `57be415`. #240 y sus Tasks #258/#259/#260 cerraron como completadas, y el Epic padre [#235](https://github.com/reyduar/Vaqcrow/issues/235) se cerró manualmente. La implementación se entregó como tres work units sobre la rama de integración `Vaqcrow#240_Feat_Reconcile_trust_disclosures_with_contract_custody`: `db6a1dc` (#258, reescritura), `b7ef310` (#259, pruebas) y el commit de este documento (#260, evidencia). El cambio de producto y pruebas es de ~139 líneas autoradas; la PR completa suma 450 adiciones porque incluye el log de iteración y este documento. No se tocó el contrato, la API ni la lógica de la bóveda; `docs/planning/demo-tasks-list.md` se sincroniza aparte, en el issue #295.

### Qué queda desbloqueado

Con #240 mergeado, el camino de custodia por contrato queda cerrado en `main`: el Epic [#235](https://github.com/reyduar/Vaqcrow/issues/235) y sus cinco Features están completos. No queda un bloqueo nativo pendiente que este cambio libere. El hallazgo F2 (narrativa de pantalla desactualizada) se resuelve en el issue #295, junto con los tres avisos no bloqueantes de la revisión y la corrección de este propio documento.

### Próximos pasos sugeridos

1. Mergear la PR del issue #295 (sincronización del roadmap y follow-ups), que además cierra `R3-PRESIGN-NOT-PINNED`, `R3-CANON-DUP-NO-GUARD`, `R3-DENYLIST-GARANTIA` y F2.
2. Considerar la limpieza de `microcopy.kycStatusLabel` (F5) en un cambio de copia aparte.
3. Evaluar si el bloque de prompts de Stitch de `demo-ui.md` §11/§12 conserva el brief original del fondeo clásico a propósito o también debe reconciliarse con la bóveda.
