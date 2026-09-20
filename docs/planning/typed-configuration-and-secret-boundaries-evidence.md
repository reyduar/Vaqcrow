# Evidencia de cierre de la Feature #14 — Issue #46

> Documento de cierre de Feature. Consolida y cita la evidencia ya verificada de las Tasks [#44](https://github.com/reyduar/Vaqcrow/issues/44) y [#45](https://github.com/reyduar/Vaqcrow/issues/45), agrega únicamente lo que ninguna de las dos documenta (el mapeo contra los criterios de aceptación propios de la Feature #14 y de sus tres Tasks, los límites operativos vigentes como conjunto, y las correcciones aplicadas durante el ciclo), y no re-deriva los números que ya quedaron asentados en las bitácoras de iteración. No reemplaza a `odd/tasks/typed-configuration-and-secret-boundaries.md` ni a `odd/tasks/typed-configuration-and-secret-boundaries-testing.md`, que siguen siendo la fuente de verdad de cómo se hizo el trabajo.

## 1. Contexto y objetivo

La Feature [#14](https://github.com/reyduar/Vaqcrow/issues/14) ("Feature: Establish typed configuration and secret boundaries") pide validar los valores de entorno y mantener los secretos de servidor fuera de los bundles de navegador y de los logs. Sus tres criterios de aceptación son: que la configuración faltante falle claramente, que el contexto Testnet sea explícito, y que los valores sensibles se redacten en los logs.

Se entregó en tres Tasks, todas mergeadas y cerradas:

| Task | Issue | Entrega |
|---|---|---|
| Implementar | [#44](https://github.com/reyduar/Vaqcrow/issues/44) | PR [#183](https://github.com/reyduar/Vaqcrow/pull/183) y PR [#184](https://github.com/reyduar/Vaqcrow/pull/184) — commits `ff35c05`, `887ce3d`, `0885b68`; merges `455a4cd` y `219a3d1` |
| Probar | [#45](https://github.com/reyduar/Vaqcrow/issues/45) | PR [#187](https://github.com/reyduar/Vaqcrow/pull/187) — commit `61a5de2`; merge `c8adefe` |
| Documentar evidencia | [#46](https://github.com/reyduar/Vaqcrow/issues/46) | este documento |

#44 se entregó como una **cadena de dos PRs apilados a `main`**: el contrato de configuración (slice 1, solo aditivo, sin efecto de runtime) y el cableado del proceso sobre esa configuración validada (slice 2, con cambio de comportamiento). El corte no fue cosmético: el slice 1 no tiene superficie de rollback porque nada lo importa todavía, y eso se verificó stasheando el slice 2 antes de correr el gate, no afirmándolo.

La Feature se cierra manualmente al terminar #46 (GitHub no cierra Features al completarse sus sub-issues, mismo patrón que #11, #12, #13, #15, #16, #17, #18 y #19). Al cerrarse habilita [#23](https://github.com/reyduar/Vaqcrow/issues/23) (encapsular la integración de Stellar y Freighter).

## 2. Cómo leer esta evidencia

- **Cada resultado nombra su fuente.** Las filas de la sección 4 se re-ejecutaron en este árbol de trabajo, o provienen de un run de CI citado con su identificador, o se midieron en el árbol de trabajo de la Task que las produjo — y cada fila dice cuál. Nada se infiere.
- **Comandos.** Requieren Node 24: `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`.
- **Estado de merge.** Los tres PRs (#183, #184, #187) están **MERGED**; el estado de `main` sobre el que se re-ejecutó la sección 4 es `c8adefe`.
- **Bitácoras de iteración.** Los dos archivos de `odd/tasks/` son la bitácora de las tres Tasks: unidades de trabajo con hashes, ciclos RED→GREEN, decisiones, avisos y cómo se resolvió cada uno. Este documento las cita; no las reemplaza.

## 3. Qué quedó implementado

Todo el contrato vive en `apps/api/src/application/config/`, con cero imports de proveedor, y se cablea desde `infrastructure/`. La ubicación es deliberada: `packages/config` está autorizado pero **no construido** en `docs/architecture/monorepo.md`, y `packages/contracts` debe seguir siendo portable a consumidores de navegador, así que un contrato orientado a Node no pertenece a ninguno de los dos.

- **Envoltura `Secret`.** `secret.ts` define una clase cuyo campo `#value` es privado, con `reveal()` como único acceso crudo y `toJSON()`/`toString()` colapsando al marcador `[redacted]`. Un `console.log` de la configuración entera imprime `Secret {}`, no la credencial.
- **Fallo agregado y sin valores.** `config-issue.ts` define `ConfigIssue` y `ConfigurationError`. El reporte nombra claves y expectativas y **nunca repite un valor**: un entorno vacío reporta las cuatro claves requeridas en un solo error, y una credencial inválida no queda impresa por el propio error que la reporta.
- **Parsers puros.** `env-source.ts` define `EnvSource` y `ParseResult`; los parsers leen de un registro inyectado y nunca tocan `process.env`, así que los tests ejercen configuraciones hostiles sin mutar estado global.
- **Entorno y red como conjuntos cerrados.** `api-config.ts` requiere `APP_ENV` y lo cierra a `local | ci | preview | demo`, rechazando `production` como `unsupported` con el motivo nombrado (la fila "Producción futura" de `DEMO.md` codificada en el límite). `stellar-config.ts` requiere `STELLAR_NETWORK` y lo cierra a `testnet`: un guard que se puede saltear por omisión no es un guard.
- **Guard de Horizon.** `STELLAR_HORIZON_URL` es opcional (por defecto el host canónico de Testnet) pero, si se declara, solo puede resolver al host de Testnet o a loopback, con `http` permitido únicamente en loopback para un doble local.
- **Redacción de logs en dos redes.** `redaction.ts` enmascara por **estructura** (`Secret`, o cualquier valor bajo una clave con forma de credencial) y por **contenido** (JWT, seed de Stellar, credencial opaca dentro de texto libre), con tope de profundidad. Preserva deliberadamente los identificadores de trazabilidad (`correlationId`, `applicationId`, UUID con guiones).
- **El adaptador recibe configuración validada, no entorno crudo.** `createSupabaseClient(config)` llama a `reveal()` en el único punto de uso, así que una credencial no puede llegar a `createClient` sin haber cruzado el límite `Secret`.
- **Arranque fail-fast.** `index.ts` parsea una sola vez con `parseApiConfig(process.env)` y pasa el resultado congelado hacia abajo.
- **Superficie documentada.** `.env.example` declara las claves requeridas y la restricción de red.

Lo que agregó #45 son pruebas, no comportamiento: el límite del navegador (`tests/config-secret-boundaries.test.ts`) y la matriz exhaustiva más la integración parse→redact (`apps/api/src/application/config/config-matrix.test.ts`). El único cambio en un archivo de producción en #45 es un **comentario** en `redaction.ts` que registra que todavía no tiene consumidor.

## 4. Qué quedó probado

| Verificación | Resultado observado | Fuente |
|---|---|---|
| `pnpm run verify` | Exit 0: lint, typecheck, test, build, boundaries, test:boundaries | Re-ejecutado en este árbol sobre `c8adefe` |
| Boundaries | `no dependency violations found (222 modules, 512 dependencies cruised)` | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/domain test` | 1 archivo, 60 tests | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/contracts test` | 5 archivos, 101 tests | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/api test` | 8 archivos, 163 tests (91 al cerrar #44 + 72 de la matriz de #45) | Re-ejecutado en este árbol |
| `pnpm --filter @vaqcrow/web test` | 59 archivos, 317 tests | Re-ejecutado en este árbol |
| `pnpm run test:boundaries` (suite raíz) | 4 archivos, 52 tests (48 antes de #45 + 4 del límite del navegador) | Re-ejecutado en este árbol |
| `vitest run src/application/config` al cerrar #44 | 2 archivos, 32 tests | Árbol de trabajo de #44 |
| `vitest run src/application/config` al cerrar #45 | 3 archivos, 104 tests | Árbol de trabajo de #45 |
| **Mutation test del límite del navegador** | Con un archivo cebo en `apps/web/src` leyendo `process.env["SUPABASE_SERVICE_ROLE_KEY"]`, los **dos** tests del límite fallan nombrando archivo y clave; retirado el cebo, vuelven a verde | Árbol de trabajo de #45 |
| Verificación sobre el artefacto compilado | `node --env-file=.env.local` contra `apps/api/dist` → `ACCEPTED` (`environment: local`, `network: testnet`, config congelada); entorno vaciado → un solo `ConfigurationError` con las 4 claves faltantes | `apps/api/dist`, re-ejecutado |
| Run de CI `35520508253` (PR #183, `ff35c05`) | `success` | GitHub Actions |
| Run de CI `35520852112` (PR #183 final, `455a4cd`) | `success` | GitHub Actions |
| Run de CI `35520521992` (PR #184, `887ce3d`) | `success` | GitHub Actions |
| Run de CI `35520676525` (PR #184 final, `0885b68`) | `success` | GitHub Actions |
| Run de CI `35524296653` (PR #187, `61a5de2`) | `success` | GitHub Actions |
| Run de CI `35522470087` (push a `main`, `3b9a82e`) | `success` | GitHub Actions |
| Run de CI `35524603484` (push a `main`, `c8adefe`) | `success` | GitHub Actions |
| Escaneo local de patrones sobre este documento | Sin hallazgos: sin `sb_secret`/`sb_publishable`, sin JWT, sin URL de proyecto Supabase, sin seed de Stellar, sin bloque de clave privada. El único match del patrón de 40+ caracteres es un fragmento de ruta (`apps/api/src/infrastructure/supabase/create`), no un token. El escáner de secretos de GitHub no está disponible porque el repositorio no tiene Advanced Security, así que este resultado proviene de un escaneo de patrones ejecutado localmente, no del escáner de la plataforma | Re-ejecutado en este árbol |

El límite del navegador no se declara: se **ejerce**. Los dos tests que lo cubren pasaban al primer intento, lo que no prueba nada, así que se rompieron a propósito con un archivo cebo y se confirmó que fallan nombrando el archivo y la clave ofensores. Además los tests **derivan su propia entrada** del contrato de configuración de la API (leen los literales de clave que se pasan a `readPresent`/`requirePresent`), y dos tests más verifican que los escáneres encuentran algo — un detector que deja de matchear en silencio es el modo de falla real.

## 5. Límites operativos vigentes

- **`redactForLog` todavía no tiene consumidor en producción.** La API corre con el logger de Fastify deshabilitado (`logger: false`), así que el punto de cableado pertenece a la Feature [#31](https://github.com/reyduar/Vaqcrow/issues/31) (resiliencia y telemetría). El impacto actual es cero, y el contrato queda probado para que ese paso tenga una frontera verificada a la que llamar en lugar de una que inventar. Está anotado en el propio `redaction.ts` para que no se lo retire como código muerto.
- **La passphrase de red queda enmascarada.** `isSensitiveKey` normaliza `networkPassphrase` a `networkpassphrase`, que contiene `passphrase`, así que la heurística la enmascara. No es un descuido: una heurística de nombres no puede distinguir una passphrase pública de red de una secreta, y errar hacia enmascarar es el default correcto — la misma decisión que mantiene una passphrase real fuera de un log. El criterio de la Feature se sostiene igual, porque la identidad de red sobrevive en `network` y `horizonUrl`. Una allowlist de constantes publicadas es una decisión de #31, cuando exista una línea de log real para inspeccionar.
- **El límite del navegador se aplica en el código fuente, no en un bundle construido.** Una verificación que construya el bundle y lo escanee sería más fuerte, pero metería un build de web dentro de una suite unitaria que corre en cada pull request. La regla de fuente es el proxy exigible: Next.js solo inlinea `NEXT_PUBLIC_*`, y la regla prohíbe que se lea cualquier otra cosa. La verificación a nivel de bundle sigue pendiente.
- **`tests/**` de la raíz no pasa por typecheck ni lint.** No hay `tsconfig.json` raíz, y `turbo run lint` / `turbo run typecheck` solo recorren workspaces; el archivo nuevo de la suite raíz **se ejecuta** vía `test:boundaries` pero nunca se analiza estáticamente. Es un hueco del gate y merece su propio issue; no se expandió el alcance acá.
- **`test:integration` no se ejecutó.** Es una suite con credenciales que escribe contra Supabase vivo y está deliberadamente excluida de `pnpm run test`, `pnpm run verify` y de cualquier gate de CI. Se actualizó al parser nuevo y está cubierta por `typecheck`, pero **no existe un resultado en vivo y este documento no lo declara**.
- **Sin umbrales de cobertura.** Los gates exigen que los tests pasen, no un porcentaje. Decisión heredada del repositorio, no de esta Feature.

## 6. Resultado visible en la demo

La Feature #14 no agrega comportamiento visible ni copy nuevo. Su resultado es de proceso: el proceso de la API ya no puede arrancar con una configuración incompleta, ambigua o fuera de alcance, y una credencial no puede alcanzar un cliente de proveedor sin cruzar la frontera `Secret`.

Hay una consecuencia operativa real que conviene dejar asentada: **el arranque local ahora exige dos claves nuevas**, `APP_ENV` y `STELLAR_NETWORK`, y sin ellas `pnpm --filter @vaqcrow/api dev` falla con un error que las nombra a todas. Se verificó contra el archivo `.env.local` real del entorno de desarrollo — con las dos claves agregadas, el parser lo acepta; con el entorno vaciado, falla una sola vez listando las cuatro claves requeridas. La suite de integración no se ve afectada porque parsea solo el slice de Supabase.

## 7. Correcciones aplicadas durante el ciclo

1. **Un test preexistente que el relevamiento no había leído.** Al cambiar el parámetro del adaptador de `ProcessEnv` a `SupabaseConfig`, `pnpm run typecheck` falló con 6 errores `TS2353` en `apps/api/src/infrastructure/supabase/create-supabase-client.test.ts`, un archivo que ya existía y que el recon no había leído. Un listado de archivos no es un relevamiento. La cobertura se **re-apuntó, no se perdió**: el test ahora prueba el pipeline completo (clave faltante ⇒ fallo claro y `createClient` nunca llamado) y además que la configuración parseada no filtra la clave por `JSON.stringify`.
2. **Una instrucción falsa en la bitácora de #44.** El log indicaba retargetear #184 a `main` y rebasear antes de mergear. Eso no ocurrió: #184 mergeó primero en su rama padre y #183 llevó ambas a `main`. El resultado fue correcto, pero la instrucción quedaba colgada y era falsa para quien la leyera después. Se corrigió el encuadre: la propiedad a verificar es que **los commits del hijo sean alcanzables desde `main`** (`git merge-base --is-ancestor`), no el orden en que se hicieron los merges.
3. **Un defecto de redacción encontrado por el RED de #45.** `redactForLog` enmascara `networkPassphrase`. Se resolvió **sin debilitar la heurística** — habría sido cambiar la implementación para complacer al test. El test afirma el comportamiento observado y, sobre todo, el criterio que la Feature realmente necesita (sección 5, límite 2).
4. **Tres expectativas de test equivocadas en #45**, detectadas por el propio run antes de que llegaran a revisión: un bloque `PORT` que afirmaba aceptación bajo un nombre que decía "rechaza", `preview` listado como inválido aunque es un entorno soportado, y la mayoría de las URL de Horizon esperadas como `invalid` cuando el código devuelve correctamente `unsupported`. Se corrigieron las expectativas, no la implementación.
5. **Adyacente, no parte de esta Feature.** El sync del roadmap que registró la entrega de #44 se hizo contra una consulta verificada al Project #4 y no contra el grafo de dependencias: 68 `Backlog` / 3 `Ready` / 37 `Done` en ese momento, con **#14, #26 y #83** como unidades `Ready`. Dos afirmaciones del documento eran falsas y se corrigieron: el banner nombraba a #44 como única `Ready` —cuando ya estaba `Done`— y los conteos seguían en `72 / 1 / 35`. Después, **promover #45 a `Ready` para poder trabajar en ella volvió a dejar el documento desactualizado**, y se re-sincronizó a 67 `Backlog` / 4 `Ready` / 37 `Done` en el PR de #45. De paso, un script que compara el `Workflow` de las 108 entradas contra la consulta al tablero encontró una discrepancia preexistente —[#134](https://github.com/reyduar/Vaqcrow/issues/134), cuyo issue está cerrado y cuyo item está `Done`, aunque sus criterios siguen sin marcar y no hay evidencia de implementación versionada—, que quedó registrada con esa tensión explícita en lugar de resuelta por inferencia.

## 8. Mapeo de criterios de aceptación

Criterios citados verbatim de `gh issue view 14`, `44`, `45` y `46`.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| 1 | #14: "Missing config fails clearly" | Cumplido | `parseApiConfig` acumula todas las claves ofensivas y lanza un solo `ConfigurationError`; el reporte nunca repite un valor. Sección 3; matriz de claves requeridas ausentes y en blanco en `config-matrix.test.ts` |
| 2 | #14: "Testnet context is explicit" | Cumplido | `STELLAR_NETWORK` es requerido y está cerrado a `testnet`; `APP_ENV=production` se rechaza como `unsupported`; el guard de Horizon solo admite el host de Testnet o loopback. Secciones 3 y 4 |
| 3 | #14: "sensitive log values are redacted." | Cumplido | Dos redes independientes (estructura y contenido), con `Secret.reveal()` como único acceso crudo. Sección 3; integración parse→redact y serialización en `config-matrix.test.ts`; límite 1 de la sección 5 declara que aún no tiene consumidor |
| 4 | #44: "Implement the core behavior and contract for this feature." | Cumplido | Contrato completo en `apps/api/src/application/config/`, cableado desde `infrastructure/`. Sección 3; PRs #183 y #184 |
| 5 | #44: "Evidence is reproducible and bounded." | Cumplido | Cada fila de la sección 4 nombra su comando, su run de CI o el árbol donde se midió |
| 6 | #44: "No secrets, PII or unsupported production claims are introduced." | Cumplido | Toda fixture es sintética y literal; el escaneo de la sección 4 no encuentra material sensible; `production` se rechaza en el código y no se declara soporte |
| 7 | #45: "Deterministic coverage demonstrates the core behavior for Feature #14." | Cumplido | 72 tests de matriz en `config-matrix.test.ts` (aceptación, rechazo, fallback, pureza e integración parse→redact) más 4 del límite del navegador |
| 8 | #45: "Rejection or failure behavior is covered where the feature has a safety boundary." | Cumplido | Cada clave requerida ausente y en blanco; `APP_ENV`, `LOG_LEVEL` y `STELLAR_NETWORK` contra su conjunto hostil completo; Horizon separado entre `unsupported` e `invalid`; el límite del navegador **probado por mutación** |
| 9 | #45: "The test suite is reproducible without live external services." | Cumplido | Toda fixture es un literal y ningún test hace I/O; las 7 filas de CI de la sección 4 corren sin tocar Testnet, Horizon, Supabase ni un proveedor LLM |
| 10 | #46: "Evidence identifies Feature #14, the verification method, and the observed result" | Cumplido | Este documento: secciones 1, 4 y 8 |
| 11 | #46: "Evidence is reproducible and bounded to the feature" | Cumplido | Cada fila de la sección 4 nombra su fuente; el alcance se limita a #14, #44, #45 y #46 (lo adyacente está marcado como tal en la sección 7) |
| 12 | #46: "Sensitive data and unsupported claims are excluded" | Cumplido | Escaneo de contenido sensible limpio; ninguna afirmación de producción; el único resultado externo no ejecutado (`test:integration`) se declara como no ejecutado |

## 9. Riesgos y limitaciones aceptadas

1. **Gate de skills/MCP, registrado antes de tocar cualquier manifest o lockfile.** Para #44 y #45 **no se mutó ningún manifest ni lockfile** y no se agregó ninguna dependencia: las pruebas usan Vitest, ya presente. Registrado como `skill_resolution: none`, `mcp_support: none`. No se usó ningún skill de Stellar, porque la unidad no contiene trabajo de Stellar. Como referencia de estado: el paquete de skills de Stellar Foundation se instaló a nivel de proyecto en un chore separado ([PR #186](https://github.com/reyduar/Vaqcrow/pull/186)), que **no** forma parte de esta Feature.
2. **El guard de Horizon se apoya en el nombre de host, no en la identidad de red.** Verifica que un endpoint *resuelva* al host de Testnet o a loopback; no valida la red por sí mismo. Un homónimo DNS malicioso con el host correcto no queda cubierto por esta regla, aunque tampoco lo estaría por ninguna verificación basada en URL. Queda como riesgo aceptado del alcance de demo.
3. **La heurística de redacción es de nombres y formas, no un clasificador.** Cubre la regresión realista (que un `Secret` llegue a un log, que se agregue un JWT a mano en un mensaje) pero no es una defensa adversarial. Sobre-redacta de más antes que de menos, y eso incluye la passphrase pública de Testnet (sección 5, límite 2).
4. **El contrato de configuración vive en `apps/api`, no en un paquete compartido.** Es una decisión de alcance explícita, no un olvido: `packages/config` está autorizado pero no construido. Si un segundo consumidor necesita la misma validación, moverlo será un cambio deliberado y no una consecuencia.
5. **Los límites de la sección 5 son aceptados, no resueltos:** `redactForLog` sin consumidor hasta #31, verificación a nivel de bundle pendiente, y `tests/**` de la raíz fuera del análisis estático.

## 10. Estado de entrega

- **#44** y **#45** están **CLOSED**; los PRs [#183](https://github.com/reyduar/Vaqcrow/pull/183), [#184](https://github.com/reyduar/Vaqcrow/pull/184) y [#187](https://github.com/reyduar/Vaqcrow/pull/187) están **MERGED** en `main`, cuyo estado verificado es `c8adefe`.
- **#46** se cierra con este documento. **La Feature #14 queda pendiente de cierre manual** en el momento de escribir esto: GitHub no la cierra al completarse sus sub-issues, igual que ocurrió con las Features #11, #12, #13, #15, #16, #17, #18 y #19. Se cerrará al mergear este PR, no antes.
- `docs/planning/demo-tasks-list.md` **no se toca en este cambio**, siguiendo el precedente de #62 y #179: el sync del roadmap pertenece a un commit posterior, cuando la Feature esté efectivamente cerrada.
- Al cerrarse, esta Feature habilita [#23](https://github.com/reyduar/Vaqcrow/issues/23) (encapsular la integración de Stellar y Freighter), que es la que consume el contexto de Testnet que #14 dejó explícito y validado.
