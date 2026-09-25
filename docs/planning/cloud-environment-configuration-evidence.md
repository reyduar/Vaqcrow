# Evidencia de cierre de la configuración del entorno en la nube — Issues #286 y #287

> Documento de cierre de los issues [#286](https://github.com/reyduar/Vaqcrow/issues/286) (superficie web en Vercel) y [#287](https://github.com/reyduar/Vaqcrow/issues/287) (configuración de la bóveda en la API hosteada). Consolida la configuración del repositorio y la del panel, y agrega la verificación que ninguno de los dos registraba: qué se re-ejecutó en el árbol, qué se leyó de la plataforma y qué se leyó de la red de Testnet. Cada resultado nombra su fuente. La bitácora de iteración es `odd/tasks/cloud-env-configuration.md`; la arquitectura explicada (no probada) está en [[docs/architecture/cloud-demo-architecture|Arquitectura de la demo en la nube]].

## 1. Contexto y objetivo

La demo se presenta con **todo desplegado en la nube**: la web en Vercel y la API en Railway contra el proyecto Supabase remoto y Stellar Testnet. Dos huecos la dejaban a medias, ninguno trackeado antes del 2026-09-24:

- [#286](https://github.com/reyduar/Vaqcrow/issues/286) — la web hosteada servía un build congelado apuntando a una rama que ya no existía, sin backend configurado. El issue se mantiene **High**: la URL hosteada es la superficie de entrega, no un fallback.
- [#287](https://github.com/reyduar/Vaqcrow/issues/287) — la API hosteada no tenía las claves del par estricto de la bóveda, así que las rutas de campaña **no se registraban**: el recorrido de custodia, el que `DEMO.md` marca como no recortable, faltaba por completo en el entorno de la demo.

Este documento cierra la parte verificable de ambos. La arquitectura de la solución vive en [[docs/architecture/cloud-demo-architecture|Arquitectura de la demo en la nube]]; aquí sólo se registra lo que se hizo y lo que se comprobó.

## 2. Cómo leer esta evidencia

| Etiqueta de fuente | Significado |
|---|---|
| **Local, re-ejecutado en el árbol** | Comando corrido el 25/09/2026 en el árbol de trabajo de esta rama, basada en `main` tras el merge del PR #288 (`370128b`). |
| **Leído de la plataforma** | Lectura de las APIs/paneles de Vercel y Railway el 2026-09-24/25. No se escribió ninguna configuración desde la sesión: la rama de producción, las variables y el secreto los setea la persona operadora. |
| **Leído de la red** | Lectura de Stellar Testnet (Soroban RPC/Horizon) el 2026-09-24/25. |
| **Del código fuente** | Comportamiento leído en el código del repositorio, sin ejecutarlo contra un servicio. |
| **PR** | Resultado registrado en el PR #288 cuando se mergeó. |

> [!info] Por qué no aparecen valores de secretos
> Sólo se nombran claves. El valor de `STELLAR_PLATFORM_SECRET_KEY` no se transcribe en ningún punto de esta evidencia ni del repositorio; la lectura de la API hosteada por MCP con OAuth devuelve **nombres**, no valores, que es la frontera correcta. Las direcciones de contrato y las claves **públicas** sí se citan porque son datos públicos por definición.

## 3. Qué quedó implementado

### 3.1 Lado repositorio

- **`vercel.json` en la raíz** (`e8bf8f2`, corregido en `f5e76ea` y `d0605be`): `buildCommand: pnpm exec turbo run build --filter=@vaqcrow/web...`, `installCommand: pnpm install --frozen-lockfile`, `framework: nextjs`, `regions: ["iad1"]`. **Sin** bloque `env` (Vercel no admite interpolación `^VAR`) y **sin** `outputDirectory` (se usa el default de Next.js, porque el Root Directory del proyecto es `apps/web`).
- **`.env.cloud.example` y `.env.docker.example`** (`80fad22`): documentan el par del vault —`STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY`— y las opcionales `STELLAR_TOKEN_CONTRACT_ID` y `STELLAR_RPC_URL`, con placeholders. Se corrigió además un comentario obsoleto de `.env.docker.example` que afirmaba que el parser "sólo acepta testnet" y que la red local estaba diferida a #237.
- **`docs/architecture/deploy-planning.md`** (`e8bf8f2`, `be63169`): las cuatro ocurrencias de `NEXT_PUBLIC_API_URL` pasaron a `NEXT_PUBLIC_API_BASE_URL`; §7 incorpora las dos claves del vault a la tabla de variables de la API, marcando la fábrica como pública y la clave como secreto de panel.
- **`docs/architecture/environments.md`** (`be63169`, más el enlace de esta unidad de trabajo): §9 deja de afirmar que la API no tiene consumidor Stellar en runtime; §11 documenta `vaqcrow-testnet` como identidad de Testnet y ahora enlaza a la arquitectura de la demo.

### 3.2 Lado plataforma (persona operadora)

- **Vercel**: la Production Branch pasó de `release` (rama inexistente) a **`main`**; `NEXT_PUBLIC_API_BASE_URL` se setea apuntando a la API de Railway; el dominio huérfano `vaqcrow-web-git-release-…` se eliminó.
- **Railway**: se incorporaron `STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY` al servicio `api`, de modo que la bóveda resuelve habilitada y las rutas `/campaigns` se registran.

### 3.3 Comportamiento del par estricto (del código fuente)

`apps/api/src/application/config/campaign-vault-config.ts`: **sin ninguna** de las dos claves ⇒ `{ enabled: false }`; **con exactamente una** ⇒ error de configuración. `api-config.ts` e `index.ts` lanzan ese error al cargar el módulo, sin `try/catch`, así que **el proceso no arranca**. `build-app.ts` registra las rutas `/campaigns` **sólo** si existe `dependencies.campaign`. En consecuencia, setear una sola clave es peor que no setear ninguna.

### 3.4 Defectos de documentación encontrados y corregidos

| # | Defecto | Causa | Fix |
|---|---|---|---|
| 1 | Se documentaba `NEXT_PUBLIC_API_URL` cuando el código lee `NEXT_PUBLIC_API_BASE_URL` (cuatro lugares de `deploy-planning.md`). | El documento derivó del código: seguir el documento configuraba una variable que nadie lee y reproducía el estado "sin backend". | Se corrigieron las cuatro ocurrencias a `NEXT_PUBLIC_API_BASE_URL`. |
| 2 | El bloque `env` de `vercel.json` usaba `"<VAR>": "^<VAR>"`. | Vercel sólo admite valores literales o referencias `@secret-name`; la interpolación `^VAR` no existe. El bloque seteaba la variable al string literal. | Se creó `vercel.json` **sin** bloque `env`; la variable se administra en Project Settings, que es el mecanismo que §7 ya declaraba. |
| 3 | Ni `.env.cloud.example` ni `.env.docker.example` nombraban las claves del vault. | El bloque completo sólo existía en `.env.docker`, un archivo local e ignorado de la red **local**: la única forma de descubrir las claves era mirar un archivo que no sirve para la nube. | Se agregó el bloque del vault a ambos `.example` con placeholders. |
| 4 | `buildCommand` documentado (`pnpm --filter @vaqcrow/web build`) no puede funcionar en un checkout limpio. | `@vaqcrow/contracts` publica sólo desde `dist/` y `pnpm --filter` no construye las dependencias del workspace. | Correcto: `pnpm exec turbo run build --filter=@vaqcrow/web...`. Lo detectó el check de Vercel del PR #288 (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`). |
| 5 | Root Directory documentado como `/` cuando el real es `apps/web`. | Vercel resuelve `outputDirectory` relativo al Root Directory, así que `apps/web/.next` se buscaba en `apps/web/apps/web/.next` (`NEXT_OUTPUT_DIR_MISSING`). | Se omitió `outputDirectory` en `vercel.json`; el Root Directory se documenta en §3 porque es configuración de proyecto, no un campo versionable. Lo detectó el PR #288. |

### 3.5 Configuración por paso del journey

| # | Paso | ¿Gateway configurado? | Observación |
|---|---|---|---|
| 1 | `/request` | Sí | Renderiza el contenido real y, además, el placeholder (ver §5, límite 3). |
| 2 | `/ai-assessment` | Sí | Evaluación asesora sobre datos sintéticos. |
| 3 | `/approval` | Sí | Aprobación humana. |
| 4 | `/funding` | Sí | Bóveda de campaña (custodia en el contrato). |
| 5 | `/distribution` | No | Feature #28 en 0/3; rinde `<h1>…</h1>` + "Step content coming soon". |
| 6 | `/evidence` | No | Feature #29 en 0/3; rinde `<h1>…</h1>` + "Step content coming soon". |

## 4. Qué quedó probado

### 4.1 Repositorio — local, re-ejecutado en el árbol

| Comando | Resultado observado |
|---|---|
| `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"` | `parseOK` |
| `git grep -nE "\bS[A-Z2-7]{55}\b" -- .env.cloud.example .env.docker.example` | Sin coincidencias (`exit=1`): ningún valor con forma de clave secreta en los templates. |
| `git grep -n "NEXT_PUBLIC_API_URL" -- .` | Sólo aparece en `odd/tasks/cloud-env-configuration.md`, que cita el token **incorrecto** para describir el defecto. Cero ocurrencias en `docs/`, código o plantillas. |
| `git grep -n "NEXT_PUBLIC_API_BASE_URL" -- docs/architecture/deploy-planning.md` | Cuatro ocurrencias: líneas 334, 356, 1144 y 1147. |
| `git status --short` | No lista `.env.cloud` ni `.env.docker`. |

### 4.2 Superficie web — leído de la plataforma (Vercel)

- Deploy de producción `dpl_7E3vD4ttHkMfb8oHAZjntB197jKm`, `target: "production"`, READY, sha `370128b` — que es el merge del PR #288 y coincide con el HEAD de `main`.
- Production Branch = `main`. Producción estuvo congelada desde el 2026-09-19 12:03 porque la rama configurada (`release`) ya no existía.
- Dominio de producción `https://vaqcrow-web-nine.vercel.app`, alcanzable sin cuenta de Vercel. El dominio huérfano `vaqcrow-web-git-release-…` fue eliminado.
- `NEXT_PUBLIC_API_BASE_URL = https://api-production-c07f.up.railway.app`, target **sólo `production`** (sin `preview`). Verificado horneado en el bundle servido: `tT=(r="https://api-production-c07f.up.railway.app".trim())?new class …` en `/_next/static/immutable/chunks/1a_q4d8ot2a1a.js`; el patrón (string no vacío ⇒ gateway construido) corresponde a `default-gateway.ts` minificado.
- **Root Directory del proyecto: `apps/web`**.
- De los 6 pasos del journey, 4 tienen gateway configurado (§3.5).

### 4.3 API hosteada — leído de la plataforma (Railway)

- Servicio `api` (proyecto `vaqcrow-api`), environment `production`, deploya desde `main`, región `us-west2`, 1 réplica.
- Dominio `https://api-production-c07f.up.railway.app`; `GET /health` → `200`.
- **24 variables** de servicio, entre ellas las dos del vault: `STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY` (secreto; el MCP con OAuth sólo ve nombres).
- `CORS_ALLOWED_ORIGINS` permite el origen de producción de Vercel: preflight desde `https://vaqcrow-web-nine.vercel.app` → `204` con `access-control-allow-origin` correcto.
- Otras variables: `APP_ENV=demo`, `STELLAR_NETWORK=testnet`, `SUPABASE_URL` + publishable + service-role (sealed), `LLM_PROVIDER`/`LLM_MODEL`/`LLM_API_KEY`, `PORT`, `LOG_LEVEL`.

### 4.4 Stellar Testnet — leído de la red

- **Fábrica**: `CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ`, leída de la red (no de la documentación).
- **`owner` de la fábrica**: `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG` = identidad `vaqcrow-testnet` del keystore de la Stellar CLI.
- **`vault_wasm` reportado por la fábrica**: `57d91ef0b0ff7c759c665f7722b4db649fbea3f58e4dc1b061bf90ee60e8ca0d`; el Rust no cambió desde el deploy del 23/09.
- **Cuenta de plataforma**: 9.969 XLM (fondea la cuenta de la PyME con 2 XLM al abrir la campaña).
- **SAC nativa de XLM en Testnet**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`; la API la deriva si falta `STELLAR_TOKEN_CONTRACT_ID`.
- **Reset de Testnet agendado**: 2026-12-16.
- La identidad `vaqcrow-platform` es sólo para el Quickstart local y **no funciona contra Testnet**.

### 4.5 Las rutas de campaña, registradas — request observada desde el origen de la web

Corrida el 25/09/2026 contra el despliegue hosteado, con el header `Origin` del dominio de producción de la web. El discriminador es la **forma** de la respuesta 404: Fastify responde distinto según si la ruta existe.

```bash
curl -i -H "Origin: https://vaqcrow-web-nine.vercel.app" \
  https://api-production-c07f.up.railway.app/campaigns/00000000-0000-4000-8000-000000000000
```

| Request | Respuesta observada |
|---|---|
| `GET /campaigns/00000000-0000-4000-8000-000000000000` (uuid válido, inexistente) | `404` · `access-control-allow-origin: https://vaqcrow-web-nine.vercel.app` · `{"code":"not_found"}` |
| `GET /definitely-not-a-route` (control, mismo `Origin`) | `404` · `{"message":"Route GET:/definitely-not-a-route not found","error":"Not Found","statusCode":404}` |
| `GET /health` (control, mismo `Origin`) | `200` · `{"status":"ok"}` |

La segunda respuesta es la de Fastify para una ruta **no registrada**; la primera es un error **de dominio**, que sólo se produce si la request atravesó el handler y llegó al repositorio. Formas distintas ⇒ la ruta `/campaigns` **está registrada** en el despliegue hosteado. El header `Origin` se envió y CORS lo devolvió, así que la request es la que haría el navegador desde el dominio desplegado.

> [!warning] Lo que esta observación NO prueba
> No prueba que la cadena responda ni que la firma de plataforma funcione: para eso hace falta un `POST /campaigns` sobre una solicitud aprobada, que crearía estado real en Testnet (límite 2 de §5).

## 5. Límites operativos vigentes

1. **No verificado de punta a punta por navegador.** La configuración se verificó por partes (bundle servido, `/health`, preflight CORS); el recorrido completo en el navegador contra producción no se corrió. La API no tiene logging a nivel request, así que no hay rastro servidor de tráfico del frontend.
2. **`POST /campaigns` nunca se ejercitó.** Que `STELLAR_PLATFORM_SECRET_KEY` corresponda al `owner` de la fábrica se prueba recién ahí.
3. **Placeholder visible.** "Step content coming soon" aparece en `/request` después del contenido real, y en `/distribution` y `/evidence` (Features #28 y #29, ambas en 0/3).
4. **`NEXT_PUBLIC_API_BASE_URL` no tiene target `preview`.** Los previews de Vercel quedan sin backend configurado.
5. **Sin decisión registrada**: almacenamiento/rotación del secreto de plataforma; SSO en los previews; dominio propio.
6. **Id de campaña malformado**: devuelve `503` en vez de `400`, y la línea de log sale con `correlationId: undefined`.

## 6. Mapeo de criterios de aceptación

### Issue #286 — Restore the Vercel production deployment and its configuration

| Criterio (textual) | ¿Se cumple? | Verificación |
|---|---|---|
| A production deployment exists whose commit matches the current `main` HEAD, and the production branch is either `main` or a branch that is actually maintained — no production configuration pointing at a branch that does not exist. | **Sí** | Deploy `dpl_7E3vD4ttHkMfb8oHAZjntB197jKm`, sha `370128b` = `main` HEAD; Production Branch = `main`. Leído de la plataforma. |
| `NEXT_PUBLIC_API_BASE_URL` is set for Production and Preview, pointing at the Railway API, and verified by a real request from the deployed origin rather than by reading the setting back. | **Parcial** | Seteada **sólo** para `production` (§5, límite 4). Verificada horneada en el bundle servido y por el preflight CORS desde el origen desplegado (§4.2, §4.3), no por lectura del panel. Sin recorrido de navegador (§5, límite 1). |
| `vercel.json` is committed at the repository root with the configuration `deploy-planning.md` §3 already prescribes (build command, `outputDirectory: apps/web/.next`, region, framework), and the document and the file agree. | **Parcial** | El archivo existe, parsea y coincide con el documento (build command turbo, `framework`, `regions`); **no** incluye `outputDirectory: apps/web/.next` porque se omitió deliberadamente (defecto 5). El documento y el archivo **sí** coinciden: §3 documenta la omisión. |
| Every occurrence of the web base URL in `deploy-planning.md` names the variable the code actually reads, including the CLI commands, so following the document cannot reproduce the current broken state. | **Sí** | Cuatro ocurrencias corregidas a `NEXT_PUBLIC_API_BASE_URL` (§4.1); `NEXT_PUBLIC_API_URL` no aparece en `docs/`. |
| The web base URL is documented where a contributor will look for it, not only in the dashboard. | **Sí** | `deploy-planning.md` §3/§7 y `.env.cloud.example`. Re-ejecutado en el árbol. |
| The stale `vaqcrow-web-git-release-*` domain is removed. | **Sí** | Leído de la plataforma. |
| No placeholder block is visible anywhere on the demo journey surface. | **No** | Visible en `/request`, `/distribution` y `/evidence` (§3.5, §5 límite 3). |
| The decision on Vercel Authentication for previews is recorded, and the URL shared with the tribunal is reachable without a Vercel account. | **Parcial** | La URL de producción es pública sin cuenta; la decisión sobre el SSO de previews **no** está registrada (§5, límite 5). |
| The custom-domain decision is recorded, whether adopted or explicitly deferred. | **No** | Sin decisión registrada (§5, límite 5). |
| No secret, seed or PII is committed, and no `NEXT_PUBLIC_` variable carries a secret value. | **Sí** | Cero valores con forma de clave secreta en los `.example` (§4.1); `NEXT_PUBLIC_API_BASE_URL` porta una URL pública. |

### Issue #287 — Enable the campaign-vault configuration on the hosted API

| Criterio (textual) | ¿Se cumple? | Verificación |
|---|---|---|
| `STELLAR_CAMPAIGN_FACTORY_ID` and `STELLAR_PLATFORM_SECRET_KEY` are set on the hosted API service, matching the factory already deployed on Testnet. | **Parcial** | Las dos claves están seteadas en el servicio (leído de la plataforma) y la fábrica `CDVSSQ55…` es la de Testnet (§4.4). La correspondencia de la **clave** con el `owner` de la fábrica no está probada hasta ejercitar `POST /campaigns` (§5, límite 2). |
| The campaign routes are registered on the hosted API, verified by an **observed request** from the deployed web origin rather than by reading the variable list back. | **Sí** | Request observada desde el origen de producción de la web (§4.5): `GET /campaigns/<uuid inexistente>` responde `404 {"code":"not_found"}` — error de dominio, forma distinta de la que Fastify devuelve para una ruta no registrada, con `access-control-allow-origin` devuelto. |
| `.env.cloud.example` documents the vault keys as placeholders, so the cloud profile is complete and reproducible by a contributor. | **Sí** | Bloque agregado con placeholders (§3.1); sin valores secretos (§4.1). |
| The platform secret never appears in the repository, this issue, a build log, a deploy log or a serialised response — only the key names and their shapes are recorded. | **Sí** | Sólo se nombran claves; el MCP devuelve nombres, no valores (§4.3); `platform-signer.ts` es el único punto de uso y no expone el material (§3.3). |
| The hosted environment cannot silently enter the half-configured state (one key without the other); the code already fails loudly on that, and the hosted state is confirmed not to be in it. | **Sí** | Ambas claves presentes (leído de la plataforma); con una sola, el proceso no arranca (§3.3). |
| The decision on where the platform secret is stored, and how it is rotated, is recorded alongside the existing secret-boundary work. | **No** | Sin decisión registrada (§5, límite 5). |

## 7. Estado de entrega

- El lado repositorio de #286 y #287 está mergeado en `main` a través del PR #288 (`370128b`); la configuración de panel (rama de producción, variable de la web, claves del vault) quedó aplicada por la persona operadora y verificada por lectura.
- Este documento se entrega en la rama `Vaqcrow#286_Task_Document_the_cloud_demo_architecture_and_the_environment_configuration`; el PR lo abre el orquestador.
- **No se declara cerrado** lo que no se verificó: el recorrido de punta a punta en el navegador, la ausencia de placeholders, el target `preview` de la web y las tres decisiones operativas sin registrar (§5, §6).
- Seguimientos sugeridos, fuera del alcance de esta unidad de trabajo: ejercitar `POST /campaigns` contra el despliegue hosteado y registrar las decisiones de secreto, SSO y dominio.
