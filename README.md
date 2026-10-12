<p align="center">
  <img src="apps/web/public/vaqcrow-isotipo.png" alt="Isotipo de Vaqcrow" width="112" />
</p>

<h1 align="center">Vaqcrow</h1>

<p align="center"><strong>Financiamiento flexible para PyMEs argentinas mediante revenue share, con evaluación asistida por IA, control humano y liquidación verificable en Stellar.</strong></p>

<p align="center">
  <a href="./LICENSE"><img alt="Licencia: MIT" src="https://img.shields.io/badge/licencia-MIT-8a05be" /></a>
  <img alt="Node.js" src="https://img.shields.io/badge/node-%E2%89%A524%20%3C25-8a05be" />
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11.27.0-8a05be" />
  <img alt="Stellar Testnet" src="https://img.shields.io/badge/Stellar-Testnet-8a05be" />
  <img alt="Demo" src="https://img.shields.io/badge/demo-datos%20simulados-8a05be" />
</p>

Vaqcrow busca que comercios de barrio y PyMEs puedan financiarse sin depender de cuotas fijas e intereses asfixiantes: quienes aportan capital reciben una participación contractual en las ventas, de modo que la obligación acompaña el desempeño del negocio.

**Misión de largo plazo:** democratizar la inversión en Latinoamérica conectando pequeños inversores con PyMEs tradicionales mediante financiamiento colectivo por revenue share, con Stellar para aportar transparencia, eficiencia y autocustodia. El producto y la demo actuales se acotan exclusivamente a Argentina.

**Lema:** _«Juntos podemos hacernos grandes»._

> [!warning] Aviso de confianza
> **Vaqcrow no es hoy una oferta, recomendación ni producto de inversión.** El KYC/KYB, las ventas y el corredor ARS/activo Stellar están **SIMULADOS**. La IA es consultiva y requiere aprobación humana. Freighter se usa de forma no custodial: cada persona conserva sus claves y Vaqcrow nunca recibe su seed. Los activos y transacciones de Stellar Testnet no tienen valor económico. La demo no acredita autorización regulatoria, legalidad, rentabilidad, solvencia ni disponibilidad en producción.

## Qué es Vaqcrow hoy

- **Repositorio:** monorepo funcional con Fastify API, Next.js 16 web, contratos compartidos, dominio aplicado, `packages/ai`, el workspace Rust `contracts/` (`campaign-vault` y `campaign-factory`) y migraciones Supabase para solicitud de PyME, evaluación, decisiones humanas, distribución de revenue share y persistencia de campañas.
- **Producto por roles:** la app es un producto con la forma exacta del template de diseño, con tres roles —`PYME`, `INVERSOR` y `ADMIN`— y **autenticación real**: Supabase Auth con email y contraseña, roles verificados en el servidor y RLS por rol. Cada rol tiene su área (ver [Módulos por rol](#módulos-por-rol)); el recorrido vertical (solicitud, evaluación, decisión humana, fondeo, ventas, distribución) queda encadenado por los identificadores que cada paso produce.
- **IA real:** la evaluación usa el proveedor `opencode-go` detrás de un adaptador reemplazable en `packages/ai`; sigue siendo asesora y no aprueba, no calcula obligaciones ni mueve fondos.
- **Stellar y custodia:** Freighter y Stellar Testnet están implementados, y el fondeo se custodia en un contrato Soroban (una bóveda por campaña, liquidación atómica al alcanzar el objetivo y reembolso permissionless al vencer). La plataforma firma `factory.deploy()` y el `CreateAccount` de la PyME; la persona usuaria firma aportes, retiros y reembolsos con Freighter.
- **Pruebas:** 190 archivos de test unitarios y de componentes seleccionados por `pnpm run test` (Vitest + Testing Library), además de las suites separadas de integración con Supabase, boundaries y E2E con Playwright.
- **Notificaciones:** campana in-app y email transaccional por la API de Resend detrás de un puerto y un adaptador, con las pruebas del PR usando un doble.
- **Diseño (fuente de verdad):** el template de **Claude Design** en `docs/design/template/` —14 pantallas `.dc.html`, cada una con los dos temas en el mismo archivo— reemplazó al proyecto de Google Stitch el 01/10/2026. Se comparte en <https://claude.ai/design/p/d16823bf-de57-404f-a94b-6a3ad638a770?file=Vaqcrow+Landing.html&via=share>. El directorio está fuera del repositorio a propósito (`.gitignore`) y su HTML generado nunca es implementación autoritativa de producción; el detalle está en [Diseño UI/UX y fuente de verdad visual](./docs/design/demo-ui.md). El handoff vive en `docs/design/design_handoff_vaqcrow/` (`README.md`, `brief/`, `screens/`): es la fuente visual y de comportamiento del producto por roles, y **lo que el template no diseña se registra como pregunta abierta, no se inventa**.

> [!info] Estado de la entrega
> Este repositorio es la **demo del TFM** (Máster en Desarrollo con IA). El estado de cada unidad de trabajo —qué está planificado, en curso o entregado— se sigue en el **tablero Vaqcrow-TFM**, que es la fuente de verdad; este README describe el **producto y la arquitectura**, no el estado de los issues. La planificación ejecutable está en [la hoja de ruta](./docs/planning/demo-tasks-list.md).

## Módulos por rol

La app tiene tres roles con autenticación real. `PYME` e `INVERSOR` se eligen al crear la cuenta; `ADMIN` nunca se autoasigna (se ingresa por `/admin`, sin alta pública).

| Rol | Área | Módulos |
|---|---|---|
| Público | Sin sesión | Landing (`/`), Explorar PyMEs (`/explore`), Acerca de, Guía de inversión, Guía para emprendedores, Ayuda (el asistente RAG es futuro: «Próximamente») |
| **PYME** | `/company` | Onboarding («Registrar mi PyME») y Mi campaña (bóvedas, distribuciones, ventas declaradas, aportantes) |
| **INVERSOR** | `/portfolio`, `/reports` | Detalle de PyME (`/campaigns/[id]`), Mi portafolio, Informes |
| **ADMIN** | `/admin` | Cola de PyMEs, revisión y decisión humana, evidencia por solicitud, usuarios y auditoría |

- **Rutas siempre en inglés**; la UI en español.
- El ingreso redirige por el **rol verificado**, no por el selector del formulario; el selector «Soy PyME / Soy inversor» debe coincidir con ese rol o el ingreso se rechaza.
- Explorar, las guías y la ayuda son **públicas**; el detalle de una PyME exige cuenta.

## Qué demuestra la demo

La historia vertical implementada sigue un único caso sintético —**Panadería Horizonte SRL**, una PyME argentina— de punta a punta:

1. La PyME presenta verificación de identidad, KYC/KYB, historial de ventas y comprobantes simulados.
2. Una IA real analiza la evidencia suministrada, detecta anomalías y datos faltantes, expresa incertidumbre y entrega una recomendación estructurada y trazable.
3. Un operador revisa la evidencia y registra la decisión humana; la IA no autoriza el financiamiento.
4. Un inversor conecta Freighter y firma, de forma no custodial, la invocación del contrato que alimenta la bóveda de la campaña en Stellar Testnet.
5. La bóveda custodia los aportes: el contrato liquida de forma atómica a la PyME al alcanzar el objetivo y habilita el reembolso permissionless si vence el plazo; la API envía la invocación firmada al Soroban RPC y refleja el estado observado en la cadena.
6. El sistema calcula la obligación de revenue share con reglas determinísticas y muestra la distribución, que sigue el camino clásico de pagos en Testnet, con sus estados y hashes.

El objetivo de la demo es mostrar este recorrido sin ocultar qué es real, qué está simulado y qué decisiones continúan abiertas para una operación argentina. **No hay un objetivo de duración.** La latencia del proveedor de IA es alta e impredecible —**93,79 s** en la medición del 01/10/2026— y el recorrido completo por navegador contra producción **nunca se cronometró de punta a punta**.

## Real versus simulado

| Capacidad | En la demo |
|---|---|
| Empresa y perfiles | Datos sintéticos, rotulados `SIMULADO`; cuentas y roles **reales** con Supabase Auth |
| Documentos y fotos de la PyME | **Carga real** a un bucket privado de Supabase Storage; contenido no confiable |
| KYC/KYB (PyME e inversor) | **Simulado** detrás de un adaptador reemplazable; el del inversor se aprueba solo en el primer aporte |
| Historial y feed mensual de ventas | **Simulados**, reproducibles y con una anomalía/faltante intencionales |
| Chequeo de completitud y evaluación de riesgo | **Real**: reglas deterministas sobre datos declarados + relevancia por contenido (visión), y evaluación de riesgo con el proveedor real detrás de un adaptador |
| Decisión de financiamiento | **Real y humana** sobre el caso sintético |
| Entrada/cotización ARS | **Simulada**; el corredor de producción continúa sin resolver |
| Wallet y firma | **Reales** con Freighter, de forma no custodial (PyME e inversor) |
| Notificaciones | **Real**: campana in-app y email por la API de Resend, detrás de un puerto (las pruebas usan un doble) |
| Fondeo y distribución | **Transacciones reales en Stellar Testnet**, sin valor económico |
| Confirmación | **Real y asíncrona**: Soroban RPC para la bóveda y Horizon para cuentas, pagos y distribución |
| Cálculo de revenue share | **Real, determinístico** y ajeno al LLM |

**Regla de presentación:** el dinero en ARS y su conversión a activo Stellar siguen **simulados** (no hay corredor real: Vaqcrow no mueve ARS ni cripto de terceros). Una simulación demuestra UX, contratos de integración y control del flujo; no demuestra disponibilidad, legalidad, SLA, costos ni calidad de un proveedor real.

## IA: función y límites

La IA normaliza y organiza evidencia, cita sus fuentes, identifica anomalías y datos faltantes, expresa incertidumbre y propone preguntas para revisión. Su salida debe cumplir un esquema estricto y quedar asociada a versión de modelo/prompt, timestamp y aprobación o rechazo humano.

Guardrails obligatorios:

- no inventar datos ni completar faltantes;
- no presentar inferencias como hechos;
- no aprobar casos ni sustituir la decisión humana;
- no calcular montos, porcentajes, redondeos u obligaciones financieras;
- no construir decisiones finales, firmar ni transferir fondos;
- ante timeout o salida inválida, derivar el caso a revisión manual.

## Decisión de arquitectura

Vaqcrow debe continuar como **monorepo**. Un monorepo es una estrategia de organización del código, no un monolito de despliegue: `web`, `api` y `worker` pueden compilarse, desplegarse y revertirse por separado. La decisión responde al dominio compartido, los contratos y fixtures comunes, los paquetes reutilizables, el journey vertical, la CI coordinada y el tamaño actual del equipo y del proyecto.

Los límites para evitar un monorepo caótico son explícitos: dependencias dirigidas, dominio independiente de frameworks, ninguna importación de internals entre aplicaciones, un paquete por capacidad cohesionada y despliegues separados. La estructura completa y sus reglas están en [Arquitectura del monorepo](./docs/architecture/monorepo.md).

Estructura actual:

```text
apps/web · apps/api                          ← implementados y funcionales
packages/domain · contracts · ai             ← implementados con tests
contracts/                                   ← workspace Rust: campaign-vault · campaign-factory
supabase/                                    ← config.toml + migraciones
```

Paquetes previstos para etapas futuras:

```text
apps/worker (opcional)
packages/stellar · simulators · db · config · testing · ui
```

## Arquitecturas de la demo

Dos vistas de **despliegue**: qué corre en la máquina de desarrollo con el perfil docker y qué corre en la nube. El flujo de una request y quién firma cada transacción —el detalle fino— está en [Arquitectura de la demo en la nube](./docs/architecture/cloud-demo-architecture.md): acá sólo se ubica cada pieza.

### Arquitectura local (perfil docker)

```mermaid
graph TB
    subgraph HOST["Host (tu máquina)"]
        BROWSER["Navegador<br/>Freighter en la extensión"]
        WEB["Web Next.js — next dev<br/>:3001"]
        KEYSTORE["Keystore de la Stellar CLI<br/>identidad vaqcrow-platform"]
    end

    subgraph DOCKER["Contenedores Docker (Docker Desktop)"]
        API["API Fastify — contenedor<br/>apps/api/Dockerfile · :3000"]
        SUPABASE["Supabase local (CLI)<br/>Auth + Postgres + Storage · :54321"]
        QUICKSTART["Stellar Quickstart (opt-in)<br/>Soroban RPC + Horizon · :8000"]
    end

    BROWSER -->|"abre http://localhost:3001"| WEB
    BROWSER -->|"firma de la persona usuaria: la clave nunca sale del navegador"| WEB
    WEB -->|"NEXT_PUBLIC_API_BASE_URL=http://localhost:3000"| API
    API -->|"host.docker.internal:54321"| SUPABASE
    API -.->|"STELLAR_NETWORK=local, bóveda opt-in (Perfiles de entorno §11)"| QUICKSTART
    KEYSTORE -.->|"generate-docker-env.sh lee la clave de plataforma sin imprimirla"| API
```

`pnpm env:docker:up` levanta Supabase, la API y (si hace falta) el Quickstart; `next dev` corre en el host, no en un contenedor. El recorrido de la bóveda contra el Quickstart es opt-in y su identidad de plataforma es sólo para la red local: no sirve para Testnet.

### Arquitectura de la demo en la nube

```mermaid
graph TB
    subgraph BROWSER["Navegador"]
        USER["Persona usuaria"]
        FREIGHTER["Freighter — clave privada de la persona"]
    end

    subgraph VERCEL["Vercel — despliegue de la web"]
        WEB["Build de Next.js<br/>NEXT_PUBLIC_API_BASE_URL horneada en build time"]
    end

    subgraph RAILWAY["Railway — despliegue de la API"]
        API["Fastify + Node.js — APP_ENV=demo<br/>autorización por rol · IA en 2 pasos · cálculo"]
        SIGNER["platform-signer.ts<br/>único uso de STELLAR_PLATFORM_SECRET_KEY"]
    end

    subgraph SUPABASE["Supabase remoto"]
        AUTH["Auth — roles PYME · INVERSOR · ADMIN"]
        DB[("PostgreSQL + RLS — espejo de la cadena")]
        STORAGE["Storage privado<br/>documentos y fotos"]
    end

    subgraph STELLAR["Stellar Testnet"]
        RPC["Soroban RPC"]
        HORIZON["Horizon"]
        FACTORY["Fábrica de bóvedas"]
        VAULT["Bóveda de campaña — una por campaña"]
    end

    subgraph EXT["Servicios externos"]
        LLM["Proveedor LLM — evaluación asesora"]
        RESEND["Resend — email transaccional"]
    end

    USER -->|"https://vaqcrow-web-nine.vercel.app"| WEB
    WEB -->|"HTTPS + CORS"| API
    WEB -->|"pide firmar la invocación"| FREIGHTER
    FREIGHTER -->|"firma de la persona usuaria: aporte / retiro / reembolso"| WEB
    WEB -->|"sesión (cookies @supabase/ssr)"| AUTH
    WEB -->|"invocación firmada"| API
    AUTH -->|"identidad verificada"| API
    API --> DB
    API -->|"documentos no confiables (subida mediada)"| STORAGE
    API -->|"evaluación"| LLM
    API -->|"notificaciones"| RESEND
    API -->|"sendTransaction y consulta de estado"| RPC
    API -->|"cuentas clásicas y pagos"| HORIZON
    API -->|"pide firma de plataforma"| SIGNER
    SIGNER -->|"firma de la plataforma: factory.deploy / CreateAccount"| API
    RPC --> FACTORY
    FACTORY -->|"deploy"| VAULT
    HORIZON -->|"cuenta de la PyME"| VAULT
```

La persona usuaria firma con Freighter en su navegador; la plataforma firma `factory.deploy()` y el `CreateAccount` de la PyME con `STELLAR_PLATFORM_SECRET_KEY`, cuyo único punto de uso es `platform-signer.ts`. La cadena es la fuente de verdad del dinero y Supabase es su espejo. Es una demo en **Testnet**: la identidad, el KYC/KYB y las ventas son simulados y los activos no tienen valor económico.

### Arquitectura por roles

El producto con la forma del template. Cada rol tiene su área y su superficie de evidencia; el motor (evaluación, decisión, bóveda, distribución) es compartido.

```mermaid
graph LR
    subgraph NAV["Navegador"]
        PYME["PyME<br/>Freighter"]
        INV["Inversor<br/>Freighter"]
        ADMIN["Admin<br/>sin wallet"]
    end

    subgraph WEB["apps/web — Next.js"]
        PUBLIC["Público<br/>Landing · Explorar PyMEs · Acerca de · Ayuda · Guías"]
        PYMEAREA["Área PyME<br/>Onboarding PyME · Mi campaña"]
        INVAREA["Área inversor<br/>Detalle PyME · Mi portafolio · Informes"]
        ADMINAREA["/admin<br/>PyMEs · Revisión · Evidencia · Usuarios"]
    end

    subgraph SB["Supabase"]
        AUTH["Auth<br/>roles PYME · INVERSOR · ADMIN"]
        DB[("PostgreSQL + RLS<br/>auditoría · notificaciones")]
        STORAGE["Storage privado<br/>documentos y fotos"]
    end

    API["apps/api — Fastify<br/>autorización por rol · IA consultiva en 2 pasos<br/>decisión humana · cálculo de distribución<br/>platform-signer: solo factory.deploy / CreateAccount"]

    subgraph EXT["Servicios externos"]
        LLM["Proveedor LLM"]
        RESEND["Resend — email"]
    end

    subgraph ST["Stellar Testnet"]
        FACTORY["Fábrica de bóvedas"]
        VAULT["Bóveda de campaña"]
        PYMEACC["Cuenta de la PyME"]
        INVACC["Cuentas de inversores"]
    end

    NAV --> PUBLIC
    PYME --> PYMEAREA
    INV --> INVAREA
    ADMIN --> ADMINAREA
    WEB -->|"sesión"| AUTH
    WEB -->|"HTTPS + txs firmadas en Freighter"| API
    AUTH -->|"identidad verificada"| API
    API --> DB
    API -->|"documentos no confiables"| STORAGE
    API --> LLM
    API -->|"notificaciones"| RESEND
    API -->|"deploy firmado por la plataforma<br/>disparado por la aprobación del admin"| FACTORY
    FACTORY -->|"destino inmutable"| VAULT
    VAULT -->|"meta alcanzada: liquida"| PYMEACC
    VAULT -->|"vencida: reembolso"| INVACC
    PYMEACC -->|"revenue share firmado por la PyME"| INVACC
```

Vaqcrow **nunca** custodia claves ni recibe o mueve dinero de terceros: la clave de plataforma solo despliega la bóveda (y crea la cuenta de la PyME en Testnet) cuando un admin aprueba; los aportes los custodia el contrato y cada pago lo firma su dueño en Freighter. La conversión ARS ↔ activo sigue simulada.

## Stack del proyecto

| Capa | Tecnología y responsabilidad |
|---|---|
| Web | Next.js + React para la interfaz y un BFF limitado a necesidades de presentación; sesión de Supabase en cookies (`@supabase/ssr`) y protección de rutas en el servidor (`apps/web/src/proxy.ts`) |
| API | Node.js + TypeScript + Fastify para comandos, dominio, verificación XDR y coordinación |
| Persistencia | PostgreSQL gestionado mediante Supabase; Auth (email y contraseña, roles y RLS) y Storage privado para documentos y fotos de la PyME |
| Notificaciones | Campana in-app y email por la API de Resend detrás de un puerto y adaptador |
| Stellar | Stellar SDK, Freighter, Horizon y Testnet para firma no custodial, envío y confirmación; **contratos de Stellar (Rust) para la custodia del fondeo** |
| IA | Proveedor LLM `opencode-go`, detrás de un adaptador reemplazable y con salida estructurada |
| Pruebas | Vitest y Testing Library para unidad, dominio y UI; Playwright para el recorrido crítico en navegador |
| Workspace y CI | pnpm, Turborepo; GitHub Actions con lockfile congelado y gates de pull request |

El **fondeo se custodia en un contrato de Stellar** (Rust + `soroban-sdk`): cada campaña abre su propia bóveda, el contrato liquida a la PyME apenas se alcanza el objetivo y reembolsa a los inversores si vence la fecha sin alcanzarlo. Se evaluó **Claimable Balance (CAP-23)** como alternativa sin contrato y **se descartó**, porque no puede expresar "objetivo alcanzado" on-chain. Detalle en `docs/planning/stellar-blockchain-requirements.md`.

## Despliegue

- `apps/web` y `apps/api` tienen artefactos y despliegues independientes: la web en **Vercel** y la API en **Railway**, ambas desplegadas desde `main`. `NEXT_PUBLIC_API_BASE_URL` se incorpora al bundle de la web en tiempo de build.
- `apps/worker` no existe todavía: las confirmaciones asíncronas viven en la API. Solo se agregará como proceso independiente si esos jobs no caben de forma segura en ella.
- Supabase aporta servicios gestionados, sin convertir al cliente web en dueño de la autorización ni de los estados críticos.

Estos despliegues son la **demo en Stellar Testnet**, no una operación productiva real: la verificación de identidad, KYC/KYB y ventas siguen simulados y los activos no tienen valor económico.

## Cómo ejecutar el proyecto

El proyecto tiene dos perfiles de entorno, cada uno en su propio archivo en la raíz del repositorio. Ninguno se versiona; las plantillas `.env.docker.example` y `.env.cloud.example` sí.

| Perfil | Archivo | Supabase | API | Stellar | Uso |
|---|---|---|---|---|---|
| **docker** | `.env.docker` | Stack local en Docker (`:54321`) | Contenedor en Docker Desktop (`:3000`) | Quickstart local (`:8000`) para contratos | Pruebas locales |
| **cloud** | `.env.cloud` | Proyecto remoto | Proceso local contra servicios remotos (Railway en la demo) | Testnet | Exclusivo para la demo |

> [!important]
> Los nombres no son `.env.development` / `.env.local` a propósito: Next.js y Vite cargan esos archivos en capas, no como alternativas. Cada perfil se elige explícitamente con su comando. Detalle completo en [Perfiles de entorno](./docs/architecture/environments.md).

### Requisitos

- Node `>=24 <25` y pnpm `11.27.0` (`corepack enable`), luego `pnpm install --frozen-lockfile`.
- Docker Desktop en ejecución y Supabase CLI (sólo para el perfil docker).
- Un `.env.cloud` completo: el perfil docker reutiliza sus variables `LLM_*`, porque no hay un LLM local.

### Ambiente local (perfil docker)

```bash
cp .env.cloud.example .env.cloud     # una sola vez; completar con las credenciales reales
pnpm env:docker:up                   # Supabase local + Stellar Quickstart + API en contenedor
pnpm dev:web:docker                  # web en http://localhost:3001 → usa la API del contenedor (:3000)
```

- `pnpm env:docker:up` levanta Supabase local (kong, rest, auth, db), reutiliza Quickstart si ya está sano, genera `.env.docker` la primera vez sin imprimir secretos y construye la imagen de la API desde `apps/api/Dockerfile`. Termina cuando `http://localhost:3000/health` responde.
- `pnpm env:docker:status` muestra el estado de cada pieza sin mostrar claves; `pnpm env:docker:down` detiene la API y Supabase conservando los datos (`pnpm env:docker:down -- --all` también detiene Quickstart).
- Pruebas contra el stack local: `pnpm run test:db` (pgTAP de esquema, RLS y grants) y `pnpm --filter @vaqcrow/api test:integration` (usa el perfil docker por defecto).
- Para regenerar `.env.docker` (por ejemplo, tras cambiar `.env.cloud`): `./scripts/env/generate-docker-env.sh --force`.

> [!tip]
> El primer `pnpm env:docker:up` construye la imagen de la API y puede tardar varios minutos; los siguientes reutilizan las capas en caché.

### Ambiente cloud (perfil cloud)

```bash
pnpm dev:api:cloud                   # API local en http://localhost:3000 contra el Supabase remoto
pnpm dev:web:cloud                   # web en http://localhost:3001 contra NEXT_PUBLIC_API_BASE_URL de .env.cloud
```

- `.env.cloud` debe tener `APP_ENV=demo` y `NEXT_PUBLIC_API_BASE_URL` apuntando a la API que se quiere usar: `http://localhost:3000` con `pnpm dev:api:cloud`, o la URL pública de Railway una vez desplegada.
- La suite de integración contra el proyecto remoto es opt-in: `pnpm --filter @vaqcrow/api test:integration:cloud`.

> [!warning]
> El perfil cloud escribe en la base de datos de la demo. Usalo para preparar o ensayar la demo, no para pruebas; las migraciones se prueban primero en el perfil docker y luego se aplican al proyecto remoto en la misma unidad de trabajo.

> [!info]
> Ambos perfiles publican la API en el puerto `3000` y la web en el `3001`: detené el contenedor (`pnpm env:docker:down`) antes de usar `pnpm dev:api:cloud`.

> [!info] CORS
> La API habilita CORS vía `CORS_ALLOWED_ORIGINS` (lista de orígenes exactos separados por coma). Sin configurar, el perfil docker (`APP_ENV=local`) permite `http://localhost:3001`/`http://127.0.0.1:3001` por default; el perfil cloud (`APP_ENV=demo`) no permite ningún origen hasta declarar explícitamente el de Vercel. Ver [Perfiles de entorno §8](./docs/architecture/environments.md).

## Desarrollo y calidad

- **Setup local:** ver [Cómo ejecutar el proyecto](#cómo-ejecutar-el-proyecto) y [Perfiles de entorno](./docs/architecture/environments.md) — cubre `.env.cloud`/`.env.docker`, `pnpm env:docker:up` y el flujo de migraciones.
- **Verificación:** `pnpm verify` ejecuta lint, typecheck, pruebas, build y verificación de boundaries entre workspaces. Las pruebas usan fixtures y dobles locales, sin depender de Testnet, Horizon ni del proveedor LLM.
- **CI:** [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) corre en cada pull request con `pnpm install --frozen-lockfile`: un job ejecuta `pnpm verify`, otro el journey de Playwright y un tercero compila, prueba y despliega los contratos Rust en una red local. Ningún job usa servicios externos vivos ni requiere secretos del repositorio.
- **Playwright:** cubre el recorrido crítico de la demo contra un doble local en `apps/web/e2e/`, con navegador Chromium, un solo worker y sin reintentos. Los specs son **por rol**: `auth-roles.spec.ts`, `app-header.spec.ts`, `pyme-onboarding.spec.ts` y `admin-review.spec.ts` (cola → evidencia → revisión). Comandos: `pnpm run test:e2e:install` (instala Chromium, una vez) y `pnpm run test:e2e`.
- **Gates verificados por tests:** `tests/testing-and-ci-gates.test.ts` comprueba de forma determinística el workflow de CI (instalación congelada, sin secretos ni endpoints externos), la determinación de Playwright y el doble local, y ejercita el rechazo del guard de hosts externos.
- **Comprobaciones externas:** Testnet y LLM se ejecutan por separado y de forma acotada en preview/demo o antes del ensayo.
- **Secretos:** se inyectan desde el entorno. No se deben confirmar seeds, claves privadas, tokens, PII ni credenciales en Git o logs.

## Storybook (taller de componentes)

El taller de componentes vive en `apps/web/.storybook/` y renderiza las primitivas reales con los tokens reales, en claro y en oscuro. No es una maqueta paralela: usa los mismos componentes y el mismo CSS que la app. La guía completa —requisitos, temas, qué está cubierto y problemas frecuentes— está en [Storybook y los dos temas](./docs/guides/storybook.md).

```bash
pnpm --filter @vaqcrow/web storybook          # taller en http://localhost:6006
pnpm --filter @vaqcrow/web build-storybook    # build estático en apps/web/storybook-static/
python3 -m http.server 6006 --directory apps/web/storybook-static   # servir ese build
```

- `apps/web/storybook-static/` es la salida del build estático y está ignorada por Git.
- Storybook queda **fuera de `pnpm run verify` a propósito**: no se suma al gate documentado ni lo vuelve más lento. El addon de accesibilidad reporta en su panel pero no bloquea, y el taller no involucra backend, wallet ni Testnet: sólo componentes y CSS.

**Versión publicada.** El workflow [`.github/workflows/storybook.yml`](./.github/workflows/storybook.yml) construye esa misma salida y la publica en GitHub Pages: **[reyduar.github.io/Vaqcrow/storybook](https://reyduar.github.io/Vaqcrow/storybook)**. Un pull request sólo construye, sin publicar, así que un Storybook roto falla antes del merge; los push a `main` publican. Es un destino propio: no toca el despliegue de la web ([`vercel.json`](./vercel.json), que sigue construyendo sólo `@vaqcrow/web` con el framework Next.js) ni el de la API.

## Planificación y gestión del desarrollo

La fuente de alcance para implementar la demo es el [plan de la demo](./docs/planning/DEMO.md). La planificación y la implementación se mantienen deliberadamente separadas: el plan define el resultado esperado y el backlog de GitHub organiza el trabajo ejecutable.

El **estado** de cada unidad vive en el tablero **Vaqcrow-TFM**, no en este README ni en el corpus: qué está en Backlog, Ready, In Progress, Testing, Review, Blocked o Done se sigue ahí. Este documento describe el producto y la arquitectura; el corpus `docs/planning/*-evidence.md` registra qué se verificó y cuándo.

Cada Feature o Task de implementación incluye contexto, objetivo, requisitos funcionales y técnicos, criterios de aceptación verificables, dependencias, estrategia de pruebas y Definition of Done. No se marcan issues como completados sin evidencia en el repositorio, y la implementación comienza al seleccionar una unidad de trabajo con sus dependencias satisfechas.

## Documentación

- [Arquitectura del monorepo](./docs/architecture/monorepo.md) — decisión, árbol propuesto, dependencias, despliegue, testing y límites de crecimiento.
- [Plan de la demo](./docs/planning/DEMO.md) — producto por roles, arquitectura, pruebas, guion de presentación y límites.
- [Hoja de ruta ejecutable](./docs/planning/demo-tasks-list.md) — Epics, Features y Tasks.
- [Plan del producto real](./docs/planning/product.md) — validación para Argentina, riesgos regulatorios y ruta hacia producción.
- [Evidencia del recorrido vertical completo](./docs/planning/complete-vertical-demo-journey-evidence.md) — criterios de aceptación, verificación y límites.
- [Diseño UI/UX y fuente de verdad visual](./docs/design/demo-ui.md) — template de Claude Design, flujos, estados, accesibilidad y pendientes de diseño.
- [Storybook y los dos temas](./docs/guides/storybook.md) — taller de componentes, temas claro/oscuro y qué está cubierto.

## Límites y decisiones abiertas

Lo que sigue abierto, con honestidad:

- **Corrida cronometrada de punta a punta.** El recorrido completo por navegador contra producción no se ejecutó, así que no hay un tiempo de punta a punta medido; la latencia del proveedor de IA medida es alta e impredecible. **No hay un objetivo de duración.**
- **Prueba en vivo contra Testnet.** La suite `e2e-live` necesita credenciales del operador y Testnet, y no se corrió de forma sostenida.
- **Reset de Testnet del 16/12/2026.** Invalida las direcciones de contrato: obliga a redesplegar la fábrica y reapuntar `STELLAR_CAMPAIGN_FACTORY_ID`; el procedimiento está documentado y todavía no se ejercitó.
- **Bordes conocidos:** `contributions_incomplete` tras un retiro total, un id de campaña malformado que responde `503`, el feed de ventas en memoria que se pierde al reiniciar la API y `scripts/` fuera de ESLint.
- **Diseño pendiente:** las pantallas del template que la app todavía no tiene como ruta y las variantes móviles por ruta.
- **Decisiones de producción abiertas:** clasificación jurídica del instrumento, cumplimiento regulatorio/AML/KYC real, corredor ARS↔activo Stellar (no validado), privacidad y tratamiento de datos, verificación de ventas y cobranza reales, y auditoría/controles de emergencia del contrato. El detalle está en [el plan del producto real](./docs/planning/product.md).

## Licencia

Este repositorio se distribuye bajo la [licencia MIT](./LICENSE).
