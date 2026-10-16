---
title: El revenue share de Vaqcrow, explicado en simple
tags:
  - blog
  - revenue-share
  - como-funciona
  - testnet
  - demo
---

# El revenue share de Vaqcrow, explicado en simple

En Vaqcrow, un inversor aporta dinero a la campaña de una PyME. Más adelante, la PyME devuelve **parte** de ese capital con un pedacito de lo que vende cada mes. Eso es el **revenue share**: lo que vuelve está atado a las ventas, no a cuotas fijas.

> Es una demo. Las ventas de la serie son **sintéticas**, los montos corren en **Stellar Testnet** sin valor económico y la conversión entre pesos y activo es **simulada**.

## La idea, con un ejemplo de todos los días

Imaginá el kiosco de la esquina. Vende bien, pero necesita plata para comprar más mercadería. Vos le prestás una parte.

Cuando el kiosco empieza a vender, cada mes te devuelve un porcentaje de lo que vendió ese mes.

Si un mes vendió poco, te devuelve poco. Si vendió mucho, te devuelve más. El kiosco no te entrega un pedazo del negocio, y tampoco se ata a un pago igual todos los meses.

Eso, con una PyME argentina y una bóveda en Stellar, es lo que hace Vaqcrow.

## Qué no es el revenue share

- **No son acciones.** La PyME no cede una parte de su empresa, y vos no pasás a decidir en ella.
- **No es una cuota fija.** No hay un monto que la PyME tenga que pagar igual, aunque venda menos.
- **No es una recompensa simbólica.** No te devuelven un producto ni un agradecimiento: vuelve dinero, en proporción a lo que aportaste.

## Las otras formas de financiar, y por qué elegimos esta

Antes de Vaqcrow, el financiamiento colectivo ya tenía tres caminos. Cada uno devuelve algo distinto a quien aporta:

- **Crowdfunding**: quien aporta recibe una **recompensa simbólica** —un producto o un agradecimiento—, no la devolución del capital.
- **Crowdequity**: quien aporta recibe **acciones**, es decir una parte de la empresa y de su gobierno.
- **Crowdlending**: es un préstamo, con una **cuota que se paga igual todos los meses**, incluso si las ventas caen.
- **Revenue share (Vaqcrow)**: vuelve un porcentaje de las ventas, todos los meses. Si se vende menos, vuelve menos. Ni acciones ni cuota fija.

## Cómo se reparte

Cada mes, la PyME declara cuánto vendió. Sobre esas ventas, el sistema aplica una regla y reparte el resultado entre los inversores.

En la demo, la regla se llama **RS-2026-01** y aplica un **4,5 %** sobre las ventas declaradas del mes.

El reparto es **proporcional a lo que aportó cada uno**. Si dos personas pusieron la mitad cada una, a cada una le toca la mitad de lo que se reparte.

| Pieza | Valor en la demo |
|---|---|
| Regla | `RS-2026-01` |
| Porcentaje | 4,5 % de las ventas del mes |
| Reparto | Proporcional a cada aporte |
| Quién calcula | El sistema, siempre de la misma forma |
| Quién firma | La PyME, en Freighter |

El cálculo es **determinístico**: con los mismos números da siempre el mismo resultado. **La IA no participa del cálculo.** El reparto sale de la regla, a la vista de todos.

## Quién firma la transacción

Cada mes, la PyME declara sus ventas y **firma la transacción en Freighter**.

Vaqcrow arma esa transacción y la verifica, pero **no la firma ni mueve el dinero**. La clave privada nunca sale de la wallet de la PyME. Por eso Vaqcrow es **no custodial**: nadie del equipo tiene una llave para tocar los fondos.

## Si la PyME vende menos

Como el reparto sale de las ventas, cuando las ventas bajan el reparto también baja.

Si un mes la PyME vendió la mitad, se reparte la mitad. **No hay una cuota fija que haya que pagar igual.**

## Qué vuelve, y qué no está fijado

Lo que vuelve es siempre un porcentaje de las ventas del mes, repartido entre los inversores según lo que aportó cada uno.

La regla **no fija un total a devolver ni una fecha en la que el reparto termina**, y no acumula un contador de cuánto se devolvió hasta ahora. Por eso: si las ventas son bajas, lo que vuelve en el mes también es bajo. Lo que un inversor recibe a lo largo del tiempo depende de dos cosas —cuánto venda la PyME y qué proporción del total aportado le toca—, no de un monto pactado de antemano.

## Qué es real y qué es simulado

| Pieza | Estado en la demo |
|---|---|
| Cuentas, roles y sesiones | Reales |
| Bóveda y transacciones | Reales, sobre **Stellar Testnet** |
| Firma con Freighter | Real; la clave privada nunca sale de la wallet |
| Ventas mensuales declaradas | Sintéticas |
| Conversión entre pesos y activo | Simulada |
| Activos que se mueven | Sin valor económico |

## En resumen

En Vaqcrow el inversor aporta a la campaña de una PyME, y la PyME devuelve parte de ese capital con un 4,5 % de sus ventas mensuales, repartido en proporción a lo que aportó cada uno. La regla está versionada (`RS-2026-01`), el cálculo es determinístico y la IA no participa. La firma la hace siempre la PyME en Freighter: Vaqcrow no firma ni mueve fondos. Si se vende menos, vuelve menos. Nada de esto es una oferta de inversión ni una recomendación financiera.
