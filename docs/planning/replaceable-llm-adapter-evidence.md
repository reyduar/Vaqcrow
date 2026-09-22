# Evidencia de cierre de la Feature #21 — Issue #70

> Documento de cierre de Feature. Consolida y cita la evidencia ya verificada de las Tasks [#68](https://github.com/reyduar/Vaqcrow/issues/68) (implementación, PR [#219](https://github.com/reyduar/Vaqcrow/pull/219)) y [#69](https://github.com/reyduar/Vaqcrow/issues/69) (pruebas, PR [#221](https://github.com/reyduar/Vaqcrow/pull/221)), agrega lo que ninguna de las dos documenta (los límites operativos vigentes, el encuadre del resultado de demo y el mapeo contra los criterios de aceptación), **corrige cuatro afirmaciones del documento de evidencia de la Feature #20 que esta Feature dejó falsas**, y registra los números observados en el árbol de trabajo de esta rama. No reemplaza la bitácora [`odd/tasks/replaceable-llm-adapter.md`](../../odd/tasks/replaceable-llm-adapter.md), que sigue siendo el registro de cómo se hizo el trabajo.

## 1. Contexto y objetivo

El issue [#70](https://github.com/reyduar/Vaqcrow/issues/70) es la tercera y última Task de la Feature [#21](https://github.com/reyduar/Vaqcrow/issues/21) ("Implementar un adaptador LLM reemplazable"). Las otras dos Tasks están completas y mergeadas **en la rama del Feature**: [#68](https://github.com/reyduar/Vaqcrow/issues/68) implementó el límite del proveedor en `packages/ai`, y [#69](https://github.com/reyduar/Vaqcrow/issues/69) lo probó con una matriz de contrato y timeout que además **encontró y cerró un defecto real** de sanitización en #68.

El objetivo de esta Feature es la capacidad diferencial de la demo: `DEMO.md` §4 ubica la evaluación de riesgo como **Real**, y §5 exige que la respuesta se valide contra un esquema estricto. Lo que #21 entrega es el **límite** de esa capacidad —cómo se llama a un modelo, qué se le envía, qué se acepta de vuelta y cómo falla—. **El proveedor real sigue sin elegir**: `DEMO.md` línea 132 lo deja como `TBD` y la línea 412 lista elegirlo como ítem P0 de preparación de la demo. Nada de esta Feature depende de esa elección.

## 2. Cómo leer esta evidencia

- **Origen de cada número.** Todo conteo de las secciones 3 y 4 fue **re-ejecutado en el árbol de trabajo** de la rama `Vaqcrow#70_Task_Document_evidence_for_replaceable_LLM_adapter` el 2026-09-22, con `PATH="/opt/homebrew/opt/node@24/bin:$PATH"` (el `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`). Donde el resultado viene de CI, se nombra la PR.
- **Estado de merge, sin adornos.** Este trabajo **no está en `main`**. Vive en la rama del Feature `Vaqcrow#21_Feat_Implement_replaceable_LLM_adapter`, que al escribir esto está en `86b8ffa` (merges de #219 y #221). `main` sigue en `4702e5d`. El tracker es la PR [#220](https://github.com/reyduar/Vaqcrow/pull/220).
- **Autoría nueva.** Las secciones 5, 6, 7, 8 y 9 son autoría de este documento: ni #68 ni #69 enumeran los límites operativos como un conjunto, ni encuadran el resultado de demo, ni mapean los criterios de aceptación, ni registran las correcciones de la sección 7.
- **Formato.** Los comandos aparecen en bloques `sh` con `$ <comando>`.

## 3. Qué quedó implementado

Citado de la PR [#219](https://github.com/reyduar/Vaqcrow/pull/219), de la PR [#221](https://github.com/reyduar/Vaqcrow/pull/221) y del código en `packages/ai/src/`:

- **Un port que mantiene a los vendors afuera** (`assessment-provider-port.ts`). `AssessmentProviderPort` recibe la evidencia y devuelve, o bien `rawOutput` **sin validar** más metadata, o bien uno de dos códigos de falla sanitizados. Ningún tipo de SDK, ninguna clave y ninguna forma de error de vendor cruza el límite. `rawOutput` es `unknown` a propósito: un proveedor no declara válida su propia salida.
- **El límite de entrada es la evidencia, no un prompt** (`assessment-evidence.ts`). `assessmentEvidenceBundleSchema` reusa `salesPeriodSchema` y `reviewFindingSchema` de `@vaqcrow/contracts`, y `citableReferences` deriva el conjunto citable de exactamente ese bundle. "Solo se envía la evidencia suministrada" es una propiedad del tipo, no una promesa en un comentario.
- **La orquestación independiente del proveedor** (`run-assessment.ts`): llama, valida contra el contrato de la Feature #20, valida las referencias contra la evidencia suministrada, y convierte toda falla en un error tipado. `invalid_output`, `unknown_evidence_reference` (con todas las referencias irresolubles y su ruta), `timeout`, `provider_unavailable`. Un proveedor que **lanza** se mapea a `provider_unavailable` en vez de propagar una excepción.
- **Sanitización en el límite** (defecto encontrado por #69 y corregido en el commit `2677c84`): la falla se reconstruye desde el único campo permitido, y un código desconocido cae a `provider_unavailable`. La metadata se valida contra la forma declarada, así un proveedor no puede agregarle campos a lo que ve un operador.
- **Un proveedor simulado** (`simulated-assessment-provider.ts`) que se marca `source: "simulated"` en su metadata. No es un doble de test: es el proveedor de la demo hasta que el real se elija, y la marca hace imposible que una evaluación simulada pase por real aguas abajo.
- **El port se mudó a `packages/ai` y se retiraron dos stubs muertos de `apps/api`.** No fue una preferencia: la regla `packages-never-import-apps` prohíbe que un paquete importe una aplicación, así que un port propiedad de `apps/api` jamás podría implementarse dentro de `packages/ai`, que es donde `monorepo.md` línea 71 ubica "encapsular el proveedor LLM". `apps/api/src/application/ports/assistant-port.ts` e `infrastructure/adapters/llm-assistant.ts` eran **código muerto verificado** —solo se referenciaban entre ellos— y se eliminaron.
- **Ningún SDK de proveedor.** La elección del vendor queda libre: el real será una implementación más del port.

## 4. Qué quedó probado

Citado de las PRs [#219](https://github.com/reyduar/Vaqcrow/pull/219) y [#221](https://github.com/reyduar/Vaqcrow/pull/221) y re-ejecutado en el árbol de esta rama:

- **89 tests en `@vaqcrow/ai`**, en cuatro archivos: `ai-assessment.test.ts` (6), `ai-assessment.golden.test.ts` (36, de la Feature #20), `run-assessment.test.ts` (8, de #68) y `run-assessment.contract.test.ts` (39, de #69).
- **Conformidad entre implementaciones.** Una única suite corre contra *todas* las implementaciones del port —la simulada y una escrita a mano— y exige que sean indistinguibles para el llamador. Es lo que hace que "el proveedor sigue siendo reemplazable" sea una prueba y no una afirmación.
- **Bordes de timeout:** un proveedor que nunca responde; uno que responde después del deadline; uno que responde antes; uno que reporta su propio timeout; y que un proveedor inmediato **no** haga esperar al llamador por un timer de cinco segundos que nunca necesitó (lo que prueba que el timer se limpia).
- **Sanitización de fallas:** un `Error` lanzado, un rechazo que no es `Error`, un objeto de error con campos extra, y un proveedor que lanza en el camino del timeout. Ninguno filtra texto, y todos mapean a un código sanitizado.
- **Límite de evidencia:** se envía el bundle y nada más (`Object.keys` es exactamente `["evidence"]`, y es la misma referencia); las referencias deduplican; un finding sin `evidenceRef` no aporta nada citable; una cita que solo un finding suministra se acepta; un bundle sin períodos, o un período con un campo no declarado, se rechazan.
- **Matriz de salidas malformadas:** 11 salidas del proveedor —confianza fuera de rango, acción fuera del conjunto cerrado, un canal de tool-call colado, sin razones, un string JSON, `null`, un array, un campo faltante— mapean todas a `invalid_output`.
- **Ningún camino de falla reclama éxito:** una tabla sobre cinco modos de falla verifica que cada uno devuelve una falla, no trae `value` y usa uno de los cuatro códigos declarados.
- **La suite está probada por mutación**, contra un restore verificado byte a byte con `cmp`:

  | Mutación aplicada | Efecto observado |
  |---|---|
  | la falla del proveedor se pasa tal cual (sanitización revertida) | **1 failed** / 88 passed |
  | se quita la validación de metadata | **1 failed** / 88 passed |
  | se quita la carrera del timeout | **3 failed** / 86 passed |
  | se saltea el guardrail de evidencia | **4 failed** / 85 passed |
  | ninguna (base) | 89 passed |

- **El gate documentado, completo:**

  ```sh
  $ pnpm run verify
  ```

  `exit 0`. Tests por workspace: `contracts` 257 (8 archivos), `domain` 60 (1), `ai` 89 (4), `api` 420 (21), `web` 384 (65) — **1.210 tests**. `boundaries`: 0 violaciones sobre 289 módulos / 772 dependencias. `test:boundaries`: 75/75 en 6 archivos.
- **CI coincidió en ambas PRs:** los cuatro checks (`Quality gates (lint, types, tests, build, boundaries)`, `Playwright`, `Vercel`, `Vercel Preview Comments`) terminaron en **SUCCESS** en #219 y en #221.
- **Cero cambios en `apps/web`.** `git diff --name-only origin/main...HEAD` no devuelve ningún archivo bajo `apps/web/`.
- **Huella total de la Feature contra `main`:** 10 archivos, 1.032 inserciones.

## 5. Límites operativos vigentes

Estos límites siguen vigentes hoy. Ninguno de los dos documentos de Task los enumera como un conjunto:

1. **No hay proveedor real.** El vendor está `TBD` (`DEMO.md` línea 132) y la línea 412 lo lista como ítem P0 de preparación. La única implementación que existe es la simulada, y se identifica como tal en su metadata. **No hay ninguna evaluación de IA real en este repositorio.**
2. **No hay superficie demo-facing.** Ningún endpoint ni pantalla consume `packages/ai`. La pantalla `ai-assessment` sigue renderizando su fixture simulado propio (`apps/web/src/application/assessment/simulated-assessment.ts`), que no pasa por este límite y no se tocó.
3. **La metadata se devuelve, no se persiste.** No hay tabla nueva. La decisión y su justificación están en la bitácora (D2) y obligaron a las correcciones de la sección 7.
4. **La metadata es estricta a propósito.** Un adapter de terceros que agregue un campo a su metadata (por ejemplo `latencyMs`) falla como `invalid_output` en vez de pasarlo. Es el comportamiento fail-closed buscado: el tipo del port es el contrato, así que un campo nuevo significa cambiar el contrato, no colarlo.
5. **El timeout es de la orquestación, con un timer real.** El perdedor de la carrera queda **abandonado, no cancelado**: no hay `AbortSignal`. Es aceptable para un proveedor propio y acotado, pero un SDK real debería además honrar su propio timeout de red; queda como responsabilidad de la implementación que se elija.
6. **La imagen Docker no fue reconstruida** desde que `packages/ai` se agregó como miembro del workspace (arrastrado de la Feature #20). El CLI de `docker` no está disponible en este entorno.
7. **`test:boundaries` depende de que exista `dist/`** (arrastrado de la Feature #20): resuelve `@vaqcrow/*` a través del `package.json` de cada paquete hacia su `dist/`. Dentro de `pnpm run verify` no es un riesgo porque `build` corre antes.
8. **Reproducción exige Node fijado.** Toda la evidencia de la sección 4 se reprodujo con `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.

## 6. Resultado visible en la demo

Ningún enunciado de esta sección afirma una evaluación de IA real funcionando hoy. Lo que existe —el límite del proveedor, probado por la matriz de la sección 4— es la evidencia que **respaldará** el paso "Evaluación real de IA" de la demo (`DEMO.md` §4) *cuando* se elija un vendor:

- Cuando se elija el proveedor, será una implementación más de `AssessmentProviderPort`, y la suite de conformidad ya exige que se comporte igual que las otras dos.
- La salida del modelo tendrá un contrato contra el cual validarse antes de llegar a cualquier operador: campos desconocidos, tipos inválidos y referencias inexistentes se rechazan en el borde.
- La recomendación viajará con su modelo y su versión de prompt, que es lo que `DEMO.md` §5 exige mostrar junto a la aprobación o rechazo humano.
- El texto con instrucciones dentro de un documento sigue siendo dato: el único campo de acción del contrato es `human_review`.

Hasta que se elija el proveedor, no hay ningún flujo de evaluación de IA ejecutable de punta a punta.

## 7. Correcciones de documentación de este cambio

El documento de evidencia de la Feature #20 (`ai-assessment-schema-and-guardrails-evidence.md`) describía el alcance futuro de #21 incluyendo la **persistencia** de modelo/prompt/versión. Esta Feature no la construyó así —la metadata se devuelve tipada, sin tabla—, de modo que esas afirmaciones quedaron falsas. Este cambio corrige exactamente las cuatro referencias afectadas, marcando cada una como corrección en lugar de reescribir la narrativa histórica de ese documento:

- **Sección 1 (línea 9)** — la enumeración de lo que corresponde a #21 ya no incluye la persistencia, y agrega un **Corregido después** que remite a este documento.
- **Sección 5.1** — la afirmación de que los dos stubs "siguen siendo stubs" queda marcada como *estado al cerrar #20*, con la nota de que #21 movió el port a `packages/ai` y los retiró por ser código muerto; y la enumeración de #21 pierde la persistencia.
- **Sección 6** — la frase predictiva "Cuando #21 persista modelo/prompt/versión" pasa a describir lo que efectivamente se construyó: la metadata se devuelve y **no** se persiste.
- **Sección 8** — la lista de alcance explícitamente no adelantado cambia "persistencia de prompt/modelo" por "metadata de prompt/modelo".

Ninguna otra línea de ese documento cambió: se conserva como registro fiel de lo que la Feature #20 probó al cerrarse, no como descripción del estado actual.

## 8. Verificación de los criterios de aceptación

### Feature [#21](https://github.com/reyduar/Vaqcrow/issues/21)

| # | Criterio (citado verbatim del issue) | Resultado |
|---|---|---|
| 1 | `Provider stays replaceable` | ✅ PASS — una suite de conformidad corre contra dos implementaciones independientes y exige el mismo comportamiento; ningún tipo de vendor cruza el port; ningún SDK está instalado |
| 2 | `timeout/error is typed` | ✅ PASS — cuatro códigos cerrados (`timeout`, `provider_unavailable`, `invalid_output`, `unknown_evidence_reference`), con los bordes de timeout probados y el timer verificado |
| 3 | `only supplied evidence is sent.` | ✅ PASS — el límite de entrada es el bundle de evidencia; se verifica que se envía el bundle y nada más, y que citar algo fuera de él se rechaza |

### Tasks de la Feature

| Task | Criterio (citado verbatim) | Resultado |
|---|---|---|
| [#68](https://github.com/reyduar/Vaqcrow/issues/68) | `The behavior described by Feature #21 is implemented within its documented boundary.` | ✅ PASS — el límite vive en `packages/ai`, sin SDK, sin red y sin cálculo de negocio |
| [#68](https://github.com/reyduar/Vaqcrow/issues/68) | `Call the selected model through a replaceable adapter, retain prompt and model metadata, validate structured output, and prevent provider details from leaking into domain code.` | ✅ PASS con una salvedad declarada — el llamado a través del adapter reemplazable, la retención de metadata y la validación de la salida están implementados y probados. **No hay "modelo seleccionado" todavía**: la elección del vendor es un ítem P0 de preparación de demo, así que hoy el único proveedor es el simulado. Los detalles de proveedor no cruzan el límite y `packages/domain` no se tocó |
| [#68](https://github.com/reyduar/Vaqcrow/issues/68) | `Failure paths do not claim success or weaken human-control, simulation, or secret-handling boundaries.` | ✅ PASS — ninguna falla devuelve una evaluación; el único campo de acción del contrato es `human_review`; el proveedor simulado se rotula como tal; no hay claves ni secretos (no se agregó ningún SDK que las necesite) |
| [#69](https://github.com/reyduar/Vaqcrow/issues/69) | `Deterministic tests demonstrate the core behavior of Feature #21.` | ✅ PASS — 47 tests deterministas (8 + 39), sin red ni proveedor |
| [#69](https://github.com/reyduar/Vaqcrow/issues/69) | `Rejection and fallback behavior is covered where applicable.` | ✅ PASS — matriz de 11 salidas malformadas, cuatro códigos de falla, sanitización, y una tabla que garantiza que ningún camino de falla reclama éxito |
| [#69](https://github.com/reyduar/Vaqcrow/issues/69) | `The focused suite passes without live external services or sensitive data.` | ✅ PASS — 89/89 sin Testnet, Horizon ni proveedor LLM vivo; fixtures sintéticos |
| [#70](https://github.com/reyduar/Vaqcrow/issues/70) | `Evidence identifies Feature #21, the verification method, and observed results.` | ✅ PASS — este documento; secciones 3, 4 y 8 |
| [#70](https://github.com/reyduar/Vaqcrow/issues/70) | `Evidence is traceable to the implementation and focused tests.` | ✅ PASS — cada afirmación nombra archivo, PR, commit o comando re-ejecutado |
| [#70](https://github.com/reyduar/Vaqcrow/issues/70) | `Sensitive data and unsupported production claims are excluded.` | ✅ PASS — sin credenciales, PII, semillas ni rutas absolutas de máquina; ninguna oración afirma una evaluación de IA real funcionando hoy |

## 9. Riesgos y limitaciones aceptadas

- **Que este documento sobreclame una evaluación de IA real.** Mitigado con el encuadre futuro-condicional de la sección 6 y con la sección 5.1, que dice explícitamente que no hay ninguna.
- **Que "el proveedor es reemplazable" se afirme sin prueba.** Era el riesgo central de la Feature. Mitigado con una suite de conformidad que corre contra dos implementaciones independientes, no contra una.
- **Que la matriz de tests pase por vacío.** Mitigado mutando la implementación cuatro veces y reportando el efecto observado; además, la matriz ya había producido un RED real (el defecto de sanitización de #68), que es evidencia más fuerte que una mutación.
- **Que el defecto de sanitización hubiera llegado al merge.** No llegó: lo encontró la Task de pruebas ordenada, que es exactamente para lo que existe. Queda registrado como hallazgo y no como una revisión que lo detectó.
- **Metadata estricta como decisión de diseño.** Aceptada y documentada (sección 5.4): un campo nuevo exige cambiar el contrato, no colarlo.
- **Deriva de alcance hacia el vendor.** Aceptada y explícita: no se instaló ningún SDK ni se eligió proveedor.

## 10. Estado de entrega

- Rama de trabajo: `Vaqcrow#70_Task_Document_evidence_for_replaceable_LLM_adapter`, apilada sobre la rama del Feature.
- Este documento, las cuatro correcciones acotadas de la sección 7 y la actualización de la bitácora son los únicos archivos de esta unidad: **cero diff de código de producción y cero reescritura de tests**.
- El trabajo de la Feature vive en la rama `Vaqcrow#21_Feat_Implement_replaceable_LLM_adapter` (`86b8ffa`), **no en `main`**. El tracker es la PR [#220](https://github.com/reyduar/Vaqcrow/pull/220).

### Qué queda desbloqueado

Con #70 completo, la Feature [#21](https://github.com/reyduar/Vaqcrow/issues/21) queda cerrada y su dependiente queda libre de este bloqueo nativo: [#22](https://github.com/reyduar/Vaqcrow/issues/22) (derivar fallos de IA).

### Próximos pasos sugeridos

1. Mergear el tracker [#220](https://github.com/reyduar/Vaqcrow/pull/220) a `main` con los tres slices integrados.
2. Backfillear el número de PR de esta Task en la entrada del #70 de `demo-tasks-list.md`, y mover [#22](https://github.com/reyduar/Vaqcrow/issues/22) a `Ready` ahora que su bloqueo se cierra.
3. **Elegir proveedor y modelo LLM** — es un ítem P0 de preparación de demo (`DEMO.md` línea 412), y es el único bloqueo que queda para que el camino de IA sea real.
4. **Reconstruir la imagen de `apps/api`** y verificar que sigue construyendo con `packages/ai` como miembro — limitación abierta de la sección 5.6.
