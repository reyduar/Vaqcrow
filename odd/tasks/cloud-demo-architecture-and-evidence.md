# Documentación y diagrama de la arquitectura de la demo en la nube — #286 + #287

## Objetivo

Cerrar el trabajo de configuración de la nube con dos entregables documentales:

1. **La evidencia** de lo que se hizo y se verificó para [#286](https://github.com/reyduar/Vaqcrow/issues/286) y [#287](https://github.com/reyduar/Vaqcrow/issues/287).
2. **La arquitectura definitiva de la demo**, incluido cómo funciona Stellar Testnet en la nube con nuestra API y nuestro frontend, con diagrama.

## Qué se construyó (hechos verificados, para no re-derivar)

### Frontend — Vercel (`vaqcrow-web`, `prj_02tsyftTQK3fc8P2e4pznP14CVK1`)

- Producción **viva desde `main`**: deploy `dpl_7E3vD4ttHkMfb8oHAZjntB197jKm`, `target: "production"`, READY, sha `370128b` (merge del PR #288).
- **Production Branch**: estaba en `release`, una rama que **ya no existe**; cambiado a `main`. Producción estuvo congelada desde el 2026-09-19 12:03 por eso.
- Dominio de producción: `https://vaqcrow-web-nine.vercel.app`, público sin cuenta de Vercel. Dominio huérfano `vaqcrow-web-git-release-…` **eliminado**.
- `NEXT_PUBLIC_API_BASE_URL` = `https://api-production-c07f.up.railway.app`, target **sólo `production`**. Verificado horneado en el bundle servido: `tT=(r="https://api-production-c07f.up.railway.app".trim())?new class …` en `/_next/static/immutable/chunks/1a_q4d8ot2a1a.js` (el patrón `default-gateway.ts` minificado: string no vacío ⇒ gateway construido, no `null`).
- **Root Directory del proyecto: `apps/web`** (no la raíz del monorepo). `outputDirectory` se resuelve relativo a él.
- A 6 pasos del journey, 4 tienen gateway configurado: `/request`, `/ai-assessment`, `/approval`, `/funding`. Los 2 sin configurar (`/distribution`, `/evidence`) corresponden a Features **#28 y #29, ambas en 0/3**, y rinden `<h1>…</h1>` + "Step content coming soon".

### Backend — Railway (`vaqcrow-api`, proyecto `276137b5-7a8b-476d-9c74-2d56c122c29f`)

- Servicio `api` (`310a115f-d870-4a2d-a732-7fad17f15fff`), environment `production` (`176a3e3e-504c-4eb7-9f1a-33e505ff5e5c`), deploya desde `main`, región us-west2, 1 réplica.
- Dominio: `https://api-production-c07f.up.railway.app`, `GET /health` → `200`.
- **24 variables** de servicio, entre ellas las dos del vault: `STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY` (secreto; el MCP con OAuth sólo ve nombres, correcto).
- `CORS_ALLOWED_ORIGINS` permite el origen de producción de Vercel: preflight desde `https://vaqcrow-web-nine.vercel.app` → `204` con `access-control-allow-origin` correcto.
- Otras: `APP_ENV=demo`, `STELLAR_NETWORK=testnet`, `SUPABASE_URL` + publishable + service-role (sealed), `LLM_PROVIDER/MODEL/API_KEY`, `PORT`, `LOG_LEVEL`.

### Stellar Testnet

- Fábrica: `CDVSSQ55LBBYHAK5DNQG2UNPIG3PMPJELKJ7LKSNOBAIHAEHPMX75GXJ`. Leída **desde la red**, no de la documentación.
- Su `owner`, leído de la red: `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG` = identidad **`vaqcrow-testnet`** del keystore de la Stellar CLI.
- `vault_wasm` que reporta la fábrica: `57d91ef0b0ff7c759c665f7722b4db649fbea3f58e4dc1b061bf90ee60e8ca0d`; el Rust no cambió desde el deploy del 23/09 (el único commit posterior bajo `contracts/` agregó un script de shell).
- Cuenta de plataforma en Testnet: **9.969 XLM** (fondea la cuenta de la PyME con 2 XLM al abrir la campaña).
- SAC nativo de XLM en Testnet: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`. La API lo deriva si falta `STELLAR_TOKEN_CONTRACT_ID`.
- Reset de Testnet agendado: **2026-12-16**.
- La identidad **`vaqcrow-platform`** es sólo para el Quickstart local y **no funciona contra Testnet**.

### Semántica de la configuración del vault (verificada en código)

- `campaign-vault-config.ts`: **sin ninguna** de las dos claves ⇒ `{ enabled: false }`; **con exactamente una** ⇒ error de configuración. Son un **par estricto**.
- `api-config.ts` y `index.ts`: el error se lanza al cargar el módulo, sin `try/catch` ⇒ **el proceso no arranca**. Setear una sola clave es peor que no setear ninguna.
- `build-app.ts`: las rutas `/campaigns` se registran **sólo** si existe `dependencies.campaign`. Sin config, la ruta no existe y el navegador recibe un 404 de Fastify.

### Defectos de documentación encontrados y corregidos (5)

1. `NEXT_PUBLIC_API_URL` documentado, cuando el código lee `NEXT_PUBLIC_API_BASE_URL` (4 lugares).
2. Bloque `env` de `vercel.json` con sintaxis `^VAR` inexistente en Vercel.
3. Ni `.env.cloud.example` ni `.env.docker.example` nombraban las claves del vault.
4. `buildCommand` documentado (`pnpm --filter @vaqcrow/web build`) no puede funcionar en un checkout limpio: `@vaqcrow/contracts` publica sólo desde `dist/` y `pnpm --filter` no construye las dependencias del workspace. Correcto: `pnpm exec turbo run build --filter=@vaqcrow/web...`.
5. **Root Directory documentado como `/`** cuando el real es `apps/web`, lo que hacía que `outputDirectory: apps/web/.next` se buscara en `apps/web/apps/web/.next`.

Los defectos 4 y 5 los detectó el check de Vercel del PR #288, en dos iteraciones, antes del merge.

### Límites vigentes (no cerrar nada que los ignore)

- **No verificado end-to-end por navegador.** La API no tiene logging a nivel request, así que no hay rastro servidor de tráfico del frontend. Los únicos errores en los logs (`22P02` a las 02:18 del 25/09) son sondas propias con id malformado.
- **`POST /campaigns` nunca se ejercitó.** Que la clave corresponda al `owner` de la fábrica se prueba recién ahí.
- Placeholder "Step content coming soon" visible en `/request`, después del contenido real.
- `NEXT_PUBLIC_API_BASE_URL` no tiene target `preview`.
- Sin decisión registrada: almacenamiento/rotación del secreto de plataforma; SSO en previews; dominio propio.
- Un id de campaña malformado devuelve `503` en vez de `400`, y la línea de log sale con `correlationId: undefined`.

## Entregables

### E1 — `docs/planning/cloud-environment-configuration-evidence.md`

Documento de evidencia de cierre para #286 y #287. **En español.** Seguir la estructura del hermano `docs/planning/campaign-persistence-and-reconciliation-evidence.md` (leerlo antes): título con el número de issue, callout de intro que nombra la bitácora de iteración y aclara que cada resultado nombra su fuente, y las secciones `1. Contexto y objetivo`, `2. Cómo leer esta evidencia`, `3. Qué quedó implementado`, `4. Qué quedó probado` (subsecciones que digan si el resultado fue re-ejecutado en el árbol, leído de la plataforma o leído de la red), `5. Límites operativos vigentes`, `6. Mapeo de criterios de aceptación` (citar **verbatim** el criterio de cada issue y decir si se cumple), `7. Estado de entrega`.

Debe incluir la tabla de los 5 defectos de documentación con su causa y su fix, y la tabla de configuración por paso del journey.

### E2 — `docs/architecture/cloud-demo-architecture.md`

La arquitectura definitiva de la demo, **en español**, explicando de punta a punta cómo funciona Stellar Testnet en la nube con nuestra API y nuestro frontend. Debe cubrir:

- El diagrama (ver abajo).
- El recorrido de una request: navegador → Vercel (build estático + cliente) → API en Railway → Supabase / Soroban RPC / Horizon / proveedor LLM.
- **Quién firma qué y con qué clave**: la persona usuaria firma con Freighter desde el navegador (aporte, retiro, reembolso — claves nunca salen del navegador); la **plataforma** firma `factory.deploy()` y el `CreateAccount` de la PyME con `STELLAR_PLATFORM_SECRET_KEY`, cuyo único uso auditado es `platform-signer.ts`. Explicar qué garantiza cada uno y qué no.
- **Fuente de verdad**: el contrato Soroban es autoritativo para el dinero; Supabase es un espejo que se reconcilia contra la cadena, nunca al revés.
- Las dos claves del vault como par estricto y por qué una sola tumba el proceso.
- La asimetría local vs Testnet: el Quickstart local genera sus propios valores por corrida y la clave vive en el keystore como `vaqcrow-platform`; Testnet tiene valores fijos y la identidad es `vaqcrow-testnet`. Dejar claro que una no sirve para la otra.
- Las 5 variables de configuración del vault y cuáles son opcionales.
- Los límites honestos: demo, Testnet, activos sin valor económico, IA asesora, y el reset del 2026-12-16.

**El diagrama** debe ir en un bloque ` ```mermaid ` con `graph TB` y `subgraph` etiquetados en español, siguiendo el estilo del que ya existe en `docs/architecture/deploy-planning.md` (leerlo antes). Debe mostrar como mínimo: Navegador con Freighter, Vercel, Railway, Supabase, Stellar Testnet (Soroban RPC + Horizon + la fábrica y la bóveda), el proveedor LLM, y las flechas de firma de usuario vs firma de plataforma claramente diferenciadas. Nada de nodos inventados: sólo piezas que existan.

### E3 — Enlazar

`docs/architecture/environments.md` §11 ya documenta la identidad de Testnet; agregar ahí un puntero al nuevo doc de arquitectura donde corresponda, y enlazar el evidence doc desde la sección de estado del issue correspondiente si hace falta. No duplicar contenido entre los dos documentos nuevos: la arquitectura explica **cómo funciona**, la evidencia **qué se probó**.

## Restricciones

- **Nunca transcribir el valor de un secreto.** Sólo nombres de clave. Las direcciones de contrato y las claves **públicas** sí se pueden citar.
- **No tocar ni leer `.env.cloud` ni `.env.docker`** (regla global de permisos; usar los `.example`).
- **Sintaxis Obsidian**: callouts `> [!info]` / `> [!warning]` / `> [!danger]`, wikilinks `[[ruta|texto]]`.
- **No afirmar nada que no esté en este documento.** Si algo no se verificó, decirlo como límite. En particular: no declarar que el recorrido completo funciona en producción, porque no se ejercitó.
- Registro **neutral/profesional** en español; sin prosa promocional.

## Verificación

- Los dos archivos existen y el bloque `mermaid` está bien balanceado (una apertura y un cierre por bloque).
- `rg -c "S[A-Z2-7]{55}"` sobre los archivos nuevos devuelve 0 (ningún secreto transcrito).
- `rg -n "vaqcrow-testnet|CDVSSQ55|api-production-c07f|vaqcrow-web-nine"` encuentra las referencias esperadas.
- `pnpm run test:boundaries` verde (los `.md` no deberían afectarlo, pero se corre igual).
- Reportar el resultado observado, incluido lo que no se pudo verificar.

## Estado

- [x] Relevamiento y hechos verificados (arriba), listos para que el writer no re-derive nada.
- [x] E1, E2, E3 ejecutados en la rama
  `Vaqcrow#286_Task_Document_the_cloud_demo_architecture_and_the_environment_configuration`,
  mergeada en `main` con el **PR #289** (`c1ed01e`): `25abf3f` (E1), `ea7d82f` (E2 + E3),
  `38ac4a4` (corrección del criterio sub-declarado).
- [x] Verificado por el padre, no aceptado del reporte del writer: los dos archivos existen;
  el bloque `mermaid` está balanceado (1 apertura, 2 fences); **0** valores con forma de
  secret key en los dos documentos; `test:boundaries` 79/79; `git status` no lista
  `.env.cloud` ni `.env.docker`.
- [x] Este plan se commitea después, en su propio PR, por haberse quedado fuera del #289.

### Desvíos y correcciones

- **El writer sub-declaró un criterio de #287.** Marcó "No verificado" el criterio "las rutas
  de campaña están registradas, verificadas por una request observada desde el origen de la
  web". Su razonamiento era correcto —un preflight CORS `OPTIONS` no prueba el registro de la
  ruta— pero la prueba existía por otro camino: la **forma** del 404. Se re-corrió la request
  con el header `Origin` del dominio de producción y se registró con dos controles
  (`/definitely-not-a-route` → respuesta de Fastify; `/health` → `200`), y el criterio pasó a
  **Sí**.
- **El writer marcó el criterio del `outputDirectory` de #286 como "Parcial"**, y está bien
  que así sea: el criterio pide `outputDirectory: apps/web/.next` y el arreglo verificado
  **omite** el campo, porque el Root Directory real es `apps/web`. Queda declarado el
  conflicto entre la letra del criterio y la intención, en vez de forzarlo.
- **No se pudo usar el `read` sobre los `.env.*.example`** (la regla de permisos bloquea
  `*.env.*`). El writer usó `grep`/`git grep` acotados; ningún valor se leyó ni se imprimió.
- **Alcance deliberadamente no cerrado en la evidencia**: el recorrido en navegador, el
  `POST /campaigns` end-to-end, el target `preview` de la variable, el placeholder visible y
  las tres decisiones operativas sin registrar. Están en `§5 Límites operativos vigentes` del
  evidence doc, y los issues **no se cerraron** por eso.
