
> Documento de cierre de iteración. Registra qué se hizo, por qué, y qué decisiones se tomaron para implementar el [issue #35](https://github.com/reyduar/Vaqcrow/issues/35) ("Configure the root pnpm/Turborepo workspace"), la primera unidad ejecutable del backlog según [demo-tasks-list.md](./demo-tasks-list.md). No reemplaza la fuente de verdad arquitectónica ([monorepo.md](../architecture/monorepo.md)) ni el plan de la demo ([DEMO.md](./DEMO.md)); es el registro de esta implementación puntual.

## Contexto y objetivo

El repositorio no tenía código ejecutable: sin `package.json`, sin `apps/`, sin `packages/`, sin `pnpm-workspace.yaml` ni `turbo.json`. El issue #35 pide configurar únicamente la base del workspace raíz (pnpm + Turborepo), los límites entre paquetes, el tooling compartido y los manifests necesarios para que después #110 (scaffold de Fastify) y #111 (scaffold de Next.js) puedan avanzar en paralelo — sin tocar código de aplicación todavía.

La tarea se implementó siguiendo un ciclo completo de **Spec-Driven Development (SDD)**: exploración → investigación → propuesta → especificación → diseño → tareas → implementación → verificación → archivo. Cada fase quedó persistida en memoria (Engram) para trazabilidad entre sesiones.

## Decisiones clave

### Gestor de paquetes: pnpm 11.27.0 (no 12.4.1)

El diseño inicial proponía pnpm 12.4.1. La investigación (`sdd-research`) encontró que pnpm 12 es una reescritura completa en Rust de solo ~3 semanas de antigüedad al momento de esta iteración, todavía publicando parches de "puesta al día" para restaurar comportamientos que pnpm 11 ya tenía. Además, el propio proyecto pnpm desaconseja usar Corepack para fijar cualquier versión actual, y Node va a remover Corepack de su núcleo a partir de la v25.

**Decisión:** se fijó **pnpm 11.27.0** (línea JS madura, con soporte hasta abril de 2027) exclusivamente vía el campo `"packageManager"` de `package.json`, sin ningún paso de Corepack. La versión exacta se autoimpone mediante `manage-package-manager-versions` (activado por defecto desde pnpm 10): cualquier persona que clone el repo termina usando 11.27.0 sin importar qué pnpm tenga instalado globalmente.

### Node.js 24 (LTS activa)

Pineado vía `.nvmrc` (`24`), `engines.node` en `package.json` (`>=24.0.0 <25.0.0`) y `.npmrc` con `engine-strict=true`.

### Alcance de paquetes: solo 4, no los 11 planeados

`monorepo.md` describe un árbol completo de `apps/{web,api,worker}` + 9 paquetes compartidos. El issue #35 solo pide manifests para `apps/web`, `apps/api`, `packages/domain` y `packages/contracts` — el resto (`ai`, `stellar`, `simulators`, `db`, `config`, `testing`, `ui`, `apps/worker`) corresponde a slices posteriores del roadmap SDD-lite de `DEMO.md`. Se respetó ese límite explícitamente para no incurrir en scope-creep.

### Grafo de dependencias real, no manifests vacíos

En vez de paquetes vacíos, cada uno de los 4 workspaces tiene una dependencia `workspace:*` real y una función mínima con su test:

- `packages/domain` y `packages/contracts`: sin dependencias de workspace (hojas del grafo). `domain` se mantiene libre de frameworks (sin DOM, sin tipos de Node, sin imports de React/Next/Fastify/Supabase/Stellar SDK).
- `apps/api`: depende de `@vaqcrow/domain` y `@vaqcrow/contracts`.
- `apps/web`: depende **solo** de `@vaqcrow/contracts` — nunca de `domain`, tal como exige la arquitectura.

Esto permite que `build`/`lint`/`typecheck`/`test` ejerciten código real en todo el grafo, en vez de quedar en cero paquetes registrados.

### Boundaries livianos, no el enforcement completo

Se agregó `dependency-cruiser` con 5 reglas básicas (`no-circular`, `packages-never-import-apps`, `web-never-imports-domain`, `no-cross-app-imports`, `domain-stays-framework-free`). El enforcement completo de todas las reglas de arquitectura queda para el issue #36; acá solo se probó que la plomería funciona y detecta violaciones reales.

### División en 2 PRs encadenados

El forecast de `sdd-tasks` estimó ~400-550 líneas autoradas en 37 archivos más el lockfile generado — riesgo **Alto** de superar el presupuesto de 400 líneas por PR. Se decidió dividir en **2 PRs apilados hacia `main`** (estrategia `stacked-to-main`):

- **PR1** — fundación raíz (workspace, toolchain, lockfile inicial). Rama: `Vaqcrow#35_Task_Configure_the_root_pnpm_Turborepo_workspace`.
- **PR2** — los 4 workspaces placeholder + boundaries + regeneración del lockfile + verificación completa. Rama: `Vaqcrow#35_Task_Configure_the_root_pnpm_Turborepo_workspace-part2-workspaces` (basada en la rama de PR1).

El ledger nativo de intentos SDD bloqueó el cierre de PR2 porque el diff crudo (676 líneas, dominado por el lockfile regenerado) superaba el presupuesto de 400 fijado al adquirir el intento. Se reseteó ese ledger con autorización explícita del usuario, dado que el trabajo ya estaba implementado y verificado.

## Defectos encontrados y corregidos durante la implementación

1. **ESLint y Vitest no estaban instalados.** El `eslint.config.mjs` raíz importaba `@eslint/js`, `globals` y `typescript-eslint`, pero el `package.json` raíz solo tenía `turbo` y `typescript` como devDependencies. Se detectó al verificar (`sdd-verify`) que ni `eslint` ni `vitest` corrían, y se corrigió agregando las 5 dependencias faltantes vía el protocolo `catalog:` ya declarado en `pnpm-workspace.yaml`.

2. **Ubicación de `allowBuilds` en pnpm 11.** Al instalar, pnpm bloqueó el script de postinstalación de `esbuild` (dependencia transitiva de Vitest) por política de supply-chain. Se descubrió que pnpm 11 ya no lee `pnpm.onlyBuiltDependencies` desde `package.json` — ese ajuste se movió a `allowBuilds` dentro de `pnpm-workspace.yaml`.

3. **Regla de boundaries silenciosamente rota.** La configuración original de `dependency-cruiser` excluía `dist/` del grafo completo de análisis. Como las importaciones entre paquetes se resuelven a través del `dist/index.js` compilado de cada paquete, esa exclusión eliminaba **todos** los enlaces entre paquetes del grafo — la regla `web-never-imports-domain` reportaba cero violaciones incluso ante una violación real inyectada a propósito. Se corrigió acotando la exclusión a `coverage`/`.turbo` únicamente y limitando las rutas analizadas a `apps/*/src packages/*/src`. Se volvió a probar la misma violación inyectada después del arreglo: la regla la detectó correctamente. Este ciclo de "romper a propósito → confirmar que falla → arreglar → confirmar que vuelve a fallar cuando corresponde" se repitió de forma independiente en la verificación final, no solo en la implementación.

## Verificación de los 6 criterios de aceptación del issue #35

| # | Criterio | Resultado |
|---|---|---|
| 1 | Metadata raíz y lockfile consistentes y comiteados | ✅ PASS |
| 2 | Manifests para `apps/web`, `apps/api` y todos los paquetes requeridos | ✅ PASS |
| 3 | `pnpm install --frozen-lockfile` limpio desde un checkout limpio | ✅ PASS (con una advertencia menor, ver abajo) |
| 4 | Los scripts raíz de Turbo invocan build/lint/typecheck/test en todos los workspaces | ✅ PASS |
| 5 | Fundaciones de TypeScript/lint/test compartidas, sin acoplar `web` y `api` | ✅ PASS (con una advertencia menor) |
| 6 | Ningún scaffold específico de aplicación (nada de Fastify/Next.js/React) | ✅ PASS |

**Advertencias no bloqueantes** (documentadas y aceptadas antes de archivar el cambio):
- El escenario "se rechaza un Node incompatible" (`engine-strict`) nunca se probó en tiempo de ejecución: el binario de pnpm 11.27.0 falla con un error interno no relacionado al correr bajo Node 20 en este entorno, antes de llegar a su propia validación de `engines`. La configuración (`.npmrc` con `engine-strict=true`) está correctamente presente; falta la prueba en runtime.
- Dos escenarios del spec quedan sin ejercitar porque los 4 paquetes son actualmente idénticos entre sí (sin overrides de `tsconfig` todavía, sin scripts opcionales divergentes) — es lo esperado para paquetes placeholder; se ejercitarán naturalmente cuando #110/#111 los completen.

## Estado de entrega

- **PR1** (`36537bb`) y **PR2** (`131bbb5`) están **comiteados localmente**, cada uno verificado de forma independiente (`pnpm install --frozen-lockfile` funciona parado solo en cada rama). **Todavía no se hizo push ni se abrieron Pull Requests en GitHub.**
- El issue #35 permanece en estado **"In progress"** en el tablero Vaqcrow-TFM — es el estado correcto mientras no exista un PR abierto para revisar.
- El cambio SDD `bootstrap-root-workspace` quedó archivado en Engram con las 6 fases completas (propuesta, spec, diseño, tareas, implementación, verificación) para trazabilidad futura.

## Qué queda desbloqueado

Con esta base lista, los issues **#110** (scaffold de Fastify para `apps/api`) y **#111** (scaffold de Next.js para `apps/web`) pueden avanzar **en paralelo** — ambos dependían únicamente de #35. Ambos, a su vez, desbloquean **#36** (pruebas de límites de dependencia).

## Próximos pasos sugeridos

1. Decidir si se pushean las 2 ramas y se abren los PRs encadenados (PR2 con base en la rama de PR1, no en `main`).
2. Opcionalmente, cerrar las 2-3 brechas de cobertura de test mencionadas arriba antes de pedir revisión.
3. Re-ejecutar `sdd-init` cuando arranque #110/#111, ya que ahora sí existe un test runner real (Vitest) para resolver el modo Strict TDD.
