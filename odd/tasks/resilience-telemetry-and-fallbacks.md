# Bitácora — Feature #31: telemetría de resiliencia y fallbacks veraces

Rama: `Vaqcrow#31_Feat_Add_resilience_telemetry_and_truthful_fallbacks` (creada desde `main` `48e7b34`). Sub-issues: #98 (implementar) · #99 (probar) · #100 (evidencia). Feature bajo la Epic #9 (integración, resiliencia y evidencia). Depende de #30 (cerrada).

## Objetivo

Tratar fallos de LLM, Horizon, Freighter y aplicación con reintentos acotados, observabilidad y estados de respaldo honestos. Comportamiento explícito, idempotente donde aplique y recuperable; los límites sintético/Testnet/humano siguen visibles.

## Hallazgo del mapeo (2026-10-11): buena parte YA existe

El issue es del 2026-09-12 y la base evolucionó. **En su lugar y probado:**

- **Horizon/Stellar** — clasificación de estados transitorios/terminales y **backoff acotado** ya implementados (`apps/api/src/infrastructure/adapters/stellar-transaction.ts`, `infrastructure/scheduling/confirmation-policy.ts` 5s→60s). No hace falta agregar retry de Horizon.
- **Freighter** — clasificación `rejected/unavailable/unknown`, `isAvailable` que nunca lanza, chequeo de red antes de firmar, copy honesto (`apps/web/src/infrastructure/wallet/freighter-wallet.ts`).
- **Persistencia** — errores mapeados a `unavailable` + updates condicionales idempotentes (`applied/replayed`).
- **Estados honestos** — `TransactionStatusList` («Enviada · pendiente de confirmación»), la familia «Sin dato, nunca cero».
- **Tests de fallo** — amplios (LLM timeout/sanitizado, Horizon, scheduler, persistencia, wallet).

## Gaps concretos (base de los WUs)

1. **Retry/backoff del LLM** — no existe ninguno bajo `packages/ai` (solo timeout + códigos `timeout|provider_unavailable`). → `packages/ai/src/run-assessment.ts` + knobs en `apps/api/src/application/config/llm-config.ts`.
2. **Cablear logger + redaction** — la **redaction está implementada y testeada pero desconectada**; su propio doc (`redaction.ts:18-22`) nombra a #31 como el consumidor. Alimentar un logger Fastify real y pasar cada `console.error` por `redactForLog`. Mayor valor.
3. **Métricas/telemetría + health con dependencias** — hoy `health.route.ts` es estático; no hay métricas/OTel.
4. **Dejar de loguear `message/details/hint` crudos de PostgREST** — varios adapters los imprimen (p. ej. `supabase-document-verdict-repository.ts:142-147`), saltando la redaction.
5. **Correlation id en logs estructurados** — `submission-assessment.ts:41-43` usa `console.warn` pelado; el scheduler no carrea correlación.
6. **Telemetría del wallet** — el rechazo/ausencia de Freighter produce copy pero ninguna señal observable.

## Defectos vivos (descubiertos en el mapeo)

- **`app.log.error` es no-op.** `build-app.ts:161` construye Fastify con `logger:false`, y `index.ts:447-452` llama `app.log.error(...)` en el `onError` del scheduler → ese diagnóstico no escribe en ningún lado.
- **El loop de confirmación de `funding-intent` no arranca en producción.** `index.ts:428-429`; hoy es sólo de tests, así que un aporte enviado no llega a `confirmed` fuera de test.

## Plan de trabajo (WU checklist)

Ruta por WU: implementación = **delegated direct** (1 writer por WU); verificación = **verifier read-only fresco** (RDD off). Un commit de work-unit por WU sobre la rama.

- [x] **WU1 — Fundación de logging: logger real + redaction cableada + `/health` con dependencias.**
  - Alcance: `buildApp` recibe `logger` opcional (default `false` → los tests quedan idénticos, sin ruido); `index.ts` pasa `createLoggerOptions(config.logLevel)` — activa el `LOG_LEVEL` hoy muerto — y `disableRequestLogging: true`. La redaction se cablea por `hooks.logMethod` de pino mapeando cada argumento por `redactForLog` (red estructural + de contenido: un `Secret` o un JWT en un mensaje quedan enmascarados). `GET /health` suma un reporte **opcional** de dependencias (Supabase) que **siempre responde 200** (decisión D1); sin la dependencia, el body sigue siendo `{ status: "ok" }`. Arregla el defecto vivo (a): el `app.log.error` del scheduler deja de ser no-op.
  - No incluye: migrar los ~40 `console.*` de los adapters (WU3); tocar `OPAQUE_TOKEN_PATTERN`/`redactText` (ver hallazgo abajo).
  - Aceptación: tests focales verdes (redaction del logger; `/health` con y sin dependencia; probe `unavailable` y `throw`); `pnpm --filter @vaqcrow/api test`, `typecheck`, `lint` y `pnpm run boundaries` verdes.
  - Verificación independiente: verifier read-only sobre el diff del WU.
- [x] **WU2 — Retry/backoff acotado del LLM.** Envolver `callProvider` con reintentos acotados; clasificar reintentable vs. terminal. Política como constante de código (no env).
- [x] **WU3 — Sanear logs raw de PostgREST + correlación.** Eliminar los `message/details/hint` crudos de los diagnósticos de los adapters (solo `code`/campos cerrados + correlation id donde ya está en scope) y carrear el correlation id a los logs del scheduler/assessment.
- [x] **WU4a — Beacon de fallos de wallet: contrato + endpoint API.** `WalletFailureEvent` cerrado (operation × outcome, sin PII) + `POST /telemetry/wallet-failures` (AUTHENTICATED) que valida el body exacto y loguea `{ operation, outcome }` por el logger de WU1; nada persistido.
- [x] **WU4b — Reporter web en `FreighterWallet`.** Port + adapter HTTP fire-and-forget (nunca tira, nunca bloquea) + reporter default lazy; emitir en `connect`/`signTransaction`/`signMessage`.
- **WU4 (parte A original — «arrancar el loop de `funding-intent` en prod») — DESCARTADA por evidencia (2026-10-11):** ese camino fue **retirado** por #239 (la migración `20260923183356_create_campaign_persistence.sql` renombró `funding_intent` → `funding_intent_legacy`; evidencia `docs/planning/campaign-persistence-and-reconciliation-evidence.md:7,147`). `supabase-funding-intent-repository.ts:16` todavía apunta a la tabla vieja, la web no lo usa, y el aporte real va por la bóveda + `campaign_contribution` (ya cableado). Arrancar ese loop pollearía una tabla inexistente.
- [ ] **WU5 — Evidencia + cierre.**

## Decisiones y hallazgos

- **D1 (owner, 2026-10-11) — `/health` siempre 200.** El body reporta el estado por dependencia, pero el HTTP status no cambia ante un fallo de Supabase: `railway.json` usa `/health` como healthcheck con `restartPolicyType: ON_FAILURE` (máx 3), y un blip de Supabase no debe reiniciar el contenedor. Se descartaron «503 si una dependencia crítica falla» y «separar liveness/readiness».
- **Hallazgo (2026-10-11) — discrepancia comentario/regex en `redaction.ts`.** El comentario (líneas 13-16) afirma que los hashes de transacción quedan intactos, pero `OPAQUE_TOKEN_PATTERN` (`[A-Za-z0-9+/]{40,}`) enmascara un hash de 64 hex. No se toca en WU1: la decisión vigente de #14 es *sobre-redactar antes que debilitar* la heurística (`docs/planning/typed-configuration-and-secret-boundaries-evidence.md` §5). Ítem abierto para WU3/WU4 si la telemetría llega a loguear un hash.

## Entrega

- Pronóstico: ~300–400 líneas authored por WU1..WU5; el feature completo probablemente cruce las ~400 → estrategia `ask-on-risk` (default). El corte de PR se decide al cerrar WU2/WU3.
- Commits de work-unit por WU sobre la rama; push/PR sólo cuando el owner lo pida.

## Restricciones

- Backend; seguir `docs/planning/DEMO.md` y los límites del monorepo (`pnpm run boundaries`); providers replaceables detrás de ports; fallos sanitizados. Sin secretos ni claims de producción.
- test-first (ODD; Strict TDD no activo). Un writer por WU; verificación independiente; RDD off. Sin migraciones salvo que un WU lo justifique (autorización del owner).

## Verificación

Por WU: runner del workspace afectado (`pnpm --filter @vaqcrow/api test` / `packages/ai test`). Al cierre: `pnpm run verify`. Nota: la suite `@vaqcrow/web` es flaky bajo carga (timeout de 5s/test).

## Iteración

### WU1 — Fundación de logging (2026-10-11)

Implementación delegada a 1 writer; verificación independiente por un verifier read-only fresco → **pass-with-notes**. Commit de work-unit: `35718fc` (`feat(api): add a redacted structured logger and a dependency-aware /health (#31)`).

- **Qué cambió**:
  - `apps/api/src/infrastructure/logging/logger-options.ts` (nuevo): `createLoggerOptions(level)` — `hooks.logMethod` mapea **cada** argumento por `redactForLog` (objeto y mensaje). Sin dependencia `pino` nueva (Fastify la reenvía a su pino bundleado).
  - `build-app.ts`: dependencia `logger` opcional (default `false` → tests idénticos y silenciosos) + `logController: new LogController({ disableRequestLogging: true })`; reenvía `health`.
  - `health.route.ts`: reporte de dependencias opcional, **siempre HTTP 200**; un probe que tira se pliega a `unavailable`; sin dependencia el body sigue siendo `{ status: "ok" }` exacto.
  - `supabase-health-probe.ts` (nuevo): HEAD sobre `audit_log`; nunca tira ni filtra `message/details/hint`.
  - `index.ts`: `createLoggerOptions(config.logLevel)` (activa el `LOG_LEVEL` que estaba muerto) + `health: { probes: { supabase } }`.
  - `deploy-planning.md`: fila `LOG_LEVEL` alineada.
- **Defecto vivo (a) resuelto**: el `app.log.error` del scheduler de distribución ahora emite por el logger real. El loop de confirmación de `funding-intent` **sigue sin arrancar** (eso es WU4).
- **RED→GREEN**: 4 tests focales nuevos fallaban antes de implementar (módulos ausentes + `/health` todavía no leía probes), verdes después. `pnpm --filter @vaqcrow/api test` → 2628/2628; `typecheck`, `lint` y `pnpm run boundaries` verdes.
- **Corrección en curso**: el `disableRequestLogging` top-level está deprecado en Fastify 5.12.4 (emite `FSTDEP023` en cada construcción); se reemplazó por `logController: new LogController({ disableRequestLogging: true })` (forma documentada). Warnings 23 → 0.
- **Notas de verificación (nits, no bloqueantes)**: (1) `redaction.ts` colapsa un `Error` a `{ name, message }`, así que los logs de producción no llevarán stack — mejora estricta frente al no-op previo, pero es insumo para WU3; (2) el probe real contra Supabase no se ejerció (requiere credenciales; verificado estructuralmente: el grant `select` de `service_role` sobre `audit_log` existe); (3) `HealthReport` quedó documentado y referenciado por el handler.
- **Decisión D1** aplicada (owner, 2026-10-11): `/health` siempre 200.
- **Ruta**: delegated direct — writer `gentle-ai-worker`; verifier `gentle-ai-verify` (RDD off, sin ceremonia nativa).

### WU2 — Retry/backoff acotado del LLM (2026-10-11)

Implementación delegada a 1 writer; verificación independiente read-only → **pass**. Commit de work-unit: `6a2c1b3` (`feat(ai): add a bounded retry to the LLM assessment boundary (#31)`).

- **Decisión (owner, 2026-10-11)**: **1 reintento, solo fallos rápidos**. Se reintenta `provider_unavailable` una vez (`maxAttempts: 2`, backoff 500ms); `timeout` es **terminal** (un modelo lento no se arregla esperando de nuevo) y ningún fallo de validación se reintenta.
- **Qué cambió**: `packages/ai/src/retry-policy.ts` (nuevo, sin imports) — `AssessmentRetryPolicy`, `DEFAULT_ASSESSMENT_RETRY_POLICY`, `backoffMs` (exponente clampeado antes de `2 **`, cap a `maxBackoffMs`) e `isRetryableAssessmentFailure` (true solo `provider_unavailable`). `run-assessment.ts` — `runAssessment` gana `retry?` y envuelve la llamada al provider en un loop acotado; `timeout` y validación no se reintentan; los fallos siguen sanitizados y sin éxito fabricado. `index.ts` re-exporta lo nuevo. Sin dependencias nuevas; `packages/ai` sigue framework-free.
- **Política como constante de código, no env**: evita tocar `scripts/demo/preflight`, los `.env.*.example` y docs por tres variables; sigue el precedente de `confirmation-policy.ts`. Knobs por env quedan como follow-up opcional.
- **RED→GREEN**: 10 tests de política rojos (módulo ausente) → verdes; luego 3 casos de retry rojos (llamadas 1≠2) → verdes. `pnpm --filter @vaqcrow/ai test` → 160/160; `pnpm --filter @vaqcrow/api test` → 2628/2628; `typecheck`/`lint`/`pnpm run boundaries` verdes.
- **Notas de verificación (nits, no defectos)**: (1) el no-retry de `unknown_evidence_reference` está probado por inspección (misma rama de retorno que `invalid_output`), sin assert de conteo propio; (2) un `code` fuera de la unión TS cae a `provider_unavailable` (fail-closed documentado) y por tanto se reintentaría una vez.
- **Cambio observable reportado**: los casos existentes de `provider_unavailable` en la suite de `packages/ai` ahora hacen 2 llamadas y tardan ~500ms (backoff default); las aserciones **no** se debilitaron.
- **Ruta**: delegated direct — writer `gentle-ai-worker`; verifier `gentle-ai-verify` (RDD off).

### WU3 — Sanear logs raw de PostgREST + correlación (2026-10-11)

Implementación delegada a 1 writer; verificación independiente read-only → **pass-with-notes**. Commit de work-unit: `43c099c` (`fix(api): stop logging raw provider text and carry the scheduler correlation id (#31)`).

- **Decisión (owner, 2026-10-11): eliminar los campos crudos.** Hallazgo que la motivó: `redactForLog` enmascara por **nombre de clave** y por **forma de token** (JWT/seed/opaco), **no** por texto libre — envolver `message/details/hint` en él NO los desinfecta. Se loguea solo el `code` cerrado (y `status`/`statusCode`/nombre de error) + `correlationId` donde ya estaba en scope.
- **Qué cambió**: 15 adapters (14 sitios `console.*` + `supabase-auth.ts` vía `this.log`) dejaron de loguear texto de proveedor; `confirmation-scheduler.ts` ahora acuña un `correlationId` por tick en `run()` y lo pasa a `onError(error, correlationId)` (con `runOnce()` intacto, mintiendo su propio id y delegando en un `execute(id)` privado); `index.ts` loguea `{ cause: <nombre cerrado>, correlationId }` — nunca el objeto `Error` (su `message` es la misma clase de leak). Se agregó un guard de fuente `no-raw-provider-fields.test.ts` que falla si un diagnóstico reintroduce `message:/details:/hint:` (cubre `console.*` y callees con prefijo `log`, con lexer que blanquea comentarios/literales).
- **Hallazgo durante el WU (fuera de superficies)**: el mismo leak en `supabase-auth.ts:89-94`; se aprobó ampliar la superficie (decisión del owner aplicada consistente) y el guard ampliado lo habría atrapado (RED→GREEN).
- **RED→GREEN**: guard rojo con 14 sitios y luego rojo con `supabase-auth` (1) → verde (87 tests). Scheduler: 14 tests (12 previos + 2 nuevos). `pnpm --filter @vaqcrow/api test` → 2717/2717; `typecheck`/`lint`/`pnpm run boundaries` verdes.
- **Notas de verificación (nits del guard, no defectos)**: (1) una *declaración* con prefijo `log` y un parámetro llamado `message` daría falso positivo (hoy no ocurre); (2) el guard es de forma de clave (no ve un leak bajo otra clave o por interpolación). Ambos documentados.
- **Ruta**: delegated direct — writer `gentle-ai-worker`; verifier `gentle-ai-verify` (RDD off).

### WU4a — Beacon de fallos de wallet: contrato + endpoint (2026-10-11)

Implementación delegada a 1 writer; verificación independiente read-only → **pass-with-notes**. Commit de work-unit: `04bb3f1` (`feat(api): add a wallet-failure telemetry beacon (#31)`).

- **Decisión (owner, 2026-10-11)**: beacon **cliente→API** (completo). Freighter vive en el navegador; la API no ve el rechazo al firmar, así que la web reporta eventos explícitos.
- **Qué cambió**: `packages/contracts/src/wallet-failure-event.ts` (nuevo) — `WalletFailureEvent` con `operation ∈ {connect, sign_transaction, sign_message}` × `outcome ∈ {rejected, unavailable, network_mismatch, unknown}`, `strictObject` + `parseWalletFailureEvent`, exportado desde `index.ts`. `apps/api/src/infrastructure/http/routes/telemetry.route.ts` (nuevo) — `POST /telemetry/wallet-failures` (AUTHENTICATED): body de claves exactas, parse, `request.log.warn({ operation, outcome }, …)`, `202 { accepted: true }`; nada persistido. Registrado incondicionalmente en `build-app.ts`; policy en `route-policy.ts` + `MATRIX` en lockstep.
- **RED→GREEN**: contrato rojo (33, módulo ausente) → verde; ruta roja (8, 404) → verde. `packages/contracts` 694/694; `apps/api` 2733/2733; typecheck/lint/boundaries verdes.
- **Notas de verificación (nits)**: (1) la puerta de claves exactas y el `strictObject` son indistinguibles black-box (ambos → 400 sin log); el orden se probó por lectura de fuente; (2) los nombres de operación del wire son snake_case, así que **WU4b debe mapear** los métodos (`signTransaction`→`sign_transaction`), no pasarlos crudos.
- **Gotcha operativa**: `apps/api` resuelve `@vaqcrow/contracts` desde su `dist`; tras tocar contratos hay que buildear contracts antes de testear la API (Turbo lo hace vía `dependsOn: ["^build"]`).
- **Ruta**: delegated direct — writer `gentle-ai-worker`; verifier `gentle-ai-verify` (RDD off).

### WU4b — Reporter web de fallos de wallet (2026-10-11)

Implementación delegada a 1 writer; verificación independiente read-only → **pass-with-notes**. Commit de work-unit: `076d68a` (`feat(web): report Freighter failures to the wallet-failure beacon (#31)`).

- **Qué cambió**: `apps/web/src/application/ports/wallet-failure-reporter-port.ts` (nuevo, React-free) — `report(event): void` best-effort; `apps/web/src/infrastructure/telemetry/http-wallet-failure-reporter.ts` (nuevo) — POST fire-and-forget con `void` + try/catch interno; `default-wallet-failure-reporter.ts` (nuevo) — factory + default lazy (resuelve env/token en el primer report, no al importar; sin base URL es no-op estricto); `freighter-wallet.ts` — segundo parámetro opcional `reporter` (default = reporter real) para que los **6 sitios** `new FreighterWallet()` no cambien; emite en cada fallo genuino de `connect`/`signTransaction`/`signMessage` con el operation snake_case del wire (`sign_transaction`/`sign_message`); los guards de config del cliente (passphrase/mensaje vacíos) NO se reportan y un éxito no reporta nada.
- **RED→GREEN**: 5 tests rojos (spy no llamado) + módulo ausente → 34 verdes. Focales web 34/34; `pnpm --filter @vaqcrow/web typecheck`/`lint` y `pnpm run boundaries` verdes. El suite web completo no se corrió (flaky bajo carga).
- **Notas de verificación (nits)**: (1) [LOW] el reporter default no envolvía `resolveDefault()` en try/catch (podía enmascarar el `WalletError`); **se endureció inline** (try/catch alrededor de la resolución). (2) [LOW] no hay test dedicado del default reporter (cobertura indirecta); (3) [INFO] re-resuelve el cliente por report (correcto para best-effort). No hay leak de PII (el body se reconstruye de `operation`+`outcome`).
- **Ruta**: delegated direct — writer `gentle-ai-worker`; verifier `gentle-ai-verify` (RDD off).
