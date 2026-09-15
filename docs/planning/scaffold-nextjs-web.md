# Scaffold del web app Next.js con Clean Architecture — Issue #111

> Documento de cierre de iteración. Registra qué se hizo, por qué, y qué decisiones se tomaron para implementar el [issue #111](https://github.com/reyduar/Vaqcrow/issues/111) ("Scaffold the Next.js web app with Clean Architecture"), desbloqueado por el bootstrap del workspace raíz ([#35](https://github.com/reyduar/Vaqcrow/issues/35), ver [bootstrap-root-workspace.md](./bootstrap-root-workspace.md)). Es independiente del scaffold de la API ([#110](https://github.com/reyduar/Vaqcrow/issues/110), ver [scaffold-fastify-api.md](./scaffold-fastify-api.md)) — ambos solo dependían de #35. No reemplaza la fuente de verdad arquitectónica ([monorepo.md](../architecture/monorepo.md)) ni el plan de la demo ([DEMO.md](./DEMO.md)); es el registro de esta implementación puntual.

## Contexto y objetivo

`apps/web` existía solo como placeholder desde #35: un `package.json` con `@vaqcrow/contracts` como única dependencia y un `src/index.ts` (`webBootstrapProbe`) que probaba el cableado entre paquetes, sin Next.js, sin capas internas y sin ningún archivo `.tsx` en todo el repositorio. El issue #111 pide convertir ese placeholder en una aplicación Next.js arrancable, con capas frontend explícitas (presentación, orquestación de aplicación, estado de cliente, adaptadores de infraestructura) que **no** mirroreen las capas del backend, y con adaptadores para HTTP y Freighter (wallet de Stellar) detrás de un límite verificable.

La tarea se implementó siguiendo un ciclo completo de **Spec-Driven Development (SDD)**: exploración → investigación → propuesta → especificación → diseño → tareas → implementación (3 lotes) → verificación. Cada fase quedó persistida en memoria (Engram) para trazabilidad entre sesiones. A diferencia del ciclo de #110, este cambio se implementó como **3 PRs encadenados** (`stacked-to-main`) porque el forecast de `sdd-tasks` marcó riesgo alto de superar el presupuesto de 400 líneas por PR — es la primera instalación real de dependencias de frontend en el repositorio (Next.js, React, jsdom, Testing Library).

## Decisiones clave

### `moduleResolution: "bundler"` solo en `apps/web`, con tres overrides, no uno

La investigación (`sdd-research`) confirmó que Next.js soporta oficialmente tanto `bundler` (su propio default) como `NodeNext` para `moduleResolution`, así que no había una respuesta "correcta" única. Se decidió `bundler` acotado a `apps/web`, mientras el resto del monorepo sigue en `NodeNext` — sobre todo porque `next dev` reescribe `tsconfig.json` en cada corrida, y con `bundler` esas reescrituras son no-ops en vez de causar diffs recurrentes.

**Corrección durante el diseño:** la propuesta original solo mencionaba cambiar `moduleResolution`. El diseño verificó contra el `tsconfig.base.json` real que eso no alcanza: TypeScript rechaza `moduleResolution: "bundler"` mientras `module` siga heredando `NodeNext`, y la base no declara ningún `lib` con DOM, así que cualquier tipo de React/JSX fallaría. La decisión final override tres campos (`module`, `moduleResolution`, `lib`) más `jsx`, `plugins` y `paths`.

### El glob de ESLint de la propuesta no funcionaba — detectado por el diseño, no por la propuesta

La propuesta pidió scopear `eslint-config-next` con `files: ["apps/web/**/*.{ts,tsx}"]` en el `eslint.config.mjs` raíz. El diseño, al verificar contra el repo real, encontró que `turbo run lint` corre `eslint .` **por workspace**, y `apps/web` ya tiene su propio `eslint.config.mjs` que reexporta el raíz — así que ese glob se resuelve relativo a `apps/web` mismo y nunca matchea nada. Las reglas de Next hubieran cargado sin aplicarse jamás, en silencio.

**Decisión corregida:** el raíz exporta un `nextWebConfig` nombrado, scopeado a `files: ["src/**/*.{ts,tsx}"]` (agnóstico a la base de resolución), que `apps/web/eslint.config.mjs` compone explícitamente (`[...base, ...nextWebConfig]`). Esto obligó a **repatchear la spec ya escrita**, que había copiado literalmente el glob roto de la propuesta como requisito — el gate automático del ciclo detectó ese drift entre spec y diseño antes de llegar a tareas, y se corrigió con una re-corrida acotada de `sdd-spec` en vez de dejarlo pasar.

### Puerto de wallet vendor-neutral, no un espejo de la SDK de Freighter

La investigación confirmó el paquete real (`@stellar/freighter-api`, v6.0.1 en npm) pero no pudo verificar con una fuente primaria fechada si sus métodos actuales son `isConnected/requestAccess/getAddress` o el `getPublicKey` ya deprecado. En vez de bloquear el diseño en esa duda, se definió `WalletPort` con nombres propios y neutrales (`isAvailable()/connect()/signTransaction()`), y el SDK real solo se nombra en un comentario dentro del único archivo (`FreighterWallet`) que lo implementará el día que se instale. Así, la incertidumbre de nombres queda confinada a un archivo stub que nunca se llegó a instalar ni implementar en este cambio.

### Alcance explícitamente diferido

- **`packages/contracts`** sigue sin librería de validación runtime ni helper de correlation-id (issue #116, abierto en la iteración anterior). Se reconfirmó el diferimiento explícitamente en la propuesta, en vez de asumirlo en silencio por segunda vez consecutiva.
- **`packages/ui`, `packages/stellar`, `packages/config`**, mencionados en `monorepo.md` como dependencias futuras de `apps/web`, no se crearon — habría agregado tres paquetes publicables sin consumidores reales. `apps/web` recibe únicamente costuras (seams) locales que esos paquetes absorberán más adelante.
- **CI** (`.github/workflows/*`) no se agregó — mismo gap aceptado que en #110 y #35.

## Defectos encontrados y corregidos durante la implementación

Como en el ciclo de #110, varias afirmaciones del diseño solo se confirmaron (o se corrigieron) al ejecutar comandos reales contra el repositorio, no por lectura de código:

1. **Import con extensión `.js` rompía el build de Turbopack.** `page.tsx` importaba el componente de presentación con extensión `.js` explícita (convención del resto del monorepo bajo `NodeNext`). TypeScript y Vitest lo resolvían igual, pero `next build` (Turbopack) fallaba porque el archivo real es `.tsx`. Se corrigió usando imports sin extensión para los propios archivos de `apps/web`.
2. **Testing Library no limpia el DOM entre tests por defecto bajo Vitest.** Un segundo assert en el mismo archivo de test falló con "multiple elements found" hasta agregar `afterEach(() => cleanup())` en `vitest.setup.ts` — detectado por triangulación real (TDD), no anticipado en el diseño.
3. **Vite/Vitest no lee los `paths` de `tsconfig.json` automáticamente.** El alias `@/*` definido para TypeScript/Next.js necesitó además un `resolve.alias` explícito en `vitest.config.ts`.
4. **`ERR_PNPM_IGNORED_BUILDS` bloqueaba toda ejecución de `pnpm --filter`.** Una dependencia transitiva de `eslint-config-next` (`unrs-resolver`) trae un script de build nativo sin aprobar, y pnpm bloquea *todo* comando `--filter` a nivel de repo hasta resolverlo. Se agregó a `ignoredBuiltDependencies` en `pnpm-workspace.yaml` en vez de aprobar builds a ciegas.
5. **La resolución de especificadores ESM en un archivo de config reexportado se resuelve relativo a ese archivo, no al que lo importa.** `apps/web/eslint.config.mjs` reexporta el config raíz; como el raíz importa `eslint-config-next` de forma estática, `eslint-config-next` necesitó agregarse como devDependency del **`package.json` raíz**, aunque solo lo use `apps/web` — de lo contrario cargar el config raíz desde `apps/api` (que no tiene ese paquete) tiraba `MODULE_NOT_FOUND`.
6. **`preserveSymlinks: false` (default de dependency-cruiser) rompe reglas ancladas por path contra fixtures fuera del árbol real del workspace.** Es la corrección más parecida en espíritu a la de #110 ("la regla se probó contra pnpm real antes de escribirse"): los fixtures nuevos viven fuera de `apps/web/`, y con el resolvedor de symlinks por defecto, un import a `@vaqcrow/contracts` se resuelve por `realpath` hasta `packages/contracts/dist/...`, que no matchea ninguna de las dos alternativas del patrón de la regla. Se puso `preserveSymlinks: true` en el helper `cruiseFixture()` de `tests/boundaries.test.ts`, y se comprobó **empíricamente y de forma adversarial** (revirtiendo el flag, viendo fallar exactamente las 2 pruebas predichas, y revirtiendo de nuevo) tanto durante la implementación como, de forma independiente, durante `sdd-verify`.
7. **Gap latente descubierto en el propio suite de fixtures de `apps/api` (heredado de #110).** El test existente que decía probar que `web-never-imports-domain` funciona en realidad solo afirmaba el conteo de violaciones de una regla *distinta*, sin nombrar la regla objetivo — nunca había demostrado que esa regla disparara. El nuevo fixture de dominio para `apps/web` (habilitado por la corrección del punto 6) es la primera prueba real de que esa regla dispara de punta a punta. No es una regresión: es un hueco de cobertura preexistente, cerrado como efecto colateral.
8. **`pnpm install` escribió un placeholder inválido en `pnpm-workspace.yaml`.** Al no tener terminal interactiva para el prompt de aprobación de builds, pnpm agregó una línea (`unrs-resolver: set this to true or false`) que no es una opción válida de configuración. Se eliminó — el archivo final quedó con diff cero contra el estado esperado, ya que la aprobación real vive en `ignoredBuiltDependencies` (punto 4).

## Verificación de los criterios de aceptación del issue #111

| # | Criterio | Resultado |
|---|---|---|
| 1 | `apps/web` arranca como aplicación Next.js mínima vía scripts del workspace | ✅ PASS |
| 2 | Presentación, orquestación de aplicación, estado de cliente e infraestructura tienen límites explícitos | ✅ PASS |
| 3 | HTTP/API y Freighter permanecen detrás de adaptadores | ✅ PASS (adaptadores stub, `@stellar/freighter-api` confirmado **no instalado**) |
| 4 | El código de presentación no importa `packages/contracts` directamente | ✅ PASS (regla `web-presentation-stays-contracts-free`, imports de solo-tipo permitidos) |
| 5 | La web app no importa `packages/domain` ni tipos backend-only de `apps/api` | ✅ PASS |
| 6 | Los checks de límites fallan ante imports prohibidos representativos | ✅ PASS (fixtures + `tests/boundaries.test.ts`, incluida una re-prueba adversarial) |

**`pnpm run verify`** (lint → typecheck → test → build → boundaries) pasa en limpio, exit 0 — verificado de forma independiente tanto por el implementador como por `sdd-verify` en una sesión separada, y confirmado una tercera vez por el orquestador antes de abrir los PRs.

**Sugerencias no bloqueantes** (registradas en el reporte de verificación, sin acción requerida en este cambio):
- No existe todavía workflow de CI — gap preexistente desde #110/#35, aceptado.
- Otras reglas de `dependency-cruiser` sin fixture de cobertura propia quedan fuera del alcance de #111.
- `apps/web/package.json` conserva una entrada de dependencia `@vaqcrow/contracts` de antes de este cambio que hoy no se usa desde `presentation/` — no es una violación de límites (la spec prohíbe el *import*, no la entrada del manifiesto), solo una prolijidad pendiente.

## Estado de entrega

Implementado en **3 commits stacked-to-main** sobre la rama `Vaqcrow#111_Task_Scaffold_the_Next_js_web_app_with_Clean_Architecture`, cada uno con su propio PR:

| PR | Contenido | Base | Líneas autoradas |
|---|---|---|---|
| [#117](https://github.com/reyduar/Vaqcrow/pull/117) | App Router + boot scripts + harness jsdom/RTL | `main` | ~134 |
| [#118](https://github.com/reyduar/Vaqcrow/pull/118) | Puertos de aplicación + adaptadores stub (HTTP/Freighter) + view-model de estado | PR #117 | ~213 |
| [#119](https://github.com/reyduar/Vaqcrow/pull/119) | Regla de `dependency-cruiser` + fixtures + scoping de `eslint-config-next` + verify completo | PR #118 | ~119 |

- El push se hizo por HTTPS usando las credenciales de `gh` (la clave SSH no estaba disponible en este entorno), sin modificar la configuración git persistente del repositorio — mismo patrón que #110.
- El issue #111 se movió a **"In review"** en el tablero Vaqcrow-TFM (proyecto #4) una vez abiertos los 3 PRs. A diferencia del ciclo anterior, el issue quedó en "Ready" durante toda la implementación por un descuido del orquestador — corregido y registrado como aprendizaje para mover el board en cuanto arranque la implementación, no al final.
- El cambio SDD `scaffold-nextjs-web` tiene sus 7 fases (exploración, investigación, propuesta, spec, diseño, tareas, implementación en 3 lotes, verificación) persistidas en Engram; `sdd-archive` queda pendiente hasta confirmar que los 3 PRs están mergeados, en orden.

## Qué queda desbloqueado

Con `apps/web` arrancable, con capas explícitas y con límites verificados, queda naturalmente habilitado implementar pantallas y flujos reales detrás de los puertos ya definidos (`HttpClientPort`, `WalletPort`) y sus adaptadores concretos (`FetchHttpClient`, `FreighterWallet`). La conexión real con Freighter requiere primero instalar `@stellar/freighter-api` y verificar sus nombres de método reales contra `docs.freighter.app`, tal como quedó documentado como paso pendiente en el propio puerto.

## Próximos pasos sugeridos

1. Revisar y mergear los PRs #117, #118 y #119, **en ese orden** (cada uno depende del anterior).
2. Instalar `@stellar/freighter-api` y verificar sus métodos reales contra la documentación oficial antes de implementar `FreighterWallet` de verdad.
3. Retomar el issue #116 (`packages/contracts`: validación runtime + helper de correlation-id), que sigue diferido desde #110 y ahora también desde #111.
4. Evaluar agregar el workflow de CI diferido desde #35/#110/#111.
5. Ejecutar `sdd-archive` sobre `scaffold-nextjs-web` una vez confirmado el merge de los 3 PRs.
