---
title: Freighter y Testnet — recorrido completo de la demo
tags:
  - demo
  - stellar
  - freighter
  - testnet
  - guide
date: 2026-09-25
status: draft
---

# Preparación de Freighter y recorrido completo de la demo

> [!info] Para qué sirve este documento
> Es la guía operativa para **probar la demo de Vaqcrow en Stellar Testnet**, paso a paso. Sirve tanto para el equipo como para quien recibe el acceso: crea las **dos cuentas** que hacen falta —una para la PyME y una para el inversor—, las fondea con XLM de prueba, y recorre el journey completo.
>
> No explica la arquitectura. Dice qué hacer, en qué orden, y **qué deberías ver** en cada pantalla. Para el *por qué* de las cuentas y las claves, ver [[docs/architecture/stellar-accounts-and-keys|Cuentas, claves y fondeo en Stellar]].

## 1. Lo que necesitás

| Qué | Detalle |
|---|---|
| Navegador de escritorio | Chrome, Brave o Firefox |
| La extensión Freighter | Ver §3 para los enlaces oficiales |
| Una cuenta de Testnet fondeada | Ver §5 y §6 |

Nada más. **No se instala software, no se compila nada y no hay que pedirle ninguna clave a Vaqcrow.**

### Las dos cuentas

La demo tiene dos roles y **cada uno usa su propia cuenta**:

| Rol | Cuenta | Qué hace con Freighter |
|---|---|---|
| **PyME** | Cuenta 1 | Conecta la billetera al abrir la bóveda. **No firma nada** en ese paso: sólo comparte su dirección pública |
| **Inversor** | Cuenta 2 | Firma su aporte, su retiro y —si corresponde— el reembolso |

> [!tip] Por qué dos cuentas separadas
> Además de reflejar el caso real, separarlas hace visible **quién autoriza cada operación** y evita un error de guion muy común: firmar como PyME algo que la PyME no debería firmar. Como el reembolso es sin permisos, una sola cuenta alcanzaría técnicamente para todo, pero el recorrido se entiende mucho mejor con dos.

## 2. El principio que no se negocia

> [!warning] Vaqcrow nunca pide tu seed
> Vaqcrow solicita y muestra **únicamente direcciones públicas** (las que empiezan con `G`). Nunca pide, recibe, guarda ni muestra la frase de recuperación ni la clave secreta.
>
> Freighter es una billetera y una interfaz de firma, **no un custodio**: vos conservás tus claves, Vaqcrow arma y verifica la transacción, y vos la revisás y la firmás dentro de Freighter.
>
> **Si algo te pide la frase de recuperación para esta demo, está mal. Frená y avisá.**

## 3. Instalar Freighter

Instalá la extensión **sólo** desde sus enlaces oficiales:

| Navegador | Enlace oficial |
|---|---|
| Chrome o Brave | [Chrome Web Store](https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/freighter/) |

Después de instalarla, verificalo **en el navegador**: que la extensión se abra y figure **habilitada**. Una orden de terminal no demuestra de forma confiable que una extensión esté instalada y autorizada.

## 4. Crear la cuenta de la PyME

1. Creá una **billetera nueva**. No importes una cuenta que custodie fondos reales.
2. Guardá la **frase de recuperación** fuera del repositorio y fuera del chat: papel o gestor de contraseñas. Nunca en un archivo versionado, ni en un `.env`, ni en una captura.
3. Abrí el selector de red de Freighter y elegí **Testnet**.
4. Verificá que la **dirección activa** empiece con `G`. Copiala: la vas a usar en §6.

## 5. Crear la cuenta del inversor

> [!important] Freighter **no** crea una segunda billetera con su propia frase de recuperación
> Al agregar una cuenta, Freighter **no** te da ni te pide una frase nueva: deriva otra cuenta **de la misma frase de recuperación** que ya tenés, usando otro índice de derivación. Por eso no vas a ver una segunda frase.
>
> La dirección y la clave **sí son distintas**, así que sirve perfectamente como rol de inversor. Pero **las dos cuentas comparten una sola frase**: quien la tenga, controla las dos. Para una demo en Testnet sin valor económico es aceptable; si necesitás dos identidades realmente independientes, ver la nota al final de esta sección.

1. En Freighter, abrí el **selector de cuenta**.
2. Elegí la opción para **agregar una cuenta** (según la versión aparece como *Add account* / *Añadir cuenta*, o *Create new wallet*).
3. **No te va a pedir una frase nueva.** Es el comportamiento esperado, no un error: se deriva de la que ya tenés.
4. Verificá que la **dirección nueva** sea distinta de la de la PyME y que empiece con `G`.
5. Asegurate de que la red siga en **Testnet**.

Vas a alternar entre estas dos cuentas durante la demo. Ver §8.

> [!tip] Si querés dos identidades independientes de verdad
> Hay dos caminos soportados por Freighter:
>
> - **Un perfil de navegador distinto.** La extensión guarda su estado por perfil del navegador, así que un segundo perfil te da una billetera con su **propia frase de recuperación**, aislada de la primera.
> - **Agregar una cuenta por clave secreta.** Freighter permite sumar una cuenta pegando la clave secreta de una identidad generada fuera de la extensión.
>
> Para esta demo alcanza con las dos cuentas derivadas de la misma frase que describe esta sección. Lo importante es el **efecto**: dos direcciones públicas distintas, una por rol.

## 6. Fondear cada cuenta con XLM de prueba

Sólo **XLM de Testnet**, que no tiene valor económico. Hay dos caminos, elegí el que te resulte más cómodo:

**Opción A — Stellar Lab (visual)**

Abrí <https://lab.stellar.org/account/fund>, pegá la **dirección pública** y fondeá. Repetilo con la otra cuenta.

**Opción B — Friendbot**

Abrí esto en el navegador, una vez por cada dirección pública:

```
https://friendbot.stellar.org?addr=TU_DIRECCION_PUBLICA_G...
```

> [!important] Friendbot quiere una dirección pública, y lo dice él mismo
> Pedirle a `https://friendbot.stellar.org` sin `addr` devuelve `400` con el detalle `invalid address: must be a valid G or C address`. El propio servicio exige una dirección **G** (pública) o **C** (contrato). No existe ningún camino en el que una seed haga falta acá.

> [!note] La PyME no necesita fondos para abrir la bóveda
> Cuando la PyME abre la bóveda, **Vaqcrow crea y fondea su cuenta** en la cadena con 2 XLM, firmando con su propia clave de plataforma. Ese monto no es el dinero de la campaña: es sólo el costo de alta de la cuenta en el ledger.
>
> La cuenta del inversor **sí** necesita XLM propio para aportar. Fondeá las dos igual: no cuesta nada y evita un paso trabado a mitad de la demo.

Comprobá que llegó el saldo: la cuenta debería mostrar XLM en Freighter y existir en el explorador.

## 7. Verificar la red antes de cada firma

Antes de firmar cualquier cosa, confirmá que lo que ves en Freighter coincide con lo que espera Vaqcrow:

| Verificación | Valor esperado |
|---|---|
| Red en Freighter | **Testnet** |
| Passphrase de red | `Test SDF Network ; September 2015` |
| Horizon | `https://horizon-testnet.stellar.org` |

> [!important] Si Freighter está en otra red, la demo rechaza la firma
> No es un capricho: el código verifica la passphrase antes de pedir la firma. Si Freighter dice `PUBLIC` o cualquier otra red, cambiá a **Testnet** y volvé a intentar. Este es el error más frecuente y el más fácil de confundir con una falla de la demo.

## 8. Cambiar de rol durante la demo

Todo el recorrido ocurre en la misma pestaña del navegador. El rol lo determina **qué cuenta está activa en Freighter** en ese momento:

1. Abrí el popup de Freighter.
2. Cambiá la cuenta activa (PyME o inversor).
3. Volvé a la página de la demo.

> [!tip] Mirá la cuenta activa antes de cada firma
> El popup de Freighter te muestra **desde qué cuenta** vas a firmar. Revisalo siempre antes de aceptar: es la última barrera y la más barata.

## 9. El recorrido, paso a paso

La demo tiene **6 pasos**. Se navega con la barra de arriba o avanzando con el botón al pie de cada pantalla.

| Paso | Ruta | Rol protagonista |
|---|---|---|
| 1. Solicitud | `/request` | PyME |
| 2. Evaluación con IA | `/ai-assessment` | — |
| 3. Aprobación humana | `/approval` | Persona que decide |
| 4. Fondeo | `/funding` | PyME → Inversor |
| 5. Distribución | `/distribution` | — |
| 6. Evidencia | `/evidence` | — |

### Paso 1 — Solicitud (`/request`)

Vas a ver a la PyME del caso, **Panadería Horizonte SRL**, con su KYC y sus ventas mensuales.

Prestá atención a la serie de ventas: **falta abril** y **junio está marcado para revisión**. No son errores de carga: son parte del caso, puestos a propósito para que la evaluación tenga algo real que señalar.

> [!note] Este paso es demostrativo
> La identidad, el KYC/KYB, las ventas y la conversión ARS/activo de este caso son **sintéticos por diseño**, y así está declarado en pantalla. El caso ya viene cargado para que el recorrido arranque en la evaluación.

### Paso 2 — Evaluación con IA (`/ai-assessment`)

La IA ordena la evidencia, identifica anomalías y propone una evaluación explicable. **Sólo asesora**: no inventa datos, no decide y no transfiere fondos. Vas a ver una recomendación con un nivel de riesgo y una confianza.

### Paso 3 — Aprobación humana (`/approval`)

Acá decide **una persona**. Completá:

1. **Decisión**: elegí *Aprobar*.
2. **Quién decide**: tu nombre o el del rol.
3. **Razón de la decisión**: una línea con el motivo.
4. Presioná **Registrar decisión**.

El límite aprobado lo fija la persona, no la IA. La recomendación de la IA no aprueba nada por sí sola.

### Paso 4 — Fondeo (`/funding`)

Es el paso central. Se hace en dos momentos y con **dos cuentas distintas**.

**4.a — La PyME abre la bóveda**

1. Con la **cuenta de la PyME activa**, presioná conectar billetera.
2. Vaqcrow lee tu **dirección pública**. En este paso **no vas a firmar nada**: la bóveda la despliega Vaqcrow firmando con su propia clave de plataforma.
3. Completá el **monto objetivo** y la **fecha límite**.
4. Presioná **Abrir bóveda**.

> [!important] Elegí una fecha límite futura
> El formulario interpreta la fecha a las **00:00 UTC** de ese día, y el contrato exige que el vencimiento sea posterior al momento actual. Si elegís "hoy", el vencimiento ya pasó y la apertura falla. Elegí **pasado mañana o más**.

Detrás de escena pasan tres cosas que conviene saber al mostrar la demo:

- Si la cuenta de la PyME todavía no existe en el ledger, Vaqcrow **la crea y la fondea** con 2 XLM.
- Vaqcrow **despliega la bóveda** en la fábrica de contratos, firmando como dueña de esa fábrica.
- Vaqcrow **lee el estado desde la cadena** y recién después lo refleja en la interfaz. La cadena es la autoridad del dinero, no la base de datos.

**4.b — El inversor aporta**

1. Cambiá la **cuenta activa a la del inversor** (ver §8).
2. Escribí el monto y presioná **Aportar**.
3. **Firmá en Freighter.** Antes de aceptar, revisá en el popup: **red, destino, activo y monto**.

Después de firmar, el total de la campaña se actualiza y tu aporte queda registrado. Vas a poder ver el **hash de la transacción** y abrirlo en el explorador.

### Paso 5 — Distribución (`/distribution`)

> [!todo] Todavía es un placeholder
> Esta pantalla muestra un aviso de contenido pendiente. La distribución de retornos es la Feature #28 y aún no está implementada.

### Paso 6 — Evidencia (`/evidence`)

> [!todo] Todavía es un placeholder
> Igual que el paso anterior: muestra un aviso de contenido pendiente. Corresponde a la Feature #29.

## 10. Los tres estados de la campaña

La interfaz muestra el estado que lee **de la cadena**, no de un estado local. Los ves en la pantalla de Fondeo:

| En pantalla | Estado | Qué significa |
|---|---|---|
| **Fondeo abierto** | `funding` | Se puede aportar. El plazo no venció y no se alcanzó la meta |
| **Meta alcanzada** | `settled` | Se alcanzó el objetivo. Los fondos se transfirieron a la PyME en la misma transacción que cruzó la meta |
| **Reembolso disponible** | `refunding` | Venció el plazo sin alcanzar la meta. Los aportes se pueden retirar |

> [!important] Cuando se alcanza la meta, los aportes se cierran de verdad
> Al llegar a **Meta alcanzada**, la interfaz deja de ofrecer el botón de aportar. Y no es sólo cosmético: si alguien intentara aportar igual, **el contrato lo rechaza**. La regla vive en el contrato, no en la pantalla.

## 11. El camino de reembolso

Si vence el plazo **sin** alcanzar la meta, la campaña pasa a **Reembolso disponible** y cada inversor puede recuperar su aporte.

> [!important] Es sin permisos, y eso es una propiedad del contrato
> El reembolso lo puede disparar **cualquier persona**: la propia PyME, otro inversor, o cualquiera con una billetera. No hay riesgo de que eso desvíe fondos, porque **el destino lo fija el contrato**: el dinero vuelve siempre a la dirección registrada del aportante, y no se puede redirigir.
>
> En la práctica, una persona distinta del inversor puede presionar **Reembolsar** en su nombre y el aporte igual llega a la dirección correcta.

> [!warning] El reembolso necesita que alguien envíe una transacción
> No se dispara solo. El contrato habilita el derecho cuando vence el plazo, pero **alguien tiene que enviar la transacción** para que el dinero vuelva. En Testnet eso lo hace cualquiera desde la interfaz, firmando con su propia billetera.

## 12. Qué NO hacer

- **No pegues una seed ni la frase de recuperación** en ningún formulario, chat, issue, PR ni archivo. Ni siquiera "para probar".
- **No importes una billetera con fondos reales.** Creá una nueva.
- **No uses Mainnet ni otra red.** La demo liquida sólo en Testnet y el código rechaza cualquier otra red por construcción.
- **No dejes la frase de recuperación en el portapapeles** más tiempo del necesario; limpialo después.
- **No compartas capturas** que muestren la frase de recuperación, aunque el resto de la pantalla sea inocuo.

## 13. Límites honestos de esta demo

Los dejamos por escrito para que nadie los confunda con una falla, ni con una promesa:

- **Es Testnet.** Los activos no tienen valor económico. Un hash de Testnet demuestra ejecución técnica, **no** una inversión real ni disponibilidad en producción.
- **La identidad, el KYC/KYB, las ventas y la conversión ARS/activo son simulados.** Está declarado en pantalla y es parte del alcance del demo.
- **Los pasos 5 y 6 todavía son placeholders** (Features #28 y #29).
- **El reembolso requiere enviar una transacción.** Es sin permisos, pero no se dispara solo.
- **La meta la impone el contrato, no la interfaz.** La interfaz sólo deja de ofrecer lo que el contrato ya rechazaría.
- **Una bóveda por solicitud.** La campaña queda ligada a la solicitud que la originó.

## 14. Qué registrar como evidencia

Al terminar una ejecución, guardá:

| Qué | Dónde mirarlo |
|---|---|
| Dirección pública y rol de cada cuenta usada | Freighter |
| Hash de cada transacción | La interfaz, y el explorador: <https://stellar.expert/explorer/testnet> |
| Estado final de cada transacción | El explorador |
| Estado de la campaña al cerrar la demo | Pantalla de Fondeo |
| Capturas de cada firma en Freighter | Evidencia de la demo |

> [!tip] Las direcciones son descartables
> Las cuentas de Testnet no se reutilizan entre demos sin un reinicio explícito. Después de cada ejecución, creá cuentas nuevas y fondealas con Friendbot.

## 15. Referencias

- [Connect to the Testnet — Stellar Docs](https://developers.stellar.org/docs/build/guides/freighter/connect-testnet) — guía oficial de instalación de Freighter y conexión a Testnet.
- [Freighter](https://www.freighter.app) y su [documentación de la API](https://docs.freighter.app/extension-freighter-api/installation.md).
- [Stellar Lab — fondeo de cuentas](https://lab.stellar.org/account/fund) y [creación de cuenta](https://lab.stellar.org/account/create).
- [Stellar Expert — explorador de Testnet](https://stellar.expert/explorer/testnet).
- [Redes de Stellar](https://developers.stellar.org/docs/networks) — Testnet, passphrase y XLM sin valor real.
- `docs/planning/freighter-and-testnet-account-setup.md` — runbook interno de preparación y lista de seguridad.
- `docs/architecture/stellar-accounts-and-keys.md` — por qué existen dos pares de claves y por qué la cuenta de la PyME se crea al abrir la bóveda.

> [!question] Verificación de este documento
> Los enlaces de instalación de Freighter, el comportamiento de Friendbot (exige una dirección `G` o `C`) y la disponibilidad de Stellar Lab y de Horizon se verificaron en vivo el **2026-09-20**. Las etiquetas de estado (`Fondeo abierto`, `Meta alcanzada`, `Reembolso disponible`) y los nombres de los botones (`Aportar`, `Retirar mi aporte`, `Reembolsar`) provienen del código de `apps/web/src/presentation/components/campaign-workspace.tsx`. Las rutas de los seis pasos provienen del árbol de rutas de `apps/web/src/app`. La passphrase de red está fijada en `apps/api/src/application/config/stellar-config.ts` y afirmada por un test.
>
> La fecha límite del formulario y su conversión a las 00:00 UTC provienen de `campaign-workspace.tsx`; el requisito de vencimiento futuro, de `contracts/campaign-vault/src/lib.rs`.
>
> **Corregido el 2026-09-25:** una versión anterior de §5 decía que la segunda cuenta tenía su propia frase de recuperación. Es incorrecto. Freighter no genera una frase nueva al agregar una cuenta: la deriva de la frase existente mediante otro índice de derivación, cosa que está confirmada por el comportamiento de la extensión y por el propio código de Freighter, que ancla el cálculo del índice a la mnemónica (`stellar/freighter-mobile#874`) y ofrece agregar cuentas por clave secreta (`stellar/freighter#2208`). El punto se detectó al ejecutar la guía, no al escribirla.
