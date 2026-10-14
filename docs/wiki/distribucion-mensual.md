---
title: Distribución mensual del revenue share
type: flujo
sources:
  - como-funciona-vaqcrow.md
  - freighter-and-testnet-walkthrough.md
  - blog/vaqcrow-sobre-stellar.md
updated: 2026-10-14
---

# Distribución mensual del revenue share

Con el capital ya en manos de la PyME, cada mes se reparte a los inversores una parte de lo que la PyME vende.

## El recorrido del mes

1. La PyME, con la campaña en «Meta alcanzada», abre `/company`.
2. Presiona «Declarar ventas» y carga las ventas de cada mes.
3. Presiona «Revisar y firmar». El servicio calcula de forma determinística la obligación del período, sus destinatarios y montos. **La IA no calcula esta obligación.**
4. Revisa el resumen y firma en Freighter.

## Cómo se calcula

- La regla está versionada: `RS-2026-01`.
- En la demo aplica un **4,5 %** sobre las ventas declaradas del mes.
- El reparto es **proporcional a cada aporte**.
- Si la PyME vende menos, se distribuye menos: no hay una cuota fija que se deba pagar igual.

## Quién firma

La PyME **firma la transacción en Freighter**. Vaqcrow la construye y la verifica, pero no la firma ni mueve los fondos.

## Estados y evidencia

- Las ventas son sintéticas en la demo. Un mes vacío queda «Sin dato», nunca cero.
- El estado avanza de firmada a «Enviada · pendiente de confirmación» y recién después a confirmada.
- «Ver la transacción en el explorador» abre el hash de la distribución.
- «Consultar estado» vuelve a leer el estado.
