# Evidencia de cierre de la Feature #414 — Issue #417

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#415](https://github.com/reyduar/Vaqcrow/issues/415) (implementación), [#416](https://github.com/reyduar/Vaqcrow/issues/416) (pruebas) y [#417](https://github.com/reyduar/Vaqcrow/issues/417) (evidencia) de la Feature [#414](https://github.com/reyduar/Vaqcrow/issues/414) ("Feature: Explore PyMEs marketplace and campaign listing API"), re-ejecuta las verificaciones locales en este árbol de trabajo y mapea cada criterio de aceptación de la Feature, citado textualmente, a su resultado y a la fuente de ese resultado. La bitácora de iteración que lo alimenta es [[odd/tasks/explore-pymes-marketplace-and-listing-api|Bitácora: Explorar PyMEs y API de listado de campañas]].

> [!warning] Estado de entrega: nada de #414 está en `main`
> El trabajo vive en la rama de integración `Vaqcrow#414_Feat_Explore_PyMEs_marketplace_and_campaign_listing_API`, apilada sobre la punta de la pila #406/#410/#382/#386 (`8856864`). Nada llega a `main`: la **Opción A del owner** mergea la pila junta con el retiro del recorrido de seis pasos ([#438](https://github.com/reyduar/Vaqcrow/issues/438)). No hay PR ni merge en esta Feature y este documento no reporta un estado mergeado. La demo desplegada desde `main` todavía no muestra el marketplace público.

> [!info] 2026-10-10 — Mergeado en `main` vía [#466](https://github.com/reyduar/Vaqcrow/pull/466) (merge `2b7e0d5`).

## 1. Contexto y objetivo

La Feature #414 entrega el marketplace público **«Explorar PyMEs»** y el endpoint de listado de campañas que lo alimenta. Sólo aparecen campañas **publicadas**: la bóveda quedó confirmada (`campaign_deployment.state = 'confirmed'`) **y** la campaña está abierta (`campaign.state = 'open'`). Un visitante **sin cuenta** navega, busca, filtra, ordena y ve la foto real de cada PyME; **abrir el detalle de una campaña sí exige cuenta** (Feature de detalle, [#422](https://github.com/reyduar/Vaqcrow/issues/422)).

La entrega reutiliza el motor existente (persistencia de campaña, bóveda/despliegue de #410, bucket privado de documentos de #398, notificaciones de #382) y agrega: un listado público que consume las tablas ya persistidas, favoritos por cuenta, y una imagen real servida por la API desde el bucket privado.

| Task | Rama | Estado del issue |
|---|---|---|
| #415 — implementar | `Vaqcrow#414_Feat_Explore_PyMEs_marketplace_and_campaign_listing_API` | abierto; WU1–WU5 |
| #416 — probar | (misma rama de la Feature) | abierto |
| #417 — documentar | (misma rama de la Feature) | este documento |

La Feature #414 depende de #410 (bóveda confirmada) y desbloquea a #422. El cierre de la Feature lo decide el owner.

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Re-ejecutado** — un comando corrido el **2026-10-08** en este árbol de trabajo (rama de #414), con su salida real (§4). (b) **Bitácora** — una entrada fechada de [[odd/tasks/explore-pymes-marketplace-and-listing-api]]; se cita, **no** se re-ejecutó aquí.
- **Dobles, no proveedores.** Ninguna prueba PR-gated habla con Testnet, Horizon, RPC de Soroban, el LLM ni Supabase remoto. Las pruebas de API y de la web usan dobles y fixtures; sólo `pnpm run test:db` toca una base, y es el stack local del perfil docker.
- **Sin secretos.** Ningún email, contraseña, seed, clave privada, API key ni token aparece en este documento; las variables se nombran, nunca sus valores.
- **Sin claims de producción.** El marketplace opera sobre **Testnet** y sin valor económico; la conversión ARS↔activo sigue **simulada**; el revenue share es de demo. Nada aquí afirma disponibilidad, SLA ni valor económico.

## 3. Qué quedó implementado

Fuente: bitácora (WU1–WU5, 2026-10-08).

### 3.1 WU1 — Endpoint público de listado (`6141796`)

Contrato `marketplaceCampaignSchema`/`marketplaceCampaignListSchema` en `packages/contracts` (portable, sin Node/Fastify) con `imageUrl` como **ruta API-relativa** anclada por regex (`/marketplace/campaigns/<uuid>/image`). Vista SQL `public.marketplace_campaign` (`security_invoker = true`, `revoke all` + `select` sólo a `service_role`) que filtra `campaign_deployment.state = 'confirmed'` **y** `campaign.state = 'open'` y une `businesses` vía `sme_request.owner_user_id`; el riesgo viene de `application_assessment.assessment`. Endpoint **PUBLIC** `GET /marketplace/campaigns`, sin paginación (D3), `Cache-Control: public, max-age=30, stale-while-revalidate=30`. Migración local `20261008130000_create_marketplace_campaign_view.sql`.

### 3.2 WU2 — Favoritos persistidos por cuenta (`ba4660e`)

Tabla `public.campaign_favorite` (`user_id`, `campaign_id`, PK compuesta, FK con `on delete cascade`), RLS on con cero policies y grants sólo `service_role` (`select`/`insert`/`delete`, sin `update`). Endpoints **AUTHENTICATED** `GET /favorites`, `PUT`/`DELETE /favorites/:campaignId`; el `userId` sale **sólo** de `request.principal.userId` (un `userId` de body/query se ignora), alta/baja idempotentes, `404` para campaña desconocida, `400` para id no-UUID, `503` saneado. Contratos `favoriteCampaignListSchema`/`favoriteCampaignResultSchema` (estrictos, sin user id en el wire). Migración local `20261008195155_create_campaign_favorite.sql`.

### 3.3 WU3 — Foto real de la PyME (`c1c731f`)

Endpoint **PUBLIC** `GET /marketplace/campaigns/:campaignId/image` que sirve los bytes de la **primera** foto (`kind = 'photo'`, más antigua por `created_at` y `id`) de la PyME de una campaña publicada, leyendo del bucket privado mediante el único `StoragePort`. La vista `marketplace_campaign` se extendió con `image_object_path`/`image_content_type` (nullable); el path del bucket **nunca** viaja al caller. Headers `Content-Type` real, `Content-Disposition: inline`, `Cache-Control: public, max-age=300`, `nosniff`; `404` sin imagen/no publicada, `503` saneado. Migración local `20261008202537_add_marketplace_campaign_image.sql`.

### 3.4 WU4 — Vista `/explore` (web) (`876288c`, `623aed4`)

- **Datos y lógica (WU4a, `876288c`).** Ports `marketplace-port`/`favorite-port` (vendor-free, contratos tipo-only), gateways HTTP + factories (el listado resuelve el `imageUrl` API-relativo a un `imageSrc` **absoluto**; los favoritos mandan el Bearer sólo con sesión y mapean `401`/`403` a `unauthenticated`), lógica pura en `application/marketplace/` (filtros, orden, formato `Intl` `es-AR`: `ARS 1.234.567`, `dd/mm/aaaa`, `4,5 % de ventas`, `63 % de la meta`; view-model con «Sin dato» y «Riesgo sin dato») y hooks SWR `use-marketplace`/`use-favorites`.
- **UI (WU4b, `623aed4`).** `CampaignCard` extendida (imagen 16/10 que mueve riesgo + `SIMULADO` al overlay y cambia la fila «Riesgo» por «Cierre»; `overlayAction`; `progressSlot`) sin romper los tests previos. Vista `/explore` **pública** (fuera de `RouteGate` y del matcher del proxy; la compuerta del template «Ingresá para explorar PyMEs» **no** se renderiza), con búsqueda, modal de filtros avanzados sobre borrador (aplicar/descartar/contador en vivo), chips, orden, y los tres estados (carga/error/vacío).
- Página: `apps/web/src/app/explore/page.tsx` (`AppShell` + `ExploreMarketplaceContainer`).

### 3.5 WU5 — Favoritos en la UI (`d473edd`)

«Mis favoritos» con contador (sólo con sesión), chip «Solo favoritos», estado vacío propio de favoritos («Todavía no guardaste favoritos»), y **corazón visible para todos**: con sesión alterna el favorito server-side; un visitante **anónimo** navega a `/login?returnTo=/explore` y **vuelve a `/explore`** tras ingresar. Se agregó `safeReturnTo` (guarda interna contra open-redirect y loop de login) y el soporte de `returnTo` en `GET /login` → `AuthScreen`, con `safeReturnTo(returnTo) ?? homeRouteFor(role)` (el default por rol de D2 queda intacto). `filterMarketplaceCards` sumó `onlyFavorites` + `favoriteIds?` (con el filtro activo y el set ausente **no** conserva nada, nunca todo).

### 3.6 Rutas y contratos

| Método y ruta | Autorización | Resultado |
|---|---|---|
| `GET /marketplace/campaigns` | PUBLIC | `{ items: MarketplaceCampaign[] }`, sólo publicadas |
| `GET /marketplace/campaigns/:campaignId/image` | PUBLIC | bytes de la primera foto `kind='photo'` |
| `GET /favorites` | AUTHENTICATED | `{ campaignIds: string[] }` del principal |
| `PUT /favorites/:campaignId` | AUTHENTICATED | `{ campaignId, applied }` |
| `DELETE /favorites/:campaignId` | AUTHENTICATED | `{ campaignId, applied }` |

Contratos en `packages/contracts/src/marketplace.ts` y `favorite.ts`; la política de rutas vive en `apps/api/src/application/authorization/route-policy.ts` (su `MATRIX` espeja `ROUTE_POLICY_KEYS`).

### 3.7 Aplicación remota de las migraciones (2026-10-08)

Con **autorización explícita del owner**, las tres migraciones de #414 se probaron primero en el stack local (`pnpm run test:db`, 18/18) y luego se **aplicaron al proyecto remoto de Supabase** vía el MCP, en el mismo work unit, con el `version` del historial alineado al del repositorio:

| Archivo | `version` alineada |
|---|---|
| `20261008130000_create_marketplace_campaign_view.sql` | `20261008130000` |
| `20261008195155_create_campaign_favorite.sql` | `20261008195155` |
| `20261008202537_add_marketplace_campaign_image.sql` | `20261008202537` |

Verificado en el remoto (consultas al MCP): `marketplace_campaign` con `security_invoker=true` y **16 columnas**, `SELECT` sólo para `service_role` y **cero** grants a `anon`/`authenticated`; `campaign_favorite` con **RLS on, 0 policies** y grants sólo `service_role` (`select`/`insert`/`delete`, sin `update`); el historial remoto termina en las tres versiones del repositorio; y los **advisors no cambian** (sólo el INFO conocido de RLS-sin-policy —que ahora incluye `campaign_favorite`, el patrón intencional `service_role`-only— y el WARN de Auth preexistente).

## 4. Qué quedó probado

### 4.1 Re-ejecutado en este árbol de trabajo (2026-10-08)

Rama de #414, Node `v24.21.0`, stack local del perfil docker en marcha.

```sh
$ pnpm run verify                 # exit 0 (2ª corrida; la 1ª cae por el flake de 5 s de @vaqcrow/web)
$ pnpm run test:db                # 18 archivos / 534 tests, PASS
```

Salida real de la corrida final:

- **lint** 5/5 sin errores (1 warning preexistente ajeno: `fetch-http-client.ts`).
- **typecheck** 8/8.
- **test** — `@vaqcrow/domain` 120 · `@vaqcrow/contracts` **554** · `@vaqcrow/ai` 143 · `@vaqcrow/api` **2315** (105 archivos) · `@vaqcrow/web` **1960** (192 archivos).
- **build** 5/5.
- **boundaries** sin violaciones — **989 módulos, 3211 dependencias**.
- **test:boundaries** — 10 archivos, **164 tests**.
- **test:db** (`supabase test db --local supabase/tests`) — **18 archivos, 534 tests, PASS**, incluidos `marketplace_campaign.sql` (vista del listado) y `campaign_favorite.sql` (tabla y RLS de favoritos).

### 4.2 Verificación independiente por work unit (RDD off)

Tras cada writer delegado corrió un verificador read-only (el `assess` marca `high` por archivos sin trackear; el gate fue la verificación independiente):

| WU | Resultado | Hallazgo |
|---|---|---|
| WU1 | sin bloqueantes | advisories bajos (join por `application_id` no único, INNER join sin test) |
| WU2 | sin bloqueantes | advisories de cobertura del pgTAP (PK compuesta, `update` de `anon`) |
| WU3 | **1 bloqueante** | el lateral de la imagen filtraba sólo por content type: un documento obligatorio JPEG/PNG podía servirse como foto → corregido con `pd.kind = 'photo'` + fixtures (47/47) |
| WU4 | **1 bloqueante** | el CTA visible mostraba la forma larga; el template pide «Ver evidencia y riesgo» con el nombre en `aria-label` → corregido con `ariaLabel` + test |
| WU5 | sin bloqueantes | se endureció `safeReturnTo` (control/espacios) y se sumaron tests |

### 4.3 Cobertura de cada suite

- **contracts**: esquemas del listado y de favoritos (incluida la forma de `imageUrl`, que rechaza URLs absolutas y paths del bucket).
- **api**: caso de uso y adaptador del listado (conversión entera a ARS, bps clampados), caso de uso de la imagen, favoritos (idempotencia, `userId` del principal, códigos saneados) y las rutas con su política (`PUBLIC`/`AUTHENTICATED`).
- **web**: filtros/orden/formato/view-model puros, gateways (códigos saneados, `imageSrc` absoluto, Bearer, `401/403`→`unauthenticated`), hooks SWR (sin fabricar datos), `CampaignCard` (imagen/overlay/`progressSlot`), la vista `/explore` (estados, búsqueda, chips, orden, corazón anónimo/con sesión, favoritos) y `safeReturnTo`.
- **test:db**: la vista `marketplace_campaign` (sólo publicadas; imagen `kind='photo'`) y `campaign_favorite` (PK, FK, RLS on, cero policies, grants sólo `service_role`).

### 4.4 No re-ejecutado

- **`test:integration` contra el remoto** (fuera del gate; requiere credenciales reales): sólo se **aplicaron y verificaron** las migraciones de #414 vía MCP (§3.7), no se corrió la suite de integración.
- **Testnet / Horizon / RPC** (fuera del gate; requieren credenciales reales).
- El **flake conocido**: `pnpm run verify` cayó en su 1ª corrida por *timeouts* de 5 s de `@vaqcrow/web` bajo la carga paralela de turbo (archivo ajeno, `auth-screen.test.tsx`); la 2ª corrida pasó `exit 0`.

## 5. Límites y brechas

- **Migraciones: local y remoto al día.** Las tres migraciones de #414 se probaron en local (`test:db`, 18/18) y se **aplicaron al proyecto remoto** el 2026-10-08 con autorización explícita del owner, con el `version` del historial alineado y el esquema/grants/RLS verificados en el remoto (§3.7).
- **El marketplace desplegado queda vacío hasta que existan campañas publicadas.** El listado sólo muestra campañas con bóveda confirmada y campaña abierta; no hay datos sembrados.
- **El `href` del CTA es provisional:** apunta a `/campaigns/<id>`, que define la Feature de detalle ([#422](https://github.com/reyduar/Vaqcrow/issues/422)); hasta entonces es un 404 aceptado (mismo criterio que los links del header a rutas no construidas). **Resuelto por #422**: la ruta `/campaigns/[id]` existe en su rama de integración.
- **Sin paginación** (D3): una sola grilla, como el template.
- **Foto opcional.** La imagen es la primera foto `kind='photo'`; una campaña sin foto cae al layout legado de la tarjeta (sin cabecera 16/10). D2 (foto real) se cumple; el rótulo «Imagen representativa» del template no aplica a la foto real.
- **Advisories no bloqueantes anotados** (bitácora): sin test propio de Escape/overlay del modal de filtros ni de la página `/explore` (cubierta por el controlador); 6 `Skeleton` anidados con `role="status"`; el estado de favoritos puede mostrar el vacío propio mientras `isLoading`; tras cerrar sesión con el filtro activo el anónimo puede quedar en el vacío de favoritos hasta limpiarlo; el alta (`/signup`) no recibe `returnTo`.
- **La fábrica con tope no está activa en Testnet** (heredado de #410): se activa re-apuntando `STELLAR_CAMPAIGN_FACTORY_ID` cuando la pila llegue a `main` con #438.

## 6. Decisiones del owner

| # / fecha | Pregunta del issue | Resolución |
|---|---|---|
| D1 — 2026-10-08 | ¿Los favoritos persisten y dónde? | **Sí, por cuenta** (server-side por usuario autenticado); los anónimos **no** retienen. Tabla + endpoints nuevos. |
| D2 — 2026-10-08 | ¿Qué imagen muestra la tarjeta? | **Foto real de la PyME**, servida por la API desde el bucket privado; el rótulo «Imagen representativa» no aplica. |
| D3 — 2026-10-08 | ¿Paginación o scroll infinito? | **Sin paginación**: una sola grilla. |
| Corazón anónimo — 2026-10-08 | ¿Cómo se comporta el corazón de un visitante anónimo? | **Visible para todos; al clickear pide login y vuelve a `/explore`** tras ingresar (opción 3). |
| Override del template — 2026-10-01 | ¿La compuerta «Ingresá para explorar PyMEs»? | **No aplica**: el marketplace es **público sin onboarding**; sólo el detalle exige cuenta. |

Ninguna pregunta abierta del issue quedó sin decidir antes de implementarse.

## 7. Mapeo de criterios de aceptación (issue #414, citados textualmente)

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The marketplace is reachable without an account and lists only published campaigns from the new endpoint." | ✅ **CUMPLIDO.** `/explore` es público (fuera de `RouteGate` y del matcher del proxy) y `GET /marketplace/campaigns` es `PUBLIC`; la vista `marketplace_campaign` filtra `campaign_deployment.state = 'confirmed'` **y** `campaign.state = 'open'`. La compuerta del template está **overrideada** por el owner. | Suite api/web; `test:db` (`marketplace_campaign.sql`); §3.1, §3.4 |
| 2 | "Search, advanced-filter draft/apply/discard, chips, sorting and favorites behave as in the template; live count equals the applied result." | ✅ **CUMPLIDO.** Búsqueda (nombre/sector/ciudad), modal sobre borrador (aplicar/descartar con ×/Escape/overlay, «Restablecer», contador en vivo «Mostrar N PyMEs» = resultado del borrador), chips removibles + «Limpiar filtros», orden (cierre/fondeo/meta) y favoritos (corazón por tarjeta, «Mis favoritos» con contador, chip «Solo favoritos»). El contador del resultado (grid) es `aria-live` y coincide con lo aplicado. Matices declarados: «Mis favoritos» se muestra **sólo con sesión** (un anónimo no retiene favoritos) y su corazón pide login (decisión del owner). | Suite web (`explore-marketplace`, `marketplace-filters-modal`, `filters`); §3.4, §3.5 |
| 3 | "Loading, error (with retry) and empty states match the template." | ✅ **CUMPLIDO.** Carga con placeholders accesibles («Cargando campañas»); error «No pudimos cargar las campañas» / «El servicio no respondió. Ningún dato ni aporte se modificó.» con «Reintentar» (relee por el port); vacío «Ninguna campaña coincide» con «Limpiar filtros y búsqueda», más el vacío propio de favoritos. Un fallo nunca se muestra como una grilla vacía real. | Suite web; §3.4 |
| 4 | "Risk is always text + icon; no copy promises a return." | ✅ **CUMPLIDO.** El riesgo es un badge con **texto** («Riesgo bajo/medio/alto», o «Riesgo sin dato» neutro) **más ícono**, nunca sólo color. El modal declara «No filtramos por retorno: ninguna campaña promete uno.» y no hay copy de retorno en tarjetas ni estados. | Suite web; §3.4 |
| 5 | "Required evidence and failure behavior are covered." | ✅ **CUMPLIDO.** Suites + `pnpm run verify` (exit 0) + `test:db` (18/18). Fallos saneados: API `404`/`503`, web `unavailable`/`network`/`unauthenticated`; sin exponer `message`/`details`/`hint` ni el path del bucket. Este documento es la evidencia. | §4.1, §4.3 |
| 6 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ **CUMPLIDO.** D1/D2/D3 y el comportamiento del corazón anónimo los decidió el owner antes de implementarse (§6); ninguna se inventó. | §6 |
| 7 | "No unsupported production claims or secrets are introduced." | ✅ **CUMPLIDO.** Sin secretos, seeds ni PII; Testnet sin valor económico; conversión ARS↔activo simulada; sólo campañas publicadas y sin PII de la PyME. | Revisión de este documento; suites |

## 8. Riesgos, contradicciones y limitaciones aceptadas

- **Migraciones locales, remoto pendiente.** Es la brecha operativa central de este cierre (§5): sin autorización explícita del owner, el proyecto remoto no tiene la vista ni la tabla, y la API desplegada no sirve el marketplace.
- **Verificación de UI sin navegador.** Los tests de la vista son de componente (jsdom), no E2E; no hay ensayo en vivo del marketplace como el de #410.
- **Provisionalidad del detalle.** El CTA apunta a una ruta aún no construida (#422); no es un defecto, es una dependencia declarada.
- **El ida-y-vuelta del login** se agregó como capacidad aditiva y guardada (`safeReturnTo`); el default de D2 (redirección por rol) permanece intacto y probado.

## 9. Estado de entrega y próximos pasos

- **Nada de #414 está en `main`.** Todo vive en la rama de integración, apilada sobre #406/#410/#382/#386; el merge a `main` sigue atado a la **Opción A** (la pila se mergea junta con #438).
- **Camino a `main`:** #414 → #422 (detalle y aportes) → #426/#434 → #438. #390, #394, #418 y #430 no son dependencias de #438.
- **Migraciones remotas: aplicadas (2026-10-08)** con autorización explícita del owner, con el `version` del historial alineado y verificadas en el remoto (§3.7).
- El cierre de la Feature lo decide el owner; esta sección sólo registra su decisión.
