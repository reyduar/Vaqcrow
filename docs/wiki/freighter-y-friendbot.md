---
title: Preparar Freighter en Chrome y fondear la cuenta con Friendbot
type: flujo
sources:
  - blog/freighter-y-friendbot-paso-a-paso.md
  - freighter-and-testnet-walkthrough.md
updated: 2026-10-15
---

# Preparar Freighter en Chrome y fondear la cuenta con Friendbot

Para usar Vaqcrow, la PyME y el inversor necesitan una wallet de Stellar: **Freighter**, una extensión del navegador. El recorrido tiene cinco pasos. Todo corre en **Stellar Testnet**: los XLM de prueba no tienen valor económico.

Vaqcrow solo usa la **dirección pública** (empieza con `G`). Nunca pide, recibe ni guarda la frase de recuperación ni la clave secreta. Si algo pide la frase de recuperación para la demo, está mal.

## 1. Agregar Freighter a Chrome

- Instalarla solo desde la Chrome Web Store oficial: `https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk`. En Brave es igual.
- **Agregar a Chrome** → **Agregar extensión**. Después fijarla desde el menú de extensiones (la pieza de rompecabezas).
- Comprobar que se abre. Si no aparece, revisar en `chrome://extensions` que figure habilitada.

## 2. Crear la cuenta

1. En Freighter, crear una **billetera nueva**. No importar una cuenta con fondos reales.
2. Elegir una contraseña: protege la extensión en ese navegador, no es la frase de recuperación.
3. Anotar la **frase de recuperación** (doce palabras) en papel o en un gestor de contraseñas. Nunca en una captura, un chat ni un archivo compartido.
4. Confirmar las palabras que pide Freighter.
5. Arriba aparece la dirección pública, que empieza con `G`.

Para probar los dos roles se puede **agregar una segunda cuenta** desde el selector de cuenta. Freighter no pide una frase nueva: deriva otra dirección de la misma frase, y es lo esperado.

## 3. Pasar a Testnet

Abrir el **selector de red** de Freighter y elegir **Testnet**. Si Freighter está en otra red, Vaqcrow rechaza la firma. Es el error más frecuente.

## 4. Conectar Freighter en Vaqcrow

- Inversor: **Mi portafolio** → **Conectar Freighter**.
- PyME: **Mi campaña** → **Conectar Freighter**. La PyME necesita la wallet conectada para enviar su solicitud a revisión.

Freighter pide permiso para compartir la dirección pública y puede pedir que se firme un **mensaje** para probar que la wallet es propia. Un mensaje no es una transacción: no mueve fondos.

## 5. Fondear con Friendbot

Una cuenta nueva no tiene saldo y todavía no existe en el ledger. Vaqcrow muestra la tarjeta **Fondear tu wallet con XLM de prueba** y el aviso de que la cuenta no tiene XLM de Testnet.

1. Tocar **Pedir XLM de prueba con Friendbot**: se abre una pestaña nueva con la dirección pública cargada.
2. Si la respuesta incluye `"successful": true`, la cuenta quedó fondeada con 10.000 XLM de prueba.
3. **Volver a la pestaña de Vaqcrow**: al volver, Vaqcrow lee de nuevo el saldo real en Testnet, el **Saldo disponible** se actualiza y el aviso desaparece, sin cerrar sesión ni recargar.

Friendbot fondea cada cuenta una sola vez, con la dirección pública y nunca con la clave privada. A mano: `https://friendbot.stellar.org/?addr=` seguido de la dirección pública. También se puede fondear desde Stellar Laboratory (`https://lab.stellar.org/account/fund`).

## Si el saldo no aparece

| Síntoma | Qué revisar |
|---|---|
| El saldo sigue en 0 | Que Freighter esté en Testnet y que la cuenta activa sea la conectada; después volver a la pestaña de Vaqcrow |
| Friendbot respondió con error | Que la dirección empiece con `G` y esté completa; una cuenta ya fondeada no se vuelve a fondear |
| El saldo muestra «—» | Vaqcrow no pudo leer la red en ese momento; no es un saldo en cero, probar de nuevo más tarde |
| Ver la cuenta por fuera | Buscar la dirección pública en StellarExpert para Testnet (`https://stellar.expert/explorer/testnet`) |
