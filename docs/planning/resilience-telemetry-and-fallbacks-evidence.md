# Evidencia de cierre de la Feature #31 — Issue #100

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#98](https://github.com/reyduar/Vaqcrow/issues/98) (implementación), [#99](https://github.com/reyduar/Vaqcrow/issues/99) (pruebas) y [#100](https://github.com/reyduar/Vaqcrow/issues/100) (evidencia) de la Feature [#31](https://github.com/reyduar/Vaqcrow/issues/31) ("Feature: Add resilience telemetry and truthful fallbacks", Epic [#9](https://github.com/reyduar/Vaqcrow/issues/9)), re-ejecuta la verificación de cierre en este árbol de trabajo y mapea cada criterio de aceptación, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/resilience-telemetry-and-fallbacks|Bitácora: telemetría de resiliencia y fallbacks veraces]].

> [!warning] Estado de entrega: nada de #31, #98, #99 ni #100 está en `main`
> El trabajo vive en la rama `Vaqcrow#31_Feat_Add_resilience_telemetry_and_truthful_fallbacks`, creada desde `main` `48e7b34`. No hay PR ni merge en esta Feature y este documento no reporta un estado mergeado. La demo desplegada desde `main` todavía no usa el logger estructurado, ni el `/health` con dependencias, ni el beacon de fallos de wallet.

## 1. Contexto y objetivo

La Feature #31 trata los fallos de **LLM, Horizon, Freighter y aplicación** con reintentos acotados, observabilidad y **estados de respaldo honestos**: comportamiento explícito, idempotente donde aplica y recuperable, sin fabricar nunca un éxito. Los límites sintético/Testnet/humano siguen visibles. La Feature depende de #30 (cerrada) y pertenece a la Epic #9 (integración, resiliencia y evidencia).

| Task | Rama | Estado del issue (2026-10-11) |
|---|---|---|
| #98 — implementar | `Vaqcrow#31_Feat_Add_resilience_telemetry_and_truthful_fallbacks` | WU1–WU4b; commits `35718fc` … `076d68a` |
| #99 — probar | (misma rama de la Feature) | cubierto por los tests de cada WU; sin commit de producción propio |
| #100 — documentar | (misma rama de la Feature) | este documento |

La Feature #31 sigue abierta; su cierre lo decide el owner. El issue es del 2026-09-12 y la base evolucionó desde entonces, así que el mapeo separa **lo que ya existía** de **lo que esta Feature agregó** (§3).

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el 2026-10-11 en este árbol de trabajo (rama de #100), con su salida real (§4.1). (b) **Bitácora** — una entrada fechada de [[odd/tasks/resilience-telemetry-and-fallbacks]]; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba de esta Feature habla con el proveedor de LLM vivo, con Supabase remoto, con Testnet ni con Freighter real. Los adaptadores reciben clientes/probes inyectables y las pruebas pasan dobles.
- **Sin secretos.** Ningún email, contraseña, API key, token, clave pública, XDR ni identificador de proyecto aparece aquí; las variables se nombran, nunca sus valores.
- **Sin claims de producción.** La entrega es de demo: Testnet sin valor económico, LLM asesor, conversión ARS↔activo simulada. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado (Tasks #98 y #99)

Fuente: bitácora (WU1–WU4b, 2026-10-11) y lectura del código en esta rama.

### 3.1 Ya existía en la base (no es aporte de #31)

El mapeo de la bitácora comprobó que buena parte del objetivo estaba en su lugar y probado:

- **Horizon/Stellar** — clasificación de estados transitorios/terminales y **backoff acotado** ya implementados (`apps/api/src/infrastructure/adapters/stellar-transaction.ts`, `infrastructure/scheduling/confirmation-policy.ts`, 5 s → 60 s).
- **Freighter** — clasificación `rejected`/`unavailable`/`network_mismatch`/`unknown`, `isAvailable` que nunca lanza, chequeo de red antes de firmar y copy honesto (`apps/web/src/infrastructure/wallet/freighter-wallet.ts`).
- **Persistencia** — errores mapeados a `unavailable` y updates condicionales idempotentes (`applied`/`replayed`).
- **Estados honestos** — `TransactionStatusList` («Enviada · pendiente de confirmación») y la familia «Sin dato, nunca cero».
- **Tests de fallo** — amplios (LLM timeout/sanitizado, Horizon, scheduler, persistencia, wallet).

### 3.2 Lo que #31 agregó (WU1–WU4b)

- **WU1 — logger real + redaction cableada + `/health` con dependencias.** `apps/api/src/infrastructure/logging/logger-options.ts` (nuevo): `createLoggerOptions(level)` devuelve opciones de pino que Fastify reenvía (sin dependencia `pino` nueva); `hooks.logMethod` mapea **cada** argumento — mensaje incluido — por `redactForLog`, activando la redacción que estaba implementada y desconectada (`application/config/redaction.ts:18-22` ya nombraba a #31 como su consumidor). `build-app.ts` recibe `logger` opcional (default `false`, tests idénticos y silenciosos) y usa `logController: new LogController({ disableRequestLogging: true })`. `health.route.ts` suma un reporte **opcional** de dependencias que **siempre responde 200**; un probe que tira se pliega a `unavailable`. `supabase-health-probe.ts` (nuevo): HEAD sobre `audit_log`. `index.ts` pasa `createLoggerOptions(config.logLevel)` — **activa el `LOG_LEVEL` que estaba muerto** — y `health: { probes: { supabase: … } }`. Esto **cierra el defecto vivo `app.log.error` no-op** (el scheduler de distribución ahora emite por el logger real).
- **WU2 — retry/backoff acotado del LLM.** `packages/ai/src/retry-policy.ts` (nuevo, sin imports): `AssessmentRetryPolicy`, `DEFAULT_ASSESSMENT_RETRY_POLICY`, `backoffMs` (exponente clampeado antes de `2 **`, con cap) e `isRetryableAssessmentFailure` (true sólo `provider_unavailable`). `run-assessment.ts` envuelve la llamada al provider en un loop acotado; `timeout` es terminal y ningún fallo de validación se reintenta. Política como **constante de código, no env**, siguiendo el precedente de `confirmation-policy.ts`.
- **WU3 — sanear logs raw de PostgREST + correlación.** 15 adapters (14 sitios `console.*` + `supabase-auth.ts` vía `this.log`) dejaron de loguear `message`/`details`/`hint` de proveedor; ahora emiten sólo el `code` cerrado (y `status`/`statusCode`/nombre de error) + `correlationId` donde está en scope. `confirmation-scheduler.ts` acuña un `correlationId` por tick en `run()` y lo pasa a `onError(error, correlationId)`; `index.ts` loguea `{ cause: <nombre cerrado>, correlationId }`, nunca el objeto `Error`. Se agrega el guard de fuente `no-raw-provider-fields.test.ts`, que falla si un diagnóstico reintroduce `message:`/`details:`/`hint:`.
- **WU4a — beacon de fallos de wallet: contrato + endpoint.** `packages/contracts/src/wallet-failure-event.ts` (nuevo): `WalletFailureEvent` con `operation ∈ {connect, sign_transaction, sign_message}` × `outcome ∈ {rejected, unavailable, network_mismatch, unknown}`, `strictObject` + `parseWalletFailureEvent`. `apps/api/src/infrastructure/http/routes/telemetry.route.ts` (nuevo): `POST /telemetry/wallet-failures` (**AUTHENTICATED**), valida las claves exactas del body antes de parsear, loguea `{ operation, outcome }` por el logger de WU1 y responde `202 { accepted: true }`. **Nada se persiste** (es observabilidad, no estado).
- **WU4b — reporter web en `FreighterWallet`.** `apps/web/src/application/ports/wallet-failure-reporter-port.ts` (nuevo, React-free); `apps/web/src/infrastructure/telemetry/http-wallet-failure-reporter.ts` (nuevo, POST fire-and-forget con `void` + try/catch interno); `default-wallet-failure-reporter.ts` (nuevo, factory + default lazy que resuelve env/token en el primer report, no al importar; sin base URL es no-op estricto). `freighter-wallet.ts` recibe un `reporter` opcional (default = reporter real) y emite en cada fallo genuino de `connect`/`signTransaction`/`signMessage` con el operation snake_case del wire; un éxito no reporta nada.

### 3.3 Commits de la rama

`git log --oneline 48e7b34..HEAD` (2026-10-11):

| Commit | Mensaje |
|---|---|
| `35718fc` | feat(api): add a redacted structured logger and a dependency-aware /health (#31) |
| `c76b348` | docs(odd): record #31 WU1 |
| `6a2c1b3` | feat(ai): add a bounded retry to the LLM assessment boundary (#31) |
| `177bd5b` | docs(odd): record #31 WU2 |
| `43c099c` | fix(api): stop logging raw provider text and carry the scheduler correlation id (#31) |
| `c691761` | docs(odd): record #31 WU3 |
| `04bb3f1` | feat(api): add a wallet-failure telemetry beacon (#31) |
| `f50fc4e` | docs(odd): record #31 WU4a |
| `076d68a` | feat(web): report Freighter failures to the wallet-failure beacon (#31) |
| `184782b` | docs(odd): record #31 WU4b |

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-11)

```sh
$ pnpm run verify
 Tasks:    7 successful, 8 total
Cached:    3 cached, 8 total
  Time:    8m40.291s
Failed:    @vaqcrow/web#test
 ERROR  run failed: command  exited (1)
```

**El único task que falló fue `@vaqcrow/web#test`**, el suite documentado como flaky bajo carga (timeout de 5 s por test). El primer run reportó `Test Files 8 failed | 198 passed (206)` y `Tests 10 failed | 2061 passed (2071)`, todos con `Error: Test timed out in 5000ms.` Los otros 7 task de `verify` (lint, typecheck, lint:tests, typecheck:tests, build, boundaries, test:boundaries y el `test` de los demás workspaces) pasaron.

**Re-ejecución acotada del workspace flaky** — mismo suite con menos contención de CPU:

```sh
$ pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4
 Test Files  2 failed | 204 passed (206)
      Tests  2 failed | 2069 passed (2071)
 FAIL  src/app/admin/admin-review-deployment.test.tsx
 FAIL  src/presentation/components/site-footer.test.tsx
```

**Re-ejecución focal de los 2 archivos fallidos**, sin contención:

```sh
$ pnpm --filter @vaqcrow/web exec vitest run \
    src/app/admin/admin-review-deployment.test.tsx \
    src/presentation/components/site-footer.test.tsx
 Test Files  2 passed (2)
      Tests  21 passed (21)
```

Los dos archivos pasan en aislamiento: la falla es **sensibilidad a la carga** (los 5 s por test se agotan cuando el suite corre en paralelo), no un defecto de código. Ningún archivo tocado por #31 está entre los flaky.

**No re-ejecutado aquí:** el suite de integración de `apps/api` (`test:integration`, credential-gated, nunca parte de `pnpm run test`) y el recorrido Playwright; no los toca esta Feature.

### 4.2 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| El logger cruza cada argumento por `redactForLog`; `LOG_LEVEL` se honra | `apps/api/src/infrastructure/logging/logger-options.test.ts` | Re-ejecutado (suite API dentro de `verify`); RED en bitácora WU1 |
| `GET /health`: sin dependencia → `{ status: "ok" }` exacto; con probe `unavailable` y con probe que tira → **siempre 200** con `degraded` | `apps/api/src/infrastructure/http/routes/health.route.test.ts` | Re-ejecutado (suite API); RED en bitácora WU1 |
| Retry del LLM: `provider_unavailable` reintenta una vez; `timeout` y validación no se reintentan; backoff clampeado | `packages/ai/src/retry-policy.test.ts` + tests de `run-assessment` | Re-ejecutado (suite `@vaqcrow/ai`); RED en bitácora WU2 |
| Ningún diagnóstico reintroduce `message:`/`details:`/`hint:` (guard de fuente con lexer que blanquea comentarios/literales) | `apps/api/src/infrastructure/logging/no-raw-provider-fields.test.ts` | Re-ejecutado (suite API); RED en bitácora WU3 |
| El scheduler acuña un `correlationId` por tick y lo pasa a `onError`; `runOnce()` conserva el suyo | tests de `confirmation-scheduler` | Re-ejecutado (suite API); bitácora WU3 |
| `WalletFailureEvent` acepta sólo los dos enums cerrados; `strictObject` rechaza una clave extra | `packages/contracts/src/wallet-failure-event.test.ts` | Re-ejecutado (suite `@vaqcrow/contracts`); RED en bitácora WU4a |
| `POST /telemetry/wallet-failures`: body de claves exactas, 400 saneado ante drift, 202 y una línea de log | `apps/api/src/infrastructure/http/routes/telemetry.route.test.ts` | Re-ejecutado (suite API); RED en bitácora WU4a |
| Reporter web: POST fire-and-forget, nunca tira ni bloquea; sólo `operation`+`outcome` cruzan el wire | `apps/web/src/infrastructure/telemetry/http-wallet-failure-reporter.test.ts` | Re-ejecutado (suite web focal); RED en bitácora WU4b |
| Freighter emite el beacon en cada fallo genuino de `connect`/`signTransaction`/`signMessage`; un éxito o un guard de config no reportan | tests de `freighter-wallet` | Bitácora WU4b (focal web 34/34) |

### 4.3 Verificaciones fuera del gate de PR (tomadas de la bitácora, no re-ejecutadas)

- **Contadores por WU (bitácora 2026-10-11, no re-ejecutados aquí):** WU1 `apps/api` 2628/2628; WU2 `packages/ai` 160/160 y `apps/api` 2628/2628; WU3 `apps/api` 2717/2717; WU4a `packages/contracts` 694/694 y `apps/api` 2733/2733; WU4b focal web 34/34.
- **Probe real de Supabase:** no se ejercitó (requiere credenciales); verificado **estructuralmente** (el grant `select` de `service_role` sobre `audit_log` existe).

**Nunca ejercitado:** un `/health` con caída real de Supabase; un reintento real de un proveedor de LLM vivo; un fallo real de Freighter en un navegador; el beacon contra la API desplegada.

## 5. Límites y brechas vigentes

1. **Flakiness del suite `@vaqcrow/web`.** Bajo carga, tests que no tienen nada que ver con #31 agotan el timeout de 5 s (§4.1). No es una regresión de código: los dos archivos que fallaron en la re-ejecución acotada pasan en aislamiento. Queda como defecto de configuración de test (timeouts / paralelismo), candidato a unidad aparte.
2. **Paths vivos no ejercitados.** El proveedor de LLM vivo, Supabase remoto, Testnet y Freighter real no se tocan en el gate de PR (§4.3); la verificación es con dobles.
3. **Sin métricas/OTel.** La observabilidad de #31 es **logging estructurado redactado + `/health` con dependencias + el beacon de wallet**. No se agregó un backend de métricas ni trazas distribuidas; la decisión quedó en logging + health.
4. **Discrepancia comentario/regex en `redaction.ts` (hallazgo WU1).** El comentario (líneas 13-16) afirma que los hashes de transacción quedan intactos, pero `OPAQUE_TOKEN_PATTERN` (`[A-Za-z0-9+/]{40,}`) enmascararía un hash de 64 hex. **No se tocó**: la decisión vigente de #14 es *sobre-redactar antes que debilitar* la heurística (`docs/planning/typed-configuration-and-secret-boundaries-evidence.md` §5). Ítem abierto si la telemetría llegara a loguear un hash.
5. **El guard de WU3 es de forma, no de valor.** Detecta una **clave** prohibida en un payload de diagnóstico; no ve un leak bajo otra clave ni por interpolación de string. Documentado como nit.

## 6. Decisiones del owner y correcciones

### 6.1 Decisiones del owner (bitácora, 2026-10-11)

| # | Decisión | Estado |
|---|---|---|
| D1 | **`/health` siempre 200.** El body reporta por dependencia, pero el status HTTP no cambia: `railway.json` usa `/health` como healthcheck con `restartPolicyType: ON_FAILURE`, y un blip de Supabase no debe reiniciar el contenedor. | vigente |
| D2 | **1 reintento del LLM, sólo fallos rápidos.** `provider_unavailable` se reintenta una vez (`maxAttempts: 2`, backoff 500 ms); `timeout` es terminal; la validación no se reintenta. | vigente |
| D3 | **Eliminar los campos crudos de proveedor** en los adapters (loguear sólo el `code` cerrado + `correlationId`). | vigente |
| D4 | **Beacon de fallos de wallet cliente→API.** Freighter vive en el navegador; la API no ve el rechazo, así que la web reporta eventos explícitos. | vigente |

### 6.2 Corrección WU4 — el loop de `funding-intent` fue retirado, no diferido

El borrador original de WU4 proponía «arrancar el loop de confirmación de `funding-intent` en producción». **Se descartó, no se implementó**, al comprobar que ese camino fue **retirado por #239**: la migración `20260923183356_create_campaign_persistence.sql` renombró `funding_intent` → `funding_intent_legacy` (evidencia `docs/planning/campaign-persistence-and-reconciliation-evidence.md`, líneas 7 y 147); `supabase-funding-intent-repository.ts` todavía apunta a la tabla vieja, la web no lo usa, y el aporte real va por la bóveda + `campaign_contribution` (ya cableado). Arrancar ese loop pollearía una tabla inexistente. La corrección deja el comentario de `index.ts` alineado con esa realidad (cambio **sólo de comentario**, sin cambio de comportamiento).

## 7. Correcciones aplicadas durante el ciclo

- **WU1 — `disableRequestLogging` deprecado.** El flag top-level está deprecado en Fastify 5.12.4 (emitía `FSTDEP023` en cada construcción); se reemplazó por `logController: new LogController({ disableRequestLogging: true })`. Warnings 23 → 0.
- **WU3 — superficie ampliada por evidencia.** Durante el WU se halló el mismo leak en `supabase-auth.ts:89-94` (fuera de la superficie original); se aprobó ampliarla y el guard ampliado lo habría atrapado (RED→GREEN).
- **WU4b — endurecimiento inline.** El reporter default no envolvía `resolveDefault()` en try/catch (podía enmascarar el `WalletError`); se endureció en el mismo commit.
- **WU5 — corrección del comentario de `index.ts`** (§6.2).

## 8. Mapeo de criterios de aceptación

Los criterios se citan **textualmente** desde cada issue.

### Feature #31

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Handle LLM, Horizon, Freighter and application failures with bounded retries, observability and honest backup states." | ✅ **CUMPLIDO.** Los cuatro dominios quedan cubiertos: **LLM** con retry acotado nuevo (WU2) y clasificación ya existente; **Horizon** con clasificación y backoff ya existentes; **Freighter** con clasificación ya existente **más** el beacon nuevo (WU4a/WU4b); **aplicación** con persistencia saneada/idempotente ya existente **más** el logger real, `/health` con dependencias y la desinfección de logs (WU1/WU3). Observabilidad: logger estructurado redactado + `/health`. Estados honestos: los de la base («Sin dato, nunca cero», pendiente de confirmación) se preservan; ningún path fabrica éxito. | §3.2, §4.2; bitácora WU1–WU4b |
| 2 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Comportamientos de fallo cubiertos por tests focales: redacción del logger, `/health` con probe `unavailable` y con probe que tira (siempre 200), retry/terminal del LLM, guard de no-leak de campos crudos, correlación del scheduler, validación estricta del beacon y 400 saneado, reporter web que nunca tira. Este documento es la evidencia. | §4.2; suites re-ejecutadas |
| 3 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin valores de variables, keys, claves públicas, XDR ni PII en el repo, la bitácora ni este documento. La entrega es de demo (Testnet, LLM asesor, conversión simulada); nada afirma disponibilidad, SLA ni valor económico. | Revisión de este documento; suites re-ejecutadas |

### Task #98 — implementación

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Feature #31 behavior is implemented within its documented boundary." | ✅ **CUMPLIDO.** Todo lo agregado vive dentro de los límites del monorepo: `packages/ai` sigue framework-free; `apps/api` mantiene el layering `application/` → `infrastructure/`; los providers siguen detrás de ports. `pnpm run boundaries` verde en `verify`. | §3.2; bitácora WU1–WU4b |
| 2 | "Capture sanitized correlation telemetry for LLM validation, human decisions, transaction submission, and confirmation while providing truthful backup and failure paths that never fabricate success." | ✅ **CUMPLIDO.** El `correlationId` se genera por request (`genReqId`) y viaja en `x-correlation-id`; los cuatro dominios lo cargan: **validación LLM** en el `SubmissionAssessmentFailureEvent` (código saneado + correlationId), **decisiones humanas** y **envío de transacción** vía `audit_log.correlation_id`, y **confirmación** vía el `onError(error, correlationId)` del scheduler (WU3). El logger real (WU1) es el consumidor y cruza todo por `redactForLog`. Ningún fallback fabrica éxito. | §3.2; §4.2; grep de `correlationId` en `apps/api/src` |
| 3 | "Failure paths remain truthful and do not weaken security, simulation, or human-control boundaries." | ✅ **CUMPLIDO.** El retry del LLM no reintenta `timeout` ni validación y no inventa una evaluación; el beacon es **AUTHENTICATED**, de vocabulario cerrado y sin PII (nada persiste); el `/health` siempre-200 no oculta un `degraded` en el body; los límites humano (decisión del admin) y simulación (Testnet/ARS) no se tocan. | §3.2, §4.2; bitácora WU2/WU4a |

### Task #99 — pruebas

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Deterministic tests or bounded rehearsal checks demonstrate the core behavior of Feature #31." | ✅ **CUMPLIDO.** Cada WU agregó tests deterministas con dobles (RED→GREEN documentado en la bitácora) y se re-ejecutó `pnpm run verify` (§4.1). | §4.1, §4.2 |
| 2 | "Validation, rejection, and fallback behavior is covered where applicable." | ✅ **CUMPLIDO.** Cubiertos: validación estricta del body del beacon (claves exactas → 400 saneado), rechazo/clasificación de Freighter con emisión del beacon, y los fallbacks honestos (probe caído → `degraded` 200; retry acotado del LLM; reporter que nunca tira). | §4.2 |
| 3 | "The focused verification passes without exposing sensitive data." | ✅ **CUMPLIDO.** Los tests focales no exponen secretos ni PII: la redacción se prueba con valores enmascarados y el beacon sólo lleva `operation`+`outcome`. El suite `@vaqcrow/web` es flaky **por carga** (§4.1); los archivos afectados pasan en aislamiento y ninguno es de #31. | §4.1, §4.2 |

### Task #100 — evidencia

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Evidence identifies Feature #31, verification commands or rehearsal steps, and observed results." | ✅ **CUMPLIDO.** Este documento identifica la Feature y sus sub-issues, cita los comandos exactos y su salida observada (§4.1) y lista los commits (§3.3). | §1, §3.3, §4.1 |
| 2 | "Evidence is traceable to implementation and focused verification." | ✅ **CUMPLIDO.** Cada comportamiento del §4.2 apunta a su archivo de prueba y a la fuente del resultado (re-ejecutado vs bitácora); cada WU apunta a sus archivos de producción (§3.2). | §3, §4 |
| 3 | "Sensitive data and unsupported production claims are excluded." | ✅ **CUMPLIDO.** Sin secretos, PII, claves, direcciones ni XDR; sin claims de producción (§2). | §2, §9 |

## 9. Riesgos, contradicciones y limitaciones aceptadas

- **Cierre manual de las Tasks.** GitHub no cierra un issue al mergear en una rama que no es la principal; el cierre de #98/#99/#100 lo decide el owner. Ninguno está en `main`.
- **La verificación de cierre no es verde por un suite flaky.** `pnpm run verify` falla sólo en `@vaqcrow/web#test` (§4.1); la re-ejecución focal pasa. No se enmascara ni se reporta un check no corrido.
- **Sin métricas/OTel.** La observabilidad es logging + health + beacon; no hay backend de métricas (§5.3). No es un olvido: es el alcance elegido.
- **Paths vivos sin ejercitar.** Proveedor de LLM, Supabase remoto, Testnet y Freighter real (§4.3).

## 10. Estado de entrega y próximos pasos

- Este cambio es: este documento y la corrección del comentario de `apps/api/src/index.ts` (§6.2). Commit en la rama de la Feature #31; no hay PR ni merge (los ejecuta el padre).
- La Feature #31 **no está en `main`** y no se cierra sola.

> [!todo] Condiciones antes de considerar cerrada la Feature #31
> 1. Decidir si el cierre de #98/#99/#100 es manual (owner) y si la Feature se cierra con las Tasks.
> 2. Evaluar el hallazgo de flakiness del suite `@vaqcrow/web` (§5.1) como unidad aparte de configuración de test.
> 3. Resolver o aceptar el hallazgo comentario/regex en `redaction.ts` (§5.4).
> 4. Ejercitar, de forma acotada, un `/health` con Supabase caído y un retry real del proveedor de LLM cuando el entorno lo permita.
