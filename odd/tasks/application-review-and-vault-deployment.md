# Bitácora — Feature #410: revisión, aprobación y despliegue de la bóveda

Rama de integración: `Vaqcrow#410_Feat_Review_applications_and_approve_to_deploy_and_publish_the_vault`.
Base: rama de integración de #406, ya reconciliada y cerrada en GitHub.

## Objetivo

Entregar la revisión admin de una solicitud real —evidencia KYC/KYB, recomendación consultiva de IA y decisión humana— y hacer que «Aprobar con límite» dispare exactamente un despliegue de bóveda firmado por la plataforma, con la clave pública de la PyME como destino inmutable, seguido de la publicación de la campaña cuando Testnet confirme.

## Problema y por qué

La pila anterior ya permite que la PyME complete la solicitud, conecte Freighter y llegue a revisión. Falta cerrar el lado humano: el admin debe inspeccionar la evidencia, registrar una decisión atribuida y convertir una aprobación en un despliegue/p publicación idempotente, sin que la IA apruebe ni Vaqcrow custodie claves.

## Alcance autorizado

- Reutilizar las rutas y puertos existentes de solicitud, assessment, decisión humana, notificaciones y campañas/vault.
- Agregar acceso admin seguro para visualizar o descargar PDFs, imágenes y fotos privadas.
- Implementar la revisión, validaciones, auditoría, despliegue idempotente, estados pendientes/fallidos y notificaciones que el owner decida.
- Mantener la firma de `factory.deploy` exclusivamente en la plataforma y el destino de la PyME inmutable.
- Actualizar tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- La IA es consultiva: nunca aprueba, calcula obligaciones ni transfiere fondos.
- No se solicitan, almacenan ni transportan seeds o claves privadas de la PyME.
- Testnet y proveedores externos quedan fuera del gate determinista; los checks PR usan dobles.
- No inventar estados, copy ni flujos que el template no diseñe sin decisión explícita del owner.
- No afirmar merge en `main` ni una rehearsal real de Testnet sin evidencia observada.

## Decisiones del owner

| # | Pregunta abierta del issue | Estado |
|---|---|---|
| D1 | ¿El admin puede inspeccionar PDFs, imágenes y fotos o sólo ver sus nombres? | **Resuelta (2026-10-06):** autorizado visor/descarga segura, con autorización admin, Storage privado y sin URLs públicas. |
| D2 | ¿Cómo se comunica «Pedir», «Requiere cambios» y «Rechazada» a la PyME? | **Resuelta (2026-10-06):** cada resultado se envía al correo registrado de la PyME y como notificación en la campana del header. Al abrirla, la app lleva al paso «Revisión humana» del wizard, donde se muestra el detalle accionable del pedido, los cambios requeridos o el rechazo. Se reutiliza #382 para email/campana; no se inventa una ruta nueva. |
| D3 | ¿Qué estados y acciones expone el review durante/después del deployment? | **Resuelta (2026-10-06):** `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada`. Un fallo muestra `Despliegue fallido`, permite **Reintentar** y ofrece **Ver detalle** en modo solo lectura. La publicación ocurre sólo después de la confirmación de Testnet. |
| D4 | ¿Qué controla «Límite aprobado» y quién define deadline/mínimo de contribución? | **Resuelta (2026-10-06):** el admin no ingresa ni modifica límites; la PyME define los términos del proyecto durante el registro. La plataforma impone un máximo de USD 50.000 equivalentes por campaña y un máximo por inversor igual al menor de 10% del objetivo y USD 5.000 equivalentes. |
| D5 | ¿Se espera a #386 antes de tocar #410? | **Resuelta (2026-10-06):** se autoriza implementar backend-first en paralelo; la integración con la consola admin queda para después de #386. |
| D6 | ¿Cómo se convierte el tope USD a ARS/XLM mientras la conversión siga simulada? | **Resuelta (2026-10-06):** tabla de tasas configurable por ADMIN, actualizada manualmente ahora y reemplazable por una fuente confiable en el futuro. Cada tasa tendrá versión, vigencia, autor, origen `manual`/`provider` y valores enteros de precisión fija; los términos de cada campaña guardarán el snapshot usado. |

## Tareas

- [x] **T0 — Resolver preguntas abiertas.** D1–D4 resueltas antes de implementar los flujos afectados.
- [ ] **T1 — Revisión admin.** Se divide en T1a backend-first (contexto de solicitud, viewer privado, KYC/KYB por documento, assessment consultivo y decisión API) y T1b integración con la consola admin después de #386.
- [ ] **T2 — Persistencia y auditoría.** Decisión atribuida al admin autenticado, transiciones condicionales e idempotencia.
- [ ] **T3 — Aprobación y vault.** Vincular la public key persistida, resolver la tasa vigente y snapshotearla en los términos, validar los términos de la PyME contra los topes duros y la regla anti-concentración, llamar al engine existente de `POST /campaigns`, evitar redeploy en replay y publicar sólo tras confirmación. Exponer `Pendiente de confirmación` → `Desplegando bóveda` → `Bóveda confirmada / PyME publicada`, más `Despliegue fallido`, **Reintentar** y **Ver detalle** solo lectura.
- [ ] **T4 — Notificaciones y fallos.** Implementar email al correo registrado y notificación en la campana para pedido, cambios requeridos, rechazo y aprobación; al abrirla, navegar al paso «Revisión humana» con el detalle correspondiente. Resolver además los estados pending/failure sin sobreafirmar resultados.
- [ ] **T5 — Verificación y evidencia.** Suites deterministas, boundaries, evidencia en español y cierre manual de #411/#412/#413/#410.

## Checks aplicables

- `pnpm --filter @vaqcrow/api test`
- `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `pnpm run boundaries`
- `pnpm run test:boundaries`
- `pnpm run test:db` cuando una migración cambie el esquema; primero local docker y luego remoto según la política del repositorio.

## Progreso

### T1a — Visor privado de documentos para admin (commit: `62d88fb`)

- **RED.** El focused run falló inicialmente con la ruta GET sin registrar y el nuevo lookup de repositorio ausente; una ejecución adicional ejercitó una excepción del repositorio que debía degradar a `503`.
- **GREEN.** `GET /storage/uploads?path=` quedó restringido a `ADMIN`, exige descriptor persistido, descarga mediante `StoragePort`, devuelve bytes con `private, no-store`, `nosniff` y filename seguro, y mapea fallos a `400`/`404`/`503` sanitizados. POST/DELETE de PyME no cambian.
- **Verificación.** `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/routes/storage.route.test.ts src/infrastructure/adapters/supabase-pyme-document-repository.test.ts` → **40 passed**; `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/authorization.test.ts` → **251 passed**.
- **RDD.** El assess indicó `medium`/`slice_budget_reached`, pero el STATUS nativo devolvió `rdd_disabled`; no se creó autoridad de review ni se modificó la preferencia del owner. La verificación de T1a queda respaldada por RED/GREEN, tests del worker y el spot-check del padre.

### T1b — Contexto agregado de revisión admin (commit: `3cac86a`)

- **RED.** Los focused tests fallaron antes de implementar porque no existían el módulo del caso de uso ni la ruta registrada.
- **GREEN.** `GET /application-reviews/:applicationId/context` quedó restringido a `ADMIN` y compone snapshot de revisión, solicitud con owner resuelto server-side, empresa opcional, descriptores privados, assessment opcional y última decisión opcional. IDs inválidos responden `400`, recursos desconocidos `404` y fallos de dependencias `503` saneados. Las ausencias opcionales no se convierten en falsos errores.
- **Verificación.** Suite enfocada del caso de uso/ruta → **17 passed**; autorización → **258 passed**; `pnpm --filter @vaqcrow/api typecheck` → **pass**.
- **RDD.** El assess acumulado indicó `medium`/`slice_budget_reached`; el STATUS nativo volvió a devolver `rdd_disabled`, sin crear autoridad de review ni modificar la preferencia del owner.

### T3 backend-first — tabla de tasas y guardrails enteros (commit: `004f2d9`)

- **RED.** Los focused tests nuevos fallaron antes de la implementación: faltaban el módulo de validación, el adaptador y el registro HTTP; las rutas devolvían `404`.
- **GREEN.** Se agregó `fx_rate` con RLS/grants sólo para `service_role`, campos enteros (`usd_to_ars` y `stroops_per_usd`), versión primaria e índice de vigencia. `POST /admin/rates` y `GET /admin/rates/current` están restringidos a `ADMIN`, atribuyen el autor al principal verificado, serializan `bigint` como strings y mapean conflictos/fallos a errores saneados. La validación pura aplica sin floats el máximo de USD 50.000 y el máximo individual `min(10% del objetivo, USD 5.000)`.
- **Verificación observada.** `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/campaign-guardrails.test.ts src/infrastructure/adapters/supabase-rate-table-repository.test.ts src/infrastructure/http/routes/rate-table.route.test.ts` → **6 passed**; `pnpm --filter @vaqcrow/api typecheck` → **pass**; `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/http/authorization.test.ts src/infrastructure/http/routes/campaign.route.test.ts` → **297 passed**.
- **Límite explícito.** Este slice no conecta todavía el snapshot de tasa a `campaign` ni invoca los guardrails desde `openCampaign`/contribuciones: los contratos actuales de términos sólo transportan `goalStroops`/`deadline`, y la autoridad de vault permanece en el engine existente. La integración de aprobación, snapshot histórico y reserva atómica de contribuciones requiere el siguiente work unit con esos seams.

- **Work-unit commit.** `004f2d9 feat(api): add admin FX rate guardrails`.

### Próximo work unit — T3a: snapshot de tasa y tope de campaña

Diseño verificado contra los seams actuales:

- `campaign-vault::contribute` ya lee `goal` del storage; el tope por inversor puede aplicarse dentro de `contribute` sin cambiar el constructor ni el `deploy` de la fábrica.
- Con el objetivo acotado a USD 50.000 equivalentes, `min(10% del objetivo, USD 5.000)` equivale exactamente a `10% del objetivo`, así que el contrato no necesita la tasa para el tope individual.
- `POST /campaigns` (`openCampaign`) es el punto de creación: ahí se resuelve la tasa vigente, se valida el tope de campaña y se snapshotearla.
- `campaign` y `CampaignRecord` no tienen campos de snapshot de tasa; requieren migración y mapeo.

T3a se limita al lado servidor (determinista, sin Testnet): migración de snapshot, puerto/repositorio/mapeo, validación en `openCampaign` con la tasa vigente y preflight de concentración en la preparación de aportes.

T3b (siguiente) aplica el tope individual atómico en `campaign-vault::contribute` con tests Rust y el paso de redeploy documentado, sin afirmar Testnet sin evidencia observada.

### T3a — Snapshot de tasa y tope de campaña (server-side)

- **RED.** Los focused tests nuevos fallaron antes de implementar: **10 failed / 66 passed**. El adaptador no persistía ni leía las columnas de snapshot; `openCampaign` no resolvía la tasa ni aplicaba los guardrails; la ruta no mapeaba `rate_unavailable`/`goal_limit_exceeded` ni hacía el preflight de concentración.
- **GREEN.**
  - Migración `20261006130000_add_campaign_rate_snapshot.sql`: agrega a `public.campaign` las columnas nullable `fx_rate_version bigint`, `usd_to_ars bigint`, `stroops_per_usd bigint` y la restricción `campaign_rate_snapshot_all_or_none` (las tres NULL o las tres NOT NULL). Sin backfill, sin FK (el snapshot es una copia, no una referencia viva) y sin cambios de grants/RLS: el grant a nivel de tabla ya cubre las columnas nuevas.
  - `CampaignRecord` gana `rateSnapshot?`; el adaptador Supabase lo mapea en insert y lectura y **omite las tres columnas** cuando no hay snapshot, dejando intacto el comportamiento previo.
  - `openCampaign` resuelve la tasa vigente vía `RateTableRepositoryPort`, valida `goalStroops <= 50_000 USD * stroopsPerUsd` con los guardrails enteros existentes (sin floats) y persiste el snapshot. Los códigos saneados `rate_unavailable` (503) y `goal_limit_exceeded` (422) se mapean en la ruta, sin texto del proveedor.
  - Preflight best-effort por inversor (`min(10% del objetivo, USD 5_000)`) en la preparación de `contribute`: usa el snapshot del mirror más la contribución leída de la cadena y responde `422 investor_limit_exceeded` antes de preparar. **No es atómico** (T3b) y se omite si la campaña no tiene snapshot (campañas previas a #410) en lugar de estimarlo con la tasa vigente.
  - La respuesta HTTP no expone campos nuevos (`apps/web` y `packages/contracts` sin tocar).
- **Idempotencia preservada.** El replay (`findByApplicationId` con fila existente) y la adopción de una bóveda ya desplegada no consultan la tabla de tasas: el snapshot se resuelve sólo en el camino de deploy nuevo.
- **Verificación observada.**
  - `pnpm --filter @vaqcrow/api exec vitest run src/application/use-cases/open-campaign.test.ts src/infrastructure/adapters/supabase-campaign-repository.test.ts src/infrastructure/http/routes/campaign.route.test.ts` → **76 passed** (tras el RED de 10 failed / 66 passed).
  - `pnpm --filter @vaqcrow/api exec vitest run src/infrastructure/campaign-dependencies.test.ts src/infrastructure/http/authorization.test.ts src/infrastructure/http/build-app.test.ts` → **296 passed**.
  - `pnpm --filter @vaqcrow/api typecheck` → **pass**.
  - Migración local: `supabase migration up --local` aplicó `20261006120000_create_fx_rate` y `20261006130000_add_campaign_rate_snapshot`; `pnpm run test:db` → 13/14 archivos ok, con `campaign_persistence.sql` **ok**. Falla ambiental **preexistente y ajena** en `pyme_documents_bucket.sql` (subtests 9, 16, 18: `have: 9, want: 3`) por 6 objetos preexistentes en el bucket local `pyme-documents` creados 2026-10-06 01:41–02:25 UTC, antes de este work unit; la migración de `campaign` no participa de ese conteo. No se aplicó ninguna migración remota ni se tocó Testnet.
- **Límite explícito.** El tope individual sólo se verifica best-effort en la API (UX); la aplicación atómica y autoritativa queda en `campaign-vault::contribute` (T3b).

- **Work-unit commit.** `fc0673b feat(api): snapshot campaign FX rate and enforce goal cap`.

## Próximo paso

T3a quedó implementado server-side. Sigue T3b: aplicar el tope individual atómico en `campaign-vault::contribute` (tests Rust y paso de redeploy), y luego `T4` (notificaciones/fallos); la integración visual de la consola espera #386.

## Guardrails adoptados

- El producto actual es **revenue share**, no acciones ni bonos; no se debe presentar la demo como una emisión de valores negociables.
- La PyME define el objetivo, deadline y mínimo durante el registro; la plataforma valida que el objetivo no supere **USD 50.000 equivalentes** mediante el tipo de cambio simulado/configurado de la demo.
- Un inversor no puede superar el menor de **10% del objetivo de la campaña** y **USD 5.000 equivalentes**. Así una sola persona nunca puede comprar el 100% del proyecto; con un objetivo de USD 50.000, el máximo individual sería USD 5.000.
- El límite debe aplicarse server-side y de forma atómica al reservar/aplicar aportes; la UI sólo lo comunica. El contrato o engine debe rechazar también cualquier aporte que lo exceda.
- La conversión se toma de una tabla de tasas: versión, `effectiveAt`, autor, origen, `usdToArs` y `stroopsPerUsd` como enteros de precisión fija. Una campaña conserva el snapshot; cambiar la tabla sólo afecta nuevos proyectos o cotizaciones aún no confirmadas.
- Estos números son una política conservadora de demo, no asesoramiento legal ni una afirmación de que sean los límites regulatorios aplicables al revenue share. La normativa argentina distingue crowdfunding de valores negociables y exige clasificación legal antes de producción.
