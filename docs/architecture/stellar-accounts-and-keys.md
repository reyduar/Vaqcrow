---
title: Stellar Accounts and Keys
tags:
  - architecture
  - stellar
  - custody
  - campaign-vault
date: 2026-09-24
status: draft
---

# Vaqcrow — Cuentas, claves y fondeo en Stellar

> [!info] Objetivo
> Explicar, sin suponer conocimiento previo de Stellar, qué significa "fondear" una cuenta, qué pares de claves existen en el recorrido de la bóveda de campaña y por qué es la cuenta de la plataforma la que crea la cuenta de la PyME al aprobarla. Complementa [[docs/planning/stellar-blockchain-requirements|Requisitos de Stellar]] (sección "Provisión de la cuenta de la PyME") y las decisiones D2, D7 y D8 de `odd/tasks/campaign-vault-web-journey.md` (Task [#247](https://github.com/reyduar/Vaqcrow/issues/247)).

## 1. Qué significa "fondear" una cuenta

En Stellar, una cuenta **no existe** hasta que alguien le envía XLM para crearla, con la operación `CreateAccount`. Tener una clave pública no alcanza: es como tener un número de medidor de luz sin que nadie haya pagado la conexión.

El monto que se envía cubre la **reserva mínima** que el ledger exige para que la cuenta exista (alrededor de 1 XLM; Vaqcrow envía 2 XLM para dejar margen de comisiones). **No es el dinero de la campaña**: es sólo el costo de alta de la cuenta en el ledger. En Testnet y en la red local ese XLM no tiene valor económico.

> [!important] Por qué la cuenta de la PyME tiene que existir antes de abrir la bóveda
> La cuenta de la PyME es el **destino del pago** cuando la campaña alcanza el objetivo: el contrato transfiere los fondos en la misma transacción que cruza la meta. Si la cuenta no existiera, esa transferencia fallaría y la transacción entera se revertiría, con aportes de inversores ya dentro del contrato y sin que nadie más pudiera completar la meta. Por eso Vaqcrow verifica (y si hace falta crea) la cuenta **al abrir la bóveda**, no al liquidar.

## 2. Los dos pares de claves

En el recorrido hay **dos pares de claves distintos**, de dueños distintos. Mezclarlos es la confusión más común.

| | Claves de la PyME (y de cada inversor) | Claves de la plataforma |
|---|---|---|
| **Quién las genera** | Freighter, en el dispositivo de la persona | Vaqcrow, para su propia cuenta operativa |
| **Dónde vive la clave secreta** | Sólo dentro de Freighter; nunca sale de la extensión | En el entorno de la API, como `STELLAR_PLATFORM_SECRET_KEY` (tipo `Secret`); en la red local, en el keystore del Stellar CLI |
| **Qué ve Vaqcrow** | Sólo la **clave pública** (`G…`) | La clave completa, porque es suya |
| **Para qué se usa** | Firmar sus propios aportes, retiros y reembolsos | Crear la cuenta de la PyME y abrir bóvedas en la fábrica (es la dueña de la fábrica) |

- **Clave pública** (`G…`): como un número de cuenta bancaria. Se puede compartir; es lo único que Vaqcrow recibe de la PyME y de los inversores.
- **Clave secreta / seed** (`S…`): como la llave de la caja fuerte. La de la PyME y la de cada inversor **nunca** salen de Freighter; Vaqcrow no las ve, no las genera y no las guarda.

> [!warning] Crear la cuenta no genera ninguna clave
> Cuando Vaqcrow "crea la cuenta de la PyME", no genera claves nuevas. Las claves de la PyME ya existen en su Freighter desde antes. Lo que ocurre es que la cuenta de la plataforma envía el alta (`CreateAccount`) hacia la **clave pública** que la PyME ya posee, y recién entonces esa clave "existe" en el ledger.

## 3. El paso a paso al abrir la bóveda

1. Tras la aprobación humana, la PyME **conecta Freighter** en la web y Vaqcrow lee su **clave pública** (D7). La seed nunca sale de la extensión.
2. La API calcula la dirección determinística de la bóveda (`predict`) a partir de la solicitud. Si ya hay una bóveda ahí (un intento anterior que falló después del despliegue), la **adopta** en lugar de desplegar otra.
3. Si la cuenta de la PyME no existe, la **cuenta de la plataforma** envía `CreateAccount` hacia esa clave pública, **firmando con su propia clave**. `CreateAccount` no requiere la firma del destino: la PyME no firma nada en este paso.
4. La API **verifica que la cuenta existe** y recién entonces llama a `deploy()` en la fábrica, firmado por la plataforma como dueña.
5. La API lee la bóveda recién abierta **desde la cadena** y sólo después la registra en el espejo de Supabase (la cadena es la autoridad del dinero).

## 4. Por qué fondea la plataforma y no Friendbot

Friendbot es un servicio de Testnet y de la red local que crea y fondea una cuenta en una sola llamada. Se evaluó y se descartó para la cuenta de la PyME:

| Criterio | Cuenta de la plataforma (`CreateAccount`) | Friendbot |
|---|---|---|
| Existe en mainnet | Sí: es el modelo del producto real | No: sólo Testnet/red local |
| Secretos nuevos | Ninguno: la clave de la plataforma ya se necesita para `deploy()` | Ninguno |
| Monto | Controlado (2 XLM) | Fijo y poco realista (10.000 XLM) |
| Confiabilidad | Bajo control de Vaqcrow | Servicio externo con límites de uso |

Friendbot se usa sólo para lo que sí sirve: cargar XLM de prueba en la **cuenta de la plataforma** y en las **wallets de los inversores**, en la red local y en Testnet.

## 5. Cómo se protege la clave de la plataforma

- Entra como variable tipada `Secret`: colapsa a un marcador si se convierte en texto, así que no puede llegar a un log por accidente.
- Sólo **un archivo auditado** puede convertirla en una clave de firma: `apps/api/src/infrastructure/adapters/platform-signer.ts` (D8). El escáner de no-custodia (`tests/stellar-non-custody.test.ts`) prohíbe `Keypair.fromSecret` en cualquier otra ruta de `apps/*/src`, y un test fija que la excepción sea exactamente ese archivo.
- `PlatformSigner` guarda la clave en un campo privado y sólo expone la clave pública y la operación de firmar; `toString`/`toJSON` devuelven un marcador fijo.
- La garantía de la Feature [#23](https://github.com/reyduar/Vaqcrow/issues/23) se mantiene: **Vaqcrow nunca tiene claves de usuarios**. La única clave que maneja es la operativa de la propia plataforma.

> [!tip] Qué firma cada persona en la demo
> - **PyME:** nada al abrir la bóveda; sólo conecta Freighter para compartir su clave pública.
> - **Inversor:** su aporte y su retiro, con Freighter.
> - **Cualquiera:** el reembolso de un inversor después del plazo sin meta. Es sin permisos porque el contrato fija el destino: los fondos siempre vuelven a la dirección registrada del aportante y no se pueden desviar.
