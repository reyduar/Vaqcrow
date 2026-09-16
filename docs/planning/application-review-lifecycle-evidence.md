# Ciclo mínimo de revisión de solicitudes y su contrato compartido — Issue #38

## Contexto y objetivo

Primera unidad ejecutable de la Feature [#12](https://github.com/reyduar/Vaqcrow/issues/12) ("Definir estados de dominio y contratos compartidos"). El objetivo era implementar el ciclo autoritativo mínimo de revisión de solicitudes en `packages/domain` y su representación de protocolo portable y validable en runtime en `packages/contracts`, sin absorber trabajo de IA, persistencia, Stellar o telemetría (eso queda para Features posteriores), y sin duplicar la base de `CorrelationId` que ya había introducido el issue [#116](https://github.com/reyduar/Vaqcrow/issues/116).

El ciclo se ejecutó completo vía SDD (explore → proposal → spec → design → tasks → apply → verify → archive), con persistencia en Engram; cada fase fue validada contra el estado real del repositorio antes de avanzar a la siguiente, no solo contra el autoreporte del agente anterior.

## Decisiones clave

### D1 — El resultado de una transición es un `Result` discriminado, nunca una excepción

`transitionApplicationReview(from, to)` devuelve `{ ok: true, state } | { ok: false, error }`, con el discriminante `ok` (no `success`, deliberadamente, para que nunca se confunda estructuralmente con el resultado de un `safeParse` de Zod en el límite de `packages/contracts`). El error es un objeto de datos plano, sin clase ni `instanceof`, con un `code` de tipo `"invalid_transition" | "terminal_state"` más `from`/`to`. Se descartó lanzar una excepción tipada porque introduce una dependencia frágil de `instanceof` entre paquetes y obliga a todo caller a envolver en `try/catch`.

### D2 — El snapshot usa `z.strictObject`, no `z.object`

Se verificó directamente contra el `zod@4.6.5` instalado (no de memoria): `z.object()` por defecto usa el modo `$strip`, que **descarta silenciosamente** las claves desconocidas en vez de rechazarlas. `z.strictObject({...})` es la forma recomendada por el propio `.d.cts` de Zod 4 para rechazar campos desconocidos (el método `.strict()` heredado de Zod 3 sigue existiendo y no está `@deprecated`, pero su propio comentario JSDoc sugiere preferir `z.strictObject`). Por eso `applicationReviewSnapshotSchema` usa `z.strictObject({ applicationId, state })`.

### D3 — El vocabulario de estados se duplica por valor entre `domain` y `contracts`, incluso a nivel de tipos

La regla `domain-stays-framework-free` de `.dependency-cruiser.cjs` prohíbe que `packages/domain/src` dependa de cualquier paquete `npm` — y, a diferencia de otras reglas del mismo archivo, **no tiene excepción `dependencyTypesNot: ["type-only"]`**. Eso significa que incluso un `import type` de `@vaqcrow/contracts` en `packages/domain` sería una violación. Por eso ambos paquetes declaran su propia tupla `as const` de los 6 estados (`draft`, `awaiting_assessment`, `human_review`, `approved`, `changes_requested`, `rejected`) en vez de compartir una única declaración.

### D4 — Retiro atómico de los cuatro probes de bootstrap

`WorkspaceProbe`, `describeWorkspace`, `isWorkspaceBootstrapped` y `apiBootstrapProbe` se retiraron por completo en el mismo cambio, junto con `apps/api/src/application/bootstrap-probe.ts` y su test. Los 4 fixtures de límites arquitectónicos (`imports-domain.fixture.ts` ×2, `imports-contracts.fixture.ts`, `imports-contracts-type-only.fixture.ts`) se rewirearon a los nuevos exports reales, porque `tests/boundaries.test.ts` solo verifica *cantidad de violaciones por regla*, nunca *qué símbolo* se importa — cualquier export real con la misma forma de dependencia (runtime vs. solo-tipo) preserva las mismas reglas. Se optó por el retiro completo en vez de mantener los probes como re-exports deprecados, porque el propio issue #38 encuadra el cambio como "reemplazar los probes de bootstrap... cuando ningún consumidor verificado los siga necesitando", y mantenerlos habría sido código muerto con riesgo de rechazo en revisión.

## Qué se implementó

**`packages/domain/src/application-review.ts`** (sin dependencias en runtime):

```ts
export const applicationReviewStates = [
  "draft", "awaiting_assessment", "human_review",
  "approved", "changes_requested", "rejected"
] as const;

export function transitionApplicationReview(from, to): ApplicationReviewTransitionResult
```

**`packages/contracts/src/application-id.ts`**:

```ts
export const applicationIdSchema = z.uuidv4().brand<"ApplicationId">();
export function parseApplicationId(input: unknown): ApplicationId
```

**`packages/contracts/src/application-review.ts`**:

```ts
export const applicationReviewStateSchema = z.enum([...]);
export const applicationReviewSnapshotSchema = z.strictObject({
  applicationId: applicationIdSchema,
  state: applicationReviewStateSchema
});
```

`packages/contracts/src/correlation-id.ts` y su test **no se tocaron** — diff verificado como idéntico byte a byte.

## Evidencia de verificación

Reproducida de forma independiente por el orquestador (no solo por el agente que implementó), bajo Node 24 (el `.nvmrc` del repo pide `>=24 <25`; el Node por defecto de esta máquina es 26.8.1 y `pnpm` lo rechaza si no se cambia antes con `nvm use 24`):

```
$ pnpm run verify
✔ no dependency violations found (45 modules, 58 dependencies cruised)
Test Files  1 passed (1)
     Tests  19 passed (19)   # tests/boundaries.test.ts

$ pnpm turbo run test --force   # bypass de cache de Turbo, ejecución real
@vaqcrow/domain:test:    ✓ src/application-review.test.ts (13 tests)
@vaqcrow/contracts:test: ✓ src/application-id.test.ts (5 tests)
@vaqcrow/contracts:test: ✓ src/application-review.test.ts (6 tests)
@vaqcrow/contracts:test: ✓ src/correlation-id.test.ts (6 tests)   # sin cambios
@vaqcrow/api:test:       ✓ src/infrastructure/http/build-app.test.ts (8 tests)
@vaqcrow/web:test:       ✓ 5 test files (12 tests)

 Tasks:    6 successful, 6 total
Cached:    0 cached, 6 total
```

Grep de todo el repositorio confirmando cero referencias restantes a los símbolos retirados fuera de `docs/planning/**` (documentación cuya actualización queda explícitamente para el issue [#40](https://github.com/reyduar/Vaqcrow/issues/40)):

```
$ rg "WorkspaceProbe|describeWorkspace|isWorkspaceBootstrapped|apiBootstrapProbe" --type ts
# 0 coincidencias fuera de docs/planning
```

## Verificación de los criterios de aceptación del issue #38

| Criterio | Estado |
|---|---|
| `packages/domain` exporta estados, transiciones e invariantes | ✅ |
| Las 4 transiciones permitidas (+ 3 desenlaces de `human_review`) tienen éxito | ✅ 13 tests en `application-review.test.ts` |
| Una transición inválida devuelve error explícito sin mutación parcial | ✅ (función pura, `{ ok: false, error }`) |
| `approved` y `rejected` rechazan toda transición saliente | ✅ |
| `packages/contracts` exporta `ApplicationId`, su parser, el schema de estado y el schema estricto de snapshot | ✅ |
| Un snapshot válido con UUID v4 parsea correctamente | ✅ |
| Se rechazan UUIDs malformados, estados desconocidos, campos faltantes y campos desconocidos | ✅ |
| Vocabulario compatible sin dependencia runtime `domain -> contracts` | ✅ (duplicación por valor, ver D3) |
| `CorrelationId` y su propagación en Fastify quedan sin cambios | ✅ diff vacío en `correlation-id.ts`/`.test.ts` |
| Los 4 probes se retiran cuando no tienen consumidores verificados | ✅ retiro completo (ver D4) |
| El fixture DOM-only de `packages/contracts` compila | ✅ extendido para ejercitar también `ApplicationId` y el snapshot |
| Los chequeos de límites arquitectónicos (`dependency-cruiser`) pasan sin violaciones | ✅ 0 violaciones / 45 módulos / 58 dependencias |

## Estado del ledger nativo (`gentle-ai sdd-attempt`)

El orquestador fijó inicialmente un presupuesto de `max-changed-lines: 350` al pedir el token de la unidad de trabajo de `sdd-apply`; el diff real terminó en 354 líneas — 4 por encima, aunque muy por debajo del presupuesto humano de revisión de 400 líneas de este repo. Eso bloqueó el `settle` pidiendo una decisión explícita de mantenedor. Con autorización explícita del usuario se ejecutó `gentle-ai sdd-attempt reset` y se volvió a adquirir/asentar el intento con un presupuesto de 400 líneas. El reset no tocó código ni evidencia de pruebas — fue exclusivamente una corrección de contabilidad del ledger. Ambas unidades de trabajo (`application-review-lifecycle-full-slice` para `apply`, `application-review-lifecycle-verify` para `verify`) terminaron en `state: complete` con `outcome: passed`.

## Estado de entrega

Ciclo SDD completo y archivado en Engram (`sdd/application-review-lifecycle/*`, observaciones #318 a #326). `sdd-verify` re-ejecutó todo de forma independiente y dictaminó **PASS** con 0 hallazgos críticos y 0 advertencias (3 sugerencias no bloqueantes, entre ellas una corrección de conteo de escenarios de spec: son 23, no 21 como se citó en un artefacto intermedio). Implementación, tests y esta documentación viajan en un único commit/PR de esta unidad de trabajo, siguiendo la restricción de atomicidad del design (retiro de probes + rewire de fixtures + nuevos exports no pueden separarse sin dejar `pnpm run verify` en rojo).

## Qué queda desbloqueado

- Issue [#39](https://github.com/reyduar/Vaqcrow/issues/39) — matriz exhaustiva de transiciones (6×6) y verificación cruzada entre consumidores, deliberadamente fuera de alcance de #38.
- Issue [#40](https://github.com/reyduar/Vaqcrow/issues/40) — documentación de evidencia formal de la Feature #12, incluyendo actualizar `docs/planning/scaffold-fastify-api.md` y `docs/planning/document-workspace-evidence.md`, que hoy todavía mencionan los probes retirados.

## Próximos pasos sugeridos

1. Mergear este PR y marcar #38 como `Done` en el Project #4, sincronizando `docs/planning/demo-tasks-list.md`.
2. Mover #39 a `Ready` (su único bloqueo nativo era #38).
3. Al abordar #40, actualizar las dos referencias de documentación identificadas arriba.
