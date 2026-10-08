# Bitácora — Feature #414: Explorar PyMEs y API de listado de campañas

Rama: `Vaqcrow#414_Feat_Explore_PyMEs_marketplace_and_campaign_listing_API`, creada desde la punta de la pila #406/#410 (`1b1138c`).

## Objetivo

Entregar el marketplace público **«Explorar PyMEs»** y el endpoint de listado de campañas que hoy falta y que lo alimenta. Sólo aparecen campañas **publicadas** (bóveda confirmada).

## Problema y por qué

La pila ya permite que una PyME se registre, sea revisada y aprobada, y que la bóveda se despliegue y confirme. Falta el lado inversor público: un marketplace con búsqueda, filtros avanzados, orden y favoritos, y los estados de carga/error/vacío del template, alimentado por un listado público que hoy no existe (`GET /health` es la única ruta pública).

## Alcance autorizado

- Endpoint público de listado de campañas publicadas + contrato en `packages/contracts`.
- Vista `/explore` (ruta ya reservada en `apps/web/src/application/navigation/shell-nav.ts:54`), con búsqueda, filtros avanzados (modal con borrador), chips, orden, favoritos y los tres estados.
- Favoritos persistidos por cuenta (tabla + endpoints + RLS).
- Imagen real de la PyME servida por la API desde el bucket privado.
- Reusar `CampaignCard` (#314), `Badge`, `ProgressBar`, `Skeleton`, `EmptyState` y `Modal` de HeroUI.
- Tests, evidencia y bitácora en el mismo work unit.

## Restricciones

- Fuente visual: `docs/design/template/Vaqcrow Explorar PyMEs.dc.html` (el template manda; `demo-ui.md` §2 manda en reglas de confianza/accesibilidad).
- No inventar estados ni copy que el template no diseñe; lo no diseñado lo decide el owner.
- `packages/contracts` portable (sin Node/Fastify); `apps/web` consume sólo contratos; `presentation/` no importa `@vaqcrow/contracts` salvo type-only; `application/` (web) sin React.
- Nunca prometer retorno; riesgo siempre texto + ícono (nunca sólo color); `SIMULADO`/`DEMO`/`TESTNET`; «Sin dato / faltante» nunca es cero.
- Sólo campañas publicadas, sin PII de la PyME.

## Decisiones del owner (2026-10-08)

| # | Pregunta del issue | Resolución |
|---|---|---|
| D1 | ¿Los favoritos persisten y dónde? | **Sí, por cuenta**: server-side por usuario autenticado; los visitantes anónimos **no** retienen favoritos. Requiere tabla y endpoints nuevos. |
| D2 | ¿Qué imagen muestra la tarjeta? | **Foto real de la PyME**, servida por la API desde el bucket privado (URL firmada o proxy). El rótulo «Imagen representativa» aplica a las fotos de stock, no a la foto real; el template **no** lo diseña. |
| D3 | ¿Paginación o scroll infinito? | **Sin paginación**: una sola grilla, como el template. |

## Decisiones técnicas (parent, documentadas y sujetas a confirmación)

- Endpoint de listado: `GET /marketplace/campaigns`, **PUBLIC** (el Feature pide público y amigable a rate-limit).
- Filtro «publicada»: `campaign_deployment.state='confirmed'` **y** `campaign.state='open'`.
- Datos de la tarjeta: nombre, sector, ciudad, revenue share y `goal_ars` vienen de `businesses`, unidos vía `application_review → sme_request.owner_user_id → businesses.owner_user_id`; el riesgo viene del assessment de IA.
- `raised` se lee del mirror `campaign.total_stroops`; la conversión a ARS usa el snapshot entero de la campaña (sin floats).
- Imagen: un endpoint de imagen (p. ej. `GET /marketplace/campaigns/:id/image`) o una URL firmada; se define en WU3. En WU1 el contrato reserva `imageUrl: string | null`.

## Tareas

- [x] **WU1 — Endpoint de listado (backend).** Contrato en `packages/contracts`, port, adaptador (join a `businesses`), caso de uso, ruta PUBLIC y política. Sólo campañas publicadas. Sin `apps/web`.
- [x] **WU2 — Favoritos persistidos (backend).** Tabla `campaign_favorite` (por usuario, RLS user-only), repositorio y endpoints AUTHENTICATED (listar/activar/desactivar). El listado puede marcar `isFavorite` del solicitante.
- [x] **WU3 — Imagen real de la PyME.** Servir una foto aprobada de la PyME al marketplace público (endpoint o URL firmada), sin exponer el bucket.
- [ ] **WU4 — Vista `/explore` (web).** Búsqueda, filtros avanzados con borrador/aplicar/descartar, chips, orden, tarjetas con imagen y corazón, y los estados carga/error/vacío.
- [ ] **WU5 — Favoritos en la UI.** «Mis favoritos» con contador, corazón por tarjeta y comportamiento para visitante anónimo (a definir).
- [ ] **WU6 — Verificación y evidencia.** Suites, `verify`, y `docs/planning/explore-pymes-marketplace-and-listing-api-evidence.md`.

Forecast: ~1.500–2.200 líneas autoradas (por encima de ~400 → estrategia de entrega a decidir con el owner).

## Checks aplicables

- `pnpm --filter @vaqcrow/contracts test`
- `pnpm --filter @vaqcrow/api test`
- `pnpm --filter @vaqcrow/web exec vitest run --maxWorkers=4`
- `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`, `pnpm run boundaries`, `pnpm run test:boundaries`
- `pnpm run test:db` si algún work unit toca el esquema o una vista.
- `pnpm run verify` al cierre de cada work unit.

## Progreso

### WU1 — Endpoint público de listado (commit `6141796`)

Ruta: **delegado** (un writer; contrato + port + caso de uso + adaptador + vista SQL + ruta + política, 2+ archivos no triviales). Sin `apps/web`.

- **RED/GREEN observado.** Contrato: 5 fallidos antes de existir el schema. API: módulos `list-marketplace-campaigns`/`supabase-marketplace-campaign-repository` inexistentes y la ruta respondía `404`. GREEN: `contracts` **550**; `api` **2243** (100 archivos); `typecheck` 8/8; `lint` 5/5 sin errores; `boundaries` sin violaciones (939 módulos, 3060 dependencias); `test:boundaries` **164**.
- **Diseño.** Vista SQL `public.marketplace_campaign` (`security_invoker = true`, `revoke all` + `select` sólo a `service_role`) siguiendo el patrón de `admin_sme_request_queue`: filtra `campaign_deployment.state = 'confirmed'` **y** `campaign.state = 'open'`; join INNER lateral a `businesses` vía `sme_request.owner_user_id` (no hay FK, PostgREST no puede embeber); riesgo desde `application_assessment.assessment` (`application_id` es PK → sin duplicados). Endpoint `GET /marketplace/campaigns` **PUBLIC** (segunda ruta pública después de `/health`); sin paginación (D3); `Cache-Control: public, max-age=30, stale-while-revalidate=30`.
- **Conversión entera.** `raisedArs = total_stroops * usd_to_ars / (stroops_per_usd * RATE_SCALE)` (inverso exacto del `goalArsToStroops` de T5b, `BigInt`, sin floats); `fundedPercentBps = total_stroops*10000/goal_stroops` con clamp `0..10000`; sin snapshot → `null` (nunca cero). `imageUrl` reservado en `null` (WU3).
- **Verificación independiente (RDD off; assess `high`/no evaluable).** Un verifier read-only dio **sin bloqueantes**. Follow-ups bajos anotados: (a) el join se apoya en `campaign.application_id` (no único), pero el guard `findByApplicationId` de la aplicación lo hace 1:1; (b) el INNER join descarta una campaña publicada sin empresa (intencional y documentado, sin test). Ninguno bloquea el commit.
- **Gate completo.** `pnpm run verify` cayó en la 1.ª corrida por el flake conocido (3 timeouts de 5 s en `apps/web`, archivos ajenos); la 2.ª corrida pasó (los 8 tasks verdes).
- **Migración.** `20261008130000_create_marketplace_campaign_view.sql` probada **en local** (`marketplace_campaign.sql` ok; `campaign_persistence.sql` ok tras agregar `drop view if exists public.marketplace_campaign` a su reversión). **Aplicación al remoto pendiente de autorización del owner.**
- **Límite explícito.** Sin `apps/web`; sin imágenes ni favoritos (WU2/WU3).

- **Work-unit commit.** `6141796 feat(api): list published campaigns for the marketplace (#414)`.

### WU2 — Favoritos persistidos por cuenta (commit `ba4660e`)

Ruta: **delegado** (un writer; contrato + port + adaptador + 2 casos de uso + ruta + política + migración, 2+ archivos no triviales). Sin `apps/web`. El primer intento devolvió un resultado **vacío** a mitad (dejó tests + port + adaptador + contrato + migración, sin las implementaciones); un segundo writer acotado completó el work unit.

- **Diseño (D1).** Tabla `public.campaign_favorite` (`user_id`, `campaign_id`, PK compuesta, FK `campaign_id → campaign(campaign_id) on delete cascade`, índice de la FK); RLS on con cero policies y grants sólo `service_role` (`select`/`insert`/`delete`, sin `update`). Endpoints `GET /favorites`, `PUT`/`DELETE /favorites/:campaignId`, todos **AUTHENTICATED**, con `userId` tomado **sólo** de `request.principal.userId` (un `userId` de body/query se ignora). Alta idempotente (`23505` → `applied:false`); baja idempotente; campaña desconocida `404`; id no-UUID `400`; fallo `503`. El listado público de WU1 queda **sin** auth: la web fusiona los favoritos desde `GET /favorites` cuando hay sesión.
- **RED/GREEN observado.** RED: módulos `list-favorites`/`set-favorite` inexistentes y la ruta `404` (13 fallidos). GREEN: favoritos **31** (4 archivos); contracts **554**; api **2297** (104 archivos); typecheck 8/8; lint 5/5; boundaries sin violaciones (950 módulos, 3091 dependencias); test:boundaries 164.
- **Migración.** `20261008195155_create_campaign_favorite.sql` probada **en local** (`campaign_favorite.sql` ok; `campaign_persistence.sql` ok tras agregar `drop table if exists public.campaign_favorite` a su reversión, por la FK). **Remoto pendiente de autorización del owner.**
- **Verificación independiente (RDD off; assess `high`).** Un verifier read-only: **sin bloqueantes**. Advisories bajos (cobertura del pgTAP): afirmar las columnas de la PK compuesta (`col_is_pk`), el conteo cero de policies y el privilegio `update` de `anon`. No afectan la corrección; quedan como hardening del test.
- **Límite explícito.** Sin `apps/web` (el corazón y «Mis favoritos» son WU5). Sin imágenes (WU3).

- **Work-unit commit.** `ba4660e feat(api): persist per-account campaign favorites (#414)`.

### WU3 — Foto real de la PyME servida al marketplace (commit `c1c731f`)

Ruta: **delegado** (un writer; migración de vista + port + adaptador + caso de uso + ruta + contrato + wiring, 2+ archivos no triviales). Sin `apps/web`.

- **Diseño (D2).** Endpoint **PUBLIC** `GET /marketplace/campaigns/:campaignId/image` que sirve los bytes de la **primera foto** (más antigua por `created_at`, luego `id`; `kind='photo'` y content type de imagen) de la PyME de una campaña **publicada**. La vista `marketplace_campaign` se extendió con `image_object_path`/`image_content_type` (nullable) vía `create or replace view` (columnas nuevas al final, `security_invoker` y grants re-afirmados; `owner_user_id` usado sólo dentro del lateral, nunca en el select). El listado setea `imageUrl` a la ruta API-relativa `/marketplace/campaigns/<id>/image` (o `null`); el contrato valida esa forma (nunca URL absoluta ni path del bucket). Reutiliza el único `StoragePort`/`SupabaseStorageAdapter` (sin segundo cliente). Headers: `Content-Type` real, `Content-Disposition: inline`, `Cache-Control: public, max-age=300`, `nosniff`; `404` sin imagen/no publicada; `503` saneado.
- **RED/GREEN observado.** RED: contrato 1 fallido; API módulos/ruta `404` (13 fallidos). GREEN: contracts **554**; api **2315** (105 archivos); typecheck 8/8; lint 5/5; boundaries sin violaciones (952 módulos, 3102 dependencias); test:boundaries 164.
- **Hallazgo de la verificación independiente (bloqueante) y corrección.** El verifier read-only marcó un **bloqueante**: el lateral de la imagen filtraba sólo por content type, así que un documento obligatorio (CUIT/estatuto/declaraciones) subido como JPEG/PNG podía servirse **públicamente** como la foto de la campaña. Corrección acotada: `and pd.kind = 'photo'` en el lateral, más fixtures pgTAP (un documento obligatorio image-typed **más antiguo** que no debe servirse; tiebreak `created_at`/`id` desacoplado) con RED→GREEN observado (**47/47**). Tras la corrección, `test:db` quedó **18/18** (el `db reset` local limpió el residuo del bucket).
- **Límite explícito.** Sin `apps/web` (la tarjeta es WU4). Migración **local**; aplicación al remoto pendiente de autorización del owner.

- **Work-unit commit.** `c1c731f feat(api): serve the PyME's real photo to the marketplace (#414)`.
