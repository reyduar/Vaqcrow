# Enforcement de límites del workspace — Issue #36

> Documento de cierre de iteración. Registra qué se hizo, por qué, y qué decisiones se tomaron para implementar el [issue #36](https://github.com/reyduar/Vaqcrow/issues/36) ("Test workspace and Clean Architecture boundaries"), continuando el backlog de [demo-tasks-list.md](./demo-tasks-list.md). No reemplaza la fuente de verdad arquitectónica ([monorepo.md](../architecture/monorepo.md)) ni el registro de la base del workspace ([bootstrap-root-workspace.md](./bootstrap-root-workspace.md)); es el registro de esta implementación puntual.

## Contexto y objetivo

`bootstrap-root-workspace.md` (issue #35) dejó `dependency-cruiser` configurado con 9 reglas en `.dependency-cruiser.cjs`, pero solo 5 tenían cobertura de fixture real en `tests/boundaries.test.ts`: `no-circular`, `packages-never-import-apps`, `web-never-imports-domain`, `no-cross-app-imports` y `domain-stays-framework-free` estaban en la config pero sin fixtures que las ejercitaran, mientras que `contracts-never-import-node-core`, `contracts-never-import-frameworks`, `api-application-stays-provider-free` y `web-presentation-stays-contracts-free` sí tenían prueba parcial. El issue #36 pide cerrar esa brecha: cada regla debe tener un fixture FAIL que la dispare y, donde corresponda, un fixture PASS que confirme la excepción `type-only`. Las reglas en sí no cambian de intención — solo se agrega evidencia — salvo por el arreglo de bug documentado en la sección "Defectos encontrados".

## Decisiones clave

### D1 — Fixtures de proveedores resuelven contra stubs comiteados, no SDKs reales

`apps/api` depende solo de `fastify`; `@supabase/supabase-js`, `stellar-sdk` y `openai` no están instalados. Una importación sin resolver produce `dependencyTypes: ["unknown"]` y el `resolved` queda como el specifier crudo, por lo que el regex de la regla (`to.path: "(^|/)node_modules/..."`) nunca matchea y el fixture probaría un falso positivo.

**Decisión:** se comitearon paquetes stub bajo `tests/fixtures/boundaries/provider-stubs/node_modules/<pkg>/{index.ts,package.json}` y se pasó ese directorio como raíz extra de `modules` al harness de `cruise()`. El path resuelto conserva un segmento literal `node_modules/`, por lo que el regex de la regla aplica igual que con `fastify`. Se rechazó agregar las SDKs reales como devDependencies (churn de lockfile, dependencias pesadas, fuera del alcance de la propuesta original).

**Requiere:** negación en `.gitignore` (`!tests/fixtures/boundaries/provider-stubs/node_modules/`) después de la regla `node_modules/`, para que los stubs queden versionados pese a la regla general que ignora `node_modules/`.

### D2 — Bug de regex en prefijos con scope (arreglado, ver Defectos encontrados)

El regex original de dos reglas (`api-application-stays-provider-free` y `contracts-never-import-frameworks`) tenía alternativas con scope ya terminadas en `/` (`@fastify/`, `@supabase/`, `@stellar/`, `@anthropic-ai/`) seguidas del sufijo compartido `(/|$)`, lo que exigía una barra doblada imposible de matchear. Se corrigió quitando la barra final de esas alternativas. Detalle completo en "Defectos encontrados".

### D3 — El fixture de `packages/domain` no necesita tsconfig ni plomería de resolución nueva

`packages/domain/src/` existe en el repo real; el fixture usa un path distinto (`tests/fixtures/boundaries/packages/domain/src/`) alcanzado solo por `cruise([target])` con `baseDir = FIXTURE_ROOT`. El tsconfig de fixtures bajo `apps/web/` existe únicamente para el test `compileFixture` (consumidor DOM), no para dependency-cruiser. La regla `domain-stays-framework-free` exige `dependencyTypes ∈ {npm, npm-dev, npm-peer, npm-optional}`; la resolución de manifest de dependency-cruiser sube desde `baseDir` hasta encontrar el `package.json` raíz del repo, cuyas `devDependencies` incluyen `vitest` → se clasifica `npm-dev`. Importar `vitest` desde el fixture dispara la violación sin tsconfig adicional.

### D4 — Fixtures de "importa una app" comparten un mismo leaf target

`app-probe.fixture.ts` no tiene imports propios, así que el grafo se mantiene determinista al ser reutilizado por los fixtures de `packages-never-import-apps` y `no-cross-app-imports`, sin ruido transitivo.

## Evidencia manual

### `pnpm install --frozen-lockfile`

> **Alcance de la prueba:** este comando solo demuestra consistencia entre `pnpm-lock.yaml` y los manifests (`package.json`) de cada workspace. No prueba integridad de paquetes descargados ni el estado final de `node_modules`.

```sh
$ pnpm install --frozen-lockfile
Scope: all 5 workspace projects
Already up to date
Done in 230ms using pnpm v11.27.0
```

Salida `exit 0` desde un lockfile ya consistente (el checkout ya tenía `node_modules` instalado de una corrida previa) — confirma que ningún cambio de esta iteración tocó dependencias ni manifests de forma incompatible con el lockfile comiteado.

### `pnpm run workspaces:list`

```sh
$ pnpm run workspaces:list
$ pnpm -r list --depth -1
vaqcrow /Users/arielduarte/Workspaces/Vaqcrow (PRIVATE)

@vaqcrow/api@0.0.0 /Users/arielduarte/Workspaces/Vaqcrow/apps/api (PRIVATE)

@vaqcrow/web@0.0.0 /Users/arielduarte/Workspaces/Vaqcrow/apps/web (PRIVATE)

@vaqcrow/contracts@0.0.0 /Users/arielduarte/Workspaces/Vaqcrow/packages/contracts (PRIVATE)

@vaqcrow/domain@0.0.0 /Users/arielduarte/Workspaces/Vaqcrow/packages/domain (PRIVATE)
```

Se listan los **4 workspaces** esperados (`@vaqcrow/api`, `@vaqcrow/web`, `@vaqcrow/contracts`, `@vaqcrow/domain`) más el paquete raíz `vaqcrow` (el mensaje `pnpm install` cuenta ambos como "5 workspace projects": raíz + 4 paquetes).

### `pnpm exec turbo run build --dry=json`

> Se usa `--dry=json` deliberadamente, nunca `--graph`, que tiene un bug documentado de nodos de tarea fantasma en Turborepo 2.x.

Salida (recortada a los campos relevantes; el JSON completo incluye hashes de caché y archivos de input por tarea):

```json
{
  "monorepo": true,
  "packages": ["@vaqcrow/api", "@vaqcrow/contracts", "@vaqcrow/domain", "@vaqcrow/web"],
  "tasks": [
    { "taskId": "@vaqcrow/api#build", "dependencies": ["@vaqcrow/contracts#build", "@vaqcrow/domain#build"] },
    { "taskId": "@vaqcrow/contracts#build", "dependencies": [] },
    { "taskId": "@vaqcrow/domain#build", "dependencies": [] },
    { "taskId": "@vaqcrow/web#build", "dependencies": ["@vaqcrow/contracts#build"] }
  ]
}
```

Las 4 tareas de `build` aparecen en el grafo con el orden de dependencia correcto (`contracts` y `domain` sin dependencias, `api` depende de ambos, `web` depende solo de `contracts` — nunca de `domain`, tal como exige la arquitectura). No existe una tarea `build` propia del paquete raíz (`vaqcrow`), ya que este no define scripts ejecutables propios en `turbo.json`; el grafo cubre correctamente los 4 workspaces reales.

## Inventario de reglas y cobertura

| Regla | Fixture FAIL | Fixture PASS (exención type-only) | Cobertura antes de #36 |
|---|---|---|---|
| `no-circular` | `packages/contracts/src/circular-a.fixture.ts` + `circular-b.fixture.ts` | N/A (no aplica exención) | ❌ sin fixture |
| `packages-never-import-apps` | `packages/contracts/src/imports-app.fixture.ts` | N/A | ❌ sin fixture |
| `web-never-imports-domain` | `apps/web/src/presentation/imports-domain.fixture.ts` (ya existía) | N/A | ✅ ya cubierta |
| `no-cross-app-imports` | `apps/web/src/presentation/imports-api-application.fixture.ts` | N/A | ❌ sin fixture |
| `domain-stays-framework-free` | `packages/domain/src/imports-npm-dep.fixture.ts` | N/A | ❌ sin fixture |
| `contracts-never-import-node-core` | `packages/contracts/src/imports-node-crypto.fixture.ts` (ya existía) | N/A | ✅ ya cubierta |
| `contracts-never-import-frameworks` | `packages/contracts/src/imports-fastify.fixture.ts` (ya existía) | N/A | ✅ ya cubierta |
| `api-application-stays-provider-free` | `imports-fastify.fixture.ts` (existía) + `imports-supabase.fixture.ts`, `imports-stellar.fixture.ts`, `imports-llm.fixture.ts` (nuevos) | `imports-fastify-type-only.fixture.ts` (existía) + `imports-supabase-type-only.fixture.ts` (nuevo) | ⚠️ parcial (solo Fastify) |
| `web-presentation-stays-contracts-free` | `imports-contracts.fixture.ts` (ya existía) | `imports-contracts-type-only.fixture.ts` (ya existía) | ✅ ya cubierta |

Las 9 reglas quedan **fixture-probadas** al cierre de esta iteración.

## Verificación de los criterios de aceptación del issue #36

| # | Criterio | Resultado |
|---|---|---|
| 1 | Las 9 reglas de `dependency-cruiser` tienen al menos un fixture FAIL que las dispara | ✅ PASS |
| 2 | Las reglas con exención `type-only` (`api-application-stays-provider-free`, `web-presentation-stays-contracts-free`) tienen fixture PASS que prueba la exención | ✅ PASS |
| 3 | La exención `type-only` se prueba para más de un proveedor en `api-application-stays-provider-free` | ✅ PASS (Fastify + Supabase) |
| 4 | Los fixtures nunca entran a los globs reales de `build`/`lint`/`typecheck`/`boundaries` | ✅ PASS |
| 5 | `pnpm run boundaries` (glob real `apps/*/src packages/*/src`) se mantiene en cero violaciones | ✅ PASS |
| 6 | `pnpm run verify` completo pasa con la nueva cobertura | ✅ PASS |
| 7 | Se documenta evidencia manual de instalación congelada, listado de workspaces y grafo de tareas | ✅ PASS |
| 8 | Riesgos de cobertura aceptados quedan documentados explícitamente, no omitidos | ⚠️ ver nota de Horizon abajo |

**Nota de riesgo aceptado — patrón "Horizon":** `api-application-stays-provider-free` no tiene un patrón de regex dedicado para "Horizon" (el servidor/API de Stellar). La cobertura se apoya en el patrón `stellar-sdk`/`@stellar/`, que es el mecanismo real de acceso a Horizon en este repo. Se confirmó por búsqueda (`rg -i horizon` sobre manifests y lockfile) que **no existe ningún paquete `horizon` independiente** en ninguna dependencia del repo — Horizon se consume siempre a través del SDK `stellar-sdk` o paquetes con scope `@stellar/`. Este riesgo se acepta explícitamente: si en el futuro se introduce un cliente HTTP directo a Horizon sin pasar por `stellar-sdk`/`@stellar/`, esta regla no lo detectaría.

## Defectos encontrados

### Bug de regex en prefijos con scope duplicando la barra final

Al escribir el fixture `imports-supabase.fixture.ts` (proveniente del stub `@supabase/supabase-js`, D1), la prueba falló con `0` violaciones detectadas pese a que el import debía dispararlas. La causa: el regex de `api-application-stays-provider-free` y `contracts-never-import-frameworks` combinaba alternativas terminadas en `/` (`@fastify/`, `@supabase/`, `@stellar/`, `@anthropic-ai/`) con el sufijo compartido `(/|$)`, exigiendo una barra doblada (`.../@supabase//...`) que nunca ocurre en un path real. Las ramas `fastify`, `stellar-sdk` y `openai` (sin barra final propia) sí matcheaban — por eso el bug pasó desapercibido hasta este fixture.

**Se corrigió** quitando la barra final de las alternativas con scope en ambas reglas, dejando que el sufijo compartido `(/|$)` haga el trabajo de forma uniforme (comportamiento idéntico al de `fastify`, `stellar-sdk`, `openai`). El cambio se aprobó explícitamente por el usuario como una enmienda al alcance de diseño ("Path A"), ya que dejar el bug sin arreglar habría dejado el fixture de Supabase probando una cobertura fantasma — exactamente el tipo de falla silenciosa que el issue #36 busca cerrar. `imports-supabase.fixture.ts` e `imports-supabase-type-only.fixture.ts` quedan como test de regresión permanente de este fix: la corrida RED (regex sin arreglar → `0` violaciones) se capturó antes de aplicar el cambio, y la corrida GREEN (regex arreglado → violación detectada) se confirmó después.

### Import relativo con profundidad incorrecta en fixture de cross-app

El diseño original de `imports-api-application.fixture.ts` (`apps/web/src/presentation/`) especificaba un import relativo de 4 niveles (`../../../../api/...`) hacia `app-probe.fixture.ts`. Al ejecutarlo, la regla `no-cross-app-imports` reportó `0` violaciones: el path relativo resolvía un nivel por encima de `tests/fixtures/boundaries/apps/`, fuera del árbol de fixtures, y dependency-cruiser lo marcaba como no resuelto en lugar de fallar. Se corrigió a 3 niveles (`../../../api/...`), que resuelve correctamente a `apps/api/src/application/app-probe.fixture.ts` dentro del árbol de fixtures.

## Estado de entrega

- Cambio SDD `workspace-boundary-enforcement` implementado en una sola unidad de trabajo (forecast de `sdd-tasks`: ~250-290 líneas autoradas, riesgo **Bajo** de presupuesto de 400 líneas, sin necesidad de encadenar PRs).
- `pnpm run test:boundaries` (Vitest completo, incluye `tests/boundaries.test.ts`) y `pnpm run verify` (`lint && typecheck && test && build && boundaries && test:boundaries`) pasan en cero violaciones tras esta iteración.
- No se modificaron `.github/workflows/`, la lógica real de `packages/domain`, reglas de ESLint, ni se agregó ningún proceso automatizado que invoque `pnpm install`/`turbo run` — la evidencia de instalación congelada y grafo de tareas es manual, documentada aquí, no asertada en Vitest.
- Commit `e118c1a` en la rama `Vaqcrow#36_Task_Test_workspace_and_Clean_Architecture_boundaries`, pusheado y con **PR #122** abierto contra `main`: https://github.com/reyduar/Vaqcrow/pull/122.
- El push se hizo por HTTPS usando las credenciales de `gh` (la clave SSH no estaba disponible en este entorno de trabajo), sin modificar la configuración git persistente del repositorio.
- El cambio SDD `workspace-boundary-enforcement` ya fue archivado (`sdd-archive`); sus 9 fases quedan persistidas en Engram bajo los topic keys `sdd/workspace-boundary-enforcement/{explore,research,proposal,spec,design,decision-regex-fix,tasks,apply-progress,verify-report}`, con `sdd/workspace-boundary-enforcement/archive-report` como índice de trazabilidad — no en archivos del repositorio.

## Qué queda desbloqueado

Con las 9 reglas de `dependency-cruiser` fixture-probadas, el issue **#37** (o el siguiente ítem del backlog que dependa de límites de arquitectura confiables) puede avanzar asumiendo que una violación real de boundaries siempre se detecta, no solo las que ya tenían fixture antes de esta iteración.

## Próximos pasos sugeridos

1. Revisar y mergear el PR #122.
2. Evaluar si conviene agregar un patrón de regex dedicado para "Horizon" si en el futuro se introduce acceso HTTP directo fuera de `stellar-sdk`.
3. Mantener este documento como referencia al extender `.dependency-cruiser.cjs` con nuevas reglas — cada regla nueva debería nacer con su fixture FAIL correspondiente desde el principio, evitando la brecha que motivó el issue #36.
4. Agregar fixtures de regresión dedicados para las ramas `@fastify`, `@stellar` y `@anthropic-ai` del regex corregido (advertencia no bloqueante de `sdd-verify`) — hoy solo `@supabase` quedó fixture-probada.
