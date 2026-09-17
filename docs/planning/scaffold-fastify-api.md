# Scaffold de la API Fastify con Clean Architecture — Issue #110

> Documento de cierre de iteración. Registra qué se hizo, por qué, y qué decisiones se tomaron para implementar el [issue #110](https://github.com/reyduar/Vaqcrow/issues/110) ("Scaffold the Fastify API with Clean Architecture"), desbloqueado por el bootstrap del workspace raíz ([#35](https://github.com/reyduar/Vaqcrow/issues/35), ver [bootstrap-root-workspace.md](./bootstrap-root-workspace.md)). No reemplaza la fuente de verdad arquitectónica ([monorepo.md](../architecture/monorepo.md)) ni el plan de la demo ([DEMO.md](./DEMO.md)); es el registro de esta implementación puntual.

## Contexto y objetivo

`apps/api` existía solo como placeholder desde #35: un `package.json` con dependencias de workspace declaradas pero sin Fastify, sin capas internas y con un único archivo (`index.ts`) que probaba el cableado entre paquetes. El issue #110 pide convertir ese placeholder en una aplicación Fastify arrancable, con límites explícitos entre dominio, aplicación e infraestructura, y con esos límites verificados automáticamente — no solo documentados.

La tarea se implementó siguiendo un ciclo completo de **Spec-Driven Development (SDD)**: exploración → investigación → propuesta → especificación → diseño → tareas → implementación → verificación. Cada fase quedó persistida en memoria (Engram) para trazabilidad entre sesiones, y las fases de diseño e implementación pasaron además por un validador de contrato en contexto fresco que re-ejecutó los comandos reales del repositorio en vez de confiar en lo reportado por cada fase.

## Decisiones clave

### Dos capas internas, no tres

El texto del issue menciona "backend domain, application, infrastructure" como si fueran tres capas dentro de `apps/api`. La exploración y la propuesta decidieron **no** crear un `apps/api/src/domain/` local: `packages/domain` ya es, por decisión arquitectónica previa (`monorepo.md`), la única capa de dominio compartida, pensada para ser reutilizada también por un futuro `apps/worker`. Duplicarla dentro de `apps/api` habría creado una copia sombra sin contenido real en un cambio que es solo scaffolding.

**Decisión:** `apps/api/src/` tiene dos capas propias — `application/` (casos de uso y puertos, solo puede importar `@vaqcrow/domain` y `@vaqcrow/contracts`) e `infrastructure/` (composición de Fastify y stubs de adaptadores para Supabase/LLM/Stellar/Horizon, sin lógica real todavía).

### Regla de límites: lista negra nombrada, no lista blanca

Para impedir que `application/` importe Fastify o SDKs de proveedores se evaluaron dos enfoques de `dependency-cruiser`: una lista blanca (permitir explícitamente `@vaqcrow/domain`/`@vaqcrow/contracts` y prohibir el resto) o una lista negra (nombrar los paquetes prohibidos). Se investigó (`sdd-research`) que el arreglo `allowed` de `dependency-cruiser` es **global a la configuración**, no por regla — agregarlo habría re-alcanzado silenciosamente las 5 reglas ya existentes en `.dependency-cruiser.cjs`.

**Decisión:** una sexta regla nombrada (`api-application-stays-provider-free`) que prohíbe explícitamente `fastify`, `@supabase/*`, el SDK de Stellar/Horizon y el SDK de LLM desde `apps/api/src/application/`, con `dependencyTypesNot: ["type-only"]` para no bloquear imports de solo-tipo. `@vaqcrow/domain` y `@vaqcrow/contracts` quedan permitidos por construcción, sin necesidad de mantenimiento.

### La regla se probó contra pnpm real antes de escribirse

El mayor riesgo identificado en investigación y propuesta era que una expresión regular de `dependency-cruiser` escrita "a ojo" contra el layout anidado de `node_modules/.pnpm` de pnpm podía no coincidir nunca — una regla así pasaría en silencio sin proteger nada. Antes de escribir la regla definitiva, la implementación instaló `fastify`, agregó un import prohibido de prueba dentro de `application/`, corrió `depcruise --output-type json` y registró la ruta `resolved` real: `node_modules/.pnpm/fastify@5.12.4/node_modules/fastify/fastify.js`. Solo después de confirmar que el patrón `(^|/)node_modules/(fastify|...)(/|$)` coincidía con esa ruta real se escribió la regla de producción, y se retiró la importación de prueba confirmando que `pnpm run boundaries` volvía a pasar en limpio.

El fixture que prueba la regla (`tests/boundaries.test.ts`) vive en la raíz del repo, fuera de los globs que escanea el script `boundaries` (`apps/*/src packages/*/src`) y fuera del `tsconfig` de `apps/api`, para no contaminar el build ni el typecheck reales.

### Relocación del código de #35, no borrado

`apiBootstrapProbe()` (la función que #35 usó para probar el cableado entre `@vaqcrow/domain` y `@vaqcrow/contracts`) se trasladó a `application/bootstrap-probe.ts` en lugar de borrarse. Además de preservar esa prueba de cableado, fue la primera demostración real de que `application/` podía importar los dos paquetes compartidos.

> **Estado actual (post-#38):** apps/api/src/application/bootstrap-probe.ts y los cuatro símbolos de probe (apiBootstrapProbe, WorkspaceProbe, describeWorkspace, isWorkspaceBootstrapped) fueron retirados de forma atómica por el issue #38 (decisión D4). Este párrafo registra el estado vigente al cierre del #110, no el código actual.

### Alcance explícitamente diferido

Dos partes del issue quedaron fuera de este cambio, acordado con el usuario antes de proponer:

- **`packages/contracts`** sigue siendo un placeholder. El issue pide "contratos validables en runtime y correlation IDs", pero el paquete no tiene hoy ninguna librería de validación (no hay `zod`/`ajv` en el repo) ni un helper de correlation-id. Se recomienda abrir un issue de seguimiento para esa implementación.
- **CI** (`.github/workflows/*`) no se agregó — la verificación sigue siendo local vía `pnpm run verify`, tal como pide la estrategia de testing del propio issue.

## Defecto encontrado y corregido durante la implementación

**El script `dev` propuesto en diseño no funcionaba bajo Node 24.** El diseño proponía `"dev": "node --watch src/index.ts"`, apoyándose en el *type-stripping* nativo de Node 24. En la práctica, el resolvedor de módulos ESM de Node no remapea especificadores de import con extensión `.js` hacia el archivo `.ts` hermano — y la convención del repo (fijada por el propio diseño arquitectónico) exige extensiones `.js` explícitas en imports relativos. Reescribir todos los imports del código para evitar extensiones habría sido desproporcionado para un cambio de scaffolding.

**Corrección:** el script `dev` pasó a un enfoque de build-y-watch-sobre-`dist` (`tsc --watch` + `node --watch dist/index.js`), sin dependencias nuevas. Se verificó arrancando el servidor y confirmando `200 {"status":"ok"}` en `GET /health` tanto con `dev` como con `start`.

## Verificación de los 6 criterios de aceptación del issue #110

| # | Criterio | Resultado |
|---|---|---|
| 1 | `apps/api` arranca como aplicación Fastify mínima vía scripts del workspace | ✅ PASS |
| 2 | Dirección de dependencia explícita entre dominio/aplicación/infraestructura | ✅ PASS |
| 3 | Las capas de dominio y aplicación no importan SDKs de proveedores/frameworks | ✅ PASS |
| 4 | Supabase, LLM, Stellar, Horizon y Fastify permanecen en adaptadores/composición externa | ✅ PASS |
| 5 | Las reglas de negocio vienen de `packages/domain` y los contratos de `packages/contracts` | ✅ PASS |
| 6 | Los checks de límites fallan ante imports prohibidos representativos | ✅ PASS |

**Advertencias no bloqueantes** (documentadas y aceptadas antes de abrir el PR):
- Dos escenarios del spec ("`index.ts` delega en `buildApp()`", "la app arranca vía script del workspace") se probaron por lectura directa de código y arranque manual, no por un test automatizado dentro de `pnpm run verify`. Confirmados funcionando en esta iteración, pero una regresión futura ahí no la detectaría el suite automático.
- Las alternativas de paquetes con scope en la regla de `dependency-cruiser` (`@supabase/*`, `@stellar/*`, SDK de LLM) quedan sin probar contra un paquete real, porque ninguno de esos SDKs está instalado todavía — solo la rama de `fastify` se validó contra pnpm real. Se resolverá naturalmente cuando se implementen los adaptadores reales.

## Estado de entrega

- Commit `d901ba8` en la rama `Vaqcrow#110_Task_Scaffold_the_Fastify_API_with_Clean_Architecture`, pusheada y con **PR #115** abierto contra `main`: https://github.com/reyduar/Vaqcrow/pull/115.
- El push se hizo por HTTPS usando las credenciales de `gh` (la clave SSH no estaba disponible en este entorno de trabajo), sin modificar la configuración git persistente del repositorio.
- El issue #110 se movió a **"In review"** en el tablero Vaqcrow-TFM (proyecto #4) ahora que existe un PR real para revisar.
- Quedaron deliberadamente fuera del commit los cambios de `.mcp.json`, `.atl/*`, `.agents/`, `.claude/skills` y `skills-lock.json`: son housekeeping local del entorno de trabajo (registro de skills, configuración de MCP), no parte del cambio de arquitectura de `apps/api`.
- El cambio SDD `scaffold-fastify-api` tiene sus 7 fases (exploración, investigación, propuesta, spec, diseño, tareas, implementación, verificación) persistidas en Engram; el archivo (`sdd-archive`) queda pendiente hasta confirmar que el PR #115 está mergeado, siguiendo el mismo patrón que #35.

## Qué queda desbloqueado

Con `apps/api` arrancable y con límites verificados, queda naturalmente habilitado implementar casos de uso reales detrás de los puertos ya definidos (`WorkspaceRepositoryPort`, `LedgerPort`, `AssistantPort`) y sus adaptadores concretos. El issue **#111** (scaffold de Next.js para `apps/web`) sigue siendo independiente de este cambio — ambos dependían solo de #35.

## Próximos pasos sugeridos

1. Revisar y mergear el PR #115.
2. Abrir un issue de seguimiento para poblar `packages/contracts` con validación runtime (ej. zod) y el helper de correlation-id, ya que quedó explícitamente diferido en este cambio.
3. Evaluar si conviene agregar un workflow de CI (`.github/workflows/*`) que corra `pnpm run verify` en cada PR, también diferido en este cambio.
4. Ejecutar `sdd-archive` sobre `scaffold-fastify-api` una vez confirmado el merge.
