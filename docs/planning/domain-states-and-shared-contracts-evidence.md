# Evidencia de cierre de la Feature #12 — Issue #40

> Documento de cierre de Feature. No implementa ni re-deriva evidencia nueva: consolida y cita la evidencia ya verificada de los issues [#38](https://github.com/reyduar/Vaqcrow/issues/38) y [#39](https://github.com/reyduar/Vaqcrow/issues/39), agrega únicamente lo que ninguno de los dos documenta (límites operativos vigentes y el encuadre del resultado visible en la demo), y corrige dos referencias de documentación que quedaron desactualizadas tras el retiro de símbolos del #38. No reemplaza [`application-review-lifecycle-evidence.md`](./application-review-lifecycle-evidence.md) ni [`application-review-lifecycle-testing-evidence.md`](./application-review-lifecycle-testing-evidence.md); ambos siguen siendo la fuente de verdad de lo que cada uno probó.

## 1. Contexto y objetivo

El issue [#40](https://github.com/reyduar/Vaqcrow/issues/40) es la tercera y última Task de la Feature [#12](https://github.com/reyduar/Vaqcrow/issues/12) ("Definir estados de dominio y contratos compartidos"). Las otras dos Tasks ya están completas y mergeadas: [#38](https://github.com/reyduar/Vaqcrow/issues/38) ("Implementar el ciclo mínimo de revisión de solicitudes y su contrato compartido") implementó el ciclo autoritativo en `packages/domain` y su representación de protocolo en `packages/contracts`; [#39](https://github.com/reyduar/Vaqcrow/issues/39) ("Probar exhaustivamente el ciclo de revisión de solicitudes y su contrato compartido", PR [#126](https://github.com/reyduar/Vaqcrow/pull/126), commit `209b7ea`) cerró la superficie de testing con la matriz exhaustiva de 36 pares y la verificación cruzada `domain`/`contracts`.

El objetivo de este documento es dar a un revisor un único punto de entrada que confirme el cierre de la Feature #12: qué quedó implementado, qué quedó probado, qué límites operativos siguen vigentes hoy y qué resultado, todavía futuro, respaldará esta evidencia en la demo. Es un cambio **solo de documentación**: cero diff de código de producción, cero reescritura de tests, cero re-ejecución de `pnpm run verify` como fuente de evidencia nueva (sección 8 la re-ejecuta únicamente como gate de regresión, no como prueba nueva).

## 2. Cómo leer esta evidencia

- **Regla de citación.** Las secciones 3 y 4 **citan, nunca re-derivan**, lo que `application-review-lifecycle-evidence.md` (#38) y `application-review-lifecycle-testing-evidence.md` (#39) ya probaron. Ningún número, comando o conteo de tests de esas secciones se volvió a ejecutar para este documento; se transcribe tal como esos dos documentos y sus observaciones en Engram (`sdd/application-review-lifecycle-testing/verify-report`, obs #347; `sdd/application-review-lifecycle-testing/explore`, obs #340) ya lo dejaron asentado.
- **Autoría nueva.** Las secciones 5, 6, 8 y 9 son autoría de este documento: ninguna de las dos evidencias previas enumera los límites operativos vigentes de la Feature #12 como un conjunto, ni encuadra explícitamente el resultado como futuro, ni mapea contra los tres criterios de aceptación propios del #40.
- **Formato.** Igual que en [`document-workspace-evidence.md`](./document-workspace-evidence.md) (#37): los comandos aparecen en bloques ```sh``` con `$ <comando>` y una nota de alcance cuando el comando prueba menos de lo que su nombre sugiere.
- **Reproducción local, no CI.** Este repositorio no tiene `.github/workflows/`; toda la evidencia citada aquí y en sus fuentes es reproducción local bajo `nvm use v24.21.0` (el `package.json` raíz exige `>=24.0.0 <25.0.0`).

## 3. Qué quedó implementado

Citado de [`application-review-lifecycle-evidence.md`](./application-review-lifecycle-evidence.md) (#38), sin re-derivar:

- `packages/domain/src/application-review.ts` expone 6 estados (`draft`, `awaiting_assessment`, `human_review`, `approved`, `changes_requested`, `rejected`) y 6 transiciones permitidas, sin dependencias en runtime. `transitionApplicationReview(from, to)` devuelve un `Result` discriminado (`{ ok: true, state } | { ok: false, error }`, decisión **D1**), nunca lanza una excepción.
- `packages/contracts/src/application-id.ts` expone `applicationIdSchema` (`z.uuidv4().brand<"ApplicationId">()`) y `parseApplicationId`.
- `packages/contracts/src/application-review.ts` expone `applicationReviewStateSchema` (`z.enum([...])`) y `applicationReviewSnapshotSchema`, construido con `z.strictObject` (decisión **D2**) — rechaza campos desconocidos en lugar de descartarlos silenciosamente, a diferencia de `z.object()`.
- El vocabulario de los 6 estados se duplica por valor entre `domain` y `contracts`, incluso a nivel de tipos (decisión **D3**), porque la regla `domain-stays-framework-free` de `.dependency-cruiser.cjs` prohíbe cualquier import de un paquete `npm` desde `packages/domain/src`, sin excepción `type-only`.
- Los cuatro símbolos de probe de bootstrap (`WorkspaceProbe`, `describeWorkspace`, `isWorkspaceBootstrapped`, `apiBootstrapProbe`) y `apps/api/src/application/bootstrap-probe.ts` se retiraron por completo, de forma atómica, junto con la implementación (decisión **D4**) — ver sección 7 de este documento para las correcciones de documentación que ese retiro dejó pendientes.
- `packages/contracts/src/correlation-id.ts` y su test no se tocaron: diff verificado como idéntico byte a byte.

## 4. Qué quedó probado

Citado de [`application-review-lifecycle-testing-evidence.md`](./application-review-lifecycle-testing-evidence.md) (#39) y de Engram `sdd/application-review-lifecycle-testing/verify-report` (obs #347) / `sdd/application-review-lifecycle-testing/explore` (obs #340), sin re-derivar:

- **41 tests de dominio** en `packages/domain/src/application-review.test.ts`: una única suite parametrizada sobre el producto cartesiano completo de 6×6 = 36 pares `(from, to)`, con un oráculo (`ALLOWED`/`TERMINAL_ORACLE`) escrito a mano y deliberadamente independiente de `canTransitionApplicationReview`/`isTerminalApplicationReviewState` — usar los propios predicados de la implementación como oráculo la habría validado contra sí misma.
- **21 tests de contrato** en `packages/contracts/src/application-review.test.ts`: `applicationReviewStateSchema` acepta exactamente los 6 estados conocidos (6 filas) y rechaza cualquier otro valor probado (11 filas), más las pruebas de `applicationReviewSnapshotSchema` heredadas de #38.
- **6 tests de `application-id`** en `packages/contracts/src/application-id.test.ts`: incluye el nuevo caso de rechazo de UUID v5 (construido invirtiendo solo el nibble de versión del fixture v4 ya existente) además del rechazo de UUID v1 ya cubierto desde #38.
- **4 tests de round-trip** en `tests/application-review-round-trip.test.ts` (raíz del repo, decisión de diseño de #39: ambos paquetes como devDependencies del `package.json` raíz para no acoplar el tooling de `contracts` a `domain`): parsea un snapshot válido con `contracts`, alimenta `.state` a `transitionApplicationReview` de `domain`, recorre el camino completo `draft → awaiting_assessment → human_review → approved`, re-valida en cada paso y verifica la equivalencia de vocabulario en runtime entre ambos paquetes.
- `pnpm run verify` con salida `exit 0`, re-ejecutado de forma independiente tres veces (por `sdd-apply`, por `sdd-verify` y por el orquestador de #39): `lint` 4/4, `typecheck` 6/6, `test` 6/6 (domain 41/41, contracts 33/33, api 8/8, web 12/12), `build` 4/4, `boundaries` 0 violaciones (45 módulos, 58 dependencias), `test:boundaries` 23/23.
- **Diff de producción cero**: `git diff --stat` sobre `packages/domain/src/application-review.ts`, `packages/contracts/src/application-review.ts` y `packages/contracts/src/application-id.ts` vacío — #39 fue un cambio solo de tests.

## 5. Límites operativos vigentes

Estos cinco límites siguen vigentes hoy y ninguno de los dos documentos citados los enumera como un conjunto:

1. **Sin superficie demo-facing.** No existe UI ni API que exponga el ciclo de revisión de solicitudes a un usuario final. Los issues [#16](https://github.com/reyduar/Vaqcrow/issues/16), [#18](https://github.com/reyduar/Vaqcrow/issues/18) y [#19](https://github.com/reyduar/Vaqcrow/issues/19), que construirían esa superficie, siguen en `Backlog`.
2. **Sin persistencia.** El ciclo de revisión de solicitudes vive únicamente en memoria de proceso (funciones puras de `packages/domain`); no hay tabla ni adaptador de Supabase que lo persista. El issue [#13](https://github.com/reyduar/Vaqcrow/issues/13) ("Crear persistencia en Supabase") sigue en `Backlog`.
3. **Brecha abierta en `CorrelationId`.** `packages/contracts/src/correlation-id.ts` tiene el mismo vacío de rechazo de UUID v5 que tenía `ApplicationId` antes de #39 — cubre v1 pero no v5. Es un follow-up sin issue abierto, explícitamente fuera de alcance de #39 (ver su documento de evidencia, sección "Qué queda desbloqueado") y fuera de alcance de este documento.
4. **El round-trip prueba solo `.state`.** `tests/application-review-round-trip.test.ts` transporta únicamente `ApplicationReviewState` entre `contracts` y `domain`, no `ApplicationId` completo — porque `transitionApplicationReview` nunca toca `ApplicationId` (confirmado durante la exploración de #39, corrigiendo el planteo inicial de ese issue).
5. **Reproducción exige Node fijado.** El `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`; toda la evidencia citada en las secciones 3 y 4 se reprodujo bajo `nvm use v24.21.0`, no bajo el Node por defecto de las máquinas donde se ejecutó (v26.8.1 en al menos un caso documentado en #38).

## 6. Resultado visible en la demo

Ningún enunciado de esta sección afirma una demo completada o funcionando hoy. Lo que existe — el ciclo de revisión de solicitudes en `packages/domain` y su contrato validado en `packages/contracts`, ambos probados exhaustivamente (sección 4) — es evidencia que **respaldará** pasos futuros de la demo *cuando* las Features que construyen la superficie de usuario aterricen:

- Cuando [#16](https://github.com/reyduar/Vaqcrow/issues/16) ("Construir shell y navegación") y [#18](https://github.com/reyduar/Vaqcrow/issues/18) implementen la interfaz de revisión, esa interfaz podrá invocar `transitionApplicationReview` sabiendo que las 36 combinaciones de estado están cubiertas por un oráculo independiente.
- Cuando [#19](https://github.com/reyduar/Vaqcrow/issues/19) (o la Feature que la contenga) exponga el ciclo vía API, el límite `domain`/`contracts` ya está probado en runtime por el round-trip de #39, sin necesidad de volver a validar la equivalencia de vocabulario en ese momento.
- Cuando [#13](https://github.com/reyduar/Vaqcrow/issues/13) agregue persistencia, el `Result` discriminado de `transitionApplicationReview` (decisión D1) ya da al adaptador de persistencia una forma de error explícita para propagar, sin excepciones que capturar.

Hasta que esas Features salgan de `Backlog`, no hay ningún flujo de demo ejecutable extremo a extremo que involucre el ciclo de revisión de solicitudes.

## 7. Correcciones de documentación de este cambio

El retiro atómico de los cuatro símbolos de probe (decisión D4 de #38) dejó dos documentos de iteraciones anteriores con afirmaciones en tiempo presente sobre código que ya no existe. Este cambio corrige exactamente esas referencias, sin reescribir ningún otro contenido de esos documentos:

- **[`scaffold-fastify-api.md:33`](./scaffold-fastify-api.md)** — la oración que describía `apiBootstrapProbe()` como "la primera demostración real de que `application/` puede importar los dos paquetes compartidos" pasó a tiempo pasado (`fue`/`podía importar`), y se agregó un aviso de estado actual (post-#38) que nombra los cuatro símbolos retirados y remite a la decisión D4 de #38.
- **[`document-workspace-evidence.md:211,213,215,229`](./document-workspace-evidence.md)** — la fila de la tabla de exports que describía `describeWorkspace`/`WorkspaceProbe` ahora indica que fueron retirados por #38; las dos oraciones que afirmaban su comportamiento en presente pasaron a pasado; se agregó una nota (post-#38) después de la línea 215 remitiendo a este mismo documento; y la mención a `src/index.test.ts` que cubría `describeWorkspace` ahora aclara que ese test fue retirado junto con el símbolo.
- **`docs/planning/correlation-id-helper.md:7`** — verificado como registro histórico legítimo en tiempo pasado; no se modificó (fuera de alcance, confirmado en el spec de este cambio).

Ninguna otra línea de esos dos documentos cambió: ambos se conservan como registro fiel de lo que sus propias iteraciones (#110 y #37) probaron en su momento, no como descripción del código actual.

## 8. Verificación de los criterios de aceptación del issue #40

| # | Criterio | Resultado |
|---|---|---|
| 1 | Registrar evidencia de verificación, límites operativos y el resultado visible en la demo | ✅ PASS — secciones 3/4 (verificación citada de #38/#39), sección 5 (5 límites operativos) y sección 6 (resultado encuadrado estrictamente a futuro) |
| 2 | La evidencia es reproducible y acotada | ✅ PASS — toda la evidencia citada remite a comandos ya documentados en #38/#39 bajo `nvm use v24.21.0`; este cambio no agrega evidencia nueva sin comando reproducible, y las correcciones de la sección 7 están acotadas a las líneas listadas en el spec |
| 3 | No se introducen secretos, PII ni afirmaciones de producción no respaldadas | ✅ PASS — sin credenciales, rutas absolutas de máquina ni datos personales en este documento; ninguna oración de la sección 6 afirma una demo completada, y las secciones 3/4 solo citan evidencia ya verificada por #38/#39 |

## 9. Riesgos y limitaciones aceptadas

Citado de la tabla de Riesgos de la propuesta (`sdd/domain-states-evidence-documentation/proposal`) y de la sección "Out of Scope" del spec de este cambio:

- **Deriva de la corrección de docs desactualizados hacia una reescritura.** Mitigado limitando la sección 7 exactamente a las cuatro referencias listadas en el spec (`scaffold-fastify-api.md:33`, `document-workspace-evidence.md:211,213,215,229`); ninguna otra línea de esos documentos cambió.
- **`demo-tasks-list.md` (1397 líneas) en conflicto con sincronizaciones de roadmap en curso.** Mitigado tocando únicamente la entrada del #40 (líneas 284/289/294, decisión D5 del diseño); la lista `Ready` de la línea 7 y la cadena tachada de la línea 49 quedan explícitamente diferidas a la sincronización de roadmap posterior al merge, siguiendo el mismo patrón que #39 (commit `c1b0678`).
- **Que este documento sobreclame un resultado de demo en vivo.** Mitigado con el encuadre estrictamente futuro-condicional de la sección 6 — ninguna oración afirma una demo completada o funcionando hoy.
- **Duplicar la evidencia de #39 en vez de citarla.** Mitigado por la regla de citación de la sección 2: las secciones 3 y 4 citan textualmente los conteos y comandos ya verificados por #38/#39, sin volver a ejecutarlos ni reformularlos como hallazgos nuevos.
- **Fuera de alcance, explícitamente aceptado (spec):** no se re-ejecutó `pnpm run verify` como fuente de evidencia nueva (sección 8 lo corre solo como gate de regresión); no se reescribió ningún test; `correlation-id-helper.md:7` no se tocó; no se corrigió la brecha de UUID v5 en `CorrelationId` ni se modificó el esquema de la sección 13 de `DEMO.md`.

## 10. Estado de entrega

- Cambio SDD `domain-states-evidence-documentation` ejecutado como una sola unidad de trabajo (forecast de `sdd-tasks`: ~140-180 líneas autoradas — archivo nuevo ~120-150 + 3 parches acotados ~20-30 —, riesgo **Bajo** de presupuesto de 400 líneas, sin necesidad de encadenar PRs).
- Este documento (`domain-states-and-shared-contracts-evidence.md`), los dos parches acotados de la sección 7 y la actualización de la entrada del #40 en `demo-tasks-list.md` son los únicos archivos modificados; no se tocó código fuente, pruebas ni configuración.
- Ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive), con persistencia en Engram bajo el topic `sdd/domain-states-evidence-documentation/*`.
- Rama de trabajo: `Vaqcrow#40_Task_Document_evidence_for_domain_states_and_shared_contracts`. El commit y la apertura del Pull Request son un paso explícito posterior a esta fase de implementación, siguiendo el mismo patrón que #37/#38/#39.

### Qué queda desbloqueado

Con #40 completo, la Feature [#12](https://github.com/reyduar/Vaqcrow/issues/12) ("Definir estados de dominio y contratos compartidos") queda cerrada. Sus Features dependientes quedan libres de este bloqueo nativo: [#13](https://github.com/reyduar/Vaqcrow/issues/13) (persistencia en Supabase), [#16](https://github.com/reyduar/Vaqcrow/issues/16) (shell y navegación, además bloqueada por #11 ya resuelto), [#20](https://github.com/reyduar/Vaqcrow/issues/20) (esquema y guardrails de IA) y [#27](https://github.com/reyduar/Vaqcrow/issues/27).

### Próximos pasos sugeridos

1. Revisar y mergear el Pull Request de esta rama contra `main`.
2. Backfillear el número de PR en la entrada del #40 de `demo-tasks-list.md` al archivar este cambio (mismo patrón que #38/#39).
3. Sincronizar el resto de `demo-tasks-list.md` (lista `Ready` de la línea 7, cadena tachada de la línea 49) en el commit de sincronización de roadmap posterior al merge, no en este cambio (decisión D5).
4. Evaluar abrir un issue de seguimiento para el rechazo de UUID v5 en `CorrelationId`, señalado como brecha abierta en la sección 5.
