# Evidencia del workspace — Issue #37

> Documento de cierre de iteración. Registra la evidencia consolidada para el [issue #37](https://github.com/reyduar/Vaqcrow/issues/37) ("Document evidence for the pnpm/Turborepo workspace"), continuando el backlog de [demo-tasks-list.md](./demo-tasks-list.md). No reemplaza la fuente de verdad arquitectónica ([monorepo.md](../architecture/monorepo.md)) ni los registros de las iteraciones previas ([bootstrap-root-workspace.md](./bootstrap-root-workspace.md), [workspace-boundary-enforcement.md](./workspace-boundary-enforcement.md)); consolida y referencia lo que esas dos ya probaron, sin repetirlo, y agrega la evidencia propia que faltaba: comandos raíz individuales, scaffolds de API y web verificados de forma independiente, y la descripción precisa del límite de `packages/contracts`/`packages/domain`.

## 1. Contexto y objetivo

El issue #37 cierra el trabajo ejecutable de la Feature #11 ("Inicializar el workspace pnpm/Turborepo"). Su objetivo es dar a un revisor un registro único, preciso y no duplicado que confirme, en el orden en que un revisor recorrería el sistema: el workspace raíz, el scaffold de la API, el scaffold de la web, y los chequeos cross-boundary sobre `packages/contracts` y `packages/domain`. Los issues [#35](https://github.com/reyduar/Vaqcrow/issues/35) y [#36](https://github.com/reyduar/Vaqcrow/issues/36) ya dejaron evidencia de instalación congelada, grafo de Turborepo y las 9 reglas de `dependency-cruiser` fixture-probadas; este documento no repite esos comandos, solo los referencia (sección 7).

## 2. Cómo leer esta evidencia

- **Formato de bloque.** Cada comando aparece en un bloque ```sh``` con la forma `$ <comando>`, la salida relevante recortada (se omiten líneas repetitivas de cache de Turborepo cuando no aportan información nueva) y una línea literal final `# exit <N>` con el código de salida real observado.
- **Alcance de la prueba.** Cuando un comando prueba menos de lo que su nombre sugiere, un bloque `> **Alcance de la prueba:** …` lo precede, aclarando exactamente qué queda demostrado y qué no.
- **Marcador de reproducción local.** Toda la evidencia de este documento se marca una sola vez por sección con `> **Reproducido localmente, no verificado en CI.**` porque este repositorio no tiene `.github/workflows/` — la integración continua es alcance de la Feature #15 (issues #47–#49), todavía no implementada.
- **Normalización de rutas.** Las rutas absolutas de la máquina donde se ejecutaron los comandos (`/Users/.../Vaqcrow/...`) se reemplazan por `<repo>/...` en toda la salida transcripta. Esta es una normalización de transcripción, no la salida verbatim del terminal.

## 3. Workspace raíz

> **Reproducido localmente, no verificado en CI.**

Los cuatro comandos raíz (`lint`, `typecheck`, `test`, `build`) se registran como entradas independientes — no como un único `verify` combinado — porque cada uno prueba una propiedad distinta del workspace. `pnpm run verify` se agrega al final como quinta entrada: encadena los cuatro anteriores más `boundaries` y `test:boundaries`, y es el criterio de éxito de todo el cambio.

### `pnpm run lint`

```sh
$ pnpm run lint
$ turbo run lint
• Packages in scope: @vaqcrow/api, @vaqcrow/contracts, @vaqcrow/domain, @vaqcrow/web
• Running lint in 4 packages
@vaqcrow/web:lint: eslint . → 3 warnings (@typescript-eslint/no-unused-vars en
  fetch-http-client.ts y freighter-wallet.ts), 0 errores
@vaqcrow/contracts:lint: eslint . → sin hallazgos
@vaqcrow/api:lint: eslint . → sin hallazgos
@vaqcrow/domain:lint: eslint . → sin hallazgos

 Tasks:    4 successful, 4 total
# exit 0
```

Las 3 advertencias de `@vaqcrow/web` son parámetros con prefijo `_` intencionalmente sin usar en stubs de infraestructura (`fetch-http-client.ts`, `freighter-wallet.ts`); no son errores y no bloquean `lint`.

### `pnpm run typecheck`

```sh
$ pnpm run typecheck
$ turbo run typecheck
• Running typecheck in 4 packages
@vaqcrow/contracts:build: tsc -p tsconfig.build.json
@vaqcrow/contracts:typecheck: tsc -p tsconfig.json --noEmit
@vaqcrow/domain:build: tsc -p tsconfig.build.json
@vaqcrow/domain:typecheck: tsc -p tsconfig.json --noEmit
@vaqcrow/api:typecheck: tsc -p tsconfig.json --noEmit
@vaqcrow/web:typecheck: tsc -p tsconfig.json --noEmit

 Tasks:    6 successful, 6 total
# exit 0
```

`typecheck` reporta 6 tareas, no 4: `turbo.json` declara `dependsOn: ["^build"]` para esta tarea, así que `@vaqcrow/contracts` y `@vaqcrow/domain` ejecutan su propio `build` (que genera `dist/`) antes de que cualquier paquete pueda tipar contra ellos.

### `pnpm run test`

```sh
$ pnpm run test
$ turbo run test
@vaqcrow/contracts:test: vitest run → 2 archivos, 7 tests, todos ✓
@vaqcrow/domain:test:    vitest run → 1 archivo, 2 tests, todos ✓
@vaqcrow/api:test:       vitest run → 2 archivos, 9 tests, todos ✓
@vaqcrow/web:test:       vitest run → 5 archivos, 12 tests, todos ✓

 Tasks:    6 successful, 6 total
# exit 0
```

> **Alcance de la prueba:** `pnpm run test` invoca `vitest run` dentro de cada paquete de la lista de `turbo.json` (`@vaqcrow/{api,web,contracts,domain}`). **No** incluye `tests/boundaries.test.ts`, que vive en la raíz del repositorio fuera de esos cuatro paquetes y corre únicamente vía `pnpm run test:boundaries` (ver la entrada de `verify` más abajo).

### `pnpm run build`

```sh
$ pnpm run build
$ turbo run build
@vaqcrow/contracts:build: tsc -p tsconfig.build.json
@vaqcrow/domain:build:    tsc -p tsconfig.build.json
@vaqcrow/api:build:       tsc -p tsconfig.build.json
@vaqcrow/web:build:       next build
  ▲ Next.js 16.3.5 (Turbopack)
  ✓ Compiled successfully in 494ms
  Route (app)
  ┌ ○ /
  └ ○ /_not-found

 Tasks:    4 successful, 4 total
# exit 0
```

Los cuatro paquetes producen artefactos de salida distintos: `dist/` en `contracts`, `domain` y `api` (compilación TypeScript pura), y `.next/` en `web` (build de Next.js). La sección 5 detalla por qué esos dos formatos de salida no son equivalentes.

### `pnpm run verify` (criterio de éxito)

```sh
$ pnpm run verify
$ pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build && pnpm run boundaries && pnpm run test:boundaries
...
$ depcruise apps/*/src packages/*/src --config .dependency-cruiser.cjs
✔ no dependency violations found (44 modules, 49 dependencies cruised)
$ vitest run
 ✓ tests/boundaries.test.ts (19 tests) 1540ms
 Test Files  1 passed (1)
      Tests  19 passed (19)
# exit 0
```

La cadena completa (`lint && typecheck && test && build && boundaries && test:boundaries`) pasa de punta a punta con salida `0`, incluyendo las 19 pruebas de `tests/boundaries.test.ts` que la entrada de `test` de arriba no cubre.

## 4. Scaffold de API (`@vaqcrow/api`)

> **Reproducido localmente, no verificado en CI.**

**Contrato de build.** `apps/api` compila con `tsc -p tsconfig.build.json` hacia `dist/`, siguiendo el `outputs: ["dist/**"]` declarado en el `turbo.json` raíz. No hay override de `outputs` para `apps/api` — hereda el contrato genérico de paquete TypeScript.

**Precondición de independencia (ver decisión D4 del diseño).** `pnpm --filter <pkg> run <script>` evita la orquestación `dependsOn: ["^build"]` de Turborepo, pero **no** evita el grafo de paquetes: `@vaqcrow/contracts` y `@vaqcrow/domain` solo exponen `./dist/index.js` + `./dist/index.d.ts` (sin path aliases en `tsconfig.base.json`), así que `typecheck`, `test` y `build` filtrados en `apps/api` requieren que esos `dist/` ya existan de una corrida previa (la de la sección 3). Estos comandos demuestran que el scaffold de API está **estructuralmente separado**, no que sea reproducible de forma aislada desde un checkout limpio sin construir antes sus dependencias de workspace.

```sh
$ pnpm --filter @vaqcrow/api run lint
$ eslint .
# exit 0
```

```sh
$ pnpm --filter @vaqcrow/api run typecheck
$ tsc -p tsconfig.json --noEmit
# exit 0
```

```sh
$ pnpm --filter @vaqcrow/api run test
$ vitest run
 ✓ src/application/bootstrap-probe.test.ts (1 test)
 ✓ src/infrastructure/http/build-app.test.ts (8 tests)
 Test Files  2 passed (2)
      Tests  9 passed (9)
# exit 0
```

```sh
$ pnpm --filter @vaqcrow/api run build
$ tsc -p tsconfig.build.json
# exit 0
```

Los cuatro comandos anteriores corren de forma independiente de los scripts raíz de la sección 3 (invocación directa de `pnpm --filter`, sin pasar por `turbo run`) y sus resultados son consistentes con los ya vistos en el workspace completo.

## 5. Scaffold de Web (`@vaqcrow/web`)

> **Reproducido localmente, no verificado en CI.**

**Contrato de build.** `apps/web` compila con `next build` hacia `.next/`. A diferencia de `apps/api`, su `turbo.json` local sobrescribe `outputs` a `["dist/**", ".next/**", "!.next/cache/**", "!.next/dev/**"]` — el build de Next.js nunca produce `dist/`, pero el override conserva ese patrón por si en el futuro se agrega un paso de empaquetado adicional. **El build de la API y el build de la web no son evidencia equivalente**: uno es una compilación TypeScript directa (`tsc`), el otro es un pipeline de framework (`next build`) que además genera un resumen de rutas y hace prerendering estático.

**Misma precondición de independencia que en la sección 4 (D4):** `apps/web` también depende de `@vaqcrow/contracts` en `dist/`, así que los comandos filtrados de abajo asumen ese `dist/` ya construido.

```sh
$ pnpm --filter @vaqcrow/web run lint
$ eslint .
  fetch-http-client.ts — 1 warning (_request sin usar)
  freighter-wallet.ts  — 2 warnings (_xdr, _networkPassphrase sin usar)
✖ 3 problems (0 errors, 3 warnings)
# exit 0
```

```sh
$ pnpm --filter @vaqcrow/web run typecheck
$ tsc -p tsconfig.json --noEmit
# exit 0
```

```sh
$ pnpm --filter @vaqcrow/web run test
$ vitest run
 ✓ src/infrastructure/wallet/freighter-wallet.test.ts (3 tests)
 ✓ src/infrastructure/http/fetch-http-client.test.ts (2 tests)
 ✓ src/state/workspace-view-model.test.ts (3 tests)
 ✓ src/app/page.test.tsx (1 test)
 ✓ src/presentation/components/workspace-status.test.tsx (3 tests)
 Test Files  5 passed (5)
      Tests  12 passed (12)
# exit 0
```

```sh
$ pnpm --filter @vaqcrow/web run build
$ next build
▲ Next.js 16.3.5 (Turbopack)
✓ Compiled successfully in 383ms
Route (app)
┌ ○ /
└ ○ /_not-found
○  (Static)  prerendered as static content
# exit 0
```

Igual que en la sección 4, los cuatro comandos corren independientes de `turbo run` y sus resultados coinciden con los observados en el workspace completo.

## 6. Chequeos cross-boundary (contratos / dominio)

> **Reproducido localmente, no verificado en CI.**

### 6.1 Qué exporta cada paquete y qué tan validado está en runtime

| Export | Archivo | Qué es | Validación runtime | Consumidor |
|---|---|---|---|---|
| `correlationIdSchema`, `parseCorrelationId`, `generateCorrelationId`, `CorrelationId` | `packages/contracts/src/correlation-id.ts` ([#116](https://github.com/reyduar/Vaqcrow/issues/116)) | Contrato de protocolo: identificador de correlación validado con Zod (`z.uuidv4().brand<"CorrelationId">()`) | **Sí** | Cualquier consumidor que necesite generar o validar un identificador de correlación en un límite explícito |
| `describeWorkspace`, `WorkspaceProbe` | `packages/contracts/src/index.ts` | Placeholder de cableado de bootstrap (`{ name: string }`), sin reglas de negocio — **retirado por [#38](https://github.com/reyduar/Vaqcrow/issues/38)** | **No** | Único consumidor en su momento: `apps/api/src/application/bootstrap-probe.ts` (también retirado) |

El issue #37 describe `packages/contracts` como conteniendo "solo contratos validables en runtime". Esa afirmación es exacta para `correlation-id.ts`, pero **no** para `describeWorkspace`/`WorkspaceProbe`: era un objeto plano sin esquema ni parseo, cuya única función entonces era dejar que `apps/api` importe algo real desde `@vaqcrow/contracts` mientras el paquete madura. Este documento no repite esa afirmación como un hecho sobre el paquete completo — cada export se describe por separado, como exige la tabla de arriba.

`packages/domain` exponía entonces únicamente `isWorkspaceBootstrapped(packages: readonly string[]): boolean`, sin dependencias externas — eso es exactamente lo que la regla `domain-stays-framework-free` (ver sección 7) protegía: cero imports de npm en `packages/domain/src`.

> **Nota (post-#38):** los cuatro símbolos de probe citados en esta sección fueron retirados por el issue #38. packages/domain expone hoy el ciclo de revisión de solicitudes (ver domain-states-and-shared-contracts-evidence.md). Esta sección se conserva como registro de lo que el #37 probó, no como descripción del código actual.

### 6.2 Evidencia de pruebas por paquete

```sh
$ pnpm --filter @vaqcrow/contracts run test
$ vitest run
 ✓ src/index.test.ts (1 test)
 ✓ src/correlation-id.test.ts (6 tests)
 Test Files  2 passed (2)
      Tests  7 passed (7)
# exit 0
```

`src/correlation-id.test.ts` (6 tests) es la prueba directa del único export de `contracts` con validación runtime real; `src/index.test.ts` cubría `describeWorkspace` (test retirado junto con el símbolo en #38).

```sh
$ pnpm --filter @vaqcrow/domain run test
$ vitest run
 ✓ src/index.test.ts (2 tests)
 Test Files  1 passed (1)
      Tests  2 passed (2)
# exit 0
```

### 6.3 Cero violaciones de boundary sobre el código real

```sh
$ pnpm run boundaries
$ depcruise apps/*/src packages/*/src --config .dependency-cruiser.cjs
✔ no dependency violations found (44 modules, 49 dependencies cruised)
# exit 0
```

> **Alcance de la prueba:** este comando corre sobre el glob real (`apps/*/src packages/*/src`), no sobre los fixtures de prueba de las 9 reglas — esos fixtures y su cobertura FAIL/PASS por regla están documentados en [workspace-boundary-enforcement.md](./workspace-boundary-enforcement.md) (sección 7). Esta corrida confirma que el código de producción actual no dispara ninguna de las 9 reglas, no que las reglas detecten violaciones (eso ya lo prueba #36).

## 7. Qué aportan #35 y #36

- Ya establecido: `bootstrap-root-workspace.md` fijó pnpm 11.27.0, Node 24 y el alcance de 4 paquetes reales del workspace raíz, y validó los 6 criterios de aceptación del issue #35, incluida la instalación congelada y la orquestación raíz de Turborepo. Ver [bootstrap-root-workspace.md](./bootstrap-root-workspace.md) → sección "Verificación de los 6 criterios de aceptación del issue #35". Este documento no repite esa tabla; construye sobre esa base con evidencia independiente por app (secciones 4 y 5).
- Ya establecido: `workspace-boundary-enforcement.md` capturó `pnpm install --frozen-lockfile`, `pnpm run workspaces:list` (los 4 workspaces reales más el paquete raíz) y `turbo run build --dry=json` (grafo de dependencias de build: `api` depende de `contracts` y `domain`; `web` depende solo de `contracts`, nunca de `domain`). Ver [workspace-boundary-enforcement.md](./workspace-boundary-enforcement.md) → sección "Evidencia manual". Este documento no re-ejecuta esos tres comandos; los da por vigentes porque ningún cambio de esta iteración toca manifests, lockfile ni `turbo.json`.
- Ya establecido: las 9 reglas de `dependency-cruiser` quedaron fixture-probadas (FAIL y, donde aplica, PASS con exención `type-only`), incluyendo el riesgo aceptado de que `api-application-stays-provider-free` no tiene un patrón de regex dedicado para "Horizon". Ver [workspace-boundary-enforcement.md](./workspace-boundary-enforcement.md) → sección "Inventario de reglas y cobertura". Este documento agrega, en la sección 6.3, la confirmación de que el código de producción actual sigue en cero violaciones sobre esas 9 reglas.

## 8. Verificación de criterios de aceptación del #37

| # | Criterio | Resultado |
|---|---|---|
| 1 | La evidencia cubre una instalación congelada limpia y el grafo de workspace/Turborepo | ✅ PASS — referenciado en la sección 7, ya probado en #35/#36, no re-ejecutado porque nada de esta iteración toca manifests, lockfile ni `turbo.json` |
| 2 | La evidencia cubre `build`, `lint`, `typecheck` y `test` a nivel raíz | ✅ PASS — sección 3, 4 entradas independientes más `verify` |
| 3 | La evidencia cubre los scaffolds independientes de Fastify (API) y Next.js (web) | ✅ PASS — secciones 4 y 5, comandos `pnpm --filter` ejecutados por separado de los scripts raíz |
| 4 | La evidencia demuestra chequeos representativos de Clean Architecture/import-boundary, pasando y fallando, para ambas aplicaciones | ✅ PASS — cobertura FAIL/PASS por las 9 reglas ya documentada en #36 (sección 7); sección 6.3 confirma cero violaciones vigentes sobre el código real |
| 5 | La evidencia demuestra el límite permitido de `packages/contracts` y la prohibición de que web acceda a `packages/domain` | ✅ PASS — sección 6.1 (tabla de exports) y sección 6.3 (`web-never-imports-domain` dentro de las 9 reglas en cero violaciones) |
| 6 | Comandos, supuestos, limitaciones y redacciones son concisos y reproducibles | ✅ PASS — bloques de comando uniformes (sección 2), riesgos explícitos (sección 9), sin datos sensibles (ver redacción abajo) |

## 9. Riesgos y limitaciones aceptadas

- **Precondición de "independiente" (D4).** Los comandos `pnpm --filter <pkg> run {typecheck,test,build}` de las secciones 4 y 5 evitan la orquestación de Turborepo, pero siguen requiriendo que `@vaqcrow/contracts` y `@vaqcrow/domain` ya tengan su `dist/` construido. No demuestran reproducibilidad desde un checkout limpio sin pasar antes por `pnpm run build` (o el equivalente `turbo run build`) al menos una vez.
- **Riesgo "Horizon" heredado de #36, no revisitado aquí.** `api-application-stays-provider-free` sigue sin un patrón de regex dedicado para el cliente Horizon de Stellar; la cobertura actual depende de que todo acceso pase por `stellar-sdk`/`@stellar/`. Este riesgo ya fue aceptado explícitamente en `workspace-boundary-enforcement.md` y no se reabre en esta iteración porque ningún código de acceso a Horizon cambió.
- **Alcance local, no CI.** Como se indica en cada sección, no existe `.github/workflows/` en este repositorio; toda la evidencia de este documento es reproducción local, no verificación en un pipeline de integración continua.

## 10. Estado de entrega

- Cambio SDD `document-workspace-evidence` implementado como una sola unidad de trabajo (forecast de `sdd-tasks`: ~200-220 líneas autoradas, riesgo **Bajo** de presupuesto de 400 líneas, sin necesidad de encadenar PRs).
- Este documento (`document-workspace-evidence.md`) y la actualización de una línea en `demo-tasks-list.md` son los únicos archivos modificados; no se tocó código fuente, pruebas ni configuración.
- `pnpm run verify` corre en cero violaciones tras agregar este documento (sección 3, entrada de `verify`), confirmando que el cambio no afecta el comportamiento del workspace.
- Rama de trabajo: `Vaqcrow#37_Task_Document_evidence_for_the_pnpm_Turborepo_workspace`. El commit y la apertura del Pull Request son un paso explícito posterior a este documento, fuera del alcance de esta fase de implementación.

### Qué queda desbloqueado

Con #37 completo, el trabajo ejecutable de la Feature #11 (Inicializar el workspace pnpm/Turborepo) queda cerrado. Sus Features dependientes ([#12](https://github.com/reyduar/Vaqcrow/issues/12), [#14](https://github.com/reyduar/Vaqcrow/issues/14), [#15](https://github.com/reyduar/Vaqcrow/issues/15)) quedan libres de su bloqueo nativo por #11; [#16](https://github.com/reyduar/Vaqcrow/issues/16) sigue bloqueada además por #12.

### Próximos pasos sugeridos

1. Revisar y abrir el Pull Request de esta rama contra `main`.
2. Iniciar la siguiente unidad ejecutable del backlog según la política de orden de [demo-tasks-list.md](./demo-tasks-list.md): [#38 — Implementar estados de dominio y contratos compartidos](./demo-tasks-list.md#issue-38), primera Task de la Feature #12 (`Critical`, la de mayor prioridad entre las recién desbloqueadas).
3. Mantener la convención de este documento (comandos independientes por app, tabla de exports por archivo, referencias sin duplicación) para los próximos documentos de evidencia del backlog.
