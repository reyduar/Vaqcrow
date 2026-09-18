# Evidencia de cierre de la Feature #13 — Issue #43

> Documento de cierre de Feature. No implementa ni re-deriva evidencia nueva: consolida y cita la evidencia ya verificada de los issues [#41](https://github.com/reyduar/Vaqcrow/issues/41) y [#42](https://github.com/reyduar/Vaqcrow/issues/42), y agrega únicamente lo que ninguno de los dos documenta (los límites operativos vigentes como conjunto, el encuadre estrictamente futuro del resultado visible en la demo, las correcciones aplicadas durante el ciclo y el mapeo contra los criterios de aceptación propios del #43). No reemplaza a las observaciones de Engram `sdd/supabase-schema-and-persistence/verify-report` (obs #475) ni `sdd/test-supabase-schema-and-persistence/verify-report` (obs #491); ambas siguen siendo la fuente de verdad de lo que cada Task probó.

## 1. Contexto y objetivo

El issue [#43](https://github.com/reyduar/Vaqcrow/issues/43) ("Task: Document evidence for the Supabase schema and persistence") es la tercera y última Task de la Feature [#13](https://github.com/reyduar/Vaqcrow/issues/13) ("Feature: Create Supabase schema and idempotent persistence"), derivada de `docs/planning/DEMO.md`. Las otras dos Tasks ya están completas y mergeadas a `main`:

- [#41](https://github.com/reyduar/Vaqcrow/issues/41) ("Implementar el esquema Supabase y la persistencia") en una cadena stacked-to-main de PRs [#148](https://github.com/reyduar/Vaqcrow/pull/148) (merge `33aa8cc`) y [#149](https://github.com/reyduar/Vaqcrow/pull/149) (mergeada contra la rama de #148, no directamente contra `main`); el hueco se cerró con [#150](https://github.com/reyduar/Vaqcrow/pull/150) (merge `666eb1b`), que llevó el adaptador y sus tests a `main` (ver §5, límite 5, y §7, corrección 2).
- [#42](https://github.com/reyduar/Vaqcrow/issues/42) ("Probar el esquema Supabase y la persistencia") en PRs [#151](https://github.com/reyduar/Vaqcrow/pull/151) (merge `ece1062`, commit de contenido `05ffc7e`) y [#152](https://github.com/reyduar/Vaqcrow/pull/152) (merge `0a67ae3`, commit de contenido `a8a84fc`).

El objetivo de este documento es dar a un revisor un único punto de entrada que confirme el cierre de la Feature #13: qué quedó implementado, qué quedó probado, qué límites operativos siguen vigentes hoy y qué resultado, todavía futuro, respaldará esta evidencia en la demo. Es un cambio **solo de documentación**: cero diff de código de producción, cero reescritura de tests, cero migración nueva.

## 2. Cómo leer esta evidencia

- **Regla de citación.** §3 y §4 citan, nunca re-derivan; cada cifra lleva su `obs #NNN` en la misma viñeta o fila. La única corrida nueva es el gate de regresión de §4.1, que no es fuente de cifras.
- **Autoría nueva.** §5, §6, §7, §8, §9 y §10 son autoría de este documento: ninguna de las dos evidencias previas enumera los límites operativos como conjunto, encuadra el resultado como futuro, lista las correcciones del ciclo ni mapea los criterios de aceptación del #43.
- **Formato.** Comandos en bloques ```sh``` con `$ <comando>` seguido de su salida real.
- **Reproducción local, no CI.** No existe `.github/workflows/`; toda la evidencia es reproducción local bajo `nvm use v24.21.0` (`engines: ">=24.0.0 <25.0.0"` en el `package.json` raíz). La suite de integración además exige credenciales reales que no viven en el repositorio.

## 3. Qué quedó implementado

Citado de `sdd/supabase-schema-and-persistence/verify-report` (obs #475) y de la corrección de archivo `sdd/supabase-schema-and-persistence/archive-report` (obs #477), sin re-derivar:

- `supabase/migrations/20260918114635_create_application_review.sql` crea `public.application_review` en una única migración atómica: `application_id uuid primary key`, `state text not null` con el CHECK `application_review_state_check` que enumera los 6 estados del ciclo (`draft`, `awaiting_assessment`, `human_review`, `approved`, `changes_requested`, `rejected`), `last_correlation_id uuid not null`, `created_at`/`updated_at timestamptz not null default now()` (obs #475).
- El trigger `application_review_set_updated_at` (`before update ... for each row`) ejecuta `public.set_application_review_updated_at()`, declarada `security invoker` y con `set search_path = ''`: mantiene `updated_at` del lado del servidor y nunca escala privilegios (obs #475).
- Control de acceso en la misma migración que el `create table`: `alter table ... enable row level security`, `revoke all on public.application_review from anon, authenticated` y `grant select, insert, update on public.application_review to service_role`. **Cero políticas RLS** — ver §5, límite 2, para qué capa deniega realmente (obs #475).
- Repetibilidad de la migración verificada **por ejecución**, no sólo por lectura: la migración se aplicó dos veces contra el proyecto Supabase en vivo, ambas con `success: true` y estado final idéntico; `list_tables` confirmó `public.application_review` con `rls_enabled: true` y 0 filas tras ambas corridas, sin errores de objeto duplicado (obs #477).
- `apps/api/src/application/ports/application-review-repository-port.ts` define el puerto `ApplicationReviewRepositoryPort` (`create` / `findById` / `transition`) sobre un `Result` discriminado `{ ok: true, value } | { ok: false, error }`, con el vocabulario cerrado de errores `not_found | state_conflict | already_exists | invalid_state | unavailable` y `actualState` poblado sólo en `state_conflict`. El puerto no importa `@supabase/supabase-js`, ni siquiera como tipo (obs #475).
- `apps/api/src/infrastructure/adapters/supabase-application-review-repository.ts` implementa el puerto. `transition()` emite un UPDATE condicional (`.eq("application_id", …).eq("state", from)`) con `.select()`: una fila devuelta ⇒ `applied: true`; cero filas ⇒ `resolveZeroRowTransition()` hace un SELECT de desambiguación y devuelve `applied: false` si la fila ya está en el estado destino (replay idempotente) o `state_conflict` con `actualState` si está en otro (obs #475).
- Saneamiento de errores en `toRepositoryError()`: `23505 → already_exists`, `23514 → invalid_state`, y todo lo demás — incluido `42501` — cae en `unavailable`. `message`, `details` y `hint` se registran sólo en el log interno y nunca cruzan hacia el llamador (obs #475).
- `apps/api/src/infrastructure/supabase/create-supabase-client.ts` expone `createSupabaseClient()` (service role) y, desde el #42, `createPublishableSupabaseClient()` (clave publicable), ambos con `auth: { persistSession: false }` y validación explícita de variables de entorno (obs #490).
- Frontera de arquitectura intacta: la regla `api-application-stays-provider-free` de `.dependency-cruiser.cjs` sigue vigente; el adaptador vive en `infrastructure/` y `pnpm run boundaries` pasa sin violaciones — **132 módulos / 267 dependencias** (obs #475).
- Huella mínima de datos: las 5 columnas mapean a `ApplicationId`, estado y trazabilidad; ninguna guarda PII (obs #475).
- Cobertura unitaria del #41: **13 tests** en `supabase-application-review-repository.test.ts` contra un fake client escrito a mano; suite completa de `@vaqcrow/api` en **24/24 (3 archivos)** tras el #41 (obs #475).
- Dependencia fijada de forma exacta: `@supabase/supabase-js` `2.116.0` en `apps/api/package.json`, con lockfile commiteado (obs #490).

## 4. Qué quedó probado

Citado de `sdd/test-supabase-schema-and-persistence/verify-report` (obs #491), de `sdd/test-supabase-schema-and-persistence/apply-progress` (obs #490) y de la corrida en vivo confirmada por el usuario (obs #488), sin re-derivar:

> `apps/api/tests/integration/application-review-persistence.integration.test.ts` (220 líneas) contiene **7 bloques `it(...)` que cubren los 9 requisitos del spec del #42**. No son 9 tests: siete requisitos tienen un bloque dedicado cada uno, y los dos restantes — el aislamiento por IDs sintéticos con limpieza y la ejecución gateada por credenciales fuera del comando `test` por defecto — los prueba el propio arnés (los hooks `afterEach`/`afterAll` y el `describe.skipIf`), no un bloque `it(...)` aparte (obs #490, obs #491).

| # | Requisito del spec (#42) | Cómo se cubre |
|---|---|---|
| 1 | Success Path Persists and Transitions | bloque 1: `create` → `findById` → `transition draft→awaiting_assessment` con `applied: true` |
| 2 | Non-Privileged Access Is Denied | bloque 2: `select`/`insert`/`update` con cliente publicable, `error?.code === "42501"` exacto en los tres |
| 3 | CHECK Constraint Rejects Invalid State | bloque 3: insert crudo → HTTP `400` + `23514`; vía adaptador → `{ code: "invalid_state" }`; cero residuo en ambos |
| 4 | `updated_at` Trigger Fires on Update | bloque 6: `selectUpdatedAt()` antes/después, `updatedAtAdvanced(...)` estricto |
| 5 | Conditional Update Is Idempotent on Replay | bloque 7: dos `transition()` con el par `{from:"draft", to:"awaiting_assessment"}` idéntico → `applied:false` y `updated_at` sin cambios |
| 6 | Conditional Update Detects State Conflict | bloque 5: `from` obsoleto → `{ code: "state_conflict", actualState: "awaiting_assessment" }` |
| 7 | Duplicate Primary Key Is Rejected | bloque 4: segundo `create` con el mismo id → `{ code: "already_exists" }`, fila original intacta |
| 8 | Test Isolation via Synthetic IDs and Cleanup | arnés: `syntheticApplicationId()` + `afterEach` de borrado en lote + `afterAll` de barrido del rango reservado |
| 9 | Credential-Gated, Non-Default Execution | arnés: `describe.skipIf(!hasIntegrationCredentials())` + `vitest.integration.config.ts` separado |

- Los tres archivos del arnés: `apps/api/tests/integration/support/synthetic-id.ts` (rango reservado `deadbeef-0000-4000-8000-000000000000` … `deadbeef-0000-4000-8000-ffffffffffff`, registro en un `Set` de módulo), `apps/api/tests/integration/support/integration-clients.ts` (gate de credenciales, ambos clientes, hooks de limpieza, comparadores estrictos de `updated_at`) y `apps/api/vitest.integration.config.ts` (config separada con `loadEnv`), más el script `test:integration` en `apps/api/package.json` (obs #490).
- **Corrida en vivo confirmada.** El usuario ejecutó `pnpm --filter @vaqcrow/api test:integration` con credenciales reales en un `.env.local` local y gitignoreado, y confirmó todos los casos en verde: la denegación `42501`, el rechazo del CHECK, el disparo del trigger, el replay idempotente y la detección de conflicto quedaron probados contra el Postgres/PostgREST real, no sólo revisados estáticamente (obs #488).

| Comando | Resultado observado | Fuente |
|---|---|---|
| `typecheck` | exit 0 | obs #491 |
| `lint` | 0 errores / 0 warnings | obs #491 |
| `test` | **27/27, 3 archivos** | obs #491 |
| `test:integration` (sin credenciales) | **7/7 saltados, exit 0** | obs #491 |
| `boundaries` | 0 violaciones — 132 módulos / 267 dependencias | obs #491 |

- Aislamiento de la suite por defecto: `vitest.config.ts` sólo incluye `src/**/*.test.ts`, así que `pnpm --filter @vaqcrow/api test` nunca descubre `tests/integration/` — confirmado con el conteo idéntico antes y después de agregar el archivo (obs #490).

### 4.1 Gate de regresión de este cambio (no es evidencia nueva)

```sh
$ export PATH="$(brew --prefix node@24)/bin:$PATH"
$ node -v
v24.21.0
$ git rev-parse --short HEAD
ece1062
$ pnpm run verify

$ turbo run lint
• Packages in scope: @vaqcrow/api, @vaqcrow/contracts, @vaqcrow/domain, @vaqcrow/web
@vaqcrow/web:lint: apps/web/src/infrastructure/http/fetch-http-client.ts
@vaqcrow/web:lint:   8:17  warning  '_request' is defined but never used
@vaqcrow/web:lint: apps/web/src/infrastructure/wallet/freighter-wallet.ts
@vaqcrow/web:lint:   25:25  warning  '_xdr' is defined but never used
@vaqcrow/web:lint:   25:39  warning  '_networkPassphrase' is defined but never used
@vaqcrow/web:lint: ✖ 3 problems (0 errors, 3 warnings)
 Tasks:    4 successful, 4 total

$ turbo run typecheck
 Tasks:    6 successful, 6 total

$ turbo run test
@vaqcrow/contracts:test:  Test Files  3 passed (3) / Tests  33 passed (33)
@vaqcrow/domain:test:  Test Files  1 passed (1) / Tests  41 passed (41)
@vaqcrow/api:test:  Test Files  3 passed (3) / Tests  27 passed (27)
@vaqcrow/web:test:  Test Files  36 passed (36) / Tests  137 passed (137)
 Tasks:    6 successful, 6 total

$ turbo run build
@vaqcrow/web:build: ✓ Compiled successfully in 786ms
@vaqcrow/web:build:   Route (app): /, /_not-found, /ai-assessment, /approval, /distribution, /evidence, /funding, /request
@vaqcrow/web:build: ○  (Static)  prerendered as static content
 Tasks:    4 successful, 4 total

$ depcruise apps/*/src packages/*/src --config .dependency-cruiser.cjs
✔ no dependency violations found (132 modules, 267 dependencies cruised)

$ vitest run
 ✓ tests/application-review-round-trip.test.ts (4 tests)
 ✓ tests/boundaries.test.ts (19 tests)
 Test Files  2 passed (2)
      Tests  23 passed (23)

$ echo "EXIT_CODE: $?"
EXIT_CODE: 0
```

Verificado el 2026-09-18 sobre el commit `ece1062` de la rama de este cambio (`Vaqcrow#43_Task_Document_evidence_for_the_Supabase_schema_and_persistence`), con Node `v24.21.0` confirmado vía `node -v` (usando `PATH="$(brew --prefix node@24)/bin:$PATH"`, ya que `nvm install v24.21.0` no estaba disponible en este entorno de ejecución): `pnpm run verify` (lint → typecheck → test → build → boundaries → test:boundaries) → **exit 0**. Esta corrida es un **gate de regresión de un cambio solo de documentación**, no una fuente de evidencia nueva: los conteos coinciden con los ya citados en §3/§4 sin drift (`@vaqcrow/api` 27/27 tests en 3 archivos, boundaries 132 módulos/267 dependencias).

## 5. Límites operativos vigentes

Estos cinco límites siguen vigentes hoy y ninguno de los documentos citados los enumera como un conjunto:

1. **Proyecto Supabase compartido, sin aislamiento de entorno.** La suite de integración corre contra el mismo proyecto Supabase en vivo que usa el desarrollo, no contra una base efímera ni una rama de base de datos. El aislamiento lo aporta el propio test, no la infraestructura: cada fila se escribe con un `application_id` del rango sintético reservado `deadbeef-0000-4000-8000-…` (`synthetic-id.ts`), un `afterEach` borra en lote las filas que registró el test recién ejecutado y un `afterAll` barre el rango reservado y falla si queda residuo (`integration-clients.ts`). El branching de Supabase se evaluó y se descartó por ser una función de plan pago facturada por hora (obs #481). Consecuencia aceptada: dos corridas simultáneas contra el mismo proyecto podrían pisarse, y el barrido sólo protege el rango sintético, no los datos ajenos a él.

2. **RLS habilitada con cero políticas; el acceso real lo decide la capa de GRANT.** `application_review` tiene RLS habilitada, pero hoy no existe ninguna política sobre la tabla. Lo que efectivamente deniega el acceso de `anon` y `authenticated` es `revoke all on public.application_review from anon, authenticated`: el permiso a nivel de tabla está revocado en la capa de GRANT, y Postgres responde `42501` (`permission denied`) **antes de llegar a evaluar RLS**. La evaluación de políticas RLS ni siquiera llega a ejecutarse: el GRANT ya negó la operación antes de ese punto. La API es el único escritor y se conecta como `service_role`, que además hace bypass de RLS. El advisor de seguridad de Supabase reporta exactamente un hallazgo INFO, `RLS Enabled No Policy`, que corresponde a este diseño deliberado y no a un defecto (obs #477). Las políticas orientadas a usuario final quedan diferidas al issue [#134](https://github.com/reyduar/Vaqcrow/issues/134); hasta entonces, cualquier rol nuevo que reciba un GRANT sobre esta tabla quedaría sin restricción a nivel de fila.

3. **`.env.example` no documentaba `SUPABASE_PUBLISHABLE_KEY`.** `.env.example` documentaba `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, pero no la tercera variable que la suite de integración exige, `SUPABASE_PUBLISHABLE_KEY` (verificado sobre `main` con `git show origin/main:.env.example`, obs #491). La variable sí se lee y se usa correctamente en código (`createPublishableSupabaseClient`, `hasIntegrationCredentials`): fue una brecha de documentación, no de comportamiento. La línea fue agregada directamente por la persona dueña del repositorio en su copia de trabajo local, no por ninguna sesión de agente: una guardrail global de permisos (`deny` sobre `Edit(.env.*)`) impide a las sesiones de Claude Code leer o escribir cualquier archivo `.env*`, incluido un template sin valores.

4. **Sin CI; las credenciales de integración son manuales y locales.** Este repositorio no tiene `.github/workflows/`: no hay CI de ningún tipo. La suite de integración no está cableada al comando `test` por defecto — `vitest.config.ts` sólo incluye `src/**/*.test.ts` — y corre únicamente con `pnpm --filter @vaqcrow/api test:integration`, bajo `describe.skipIf(!hasIntegrationCredentials())`: sin las tres variables presentes los 7 bloques se saltan (no fallan) y el comando termina en `exit 0`. La prueba en vivo depende entonces de que una persona con credenciales reales la ejecute a mano; ninguna barrera automática impide mergear un cambio que la rompa.

5. **Lección operativa del hueco de PRs encadenadas del #41.** El #41 se entregó como una cadena stacked-to-main. La PR [#149](https://github.com/reyduar/Vaqcrow/pull/149) se mergeó contra la rama de la PR [#148](https://github.com/reyduar/Vaqcrow/pull/148) en lugar de contra `main`, así que el adaptador y sus tests no llegaron a `main` cuando la cadena se dio por cerrada. El hueco se detectó después y se cerró con una tercera PR, [#150](https://github.com/reyduar/Vaqcrow/pull/150) (`fix(api): land PR2's adapter and tests on main`). No hubo pérdida de código ni de revisión, pero durante esa ventana `main` contenía el esquema sin su adaptador. Se registra sin atenuantes porque es un riesgo real del patrón stacked-to-main de este repositorio: al cerrar una cadena hay que verificar la rama destino de cada PR hija, no sólo su estado `merged`.

## 6. Resultado visible en la demo

Ningún enunciado de esta sección afirma que la demo ya use esta persistencia hoy.

- `application_review` **no tiene superficie visible propia en la demo**. `DEMO.md` §13 no lista la persistencia como un slice; es infraestructura por debajo de varios slices. No existe hoy ninguna ruta, pantalla ni endpoint que lea o escriba esta tabla.
- Cuando [#18](https://github.com/reyduar/Vaqcrow/issues/18) construya la solicitud y revisión de evidencia de la PyME, podrá persistir y recuperar el estado del ciclo de revisión a través del puerto `ApplicationReviewRepositoryPort` sin reabrir el contrato.
- Cuando [#24](https://github.com/reyduar/Vaqcrow/issues/24) arme, verifique y envíe la intención de fondeo, el UPDATE condicional idempotente ya probado le permitirá reintentar sin doble aplicación.
- Cuando [#26](https://github.com/reyduar/Vaqcrow/issues/26) aterrice, contará con la misma garantía de trazabilidad por `last_correlation_id`.

Hasta que esas Features salgan de `Backlog`, no hay ningún flujo de demo ejecutable extremo a extremo que toque esta persistencia.

## 7. Correcciones aplicadas durante el ciclo

El ciclo de las Tasks #41 y #42 produjo cinco correcciones de rumbo. Ninguna de las evidencias citadas las enumera como conjunto, y omitirlas dejaría la evidencia más limpia de lo que realmente fue:

1. **Cobertura de argumentos de llamada en el fake client (#41).** La verificación encontró que el fake Supabase client escrito a mano descartaba los argumentos de `.insert()`, `.update()` y `.eq()`, de modo que los 13 tests del adaptador sólo afirmaban el resultado devuelto y nunca el payload enviado. Se corrigió en el commit `5b238b4`, que hace que el fake capture esas llamadas y agrega aserciones sobre el payload de escritura (incluida la columna de trazabilidad `last_correlation_id`) y sobre las columnas/valores exactos del `WHERE` del UPDATE condicional. El diff de código de producción de ese commit es vacío (obs #475, obs #476).
2. **Una afirmación de entorno falsa, revertida por ejecución real.** La repetibilidad de la migración se había reportado como no verificable "por no haber Docker ni CLI de Supabase". Era un error del orquestador: el servidor MCP de Supabase estaba conectado a un proyecto real todo el tiempo y nunca se consultó antes de hacer esa afirmación. Corregido ejecutando la migración dos veces contra el proyecto en vivo, ambas con `success: true` y estado final idéntico (obs #477).
3. **Semántica del replay idempotente.** El planteo inicial del caso de replay usaba una sola llamada con `from === to`, que no recorre el camino real del adaptador. Se corrigió a dos llamadas con el par `{ from: "draft", to: "awaiting_assessment" }` idéntico: la primera coincide con una fila (`applied: true`) y la segunda con cero, entrando por la rama de desambiguación que devuelve `applied: false` (obs #490).
4. **Mecanismo de denegación, descrito con precisión.** La aserción de acceso no privilegiado se fijó al código `42501` exacto en lugar de una respuesta ambigua sin código verificado, y la descripción del mecanismo se corrigió a lo que realmente ocurre: denegación en la capa de GRANT, antes de evaluar RLS (§5, límite 2).
5. **Conteo de tests.** La suite de integración se describía como "9 tests". El archivo tiene **7 bloques `it(...)`** que cubren **9 requisitos del spec**; los dos requisitos restantes los prueba el arnés, no un bloque propio. Este documento usa la formulación corregida en §4.

## 8. Mapeo de criterios de aceptación

| # | Criterio (verbatim, issue #43) | Resultado |
|---|---|---|
| 1 | "Record verification evidence, operational limits and the demo-visible result." | ✅ PASS — §3/§4 citan la evidencia de verificación ya probada de #41/#42, §4.1 agrega el gate de regresión fechado, §5 enumera los 5 límites operativos vigentes y §6 encuadra el resultado visible en la demo en términos estrictamente futuro-condicionales |
| 2 | "Evidence is reproducible and bounded." | ✅ PASS — §2 define el formato de reproducción local (`nvm use v24.21.0`, sin CI); §4.1 re-ejecuta `pnpm run verify` una única vez sobre el commit `ece1062` de esta misma rama con salida real fechada; el alcance del cambio queda acotado a un único archivo nuevo (§10) |
| 3 | "No secrets, PII or unsupported production claims are introduced." | ✅ PASS — sin credenciales, claves ni identificador del proyecto Supabase en este documento (D6 del diseño); §6 no afirma ninguna demo funcionando hoy; §5 acota explícitamente los límites de seguridad vigentes sin sobreclamar |

## 9. Riesgos y limitaciones aceptadas

- **La prueba en vivo no es reproducible desde una sesión de agente.** Ninguna sesión de SDD tuvo acceso a `SUPABASE_SERVICE_ROLE_KEY`; la única corrida con credenciales reales la hizo el usuario en su máquina (obs #488). Este documento la cita, no la re-ejecuta, y #43 no intentó reproducirla.
- **Sin políticas RLS, hoy.** El modelo de acceso depende de que `service_role` sea el único rol con GRANT. Cualquier GRANT futuro sobre esta tabla sin política RLS abre acceso irrestricto a nivel de fila. Seguimiento: issue [#134](https://github.com/reyduar/Vaqcrow/issues/134). **#43 no lo investigó ni lo corrigió.**
- **`.env.example` estaba incompleto.** Brecha real, de propiedad del usuario, fuera de alcance de este cambio (§5, límite 3).
- **Sin CI.** No hay barrera automática para ninguno de los comandos de §4. Fuera de alcance; ningún issue asignado.
- **Sincronización de roadmap diferida.** `docs/planning/demo-tasks-list.md` sigue mostrando #41/#42/#43 con `Workflow: Backlog` y la lista `Ready` de la línea 7 desactualizada. Este cambio **no** lo toca, siguiendo el mismo patrón que #39, #40, #52 y #55; la sincronización real pertenece a un commit posterior al merge.
- **Fuera de alcance, explícitamente aceptado:** no se re-ejecutó la suite de integración como fuente de evidencia nueva; no se reescribió ningún test; no se agregaron políticas RLS ni CI; no se tocó `.env.example`; no se modificó la migración.

## 10. Estado de entrega

- Cambio SDD `document-supabase-schema-and-persistence-evidence` ejecutado como una sola unidad de trabajo (forecast de `sdd-tasks`: ~180–220 líneas autoradas, archivo nuevo único, riesgo **Bajo** del presupuesto de 400 líneas, sin necesidad de encadenar PRs).
- Este documento es el único archivo agregado; no se tocó código fuente, pruebas, migraciones, configuración ni `demo-tasks-list.md`.
- Ciclo SDD completo (explore → propose → spec → design → tasks → apply → verify → archive), con persistencia en Engram bajo el topic `sdd/document-supabase-schema-and-persistence-evidence/*`.
- Rama de trabajo: `Vaqcrow#43_Task_Document_evidence_for_the_Supabase_schema_and_persistence`. El commit y la apertura del Pull Request son un paso explícito posterior a esta fase.

### Qué queda desbloqueado

> Con este documento completo, la Feature [#13](https://github.com/reyduar/Vaqcrow/issues/13) ("Crear el esquema Supabase y la persistencia idempotente") queda cerrada al mergear esta rama, junto con sus tres Tasks [#41](https://github.com/reyduar/Vaqcrow/issues/41), [#42](https://github.com/reyduar/Vaqcrow/issues/42) y [#43](https://github.com/reyduar/Vaqcrow/issues/43). Quedan libres de este bloqueo nativo exactamente tres issues: [#18](https://github.com/reyduar/Vaqcrow/issues/18) (solicitud y revisión de evidencia de la PyME), [#24](https://github.com/reyduar/Vaqcrow/issues/24) (construir, verificar y enviar la intención de fondeo) y [#26](https://github.com/reyduar/Vaqcrow/issues/26), tal como registra `demo-tasks-list.md` líneas 571 y 607.

### Próximos pasos sugeridos

1. Revisar y mergear el Pull Request de esta rama contra `main`, verificando que su rama destino sea `main` y no otra rama de la cadena (§5, límite 5).
2. Agregar la línea `SUPABASE_PUBLISHABLE_KEY=` a `.env.example` (acción directa del usuario, §5 límite 3).
3. Sincronizar `docs/planning/demo-tasks-list.md` (mover #41/#42/#43 a `Done`, backfillear los PRs #148–#152, cerrar la Feature #13, actualizar la lista `Ready` de la línea 7) en un commit de sincronización de roadmap posterior al merge, no en este cambio.
4. Evaluar la apertura de las políticas RLS orientadas a usuario final bajo el issue [#134](https://github.com/reyduar/Vaqcrow/issues/134) antes de que #18/#24/#26 expongan la tabla a un rol que no sea `service_role`.
