# Prueba exhaustiva del ciclo de revisión de solicitudes y su contrato compartido — Issue #39

## Contexto y objetivo

Segunda unidad ejecutable de la Feature [#12](https://github.com/reyduar/Vaqcrow/issues/12), continuación directa del issue [#38](https://github.com/reyduar/Vaqcrow/issues/38) (completado, PR #125). #38 implementó el ciclo mínimo de revisión de solicitudes y su contrato compartido, pero limitó deliberadamente su propia suite a las 4 aristas de transición permitidas, los 2 estados terminales y una única transición inválida representativa (`draft -> approved`), difiriendo explícitamente a este issue la matriz exhaustiva y la verificación cruzada entre `packages/domain` y `packages/contracts`.

El objetivo de #39 es probar que el ciclo de vida y su contrato compartido son correctos en **todos** los pares de estado posibles y que componen correctamente en el límite `domain`/`contracts`, cerrando la superficie de testing de la Feature #12 antes de la documentación de evidencia (issue [#40](https://github.com/reyduar/Vaqcrow/issues/40)).

Es un cambio **solo de tests**: sin modificaciones a código de producción, salvo que la propia matriz exhaustiva expusiera un defecto real (no fue el caso). El ciclo se ejecutó completo vía SDD (explore → proposal → spec → design → tasks → apply → verify → archive), con persistencia en Engram; cada fase fue validada contra el estado real del repositorio, no solo contra el autoreporte del agente anterior — incluyendo un validador de contrato en contexto fresco para la fase de diseño y una re-ejecución independiente de `pnpm run verify` en apply, en verify y por el propio orquestador.

## Corrección de contexto encontrada durante la exploración

El planteo inicial del issue asumía que `ApplicationId` vivía en `packages/domain`. La exploración confirmó, contra el código real, que `ApplicationId` existe únicamente en `packages/contracts/src/application-id.ts` (mismo patrón que `correlation-id.ts`), y que `transitionApplicationReview` nunca toca `ApplicationId` — solo `ApplicationReviewState`. Esto simplificó el alcance del round-trip: solo necesita transportar `.state`, no el `ApplicationId` completo.

## Decisión clave: dónde vive el test de round-trip

Ni `packages/domain` ni `packages/contracts` dependen hoy uno del otro. Probar un round-trip real (`contracts` parsea → `domain` transiciona → `contracts` re-valida) exige resolver dónde vive ese test, porque cualquier ubicación implica una nueva relación de paquetes:

| Opción | Descripción | Descartada por |
|---|---|---|
| A — Colocar en `packages/contracts` | Agregar `@vaqcrow/domain` como devDependency de `contracts` | Acopla el tooling de `contracts` a `domain`, contradice el espíritu de desacople de #38 |
| B — Archivo nuevo en `tests/` (root) | Ambos paquetes como devDependencies del `package.json` raíz, mismo patrón que el `tests/boundaries.test.ts` ya existente | — (elegida) |

Se consultó explícitamente al usuario antes de avanzar a la propuesta — es una decisión estructural, no un detalle de implementación — y se confirmó la opción B: `tests/application-review-round-trip.test.ts`, con `@vaqcrow/domain` y `@vaqcrow/contracts` agregados como devDependencies del `package.json` raíz.

Esta misma decisión resolvió, aguas abajo, una ambigüedad de redacción entre `tasks` y `design`: la equivalencia de vocabulario (`applicationReviewStateSchema.options` vs. la tupla de estados de `domain`) no podía vivir en `packages/contracts/src/application-review.test.ts` como sugería literalmente el checklist de tareas, porque `applicationReviewStates` solo lo exporta `@vaqcrow/domain` — colocarla ahí habría forzado exactamente la dependencia inter-paquete que la decisión B rechaza. `sdd-apply` la ubicó en el test de round-trip (root), y `sdd-verify` confirmó de forma independiente que ese razonamiento es correcto, no una desviación no autorizada.

## Qué se implementó

Todo el cambio es de tests; los tres archivos de producción (`packages/domain/src/application-review.ts`, `packages/contracts/src/application-review.ts`, `packages/contracts/src/application-id.ts`) quedaron byte a byte idénticos (`git diff` vacío).

**`packages/domain/src/application-review.test.ts`** (13 → 41 tests): se eliminaron los 10 `it` de las dos suites anteriores (6 aristas permitidas + 3 pares inválidos, incluyendo un caso duplicado de recuperación `changes_requested -> draft`) y se reemplazaron por una única suite parametrizada sobre el producto cartesiano completo de 6×6 = 36 pares:

```ts
describe("transitionApplicationReview — exhaustive 36-pair matrix", () => {
  // Oráculo propio, independiente. NO debe llamar a canTransitionApplicationReview
  // ni a isTerminalApplicationReviewState — esas son la implementación bajo prueba.
  const ALLOWED = new Set<string>([
    "draft->awaiting_assessment",
    "awaiting_assessment->human_review",
    "human_review->approved",
    "human_review->changes_requested",
    "human_review->rejected",
    "changes_requested->draft"
  ]);
  const TERMINAL_ORACLE: readonly string[] = ["approved", "rejected"];

  it.each<[ApplicationReviewState, ApplicationReviewState]>(transitionPairs)(
    "%s -> %s",
    (from, to) => {
      expect(transitionApplicationReview(from, to)).toEqual(expected(from, to));
    }
  );
});
```

El oráculo (`ALLOWED`/`TERMINAL_ORACLE`) es un literal escrito a mano dentro del test, deliberadamente independiente de `canTransitionApplicationReview`/`isTerminalApplicationReviewState`: usar los propios predicados de la implementación como oráculo la validaría contra sí misma y no probaría nada. Se agregaron además guardas de longitud/unicidad (36 pares únicos, 6 permitidos) y una comprobación de estabilidad de la tupla de estados exportada tras correr la matriz.

**`packages/contracts/src/application-review.test.ts`** (6 → 21 tests): nueva cobertura probando que `applicationReviewStateSchema` acepta exactamente los 6 estados conocidos (6 filas) y rechaza cualquier otro valor de cadena probado (11 filas).

**`packages/contracts/src/application-id.test.ts`** (5 → 6 tests): un nuevo caso de rechazo de UUID v5, construido invirtiendo únicamente el nibble de versión del fixture v4 ya existente (`...-42d3-...` → `...-52d3-...`), de modo que el rechazo solo pueda atribuirse a la versión. El rechazo de UUID v1 ya estaba cubierto desde #38.

**`tests/application-review-round-trip.test.ts`** (nuevo, 4 tests): parsea un `ApplicationReviewSnapshot` válido con `contracts`, alimenta `.state` a `transitionApplicationReview` de `domain`, recorre el camino válido completo `draft → awaiting_assessment → human_review → approved` y re-valida contra el mismo schema de `contracts` en cada paso, con comprobaciones de identidad (`not.toBe`) donde la ausencia de mutación es observable, más la prueba runtime de equivalencia de vocabulario entre ambos paquetes.

**`package.json` (raíz) y `pnpm-lock.yaml`**: se agregaron `@vaqcrow/domain` y `@vaqcrow/contracts` como devDependencies (`workspace:*`) del root, únicamente para que el test de round-trip pueda resolver ambos paquetes; no se agregó ninguna dependencia de runtime nueva.

## Evidencia de verificación

Reproducida de forma independiente tres veces — por `sdd-apply`, por `sdd-verify` y por el orquestador — bajo Node 24 (el `package.json` raíz exige `>=24.0.0 <25.0.0`; el Node por defecto de esta máquina es 26.8.1 y `pnpm` lo rechaza si no se cambia antes con `nvm use v24.21.0`):

```
$ pnpm run verify
lint:          4/4 tareas, 0 errores (3 warnings preexistentes en apps/web, no relacionados)
typecheck:     6/6 tareas
test:          6/6 tareas — domain 41/41, contracts 33/33 (application-id 6, application-review 21, correlation-id 6, sin cambios), api 8/8, web 12/12
build:         4/4 tareas
boundaries:    0 violaciones (45 módulos, 58 dependencias cruzadas)
test:boundaries: 23/23 — round-trip 4/4, boundaries 19/19

Exit code: 0
```

Confirmación de que no hubo drift en código de producción:

```
$ git diff --stat -- packages/domain/src/application-review.ts \
    packages/contracts/src/application-review.ts \
    packages/contracts/src/application-id.ts
# (vacío)
```

`correlation-id.test.ts` también quedó con diff vacío: el vacío de UUID v5 análogo que tiene `CorrelationId` queda explícitamente fuera de alcance de #39.

## Verificación de los criterios de aceptación del issue #39

| Criterio | Estado |
|---|---|
| Los 36 pares `(from, to)` están cubiertos: 6 aristas permitidas exitosas, 30 pares rechazados con el código correcto | ✅ 36-pair `it.each` en `application-review.test.ts` |
| `applicationReviewStateSchema` acepta exactamente los 6 estados y rechaza cualquier otro valor probado | ✅ 6 filas de aceptación + 11 de rechazo |
| Round-trip realista (`contracts` parsea → `domain` transiciona → `contracts` re-valida) para el camino completo `draft → awaiting_assessment → human_review → approved` | ✅ `tests/application-review-round-trip.test.ts` |
| `ApplicationId` rechaza versiones de UUID distintas de v4 (al menos v1 y v5) | ✅ v1 ya cubierto desde #38, v5 agregado en este issue |
| `pnpm run verify` pasa sin regresiones a las suites existentes de #38/#116 | ✅ exit 0, re-ejecutado 3 veces de forma independiente |

## Estado del ledger nativo (`gentle-ai sdd-attempt`)

Las dos unidades de trabajo de esta iteración (`apply-issue-39` y `verify-issue-39`) adquirieron y asentaron su token sin incidentes, ambas con `state: complete` y `outcome: passed`. El único ajuste operativo fue declarar explícitamente el archivo nuevo `tests/application-review-round-trip.test.ts` como no-rastreado esperado (`--untracked-scope=select`) tanto en `sdd-attempt acquire` como en `gentle-ai review assess`, ya que el ledger nativo exige que todo archivo sin trackear del árbol de trabajo esté declarado antes de admitir el intento.

`gentle-ai review mode status` confirmó que la revisión nativa (RDD) está apagada por defecto en este repo. `gentle-ai review assess` igual se corrió para clasificar el riesgo de la propuesta de cambio: **medio** (por el cambio de configuración en `package.json`), lo que en este repo implica autoverificación del implementador más un spot-check del orquestador — ambos ya cubiertos por las tres re-ejecuciones independientes de `pnpm run verify` mencionadas arriba.

## Estado de entrega

Ciclo SDD completo y archivado en Engram (`sdd/application-review-lifecycle-testing/*`, observaciones #339 a #348). `sdd-verify` re-ejecutó todo de forma independiente y dictaminó **PASS** con 0 hallazgos críticos, 0 advertencias y 0 sugerencias. Implementación, tests y esta documentación viajan en un único commit/PR de esta unidad de trabajo (~200 líneas autoría, muy por debajo del presupuesto de revisión de 400 líneas de este repo — no hizo falta encadenar PRs).

## Qué queda desbloqueado

- Issue [#40](https://github.com/reyduar/Vaqcrow/issues/40) — documentación de evidencia formal de la Feature #12, que ahora puede apoyarse en la cobertura exhaustiva probada aquí.
- Un futuro follow-up sin issue abierto: `CorrelationId` tiene el mismo vacío de rechazo de UUID v5 que tenía `ApplicationId` antes de este issue, explícitamente fuera de alcance de #39.

## Próximos pasos sugeridos

1. Mergear este PR y marcar #39 como `Done` en el Project #4, sincronizando `docs/planning/demo-tasks-list.md`.
2. Abordar #40 con la evidencia exhaustiva de #38 y #39 ya consolidada.
3. Evaluar si abrir un issue nuevo para el rechazo de UUID v5 en `CorrelationId`.
