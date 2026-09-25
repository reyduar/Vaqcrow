---
title: Evidencia — el recorrido de la bóveda de campaña en la web
tags:
  - evidence
  - campaign-vault
  - stellar
  - testnet
  - web
date: 2026-09-25
status: draft
---

# Evidencia — el recorrido de la bóveda de campaña en la web

> [!info] Qué documenta este documento
> Cómo se verificó el recorrido completo de la bóveda de campaña en la web, sobre el despliegue hosteado y contra **Stellar Testnet**: la apertura de la bóveda, el aporte firmado, los tres estados de la campaña y el camino de reembolso.
>
> Cierra la Task [#249](https://github.com/reyduar/Vaqcrow/issues/249), tercera de la Feature [#237](https://github.com/reyduar/Vaqcrow/issues/237).

## 1. Contexto y objetivo

La Feature [#237](https://github.com/reyduar/Vaqcrow/issues/237) cambia la forma de firmar del recorrido: antes la web firmaba un pago clásico; ahora firma una **invocación de contrato**. Freighter sigue firmando y Vaqcrow sigue sin ver ninguna seed, pero la transacción que la persona revisa es otra y el estado de la campaña viene del contrato y no de las operaciones de Horizon.

Esta Task captura la evidencia reproducible de ese recorrido, con los hashes de Testnet y los límites honestos de la interfaz.

## 2. Cómo leer esta evidencia

Cada resultado declara **su fuente**, que es una de tres:

| Fuente | Qué significa |
|---|---|
| **Comando re-ejecutado** | La orden se corrió en el árbol de trabajo durante esta unidad y se transcribe su salida |
| **Corrida de CI** | El resultado viene de un check de GitHub Actions sobre el PR |
| **Observación en la interfaz** | La persona operadora leyó el estado en pantalla y lo reportó |

El entorno de la corrida es el **despliegue hosteado**: API en Railway (`api-production-c07f.up.railway.app`), web en Vercel (`vaqcrow-web-nine.vercel.app`), base en el proyecto Supabase de demo y **Stellar Testnet**.

> [!warning] Estado de entrega, sin adelantos
> El PR [#293](https://github.com/reyduar/Vaqcrow/pull/293) está **abierto**, no mergeado. Lo que sí está mergeado en `main` es la implementación y sus pruebas (PR [#285](https://github.com/reyduar/Vaqcrow/pull/285), mergeado el 2026-09-24). Este documento no declara mergeado nada que no lo esté.

## 3. Qué quedó implementado en esta unidad

- **El paso de arranque que faltaba.** El recorrido hosteado no podía empezar: nada en el producto crea la fila `application_review` que la aprobación necesita —`ApplicationReviewRepositoryPort.create`/`transition` no tienen ningún consumidor en producción, y `/request` publica contra una ruta que no existe—. El perfil local lo tapaba sembrando la fila con `docker exec` contra el contenedor local; el hosteado no tenía equivalente. `supabase/seed/demo-application.sql` es ese paso, idempotente, y crea la fila en `human_review` para que la decisión humana se tome por la interfaz real en vez de saltearla.
- **La decisión de almacenamiento y rotación del secreto de plataforma**, registrada en `cloud-environment-configuration-evidence.md` §5.1, con el respaldo verificado de que el `owner` de la fábrica es inmutable.
- **Una guía operativa** (`docs/guides/freighter-and-testnet-walkthrough.md`) para que el recorrido lo pueda ejecutar alguien que no lo construyó.
- La implementación del recorrido y sus pruebas vienen de [#247](https://github.com/reyduar/Vaqcrow/issues/247) y [#248](https://github.com/reyduar/Vaqcrow/issues/248), mergeadas en `main` por el PR [#285](https://github.com/reyduar/Vaqcrow/pull/285).

## 4. Qué quedó probado

### 4.1 El recorrido completo sobre el despliegue hosteado

| Paso | Observado | Fuente |
|---|---|---|
| Aprobación humana | `POST /application-reviews/5d1f7c2e-8a4b-4c6d-9e3f-1a2b3c4d5e6f/decisions` → `201`, `applied: true`, decisión `ee723d28-f107-4065-ac49-0cd2bdf33a33` | Comando re-ejecutado |
| Apertura de la bóveda | `POST /campaigns` → `201`. Bóveda `CBANYZNPLW243WBRPJTD5VBBZVKWI6FPIKBAKTMTNZLWTK7SU6ZOWZW6`, campaña `6722f37a-04f3-4491-b94c-da528adf678e` | Comando re-ejecutado |
| Idempotencia de la apertura | Repetir el mismo `POST` devuelve `200` con **la misma** campaña y el mismo contrato; la tabla sigue con una sola fila | Comando re-ejecutado |

Que `POST /campaigns` haya funcionado es, además, la prueba de que **la clave de plataforma es el `owner` de la fábrica**: `deploy` exige `owner.require_auth()` y el `owner` es inmutable, así que ningún otro firmante puede desplegar una bóveda.

### 4.2 El aporte, con su hash verificable

```
089ca47b9150316522a077da489ab8d38ba75a3a0c568752a169eca4c91189da
```

| Campo | Valor |
|---|---|
| Cuenta origen (`source_account`) | `GBCLD6IR3BQUA2LN36VS7VEU7D2NQS6YWYMRBLUX4CWOZE3DFCKV7U23` — la cuenta del inversor en Freighter |
| Ledger | 4869335 |
| Éxito | `true` |
| Comisión | 4.231.501 stroops |

Fuente: comando re-ejecutado contra Horizon. Verificable en el explorador:
<https://stellar.expert/explorer/testnet/tx/089ca47b9150316522a077da489ab8d38ba75a3a0c568752a169eca4c91189da>

La cadena confirmó el aporte: `GET /campaigns/6722f37a-…` devolvió `state: settled` y `totalStroops: 50000000`, iguales a la meta. El espejo quedó con la fila del aporte (`GBCLD6IR… / 50.000.000`).

### 4.3 Los tres estados, en la interfaz

| Estado en pantalla | Estado del contrato | Cómo se llegó | Fuente |
|---|---|---|---|
| **Fondeo abierto** | `funding` | Campaña 2 recién abierta, plazo vigente, meta no alcanzada | Observación en la interfaz |
| **Meta alcanzada** | `settled` | El inversor aportó los 5 XLM de la meta en la campaña 1 | Observación en la interfaz |
| **Reembolso disponible** | `refunding` | Venció el plazo de la campaña 2 sin alcanzar la meta y se disparó el reembolso | Observación en la interfaz |

Las etiquetas se leen de la constante `STATE_LABEL` de `campaign-workspace.tsx`, y el estado que muestran viene de una lectura fresca de la cadena: `GET /campaigns/:id` lee el contrato y sólo después escribe el espejo. Fuente de esa afirmación: comando re-ejecutado y lectura del código.

### 4.4 El reembolso, disparado por alguien distinto del inversor

El reembolso se hizo sobre la campaña 2 —`2d2c6eef-b7af-482d-a2be-0c3b79e0514c`, contrato `CA5MJCJR5OIGH4K76UE7GIOBAN32BLE5EKDSIIWANVBR2TGSURBKZQ6O`—, abierta con una meta de 100 XLM que a propósito **no** se alcanza y un plazo corto.

```
ff5b65b77b85a418c8c3612dd078a00138044130213a532c1d14335feed9d016
```

| Campo | Valor |
|---|---|
| Cuenta origen | `GDPBTSY2TN7B7YDSMHPBZ5OQXHWCS2ZTVQX55KURIP6UNTCYUZ5ZFKMB` — **la cuenta de la PyME**, no la del inversor |
| Ledger | 4870053 |
| Éxito | `true` |
| Comisión | 19.341 stroops |

Fuente: comando re-ejecutado contra Horizon. Verificable en:
<https://stellar.expert/explorer/testnet/tx/ff5b65b77b85a418c8c3612dd078a00138044130213a532c1d14335feed9d016>

**Los fondos llegaron igual a la dirección registrada del inversor.** La prueba es aritmética y no depende de ninguna interfaz:

| Movimiento del inversor | XLM |
|---|---|
| Fondeo inicial (Friendbot) | 10.000,0000000 |
| Aporte a la campaña 1 | −5,0000000 |
| Aportes a la campaña 2 (dos veces 1 XLM) | −2,0000000 |
| Comisiones de sus tres transacciones | −0,8473892 |
| Saldo que debería quedar | 9.992,1526108 |
| **Saldo observado después del reembolso** | **9.994,1526108** |

La diferencia es exactamente **2,0000000 XLM**: lo que volvió. Fuente: comando re-ejecutado contra Horizon, antes y después.

El reembolso lo disparó la PyME y el destino lo fijó el contrato: activar el reembolso de otra cuenta **no puede redirigir sus fondos, sólo dispararlo**.

### 4.5 El ledger rechaza un aporte después de alcanzada la meta

`POST /campaigns/6722f37a-…/invocations` con `operation: contribute` sobre la campaña ya liquidada responde:

```
HTTP 409  {"code":"campaign_not_funding"}
```

Fuente: comando re-ejecutado. La interfaz, además, deja de ofrecer el botón y lo explica en pantalla: *"La bóveda ya no acepta aportes: el contrato rechaza cualquier aporte fuera del estado de fondeo."*

### 4.6 El chequeo de límites del frontend

| Chequeo | Resultado | Fuente |
|---|---|---|
| Imports de `@stellar/stellar-sdk` en `apps/web/src` | **0 ocurrencias** | Comando re-ejecutado |
| Imports de `packages/domain` / `@vaqcrow/domain` en `apps/web/src` | **0 ocurrencias** | Comando re-ejecutado |
| Lo que la web sí usa para firmar | `@stellar/freighter-api`, en `infrastructure/wallet/freighter-wallet.ts` | Lectura del código |
| `pnpm run boundaries` | `✔ no dependency violations found (360 modules, 1073 dependencies cruised)` | Comando re-ejecutado |
| Quality gates de CI (lint, types, tests, build, boundaries) | `success` | Corrida de CI |

### 4.7 El recorrido determinístico contra la red local

El check **`Playwright (deterministic, local double)`** del PR #293 pasó en verde: `success`. Fuente: corrida de CI, <https://github.com/reyduar/Vaqcrow/actions/runs/36150098818>.

El detalle de esa suite —9 pruebas nuevas sobre el recorrido de la bóveda, más las preexistentes, sin acceso a Testnet— está en el PR [#285](https://github.com/reyduar/Vaqcrow/pull/285), ya mergeado.

## 5. Límites operativos vigentes

1. **El reembolso por vencimiento necesita que alguien envíe una transacción.** Es **sin permisos** —lo puede disparar cualquier persona, y este documento lo prueba con la PyME disparando el del inversor— pero **no se dispara solo**. El contrato habilita el derecho al vencer el plazo; alguien tiene que mandar la transacción.
2. **La meta la impone el contrato, no la interfaz.** Alcanzarla liquida y transfiere a la PyME **en la misma transacción** que cruza el objetivo (`contribute` escribe `State::Settled` y hace el `transfer` al `sme`). La interfaz sólo deja de ofrecer lo que el contrato ya rechazaría; el rechazo observado fue `409 campaign_not_funding`.
3. **La interfaz no muestra el hash del aporte.** La pantalla enlaza **el contrato**, no la transacción. Los hashes de este documento se obtuvieron de Horizon y del explorador, no de la interfaz. Es el hueco más visible para una demo en vivo.
4. **Un destino de reembolso equivocado devuelve un `503` genérico.** Pedir el reembolso de una cuenta que no aportó responde `503 {"code":"unavailable"}`, y el mensaje invita a "reintentar", que fallará igual. Es un dato de entrada, no una caída del servicio. Misma familia que el id de campaña malformado que devuelve `503` en vez de `400`.
5. **El espejo conserva una fila de aporte positiva después de que el dinero se fue.** El `refund` del contrato no baja `Total` —sólo lo hace `withdraw`— mientras que la contribución del inversor sí queda en cero, así que la reconciliación marca `diverged` y el total del espejo sigue diciendo 2 XLM. Es el seguimiento ya registrado en [#285](https://github.com/reyduar/Vaqcrow/pull/285) ("después de un retiro total la cadena lee 0 pero el espejo conserva la última fila positiva"), ahora confirmado también en el camino de reembolso.
6. **La suite de la web es intermitente bajo carga en esta máquina.** La corrida completa falló 2 y luego 4 pruebas en dos intentos consecutivos, con conjuntos de fallas distintos; esos mismos archivos, corridos solos, pasan **25/25**. No hay cambios de código fuente en esta rama, así que la intermitencia es preexistente y ambiental. Los quality gates de CI pasaron en verde.
7. **Los pasos 5 y 6 del recorrido son placeholders** (`/distribution` y `/evidence`, Features #28 y #29, ambas en 0/3).
8. **Identidad, KYC/KYB, ventas y conversión ARS/activo son simulados**, y así está declarado en pantalla. Los activos son de Testnet y no tienen valor económico.
9. **Una bóveda por solicitud.** La campaña queda ligada 1:1 a la solicitud que la originó.

## 6. Mapeo de criterios de aceptación

Criterios textuales de la Feature [#237](https://github.com/reyduar/Vaqcrow/issues/237).

| Criterio (textual) | ¿Se cumple? | Verificación |
|---|---|---|
| An investor contributes by signing with Freighter and the contribution is visible on the chain | **Sí** | Aporte `089ca47b…`, `source_account` = la cuenta del inversor en Freighter, ledger 4869335, `successful: true`; la cadena devolvió `totalStroops: 50000000`. Comando re-ejecutado (§4.2) |
| The UI reflects `Funding`, `Settled` and `Refunding` from the contract, not from local state | **Sí** | Los tres estados observados en pantalla —**Fondeo abierto**, **Meta alcanzada**, **Reembolso disponible**— y el estado proviene de una lectura fresca de la cadena en cada `GET /campaigns/:id` (§4.3) |
| The goal being reached closes contributions in the UI and the ledger rejects any that slip through | **Sí** | La interfaz deja de ofrecer el aporte y lo explica; y un `contribute` posterior responde `409 campaign_not_funding`. En el contrato, alcanzar la meta escribe `State::Settled` y paga a la PyME en la misma transacción (§4.5) |
| A refund can be triggered by someone other than the investor and still reaches the registered address | **Sí** | Reembolso `ff5b65b7…` con `source_account` = **la PyME**; el saldo del inversor subió exactamente 2,0000000 XLM (§4.4) |
| The SME's account is verified before the vault opens | **Sí** | `ensureSmeAccount` corre en el camino de despliegue, antes de `deploy`, y la cuenta se crea y fondea sólo si no existe. Observado: la cuenta de la PyME ya existía, así que **no** se envió `CreateAccount` y su saldo quedó en 10.000 XLM. El caso bloqueado tiene su propio error, `sme_account_unavailable` (422) |
| The whole journey runs deterministically against the local network | **Sí** | Check `Playwright (deterministic, local double)` en verde en el PR #293. Corrida de CI (§4.7) |

## 7. Estado de entrega

- El recorrido de la bóveda se ejecutó **de punta a punta sobre el despliegue hosteado contra Testnet**: aprobación, apertura, aporte firmado, liquidación, vencimiento y reembolso disparado por un tercero.
- Los **seis criterios** de #237 quedan verificados, cada uno con su fuente declarada.
- El **chequeo de límites** del frontend queda registrado como requisito del issue: la web no importa `@stellar/stellar-sdk` ni `packages/domain`, y `pnpm run boundaries` no reporta violaciones.
- **No se declara mergeado** lo que no lo está: el PR [#293](https://github.com/reyduar/Vaqcrow/pull/293) está abierto. #249 se cierra cuando ese PR entre, no antes.
- **No se tocó** `docs/planning/demo-tasks-list.md` en esta unidad de trabajo.
- Seguimientos que este documento deja anotados y que no son parte de su alcance: mostrar el hash del aporte en la interfaz, distinguir el destino de reembolso inválido de una caída del servicio, y la fila de aporte que el espejo conserva tras el reembolso.
