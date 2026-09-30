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

### 2.2 Perfil de entorno

El perfil que corre la demo real es `.env.cloud` (API en Railway, web en Vercel; ver [[docs/architecture/environments|Environments]] y [[docs/architecture/cloud-demo-architecture|Cloud Demo Architecture]]). Nombres que el preflight exige:

- **API**: `APP_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_API_KEY`, `STELLAR_NETWORK`, `STELLAR_HORIZON_URL`, `STELLAR_RPC_URL`, `STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY` (estas dos **como par**: sin ambas no se registran las rutas de campaña), `CORS_ALLOWED_ORIGINS` (debe incluir el origen de Vercel).
- **Web**: `NEXT_PUBLIC_API_BASE_URL`.
- **Cuentas del ensayo** (opcionales, alternativa a los flags): `DEMO_SME_PUBLIC_KEY` y `DEMO_INVESTOR_PUBLIC_KEYS` (claves públicas separadas por coma). Son solo direcciones públicas.

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

## 5. Firmas de Freighter en la corrida

1. **PyME**: conecta Freighter al abrir la bóveda (aporta su clave pública). **No firma**: la plataforma abre la bóveda con su propia clave.
2. **Inversor**: firma la **contribución** a la bóveda.
3. **PyME**: firma la **distribución** de ingresos (la cuenta origen debe ser la de la PyME de la campaña; otra cuenta se rechaza con `source_not_sme`).
4. Opcionales fuera del camino cronometrado: el inversor firma un retiro (`withdraw`) o un reembolso (`refund`).

## 6. Riesgo abierto: clave de plataforma ↔ `owner` de la fábrica

> [!warning] Todavía no probado en vivo
> Que `STELLAR_PLATFORM_SECRET_KEY` corresponda al `owner` de la fábrica **no se ha demostrado**: nunca se ejercitó `POST /campaigns` contra el despliegue hosteado (ver [[docs/architecture/cloud-demo-architecture|Cloud Demo Architecture]] §5). El preflight comprueba que la fábrica existe y que la cuenta de plataforma está fondeada, **no** que sea su `owner`. La primera apertura real de una campaña es la prueba; conviene hacerla en un ensayo previo, nunca por primera vez en la corrida cronometrada.

## 7. Límites conocidos

> [!warning] Reset de Testnet el 2026-12-16
> Las direcciones de contrato de Testnet valen hasta el reset agendado del **2026-12-16**; después hay que redesplegar la fábrica y reapuntar `STELLAR_CAMPAIGN_FACTORY_ID`. Ver `contracts/README.md` (el procedimiento de redespliegue todavía no se ejercitó).

- **Fila espejo de contribución obsoleta tras un retiro total (`contributions_incomplete`).** La reconciliación de contribuciones no puede borrar ni poner en cero una fila de `campaign_contribution`. Si un inversor **retira todo** y la campaña después liquida, su fila espejo positiva queda obsoleta y la derivación de la distribución se rechaza como `contributions_incomplete`. Solo lo alcanza un ensayo del tipo "retirar todo y luego liquidar"; el recorrido cronometrado recomendado (una contribución que alcanza la meta) no lo toca. Límite conocido, sin cambio de código.
- **Sin restablecimiento de base entre ensayos** (§1): las filas de ensayos previos permanecen; cada ensayo usa identificadores nuevos.
- **Las rutas de distribución sólo se sirven con la bóveda habilitada**: sin `STELLAR_CAMPAIGN_FACTORY_ID` y `STELLAR_PLATFORM_SECRET_KEY`, la web muestra el mensaje genérico de "no disponible".
- **El feed de ventas es en memoria**: un reinicio de la API pierde los períodos registrados por `POST …/sales-periods`; hay que volver a registrarlos.
- **La suite `e2e-live` no forma parte de la corrida**: necesita Testnet y credenciales del operador y corre solo contra el stack local.
