---
title: Freighter y las firmas
type: tecnologia
sources:
  - freighter-and-testnet-walkthrough.md
  - como-funciona-vaqcrow.md
updated: 2026-10-14
---

# Freighter y las firmas

Freighter es la **billetera y la interfaz de firma** que usan la PyME y el inversor. Vaqcrow guarda únicamente la clave **pública** y nunca pide, recibe ni guarda la frase de recuperación ni la clave secreta. La clave privada nunca sale de la wallet.

Freighter **no es un custodio**: vos conservás tus claves. Vaqcrow arma y verifica la transacción; vos la revisás y la firmás dentro de Freighter.

## Quién firma qué

| Rol | Qué firma en Freighter |
|---|---|
| PyME | Un **mensaje** para verificar que la wallet es suya (no es una transacción) y, más adelante, **la distribución** a los inversores |
| Inversor | Un **mensaje** para verificar su wallet, su **aporte** y, si corresponde, su **retiro** o **reembolso** |
| ADMIN | **Nada.** Aprueba en la consola; el despliegue de la bóveda lo firma la plataforma |

## La red

La demo corre en **Stellar Testnet**. Antes de firmar, la red de Freighter tiene que decir Testnet. El código verifica la passphrase antes de pedir la firma: si Freighter está en otra red, la demo rechaza la firma.

## Antes de aceptar

Mirá en el popup **desde qué cuenta** vas a firmar y que la red, el contrato, los destinatarios y el monto coincidan con lo que esperás.
