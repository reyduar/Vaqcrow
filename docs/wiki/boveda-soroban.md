---
title: La bóveda en Soroban
type: tecnologia
sources:
  - como-funciona-vaqcrow.md
  - blog/vaqcrow-sobre-stellar.md
updated: 2026-10-14
---

# La bóveda en Soroban

El corazón de una campaña es una **bóveda**: un contrato inteligente en Stellar (Soroban), uno por campaña.

## Qué garantiza

- La bóveda tiene como **destino inmutable** la cuenta de la PyME.
- El contrato es el **único** que puede mover los aportes, y solo puede pagarlos al destino fijo definido al abrirlo.
- Durante la campaña, **nadie tiene una clave para moverlos**: ni la PyME, ni el inversor, ni Vaqcrow.
- La regla **todo o nada** la ejecuta el contrato, no una persona.

## Cómo se despliega

- Al aprobar la solicitud, la plataforma despliega la bóveda en Testnet. La PyME no firma nada en este paso.
- Si la cuenta de la PyME todavía no existe en el ledger, Vaqcrow **la crea y la fondea con 2 XLM**. Ese monto no es dinero de la campaña: es solo el costo de alta de la cuenta.
- La campaña queda ligada a la solicitud que la originó: una bóveda por solicitud.

## Por qué Stellar

Vaqcrow elige Stellar por sus comisiones bajas y su liquidación rápida, y usa Soroban para escribir la regla dentro del propio contrato, a la vista de cualquiera.
