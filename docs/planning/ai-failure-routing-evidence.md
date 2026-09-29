# Evidencia de cierre de la Feature #22 — Issue #73

> Documento de cierre de Feature. Consolida evidencia verificable de las Tasks [#71](https://github.com/reyduar/Vaqcrow/issues/71) (implementación) y [#72](https://github.com/reyduar/Vaqcrow/issues/72) (pruebas determinísticas), y registra una reproducción local sobre `e185fd6`. No implementa código, no altera migraciones ni contratos y no sustituye los registros de iteración [[odd/tasks/implement-ai-failure-routing-to-manual-review|#71]] y [[odd/tasks/test-ai-failure-routing-to-manual-review|#72]].

> **Límite de la demo.** Todo lo de este documento es una **demo simulada y no productiva**. La evaluación de IA es un fixture sintético y proveedor simulado, el actor es un campo de texto libre (no hay autenticación), y Stellar corre en Testnet sin valor económico. La IA es solo asesora: **un fallo nunca aprueba**, solo deriva a una persona. Nada de este trabajo es KYC/KYB ni una decisión crediticia de producción.

## 1. Contexto y objetivo

La Feature [#22](https://github.com/reyduar/Vaqcrow/issues/22) exige que un fallo de la evaluación de IA —timeout, salida estructurada inválida, referencia de evidencia inexistente o caída del proveedor— derive a **revisión manual veraz**, con estados de respaldo etiquetados y sin aprobar nunca. Su criterio de aceptación es explícito: *Failure never approves · backup is labelled · operator can continue manually.*

Se entregó como una cadena de tres Tasks sobre la persistencia `application_review` existente:

| Task | Rol | Cierre |
|---|---|---|
| [#71](https://github.com/reyduar/Vaqcrow/issues/71) | Implementación del handoff sanitizado, el ruteo y el contexto de revisión manual | PRs [#335](https://github.com/reyduar/Vaqcrow/pull/335) y [#338](https://github.com/reyduar/Vaqcrow/pull/338) |
| [#72](https://github.com/reyduar/Vaqcrow/issues/72) | Matriz determinista y cierre de los dos huecos declarados | PR [#339](https://github.com/reyduar/Vaqcrow/pull/339) |
| [#73](https://github.com/reyduar/Vaqcrow/issues/73) | Este documento de evidencia | Rama local, **sin mergear** |

**Cadena de entrega real en `main`:**

- Task #71 llegó en dos PRs. La parte 1 (`AI-71-01`: contrato, adaptador, migración y pgTAP) se mergeó por [PR #335](https://github.com/reyduar/Vaqcrow/pull/335) → merge commit `c1a59ff`. La parte 2 y 3 más su corrección (`AI-71-02`, `AI-71-03`) se mergearon por [PR #338](https://github.com/reyduar/Vaqcrow/pull/338) → merge commit `927e923`. El issue #71 fue cerrado el 2026-09-29 por el PR #338 (`closed_by_pull_requests`).
- Task #72 se mergeó por [PR #339](https://github.com/reyduar/Vaqcrow/pull/339) → merge commit `e185fd6`. El issue #72 fue cerrado el 2026-09-29.
- Task #73 es **este documento**: su rama `Vaqcrow#73_Task_Document_evidence_for_AI_failure_routing_to_manual_review` todavía **no está mergeada** ni el issue #73 cerrado.

Los commits de la Feature sobre `d44908b` (merge de #85) hasta `e185fd6` son `3fad6a0`, `d1281ee`, `fcebf1f`, `568f5d7`, `8f0f196`, `af5647b`, `9478052`, `35ec574`, `c4db07d`, `1b7f3ad`, `c1a59ff` (merge #335), `927e923` (merge #338), `db80aa9`, `32ced80`, `8be2fc3` y `e185fd6` (merge #339). El diff agregado es de **35 archivos, 4398 inserciones y 17 eliminaciones**.

## 2. Cómo leer esta evidencia

- **Hechos verificados:** se derivan de los commits versionados, los archivos presentes en `main` y los comandos de §5 ejecutados el 2026-09-29 sobre `e185fd6` (Node 24.21.0, pin del repo `24`).
- **Hechos simulados de la demo:** se identifican expresamente como tales. El proveedor de IA y la evidencia son sintéticos; el actor es autodeclarado.
- **Trabajo futuro:** se formula como futuro y no como capacidad entregada.
- **Origen de cada resultado:** §5 nombra, para cada comando, si proviene de una re-ejecución en este árbol de trabajo o de un run registrado. No se reporta ningún estado mergeado que no exista.

## 3. Implementación trazable

| Límite entregado | Ruta verificable | Hecho comprobado |
|---|---|---|
| Contrato del handoff sanitizado | `packages/contracts/src/assessment-failure-handoff.ts`, `assessment-failure-handoff.test.ts` | Esquema zod estricto del comando de fallo; conjunto cerrado `timeout \| provider_unavailable \| invalid_output \| unknown_evidence_reference`; rechaza como claves desconocidas salida cruda del proveedor, errores de vendor, secretos, PII, semillas y metadatos de procedencia arbitrarios. |
| Identidad durable del replay | `packages/contracts/src/assessment-handoff-id.ts` | `parseAssessmentHandoffId` (uuidv4 con marca), análogo a `human-decision-id.ts`; es la clave que decide replay vs. conflicto. |
| Vista portable de revisión manual | `packages/contracts/src/application-manual-review.ts` | `applicationManualReviewContextSchema` estricto: `failureCode`, `evidence`, `providerProvenance?`, `applicationState`, `recordedAt`; sin campos para diagnóstico crudo. |
| Puerto de repositorio | `apps/api/src/application/ports/application-review-repository-port.ts` | Suma el código saneado `correlation_conflict`, el outcome y `recordAssessmentFailureHandoff`; importa solo tipos de contrato (sin Fastify/Supabase/SDK de LLM). |
| Adaptador Supabase | `apps/api/src/infrastructure/adapters/supabase-application-review-repository.ts` | Llama a la RPC atómica y revalida la fila con el parser del contrato; mapea `applied`/`replayed`/`not_found`/`state_conflict`/`correlation_conflict`; nunca devuelve diagnósticos del proveedor. |
| Persistencia atómica | `supabase/migrations/20260928235908_create_assessment_failure_handoff.sql`, `supabase/tests/assessment_failure_handoff.sql` | Tabla + RLS + grants explícitos + RPC atómica, siguiendo el patrón de `record_human_decision`; pgTAP de 20 aserciones. |
| Caso de uso de ruteo | `apps/api/src/application/use-cases/route-assessment-failure-to-manual-review.ts` | Orquesta persistir-primero y luego `transition({ from: "awaiting_assessment", to: "human_review" })`; el camino de fallo nunca devuelve evaluación, recomendación ni aprobación. |
| Superficie HTTP de fallo | `apps/api/src/infrastructure/http/routes/application-assessment.route.ts` | `POST /application-reviews/:applicationId/assessments`, cuerpo exacto `{ evidence, handoffId }`; proveedor y timeout siempre vienen de las dependencias. |
| Superficie HTTP de lectura | `apps/api/src/infrastructure/http/routes/application-manual-review.route.ts` | `GET /application-reviews/:applicationId/manual-review`: `400` antes de tocar el repositorio, `404 not_found` veraz, `503 unavailable` saneado. |
| Web de revisión manual | `apps/web/src/application/ports/manual-review-gateway.ts`, `infrastructure/manual-review/`, `state/use-manual-review-context.ts`, `presentation/components/manual-review-context-panel.tsx`, `human-decision-workspace.tsx` | Carga el contexto por un `ManualReviewGateway` inyectable; cuando el contexto está presente reemplaza la recomendación simulada **solo para este flujo**; `SIMULADO` aparece únicamente si `providerProvenance.source === "simulated"`; el panel no ofrece ningún control de aprobación. |

> [!info] Separación de capas
> `apps/api/src/application` permanece libre de Fastify/Supabase/SDK de LLM (solo tipos de contrato y el paquete `@vaqcrow/ai`); las rutas viven en `infrastructure/http/`; `apps/web` no importa `packages/domain` y toca `@vaqcrow/contracts` como tipo desde `presentation/`. `pnpm run boundaries` lo confirma en §5.

## 4. Cobertura determinística

La Task #72 auditó la cobertura ya existente y agregó las filas que faltaban, sin duplicar. La matriz cubre, entre otras:

- Los **cuatro códigos del conjunto cerrado** en el borde HTTP → `201` con código saneado y conjunto exacto de claves.
- El **camino de fallo nunca transporta** `assessment`, `recommendation`, `decision` ni `approval`.
- **Recuperación tras caída**: handoff replayado completa la transición pendiente (`applied: true`, `201`).
- **Guard de determinismo**: el mismo input dos veces devuelve resultados deep-equal y comandos de repositorio idénticos; el timestamp del metadata es el reloj fijado inyectado; `fetch` nunca se llama.
- **Asimetría de restricciones** registrada honestamente: una fila que el CHECK de la base admite pero el parser estricto rechaza → la lectura falla cerrada a `unavailable` (`503`).
- **Web**: contexto persistido reemplaza la recomendación simulada; `absent` veraz conserva la recomendación del flujo no relacionado; una request fallida produce un estado `unavailable` propio con aviso de indisponibilidad y **sin** recomendación simulada.

Estos escenarios viven en `assessment-failure-handoff.test.ts`, `assessment-handoff-id.test.ts`, `route-assessment-failure-to-manual-review.test.ts`, `application-assessment.route.test.ts`, `supabase-application-review-repository.test.ts`, `application-manual-review.route.test.ts`, `use-manual-review-context.test.tsx`, `human-decision-workspace.test.tsx`, `http-manual-review-gateway.test.ts` y `manual-review-context-panel.test.tsx`.

## 5. Resultados de verificación observados

Reproducido localmente el 2026-09-29 sobre `e185fd6` (Node 24.21.0), antes de modificar este documento. **Suites focalizadas del flujo de fallo, re-ejecutadas en este árbol:**

```sh
$ pnpm --filter @vaqcrow/contracts exec vitest run src/assessment-failure-handoff.test.ts src/assessment-handoff-id.test.ts

 ✓ src/assessment-failure-handoff.test.ts (4 tests)
 ✓ src/assessment-handoff-id.test.ts (6 tests)
 Test Files  2 passed (2)
      Tests  10 passed (10)
```

```sh
$ pnpm --filter @vaqcrow/api exec vitest run \
    src/application/use-cases/route-assessment-failure-to-manual-review.test.ts \
    src/infrastructure/http/routes/application-assessment.route.test.ts \
    src/infrastructure/http/routes/application-manual-review.route.test.ts \
    src/infrastructure/adapters/supabase-application-review-repository.test.ts

 ✓ supabase-application-review-repository.test.ts (41 tests)
 ✓ route-assessment-failure-to-manual-review.test.ts (28 tests)
 ✓ application-manual-review.route.test.ts (5 tests)
 ✓ application-assessment.route.test.ts (23 tests)
 Test Files  4 passed (4)
      Tests  97 passed (97)
```

> [!note] Sobre el `stderr` de la API
> Las líneas `[SupabaseApplicationReviewRepository] persistence error { code: '23514' … }` que aparecen arriba son fixtures de las pruebas de sanitización (mensajes `simulated message for 42501/23514`). No hay base remota ni dato real; la suite `test:integration` no forma parte de este gate.

```sh
$ pnpm --filter @vaqcrow/web exec vitest run \
    src/state/use-manual-review-context.test.tsx \
    src/presentation/components/human-decision-workspace.test.tsx \
    src/infrastructure/manual-review/http-manual-review-gateway.test.ts \
    src/presentation/components/manual-review-context-panel.test.tsx

 ✓ http-manual-review-gateway.test.ts (7 tests)
 ✓ use-manual-review-context.test.tsx (6 tests)
 ✓ manual-review-context-panel.test.tsx (6 tests)
 ✓ human-decision-workspace.test.tsx (8 tests)
 Test Files  4 passed (4)
      Tests  27 passed (27)
```

**Gate de repositorio, re-ejecutado en este árbol:**

```sh
$ pnpm run verify        # lint · typecheck · lint:tests · typecheck:tests · test · build · boundaries · test:boundaries

lint        Tasks:    5 successful, 5 total
typecheck   Tasks:    8 successful, 8 total
test        Tasks:    8 successful, 8 total
build       Tasks:    5 successful, 5 total
✔ no dependency violations found (468 modules, 1406 dependencies cruised)
test:boundaries  Test Files  9 passed (9) / Tests  93 passed (93)
```

Conteos por workspace en ese mismo gate: `@vaqcrow/contracts` 12 archivos / 344 tests; `@vaqcrow/domain` 1 / 60; `@vaqcrow/ai` 5 / 107; `@vaqcrow/api` 42 / 779; `@vaqcrow/web` 101 / 708. El comando compuesto terminó con **exit 0**. El único warning de lint es preexistente (`apps/web/src/infrastructure/http/fetch-http-client.ts`, `_request` sin usar); 0 errores.

> [!warning] Flake de timeout observado y no ocultado
> Una ejecución forzada del gate (`turbo run lint typecheck test build --force`, que **no** reutiliza caché) **falló con exit 1** por timeouts de 5000 ms —no por aserciones— en archivos **ajenos a la Feature #22**: `campaign.route.test.ts`, `funding-intent.route.test.ts` y el `assessment.route.test.ts` standalone en la API (3 tests), más `sme-request-form.test.tsx` y `transaction-review-modal.test.tsx` en la web (3 tests). Es la misma clase de flake por carga de CPU ya registrada en la bitácora de #71. Re-ejecutados en aislamiento, esos archivos pasan: API 3 archivos / 86 tests y web 2 archivos / 46 tests, ambos exit 0. La ejecución estándar de `pnpm run verify` (ejecutada a las 09:55:13, con las firmas de fuente sin cambios) termina en exit 0; las corridas posteriores se sirven de la caché de Turbo porque los inputs no cambiaron. **No es una regresión de la Feature #22 y no se cambió ninguna configuración para ocultarlo.**

`git diff --check` sobre este árbol: **sin errores**.

## 6. Mapeo de criterios de aceptación

Criterios citados verbatim de cada issue. Feature #22 y las Tasks #71/#72 ya están cerradas y mergeadas; la Task #73 es este documento.

### Feature #22 — `gh issue view 22`

| # | Criterio (verbatim) | Resultado | Evidencia |
|---|---|---|---|
| 1 | "Failure never approves" | Cumplido | La respuesta del camino de fallo es `{ outcome: "manual_review", manualReviewRequired, inputsPreserved, applicationState, failureCode, handoff, correlationId, applied }` y **nunca** incluye evaluación, recomendación ni aprobación (fila de matriz "Failure path never carries assessment / recommendation / approval (exact key set)"). No existe transición a `approved`; `human_review → approved` sigue siendo exclusivamente el flujo de decisión humana. |
| 2 | "backup is labelled" | Cumplido | El fallo se etiqueta con `outcome: "manual_review"`, `manualReviewRequired: true`, el `failureCode` del conjunto cerrado y el discriminador `handoff: "persisted" \| "replayed" \| "absent"`; la procedencia simulada se rotula `SIMULADO` solo cuando su `source` lo declara. |
| 3 | "operator can continue manually." | Cumplido dentro del límite de la demo | La única transición de respaldo es `awaiting_assessment → human_review`; `GET /application-reviews/:applicationId/manual-review` devuelve el contexto persistido y el workspace lo renderiza con aviso de indisponibilidad y sin control de aprobación. La persona continúa por el flujo de decisión humana ya existente. |

### Task #71 — `gh issue view 71`

| # | Criterio (verbatim) | Resultado | Evidencia |
|---|---|---|---|
| 1 | "Feature #22 behavior is implemented within its documented boundary." | Cumplido | §3 vincula cada límite con su ruta versionada; `pnpm run boundaries` sin violaciones (468 módulos, §5); la web nunca importa `packages/domain`. |
| 2 | "Route model timeouts, invalid structured output, nonexistent evidence references, and provider outages to manual review while preserving inputs and never auto-approving the case." | Cumplido | Los cuatro códigos del conjunto cerrado se enrutan a `human_review` (caso de uso, ruta y matriz en §4); `inputsPreserved` es veraz (`true` solo con un handoff durable para el intento; `false` con `handoff: "absent"`, corrección D1 de `9478052`); el fallo nunca aprueba. |
| 3 | "Failure paths remain truthful and do not weaken security or human-control boundaries." | Cumplido | El handoff persiste solo el código saneado y la evidencia validada (rechaza diagnóstico crudo, secretos y PII en el contrato); RLS + grants explícitos y RPC `security invoker` con `search_path = ''`; errores mapeados a `4xx/5xx` saneados; replay/conflicto explícitos; no se agregó ningún camino de aprobación. |

### Task #72 — `gh issue view 72`

| # | Criterio (verbatim) | Resultado | Evidencia |
|---|---|---|---|
| 1 | "Deterministic tests demonstrate the core behavior of Feature #22." | Cumplido | Matriz determinista (§4) más guard de determinismo (mismo input → mismo resultado, reloj inyectado, `fetch` nunca llamado). Suites focalizadas en verde en §5. |
| 2 | "Validation, rejection, and fallback behavior is covered where applicable." | Cumplido | Camino/body/evidence malformados, key set derivado, handoff id inválido, replay/conflicto/not-found/state-conflict, recuperación tras caída y `not_found` veraz de la lectura. |
| 3 | "The focused suite passes without live external services or sensitive data." | Cumplido | Contracts 10/10, API 97/97 y web 27/27 re-ejecutados en este árbol (§5); dobles locales y fixtures sintéticos; sin red, Testnet, Horizon, Supabase remoto, LLM real, credenciales ni PII. |

### Task #73 — `gh issue view 73`

| # | Criterio (verbatim) | Resultado | Evidencia |
|---|---|---|---|
| 1 | "Evidence identifies Feature #22, verification commands, and observed results." | Cumplido | §1 identifica la Feature #22 y sus Tasks #71/#72/#73; §5 contiene los comandos ejecutados y sus resultados observados, incluido `pnpm run verify` con exit 0 y el flake registrado. |
| 2 | "Evidence is traceable to implementation and focused tests." | Cumplido | §3 vincula cada límite con su ruta versionada y sus PRs/commits; §4 y §5 enlazan esas rutas con las suites focalizadas. |
| 3 | "Sensitive data and unsupported production claims are excluded." | Cumplido | El documento no contiene secretos, tokens, semillas, PII ni XDR innecesario; §§1–2 y §7 delimitan la demo como no productiva y la IA como solo asesora. |

## 7. Límites honestos

1. **Asimetría de restricciones migración/adaptador (aviso de #71; documentado, no corregido).** La migración valida el bundle de evidencia solo en el nivel superior, mientras el adaptador de lectura lo revalida con el parser estricto del contrato. Una fila que el CHECK admite puede fallar el parser; la lectura falla cerrada a `unavailable` (`503`), así que no puede producir un registro ensanchado ni fabricado. Está registrado por un test del adaptador; la corrección queda para una task con alcance de migración.
2. **Dos huecos de cobertura señalados en la revisión de #71 (cerrados por #72).** (a) `use-manual-review-context` colapsaba **todo** rechazo en `absent`, el mismo valor que un `404` veraz, de modo que durante una caída del backend la pantalla volvía a mostrar la recomendación simulada; se corrigió con un estado `unavailable` propio (`32ced80`). (b) La matriz determinista estaba incompleta (los cuatro códigos en el borde HTTP, recuperación tras caída, conjunto exacto de claves y guard de determinismo); se completó en `db80aa9`.
3. **Avisos de revisión de #72 (no bloqueantes, declarados).** (a) **R3-1 (WARNING, preexistente):** mientras el contexto está en `loading`, el `else` final del workspace todavía renderiza la recomendación simulada, así que durante una request en vuelo el aviso puede contradecirse un instante. (b) **R3-2 (SUGGESTION, introducido):** el aviso de indisponibilidad dice al usuario que reintente, pero no ofrece control de reintento ni re-fetch, así que una caída transitoria solo se resuelve recargando la página.
4. **Camino de éxito diferido (frontera deliberada).** Una evaluación de asesoramiento válida se devuelve intacta (`{ outcome: "assessment_available", routed: false, … }`) y **no transiciona** la aplicación. El tratamiento completo del éxito —persistirlo, exponer su procedencia y su UI— pertenece a una Feature posterior y no forma parte de #22.
5. **Hueco end-to-end de la demo (fuera de alcance).** El botón de assessment del navegador todavía hace `POST /assessments` standalone, no `POST /application-reviews/:applicationId/assessments`, así que **un fallo disparado desde el navegador aún no crea el handoff que lee la pantalla de aprobación.** El camino está implementado y probado a nivel de API, pero la demo click-through no está cableada end-to-end.
6. **No existe ni se agregó un camino de aprobación.** `human_review → approved` sigue siendo exclusivamente el flujo de decisión humana (`record_human_decision`). El ruteo de fallos solo etiqueta revisión manual.

## 8. Estado de entrega

- Las Tasks [#71](https://github.com/reyduar/Vaqcrow/issues/71) y [#72](https://github.com/reyduar/Vaqcrow/issues/72) están **CLOSED** y **MERGED** en `main` (PRs #335/#338 y #339; merge commits `c1a59ff`, `927e923` y `e185fd6`). La Feature [#22](https://github.com/reyduar/Vaqcrow/issues/22) sigue **abierta** a la espera de esta Task #73.
- La Task #73 **no está mergeada**: este documento viaja en su rama local y no se presenta como entregado. La frontera de rollback de esta unidad es exclusivamente documental: `docs/planning/ai-failure-routing-evidence.md`, el ajuste de estado de #71/#72 en `docs/planning/demo-tasks-list.md` y `odd/tasks/document-evidence-for-ai-failure-routing-to-manual-review.md`. No se modificó ningún módulo de runtime, test, migración ni contrato.

### Próximo paso

Revisar y mergear la unidad documental de #73. Solo después podrá cerrarse la Feature #22 y habilitarse [#29](https://github.com/reyduar/Vaqcrow/issues/29); ese cierre no se afirma aquí como realizado.
