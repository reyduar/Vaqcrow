---
title: El ecosistema Stellar de Vaqcrow
type: tecnologia
sources:
  - blog/ecosistema-stellar-de-vaqcrow.md
updated: 2026-10-17
---

# El ecosistema Stellar de Vaqcrow

Qué tecnología de blockchain usa Vaqcrow, quién custodia el dinero y cómo se conectan los contratos, la API y la web.

## Las piezas

| Pieza | Qué hace en Vaqcrow |
|---|---|
| Stellar | La red donde viven las cuentas, los aportes y los pagos. |
| Testnet | La red de prueba de Stellar. Es la única que usa la demo; sus activos no tienen valor económico. |
| XLM | El activo de prueba con el que se aporta y se paga. |
| Soroban | La plataforma de contratos de Stellar: ejecuta la bóveda y la fábrica. |
| Bóveda | Un contrato por campaña. Custodia los aportes y aplica el todo o nada. |
| Fábrica | Un contrato que despliega una bóveda por cada campaña aprobada. |
| Freighter | La wallet donde inversores y PyMEs firman. La clave privada nunca sale de ahí. |
| Horizon y RPC | Las puertas de entrada a la red que usa la API para leer y enviar transacciones. |
| stellar.expert | El explorador público donde se verifica cada transacción. |

## Quién custodia el dinero

- Los aportes quedan **dentro de la bóveda**. Nadie tiene una llave para moverlos: ni la PyME, ni el inversor, ni Vaqcrow.
- El contrato sólo puede pagar a la **cuenta de la PyME**, fijada al desplegarlo, o devolver cada aporte a **su inversor**.
- Vaqcrow es **no custodial**: arma y verifica las transacciones, pero las firma la persona dueña de los fondos en su wallet.

## La red: Testnet

- La configuración de la API rechaza la red principal.
- El XLM de prueba se obtiene con Friendbot.
- Testnet se reinicia cada tanto y borra cuentas y contratos; después, Vaqcrow vuelve a desplegar su fábrica. El próximo reinicio anunciado es el 16 de diciembre de 2026.

## Reglas del aporte

- Nadie puede tener más del **10 % de la meta**; lo controla el contrato, así que una campaña necesita al menos diez inversores.
- No se puede aportar más de lo que falta para la meta; esta regla la aplica Vaqcrow antes de firmar, no el contrato.
- Mientras la campaña sigue abierta, el inversor puede retirar su aporte completo.

## Meta alcanzada o no

- **Meta alcanzada**: el aporte que completa la meta transfiere todo lo reunido a la PyME en la misma transacción. Desde ahí la bóveda rechaza aportes nuevos.
- **Vence sin meta**: cada aporte se puede reembolsar a la cuenta que lo hizo. El reembolso no necesita permiso, no se dispara solo y puede hacerse en tandas de hasta 20 inversores.

## El revenue share

- Empieza después de alcanzada la meta y es **mes a mes**: la PyME declara ventas, Vaqcrow calcula el 4,5 % (regla `RS-2026-02`) en proporción a cada aporte, arma una transacción con un pago por inversor y la PyME la firma en Freighter.
- Cada inversor cobra hasta **1,5 veces lo que aportó**.
- El revenue share **no lo cobra la bóveda**: son pagos comunes de Stellar. La IA no participa del cálculo.

## Para developers

- Los contratos están escritos en **Rust** con `soroban-sdk` 28 y se compilan a WebAssembly (`wasm32v1-none`). Rust sólo vive en `contracts/`.
- **Fábrica**: `deploy(salt, sme, token, goal, deadline)`, autorizada por la plataforma; `predict(salt)` anticipa la dirección.
- **Bóveda**: estados `Funding`, `Settled` y `Refunding`; funciones `contribute` y `withdraw` (autoriza el inversor), `refund` y `sweep` (sin permisos).
- El activo es el contrato (SAC) del XLM nativo.
- Cada bóveda la despliega la API al aprobar una solicitud, con un `salt` derivado del id de la solicitud: reintentar no crea una segunda bóveda. Si la cuenta de la PyME no existe, la plataforma la crea con 2 XLM.
- La API (TypeScript, `@stellar/stellar-sdk`) usa Stellar RPC para los contratos y Horizon para las transacciones clásicas. Devuelve transacciones sin firmar, y la web las firma con `@stellar/freighter-api` tras verificar la red.
- Para seguir aprendiendo: la documentación oficial en developers.stellar.org, la de Freighter en docs.freighter.app y el libro oficial de Rust.
