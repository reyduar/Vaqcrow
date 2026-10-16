---
title: Freighter y Friendbot, paso a paso: tu wallet de Testnet en Chrome
tags:
  - blog
  - freighter
  - friendbot
  - testnet
  - guia
  - demo
---

# Freighter y Friendbot, paso a paso: tu wallet de Testnet en Chrome

Para aportar a una campaña o para recibir el capital de tu PyME en Vaqcrow necesitás una **wallet de Stellar**. La demo usa **Freighter**, una extensión del navegador. Esta guía recorre los cuatro pasos: agregar Freighter a Chrome, crear tu cuenta, pasarla a **Testnet** y cargarle XLM de prueba con **Friendbot**.

> Es una demo. Todo corre en **Stellar Testnet**: los XLM de prueba **no tienen valor económico** y no se pueden cambiar por dinero. Vaqcrow es **no custodio**: nunca tiene tus claves ni recibe o mueve tu dinero.

## Antes de empezar: la regla que no se negocia

Vaqcrow solo usa tu **dirección pública**, la que empieza con `G`. Nunca te pide, recibe ni guarda la **frase de recuperación** ni la **clave secreta**. Si algo te pide la frase de recuperación para esta demo, está mal: frená y avisá.

Freighter no es un custodio. Vos conservás tus claves. Vaqcrow arma y verifica cada transacción, y vos la revisás y la firmás dentro de Freighter.

## 1. Agregar Freighter a Chrome

1. Abrí la página oficial de Freighter en la [Chrome Web Store](https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk). Instalala solo desde ese enlace: una extensión con otro origen puede ser una copia maliciosa.
2. Tocá **Agregar a Chrome** y confirmá con **Agregar extensión**.
3. Abrí el menú de extensiones (el ícono de la pieza de rompecabezas, arriba a la derecha) y **fijá** Freighter para tenerla siempre a mano.
4. Hacé clic en el ícono de Freighter y comprobá que se abre. Si no aparece, entrá a `chrome://extensions` y fijate que figure **habilitada**.

En Brave funciona igual, porque usa la misma Chrome Web Store.

## 2. Crear tu cuenta

1. En Freighter, elegí **crear una billetera nueva**. No importes una cuenta que tenga fondos reales.
2. Elegí una **contraseña**. Protege la extensión en este navegador; no es la frase de recuperación.
3. Freighter te muestra tu **frase de recuperación**: doce palabras. Anotala en papel o guardala en un gestor de contraseñas. Nunca en una captura, en un chat ni en un archivo compartido. Quien tiene esa frase controla la cuenta.
4. Freighter te pide confirmar algunas palabras de la frase para comprobar que la guardaste.
5. Listo: arriba ves tu **dirección pública**, que empieza con `G`. Esa es la única que vas a compartir con Vaqcrow.

> Si vas a probar la demo con los dos roles, PyME e inversor, podés **agregar una segunda cuenta** desde el selector de cuenta de Freighter. No te va a pedir una frase nueva: deriva otra dirección de la misma frase. Es el comportamiento esperado.

## 3. Pasar a Testnet

Freighter arranca en la red principal de Stellar. Vaqcrow corre en **Testnet**.

1. Abrí Freighter y tocá el **selector de red**, arriba.
2. Elegí **Testnet**.

Antes de cada firma, mirá que la red diga Testnet. Si Freighter está en otra red, Vaqcrow rechaza la firma. Es el error más frecuente y el más fácil de confundir con una falla de la demo.

## 4. Conectar Freighter en Vaqcrow

- **Si sos inversor**, entrá a **Mi portafolio** y tocá **Conectar Freighter**.
- **Si sos PyME**, entrá a **Mi campaña** y tocá **Conectar Freighter**. La PyME necesita una wallet conectada para enviar su solicitud a revisión, porque su dirección pública es el destino de la bóveda.

Freighter abre una ventana y te pide permiso para compartir tu **dirección pública** con Vaqcrow. Para probar que la wallet es tuya, también puede pedirte que firmes un **mensaje**. Un mensaje no es una transacción: no mueve fondos.

## 5. Cargar XLM de prueba con Friendbot

Una cuenta nueva no tiene saldo, y sin saldo no existe todavía en el ledger de Stellar. Por eso, al conectarla, Vaqcrow te muestra la tarjeta **Fondear tu wallet con XLM de prueba** y el aviso de que tu cuenta todavía no tiene XLM de Testnet.

1. En esa tarjeta tocá **Pedir XLM de prueba con Friendbot**. Se abre una pestaña nueva con tu dirección pública ya cargada.
2. Friendbot es el servicio de Stellar que fondea cuentas de Testnet. Responde con un texto técnico; si incluye `"successful": true`, la cuenta quedó fondeada con **10.000 XLM de prueba**.
3. **Volvé a la pestaña de Vaqcrow.** Al volver, Vaqcrow vuelve a leer el saldo real de tu cuenta en Testnet: el **Saldo disponible** se actualiza y el aviso desaparece. No hace falta cerrar sesión ni recargar.

Friendbot fondea cada cuenta **una sola vez**, siempre con la dirección pública y nunca con la clave privada. Si preferís hacerlo a mano, abrí esta dirección en el navegador, con tu dirección pública al final:

```text
https://friendbot.stellar.org/?addr=TU_DIRECCION_PUBLICA
```

También podés fondear desde [Stellar Laboratory](https://lab.stellar.org/account/fund): pegás la dirección pública y tocás el botón de fondeo.

## Si el saldo no aparece

| Lo que ves | Qué revisar |
|---|---|
| El saldo sigue en 0 | Que Freighter esté en **Testnet** y que la cuenta activa sea la misma que conectaste. Después volvé a la pestaña de Vaqcrow. |
| Friendbot respondió con un error | Que la dirección empiece con `G` y esté completa. Si la cuenta ya había sido fondeada, Friendbot no la vuelve a fondear. |
| El saldo muestra «—» | Vaqcrow no pudo leer la red en ese momento. No es un saldo en cero: probá de nuevo en un rato. |
| Querés ver la cuenta por fuera de Vaqcrow | Buscá tu dirección pública en [StellarExpert para Testnet](https://stellar.expert/explorer/testnet). |

## Qué no hacer

- No pegues la frase de recuperación ni la clave secreta en ningún formulario, chat o correo.
- No uses una cuenta con fondos reales para la demo.
- No firmes nada sin mirar antes la red, la cuenta y el monto en la ventana de Freighter.

## En resumen

Con Freighter instalada, una cuenta creada, la red en Testnet y XLM de prueba de Friendbot, ya podés usar Vaqcrow: como inversor, para aportar a una campaña; como PyME, para enviar tu solicitud y, más adelante, repartir el revenue share. Todo pasa en Testnet, sin valor económico, y cada firma la hacés vos.
