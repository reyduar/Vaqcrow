# Evidencia de cierre de la Feature #19 — Issue #62

> Documento de cierre de Feature. Mapea cada criterio de aceptación contra archivos, tests y commits, registra las decisiones de diseño, los límites de simulación, los resultados de verificación y los límites honestos. No agrega código de producción. El formato sigue a [`supabase-schema-and-persistence-evidence.md`](./supabase-schema-and-persistence-evidence.md) (#43); la Task de pruebas es [#63](https://github.com/reyduar/Vaqcrow/issues/63) y la de evidencia es [#64](https://github.com/reyduar/Vaqcrow/issues/64) en [`demo-tasks-list.md`](./demo-tasks-list.md).

> **Límite de la demo.** Todo lo de este documento es una **demo simulada y no productiva**. La evaluación es un fixture congelado, el actor es un campo de texto libre (no hay autenticación) y nada de este trabajo es KYC/KYB, una decisión crediticia ni una aprobación de producción. La IA es solo asesora y nunca decide.

## 1. Contexto y objetivo

El issue [#62](https://github.com/reyduar/Vaqcrow/issues/62) pide que un operador revise la evidencia de la IA y registre una aprobación o un rechazo explícitos, con razones, límites, actor y timestamp, manteniendo la decisión como autoridad del backend. Se entregó como una cadena de unidades de trabajo pequeñas sobre la persistencia `application_review` ya existente (Feature #13):

| Unidad | Commit | Contenido |
|---|---|---|
| T1 | `a2ee438` | Contratos e invariantes de dominio para decisiones humanas |
| T2 | `b879602` | Tabla de auditoría `human_decision` y RPC atómica `record_human_decision` |
| T3 | `9b63a8e` | Adaptador de repositorio que llama a la RPC |
| T4 | `0552b2f` | Caso de uso y `POST /application-reviews/:applicationId/decisions` |
| T5 | `d4a8a2b` | Tests de integración con credenciales y migración de cascada de FK |
| T6 | `c2c3d6e`, `268d35a`, `2e57ec1` | Lógica de aplicación y gateway web, pantallas, y corrección para un intento nuevo tras un conflicto de idempotencia |
| T7 | `6880eb9` | Corrección de inmutabilidad de la auditoría a nivel de GRANT (más la aplicación remota de migraciones, sin commit propio) |

Se mergeó mediante los PRs [#166](https://github.com/reyduar/Vaqcrow/pull/166)–[#175](https://github.com/reyduar/Vaqcrow/pull/175), lo que completó la Feature [#19](https://github.com/reyduar/Vaqcrow/issues/19) junto con [#63](https://github.com/reyduar/Vaqcrow/issues/63) y [#64](https://github.com/reyduar/Vaqcrow/issues/64).

## 2. Cómo leer esta evidencia

- Los conteos y resultados de la sección 4 se observaron en un árbol de trabajo o quedaron registrados en la bitácora `odd/tasks/human-assessment-and-approval.md`; nada se infiere.
- **Comandos.** Requieren Node 24: `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- **La suite de integración viva y con credenciales la corrió el operador después del merge y pasó** (sección 4 y sección 7).

## 3. Qué quedó implementado

- **Contrato.** `packages/contracts/src/application-review.ts` define `humanDecisionCommandSchema` (objeto estricto: `decisionId`, `applicationId`, `outcome` en `approved | changes_requested | rejected`, `actor` recortado 1..120, `reason` recortado 1..1000, `approvedLimitArs` entero positivo anulable) y `humanDecisionRecordSchema` (agrega `decidedAt` del servidor y `correlationId`). Tests: `application-review.test.ts`, `human-decision-id.test.ts`.
- **Dominio.** `packages/domain/src/application-review.ts` permite que `human_review` alcance exactamente los tres desenlaces (`decideApplicationReview`). Test: `application-review.test.ts`.
- **Base de datos.** `supabase/migrations/20260919181453_create_human_decision_audit.sql` crea `public.human_decision` y `public.record_human_decision(...)`. Seguimientos: `20260919185430_cascade_human_decision_on_application_delete.sql` y `20260919203900_enforce_human_decision_grant_immutability.sql`.
- **API.** `apps/api/src/application/use-cases/record-human-decision.ts`, el puerto/adaptador de repositorio (`application-review-repository-port.ts`, `supabase-application-review-repository.ts`) y `apps/api/src/infrastructure/http/routes/human-decision.route.ts`. La ruta acepta exactamente cinco claves de body, parsea con el contrato, toma el correlation id de `request.id` y mapea los desenlaces a `201` aplicado, `200` replay, `404 not_found`, `409 state_conflict` (con `actualState`), `409 idempotency_conflict`, `503 unavailable`.
- **Web.** Pantalla de evaluación (`apps/web/src/app/(demo)/ai-assessment/page.tsx`) y pantalla de aprobación (`.../approval/page.tsx`); lógica de decisión en `apps/web/src/application/decision/` (`decision-form.ts`, `decision-attempt.ts`, `record-human-decision.ts`, `human-decision-errors.ts`); puerto `human-decision-gateway.ts` con adaptador HTTP `infrastructure/decision/http-human-decision-gateway.ts`; hook de estado `state/use-human-decision.ts`; componentes `human-decision-form`, `human-decision-workspace`, `human-decision-record`, `ai-assessment-panel`, `evidence-review-panel`.

### Decisiones de diseño

1. **Invariante del límite aprobado.** `approved` exige un `approvedLimitArs` entero positivo y seguro; `changes_requested` y `rejected` exigen exactamente `null`. Se aplica en el contrato (`superRefine`, `z.int().positive()`) y otra vez en SQL con `human_decision_approved_limit_check`, para que un escritor directo no pueda saltarla.
2. **Idempotencia por `decisionId`.** El mismo id con el mismo payload de negocio (`applicationId`, `outcome`, `actor`, `reason`, `approvedLimitArs`) es un **replay**: se devuelve el registro original (`200`, `applied: false`) sin una segunda fila. El mismo id con un payload distinto es un **`idempotency_conflict`** (`409`), sin mutación. Un id nuevo contra una aplicación ya terminal es un `state_conflict`. Un `pg_advisory_xact_lock` sobre el id serializa las peticiones concurrentes, así que ninguna carrera de violación de unicidad se filtra.
3. **Una sola RPC atómica.** `record_human_decision` hace la verificación de idempotencia, la transición condicional de `human_review` al estado de desenlace (`UPDATE ... WHERE state = 'human_review'`) y el insert de auditoría en una transacción. O existen tanto el cambio de estado como la fila de auditoría, o no existe ninguno.
4. **`SECURITY INVOKER`, `search_path = ''`.** La función nunca escala privilegios; el execute está revocado de `public, anon, authenticated` y otorgado solo a `service_role`.
5. **Acceso solo por service role.** RLS está habilitada en `human_decision`, anon/authenticated no tienen grants, y la API es el único escritor.
6. **Corrección de inmutabilidad a nivel de GRANT (`6880eb9`).** Supabase otorga privilegios amplios a `service_role` sobre tablas nuevas por defecto, así que revocar solo de anon/authenticated dejaba la auditoría mutable a través del service role. La migración `20260919203900_...` revoca todo de `service_role` y vuelve a otorgar solo `select, insert`. La limpieza del padre sigue funcionando porque `ON DELETE CASCADE` (migración `20260919185430_...`) corre como dueño de la tabla. El test de integración "keeps the audit immutable even for the service role" lo cubre.
7. **Intento nuevo tras un conflicto de idempotencia (`2e57ec1`).** El cliente web mantiene un `decisionId` por intento para que los reintentos repliquen de forma segura, pero después de un `idempotency_conflict` arranca un intento nuevo en lugar de reusar el id viejo (RED y GREEN observados).

## 4. Qué quedó probado

| Verificación | Resultado observado | Fuente |
|---|---|---|
| `pnpm run verify` | Pasó sobre `268d35a` (lint, typecheck, test, build, boundaries, test:boundaries); boundaries limpio | Bitácora de la Feature, T7 |
| `pnpm --filter @vaqcrow/web test` | 59 archivos, 317 tests (también después de la corrección `2e57ec1`) | Re-ejecutado en árbol de trabajo |
| `pnpm --filter @vaqcrow/api test` | 5 archivos, 61 tests | Re-ejecutado en árbol de trabajo |
| `pnpm --filter @vaqcrow/contracts test` | 5 archivos, 101 tests | Re-ejecutado en árbol de trabajo |
| `pnpm --filter @vaqcrow/domain test` | 1 archivo, 60 tests | Re-ejecutado en árbol de trabajo |
| Revisión nativa (RDD), todo evaluado como riesgo medio | Aprobada y reconocida para `f044f2c..d4a8a2b`, `d4a8a2b..268d35a` y la rama acumulada `f044f2c..HEAD` | Bitácora de la Feature, T5/T6, y reporte del orquestador |
| Commit `2e57ec1` | Medio, 26 líneas, bajo presupuesto, sin revisión debida | Bitácora de la Feature, T6 |
| Commit `6880eb9` | Bajo presupuesto, sin revisión debida | Bitácora de la Feature, T7 |
| Suite de integración viva (`pnpm --filter @vaqcrow/api test:integration`) | 2 archivos, 15 tests contra el proyecto Supabase alojado el 2026-09-19: `human-decision-persistence` 8 tests y `application-review-persistence` 7 tests. La corrió el operador con credenciales reales después del merge de la cadena; la salida se aportó como resultado pegado, no re-ejecutado por el asistente | Reporte del operador |
| Migraciones remotas | Las tres migraciones de decisión humana se aplicaron al proyecto Supabase **alojado** vía MCP (sin Docker local). Una sonda SQL revertida mostró: la RPC aplica, `service_role` tiene denegado update y delete, y borrar un `application_review` cascadea a sus filas de auditoría | Bitácora de la Feature, T7 |

La suite de integración `apps/api/tests/integration/human-decision-persistence.integration.test.ts` contiene 8 bloques `it(...)`: aplicar y registrar exactamente la fila de auditoría, replay, conflicto por payload cambiado, conflicto por estado terminal, no encontrado, denegación con clave publishable y `42501`, inmutabilidad bajo service role, e ids concurrentes.

## 5. Límites operativos vigentes

- **La IA es solo asesora.** La pantalla de evaluación renderiza un fixture congelado (`apps/web/src/application/assessment/simulated-assessment.ts`), rotulado como simulado. Nunca aprueba, calcula una obligación ni mueve fondos. La integración real con LLM es de la Feature [#20](https://github.com/reyduar/Vaqcrow/issues/20).
- **Sin autenticación.** El actor es un campo de texto editable que por defecto trae un actor de demo (`DEMO_ACTOR`). El actor registrado es, por lo tanto, autodeclarado y no una identidad autenticada. La autenticación está registrada en [#134](https://github.com/reyduar/Vaqcrow/issues/134).
- **Id de aplicación de marcador.** El workspace usa `DEMO_APPLICATION_ID` (`apps/web/src/application/fixtures/demo-application.ts`) hasta que la Feature #18 aporte un flujo real de solicitudes.
- **Separación web/dominio.** La web consume solo `packages/contracts`; la decisión la validan y aplican la API y la base de datos.
- **Sin políticas RLS.** El control de acceso se apoya en los grants (ver la evidencia de #43 y [#134](https://github.com/reyduar/Vaqcrow/issues/134)).

## 6. Resultado visible en la demo

El recorrido visible de esta Feature son dos pantallas consecutivas: la de evaluación muestra la recomendación de IA como bloque de solo lectura, rotulado `SIMULADO` y con la aclaración de que solo asesora; la de aprobación contiene el formulario que es la única vía para registrar una decisión, y la vista de éxito aparece **solo después** de que el backend confirma el registro, mostrando el desenlace, el actor, la razón, el límite aprobado (o su ausencia), la fecha del servidor y el id de correlación. Ningún estado de éxito se muestra para un intento fallido o no confirmado.

## 7. Correcciones aplicadas durante el ciclo

1. **Intento nuevo tras un conflicto de idempotencia (`2e57ec1`).** El cliente reusaba el `decisionId` del intento anterior, así que un conflicto de idempotencia se replicaba para siempre. Ahora arranca un intento nuevo; RED y GREEN observados.
2. **Inmutabilidad de la auditoría a nivel de GRANT (`6880eb9`).** Los grants por defecto de Supabase dejaban la tabla mutable a través del service role. Corregido revocando todo de `service_role` y re-otorgando solo `select, insert`, con un test de integración que lo cubre.
3. **Una afirmación de verificación viva que estaba incompleta.** El documento original dejaba la suite de integración como "no ejecutada". El operador la corrió después del merge contra el proyecto alojado y pasó 15 de 15; esta versión registra ese resultado (sección 4) en lugar del límite anterior.
4. **Idioma y estructura de este documento.** La primera versión estaba en inglés y con la estructura §1–§9, que era la excepción del corpus de evidencia y no su convención. Se reescribió en español con la estructura §1–§10 del resto de los documentos, y la convención quedó explícita en `CLAUDE.md`/`AGENTS.md` para que no dependa de muestrear un solo archivo.

## 8. Mapeo de criterios de aceptación

Criterios citados verbatim de `gh issue view 62`.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | "The behavior described by Feature #19 is implemented within its documented boundary." | Cumplido dentro del límite de la demo | Secciones 3 y 5; boundaries limpio en `pnpm run verify` (sección 4); la web nunca importa `packages/domain` |
| 2 | "Allow an operator to review AI evidence and record an explicit approval or rejection with reasons, limits, actor, and timestamp; the AI never makes the final decision." | Cumplido | Paneles de evidencia y evaluación (`evidence-review-panel.tsx`, `ai-assessment-panel.tsx`, con sus tests); el formulario de decisión exige desenlace, actor y razón explícitos y, para aprobar, un límite (`decision-form.ts`); `decided_at` con default del lado del servidor en `human_decision`; el fixture de evaluación es asesor y no tiene ningún camino hacia el comando (`simulated-assessment.ts`); `changes_requested` también está soportado más allá del enunciado de aprobar/rechazar |
| 3 | "Failure paths do not claim success or weaken human-control, simulation, or secret-handling boundaries." | Cumplido | `human-decision-errors.ts` mapea cada fallo de la API a un mensaje explícito de no-éxito (con sus tests); la ruta devuelve 4xx/5xx para casos inválidos, faltantes, en conflicto o no disponibles (`human-decision.route.test.ts`); el adaptador sanea los errores de base de datos; no se agregaron secretos, PII ni seeds |

Commits: `a2ee438`, `b879602`, `9b63a8e`, `0552b2f`, `d4a8a2b`, `c2c3d6e`, `268d35a`, `2e57ec1`, `6880eb9`.

## 9. Riesgos y limitaciones aceptadas

> **Verificación viva.** Después del merge, el operador corrió la suite de integración con credenciales (`pnpm --filter @vaqcrow/api test:integration`) contra el proyecto Supabase alojado: 15 de 15 tests pasaron, incluidos replay, conflicto por payload cambiado, conflicto por estado terminal, `not_found`, denegación con clave publishable y `42501`, inmutabilidad bajo service role e ids concurrentes. Las líneas de `stderr` de esa salida (`23514`, `23505`) vienen de los tests negativos que fuerzan un CHECK y una clave duplicada; el adaptador las registra internamente y no las devuelve a quien llama. Antes de esa corrida, la única evidencia viva era la sonda SQL revertida de la sección 4.

- **El copy de UI está en español**, siguiendo el copy web existente y `docs/design/demo-ui.md`; el código, los tests y los commits van en inglés, y este documento va en español por la convención de evidencia del repositorio.
- **El historial remoto de migraciones lista `create_application_review` dos veces.** Es anterior al #62 y no se alteró acá.
- **Sin políticas RLS.** El control de acceso se apoya en grants (ver la evidencia de #43 y [#134](https://github.com/reyduar/Vaqcrow/issues/134)).
- **Avisos de revisión no bloqueantes**, dejados para trabajo posterior; las notas de los últimos cinco dan solo el id del hallazgo y su ubicación reportada por el revisor (un aviso anterior, R3-idem-conflict-retry, se corrigió en `2e57ec1`):

| Aviso | Nota |
|---|---|
| R3-zod-parse-throw-state-conflict | El parseo del adaptador de una fila `state_conflict` puede lanzar en lugar de mapear a un error saneado |
| R3-route-no-repo-404 | El cableado de la ruta no tiene un 404 explícito cuando no hay repositorio configurado |
| R3-sql-invariant-not-tested | El CHECK de límite aprobado en SQL no tiene un test directo |
| R3-startup-eager-supabase | Advertencia sobre la creación ansiosa del cliente Supabase al arrancar (`apps/api/src/index.ts:5-6`) |
| R3-domain-decide-unused | Sugerencia de que `decideApplicationReview` (`packages/domain/src/application-review.ts:65-70`) no se usa en otro lado |
| R3-mapper-throw-swallowed | Sugerencia sobre un throw de mapper que se traga (`supabase-application-review-repository.ts:134-166`) |
| R3-applicationid-attempt-key | Sugerencia sobre la clave del intento (`apps/web/src/application/decision/decision-attempt.ts:17-21`) |
| R3-attempt-stale-on-conflict | Sugerencia sobre el estado del intento después de conflictos (`apps/web/src/state/use-human-decision.ts:42-52`) |

## 10. Estado de entrega

- La Feature [#19](https://github.com/reyduar/Vaqcrow/issues/19) y sus tres Tasks ([#62](https://github.com/reyduar/Vaqcrow/issues/62), [#63](https://github.com/reyduar/Vaqcrow/issues/63) y [#64](https://github.com/reyduar/Vaqcrow/issues/64)) están **CLOSED**; los PRs [#166](https://github.com/reyduar/Vaqcrow/pull/166)–[#175](https://github.com/reyduar/Vaqcrow/pull/175) están **MERGED** en `main`.
- Esta versión del documento no cambia ningún hecho ya asentado: alinea el idioma y la estructura con el corpus de evidencia y registra el estado mergeado que el documento original dejaba como pendiente de autorización.
