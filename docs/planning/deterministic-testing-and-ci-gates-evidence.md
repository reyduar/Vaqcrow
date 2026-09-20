# Evidencia de cierre de la Feature #15 — Issue #49

> Documento de cierre de Feature. Consolida y cita la evidencia ya verificada de las Tasks [#47](https://github.com/reyduar/Vaqcrow/issues/47) y [#48](https://github.com/reyduar/Vaqcrow/issues/48), agrega únicamente lo que ninguna de las dos documenta (el mapeo contra los criterios de aceptación propios de la Feature #15 y de sus tres Tasks, los límites operativos vigentes como conjunto, y las correcciones aplicadas durante el ciclo), y no re-deriva los números que ya quedaron asentados en la bitácora de iteración. No reemplaza a `odd/tasks/deterministic-testing-and-ci-gates.md`, que sigue siendo la fuente de verdad de cómo se hizo el trabajo.

## 1. Contexto y objetivo

La Feature [#15](https://github.com/reyduar/Vaqcrow/issues/15) ("Feature: Set up deterministic testing and CI gates") pide configurar Vitest, Testing Library y Playwright como gates determinísticos de pull request, con dobles locales, comandos documentados, instalación congelada y sin dependencia de servicios externos vivos. Se entregó en tres Tasks, todas mergeadas y cerradas:

| Task | Issue | Entrega |
|---|---|---|
| Implementar | [#47](https://github.com/reyduar/Vaqcrow/issues/47) | PR [#176](https://github.com/reyduar/Vaqcrow/pull/176) — commits `d56f795`, `b9c4b23`, `d253e07`; merge `e3ca3e8` |
| Probar | [#48](https://github.com/reyduar/Vaqcrow/issues/48) | PR [#178](https://github.com/reyduar/Vaqcrow/pull/178) — commit `9054fbe`; merge `8883a55` |
| Documentar evidencia | [#49](https://github.com/reyduar/Vaqcrow/issues/49) | este documento |

Vitest y Testing Library ya existían de Features anteriores; #47 agregó lo que faltaba (Playwright, el workflow de CI y el doble local) y #48 probó los gates en sí mismos. La Feature se cerró manualmente el 20/09/2026 (GitHub no cierra Features al completarse sus sub-issues) y habilita [#20](https://github.com/reyduar/Vaqcrow/issues/20) y [#32](https://github.com/reyduar/Vaqcrow/issues/32).

## 2. Cómo leer esta evidencia

- **Cada resultado nombra su fuente.** Las filas de la sección 4 se re-ejecutaron en este árbol de trabajo o provienen de un run de CI citado con su URL. Nada se infiere.
- **Comandos.** Requieren Node 24: `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- **Reproducción local y en CI.** A diferencia de las Features anteriores a #15, este repositorio ya tiene `.github/workflows/ci.yml` y sus dos jobs corren en cada pull request; por eso la sección 4 cita runs de CI además de las re-ejecuciones locales.
- **Log de iteración.** `odd/tasks/deterministic-testing-and-ci-gates.md` es la bitácora de las tres Tasks: unidades de trabajo con hashes, ciclos RED→GREEN, decisiones, avisos y cómo se resolvió cada uno. Este documento la cita; no la reemplaza.

## 3. Qué quedó implementado

- **Configuración de Playwright.** `apps/web/playwright.config.ts`: solo Chromium, `workers: 1`, `fullyParallel: false`, `retries: 0`, `forbidOnly` atado a `process.env.CI`, `testDir: "./e2e"`, y un arreglo `webServer` de dos entradas (el doble local y `next dev`) cuyas verificaciones de disponibilidad son ambas loopback. La decisión es deliberada: un pase intermitente es un fallo, nunca algo que un reintento pueda tapar.
- **Doble local de API.** `apps/web/e2e/support/stub-api-server.mjs` sirve los contratos HTTP documentados de la demo desde literales congelados (sin `Date.now`, sin `Math.random`, sin `new Date`), con CORS y `POST /__reset` para aislar cada test. Escucha únicamente en `127.0.0.1`. Los esquemas de contrato son `strictObject`, así que el doble devuelve exactamente los campos del contrato: campos de conveniencia como `label` o `provenance` harían fallar la validación.
- **Suite de navegador.** `apps/web/e2e/guided-journey.spec.ts` (4 casos: redirección de entrada, chrome y progreso, recorrido de los seis pasos, round trip de la solicitud PyME contra el doble) y `apps/web/e2e/human-decision.spec.ts` (4 casos: sin preselección y con la IA como asesora, rechazo local, decisión registrada, y el path con `applicationId`).
- **Guard de hosts externos.** `apps/web/e2e/support/local-hosts.ts` contiene el predicado puro (`LOCAL_HOSTS`, `isLocalRequest`) y `local-only.ts` lo consume en un fixture automático que falla cualquier test cuyo navegador pida un host que no sea loopback. El predicado se extrajo a un módulo sin import de `@playwright/test` para que la suite raíz pueda importarlo: con los `node_modules` estrictos de pnpm, las dependencias de `apps/web` no resuelven desde la raíz del repositorio.
- **Workflow de CI.** `.github/workflows/ci.yml` corre en `pull_request` y en push a `main`, con `permissions: contents: read` y dos jobs que instalan con `pnpm install --frozen-lockfile`: `quality` ejecuta `pnpm run verify`; `e2e` instala Chromium y ejecuta `pnpm run test:e2e`.
- **Cableado de tareas.** `turbo.json` declara `test:e2e` con `dependsOn: ["^build"]` y `cache: false`; los `package.json` de la raíz y de `apps/web` exponen `test:e2e` y `test:e2e:install`. La dependencia `^build` existe porque el servidor de desarrollo resuelve `@vaqcrow/contracts` desde `dist/`; se verificó borrando `packages/*/dist` y volviendo a correr la suite.
- **Meta-tests de los gates (#48).** `tests/testing-and-ci-gates.test.ts` asevera sobre los propios artefactos del gate (workflow, configuración de Playwright, doble local, cableado de scripts y tareas, comandos documentados y el límite de `apps/web/e2e`), y ejerce el camino de rechazo del guard en lugar de sólo declararlo.

## 4. Qué quedó probado

| Verificación | Resultado observado | Fuente |
|---|---|---|
| `pnpm install --frozen-lockfile` | Exit 0 | Re-ejecutado en este árbol |
| `pnpm run verify` | Exit 0: lint, typecheck, test, build, boundaries, test:boundaries | Re-ejecutado en este árbol |
| Boundaries | `no dependency violations found (216 modules, 481 dependencies cruised)` | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/domain test` | 1 archivo, 60 tests | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/contracts test` | 5 archivos, 101 tests | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/api test` | 5 archivos, 61 tests | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/web test` | 59 archivos, 317 tests | Re-ejecutado en este árbol |
| `pnpm run test:boundaries` (suite raíz) | 3 archivos, 48 tests (23 previos + los 25 meta-tests de #48) | Re-ejecutado en este árbol, con #178 ya mergeado |
| `pnpm run test:e2e` | Exit 0, **8 tests** (~13 s) | Re-ejecutado en este árbol |
| `vitest run tests/testing-and-ci-gates.test.ts` | **25 tests**, tras un primer run RED que no resolvía `local-hosts.ts` | Árbol de trabajo de #48 |
| Run de CI `35479682438` (rama de #47) | `success` — `quality` 1m31s, `e2e` 1m13s | GitHub Actions |
| Run de CI `35485729460` (rama de #48) | `success` — `quality` 1m43s, `e2e` 1m7s | GitHub Actions |
| Run de CI `35486619602` (PR #179) | `success` — `quality` 1m51s, `e2e` 1m10s | GitHub Actions |
| Run de CI `35488208501` (PR #180) | `success` — `quality` 1m43s, `e2e` 59s | GitHub Actions |

## 5. Límites operativos vigentes

- **Ningún gate toca un servicio vivo.** Stellar Testnet, Horizon, Supabase y los proveedores LLM son inalcanzables desde el camino de pull request por construcción, y el guard convierte una llamada accidental en un test rojo. Ningún job referencia `secrets.` ni una URL externa.
- **El doble no es un backend.** `stub-api-server.mjs` existe sólo para los tests de navegador: no lo importa ningún código de aplicación y no se despliega. Los endpoints reales de solicitud PyME en `apps/api` siguen pendientes (Feature #18), y por eso los paths del gateway web siguen siendo marcadores documentados.
- **Chromium único.** Es una decisión de alcance explícita (`deploy-planning.md` §Parte 4); la cobertura multi-navegador queda fuera de la demo.
- **Sin umbrales de cobertura.** Los gates exigen que los tests pasen, no un porcentaje.
- **`tests/**` de la raíz no está cubierto por `turbo run lint`.** Ningún workspace incluye ese directorio, así que ESLint hay que correrlo explícitamente sobre esos archivos. Vale un seguimiento si se agregan más meta-tests de raíz.

## 6. Resultado visible en la demo

La Feature #15 no agrega comportamiento visible ni copy nuevo. El chrome de entorno que entregó la Feature #17 (`DEMO`, `TESTNET · Activos sin valor económico`) lo asevera la suite E2E, no lo modifica; los datos del doble llevan la etiqueta `SIMULADO` que la aplicación renderiza. El resultado visible de esta Feature es de proceso: cada pull request verifica lint, tipos, tests, build, boundaries y el recorrido de navegador sin tocar ningún servicio externo.

## 7. Correcciones aplicadas durante el ciclo

1. **Falso positivo en la aserción de determinismo del doble.** El primer run falló porque el regex de `Date.now` matcheaba el propio docstring del stub, que *describe* la regla. En lugar de debilitar la aserción, se agregó `withoutComments` (bloques y `//` de línea completa; el `//` inline se deja intacto para no truncar `http://127.0.0.1`).
2. **Conteo de archivos de test.** El README decía 72 y el número verificado era 74 (los dos que faltaban eran los tests de boundaries que la misma frase dice cubrir); corregido en el PR [#177](https://github.com/reyduar/Vaqcrow/pull/177). Pasó a 75 cuando #48 agregó un archivo, corregido en el mismo commit que lo invalidó.
3. **Afirmación falsa de estado.** El README y `demo-tasks-list.md` decían que #47 estaba "pausada hasta nuevo aviso"; corregido en el PR [#177](https://github.com/reyduar/Vaqcrow/pull/177) y cerrado del todo en el sync de roadmap ([PR #180](https://github.com/reyduar/Vaqcrow/pull/180)) cuando la Feature quedó completa.
4. **Idioma y estructura de este documento.** La primera versión se escribió en inglés y con la estructura §1–§9, siguiendo el documento de #62 — que es la excepción del corpus, no la convención. Se reescribió en español y con la estructura §1–§10 del resto de los documentos de evidencia, y la convención quedó explícita en `CLAUDE.md`/`AGENTS.md` para que no vuelva a depender de muestrear un solo archivo.

## 8. Mapeo de criterios de aceptación

Criterios citados verbatim de `gh issue view 15`, `47`, `48` y `49`.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | #15: "Commands are documented" | Cumplido | `README.md` §Stack y §Desarrollo y calidad documentan `pnpm run test:e2e:install` y `pnpm run test:e2e`; lo asevera el bloque "documented commands" de `tests/testing-and-ci-gates.test.ts` |
| 2 | #15: "CI uses frozen install" | Cumplido | Ambos jobs de `.github/workflows/ci.yml` usan `pnpm install --frozen-lockfile`; lo asevera el caso "installs with a frozen lockfile in every job that installs" |
| 3 | #15: "normal checks need no external services" | Cumplido | La suite E2E habla con el doble local; el fixture `externalRequestGuard` falla cualquier test que alcance un host no loopback; ningún job referencia `secrets.` ni una URL externa |
| 4 | #47: "Deterministic Playwright browser tests cover the issue-critical paths using local fixtures or doubles" | Cumplido | `guided-journey.spec.ts` y `human-decision.spec.ts` contra `stub-api-server.mjs`; controles de determinismo en la sección 3 |
| 5 | #47: "Pull request verification completes without requiring live external services" | Cumplido | Runs de CI `35479682438` y `35485729460`, ambos `success`; el guard lo hace exigible |
| 6 | #47: "Implementation evidence records the applicable skill or MCP support used—or `none`—before any Playwright-related manifest or lockfile mutation" | Cumplido | Sección 9, límite 1 |
| 7 | #48: "Deterministic coverage demonstrates the core behavior for Feature #15" | Cumplido | 25 meta-tests en `tests/testing-and-ci-gates.test.ts` sobre workflow, configuración, doble, cableado y docs |
| 8 | #48: "Rejection or failure behavior is covered where the feature has a safety boundary" | Cumplido | El camino de rechazo del guard se ejerce, incluidos hosts que sólo *contienen* una cadena loopback (`127.0.0.1.evil.com`, `localhost.evil.com`) |
| 9 | #48: "The test suite is reproducible without live external services" | Cumplido | No requiere red; el doble escucha en loopback |
| 10 | #49: "Evidence identifies Feature #15, the verification method, and the observed result" | Cumplido | Este documento: secciones 1, 4 y 8 |
| 11 | #49: "Evidence is reproducible and bounded to the feature" | Cumplido | Cada fila de la sección 4 nombra su comando o su run de CI; el alcance se limita a #15/#47/#48/#49 |
| 12 | #49: "Sensitive data and unsupported claims are excluded" | Cumplido | Escaneo de contenido sensible limpio; ningún secreto, PII, seed ni afirmación de producción |

## 9. Riesgos y limitaciones aceptadas

1. **Gate de skills/MCP, registrado antes de tocar el manifest.** Ningún skill de Playwright, testing de navegador, Next.js o CI está instalado, ni en los skills inyectados de la sesión ni en `.atl/skill-registry.md`: `skill_resolution: none`. De los servidores MCP conectados se usó **`context7`** para la documentación autoritativa de Playwright (configuración multi-`webServer`, `reuseExistingServer`, `baseURL`, semántica de reintentos en CI) antes de escribir `playwright.config.ts`. El servidor MCP `playwright` (`@playwright/mcp`) **no** está conectado, y agregarlo es trabajo de tooling local de la Fase 4 en `docs/architecture/deploy-planning.md` ("Sin issue — configuración local de entorno, no scope funcional de la demo"); el descubrimiento no autorizó ninguna dependencia ni configuración MCP ajena al alcance.
2. **Los meta-tests son aserciones de texto, no un parser.** Cubren la regresión realista (que alguien saque `--frozen-lockfile`, agregue un segundo navegador o meta un reloj en el doble). No son una defensa adversarial contra ofuscación deliberada; eso requeriría una verificación a nivel de AST.
3. **El E2E corre contra `next dev`, no contra un build de producción.** El gate valida comportamiento y el límite del doble local, no el bundle productivo. El build de preview de Vercel es una verificación aparte.
4. **Chromium único y sin umbrales de cobertura**, por decisión de alcance (sección 5).
5. **`tests/**` de la raíz queda fuera de `turbo run lint`** (sección 5).

## 10. Estado de entrega

- Feature #15 y sus tres Tasks (#47, #48, #49) están **CLOSED**; los PRs [#176](https://github.com/reyduar/Vaqcrow/pull/176), [#178](https://github.com/reyduar/Vaqcrow/pull/178) y [#179](https://github.com/reyduar/Vaqcrow/pull/179) están **MERGED** en `main`.
- Esta versión del documento se entrega en el cambio que hace explícita la convención de evidencia en `CLAUDE.md`/`AGENTS.md` y versiona `odd/`; no cambia ningún hecho ya asentado, sólo el idioma, la estructura y el estado de merge.
- Habilita [#20](https://github.com/reyduar/Vaqcrow/issues/20) (esquema y guardrails de IA) y [#32](https://github.com/reyduar/Vaqcrow/issues/32).
