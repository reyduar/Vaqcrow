# Evidencia de cierre de la Feature #438 — Issue #441

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#439](https://github.com/reyduar/Vaqcrow/issues/439) (implementación), [#440](https://github.com/reyduar/Vaqcrow/issues/440) (pruebas) y [#441](https://github.com/reyduar/Vaqcrow/issues/441) (evidencia) de la Feature [#438](https://github.com/reyduar/Vaqcrow/issues/438) ("Feature: Retire the scripted six-step demo journey routes"), mapea cada criterio de aceptación de la Feature y de sus Tasks, **citado textualmente**, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/retire-scripted-journey|Bitácora: retiro del recorrido de seis pasos]].

> [!warning] Estado de entrega: nada de #438 está en `main`
> El trabajo vive en la rama `Vaqcrow#438_Feat_Retire_the_scripted_six_step_demo_journey_routes`, creada desde la punta de #434 (`fda3a27`) y apilada sobre toda la pila por roles: #369 / #378 / #398 / #399 / #402 / #406 / #410 / #414 / #422 / #426 / #430 / #434. Con autorización del owner (Opción A: la pila llega a `main` junta con este retiro) **se abre una PR hacia `main`**; este documento **no** reporta un estado mergeado ni un resultado de CI. En `main` sigue el recorrido de seis pasos hasta que esa PR se mergee. Las dos migraciones de #438 ya están **aplicadas en el proyecto remoto** con autorización del owner (§3.7).

> [!info] Nombre del archivo
> El issue #441 pide `retire-scripted-demo-journey-evidence.md`; la hoja de ruta (`demo-tasks-list.md`, entrada #441) y la bitácora fijaron `retire-scripted-journey-evidence.md`, el nombre que lleva este documento. La diferencia se registra en §7.4.

## 1. Contexto y objetivo

El recorrido guionado de seis pasos (`/request`, `/ai-assessment`, `/approval`, `/funding`, `/distribution`, `/evidence`, bajo `apps/web/src/app/(demo)/`) era la demo original. La app por roles (PyME, INVERSOR, ADMIN) ya cubría el flujo, pero `/evidence` era la **única** pantalla que juntaba la prueba verificable en Testnet: link a la bóveda, hash de cada distribución y reconciliación. Además, dos hashes **nunca se habían persistido**: el del despliegue de la bóveda y el de cada aporte.

La Feature hace dos cosas, en este orden:

1. **Primero reubica la evidencia** por rol (WU1–WU5b): persiste los hashes que faltaban, sirve la cadena completa al ADMIN y muestra hashes y links al explorador al inversor, a la PyME y en el detalle de campaña.
2. **Después retira** las seis rutas, su engine, su store y el código muerto (WU6), y alinea la documentación (WU7, WU7b).

| Task | Cómo se entregó | Estado del issue |
|---|---|---|
| #439 — implementar | WU1–WU6 en la rama de #438 | abierto |
| #440 — probar | RED/GREEN de cada WU + guarda `retired-journey-routes.test.ts` | abierto |
| #441 — documentar | WU8; este documento | abierto |

El cierre de la Feature y de sus Tasks lo decide el owner.

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Bitácora** — una entrada por work unit en [[odd/tasks/retire-scripted-journey]], con su commit, sus resultados RED/GREEN y la verificación independiente; se **cita**, no se re-ejecutó. (b) **Re-ejecución para este documento** — los comandos de §4.1 se corrieron de nuevo el 2026-10-10 en el árbol de trabajo de la rama (punta `295eae2`); sus números son los observados ahí.
- **Dobles, no proveedores.** Ninguna prueba PR-gated habla con Testnet, Horizon, RPC de Soroban, el LLM, Resend ni el Supabase remoto. `pnpm run test:db` y `supabase migration list --local` usan el stack local.
- **Remoto, citado.** La verificación de las migraciones en el proyecto remoto se cita de la bitácora (2026-10-09); para este documento **no** se consultó el remoto.
- **Sin secretos ni claims de producción.** Ningún email, contraseña, seed, clave ni token aparece aquí. Todo corre sobre Testnet, sin valor económico; un hash de Testnet demuestra ejecución técnica, no una inversión real.

## 3. Qué quedó implementado

Fuente: bitácora (WU1–WU7b, 2026-10-09 y 2026-10-10).

| WU | Qué entrega | Commit(s) |
|---|---|---|
| WU1 | Persiste el hash de despliegue y el de cada aporte; migración `20261009150000` | `8452329` |
| WU2 | Ruta ADMIN `GET /application-reviews/:applicationId/evidence` con la cadena completa | `178fc2a` |
| WU3 | Hashes y links al explorador en portafolio, informes, mis campañas y detalle; migración `20261009160000` | `aa79d1e` |
| WU4 | Vista admin `/admin/pymes/[applicationId]/evidence` | `d165c28` |
| WU5 | Hashes y links en las vistas web por rol | `4a5db4e` |
| WU5b | Correcciones de la verificación de WU5 | `b338759`, `4bbe99c` |
| WU6 | Retiro de las seis rutas, su engine y el código muerto | `709fc28`, `3213933` |
| WU7 | Documentación alineada | `14f0735` |
| WU7b | Guía del operador reescrita y notas de diseño | `13ea32f` |

### 3.1 WU1 — Persistir el hash de despliegue y el de cada aporte (`8452329`)

- **Despliegue:** columna `campaign.deploy_transaction_hash` (nullable, `CHECK ^[0-9a-f]{64}$`), escrita por `open-campaign` desde `factory.deploy().hash`. Cubre el despliegue por aprobación admin (#410) y `POST /campaigns`.
- **Aporte:** tabla `campaign_contribution_transaction` (hash, campaña, inversor, monto, `observed_at`). El envío registra la fila **antes** de mandar la transacción (`insert … on conflict do nothing`; si falla, 503 sin enviar nada). El sondeo estampa `observed_at` al ver `success` con un `UPDATE … WHERE observed_at IS NULL` idempotente. Sólo las filas con `observed_at` son evidencia.
- **Grants:** RLS sin políticas; nada para `anon`/`authenticated`; `service_role` con `SELECT, INSERT` y `UPDATE` sólo de `observed_at, last_correlation_id`; sin `DELETE`. Errores saneados a `{ code: "unavailable" }`.
- **Lo anterior a #438** queda `NULL` o sin fila: se muestra «Sin dato», nunca cero.

### 3.2 WU2 — Cadena de evidencia ADMIN por solicitud (`178fc2a`)

`GET /application-reviews/:applicationId/evidence`, `only("ADMIN")` (fila en la MATRIX de `authorization.test.ts`), sólo lectura y **sin llamar a la cadena**. Contrato `AdminApplicationEvidence` en `packages/contracts`: decisión, despliegue (hash + URL), bóveda (dirección + URL), aportes observados, distribuciones (`listByCampaign`) y la reconciliación **guardada**. Solicitud inexistente → 404; datos ausentes → `null` o listas vacías; cualquier otra lectura fallida → 503 `{ code: "unavailable" }`, nunca una cadena parcial. Las URL del explorador las arma la API desde `StellarConfig.explorerUrl`; en `local` son `null`. `apps/api/src/index.ts` se agregó a la superficie con autorización del owner para servir la ruta.

### 3.3 WU3 — Hashes y links para inversor, PyME y detalle (`aa79d1e`)

| Superficie | Campos nuevos |
|---|---|
| `GET /portfolio` | `vaultExplorerUrl`, `transactions[]` por posición; hash + `explorerUrl` por distribución |
| `GET /reports` | hash + `explorerUrl` en «Últimas distribuciones»; `contributionTransactions[]` del período |
| `GET /my-campaigns` | `vaultExplorerUrl`; hash + `explorerUrl` por distribución |
| `GET /marketplace/campaigns/:id` | `vaultExplorerUrl` |

Migración `20261009160000`: `transaction_hash` **agregada al final** de tres vistas de rol y vista nueva `investor_contribution_transaction`; las cuatro `security_invoker = true`, `SELECT` sólo para `service_role`. El inversor y la PyME se resuelven desde el principal verificado; un `?investor=` o `?account=` ajeno se ignora.

### 3.4 WU4 — Vista admin de la cadena (`d165c28`)

Ruta `/admin/pymes/[applicationId]/evidence` (bajo `AdminConsoleGate`), con seis pasos: Solicitud → Decisión humana → Despliegue de la bóveda → Aportes → Distribuciones → Reconciliación. Se llega desde «Evidencia» en la fila de la cola y desde «Ver evidencia Testnet» en la revisión. Compuesta sólo con tokens y componentes del template (autorización del owner, D3); verde sólo para lo confirmado en el ledger; «Enviada · pendiente de confirmación» en tono de precaución; todo estado es texto + ícono. Módulos nuevos (`application/admin/evidence.ts`, `evidence-chain.tsx`) en vez de reusar `EvidenceTimeline`, que se borra en WU6.

### 3.5 WU5 y WU5b — Vistas por rol (`4a5db4e`, `b338759`, `4bbe99c`)

- **WU5:** campos **requeridos** en los cuatro puertos web (opción A del owner: un gateway que olvide mapear un campo falla en typecheck en vez de mostrar «Sin dato» en silencio). `ExplorerProof` nuevo (fila compacta «CDLZ…7Q4K Explorador» del diálogo «Revisión antes de firmar») en `/portfolio`, `/reports` (sección «Aportes en el período» y columnas en el CSV), `/company` y el detalle de campaña. `HashDisplay` con anillo de foco y nombre accesible distinguible.
- **WU5b (autorizado por el owner):** neutraliza fórmulas en el CSV (`= + - @`, TAB, CR; luego también tras espacios, en ancho completo y el pipe DDE `|`); avisa los aportes sin hash en una posición mixta, con matemática exacta en stroops `bigint`; alinea el nombre accesible de `ExplorerProof` para que empiece por el texto visible (WCAG 2.5.3).

### 3.6 WU6 — Retiro (`709fc28`, `3213933`)

- Las seis rutas **no existen**: Next responde **404**. No se decidió ninguna redirección y no se agregó.
- Borrado: 212 archivos, +190 / −16265 líneas (`git diff --stat 3ca174c 709fc28`): `app/(demo)/`, los 25 componentes del recorrido, el `journey-store` y su provider, fixtures, gateways de assessment/decision/manual-review, e2e del recorrido y `campaign-vault.live.spec.ts` con sus soportes. Además, 13 módulos que ya eran código muerto antes de #438.
- Guarda `apps/web/src/app/retired-journey-routes.test.ts`: ninguna `page.*` resuelve a una de las seis rutas, ningún archivo de `apps/web/src` las contiene como literal (incluidas subrutas, `3213933`) y el matcher no confunde rutas vivas parecidas.
- Readiness de las dos configs de Playwright movida a `/login`. Superficie ampliada con autorización del owner: `tests/monthly-sales-feed-parity*` (borrados), `tests/testing-and-ci-gates.test.ts`, `tests/web-holds-no-network-passphrase.test.ts`.
- El patrón `journey-store` ya no tiene reuso: la nota de Zustand de `AGENTS.md`/`CLAUDE.md` apunta ahora a `session-store.ts`.

### 3.7 Migraciones

| Migración | Local | Remoto (2026-10-09, autorización del owner, vía MCP) |
|---|---|---|
| `20261009150000_persist_vault_transaction_hashes` | aplicada; `test:db` 23 / 846 PASS (WU1) | `version` alineado a `20261009150000`; `campaign.deploy_transaction_hash` presente; `campaign_contribution_transaction` con RLS y 0 políticas; tabla `service_role: SELECT, INSERT`, nada para `anon`/`authenticated`; `UPDATE` de columna `service_role: observed_at, last_correlation_id` |
| `20261009160000_expose_transaction_hashes_in_role_views` | aplicada; `test:db` 23 / 869 PASS (WU3) | `version` alineado a `20261009160000`; cuatro vistas `security_invoker=true`; `SELECT` sólo `service_role`; `transaction_hash` última columna en las tres vistas modificadas; antes de aplicar, 0 filas de `revenue_share_distribution` fuera de `^[0-9a-f]{64}$` |

Fuente remoto: bitácora (WU1 y WU3). Fuente local: re-ejecución de §4.1.

### 3.8 WU7 y WU7b — Documentación (`14f0735`, `13ea32f`)

- **WU7:** `README.md`, `AGENTS.md`/`CLAUDE.md` (gemelos idénticos), `DEMO.md`, `demo-tasks-list.md`, `demo-run-preflight.md`, `environments.md`, `identity-and-rls-boundaries.md`, `deploy-planning.md` y una nota fechada en `odd/tasks/application-review-and-vault-deployment.md`. Ningún `*-evidence.md` ni registro histórico se reescribió.
- **WU7b (decisión del owner, 2026-10-10):** `docs/guides/freighter-and-testnet-walkthrough.md` reescrita para los flujos por rol (PyME → ADMIN → INVERSOR → PyME → evidencia), verificada contra el código; notas fechadas en `demo-ui.md`, `claude-design-brief.md` y `claude-design-continuation-pack.md`, sin reescribir su historia.

## 4. Qué quedó probado

### 4.1 Re-ejecución en el árbol de trabajo (2026-10-10, punta `295eae2`)

| Comando | Resultado observado |
|---|---|
| `pnpm run verify` | **exit 0 en la primera corrida, sin reintentos.** contracts 24 archivos / **661**; domain 2 / **120**; ai 8 / **143**; api 124 / **2617**; web 194 / **1964**; lint sin advertencias; «no dependency violations found (1073 modules, 3602 dependencies cruised)»; `test:boundaries` 9 archivos / **163** |
| `pnpm --filter @vaqcrow/web build` | ok. Rutas: `/`, `/_not-found`, `/admin`, `/admin/pymes`, `/admin/pymes/[applicationId]`, `/admin/pymes/[applicationId]/evidence`, `/campaigns/[id]`, `/company`, `/explore`, `/login`, `/portfolio`, `/reports`, `/signup`. **Ninguna de las seis** |
| `pnpm --filter @vaqcrow/web exec vitest run src/app/retired-journey-routes.test.ts` | 1 archivo / **3 passed** |
| `pnpm --filter @vaqcrow/web exec playwright test` (stub) | **14 passed**, 0 failed |
| `pnpm run env:docker:status` | Supabase local, Stellar Quickstart y API sanos |
| `supabase migration list --local` | `20261009150000` y `20261009160000` aplicadas en la base local |
| `pnpm run test:db` | «Files=23, Tests=869 … Result: PASS» |
| `fd -t d '\(demo\)' apps/web/src` · `rg 'Empezar el recorrido\|Recorré la demo' apps/web/src` | sin resultados: no queda el directorio `(demo)` ni el bloque de la landing |

### 4.2 RED → GREEN por work unit

Fuente: bitácora.

| WU | RED observado | GREEN |
|---|---|---|
| WU1 | 10 tests fallando (4 archivos) | 99/99; api 2539; `test:db` 846 PASS |
| WU2 | contrato, use case, ruta y factory inexistentes; adaptadores 4 + 3 fallando | contracts 646; api 2588 |
| WU3 | pgTAP «Tests=831 … FAIL»; contratos 28 fallando; use cases, adaptadores y rutas fallando | pgTAP 869 PASS; contracts 661; api 2617; web 2430 |
| WU4 | builder, hook y vista inexistentes; gateway 6 fallando; enlaces 2 fallando | web 2474; e2e `admin-review.spec.ts` 5/5 |
| WU5 | gateways 4 fallando; `ExplorerProof` inexistente; selectores y componentes fallando | web 2510 |
| WU5b | CSV 1, posición 5, nombre accesible 9 fallando; endurecimiento CSV 1 fallando | web 2518; `application/reports` 47/47 |
| WU6 | guarda: 2 de 3 fallando (~50 archivos ofensores); subrutas 1 fallando | 3/3; web 1964; Playwright stub 14 passed |
| WU7 / WU7b | sin RED: sólo documentación | `cmp AGENTS.md CLAUDE.md` sin diferencias; barrido `rg`; `verify` exit 0 |

RED no observado por separado (registrado en la bitácora): pgTAP de WU1 (migración aplicada antes de la suite), `contractExplorerUrl` (WU2), `evidence-chain.test.tsx` (WU4).

### 4.3 Verificación independiente por work unit (RDD off)

Fuente: bitácora. Un verificador read-only por writer delegado.

| WU | Veredicto | Notas y cómo se resolvieron |
|---|---|---|
| WU1 | PASS con notas | Upsert de PostgREST bajo el grant de columna probado sólo a nivel SQL; el registro usa `command.*` en vez de `verification.value.*` (equivalentes). Sin cambio: baja severidad. |
| WU2 | PASS con notas | `campaign.application_id` no es único (dos campañas → 503, falla cerrado); la ruta no re-parsea su salida; `companyName` asume una empresa por PyME. Sin cambio: comportamiento previo o supuesto registrado. |
| WU3 | PASS con notas | `revenue_share_distribution.transaction_hash` sin `CHECK` de formato (hoy 0 filas); transacciones sin posición se descartan. Registrado como pendiente opcional (§5). |
| WU4 | PASS con notas | `HashDisplay` sin anillo de foco y con nombre accesible genérico. **Corregido en WU5.** |
| WU5 | PASS con notas | (1) nombre accesible de `ExplorerProof` sin el texto visible contiguo; (2) posición mixta sin aviso de aportes sin hash; (3) CSV sin neutralizar fórmulas (previo a #438). **Corregidas en WU5b** (`b338759`). |
| WU5b | PASS con notas | Prefijo de fórmula tras espacios, ancho completo y `\|`. **Corregido en `4bbe99c`.** Informativas sin cambio: suma con hash mayor que el total no muestra línea; `xlmToStroops` rechaza cero. |
| WU6 | PASS con notas | (1) el matcher no veía subrutas: **corregido en `3213933`**; (2) el guard no escanea `next.config` (hoy sin redirects); (3) dataset de ventas de la API sin gemelo web: registrado (§5). |
| WU7 / WU7b | — | Sin verificador independiente registrado; chequeo estructural (`cmp`, barrido `rg`) y `verify` exit 0. |

### 4.4 No re-ejecutado

- **Testnet / Horizon / RPC:** ninguna transacción real para este documento.
- **e2e live** (`playwright.live.config.ts`) y **`test:integration`** contra Supabase: fuera del gate, no corridos.
- **Proyecto remoto:** su verificación se cita de la bitácora (2026-10-09).

## 5. Límites y pendientes del owner

- **Copy sin diseño en el template, pendiente de aprobación:** la vista de evidencia admin (WU4), las filas de prueba por rol, «Aportes en el período» y las columnas del CSV (WU5), «Aportes anteriores sin hash registrado…» y el formato de nombre accesible (WU5b). Listas completas en la bitácora.
- **`application/distribution/derivation-failure-copy.ts`** (vivo en la firma de distribución de la PyME) dice «Retome el recorrido…» en tres mensajes; cambiarlo es copy visible y queda para el owner.
- **Rutas ADMIN sin llamador web** tras el retiro: `POST /assessments`, `…/assessment`, `…/manual-review`, `…/decisions`. #438 no las borra; seguimiento.
- **Sin e2e live del aporte, retiro y reembolso desde la UI:** se borró `campaign-vault.live.spec.ts`; el ensayo live U9 aporta por API. Cobertura actual: componente y API.
- **Tras el merge a `main`:** re-apuntar `STELLAR_CAMPAIGN_FACTORY_ID` en Railway a la fábrica vigente (`application-review-and-vault-deployment-evidence.md:308`).
- **Opcional:** `CHECK (^[0-9a-f]{64}$)` en `revenue_share_distribution.transaction_hash`, como ya tienen los hashes de despliegue y de aporte.
- **Dataset simulado de ventas de la API sin gemelo web:** la guarda de paridad se borró en WU6; nada compara las dos copias.
- **Datos anteriores a #438:** despliegues y aportes previos muestran «Sin dato» (nunca cero); `observed_at` es el instante de la lectura que confirmó el éxito, no el cierre del ledger.
- **La cadena admin con bóveda, aportes y distribuciones** está cubierta por tests de componente; el e2e cubre la navegación y el estado sin bóveda.

## 6. Decisiones del owner

| # / fecha | Pregunta | Resolución |
|---|---|---|
| D1 — 2026-10-09 | Bloque de la landing «Recorré la demo completa… Empezar el recorrido» (pregunta abierta del issue). | **Se elimina en forma definitiva.** La landing de #418 nunca lo implementó; no se agrega. |
| D2 — 2026-10-09 | Dónde vive la evidencia Testnet del recorrido (pregunta abierta del issue). | **Repartida por rol**, sin página pública dedicada; `/evidence` se borra sólo después de verificar el reemplazo de cada dato. |
| D3 — 2026-10-09 | Huecos sin reemplazo (link a la bóveda, hash de distribución del inversor, reconciliación). | **Cubrir todos.** El ADMIN ve la cadena completa por campaña, desde la lista de PyMEs; diseñada con tokens y componentes del template, sin colores inventados. |
| D4 — 2026-10-09 | Estrategia de entrega. | **`feature-branch-chain`**, como en #434. |
| Opción A de WU5 — 2026-10-10 | Los puertos web no declaraban los campos de WU3. | Campos **requeridos** en los cuatro puertos web; se ampliaron las superficies a puertos, gateways y fixtures. |
| WU5b — 2026-10-10 | Notas de la verificación de WU5. | Corregir las tres; autorizó además el único test fuera de superficie. |
| 404, no redirección — WU6 | El issue admite «404/redirect as decided». | No se decidió ninguna redirección: las rutas no existen y responden 404. |
| Superficies de WU2 y WU6 | `apps/api/src/index.ts` (WU2) y las guardas de `tests/` (WU6), fuera de las superficies iniciales. | Autorizadas por el owner tal como se propusieron. |
| WU7b — 2026-10-10 | Guía del operador y documentos de diseño fuera de la superficie de WU7. | Reescribir la guía para los flujos por rol; notas fechadas en los tres documentos de diseño, sin reescribir su historia. |
| Opción A de la pila | Camino a `main`. | #438 lleva toda la pila a `main`; se abre la PR con autorización del owner. |

Ninguna pregunta abierta del issue se implementó antes de su decisión.

## 7. Mapeo de criterios de aceptación (citados textualmente)

Leyenda: ✅ cumplido · ⚠️ cumplido con salvedad declarada · ❌ no cumplido.

### 7.1 Feature #438

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The six routes no longer exist in the application and no link points to them." | ✅ En la rama no queda `(demo)/`; `next build` no lista ninguna de las seis; la guarda falla si una `page.*` o un literal (incluidas subrutas) las trae de vuelta. | §3.6; §4.1 (`build`, guarda 3/3, `fd`) |
| 2 | "Their replacement features are live and verified before removal; `pnpm run verify` passes." | ⚠️ Los reemplazos (WU1–WU5b) se commitearon y verificaron **antes** del retiro (WU6), cada uno con `verify` exit 0 y verificador independiente; `verify` vuelve a pasar hoy. Salvedad: «live» significa verificados en la rama, **no** desplegados en `main`; sólo las migraciones están en el remoto. | §3, §4.1–4.3 |
| 3 | "Docs, tests and fixtures referencing the routes are updated or removed; no dead links remain." | ✅ Tests, fixtures y e2e del recorrido borrados; readiness de Playwright a `/login`; documentación vigente alineada (WU7, WU7b). Los `*-evidence.md` y registros históricos se conservan a propósito, como pide el issue. | §3.6, §3.8 |
| 4 | "Open questions above are decided by the owner before the landing block is changed." | ✅ D1 (2026-10-09): el bloque se elimina; la landing nunca lo tuvo y no se tocó. | §6 |
| 5 | "Required evidence and failure behavior are covered." | ⚠️ Cobertura determinística completa: 404 de la cadena admin, 503 saneado, «Sin dato» nunca cero, aislamiento por principal, CSV neutralizado, guarda de rutas. Salvedad: el aporte, retiro y reembolso desde la UI quedaron **sin e2e live** al borrar `campaign-vault.live.spec.ts`. | §3.1–3.6, §4.2, §5 |
| 6 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ Las dos preguntas abiertas se resolvieron en D1 y D2/D3 antes de implementarse; el copy sin diseño se declara owner-pending. | §6, §5 |
| 7 | "No unsupported production claims or secrets are introduced." | ✅ Sin secretos, seeds ni PII; la web no arma URLs de red ni conoce la passphrase (guarda `web-holds-no-network-passphrase`); Testnet sin valor económico. | §4.1 (`verify`); revisión de este documento |

### 7.2 Task #439 — implementar

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Feature #438 behavior is implemented within its documented boundary, matching the template screens and copy it cites." | ⚠️ El retiro y la evidencia por rol están implementados dentro de `boundaries`; la única pantalla citada (Landing) queda sin el bloque (D1). Salvedad: las vistas nuevas no tienen pantalla en el template; se compusieron con sus tokens y componentes (D3) y su copy queda **pendiente de aprobación del owner**. | §3.4–3.5, §5, §6 |
| 2 | "Failure paths remain truthful and do not weaken security, simulation, non-custodial or human-control boundaries." | ✅ `only("ADMIN")` con MATRIX; aislamiento por principal verificado; errores saneados; falla cerrado ante datos ambiguos; «Enviada · pendiente de confirmación» hasta el ledger; ninguna firma nueva ni manejo de claves. | §3.2–3.4, §4.3 |
| 3 | "No behavior outside the template is invented; open questions are not implemented before the owner decides." | ✅ D1–D4 antes de implementar; la vista admin con autorización expresa (D3); no se agregó redirección sin decisión. | §6 |

### 7.3 Task #440 — probar

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Deterministic tests or bounded rehearsal checks demonstrate the core behavior of Feature #438." | ✅ Guarda de rutas (3/3), `next build` sin las seis, suites por WU con RED observado y Playwright stub 14 passed; nada depende de Testnet ni del LLM. | §4.1, §4.2 |
| 2 | "Validation, rejection, and fallback behavior is covered where applicable." | ✅ 401/403/404/503 de la ruta admin; parámetros de cuenta ajenos ignorados; `explorerUrl` nulo sin link; «Sin dato» para lo histórico; contrato estricto en la web (`unavailable`). | §3.2–3.5, §4.2 |
| 3 | "The focused verification passes without exposing sensitive data." | ✅ `verify` exit 0, `test:db` PASS; los errores no filtran `message`/`details`/`hint`; los tests usan `https://explorer.example/...`. | §4.1 |

### 7.4 Task #441 — documentar

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "Evidence identifies Feature #438, verification commands or rehearsal steps, and observed results." | ✅ Comandos re-ejecutados con sus números (§4.1) y resultados citados de la bitácora. | §4 |
| 2 | "`docs/planning/retire-scripted-demo-journey-evidence.md` exists, is written in Spanish and follows the sibling evidence documents." | ⚠️ Escrito en español y con la estructura de `pyme-mi-campana-dashboard-evidence.md`. Salvedad: el archivo se llama `retire-scripted-journey-evidence.md`, el nombre que fijaron `demo-tasks-list.md` y la bitácora, no el del issue. | Este documento |
| 3 | "Evidence is traceable to implementation and focused verification." | ✅ Cada WU con su commit; cada resultado con su fuente (bitácora o re-ejecución). | §3, §4 |
| 4 | "Sensitive data and unsupported production claims are excluded." | ✅ Sin secretos, PII, seeds ni XDR; sin claims de producción ni estado mergeado. | Revisión de este documento |

**Resumen:** 17 criterios — 13 ✅, 4 ⚠️, 0 ❌.

## 8. Estado de entrega y próximos pasos

- **Nada de #438 está en `main`.** Todo vive en la rama de #438, apilada sobre #434 y el resto de la pila por roles. Con autorización del owner se abre una PR hacia `main`; el merge lo decide el owner.
- **En el remoto ya están** las migraciones `20261009150000` y `20261009160000` (2026-10-09).
- **Después del merge:** re-apuntar `STELLAR_CAMPAIGN_FACTORY_ID` en Railway (§5) y decidir los pendientes de copy y de seguimiento.
- El cierre de la Feature #438 y de las Tasks #439/#440/#441 lo decide el owner.
