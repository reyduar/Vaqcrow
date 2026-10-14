---
title: Vaqcrow: financiar a las PyMEs argentinas con una bóveda en Stellar
tags:
  - blog
  - stellar
  - soroban
  - testnet
  - revenue-share
  - demo
---

# Vaqcrow: financiar a las PyMEs argentinas con una bóveda en Stellar

Vaqcrow conecta a una PyME argentina que necesita capital con inversores que aportan dinero de prueba en **Stellar Testnet**. La PyME devuelve ese capital con un porcentaje de sus ventas mensuales —un *revenue share*—, no con acciones ni con una cuota fija.

> Es una demo. Los activos que se mueven **no tienen valor económico**: corren en Stellar Testnet. El KYC/KYB, el historial de ventas y la conversión entre pesos y activo son simulados. Lo que sí es real es la cuenta, su rol, los documentos subidos a un espacio privado y cada transacción firmada en Testnet.

## El capital que no llega

Una PyME que vende todos los meses puede tener un buen negocio y, aun así, no calificar para un crédito bancario: los requisitos son rígidos, los plazos largos y las tasas altas. El financiamiento colectivo abrió otras puertas, pero cada camino trae su propia letra chica:

- el *crowdfunding* pide una recompensa simbólica a cambio del aporte;
- el *crowdequity* entrega **acciones**, y con ellas una parte del gobierno de la empresa;
- el *crowdlending* presta a empresas ya constituidas, con una cuota que se paga igual aunque las ventas caigan.

Vaqcrow propone un cuarto camino, en parte híbrido: la PyME recibe capital y lo devuelve con un **porcentaje de lo que vende**. Si vende menos, devuelve menos. No entrega acciones ni se ata a una cuota fija.

## La bóveda: un contrato en Stellar

El corazón de una campaña es una **bóveda**: un contrato inteligente en Stellar (Soroban), uno por campaña. Lo despliega la plataforma al aprobar la solicitud, con la cuenta de la PyME como **destino inmutable**. Durante la campaña los aportes quedan custodiados por el contrato: ninguna persona tiene una llave para moverlos, ni la PyME, ni el inversor, ni Vaqcrow.

El contrato aplica por sí solo la regla **todo o nada** (*All-or-Nothing*). Si la campaña reúne su meta, liquida a la PyME en la misma transacción en que se alcanza; si no la reúne, cada contribuyente puede reclamar su aporte. Esa decisión no la toma una persona ni la IA: la ejecuta el contrato.

```sh
# Una bóveda por campaña; el destino de la PyME quedó fijado al desplegarla.
stellar contract invoke \
  --id CDEMOVAULT7Q2B3S4T5NET6TESTNET7ONLY8EXAMPLE9X0Y1Z2A3B4C5D6E7F \
  --network testnet \
  -- goal_reached
```

## Cómo vuelve el capital: el revenue share

Ya con el capital, cada mes la PyME declara sus ventas —en la demo, sintéticas— y el sistema calcula cuánto le toca a cada inversor **en proporción a lo que aportó**. El cálculo es determinístico y sale de una regla versionada; la IA no participa del reparto.

Para el período que la demo usa de ejemplo, **RS-2026-01**, la regla aplica un 4,5 % sobre las ventas declaradas del mes:

| Pieza | Valor en la demo |
|---|---|
| Regla | `RS-2026-01` |
| Porcentaje | 4,5 % de las ventas del mes |
| Reparto | Proporcional a cada aporte |
| Quién calcula | El sistema, de forma determinística |
| Quién firma | La PyME, en Freighter |

La PyME **firma la transacción en Freighter**. Vaqcrow la construye y la verifica, pero nunca firma por ella ni mueve los fondos: por eso el producto es **no custodial** y la clave privada no sale de la wallet.

## Qué es real y qué es simulado

| Pieza | Estado en la demo |
|---|---|
| Cuentas, roles y sesiones | Reales |
| Documentos de la PyME | Subidos de verdad a un espacio privado, separado por dueño |
| Bóveda y transacciones | Reales, sobre **Stellar Testnet** |
| Firma con Freighter | Real; la clave privada nunca sale de la wallet |
| KYC/KYB de la PyME y del inversor | Simulado |
| Ventas mensuales declaradas | Sintéticas |
| Conversión entre pesos y activo | Simulada |
| Evaluación con IA | Organiza evidencia y marca anomalías; **no aprueba, no decide ni mueve fondos** |

## Por qué Stellar

La nota de El Economista sobre EthicHub cuenta un *crowdlending* sobre Ethereum. Vaqcrow parte de esa misma idea —poner la regla del financiamiento dentro de un contrato y dejar la evidencia a la vista— pero elige **Stellar**: comisiones bajas, liquidación rápida y **Soroban**, su plataforma de contratos, donde la regla todo o nada se escribe en el propio contrato y cualquier persona puede inspeccionarla.

## El recorrido, en trece etapas

1. La PyME crea su cuenta y confirma su correo.
2. Registra su negocio y sube tres documentos obligatorios más hasta cuatro fotos.
3. La IA revisa la evidencia y deja su lectura a la vista.
4. La PyME conecta Freighter y entrega su clave pública.
5. Una persona aprueba la solicitud y deja registrada su decisión, con nombre y fecha.
6. La bóveda se despliega en Testnet.
7. La campaña se publica: su detalle es público y compartible por link.
8. El inversor crea su cuenta y conecta su wallet.
9. El inversor aporta y firma en Freighter.
10. El contrato evalúa la meta: todo o nada.
11. Si la meta se alcanza, la PyME cobra el capital.
12. Si no se alcanza, cada aporte se puede reclamar.
13. Con el capital en mano, la PyME declara sus ventas y se reparte el revenue share.

## Una sola fecha

Cada artículo del Blog se publica con una única fecha visible, la de publicación. Esta pieza quedó fechada el **2026-10-14**, el mismo día en que Vaqcrow estrenó su Blog dentro de «Acerca de».

## En resumen

Vaqcrow es una demo sobre Stellar Testnet, sin valor económico, con KYC y conversión de moneda simulados y con una IA que sólo asesora. Su idea es haber puesto la regla del financiamiento —el todo o nada y el reparto del revenue share— dentro de un contrato, y haber dejado la firma en manos de las personas. Nada de esto es una oferta de inversión ni una recomendación financiera.
