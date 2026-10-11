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
- [ ] **WU2 — Retry/backoff acotado del LLM.** Envolver `callProvider` con reintentos acotados + knobs de config; clasificar reintentable vs. terminal.
- [ ] **WU3 — Sanear logs raw de PostgREST + correlación.** Pasar los `message/details/hint` por redaction (migrar los `console.*` de los adapters) y carrear el correlation id a los logs del scheduler/assessment.
- [ ] **WU4 — Arrancar el loop de confirmación de `funding-intent` en producción + telemetría del wallet.**
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
