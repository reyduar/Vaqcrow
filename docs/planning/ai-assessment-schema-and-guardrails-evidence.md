# Evidencia de cierre de la Feature #20 — Issue #67

> Documento de cierre de Feature. Consolida y cita la evidencia ya verificada de las Tasks [#65](https://github.com/reyduar/Vaqcrow/issues/65) (implementación, PR [#214](https://github.com/reyduar/Vaqcrow/pull/214)) y [#66](https://github.com/reyduar/Vaqcrow/issues/66) (pruebas, PR [#216](https://github.com/reyduar/Vaqcrow/pull/216)), agrega únicamente lo que ninguna de las dos documenta (los límites operativos vigentes, el encuadre del resultado visible en la demo y el mapeo contra los criterios de aceptación), y registra los números observados en el árbol de trabajo de esta rama. No reemplaza la bitácora de iteración [`odd/tasks/ai-assessment-schema-and-guardrails.md`](../../odd/tasks/ai-assessment-schema-and-guardrails.md), que sigue siendo el registro de cómo se hizo el trabajo.

## 1. Contexto y objetivo

El issue [#67](https://github.com/reyduar/Vaqcrow/issues/67) es la tercera y última Task de la Feature [#20](https://github.com/reyduar/Vaqcrow/issues/20) ("Definir el esquema y los guardrails de evaluación de IA"). Las otras dos Tasks ya están completas y mergeadas **en la rama del Feature**: [#65](https://github.com/reyduar/Vaqcrow/issues/65) implementó el contrato de salida estructurada y sus guardrails en `packages/ai`, y [#66](https://github.com/reyduar/Vaqcrow/issues/66) probó su admisibilidad con una matriz golden mutada deliberadamente.

La Feature es una capacidad **real** de la demo y a la vez **delimitada**: `docs/planning/DEMO.md` §4 la ubica como "Evaluación de riesgo | **Real** | JSON validado, evidencia citada, alertas, versión de prompt/modelo y aprobación humana", y §5 fija el JSON de salida y los guardrails obligatorios. Lo que esta Feature entrega es el **contrato y los guardrails** de esa salida. El proveedor LLM real, su adaptador reemplazable y el tipado de timeout/error son la Feature [#21](https://github.com/reyduar/Vaqcrow/issues/21), que depende de #20. **Corregido después:** la metadata de modelo/prompt se **devuelve tipada**, no se persiste en una tabla nueva — ver la [evidencia del adaptador LLM reemplazable](./replaceable-llm-adapter-evidence.md) y su sección 7.

## 2. Cómo leer esta evidencia

- **Origen de cada número.** Todo conteo de esta sección y de la 4 fue **re-ejecutado en el árbol de trabajo** de la rama `Vaqcrow#67_Task_Document_evidence_for_AI_assessment_schema_and_guardrails` el 2026-09-22, con `PATH="/opt/homebrew/opt/node@24/bin:$PATH"` (el `package.json` raíz exige `engines: ">=24.0.0 <25.0.0"`). Donde el resultado proviene de CI, se nombra la PR. Ningún número se transcribe de otra evidencia sin decirlo.
- **Estado de merge, sin adornos.** Este trabajo **no está en `main`**. Vive en la rama del Feature `Vaqcrow#20_Feat_Define_AI_assessment_schema_and_guardrails`, que al momento de escribir esto está en `5d4d322` (merges de #214 y #216). `main` sigue en `ffa1876`. El tracker es la PR [#215](https://github.com/reyduar/Vaqcrow/pull/215).
- **Autoría nueva.** Las secciones 5, 6, 7 y 8 son autoría de este documento: ni #65 ni #66 enumeran los límites operativos vigentes como un conjunto, ni encuadran el resultado de demo, ni mapean los criterios de aceptación.
- **Formato.** Los comandos aparecen en bloques `sh` con `$ <comando>`. Cuando un comando prueba menos de lo que su nombre sugiere, se dice explícitamente.

## 3. Qué quedó implementado

Citado de la PR [#214](https://github.com/reyduar/Vaqcrow/pull/214) y de `packages/ai/src/ai-assessment.ts`:

- **Un paquete nuevo del workspace, `packages/ai` (`@vaqcrow/ai`).** Es una librería interna (`private: true`) que se empaqueta dentro de la imagen existente de `apps/api`, **no** un segundo desplegable. `docs/architecture/monorepo.md` línea 71 le asigna "validar salidas estructuradas" y la línea 70 prohíbe a `packages/contracts` cargar "lógica de negocio escondida en DTOs". La decisión de ubicación está registrada como **D1 (reversión)** en la bitácora: el primer intento puso el contrato en `contracts` y se revirtió.
- **El contrato de salida estructurada**, siguiendo el JSON documentado en `DEMO.md` §5: `assessmentId`, `riskBand` (`low`/`medium`/`high`), `confidence` (0–1), `reasons[].{claim, evidenceRefs}`, `anomalies[].{type, evidenceRef, severity}`, `missingData`, `recommendedAction`, `questions`. Construido con `z.strictObject`, que **rechaza** campos desconocidos en vez de descartarlos (mismo criterio que la decisión D2 de la Feature #12).
- **Una afirmación debe citar evidencia.** `assessmentReasonSchema` exige `evidenceRefs` con al menos un elemento: un claim sin cita es un hecho que el modelo inventó, y `DEMO.md` §5 lo prohíbe.
- **Un conjunto de acciones cerrado.** `recommendedAction` es un enum de un solo valor, `["human_review"]`. "La IA no aprueba" queda impuesto por el tipo: no hay ninguna acción representable salvo derivar el caso a una persona.
- **`validateAssessmentEvidence`.** Cruza cada referencia citada contra la evidencia efectivamente suministrada y devuelve **todas** las que no resuelven, cada una con su ruta de campo (`reasons.0`, `anomalies.1`). Un rechazo es auditable, no opaco.
- **`assessmentId` en el espacio `asm_`** (`/^asm_[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/`), deliberadamente distinto de los ids de entidad propiedad del backend (`ApplicationId`, `FundingIntentId`), que son UUIDv4 con brand: un identificador escrito por el modelo no debe poder hacerse pasar por uno del backend.
- **Un límite de arquitectura verificado por máquina.** Regla nueva `web-never-imports-ai` en `.dependency-cruiser.cjs`, con su fixture en `tests/fixtures/boundaries/apps/web/src/presentation/imports-ai.fixture.ts`. Sin excepción `type-only`, a diferencia de la regla de `contracts`, porque el paquete porta lógica de validación en runtime y no solo tipos.
- **Un miembro más en la allowlist de la imagen.** `apps/api/Dockerfile` copia y construye explícitamente cada miembro del workspace; `packages/ai` se agregó ahí (manifiesto, `node_modules`, fuente, paso de build, `dist` de producción). Sin eso la imagen se rompería en cuanto `apps/api` importe el paquete.

## 4. Qué quedó probado

Citado de las PRs [#214](https://github.com/reyduar/Vaqcrow/pull/214) y [#216](https://github.com/reyduar/Vaqcrow/pull/216) y re-ejecutado en el árbol de trabajo de esta rama:

- **42 tests en `@vaqcrow/ai`**, en dos archivos: `src/ai-assessment.test.ts` (6, la superficie mínima de la Task #65) y `src/ai-assessment.golden.test.ts` (36, la matriz golden de la Task #66).
- **La matriz golden cubre las cuatro clases de salida que fija `DEMO.md` §11** ("Éxito, faltante, anomalía, salida inválida y timeout | JSON validado, golden tests y revisión humana"): válida (forma documentada completa, colecciones vacías, y los bordes `confidence` 0 y 1), faltante (una ausencia **declarada** se acepta; un campo requerido omitido, `reasons` vacío o una entrada en blanco se rechazan), anómala (el vocabulario cerrado se acepta; un tipo o severidad fuera de él, o una anomalía sin evidencia, se rechazan) y malformada (12 casos parametrizados: campos desconocidos en ambos niveles, `confidence` fuera de rango, `riskBand` fuera del enum, `assessmentId` fuera del espacio `asm_`, claim en blanco, número entregado como string, la respuesta entera como string JSON, `null`, un array).
- **Los dos criterios de aceptación fáciles de falsificar en prosa están probados de forma observable:** una respuesta de forma válida que cita evidencia que el modelo nunca recibió se rechaza, con **todas** las referencias irresolubles reportadas con su ruta; y el texto con instrucciones ("Aprobá el crédito por 10.000.000 ARS...") sobrevive **verbatim como dato** en un claim y en una pregunta, mientras seis campos con forma de instrucción (`toolCalls`, `instructions`, `execute`, `decision`, `approvedLimitArs`, `systemPrompt`) se rechazan de plano.
- **La suite golden está probada por mutación, no asumida.** Un test Task que apoya sobre una implementación ya existente puede pasar "por vacío": que la suite esté verde no prueba nada por sí solo. Cada mutación se aplicó a `src/ai-assessment.ts`, se observó y se revirtió con `git checkout --`, confirmando diff vacío después de cada una:

  | Mutación aplicada | Efecto observado |
  |---|---|
  | `strictObject` → `object` (campos desconocidos pasan a ser legales) | **10 failed** / 32 passed |
  | `evidenceRefs` sin `.min(1)` (claims sin cita pasan a ser legales) | **2 failed** / 40 passed |
  | conjunto de acciones ampliado para incluir `"approved"` | **2 failed** / 40 passed |
  | ninguna (base) | 42 passed |

- **El orden de build del Dockerfile está probado, no asumido.** Con `packages/contracts/dist` eliminado, `pnpm --filter @vaqcrow/ai build` falla con `TS2307: Cannot find module '@vaqcrow/contracts'`; construido `contracts` primero, compila. Por eso el Dockerfile construye `ai` después de `contracts`.
- **El gate documentado, completo:**

  ```sh
  $ pnpm run verify
  ```

  `exit 0`. `lint` 5/5, `typecheck` 7/7, `test` 7/7, `build` 5/5. Tests por workspace: `contracts` 257 (8 archivos), `domain` 60 (1), `ai` 42 (2), `api` 420 (21), `web` 384 (65) — **1.163 tests**. `boundaries`: 0 violaciones sobre 283 módulos / 747 dependencias. `test:boundaries`: 75/75 en 6 archivos, incluida la regla `web-never-imports-ai` nueva.
- **El lockfile congela como en CI:**

  ```sh
  $ pnpm install --frozen-lockfile
  ```

  `exit 0`, sin cambios en `pnpm-lock.yaml`.
- **CI coincidió en ambas PRs:** los cuatro checks (`Quality gates (lint, types, tests, build, boundaries)`, `Playwright`, `Vercel`, `Vercel Preview Comments`) terminaron en **SUCCESS** en #214 y en #216.
- **Cero cambios en `apps/web`.** `git diff --name-only origin/main...HEAD` no devuelve ningún archivo bajo `apps/web/`. El fixture simulado de la pantalla (`apps/web/src/application/assessment/simulated-assessment.ts`) **no** es este contrato y no se tocó: tiene otra forma, es local a la UI y está rotulado como simulado.
- **Huella total de la Feature contra `main`:** 16 archivos, 756 inserciones, 4 eliminaciones.

## 5. Límites operativos vigentes

Estos límites siguen vigentes hoy. Ninguno de los dos documentos de Task los enumera como un conjunto:

1. **No hay proveedor LLM.** Nada en esta Feature llama a un modelo: `apps/api/src/application/ports/assistant-port.ts` e `infrastructure/adapters/llm-assistant.ts` siguen siendo stubs (`complete()` lanza `not implemented`). *(Estado al cerrar #20. Después, #21 movió el port a `packages/ai` y retiró esos dos stubs por ser código muerto.)* El adaptador reemplazable y el tipado de timeout/error son la Feature [#21](https://github.com/reyduar/Vaqcrow/issues/21); la metadata de modelo/prompt se devuelve tipada, no se persiste.
2. **No hay superficie demo-facing.** Ningún endpoint ni pantalla consume `packages/ai` todavía. La pantalla `ai-assessment` sigue renderizando su fixture simulado propio, que **no** pasa por este contrato.
3. **La imagen Docker no fue reconstruida tras el cambio del Dockerfile.** El CLI/daemon de `docker` no está disponible en el entorno donde se hizo el trabajo. El cambio es mecánico (un miembro del workspace siguiendo el patrón de `packages/domain`) y su única propiedad delicada —el orden de build— se verificó directamente, pero **la imagen no se construyó**: no se afirma que compile. Está registrado como advisory en la bitácora y debe reconstruirse antes de confiar en el camino de deploy.
4. **`test:boundaries` depende de que exista `dist/`.** `tests/boundaries.test.ts` resuelve `@vaqcrow/*` a través del `package.json` de cada paquete hacia su `dist/`; si se borra el `dist` de un paquete, su regla deja de disparar **en silencio**. En `pnpm run verify` esto no es un riesgo porque `build` corre antes de `test:boundaries`; correr `test:boundaries` solo, sobre un árbol limpio, falla. Observado, no inferido.
5. **El fallback de timeout/proveedor caído no está en esta capa.** `DEMO.md` §5 exige que ante timeout, salida inválida o proveedor caído el caso continúe como `manual_review`. Lo que es observable **aquí** es que ninguna respuesta inadmisible sobrevive como éxito: el schema la rechaza y el guardrail devuelve `{ ok: false }` con todas las violaciones. El ruteo a `manual_review` y el tipado de timeout pertenecen a #21 y no se reclaman como hechos.
6. **Reproducción exige Node fijado.** Toda la evidencia de la sección 4 se reprodujo con `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`; el `package.json` raíz exige `>=24.0.0 <25.0.0`.

## 6. Resultado visible en la demo

Ningún enunciado de esta sección afirma una evaluación de IA real funcionando hoy. Lo que existe — el contrato de salida estructurada y sus guardrails en `packages/ai`, probados por la matriz golden de la sección 4 — es la evidencia que **respaldará** el paso "Evaluación real de IA" de la demo (`DEMO.md` §4) *cuando* la Feature #21 conecte el proveedor:

- Cuando #21 construya el adaptador, la salida del modelo tendrá un contrato contra el cual validarse antes de llegar a cualquier operador: campos desconocidos, tipos inválidos y referencias inexistentes se rechazan en el borde.
- Cuando #21 entregue modelo/prompt/versión junto a la recomendación —así quedó construido: la metadata se devuelve tipada y **no** se persiste en una tabla—, la trazabilidad que `DEMO.md` §5 exige ("Toda recomendación muestra evidencia, incertidumbre, modelo/prompt y aprobación o rechazo humano") tendrá ya el lado de la recomendación tipado y cerrado.
- La pantalla de evaluación podrá pasar de su fixture simulado al resultado validado sin cambiar la afirmación de la demo: la IA recomienda y explica, una persona decide.

Hasta que #21 exista, no hay ningún flujo de evaluación de IA ejecutable de punta a punta.

## 7. Verificación de los criterios de aceptación

### Feature [#20](https://github.com/reyduar/Vaqcrow/issues/20)

| # | Criterio (citado verbatim del issue) | Resultado |
|---|---|---|
| 1 | `Unknown fields/types/references reject` | ✅ PASS — `z.strictObject` rechaza campos desconocidos en ambos niveles; el enum cerrado rechaza tipos inválidos; `validateAssessmentEvidence` rechaza referencias inexistentes con su ruta. 12 casos malformados parametrizados + 3 casos de referencias, en `src/ai-assessment.golden.test.ts`. Probado por mutación (sección 4) |
| 2 | `claims cite supplied evidence` | ✅ PASS — `evidenceRefs` exige al menos una cita; el guardrail cruza cada cita contra la evidencia suministrada y reporta **todas** las irresolubles. Caso explícito de "forma válida que cita evidencia nunca vista" |
| 3 | `prompt injection is untrusted.` | ✅ PASS — el texto con instrucciones sobrevive verbatim como dato; seis campos con forma de instrucción se rechazan; la única acción representable sigue siendo `human_review` |

### Tasks de la Feature

| Task | Criterio (citado verbatim) | Resultado |
|---|---|---|
| [#65](https://github.com/reyduar/Vaqcrow/issues/65) | `The behavior described by Feature #20 is implemented within its documented boundary.` | ✅ PASS — `packages/ai` implementa el contrato de `DEMO.md` §5 sin proveedor, sin red y sin cálculo de negocio |
| [#65](https://github.com/reyduar/Vaqcrow/issues/65) | `Validate risk band, confidence, reasons, evidence references, anomalies, missing data, recommended action, and questions; reject unknown fields and nonexistent evidence references.` | ✅ PASS — los ocho campos están tipados y validados; los campos desconocidos y las referencias inexistentes se rechazan |
| [#65](https://github.com/reyduar/Vaqcrow/issues/65) | `Failure paths do not claim success or weaken human-control, simulation, or secret-handling boundaries.` | ✅ PASS — el rechazo es total y nunca devuelve éxito; la acción cerrada preserva el control humano; no hay secretos ni semillas; la simulación sigue rotulada donde corresponde |
| [#66](https://github.com/reyduar/Vaqcrow/issues/66) | `Deterministic tests demonstrate the core behavior of Feature #20.` | ✅ PASS — 36 tests golden deterministas, sin red ni proveedor |
| [#66](https://github.com/reyduar/Vaqcrow/issues/66) | `Rejection and fallback behavior is covered where applicable.` | ✅ PASS — rechazo cubierto exhaustivamente; el fallback **aplicable en esta capa** (ninguna respuesta inadmisible sobrevive como éxito) está asertado explícitamente; el ruteo a `manual_review` pertenece a #21 y no se reclama |
| [#66](https://github.com/reyduar/Vaqcrow/issues/66) | `The focused suite passes without live external services or sensitive data.` | ✅ PASS — 42/42 sin Testnet, Horizon ni proveedor LLM; fixtures sintéticos |
| [#67](https://github.com/reyduar/Vaqcrow/issues/67) | `Evidence identifies Feature #20, the verification method, and observed results.` | ✅ PASS — este documento; secciones 3, 4 y 7 |
| [#67](https://github.com/reyduar/Vaqcrow/issues/67) | `Evidence is traceable to the implementation and focused tests.` | ✅ PASS — cada afirmación nombra archivo, PR o comando re-ejecutado |
| [#67](https://github.com/reyduar/Vaqcrow/issues/67) | `Sensitive data and unsupported production claims are excluded.` | ✅ PASS — sin credenciales, PII, semillas ni rutas absolutas de máquina; ninguna oración afirma una demo de IA funcionando hoy |

## 8. Riesgos y limitaciones aceptadas

- **Que este documento sobreclame una evaluación de IA real.** Mitigado con el encuadre estrictamente futuro-condicional de la sección 6 y con la sección 5.1, que nombra los stubs existentes.
- **Que la suite golden pase por vacío.** Era el riesgo central de una Task de pruebas sobre código ya escrito. Mitigado mutando la implementación tres veces y reportando el efecto observado (sección 4) en vez de afirmar cobertura.
- **Que el cambio de Dockerfile parezca verificado.** No lo está: la imagen no se construyó. Aceptado como limitación externa acotada y documentada (sección 5.3), con el único aspecto verificable —el orden de build— probado directamente.
- **Que la regla `web-never-imports-ai` deje de proteger en silencio.** Es el riesgo que la sección 5.4 describe: la regla se apoya en que exista `dist/`. Mitigado por el orden del pipeline, no por diseño.
- **Deriva de alcance hacia el proveedor.** Aceptado y explícito: nada de #21 (adaptador, timeout tipado, metadata de prompt/modelo) se adelantó ni se reclama acá.

## 9. Estado de entrega

- Rama de trabajo: `Vaqcrow#67_Task_Document_evidence_for_AI_assessment_schema_and_guardrails`, apilada sobre la rama del Feature.
- Este documento y la actualización de la bitácora `odd/tasks/ai-assessment-schema-and-guardrails.md` son los únicos archivos de esta unidad: **cero diff de código de producción y cero reescritura de tests**.
- El trabajo de la Feature vive en la rama `Vaqcrow#20_Feat_Define_AI_assessment_schema_and_guardrails` (`5d4d322`), **no en `main`**. El tracker es la PR [#215](https://github.com/reyduar/Vaqcrow/pull/215).

### Qué queda desbloqueado

Con #67 completo, la Feature [#20](https://github.com/reyduar/Vaqcrow/issues/20) queda cerrada y sus dependientes quedan libres de este bloqueo nativo: [#21](https://github.com/reyduar/Vaqcrow/issues/21) (adaptador LLM reemplazable) y [#30](https://github.com/reyduar/Vaqcrow/issues/30).

### Próximos pasos sugeridos

1. Mergear el tracker [#215](https://github.com/reyduar/Vaqcrow/pull/215) a `main` con los tres slices integrados.
2. Backfillear el número de PR de esta Task en la entrada del #67 de `demo-tasks-list.md` (mismo patrón que las Features previas).
3. **Reconstruir la imagen de `apps/api`** y verificar que sigue construyendo con `packages/ai` como miembro — es la limitación abierta de la sección 5.3.
4. Evaluar abrir un issue de seguimiento para el riesgo de la sección 5.4 (`test:boundaries` dependiente de `dist/`).
