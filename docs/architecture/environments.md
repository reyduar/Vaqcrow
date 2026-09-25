---
title: Environments
tags:
  - architecture
  - environments
  - docker
  - supabase
date: 2026-09-23
status: draft
---

# Vaqcrow — Perfiles de entorno

> [!info] Objetivo
> Documentar los dos perfiles de configuración explícitos del repositorio —
> `.env.cloud` y `.env.docker` — sus fuentes, sus comandos y el flujo de
> migraciones que los conecta. Ver [[docs/architecture/deploy-planning|Deploy Planning]] para el despliegue en Railway/Vercel y Task [#271](https://github.com/reyduar/Vaqcrow/issues/271).

## 1. Los dos perfiles

| | `.env.cloud` | `.env.docker` |
|---|---|---|
| **Supabase** | Proyecto remoto (`https://<project-ref>.supabase.co`) | Stack local del CLI (`http://127.0.0.1:54321` en el host; `http://host.docker.internal:54321` dentro del contenedor de la API) |
| **API** | Corre en el host (`pnpm --filter @vaqcrow/api dev:cloud`) o en Railway | Corre en un contenedor construido con `apps/api/Dockerfile` vía `docker-compose.local.yml` |
| **Web** | `pnpm --filter @vaqcrow/web dev:cloud`, o Vercel | `pnpm --filter @vaqcrow/web dev:docker`, apuntando a `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` |
| **Stellar** | Testnet pública, vía Horizon | Testnet pública para la API (ver §5); Quickstart en Docker Desktop sólo para los contratos (`contracts/scripts/local-network.sh`) |
| **`APP_ENV`** | `demo` | `local` |
| **Propósito** | El único perfil que corre la demo real; es el que se despliega en Railway/Vercel | Pruebas locales — migraciones, integración, desarrollo sin tocar el proyecto de la demo |

`.env.cloud` y `.env.docker` están en `.gitignore`; sus plantillas, `.env.cloud.example` y `.env.docker.example`, no lo están y sí se versionan.

## 2. Por qué no `.env.development` / `.env.local`

Decisión D1 de la bitácora de este cambio (`odd/tasks/environment-profiles.md`): Next.js y Vite tratan `.env.development` y `.env.local` como **capas** de un mismo entorno, no como perfiles alternativos — `next dev` deja que `.env.local` pise a `.env.development`, no que se elija uno u otro. Ninguno de los dos nombres sirve para distinguir "contra el proyecto remoto de la demo" de "contra Supabase local en Docker": son ejes distintos, no una jerarquía de override.

Por eso el perfil se elige explícitamente en cada comando (D2): `node --env-file=<archivo>` para la API, `--mode <perfil>` (Vite) para la suite de integración. `apps/api` no usa `dotenv` y Next sólo carga `apps/web/.env*` — nada seleccionaba antes el archivo raíz de forma deliberada.

## 3. Primera vez — setup

1. **Renombrar el archivo existente.** Si ya tenés un `.env.local` en la raíz con credenciales reales de la demo, movelo a `.env.cloud` (`mv .env.local .env.cloud`). Esto lo hacés vos: una regla global de permisos impide que las sesiones de agente lean, editen o muevan cualquier `.env*`.
2. **Copiar las plantillas.** `.env.cloud.example` → `.env.cloud` y `.env.docker.example` → `.env.docker` (si no hiciste el paso 1), completando los placeholders. Las plantillas viven junto a este documento.
3. **Levantar el perfil docker.** `pnpm env:docker:up` arranca Supabase local (CLI, sin `studio`/`storage-api`/`realtime`/etc. — la API sólo necesita `kong` y `postgrest`), el Stellar Quickstart si no está ya sano en `:8000`, genera `.env.docker` si falta, y construye + levanta el contenedor de la API.
4. **Generar `.env.docker` a mano si hace falta.** `./scripts/env/generate-docker-env.sh` lee `supabase status -o env` (Supabase local debe estar arriba) y copia las líneas `LLM_*` verbatim desde `.env.cloud` — el perfil docker reutiliza la credencial LLM de la demo en vez de tener la propia. Nunca imprime valores, sólo los nombres de las claves escritas. Rechaza sobrescribir un `.env.docker` existente salvo `--force`.

## 4. Comandos del día a día

```bash
pnpm env:docker:up               # levanta Supabase local + Quickstart + api en contenedor
pnpm env:docker:down             # baja el contenedor + Supabase local
pnpm env:docker:down -- --all    # además detiene el Stellar Quickstart
pnpm env:docker:status           # estado de todo, sin imprimir ninguna clave

pnpm --filter @vaqcrow/api dev          # API en el host, sin perfil (usa el entorno del shell)
pnpm --filter @vaqcrow/api dev:cloud    # API en el host contra Supabase remoto (.env.cloud)

pnpm dev:web:docker               # web en :3001 contra la API/Supabase locales (.env.docker)
pnpm dev:api:cloud                # API local en :3000 contra el proyecto remoto (.env.cloud)
pnpm dev:web:cloud                # web en :3001 contra NEXT_PUBLIC_API_BASE_URL (.env.cloud)

pnpm run test:db                  # supabase test db --local — siempre contra el stack local
```

## 5. Suite de integración por perfil

`apps/api`'s `test:integration` es la suite credential-gated contra `@supabase/supabase-js` real (nunca parte de `pnpm run test`/`pnpm run verify`):

```bash
pnpm --filter @vaqcrow/api test:integration          # = test:integration:docker (default, D3)
pnpm --filter @vaqcrow/api test:integration:docker   # --mode docker  → carga .env.docker
pnpm --filter @vaqcrow/api test:integration:cloud    # --mode cloud   → carga .env.cloud
```

El default es el perfil docker (decisión D3): corre contra el Supabase local del CLI, así que una corrida accidental nunca escribe en el proyecto de la demo. `vitest.integration.config.ts` selecciona el archivo vía `loadEnv(mode, repoRoot, "")` de Vite — `--mode <perfil>` carga `.env.<perfil>`.

## 6. Flujo de migraciones

El proyecto remoto sigue siendo el destino donde toda migración debe terminar (ver `CLAUDE.md` § Supabase migration workflow). El perfil docker es dónde se prueba primero:

1. Escribir la migración.
2. Probarla contra el stack local (`pnpm env:docker:up`, luego `supabase db push` o el flujo del CLI que corresponda, y `pnpm run test:db`).
3. Una vez verde localmente, aplicarla al proyecto remoto **en la misma unidad de trabajo** — nunca reportar la migración como terminada mientras el remoto está atrasado.
4. Verificar esquema, grants/RLS y versión del historial de migraciones en el remoto contra lo que hay en el repositorio.

No se debe usar la base local como sustituto de la actualización remota.

## 7. Manejo de secretos

- Ningún script de este perfil imprime valores — `generate-docker-env.sh` y `scripts/local-env.sh status` sólo muestran nombres de claves, URLs y estado de contenedores.
- Las variables de la plataforma cloud (Railway para la API, Vercel para la web) viven en sus paneles respectivos, no en `.env.cloud` — `.env.cloud` es para desarrollo local contra el proyecto remoto, no el mecanismo de despliegue. Ver [[docs/architecture/deploy-planning#7-secretos-y-variables-de-entorno|§7 de Deploy Planning]].
- `.env.cloud` y `.env.docker` los crea y edita la persona operadora; ninguna sesión de agente los lee, escribe ni mueve (regla global `deny`).

## 8. CORS (`CORS_ALLOWED_ORIGINS`)

`CORS_ALLOWED_ORIGINS` es opcional: lista de orígenes exactos separados por coma (`https://a.example.com,https://b.example.com`), sin rutas, query, hash, credenciales ni `*`. Sin la variable:

- Perfil docker (`APP_ENV=local`): permite `http://localhost:3001` y `http://127.0.0.1:3001` — cubre la web del contenedor sin configuración extra.
- Perfil cloud (`APP_ENV=demo` u otro entorno no `local`): no permite ningún origen.

Cuando la variable está seteada, la lista explícita reemplaza el default en todo entorno, incluido `local`. Para el perfil cloud hay que declarar el origen de Vercel; si además se corre la web en local contra `pnpm dev:api:cloud`, agregar `http://localhost:3001` a la lista.

## 9. Nota sobre Stellar

`contracts/scripts/local-network.sh` levanta el Stellar Quickstart en Docker para el desarrollo de contratos (Rust/`soroban-sdk`) — es una red determinística y aislada, no un sustituto de Testnet para la evidencia de la demo.

`apps/api` **sí es consumidor de Stellar en runtime**: sobre Horizon para los pagos y las consultas de transacción, y sobre Soroban RPC para leer y firmar la bóveda de campaña (las rutas de campaña se registran sólo cuando `STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY` están configuradas juntas). Por defecto mantiene `STELLAR_NETWORK=testnet` incluso en el perfil docker; conectarla al Quickstart local para correr el recorrido completo de la bóveda de forma determinística es **opt-in**, está implementado y está descripto en [§11](#11-bóveda-de-campaña-en-la-red-local).

## 10. Troubleshooting

> [!warning] `host.docker.internal` no resuelve
> En Linux, Docker no define `host.docker.internal` por defecto. `docker-compose.local.yml` lo mapea explícitamente con `extra_hosts: ["host.docker.internal:host-gateway"]`, así que si falla, confirmá que tu Docker Engine soporta `host-gateway` (Docker Desktop en macOS/Windows lo resuelve nativamente).

> [!warning] El stack de Supabase quedó parcialmente detenido
> Si `pnpm env:docker:status` muestra contenedores de Supabase corriendo pero el healthcheck de la API falla, corré `supabase stop --workdir .` seguido de `pnpm env:docker:up` de nuevo — es más confiable que intentar reconciliar un stack a medio arrancar.

> [!tip] `.env.docker` desactualizado
> Si las credenciales de Supabase local cambiaron (por ejemplo, tras un `supabase stop --no-backup`), regenerá con `./scripts/env/generate-docker-env.sh --force`.

## 11. Bóveda de campaña en la red local

> [!info] Objetivo
> Correr el recorrido completo de la bóveda de campaña (apertura, aportes, liquidación, reembolso) contra el Stellar Quickstart local en vez de Testnet, de forma determinística. Es **opt-in**: sin este flujo, el perfil docker sigue hablando con Testnet exactamente como antes de [#237](https://github.com/reyduar/Vaqcrow/issues/237).
>
> Para entender qué cuentas y claves intervienen (la de la plataforma, la de la PyME y las de los inversores) y por qué es la plataforma la que crea la cuenta de la PyME, ver [[docs/architecture/stellar-accounts-and-keys|Cuentas, claves y fondeo en Stellar]].
>
> Cómo funciona esa misma bóveda en la demo desplegada en la nube —web en Vercel, API en Railway, Supabase y Stellar Testnet—, con las dos firmas (persona usuaria vs. plataforma) diferenciadas, está en [[docs/architecture/cloud-demo-architecture|Arquitectura de la demo en la nube]].

Orden de comandos, desde la raíz del repositorio:

```bash
pnpm env:docker:bootstrap                     # despliega la bóveda en la red local
./scripts/env/generate-docker-env.sh --force  # regenera .env.docker con ese despliegue
pnpm env:docker:up                            # levanta el contenedor de la API contra él
```

**Qué escribe cada paso:**

1. **`pnpm env:docker:bootstrap`** (`contracts/scripts/bootstrap-local-campaign.sh`) — levanta el Quickstart si hace falta (reutiliza `contracts/scripts/local-network.sh`), registra la red `local` en la Stellar CLI, crea y fondea con Friendbot la identidad `vaqcrow-platform` (sólo su clave pública participa de esto), despliega la SAC del activo nativo, construye/sube el Wasm de la bóveda y despliega la fábrica apuntando a ese hash. Escribe **sólo datos públicos** en `contracts/.local-deployment.json` (`network`, `rpcUrl`, `horizonUrl`, `platformPublicKey`, `tokenContractId`, `factoryId`, `vaultWasmHash`, `deployedAt`) — nunca la clave secreta, y el archivo está en `.gitignore`. Es reintentable, pero no idempotente en la fábrica: cada corrida la redespliega (id nuevo) y sobreescribe el archivo con esa dirección — la anterior queda inalcanzable desde el registro, no desde la cadena.
2. **`./scripts/env/generate-docker-env.sh --force`** — al detectar `contracts/.local-deployment.json`, escribe en `.env.docker` el bloque de red local (`STELLAR_NETWORK=local`, `STELLAR_HORIZON_URL`, `STELLAR_RPC_URL`, `STELLAR_CAMPAIGN_FACTORY_ID`, `STELLAR_TOKEN_CONTRACT_ID`) en vez del `STELLAR_NETWORK=testnet` de siempre, y lee `STELLAR_PLATFORM_SECRET_KEY` directamente del keystore de la CLI (`stellar keys secret vaqcrow-platform`) — nunca la imprime, sólo el nombre de la clave en el resumen final.
3. **`pnpm env:docker:up`** — arranca el contenedor de la API con ese `.env.docker`. `scripts/local-env.sh` detecta `STELLAR_NETWORK=local` en el archivo y agrega `docker-compose.local-network.yml` a la corrida de `docker compose` (`-f docker-compose.local.yml -f docker-compose.local-network.yml`), que traduce `STELLAR_HORIZON_URL`/`STELLAR_RPC_URL` de `http://localhost:8000` (válido desde el host, donde corre Quickstart) a `http://host.docker.internal:8000` (lo único alcanzable desde dentro del contenedor) — el mismo problema que `SUPABASE_URL` ya resuelve en `docker-compose.local.yml`, aplicado sólo a estas dos variables y sólo en este perfil, porque aplicarlo sin condición rompería el perfil Testnet (el parser de `STELLAR_HORIZON_URL`/`STELLAR_RPC_URL` sólo acepta el host canónico de Testnet o un host loopback cuando `STELLAR_NETWORK=testnet`).

**Dónde vive la clave.** Nunca en el repositorio. La identidad `vaqcrow-platform` queda en el keystore de la Stellar CLI (`~/.config/stellar` por defecto en esta máquina), y `generate-docker-env.sh` la lee una sola vez para escribirla en `.env.docker` (ya en `.gitignore`, permisos 600) — el mismo patrón que `LLM_API_KEY`.

### Identidad de plataforma en Testnet

> [!info] `vaqcrow-testnet` es la identidad de Testnet
> La identidad de plataforma para **Testnet** es `vaqcrow-testnet`. Su clave pública verificada es `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG`, y es la `owner` de la fábrica de Testnet `CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ` (leído de vuelta desde la red). La persona operadora obtiene el secreto con `stellar keys secret vaqcrow-testnet`; ese valor nunca se commitea.

> [!warning] La clave de `vaqcrow-platform` es sólo para la red local
> `vaqcrow-platform` está pensada únicamente para el Quickstart local y **no funciona contra Testnet**: la fábrica de Testnet tiene como `owner` a `vaqcrow-testnet`, no a `vaqcrow-platform`. Para la red pública usá `vaqcrow-testnet`.

> [!warning] Direcciones de Testnet de #245
> Las direcciones de Testnet documentadas para la demo valen hasta el reset del **16 de diciembre de 2026** (`contracts/README.md` § Procedimiento tras un reset de Testnet). No tienen relación con este bloque local: son dos redes distintas, con sus propias direcciones.

> [!tip] Estado del perfil
> `pnpm env:docker:status` (`scripts/local-env.sh status`) imprime si `.env.docker` quedó en `local` o `testnet`, sin imprimir ninguna clave.

## 12. Recorrido Playwright en vivo (`pnpm test:e2e:live`)

> [!info] Objetivo
> Manejar la página real de fondeo contra la API del perfil docker (con la red local del §11 ya arriba) en vez del doble determinístico — cuenta real de la PyME, contrato real, Horizon real. Es **opt-in**, no forma parte de `pnpm run test:e2e`, de `pnpm run verify` ni de CI: se corre a mano, cuando hace falta verificar el recorrido contra la cadena, del mismo modo que `test:integration` de `apps/api` ([[README|README]], `CLAUDE.md`).

**Requisitos previos** (§11, en orden): `pnpm env:docker:bootstrap` → `./scripts/env/generate-docker-env.sh --force` → `pnpm env:docker:up`. `apps/web/e2e-live/support/global-setup.ts` falla rápido, con esas mismas instrucciones en el mensaje, si la API (`/health`), el RPC de Soroban (`getHealth`) o las rutas de campaña no responden.

```bash
pnpm run test:e2e:live                       # desde la raíz
pnpm --filter @vaqcrow/web run test:e2e:live # equivalente, filtrado al workspace
```

**Qué cubre:**

| Escenario | Qué verifica |
|---|---|
| Abrir la bóveda | Freighter emulado conecta como la PyME (sin firmar nada); la vista de campaña queda en `Fondeo abierto`; Horizon confirma que la cuenta de la PyME existe después de abrir |
| Aportar y retirar | Un inversor aporta y retira su propio aporte; el total de la campaña y el saldo del inversor en Horizon reflejan cada paso |
| Liquidar | Un aporte que alcanza la meta deja la bóveda en `Meta alcanzada` sin controles de aporte; el saldo de la PyME en Horizon sube exactamente el monto de la meta |
| Reembolsar tras el plazo | Con un plazo de ~25 s, un inversor aporta por debajo de la meta; tras esperar el plazo, una wallet **distinta** dispara el reembolso permissionless a favor del primer inversor; el estado pasa a `Reembolso disponible` y el saldo del inversor reembolsado sube en Horizon |

> [!warning] Sólo el primer escenario abre la bóveda por el panel real
> La página real (`apps/web/src/app/(demo)/funding/page.tsx`) nunca reemplaza el `applicationId` fijo de `CampaignWorkspace`, así que **todo** open por UI apunta a la misma aplicación demo — y `openCampaign` es idempotente por aplicación, de modo que un segundo submit del panel sólo adopta la campaña que ya exista ahí. Sólo el escenario de apertura ejercita "Abrir bóveda"; los otros tres abren su propia campaña con `POST /campaigns` directo (misma ruta real, sin pasar por el navegador) y manejan aportar/retirar/reembolsar siempre por la página real — el mismo patrón que ya usa `apps/web/e2e/campaign-vault.spec.ts` para su propio fixture de reembolso.

> [!warning] Firma sin salir del proceso de Playwright
> `apps/web/src` nunca puede importar `@stellar/stellar-sdk` (regla `web-never-imports-server-stellar-sdk`). `apps/web/e2e-live/support/freighter-live-emulator.ts` emula el mismo protocolo `postMessage` de Freighter que el doble determinístico, pero el paso `SUBMIT_TRANSACTION` llama a un puente `page.exposeFunction("vaqcrowLiveSign", …)`: la página manda el XDR sin firmar y la clave pública, y la firma real ocurre en el proceso de Node de Playwright (`apps/web/e2e-live/support/identities.ts`, `Keypair.random()` de la Stellar CLI SDK, fondeadas con Friendbot). La clave privada nunca cruza al navegador.

No forma parte de la corrida gateada por PR: `apps/web/e2e/support/local-only.ts`'s guard contra hosts externos, `apps/web/playwright.config.ts` y `pnpm run test:e2e` (17 tests, `testDir: "./e2e"`) no cambian. `apps/web/e2e-live/` vive fuera del glob que `tests/testing-and-ci-gates.test.ts` recorre, y `apps/web/playwright.live.config.ts` es una configuración separada, nunca referenciada por `turbo.json`, `.github/workflows/ci.yml` ni `pnpm run verify`.
