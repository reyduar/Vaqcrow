# Evidencia de cierre de la Feature #29 — Issue #94

> Documento de cierre de Feature. Consolida la evidencia verificable de las Tasks [#92](https://github.com/reyduar/Vaqcrow/issues/92) y [#93](https://github.com/reyduar/Vaqcrow/issues/93), agrega únicamente lo que ninguna de las dos documenta (el mapeo contra los criterios de aceptación propios de la Feature [#29](https://github.com/reyduar/Vaqcrow/issues/29) y de sus tres Tasks, los límites vigentes como conjunto y el barrido de afirmaciones desactualizadas) y registra una reproducción local sobre `db3de55`. No re-deriva los números que ya quedaron asentados en las bitácoras [[odd/tasks/implement-evidence-dashboard|implement-evidence-dashboard]] y [[odd/tasks/test-evidence-dashboard|test-evidence-dashboard]]. Este documento **no afirma que la Feature #29 esté cerrada**: su cierre es manual y queda pendiente del merge de esta unidad documental.

## 1. Contexto y objetivo

La Feature [#29](https://github.com/reyduar/Vaqcrow/issues/29) ("Feature: Expose decision and transaction evidence dashboard", parent [#9](https://github.com/reyduar/Vaqcrow/issues/9), área `demo`, prioridad `High`) presenta en **una sola línea temporal** las decisiones, la evidencia, los estados, los montos, los hashes, los enlaces del explorador y los avisos de simulación de la corrida de la demo. Es el **paso 6** de la historia vertical de [[docs/planning/DEMO|DEMO.md]] y el cierre narrativo de la demo (`DEMO.md` §9, 5:45–6:30: "Dos hashes, trazabilidad completa"), donde `DEMO.md` §10 exige que ambos movimientos muestren hash, operaciones y un enlace de explorador de Testnet.

Se entregó en tres Tasks:

| Task | Issue | Entrega |
|---|---|---|
| Implementar | [#92](https://github.com/reyduar/Vaqcrow/issues/92) | PR [#349](https://github.com/reyduar/Vaqcrow/pull/349) — merge `bfe68e1` |
| Probar | [#93](https://github.com/reyduar/Vaqcrow/issues/93) | PR [#350](https://github.com/reyduar/Vaqcrow/pull/350) — merge `db3de55` |
| Documentar evidencia | [#94](https://github.com/reyduar/Vaqcrow/issues/94) | este documento |

La Feature se cierra manualmente al terminar #94: GitHub no cierra una Feature al completarse sus sub-issues, mismo patrón que las Features #11 a #19, #23 y #238. Según el roadmap, #29 no tiene dependientes nativos directos: su cierre no desbloquea por sí mismo a [#30](https://github.com/reyduar/Vaqcrow/issues/30) ni a [#31](https://github.com/reyduar/Vaqcrow/issues/31), que avanzan por su propia prioridad.

## 2. Cómo leer esta evidencia

- **Hechos verificados.** Se derivan de los commits locales, los archivos versionados y los comandos de §5 ejecutados el **2026-09-29** sobre `db3de55`. Cada fila dice de dónde sale el resultado; nada se infiere.
- **Hechos simulados de la demo.** El caso sintético (identidad, KYC/KYB y ventas), la regla de distribución y los montos de la demo se identifican como tales. La distribución lleva `SIMULADO` en su rótulo de cálculo, y la acción humana registrada es real y humana: no lleva `SIMULADO`.
- **Bitácoras de iteración.** [[odd/tasks/implement-evidence-dashboard|implement-evidence-dashboard]] y [[odd/tasks/test-evidence-dashboard|test-evidence-dashboard]] son la fuente de verdad de cómo se hizo el trabajo: commits, decisiones de diseño, hallazgos de revisión y números observados. Este documento las cita; no las reemplaza.
- **Trabajo futuro.** Se formula como futuro y no como capacidad entregada.
- **Reproducción local.** Los comandos no requieren Supabase, Stellar Testnet, Horizon, proveedor LLM, credenciales ni datos sensibles. El e2e corre contra el stub local en loopback; `pnpm run verify` usa sus suites determinísticas y no incluye `test:integration`.

## 3. Implementación trazable

| Límite entregado | Ruta verificable | Hecho comprobado |
|---|---|---|
| Puerto reemplazable | `apps/api/src/application/ports/application-review-repository-port.ts` | `readLatestHumanDecision(applicationId)` devuelve `ApplicationReviewRepositoryResult<HumanDecisionRecord>`; `not_found` cuando la aplicación no tiene una decisión registrada. No importa Fastify, Supabase, Stellar ni SDK de LLM. |
| Adaptador Supabase | `apps/api/src/infrastructure/adapters/supabase-application-review-repository.ts` | Lee `human_decision` por `application_id`, ordena por `decided_at desc` y desempata por `decision_id asc`, y limita a una fila. Cero filas devuelve `{"code":"not_found"}`; re-valida cada columna por el parser compartido (`parseHumanDecisionRecord`); mapea todo error a la forma sanitizada sin `message`/`details`/`hint`. |
| Superficie HTTP de lectura | `apps/api/src/infrastructure/http/routes/human-decision.route.ts` | `GET /application-reviews/:applicationId/decisions` responde `200 { decision }`, `404 { code: "not_found" }` cuando no hay fila, `400 { code: "invalid_request" }` si el uuid es inválido y `503 { code: "unavailable" }` para cualquier otro resultado del repositorio. |
| Sin migración | `supabase/migrations/20260919181453_create_human_decision_audit.sql` | La línea 34 ya concede `grant select, insert on public.human_decision to service_role`; la lectura no necesitó ningún cambio de esquema ni de grants. |
| Gateway web de lectura | `apps/web/src/infrastructure/decision/http-human-decision-gateway.ts` | `readLatest(applicationId)` responde `HumanDecisionRecord \| null`: `null` es el `not_found` de la API. No construye ni interpreta el cuerpo más allá del contrato compartido. |
| Proyección pura | `apps/web/src/application/evidence/evidence-timeline.ts` | `buildEvidenceTimeline(sources)` ordena los cuatro asientos (caso simulado, decisión humana, bóveda, distribución) y es la **única** autoridad de los estados `observed`/`absent`/`unavailable`, de las etiquetas y del formateo. No hace I/O, así que es enteramente testeable por unidad. |
| Componente de recap | `apps/web/src/presentation/components/evidence-timeline.tsx` | Renderiza cada asiento con `Badge`, `HashDisplay` y `DistributionCalculation`; el estado es siempre texto visible (`Observado`/`Ausente`/`No disponible`) y viaja además en `data-state`; no inventa un tono de éxito. |
| Contenedor | `apps/web/src/presentation/components/evidence-workspace.tsx` | Construye los tres gateways desde `NEXT_PUBLIC_API_BASE_URL`, lee las tres fuentes con `Promise.all` y mapea `null`/`not_found` a `absent` y cualquier otro fallo a `unavailable`; un gateway ausente (`null`) es "no disponible", nunca "ausente". |
| Ruta `/evidence` | `apps/web/src/app/(demo)/evidence/page.tsx` | Lee `?campaign=` y `?distribution=` dentro de un límite `Suspense` y los entrega al contenedor. Es el último `StepPlaceholder` retirado de la shell: el componente `step-placeholder.tsx` y su test unitario ya no existen. |
| Identidad en la URL | `apps/web/src/app/(demo)/distribution/page.tsx` | Escribe `?distribution=<id>` con `router.replace`, sin `localStorage`, igual que `/funding` escribe `?campaign=<id>`. Deja la ruta recargable y permite que `/evidence?campaign=…&distribution=…` reconstruya la misma corrida. |
| Formatter único | `apps/web/src/application/format/stroops.ts` | `formatStroopsAsXlm` se extrajo de dos copias privadas byte-idénticas (bóveda y distribución) y ahora los tres consumidores —`campaign-workspace`, `distribution-workspace` y la proyección de evidencia— importan la misma definición. |
| e2e y fidelidad del doble | `apps/web/e2e/evidence-dashboard.spec.ts`, `apps/web/e2e/support/stub-campaign-routes.mjs` | Dos casos locales: sin id en la URL (todo `absent`, sin lecturas confirmadas) y con `?campaign=` (bóveda `observed` con su enlace de explorador real). El stub de campaña ahora emite el `explorerUrl` que deriva la API real (`campaignExplorerUrl`), un literal de base de Testnet. |

Los commits de la implementación y de las pruebas están asentados en las bitácoras de iteración ([[odd/tasks/implement-evidence-dashboard|#92]]: `655d38f`, `07b0905`, `7916422`, `d0dfa6e`, `172e6b3`, `b10ed2b`, `1d17cd2`, `c8e6e6a`, `24982d8`; [[odd/tasks/test-evidence-dashboard|#93]]: `4c82844`, `be24fd1`, `1c3fd2e`, `3e4395f`, `baefb51`). Este documento no los re-deriva.

> [!important] Límite de veracidad del recap
> La decisión humana registrada es real y humana y **no** lleva `SIMULADO`. La bóveda y la distribución sí llevan el badge de Testnet porque son movimientos de red, y la distribución rotula su cálculo como `SIMULADO`. El recap **no** rotula un hash leído de la API como "hash de ensayo previo": no puede distinguir una corrida viva de un ensayo, así que no afirma ninguna de las dos cosas. La aclaración conceptual de hash de ensayo vive únicamente en la nota del propio paso.

## 4. Cobertura determinística

La cobertura se agregó donde puede fallar, no donde repite. La Task #93 cerró tres superficies que #92 dejó sin probar ([[odd/tasks/test-evidence-dashboard|bitácora de #93]], D1–D2): el branch de **backend no configurado** del contenedor (antes lo ejecutaba la ruta pero nadie lo afirmaba), el **cableado de los dos ids** de la propia página `/evidence` (antes su test mockeaba `useSearchParams` a `null` y sólo miraba los avisos) y el **envelope de lectura** re-parseado campo por campo por el contrato compartido que consume la web (antes la ruta afirmaba `{ decision }` y el gateway parseaba un `{ decision: record }` escrito a mano, sin unirlos). Los once tests nuevos pasaron en su **primera corrida**: son guardas sobre superficies antes no probadas, no rojos que se hayan corregido.

Las suites de la Feature cubren estados, montos, hashes, enlaces y fallos:

- **Proyección y contenedor** (`apps/web/src/application/evidence/evidence-timeline.test.ts`, `apps/web/src/presentation/components/evidence-workspace.test.tsx`, `apps/web/src/presentation/components/evidence-timeline.test.tsx`): los tres estados por asiento, conjunto completo / pendiente / fallido / ausente / no disponible, el fallback sin backend y la clasificación de `not_found` como ausencia frente a cualquier otro fallo como no disponible.
- **Ruta y adaptador de API** (`human-decision.route.test.ts`, `supabase-application-review-repository.test.ts`): la lectura de la última decisión, el desempate determinístico, el `404`/`400`/`503`, la re-validación de filas y la sanitización de errores.
- **e2e local** (`e2e/evidence-dashboard.spec.ts`): que la ruta, el contenedor, el gateway HTTP y la proyección acuerden en un navegador real contra el stub, con y sin id de campaña.

No hubo migración: `human_decision` ya tenía `select` para `service_role`. No hay persistencia propia nueva, ni capacidad de IA, ni cambios en el motor de distribución determinístico.

## 5. Resultados de verificación observados

Reproducido localmente el **2026-09-29** sobre `db3de55`, antes de modificar este documento.

```sh
$ pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/routes/human-decision.route.test.ts src/infrastructure/adapters/supabase-application-review-repository.test.ts

 ✓ src/infrastructure/adapters/supabase-application-review-repository.test.ts (47 tests)
 ✓ src/infrastructure/http/routes/human-decision.route.test.ts (22 tests)

 Test Files  2 passed (2)
      Tests  69 passed (69)
   Duration  1.03s
```

```sh
$ pnpm --filter @vaqcrow/web exec vitest run src/application/evidence src/presentation/components/evidence-timeline.test.tsx src/presentation/components/evidence-workspace.test.tsx "src/app/(demo)/evidence" "src/app/(demo)/distribution"

 Test Files  9 passed (9)
      Tests  90 passed (90)
   Duration  5.45s
```

```sh
$ pnpm --filter @vaqcrow/web run test:e2e

Running 19 tests using 1 worker
  19 passed (27.8s)
```

```sh
$ pnpm run verify

 Tasks:    5 successful, 5 total   # lint
 Tasks:    8 successful, 8 total   # typecheck
 Tasks:    8 successful, 8 total   # test
 Tasks:    5 successful, 5 total   # build
✔ no dependency violations found (506 modules, 1608 dependencies cruised)
 Test Files  9 passed (9)
      Tests  93 passed (93)         # test:boundaries
```

El comando compuesto terminó con **exit 0**. Por paquete: contratos 13 archivos/487 tests, dominio 2/120, IA 5/107, `@vaqcrow/web` 105/785 y `@vaqcrow/api` 47/961. El único warning de lint fue el preexistente `apps/web/src/infrastructure/http/fetch-http-client.ts:8` (`_request` sin usar); 0 errores. Las líneas `stderr` de repositorios Supabase durante los tests son fixtures de sanitización de errores, no una conexión de integración ni un fallo del gate.

El gate reutilizó la caché de turbo para lint/typecheck/test/build (`5 cached` / `8 cached`). Para no dejar los recuentos por paquete dependiendo de una corrida cacheada, se corrieron frescas las suites directas: `pnpm --filter @vaqcrow/web test` → **105 archivos / 785 tests** (81.14s) y `pnpm --filter @vaqcrow/api test` → **47 archivos / 961 tests** (9.58s), ambas exit 0 y coincidentes con lo informado por el gate.

> [!warning] Flake documentado, observado y acotado
> Una corrida **fresca forzada** de la tarea `test` (`pnpm exec turbo run test --force`) reprodujo el flake de carga que este repositorio ya documenta (`trust-disclosures-and-contract-custody-evidence.md`, `ai-failure-routing-evidence.md`): con carga del host en **19.38**, el primer test de `distribution-workspace.test.tsx` agotó los 5000 ms; con carga en **9.58**, el primer test de `layout.traversal.test.tsx` (`forward traversal through all six steps`) y el primer test de `theme-switcher.test.tsx` (`offers the three theme choices the design corpus names`) agotaron los 5000 ms. Re-ejecutados en aislamiento, los mismos archivos pasan: el primero, **9 tests en 1002 ms**; los segundos, **8 tests en 3.39 s** (el traversal en 404 ms). El gate requerido `pnpm run verify` pasó **exit 0**. Ninguna aserción falló y no se cambió `testTimeout` ni ninguna configuración.

## 6. Mapeo de criterios de aceptación

Criterios citados **verbatim** de `gh issue view 29`, `gh issue view 92`, `gh issue view 93` y `gh issue view 94`.

| # | Criterio (verbatim) | Resultado | Evidencia |
|---|---|---|---|
| 1 | #29: "Present decisions, evidence, states, amounts, hashes, explorer links and simulation disclosures in one timeline." | ✅ Cumplido | §3: `buildEvidenceTimeline` ordena los cuatro asientos con estado, monto, hash, enlace de explorador y rótulos (`SIMULADO`, Testnet) en `evidence-timeline.tsx`. §5: suites de proyección y componente 9 archivos/90 tests. |
| 2 | #29: "Required evidence and failure behavior are covered." | ✅ Cumplido | §4: la proyección y el contenedor cubren completo/pendiente/fallido/ausente/no disponible y el fallback sin backend; la API cubre `400`/`404`/`503` y la sanitización de errores. |
| 3 | #29: "No unsupported production claims or secrets are introduced." | ✅ Cumplido | §2 y §7: la demo es Testnet y no apta para producción; no hay secretos, semillas, PII ni XDR. El recap sólo muestra lo que la API le devuelve. |
| 4 | #92: "Feature #29 behavior is implemented within its documented boundary." | ✅ Cumplido | §3: la lectura entra por el puerto y su adaptador Supabase, sin migración; la web la consume por su gateway. Sin cambios en el motor determinístico ni en la custodia. |
| 5 | #92: "Display a correlated timeline of decisions, transaction states, amounts, hashes, operations, and Testnet explorer links while keeping simulated and real evidence clearly distinguished." | ⚠️ Parcial | Se muestran decisiones, estados, montos, hashes y enlaces de explorador, con simulado y real distinguidos (§3–§4). **"operations" se entrega para la distribución** —su bloque de cálculo enumera cada destinatario con su monto, que es el conjunto de pagos del sobre (`recipients` en `packages/contracts/src/revenue-share-distribution.ts`)— pero **no para la bóveda**: `CampaignSnapshot` no expone la lista de operaciones del movimiento, así que de ese asiento sólo se ven estado, montos, contrato y hash (`packages/contracts/src/campaign.ts`). Se registra como límite en §7. |
| 6 | #92: "Failure paths remain truthful and do not weaken security or human-control boundaries." | ✅ Cumplido | §3–§4: `not_found` se rotula como ausencia y cualquier otro fallo como no disponible; el árbol de errores se sanitiza; la decisión humana se muestra como acción registrada, sin preselección ni capacidad de aprobar desde este recap. |
| 7 | #93: "Deterministic tests demonstrate the core behavior of Feature #29." | ✅ Cumplido | §5: proyección/contenedor 9 archivos/90 tests, API 2 archivos/69 tests, e2e 19 tests. Todos determinísticos, sin servicio vivo. |
| 8 | #93: "Validation, rejection, and fallback behavior is covered where applicable." | ✅ Cumplido | §4: el fallback sin backend, el `not_found` como ausencia, y la validación/rechazo de la API (`400` uuid inválido, `404` sin decisión, `503` no disponible, sanitización). |
| 9 | #93: "The focused suite passes without live external services or sensitive data." | ✅ Cumplido | §5: los cuatro comandos pasan sin Testnet, Horizon, Supabase ni LLM; el e2e usa el stub local y su guarda de requests externos. |
| 10 | #94: "Evidence identifies Feature #29, verification commands, and observed results." | ✅ Cumplido | §1 identifica la Feature #29 y sus Tasks #92/#93/#94; §5 contiene los cuatro comandos ejecutados con sus resultados observados, incluido `pnpm run verify` exit 0. |
| 11 | #94: "Evidence is traceable to implementation and focused tests." | ✅ Cumplido | §3 vincula cada superficie con su ruta versionada y §4–§5 con sus suites focalizadas; los commits quedan citados desde las bitácoras. |
| 12 | #94: "Sensitive data and unsupported production claims are excluded." | ✅ Cumplido | §§2 y 7: sin secretos, semillas, PII ni datos de una fuente viva; Testnet y la no-producción quedan declarados. |

De doce criterios, **once se cumplen y uno (el #5 de #92) es parcial**: de los dos movimientos, la distribución sí enumera sus operaciones (un pago por destinatario, con su monto) y la bóveda no, porque su snapshot no expone la lista de operaciones. El resto de ese criterio sí se cumple.

## 7. Límites conocidos y trabajo futuro

1. **La evaluación de IA no se muestra en el recap.** Su endpoint es stateless y no tiene lectura ([[odd/tasks/implement-evidence-dashboard|#92]], decisión de alcance), así que el dashboard no puede mostrar una evaluación que no está persistida. Se registra como límite, no como hueco a esconder.
2. **El recap no distingue un hash vivo de un hash de ensayo previo** y, por eso, no lo rotula. El commit `b10ed2b` retiró ese rótulo porque era una afirmación falsa sobre el camino normal de la demo; la aclaración conceptual queda sólo en la nota del paso.
3. **Sólo el `not_found` propio de la API cuenta como ausencia.** Un `404` de una base mal enrutada es un fallo de lectura (`unavailable`), no la prueba de que la decisión no exista (commit `c8e6e6a`).
4. **`Badge` no tiene tono `success`.** El timeline reutiliza el vocabulario existente y no inventa ninguna señal de éxito a nivel de tipo ni de render.
5. **La distribución no se puede accionar desde el stub de e2e.** Su camino positivo se prueba en el nivel de componente y proyección (que pueden inyectar la instantánea), y en e2e sólo se afirma su **ausencia** cuando no hay `?distribution=`. No hay una prueba de navegador de la distribución observada.
6. **La bóveda no enumera las operaciones de su movimiento.** `CampaignSnapshot` expone estado, montos, contrato y (opcionalmente) el aporte del inversor, pero no la lista de operaciones; el recap muestra lo que el snapshot trae y ofrece el hash/enlace donde inspeccionarlas. La distribución sí las enumera, porque sus `recipients` son, literalmente, los pagos del sobre. Es la razón del criterio parcial #5.
7. **Sin capacidad nueva de IA, Stellar ni persistencia.** No se ejecutó ninguna transacción de Testnet, Horizon, wallet, Supabase ni servicio LLM para esta evidencia; la IA sigue siendo sólo asesora y no aprueba, no calcula obligaciones ni mueve fondos.

> [!warning] Alcance de la demo
> Vaqcrow es una demostración no apta para producción. La identidad, el KYC/KYB, las ventas y el corredor ARS/activo son simulados; Stellar corre en Testnet sin valor económico. El dashboard muestra evidencia de una corrida de demostración, no disponibilidad, legalidad ni operación financiera real.

### 7.1 Barrido de afirmaciones desactualizadas

Se buscaron afirmaciones que el aterrizaje de #92/#93 dejó falsas, con `rg` sobre `docs/`:

```sh
$ rg -n -i 'stepplaceholder|step content coming soon|placeholder' docs/
$ rg -n '0/3' docs/
$ rg -n -i 'dashboard de evidencia|evidence dashboard|#29\b' docs/
```

El barrido devolvió varias coincidencias; se corrigieron las que afirmaban un estado ya falso, con una **nota fechada que conserva el texto original** como registro (patrón `> **Nota (post-#XX):**` de [[docs/planning/document-workspace-evidence|document-workspace-evidence.md]]):

1. `docs/planning/cloud-environment-configuration-evidence.md` — §3.5 afirmaba que `/distribution` y `/evidence` "están en 0/3" y rinden "Step content coming soon" (líneas 63–64), y §5 lo repetía (límite 3). Se agregó una nota fechada tras la tabla de §3.5 y otra al cierre del listado de §5. La Feature [#28](https://github.com/reyduar/Vaqcrow/issues/28) entregó `/distribution` (PRs [#345](https://github.com/reyduar/Vaqcrow/pull/345)–[#347](https://github.com/reyduar/Vaqcrow/pull/347)) y #92/#93 entregaron `/evidence`.
2. `docs/planning/campaign-vault-web-journey-evidence.md` — el límite 7 (línea 155) decía que los pasos 5 y 6 eran placeholders "ambas en 0/3". Se agregó una nota fechada.
3. `docs/guides/freighter-and-testnet-walkthrough.md` — los pasos 5 y 6 (líneas 209–215) y el límite §13 (línea 256) declaraban los pasos como placeholders pendientes de #28/#29. Se agregaron notas fechadas en los tres puntos.

No se tocó ninguna otra afirmación: `docs/planning/DEMO.md` y `docs/design/demo-ui.md` describen el objetivo del slice (prospectivo), y `docs/planning/stellar-blockchain-requirements.md` sólo referencia las Tasks como alcance, lo que sigue siendo correcto. `docs/planning/testnet-revenue-share-distribution-evidence.md` y `docs/planning/ai-failure-routing-evidence.md` contienen, en sus "próximo paso", la expectativa de habilitar #29: eran correctas al escribirse y el hecho se cumplió, así que no son afirmaciones falsas.

## 8. Estado de entrega

Los merges locales `bfe68e1` (PR [#349](https://github.com/reyduar/Vaqcrow/pull/349)) y `db3de55` (PR [#350](https://github.com/reyduar/Vaqcrow/pull/350)) confirman que #92 y #93 están incorporados a la base actual. Esta Task #94 aporta el documento de cierre y conserva su rama propuesta hasta que el flujo de revisión y merge ocurra; **no se presenta como entregada por este documento**. La frontera de rollback de esta unidad es exclusivamente documental: `docs/planning/evidence-dashboard-evidence.md`, la sincronización de roadmap de #92/#93 en `docs/planning/demo-tasks-list.md` y las notas fechadas de §7.1.

Estado de revisión, tal como quedó: #92 tiene **dos linajes aprobados y reconocidos** (`review-00a604e9800bbec6` y `review-d1e22ef1e476c0e0`) y un candidato que el dueño declinó; #93 tiene la transacción `review-5ac47109cd19705d` todavía en `reviewing`, porque el revisor del host devolvió vacío tres veces y **no existe recibo** para ese candidato. Ambos hechos quedan asentados en las bitácoras ([[odd/tasks/implement-evidence-dashboard|#92]] §"RDD and review evidence", [[odd/tasks/test-evidence-dashboard|#93]] §"RDD and review evidence") y se reportan aquí sin suavizarlos.

### Próximo paso

Revisar y mergear la unidad documental de #94. Sólo después podrá cerrarse la Feature #29; ese cierre no se afirma aquí como realizado.
