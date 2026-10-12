# Bitácora — Distinguir vacío de fallo de carga y suavizar el estado de error

## Objetivo

Task [#480](https://github.com/reyduar/Vaqcrow/issues/480): que una lista vacía **nunca** se lea como un fallo, y que un fallo real deje de mostrarse como un banner rojo alarmante; además, que el caso «no hay backend configurado» se informe con honestidad en vez de mentir «El servicio no respondió».

## Por qué

El owner veía «No pudimos cargar las campañas — El servicio no respondió. Ningún dato ni aporte se modificó.» en un banner rojo **en varias pantallas cuando simplemente no había datos**. El issue pedía identificar la causa real (¿una API que responde error para un set vacío?, ¿una request sin auth?, ¿un hook que convierte "sin datos" en fallo?) y arreglarla en la raíz, no escondiéndola.

## Rama

- **Rama:** `Vaqcrow#480_Task_Distinguish_empty_data_from_load_failures_and_soften_the_error_state` (off `main` = `2ff095e`).

## Hallazgo (causa raíz) — contradice la premisa del issue

La investigación (código ruta→use case→componente, más una verificación en vivo contra la API hosteada) mostró que **ninguna pantalla muestra `ErrorState` por una colección vacía**. El vacío ya era honesto en todas: la API devuelve `200` con vacío y cada componente ramifica vacío→`EmptyState`.

- API: `GET /marketplace/campaigns` (200 `{items:[]}`), `GET /portfolio` (`emptyPortfolio()` cuando no hay key), `GET /reports` (`isEmpty: true`), `GET /my-campaigns`, `GET /notifications`, cola admin — **ninguno convierte 0 filas en error**.
- Verificación en vivo: `GET https://api-production-c07f.up.railway.app/marketplace/campaigns` → `200` con 3 campañas.

El banner rojo aparece **sólo ante un fallo real**, y había tres defectos que lo hacían parecer un "sin datos":

1. **El null-object miente.** Si falta `NEXT_PUBLIC_API_BASE_URL`, `createBrowser*Port()` devuelve un **null object** (`UNAVAILABLE_*_PORT`) que responde `{ok:false, code:"unavailable"}`. Ese `unavailable` es **indistinguible de un 503**, así que el estado "no hay backend" se pintaba como «El servicio no respondió» — una afirmación falsa. `docs/architecture/cloud-demo-architecture.md` ya documentaba que la UI debía "informar que no hay backend configurado"; el código no lo cumplía.
2. **Conflación "sin datos" = "falló".** Cuatro controladores hacían `state.loadFailed || state.data === null` (`campaign-detail.tsx:103`, `company-dashboard.tsx:113`, `portfolio.tsx:99`, `reports.tsx:137`): `data === null` es el centinela "no se fetcheó", y OR-eado pintaba la copia de fallo.
3. **El rojo.** `ErrorState` usaba `bg-trust-critical-surface text-trust-critical` (peligro).

## Decisión del owner (2026-10-12)

**Opción B** (elegida por el owner): además de suavizar el tono y arreglar la conflación, el caso "no hay backend" deja de decir «El servicio no respondió» y muestra un **aviso propio y calmo**.

## Unidades de trabajo

- [x] **WU1 — `ErrorState` a tono warning.** Pasa de `--color-trust-critical*` (rojo) a `--color-trust-caution*` (ámbar); conserva `role="alert"`. Story + test actualizados, con un test que **prohíbe** volver a la clase `trust-critical`.
- [x] **WU2 — Primitivo `BackendNotice`.** Nuevo componente para el estado "sin backend": `role="status"` (no alerta), sin retry (reintentar no configura un backend), copy español. Story + test.
- [x] **WU3 — Código `not_configured`.** Agregado a los unions de error de los ports `marketplace`, `portfolio`, `my-campaigns`, `report`, `notification`, `admin-queue`, `campaign-detail` y `admin-review` (+ `admin-evidence`). Los null-object ports ahora responden `not_configured`. En `notification`/`admin-queue` el código **no** entra en el array de códigos de la API (`NOTIFICATION_ERROR_CODES`, `ADMIN_QUEUE_ERROR_CODES`): es local, el gateway HTTP nunca lo acepta del cable. Tests de ports actualizados.
- [x] **WU4 — `loadErrorCode` en los hooks.** `use-marketplace`, `use-portfolio`, `use-my-campaigns`, `use-investor-report`, `use-report-sales`, `use-admin-queue`, `use-campaign-detail` exponen el código saneado (mismo patrón que ya usaba el bell). Los tipos de `code` de cada `Error` local pasaron de `string` al union.
- [x] **WU5 — Cableado en pantallas.** `BackendNotice` se renderiza cuando `loadErrorCode === "not_configured"`, **antes** del branch de fallo, en: landing (`pymes-en-campana`), `/explore`, detalle de campaña, `/company`, `/portfolio`, `/reports`, bell, cola admin y evidencia/revisión admin. La rama `loadFailed || data === null` se partió: `not_configured` → aviso; `loadFailed` → `ErrorState`; `data === null` residual (nada fetcheado) → aviso, **nunca** error.
- [x] **WU6 — Tests de regresión.** Por pantalla listada: `not_configured` → aviso calmo y **ausencia** de la copia de fallo y de `role="alert"`; el vacío→`EmptyState` y el fallo→`ErrorState`+retry ya estaban cubiertos y siguen verdes. Unit: `useMarketplace` expone `loadErrorCode`.
- [x] **WU7 — Docs.** Esta bitácora + corrección de `docs/architecture/cloud-demo-architecture.md` §2 (el null object responde `not_configured` y la UI muestra el aviso, no un fallo).

## Copy nueva (revisión del owner)

- `BackendNotice` título: **«Esta instancia no tiene configurada la API»**; cuerpo: «No hay una API de Vaqcrow configurada, así que la pantalla no puede mostrar datos. No es un fallo del servicio y no se modificó nada.»
- Bell (subtexto del modal): «No hay una API de Vaqcrow configurada en esta instancia.»

La copy de fallo existente («El servicio no respondió. Ningún dato ni aporte se modificó.») se mantiene: es honesta para un fallo real, que ahora se separa del caso "sin backend".

## Alcance diferido (explícito)

El código `not_configured` se aplicó a los ports detrás de las pantallas listadas en el issue. Otros null-object ports del repo (`business`, `kyc`, `completeness`, `upload`, `wallet-connection`, `sales-declaration`, `favorites`, `admin-users`, `operator-invitation`) siguen respondiendo `unavailable`; están dentro de wizards/acciones, no son las "varias pantallas" que vio el owner, y su ampliación queda como follow-up.

## Checks

- `pnpm --filter @vaqcrow/web typecheck` → OK.
- Tests web afectados (hooks + pantallas + primitivos + ports) → verdes.
- `pnpm run boundaries` → 0 violaciones.
- `pnpm --filter @vaqcrow/web lint` → 0 errores (2 warnings preexistentes en `admin-users.test.tsx`, archivo no tocado por este trabajo).
- Flake conocido: `pnpm run verify` puede fallar por el timeout de carga de `@vaqcrow/web` (tests no tocados); aislados pasan.
