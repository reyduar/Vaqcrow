# Document evidence for monthly sales feed

Registro de iteración para el issue #85 (Task de la Feature #26), rama
`Vaqcrow#85_Task_Document_evidence_for_monthly_sales_feed`, base local `7c7adfa`.

## Objetivo

Crear una evidencia de cierre reproducible y no sensible para el feed mensual de ventas de la Feature
#26, trazable a la implementación mergeada en #83 y a las pruebas mergeadas en #84.

## Problema

La implementación y sus pruebas ya existen en `main`, pero sus resultados están distribuidos entre dos
registros ODD, commits y suites focalizadas. Falta un único documento de evidencia que permita revisar
el comportamiento entregado, sus límites de simulación y la reproducción actual sin inventar una
integración de producción.

## Por qué

- La Feature #26 requiere un feed mensual sintético con procedencia, anomalía conocida, período faltante
  y rótulo visible de simulación.
- `docs/planning/DEMO.md` §§3–5, 11 y 12 establecen que las ventas son simuladas, que cada dato lleva
  procedencia y que las comprobaciones de pull request usan fixtures y dobles determinísticos.
- El issue #85 cierra la trazabilidad documental de #83 y #84 sin modificar su comportamiento de runtime.

## Alcance

Incluye: crear `docs/planning/monthly-sales-feed-evidence.md`; mapear los criterios de #85 hacia rutas,
puerto, adaptador, dataset y pruebas; ejecutar las comprobaciones focalizadas contra la base actual;
registrar los resultados realmente observados; y actualizar solo los estados entregados de #83/#84 en
`docs/planning/demo-tasks-list.md` si la convención existente lo respalda.

Excluye: cambios de runtime, dependencias, Supabase, persistencia durable, fuentes reales de ventas,
PII, KYC/KYB, IA, Stellar Testnet, Horizon, XDR, revisión nativa, operaciones GitHub y marcar #85 como
entregado antes de su merge.

## Restricciones

- La evidencia cita los criterios de aceptación del issue #85 literalmente y distingue hechos verificados,
  datos simulados y trabajo futuro.
- Solo se registran comandos y salidas locales realmente ejecutados sobre esta rama; no se inventan
  conteos ni aprobaciones de revisión.
- No se incorporan secretos, credenciales, semillas, datos personales, XDR innecesario ni claims de
  producción sin respaldo.
- El feed usa datos congelados simulados; su estado de registro es en memoria por proceso y se reinicia.
- Las pruebas focalizadas no deben usar servicios vivos ni datos sensibles.

## Criterios de aceptación (verbatim, issue #85)

- Evidence identifies Feature #26, verification commands, and observed results.
- Evidence is traceable to implementation and focused tests.
- Sensitive data and unsupported production claims are excluded.

## Checklist estable y accionable

- [x] T85-01 — Leer completos los registros ODD de #83 y #84, una evidencia hermana en español y el
      alcance relevante de `DEMO.md`.
- [x] T85-02 — Verificar localmente los commits, merges y archivos atribuidos a #83/#84.
- [x] T85-03 — Ejecutar las suites focalizadas de paridad, adaptador y ruta contra el código actual.
- [x] T85-04 — Ejecutar `pnpm run verify` y registrar el resultado real.
- [x] T85-05 — Redactar la evidencia de cierre en español, con trazabilidad, límites y criterios mapeados.
- [x] T85-06 — Aplicar el cambio mínimo de estado de #83/#84 en el roadmap, sin adelantar #85.
- [x] T85-07 — Hacer lectura estructural, registrar diff, límite de rollback y resultados en este log.
- [x] T85-08 — Reflejar el registro completo final en Engram, verificar la lectura y crear el commit
      convencional local `29488dc` de la unidad de trabajo.

## Comprobaciones aplicables

- `pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts`
- `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/adapters/simulated-sales-data-provider.test.ts src/infrastructure/http/routes/sales-feed.route.test.ts`
- `pnpm run verify` si el entorno local lo permite.

No se ejecutarán `test:integration`, Supabase, Stellar Testnet, Horizon ni proveedor LLM: no son parte de
esta evidencia y requerirían servicios vivos o credenciales fuera de alcance.

## Aplicabilidad de TDD no funcional

TDD estricto no aplica a este cambio de documentación: no se altera comportamiento fuente ni se añade
una especificación ejecutable. La disciplina equivalente es leer primero la evidencia mergeada, reproducir
las suites existentes antes de citarlas y someter el texto resultante a una lectura estructural antes del
commit.

## Estrategia de entrega

Una única unidad de documentación, estimada por debajo de 400 líneas autoradas: evidencia, actualización
mínima de roadmap si corresponde y este registro ODD. El commit incluirá sus comprobaciones y podrá
revertirse eliminando únicamente esos artefactos documentales; no tendrá frontera de runtime.

## Evidencia observada

- `pnpm exec vitest run tests/monthly-sales-feed-parity.test.ts` — exit 0; 1 archivo y 1 test passed;
  duración 545 ms.
- `pnpm --filter @vaqcrow/api exec vitest run
  src/infrastructure/adapters/simulated-sales-data-provider.test.ts
  src/infrastructure/http/routes/sales-feed.route.test.ts` — exit 0; 2 archivos y 23 tests passed;
  duración 761 ms.
- `pnpm run verify` — exit 0. Lint 5/5, typecheck 8/8, test 8/8 y build 5/5 tareas exitosas;
  boundaries sin violaciones (444 módulos, 1312 dependencias); `test:boundaries` 9 archivos y 93 tests
  passed. Un único warning preexistente: `_request` sin usar en
  `apps/web/src/infrastructure/http/fetch-http-client.ts:8`; 0 errores.
- No se ejecutaron integraciones de Supabase, Stellar Testnet, Horizon ni proveedor LLM. Los `stderr` de
  repositorios Supabase que aparecen en la suite completa son fixtures de pruebas de sanitización, no
  accesos a una base remota.

## Actualización mínima de planificación

La convención de entradas ya entregadas usa `Rama e implementación` con enlace de PR y `Workflow Done`.
Se actualizó solo #83 (PR #332) y #84 (PR #333), además de retirar #83 de la lista `Ready`. #85 conserva
`Workflow Backlog` y `Rama propuesta`; no se la marca entregada en este cambio local.

## Lectura estructural y rollback

La lectura del documento nuevo confirmó los criterios verbatim, la distinción entre hechos verificados,
simulados y futuros, los límites de datos sensibles y los comandos con resultados observados. No existe un
comando de normalización mutante aplicable a Markdown en los scripts del repositorio.

La frontera de rollback es documental y aislada: eliminar
`docs/planning/monthly-sales-feed-evidence.md`, revertir el ajuste de #83/#84 en
`docs/planning/demo-tasks-list.md` y eliminar este registro ODD. No se modificaron módulos de runtime,
contratos, pruebas, dependencias ni configuración.

## Diff final y próximo paso

La primera unidad entregada (`29488dc`) contiene 3 archivos, 228 inserciones y 5 eliminaciones;
`git diff --cached --check` no reportó errores. El siguiente paso es revisar y mergear #85; no se debe
marcar la Task ni la Feature como entregadas hasta que ese flujo ocurra.

## Evaluación RDD pasiva

Tras los commits actuales `29488dc` y `9979b6f`, contra `main`, se ejecutó:

```text
gentle-ai review assess --cwd /Users/arielduarte/Workspaces/Vaqcrow --agent opencode --base-ref main --committed-only --json
```

El resultado observado fue el esquema `gentle-ai.review-assessment/v1`, con `risk: passive`, razón
`non_executable_only`, 3 rutas modificadas y 247 líneas modificadas en el diff candidato contra `main`.
Indicó `review_due: false` y `review_due_reason: passive`. Por lo tanto, no corresponde revisión nativa
ni consentimiento en esta unidad. Esta evaluación pasiva no constituye un recibo de revisión ni una
aprobación.

## Entrega en PR #334 (pendiente de merge)

La evidencia principal quedó registrada en `29488dc` y el cierre del registro ODD en `9979b6f`. La entrega
está abierta como PR #334, `docs(planning): record monthly sales feed evidence`, desde
`Vaqcrow#85_Task_Document_evidence_for_monthly_sales_feed` hacia `main`, con la etiqueta `type:task`.
El alcance revisable permanece documental y pasivo; #85 no está entregada ni la Feature #26 está cerrada
hasta que el PR sea mergeado.
