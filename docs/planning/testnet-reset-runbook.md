---
title: Reset de Testnet — runbook
tags:
  - planning
  - demo
  - runbook
  - stellar
date: 2026-10-12
status: draft
---

# Reset de Testnet del 2026-12-16 — runbook

> [!info] Objetivo
> Dejar escrito, y ejecutable sin re-derivar nada, el procedimiento para volver a dejar la demo funcionando después del **reset de Stellar Testnet del 2026-12-16**. El reset borra cuentas, trustlines y **datos de contratos**, así que la fábrica y las bóvedas dejan de existir y `STELLAR_CAMPAIGN_FACTORY_ID` queda apuntando a la nada. **No se puede ejecutar antes de esa fecha**: esto es el plan, no una tarea de hoy.

> [!warning] Alcance: Testnet, simulación
> La verificación de identidad (KYC/KYB), el historial de ventas y la conversión ARS ↔ activo son **simulados**. Stellar corre en **Testnet** y el XLM no tiene valor económico. Nada de esto describe un producto en producción.

## 1. Qué invalida el reset

| Qué | Estado hoy | Después del reset |
|---|---|---|
| Fábrica de campañas | `CCDNM6W4UHEYL27Y2YLDVINPV2DKXBE5FVZD6HSEFK2K7LF5V6WMSV7J` (desde 2026-10-10) | **Borrada**; hay que redesplegar y obtener una dirección nueva |
| Bóvedas abiertas en ensayos | Contratos desplegados en Testnet | **Borradas** (los datos de contrato se pierden) |
| Cuenta de plataforma (`vaqcrow-testnet`) | `GBCOTYYE3KGV745LQ4MELTP4IK2Z2RX2OESRNWP2LY6XLEI73X3PX2ZG`, con XLM de prueba | Cuenta y saldo borrados; hay que recrearla y fondearla |
| Cuentas de prueba (PyME / inversores, Freighter) | Cuentas de Testnet existentes | Borradas; cada una hay que recrearla/refondear |
| `STELLAR_CAMPAIGN_FACTORY_ID` | Apunta a la fábrica actual | Queda inválido → la API creería abrir bóvedas contra una dirección inexistente |

Fuentes: [`docs/architecture/cloud-demo-architecture.md`](../architecture/cloud-demo-architecture.md) §5 y §8, [`docs/planning/stellar-blockchain-requirements.md`](./stellar-blockchain-requirements.md) (reset: 2–4 veces por año, avisado con ≥2 semanas).

## 2. Herramientas y datos de entrada

- **Toolchain:** Rust (`rustc` 1.98.1) + target `wasm32v1-none` + **Stellar CLI** 28 (ver [`soroban-toolchain-and-reproducible-deployment-evidence.md`](./soroban-toolchain-and-reproducible-deployment-evidence.md)).
- **Contratos:** `contracts/campaign-factory` (la fábrica) y `contracts/campaign-vault` (la bóveda con tope `goal/10`).
- **Identidad de plataforma:** `vaqcrow-testnet`, cuya clave secreta es `STELLAR_PLATFORM_SECRET_KEY` (nunca en el repo; se lee de `.env.cloud`/`.env.docker` o de Railway).
- **Gap a resolver antes de ejecutar:** hoy el único camino de deploy automatizado es **local** (`contracts/scripts/bootstrap-local-campaign.sh`, que levanta el quickstart, despliega el wasm y la fábrica, y escribe `contracts/.local-deployment.json`). **No existe un script equivalente para Testnet.** La primera unidad de trabajo de este runbook es crear (o documentar) ese camino para Testnet.

## 3. Runbook (pasos, cada uno con su verificación)

### P0 — Antes de la fecha (preparación)

- [ ] Crear/reusar un camino de deploy a **Testnet** (script o comandos `stellar contract deploy --network testnet` documentados), análogo a `bootstrap-local-campaign.sh`.
- [ ] **Ensayo local** del procedimiento contra el quickstart (`stellar/quickstart:testing`, que emula los límites de Testnet). Nota honesta: en la máquina de desarrollo actual el **build de Docker local está degradado** (no completa), así que el ensayo puede no ser posible acá; resolverlo antes de comprometerse al ensayo.
- [ ] Confirmar que `contracts/.local-deployment.json` está en `.gitignore` y que **ningún** paso escribe la clave secreta.

### P1 — Verificar el estado post-reset

- [ ] Confirmar que la fábrica y la cuenta de plataforma **ya no existen** (consulta a Soroban RPC / Horizon). No asumir: el reset puede demorar.

### P2 — Recrear y fondear la cuenta de plataforma

- [ ] Crear/fondear la identidad `vaqcrow-testnet` con Friendbot; verificar el saldo nativo (≥ el piso del runbook de preflight: 10 XLM).

### P3 — Desplegar la fábrica a Testnet

- [ ] `stellar contract build` del workspace de `contracts/` (obtener el hash del wasm de la bóveda).
- [ ] Desplegar la **fábrica** a Testnet con ese hash de bóveda; anotar la **dirección nueva**.

### P4 — Verificar la fábrica

- [ ] Verificar que el `owner` de la fábrica es la cuenta de plataforma (una `factory.deploy()` exitosa sólo es posible si la clave de plataforma es el `owner`, que es inmutable).
- [ ] Probar un `factory.deploy()` de humo.

### P5 — Reapuntar la configuración

- [ ] `STELLAR_CAMPAIGN_FACTORY_ID` = dirección nueva, en **Railway** (`vaqcrow-api` / `production` / servicio `api`) y en `.env.cloud`.
- [ ] `STELLAR_PLATFORM_SECRET_KEY` actualizado si la identidad cambió (nunca commitear el valor).
- [ ] Recordar la regla **juntas-o-ninguna**: con las dos claves ausentes la bóveda queda deshabilitada; con **una sola**, la API **no arranca**.

### P6 — Redeploy y smoke test

- [ ] Redeploy de la API en Railway; confirmar `/health` 200 y arranque sin error de configuración.
- [ ] Smoke test end-to-end: `POST /campaigns` → `201` + bóveda nueva; un aporte firmado con Freighter; y, si aplica, una distribución.

### P7 — Actualizar la evidencia

- [ ] Registrar las **direcciones nuevas** (fábrica, bóveda de humo) en `docs/architecture/cloud-demo-architecture.md` (§5/§8) y `docs/architecture/deploy-planning.md`.
- [ ] Actualizar `STELLAR_PLATFORM_SECRET_KEY`/identidad si cambió, en la doc de entornos.

## 4. Evidencia a registrar el día del reset

- Dirección nueva de la fábrica + hash del wasm de bóveda.
- Transacción de deploy de la fábrica (hash + ledger).
- Resultado del smoke `POST /campaigns` (hash de la tx + dirección de la bóveda).
- Confirmación de `/health` y del arranque sin error de configuración.
- Fecha y hora de ejecución, y qué ensayos previos quedaron invalidados.

## 5. Riesgos y trampas

- **Cuentas de prueba borradas.** El reset no perdona sólo contratos: hay que recrear y fondear la cuenta de plataforma **y** las cuentas de prueba (Freighter de PyME/inversores). Sin eso, un ensayo no puede firmar.
- **Par estricto de claves.** Ver P5: configurar sólo una de las dos claves tumba el proceso.
- **No hay script de Testnet.** Ver P0: es el primer entregable del runbook; sin eso, el día del reset se improvisa.
- **El smoke de la fábrica nueva sigue pendiente** desde 2026-10-10 (ver `application-review-and-vault-deployment-evidence.md` §10.7); conviene cerrarlo antes del reset para no confundir dos fallas distintas.
