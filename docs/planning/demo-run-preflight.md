---
title: Demo run preflight
tags:
  - planning
  - demo
  - runbook
  - stellar
date: 2026-09-30
status: draft
---

# Corrida hosteada y cronometrada de la demo — preflight y runbook

> [!info] Objetivo
> Dejar listo, y poder comprobar antes de empezar, el entorno de una corrida del recorrido completo de la demo (solicitud → evaluación de IA → aprobación humana → fondeo en la bóveda → ventas mensuales → obligación determinística → distribución en Testnet → evidencia) en **siete minutos o menos**. Es la Task T6 de [#95](https://github.com/reyduar/Vaqcrow/issues/95) (Feature #30). No reemplaza a [[docs/guides/freighter-and-testnet-walkthrough|la guía de Freighter y Testnet]], que explica el recorrido paso a paso.

> [!warning] Sólo Testnet, sólo simulación
> Identidad, KYC/KYB, historial de ventas y conversión ARS ↔ activo son **simulados**; Stellar corre en **Testnet** y el XLM no tiene valor económico; la IA es solo asesora. Nada de esto describe un producto en producción.

## 1. Decisión: no hay reset de base de datos

Opción A (decidida el 2026-09-30): **no se reinicia la base entre ensayos**. Cada ensayo crea una solicitud (`POST /sme-requests`) y una campaña nuevas; la página de evidencia filtra por los identificadores del recorrido en curso, así que las filas de ensayos anteriores no interfieren. El estado de la cadena tampoco se puede reiniciar. Por eso `supabase/seed/demo-application.sql` se eliminó: el recorrido ya no depende de ninguna fila sembrada.

## 2. Prerrequisitos

### 2.1 Cuentas por rol y fondeo

| Rol | Qué es | Saldo nativo mínimo por defecto | Por qué ese piso |
|---|---|---|---|
| **Plataforma** | La cuenta de `STELLAR_PLATFORM_SECRET_KEY`; abre cada bóveda y paga sus comisiones | 10 XLM | `CreateAccount` de cada bóveda (2 XLM) más comisiones de la fábrica |
| **PyME (SME)** | La wallet Freighter que se conecta al abrir la bóveda y que firma la distribución | 10 XLM | Paga la distribución (a lo sumo la meta de la campaña; con la meta chica recomendada son pocos XLM), más comisiones y reserva |
| **Inversor** (una o más) | La wallet Freighter que contribuye | 20 XLM | La meta de la demo (recomendada: 10 XLM) más comisiones y reserva (1 XLM base + 0,5 XLM por entrada) |

Los pisos son solo valores por defecto: se ajustan con `--platform-min`, `--sme-min` e `--investor-min` (en XLM). Todas las cuentas se fondean con Friendbot de Testnet; ver [[docs/planning/freighter-and-testnet-account-setup|Preparación de Freighter y una cuenta Testnet]] y [[docs/architecture/stellar-accounts-and-keys|cuentas y claves]]. **Nunca** se comparte ni se pega una frase de recuperación o clave privada de una wallet de usuario: Vaqcrow sólo usa direcciones públicas (`G…`).

### 2.2 Nombres que el preflight exige y dónde vive cada uno

El perfil que corre la demo real es `.env.cloud` (API en Railway, web en Vercel; ver [[docs/architecture/environments|Environments]] y [[docs/architecture/cloud-demo-architecture|Cloud Demo Architecture]]). El preflight comprueba los nombres cuya **falta rompe el recorrido hosteado**, no los que la API necesita para arrancar; y **no todos viven en el archivo local**, así que conviene tener claro dónde está cada grupo:

| Grupo | Nombres | Dónde vive |
|---|---|---|
| Perfil local (`.env.cloud`) | `APP_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `STELLAR_NETWORK` | En el archivo local del repositorio (valores no secretos) |
| Servicio hosteado de la API (Railway) | `STELLAR_CAMPAIGN_FACTORY_ID` + `STELLAR_PLATFORM_SECRET_KEY` (estas dos **como par**: sin ambas no se registran las rutas de campaña) y `CORS_ALLOWED_ORIGINS` (debe incluir el origen de Vercel) | Variables del servicio en Railway; el repositorio nunca guarda el secreto |
| Host de la web (Vercel) | `NEXT_PUBLIC_API_BASE_URL` | Variable del proyecto en Vercel (sólo `production`, por decisión §5.2 de la evidencia) |
| **Opcionales** con default canónico | `STELLAR_HORIZON_URL` y `STELLAR_RPC_URL` | Si faltan, tanto la API como el preflight usan los endpoints canónicos de Testnet (`https://horizon-testnet.stellar.org` y `https://soroban-testnet.stellar.org`) |

- **Cuentas del ensayo** (opcionales, alternativa a los flags): `DEMO_SME_PUBLIC_KEY` y `DEMO_INVESTOR_PUBLIC_KEYS` (claves públicas separadas por coma). Son solo direcciones públicas.

> [!info] Por qué `CORS_ALLOWED_ORIGINS` sí es crítico
> No es una variable de arranque, pero fuera de `APP_ENV=local` su ausencia resuelve a una lista de orígenes **vacía** (`apps/api/src/application/config/cors-config.ts`), y el navegador entonces bloquea las llamadas. Por eso el preflight lo exige aunque la API arranque sin él.

> [!tip] Horizon y RPC no son obligatorios
> `STELLAR_HORIZON_URL` y `STELLAR_RPC_URL` **no** son variables requeridas: cuando faltan, el preflight sondea los endpoints canónicos de Testnet y lo indica en el resultado. La API hace lo mismo al arrancar (ver `apps/api/src/application/config/stellar-config.ts`).

### 2.3 Fábrica desplegada y migraciones

- La fábrica de campañas debe estar desplegada en Testnet y su id configurado en `STELLAR_CAMPAIGN_FACTORY_ID`.
- Todas las migraciones del repositorio deben estar aplicadas en el proyecto **remoto** de Supabase (ver `CLAUDE.md` § Supabase migration workflow). En particular, `revenue_share_distribution` necesita las columnas `campaign_id` y `period`.

## 3. Correr el preflight

`pnpm demo:preflight` es de **solo lectura**: hace `GET`/`HEAD` y los métodos JSON-RPC `getHealth`, `getNetwork` y `getLedgerEntries`. No escribe en la base, no envía transacciones y no imprime valores de secretos (sólo nombres de variables y claves públicas abreviadas). Sale con código distinto de cero si falla algún chequeo.

```bash
# Con el perfil cloud y las cuentas del ensayo
pnpm demo:preflight --env-file .env.cloud \
  --sme G… --investor G… --investor G…

# Salida JSON, otra API y pisos propios
pnpm demo:preflight --env-file .env.cloud --api https://<api> --json \
  --sme G… --investor G… --investor-min 30

pnpm demo:preflight --help
```

> [!warning] Un `--env-file .env.cloud` a solas no cubre toda la corrida
> El archivo local sólo contiene el subconjunto del perfil local (§2.2). Las variables que viven en Railway (el par de la campaña y `CORS_ALLOWED_ORIGINS`) y en Vercel (`NEXT_PUBLIC_API_BASE_URL`) **no están** en ese archivo. Una corrida con sólo `--env-file .env.cloud` va a marcar en rojo `env-api`, `env-web` y `api-health`, y también las cuentas si no se pasaron los flags. **No es un defecto del entorno**: es la señal correcta de que faltan los valores hosteados. Los chequeos de Horizon y de RPC, en cambio, sí corren: usan los endpoints canónicos de Testnet cuando las variables no están.

Cómo aportar los valores hosteados, en orden de preferencia:

1. **Flags del preflight** (sin tocar el entorno): `--api https://<api>`, `--platform G…` (evita depender del secreto), `--sme G…` y `--investor G…` (repetible).
2. **Variables de shell**: exportarlas antes de correr; el shell pisa al archivo, como en `node --env-file`.
3. **Paneles**: leer los valores de los servicios en Railway/Vercel cuando haga falta reproducir el entorno hosteado de verdad.

Con los tres grupos presentes el preflight debería quedar todo en verde; con sólo el perfil local, cada rojo se lee por lo que es (un faltante hosteado) y no como una caída del servicio.

Chequea, cada uno con ✔/✖ y un motivo corto:

1. Nombres de variables requeridas (API y web).
2. `GET /health` de la API (`NEXT_PUBLIC_API_BASE_URL` o `--api`).
3. Horizon accesible y con la passphrase de Testnet.
4. Soroban RPC sano (`getHealth`) y con la passphrase de Testnet (`getNetwork`).
5. La instancia del contrato de la fábrica existe (`getLedgerEntries`).
6. Cuenta de plataforma (clave pública derivada localmente de `STELLAR_PLATFORM_SECRET_KEY`, o `--platform G…`), cuenta de la PyME y cuentas de inversores: existen en Horizon y superan el piso de XLM.
7. El esquema remoto tiene las tablas del recorrido (`application_review`, `sme_request`, `application_assessment`, `human_decision`, `campaign`, `campaign_contribution`, `revenue_share_distribution`) y que `revenue_share_distribution` expone `campaign_id` y `period`.

> [!tip] Cuándo correrlo
> Una vez al preparar el ensayo y otra vez justo antes de la corrida cronometrada, con la API ya caliente (ver §4).

## 4. Ajustes recomendados para la corrida cronometrada

- **Meta chica, cubierta por una sola contribución.** Con una meta de unos pocos XLM (recomendado: 10 XLM) y un único aporte del inversor por ese monto, la bóveda liquida en el acto y el recorrido no espera segundas contribuciones.
- **Calentar la API antes de empezar.** El feed de ventas es **en memoria**: el primer pedido tras un reinicio paga el arranque. Hacer un `GET /health` y un `GET /businesses/panaderia-horizonte/sales-periods` antes de cronometrar.
- **Período de la distribución.** Se usa el **último mes informado**, `2026-08`, salvo que antes se registre `2026-09` con `POST /businesses/panaderia-horizonte/sales-periods`. Hay una única distribución no fallida por campaña y período (`already_distributed`), y cada ensayo usa una campaña nueva.
- **Un solo navegador con Freighter en Testnet**, con la wallet de la PyME y la del inversor ya importadas, para no perder tiempo cambiando de cuenta.

> [!warning] La evaluación de IA es lenta y una falla quema la solicitud
> En el servicio hosteado, la evaluación de IA tarda del orden de **uno a dos minutos** y puede superar el timeout configurado. `LLM_TIMEOUT_MS=120000` está fijado en ese servicio —el máximo que permite el código (`apps/api/src/application/config/llm-config.ts`: default 30 s, mínimo 1 s, máximo 120 s)—, así que no se puede subir más. **Una evaluación fallida quema la solicitud**: el fallo queda registrado de forma durable como un handoff sanitizado y, por diseño, un nuevo `handoffId` contra ese registro devuelve `409 correlation_conflict`. Ante una evaluación fallida, hay que empezar una solicitud nueva: no reintentar la misma. El detalle medido está en [[docs/planning/complete-vertical-demo-journey-evidence|la evidencia del recorrido vertical]], §7 límite 3.

## 5. Firmas de Freighter en la corrida

1. **PyME**: conecta Freighter al abrir la bóveda (aporta su clave pública). **No firma**: la plataforma abre la bóveda con su propia clave.
2. **Inversor**: firma la **contribución** a la bóveda.
3. **PyME**: firma la **distribución** de ingresos (la cuenta origen debe ser la de la PyME de la campaña; otra cuenta se rechaza con `source_not_sme`).
4. Opcionales fuera del camino cronometrado: el inversor firma un retiro (`withdraw`) o un reembolso (`refund`).

## 6. Riesgo retirado: clave de plataforma ↔ `owner` de la fábrica

> [!info] Probado en vivo el 2026-09-25
> Que `STELLAR_PLATFORM_SECRET_KEY` corresponda al `owner` de la fábrica **sí se demostró**: ese día se ejercitó `POST /campaigns` contra el despliegue hosteado y respondió `201`. Un `factory.deploy()` exitoso sólo es posible si la clave de plataforma es el `owner` almacenado de la fábrica: el contrato exige su firma y el `owner` es inmutable.

| Dato | Valor observado |
|---|---|
| Petición | `POST /campaigns` → `201` |
| Bóveda desplegada | `CBANYZNPLW243WBRPJTD5VBBZVKWI6FPIKBAKTMTNZLWTK7SU6ZOWZW6` |
| Transacción | `845f9040ebbab23225f433f3057e5cc17ec53cf45ae1a5dad4080b1d460672d5` |
| Ledger | 4864817, `successful: true` |

Se verificó en **tres capas independientes**:

1. **Cadena**: `InvokeContract` exitoso en el ledger 4864817.
2. **API (lectura fresca de la cadena)**: `GET /campaigns/:id` devolvió `state: "funding"`.
3. **Espejo**: la fila de `public.campaign` con `reconciliation_status: 'in_sync'`.

Fuentes: [[docs/planning/cloud-environment-configuration-evidence|Evidencia de la configuración del entorno en la nube]] (límite 2 y la fila del issue #287), [[odd/tasks/hosted-vault-configuration-closure|Cierre de la configuración del vault hosteado]] (T5) y [[docs/planning/campaign-vault-web-journey-evidence|Evidencia del recorrido web]] (§4.1, re-ejecutado en T6).

El preflight **no** prueba esta correspondencia en cada corrida: comprueba que la fábrica existe y que la cuenta de plataforma está fondeada, no que esa cuenta sea su `owner`. Esa comprobación ya **no** es una incógnita pendiente, sino un hecho registrado.

> [!warning] Lo que sí sigue abierto
> - El **reset de Testnet del 2026-12-16** invalida las direcciones de contrato y obliga a redesplegar y reapuntar: ver [§7](#7-límites-conocidos).
> - El **recorrido de punta a punta por navegador contra producción** sigue sin correrse; la configuración se verificó por partes (bundle, `/health`, CORS) y la evidencia lo declara como límite.

## 7. Límites conocidos

> [!warning] Reset de Testnet el 2026-12-16
> Las direcciones de contrato de Testnet valen hasta el reset agendado del **2026-12-16**; después hay que redesplegar la fábrica y reapuntar `STELLAR_CAMPAIGN_FACTORY_ID`. Ver `contracts/README.md` (el procedimiento de redespliegue todavía no se ejercitó).

- **Fila espejo de contribución obsoleta tras un retiro total (`contributions_incomplete`).** La reconciliación de contribuciones no puede borrar ni poner en cero una fila de `campaign_contribution`. Si un inversor **retira todo** y la campaña después liquida, su fila espejo positiva queda obsoleta y la derivación de la distribución se rechaza como `contributions_incomplete`. Solo lo alcanza un ensayo del tipo "retirar todo y luego liquidar"; el recorrido cronometrado recomendado (una contribución que alcanza la meta) no lo toca. Límite conocido, sin cambio de código.
- **Sin restablecimiento de base entre ensayos** (§1): las filas de ensayos previos permanecen; cada ensayo usa identificadores nuevos.
- **Las rutas de distribución sólo se sirven con la bóveda habilitada**: sin `STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY`, la web muestra el mensaje genérico de "no disponible".
- **El feed de ventas es en memoria**: un reinicio de la API pierde los períodos registrados por `POST …/sales-periods`; hay que volver a registrarlos.
- **La suite `e2e-live` no forma parte de la corrida**: necesita Testnet y credenciales del operador y corre solo contra el stack local.
