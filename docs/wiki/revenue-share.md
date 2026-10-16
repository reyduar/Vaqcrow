---
title: Revenue share
type: concepto
sources:
  - como-funciona-vaqcrow.md
  - blog/revenue-share-explicado.md
updated: 2026-10-16
---

# Revenue share

El **revenue share** es la forma en que la PyME devuelve **parte** de lo que recibió: con un **porcentaje de sus ventas mensuales**.

No entrega acciones. No se ata a una cuota fija. Si la PyME vende menos, devuelve menos.

## La idea, con un ejemplo de todos los días

Imaginá el kiosco de la esquina. Vende bien, pero necesita dinero para comprar más mercadería. Vos le prestás una parte.

Cuando el kiosco vende, cada mes te devuelve un porcentaje de lo que vendió ese mes.

Si un mes vendió poco, te devuelve poco. Si vendió mucho, te devuelve más.

Cada mes vuelve una parte, según lo que vendió ese mes. El kiosco no te entrega un pedazo del negocio, y tampoco se ata a un pago igual todos los meses.

Eso, con una PyME argentina y una bóveda en Stellar, es lo que hace Vaqcrow.

## Las palabras, una por una

- **PyME**: la empresa chica o mediana que pide el capital.
- **Inversor**: la persona que aporta dinero a la campaña.
- **Campaña**: la ronda de financiamiento de una PyME, con una meta.
- **Aporte**: el dinero que pone cada inversor.
- **Capital**: el dinero que la PyME recibe para su negocio.
- **Ventas del mes**: lo que la PyME vendió en ese mes, declarado por ella.
- **Revenue share**: el porcentaje de esas ventas que vuelve a los inversores.

## Cómo se calcula

- La regla está versionada. En la demo se usa `RS-2026-01`.
- Ese período aplica un **4,5 %** sobre las ventas declaradas del mes.
- El reparto es **proporcional a lo que aportó cada inversor**.
- El cálculo es determinístico y lo hace el sistema. La IA no participa del reparto.

## El mes, paso a paso

1. La PyME declara cuánto vendió ese mes.
2. El sistema aplica la regla sobre esas ventas y calcula cuánto se reparte.
3. El reparto se divide entre los inversores de forma proporcional: si dos personas aportaron lo mismo, a cada una le toca la misma parte.
4. La PyME **firma la transacción en Freighter**.

Vaqcrow arma la transacción y la verifica. Pero no la firma ni mueve los fondos.

En la demo, las ventas que se declaran son sintéticas.

## Si la PyME vende menos

Como el reparto sale de las ventas, cuando las ventas bajan el reparto también baja.

Si la PyME vendió la mitad, se reparte la mitad. **No hay una cuota fija que haya que pagar igual.**

## Qué vuelve, y qué no está fijado

Lo que vuelve es siempre un porcentaje de las ventas del mes, repartido entre los inversores según lo que aportó cada uno.

La regla **no fija un total a devolver ni una fecha en la que el reparto termina**, y no acumula un contador de cuánto se devolvió hasta ahora. Por eso lo que un inversor recibe a lo largo del tiempo depende de dos cosas —cuánto venda la PyME y qué proporción del total aportado le toca—, no de un monto pactado de antemano.

## Por qué existe

El *crowdfunding* pide una recompensa simbólica. El *crowdequity* entrega acciones y con ellas parte del gobierno de la empresa. El *crowdlending* cobra una cuota que se paga igual aunque las ventas caigan.

El revenue share es un camino distinto: vincula lo que devuelve la PyME con lo que realmente vende.
