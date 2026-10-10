---
title: Freighter y Testnet — recorrido completo de la demo por roles
tags:
  - demo
  - stellar
  - freighter
  - testnet
  - guide
date: 2026-10-10
status: draft
---

# Preparación de Freighter y recorrido completo de la demo por roles

> [!info] Para qué sirve este documento
> Es la guía operativa para **probar la demo de Vaqcrow en Stellar Testnet** con la app por roles: **PyME**, **ADMIN** e **INVERSOR**. Prepara Freighter y las cuentas, y recorre el flujo de punta a punta: la PyME se registra y envía su solicitud, una persona administradora la aprueba y la bóveda se despliega, el inversor aporta, la PyME distribuye y cada rol encuentra su evidencia.
>
> No explica la arquitectura. Dice qué hacer, en qué orden, y **qué deberías ver** en cada pantalla. Para el *por qué* de las cuentas y las claves, ver [[docs/architecture/stellar-accounts-and-keys|Cuentas, claves y fondeo en Stellar]]. Para dejar listo el entorno antes de una corrida, ver [[docs/planning/demo-run-preflight|el preflight de la demo]].

> [!info] 2026-10-10 — #438: qué cambió
> Esta guía describía antes un recorrido guiado de seis pasos con rutas propias (`/request`, `/ai-assessment`, `/approval`, `/funding`, `/distribution`, `/evidence`). La Feature [#438](https://github.com/reyduar/Vaqcrow/issues/438) retiró esas seis rutas: ahora **responden 404**, sin redirección. El flujo vive en la app por roles y la evidencia Testnet se reparte por rol (§13).
>
> #438 y las Features por rol están en `main` desde [PR #466](https://github.com/reyduar/Vaqcrow/pull/466) (2026-10-10, merge `2b7e0d5`). Esta guía describe `main`; no afirma qué versión está desplegada en Railway o Vercel.

## Ruta rápida

1. Instalá Freighter, ponelo en **Testnet** y creá dos cuentas: PyME e inversor (§3–§5).
2. Fondeá las dos con XLM de prueba (§6).
3. **PyME:** creá la cuenta, registrá la PyME con el wizard, conectá Freighter y enviá a revisión (§9).
4. **ADMIN:** ingresá en `/admin`, revisá la solicitud y aprobala; la bóveda se despliega en Testnet (§10).
5. **INVERSOR:** explorá, abrí la campaña y aportá firmando en Freighter (§11).
6. **PyME:** con la meta alcanzada, declará ventas y firmá la distribución (§12).
7. Juntá la evidencia de cada rol (§13).

## 1. Lo que necesitás

| Qué | Detalle |
|---|---|
| Navegador de escritorio | Chrome, Brave o Firefox |
| La extensión Freighter | Ver §3 para los enlaces oficiales |
| Dos cuentas de Testnet fondeadas | Una para la PyME y otra para el inversor (§4–§6) |
| Tres cuentas de Vaqcrow | Una PyME y una inversora, que creás vos (§9, §11); y el acceso ADMIN que te da quien opera la demo (§10) |
| El entorno de la demo andando | Quien opera la demo lo comprueba con `pnpm demo:preflight` antes de empezar (ver [[docs/planning/demo-run-preflight|preflight]] §2) |

**No se instala software, no se compila nada y no hay que pedirle ninguna clave de Stellar a Vaqcrow.**

### Los tres roles

| Rol | Cuenta de Vaqcrow | Cuenta de Freighter | Qué firma en Freighter |
|---|---|---|---|
| **PyME** | Alta en `/signup` con «Soy PyME» | Cuenta 1 | Un **mensaje** para verificar que la wallet es suya (no es una transacción) y, más adelante, **la distribución** a los inversores |
| **ADMIN** | La entrega quien opera la demo; no tiene alta pública | Ninguna | **Nada.** Aprueba en la consola; el despliegue de la bóveda lo firma la plataforma |
| **Inversor** | Alta en `/signup` con «Soy inversor» | Cuenta 2 | Un **mensaje** para verificar su wallet, su **aporte** y, si corresponde, su **retiro** o **reembolso** |

> [!tip] Por qué dos cuentas de Freighter separadas
> Además de reflejar el caso real, separarlas hace visible **quién autoriza cada operación** y evita firmar como PyME algo que la PyME no debería firmar. La bóveda tiene como destino inmutable la cuenta de la PyME: si la PyME y el inversor usaran la misma, el recorrido dejaría de mostrar algo.

## 2. El principio que no se negocia

> [!warning] Vaqcrow nunca pide tu seed
> Vaqcrow solicita y muestra **únicamente direcciones públicas** (las que empiezan con `G`). Nunca pide, recibe, guarda ni muestra la frase de recuperación ni la clave secreta.
>
> Vaqcrow es **no custodio**: nunca tiene tus claves ni recibe o mueve tu dinero. Freighter es una billetera y una interfaz de firma, **no un custodio**: vos conservás tus claves, Vaqcrow arma y verifica la transacción, y vos la revisás y la firmás dentro de Freighter. Los aportes los custodia **el contrato de la bóveda**, no una persona.
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
> - **Un perfil de navegador distinto.** La extensión guarda su estado por perfil del navegador, así que un segundo perfil te da una billetera con su **propia frase de recuperación**, aislada de la primera. De paso, cada perfil conserva su propia sesión de Vaqcrow, lo que simplifica el cambio de rol (§8).
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

> [!note] Las dos cuentas necesitan XLM propio
> - **El inversor** paga su aporte y las comisiones.
> - **La PyME** no paga el despliegue de la bóveda: lo firma y lo paga la plataforma. Si su cuenta todavía no existe en el ledger, Vaqcrow **la crea y la fondea** con 2 XLM al desplegar la bóveda; ese monto no es dinero de la campaña, es sólo el costo de alta de la cuenta. Pero la PyME **sí paga la distribución** a los inversores (§12), así que necesita saldo propio.
>
> El preflight sugiere pisos de 10 XLM para la PyME y 20 XLM para el inversor ([[docs/planning/demo-run-preflight|preflight]] §2.1). Friendbot alcanza para los dos.

Comprobá que llegó el saldo: la cuenta debería mostrar XLM en Freighter y existir en el explorador. El inversor también ve su saldo en `/portfolio` una vez conectada la wallet, con una guía de fondeo de Testnet si la cuenta es nueva.

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

El rol lo deciden **dos cosas a la vez**, y las dos tienen que coincidir:

| Qué | Dónde se cambia |
|---|---|
| La **cuenta de Vaqcrow** con la que ingresaste | Cerrá sesión e ingresá con la otra cuenta. El ADMIN ingresa siempre por `/admin`, nunca por `/login` |
| La **cuenta activa de Freighter** | Popup de Freighter → selector de cuenta |

1. Cerrá sesión en Vaqcrow e ingresá con la cuenta del rol que sigue.
2. Abrí el popup de Freighter y elegí la cuenta de ese rol.
3. Volvé a la página de la demo.

> [!tip] Mirá la cuenta activa antes de cada firma
> El popup de Freighter te muestra **desde qué cuenta** vas a firmar. Revisalo siempre antes de aceptar: es la última barrera y la más barata. La wallet que Vaqcrow guarda para cada cuenta es la que verificó con la firma del mensaje; firmar desde otra cuenta de Freighter no la reemplaza.

> [!tip] El atajo: un perfil de navegador por rol
> Con un perfil para la PyME, otro para el inversor y una ventana privada para el ADMIN no hace falta cerrar sesión ni cambiar de cuenta en Freighter entre pasos.

## 9. PyME — alta, registro y envío a revisión

### 9.1 Crear la cuenta e ingresar

1. Abrí `/signup`, elegí **«Soy PyME»** y completá «Nombre o Razón Social», correo y contraseña.
2. Confirmá el correo con el enlace que te llega. Sin confirmar no podés ingresar.
3. Ingresá en `/login` con **«Soy PyME»** seleccionado. Vaqcrow te lleva a `/company` («Mi campaña»).

> [!important] El selector de rol tiene que coincidir con la cuenta
> El rol lo decide la cuenta, no el selector, pero el selector debe coincidir: una cuenta PyME que ingresa con «Soy inversor» se rechaza con «Esta cuenta es de PyME. Elegí «Soy PyME» para ingresar.», y no queda ninguna sesión abierta.

### 9.2 «Registrar mi PyME»: el wizard

En `/company`, presioná **«Registrar mi PyME»**. Se abre un único wizard con cuatro pasos en la misma pantalla, sin rutas propias: **KYC → Registro PyME → Evaluación AI → Revisión humana**.

| Paso | Qué hacés | Qué deberías ver |
|---|---|---|
| 1. KYC | «Iniciar verificación simulada» (o «Usar archivo de prueba») | «KYC aprobado · SIMULADO». Es simulado: no se procesa ningún documento real. Seguí con «Siguiente paso» |
| 2. Registro PyME | Completá «Datos de la empresa», las ventas mensuales y los **tres documentos obligatorios** y entre una y cuatro fotos. «Completar con datos de ejemplo» llena el formulario con datos sintéticos. Enviá con «Enviar a evaluación AI» | Un mes vacío se marca «Faltante», nunca cero. Los documentos y las fotos **se suben de verdad** a un almacenamiento privado |
| 3. Evaluación AI | Leé la evaluación y seguí con «Continuar» (o «Corregir datos») | Faltantes, anomalías y una «Banda de riesgo propuesta», «Sujeta a revisión humana». **La IA sólo asesora**: no aprueba ni rechaza |
| 4. Revisión humana | Presioná «Conectar Freighter» con la **cuenta 1** activa y firmá el mensaje de verificación. Después, «Enviar a revisión» | «Solicitud enviada · en revisión.» y el ítem «Revisión humana» en «En proceso» |

> [!warning] Datos sintéticos, aunque los archivos se suban de verdad
> El propio wizard lo dice: «Demo: usá datos sintéticos. No cargues información real de tu empresa.» No subas documentos reales.

> [!important] Freighter es obligatorio para enviar
> Sin wallet conectada, el ítem «Conectar Freighter» pasa a «Obligatorio» y el envío se bloquea. La clave pública que conectás viaja con la solicitud: es el **destino inmutable** de los fondos de la bóveda. Conectar firma **un mensaje**, no una transacción: no se mueve dinero.

> [!note] Una evaluación incompleta avisa pero no bloquea
> Si el chequeo de completitud encuentra un faltante, lo marca, pero podés enviar igual: la decisión es de una persona. «Revisar lo cargado» vuelve al paso 2 sólo antes de enviar; el wizard guarda su estado en memoria, así que no hay borrador para retomar más tarde.

Al enviar, la persona administradora recibe un aviso por correo y en la campana de la app.

## 10. ADMIN — revisión, aprobación y despliegue de la bóveda

1. Abrí `/admin` e ingresá con el correo y la contraseña de ADMIN. Ninguna página pública enlaza a `/admin`, y un ADMIN nunca ingresa por `/login`.
2. Llegás a la cola de PyMEs (`/admin/pymes`). La solicitud nueva figura como «Pendiente de revisión». Presioná **«Revisar solicitud»**.
3. Recorré la revisión en orden:

| Sección | Qué mirar |
|---|---|
| 1 · KYC/KYB | El resultado simulado de la PyME |
| 2 · Recomendación de IA | Banda de riesgo, faltantes y anomalías. Dice «Consultiva · no aprueba» |
| 3 · Decisión humana | Elegí «Aprobar con límite», escribí la **Razón** (obligatoria) y presioná «Registrar decisión» → «Confirmar» |
| Despliegue de la bóveda | El estado del despliegue en Testnet, después de aprobar |

> [!important] La IA recomienda; una persona decide
> La recomendación de la IA no aprueba nada por sí sola. El límite aprobado es la meta que declaró la PyME y no se edita; quien decide queda registrado con su nombre, desde la sesión verificada.

Aprobar dispara el despliegue de la bóveda. El panel recorre «Pendiente de confirmación» → «Desplegando bóveda» → **«Bóveda confirmada / PyME publicada»**. Si todavía no aparece un despliegue, presioná «Actualizar»; si no hay ninguno registrado, «Desplegar»; si falló, «Despliegue fallido» con «Reintentar».

Detrás de escena pasan tres cosas que conviene saber al mostrar la demo:

- Si la cuenta de la PyME todavía no existe en el ledger, Vaqcrow **la crea y la fondea** con 2 XLM.
- Vaqcrow **despliega la bóveda** en la fábrica de contratos, firmando con su propia clave de plataforma. La PyME no firma nada en este paso.
- La bóveda queda con la cuenta de la PyME como **destino inmutable** de los fondos, y la campaña se publica en el marketplace.

> [!note] Si el despliegue falla por el tope
> «El objetivo convertido supera el tope vigente por campaña» significa que la meta declarada, convertida, supera el tope configurado. Registrá una solicitud nueva con una meta más chica; el preflight recomienda una meta de demo chica ([[docs/planning/demo-run-preflight|preflight]] §2.1).

## 11. INVERSOR — explorar, abrir la campaña y aportar

1. Abrí `/signup`, elegí **«Soy inversor»** y completá «Nombre completo», correo y contraseña. Confirmá el correo e ingresá en `/login` con «Soy inversor». Vaqcrow te lleva a `/portfolio` («Mi portafolio»).
2. En `/portfolio`, con la **cuenta 2** activa en Freighter, presioná «Conectar Freighter» y firmá el mensaje de verificación.
3. Abrí `/explore` («Explorar PyMEs»): la campaña aprobada aparece en el marketplace. Presioná «Ver evidencia y riesgo» para abrir su detalle en `/campaigns/[id]`. El detalle exige una cuenta: sin sesión vas a ver «Ingresá para ver esta campaña».
4. En el detalle, escribí el monto y presioná **«Aportar a la campaña»**.
5. La primera vez aparece la verificación de identidad del inversor: es **simulada** y se aprueba al continuar con «Aprobar y continuar»[^owner-pending]. No vuelve a pedirse.
6. Se abre la revisión antes de firmar: contrato de la bóveda, función `contribute`, custodia («El contrato de la bóveda, no una persona») y monto. Presioná **«Firmar en Freighter»** y revisá en el popup: **red, cuenta activa, contrato y monto**.

Después de firmar, el aporte muestra **«Enviada · pendiente de confirmación»** hasta que la cadena lo confirma. Enviada no es confirmada: no lo des por hecho antes.

> [!note] Sin wallet conectada
> Si la cuenta no tiene wallet conectada, «Aportar a la campaña» te manda a `/portfolio` para conectarla o crearla.

### 11.1 Los tres estados de la campaña

La interfaz muestra el estado que lee **de la cadena**, no de un estado local:

| En pantalla | Estado | Qué significa |
|---|---|---|
| **Fondeo abierto** | `funding` | Se puede aportar. El plazo no venció y no se alcanzó la meta. Desde `/portfolio` el inversor puede «Retirar mi aporte» |
| **Meta alcanzada** | `settled` | Se alcanzó el objetivo. Los fondos se transfirieron a la PyME en la misma transacción que cruzó la meta |
| **Reembolso disponible** | `refunding` | Venció el plazo sin alcanzar la meta. Desde `/portfolio` el inversor puede «Reembolsar» |

> [!important] Cuando se alcanza la meta, los aportes se cierran de verdad
> Al llegar a **Meta alcanzada**, la interfaz deja de ofrecer el aporte. Y no es sólo cosmético: si alguien intentara aportar igual, **el contrato lo rechaza**. La regla vive en el contrato, no en la pantalla.

> [!important] El reembolso es sin permisos, y eso es una propiedad del contrato
> Si vence el plazo sin alcanzar la meta, cualquiera puede disparar el reembolso, y el dinero vuelve siempre a la dirección registrada del aportante: el contrato fija el destino y no se puede redirigir. Pero **no se dispara solo**: alguien tiene que enviar la transacción, firmando con su propia billetera.

## 12. PyME — declarar ventas y distribuir

Con la campaña en **Meta alcanzada**, la PyME distribuye a los inversores la parte de sus ventas que se comprometió a compartir.

1. Ingresá como PyME (con la **cuenta 1** activa en Freighter) y abrí `/company`. En «Bóveda y distribuciones» está tu campaña.
2. Presioná **«Declarar ventas»**[^owner-pending], cargá las ventas de cada mes (un mes vacío queda «Sin dato», nunca cero; «Completar con datos de ejemplo» llena valores simulados) y presioná «Enviar declaración».
3. Presioná **«Revisar y firmar»**[^owner-pending]. El servicio calcula de forma determinística la obligación del período, sus destinatarios y montos; **la IA no calcula esta obligación**.
4. Revisá el resumen y firmá en Freighter. Verificá en el popup: **red, cuenta activa, destinatarios y montos**.

El estado avanza de firmada a «Enviada · pendiente de confirmación» y recién después a confirmada. «Consultar estado» vuelve a leerlo, y «Ver la transacción en el explorador» abre el hash.

## 13. La evidencia de cada rol

No hay una página pública de evidencia: cada rol ve **sus propias** pruebas en Testnet, y el ADMIN ve la cadena completa por solicitud.

| Rol | Dónde | Qué prueba |
|---|---|---|
| Inversor | `/portfolio` | Por posición: la bóveda con su link al explorador y «Tus transacciones de aporte»[^owner-pending] con el hash de cada aporte. En «Distribuciones», el hash de cada distribución recibida |
| Inversor | `/reports` | «Últimas distribuciones» con su transacción, y «Aportes en el período»[^owner-pending] con hash y bóveda. El CSV exportado incluye los hashes y los links |
| PyME | `/company` | La bóveda con «Ver bóveda en el explorador»[^owner-pending] y, en «Distribuciones», el hash de cada distribución |
| Cualquier cuenta | `/campaigns/[id]` | La fila «Bóveda» del detalle, con su link al explorador |
| ADMIN | `/admin/pymes/[applicationId]/evidence` | La cadena completa: «1 · Solicitud» → «2 · Decisión humana» → «3 · Despliegue de la bóveda» (hash de despliegue y bóveda) → «4 · Aportes» → «5 · Distribuciones» → «6 · Reconciliación» (el último estado guardado; esta vista no consulta la red)[^owner-pending] |

El ADMIN llega a la cadena desde «Evidencia» en la fila de la cola o desde «Ver evidencia Testnet» en la revisión[^owner-pending].

> [!note] «Sin dato» no es cero
> Los aportes y despliegues **anteriores a #438** no guardaron su hash: se muestran «Sin dato», nunca un cero ni un valor inventado. Si una posición mezcla aportes con y sin hash, se avisa con una línea de «aportes anteriores sin hash registrado».

> [!note] Los links al explorador los arma la API
> La web no conoce la red: renderiza el link que le manda la API. En el perfil `local` la API no tiene explorador configurado, así que vas a ver el hash **sin** link. En el entorno hosteado de Testnet los links abren <https://stellar.expert/explorer/testnet>.

Al terminar una ejecución, guardá:

| Qué | Dónde mirarlo |
|---|---|
| Dirección pública y rol de cada cuenta usada | Freighter |
| Hash de despliegue, de cada aporte y de cada distribución | La cadena admin y las vistas de cada rol (tabla de arriba), y el explorador |
| Estado final de cada transacción | El explorador |
| Estado de la campaña al cerrar la demo | Detalle de la campaña o `/company` |
| Capturas de cada firma en Freighter | Evidencia de la demo |

> [!tip] Cada ensayo empieza de cero, sin reiniciar la base
> No se reinicia la base entre ensayos: cada uno crea una solicitud y una campaña nuevas, y la evidencia se lee por esos identificadores. Las cuentas de Testnet son descartables: si querés empezar limpio, creá cuentas nuevas y fondealas con Friendbot.

## 14. Qué NO hacer

- **No pegues una seed ni la frase de recuperación** en ningún formulario, chat, issue, PR ni archivo. Ni siquiera "para probar".
- **No importes una billetera con fondos reales.** Creá una nueva.
- **No uses Mainnet ni otra red.** La demo liquida sólo en Testnet y el código rechaza cualquier otra red por construcción.
- **No subas documentos ni datos reales** de una empresa en el wizard: usá datos sintéticos.
- **No dejes la frase de recuperación en el portapapeles** más tiempo del necesario; limpialo después.
- **No compartas capturas** que muestren la frase de recuperación, aunque el resto de la pantalla sea inocuo.

## 15. Límites honestos de esta demo

Los dejamos por escrito para que nadie los confunda con una falla, ni con una promesa:

- **Es Testnet.** Los activos no tienen valor económico. Un hash de Testnet demuestra ejecución técnica, **no** una inversión real ni disponibilidad en producción.
- **El KYC/KYB de la PyME, la verificación del inversor, el historial de ventas y la conversión ARS/activo son simulados.** Está declarado en pantalla. Las cuentas, los roles y los documentos subidos sí son reales.
- **La IA sólo asesora.** No aprueba, no calcula la obligación de distribución y no mueve fondos.
- **El reembolso requiere enviar una transacción.** Es sin permisos, pero no se dispara solo.
- **La meta la impone el contrato, no la interfaz.** La interfaz sólo deja de ofrecer lo que el contrato ya rechazaría.
- **Una bóveda por solicitud.** La campaña queda ligada a la solicitud que la originó.
- **Lo anterior a #438 queda «Sin dato».** Los hashes de despliegue y de aporte empezaron a guardarse con #438.
- **Mergeado no es verificado de punta a punta.** El flujo por roles y el retiro de las seis rutas están en `main` desde #466 (2026-10-10); ese día se verificó que Railway ya usa la fábrica nueva con tope (`CCDNM6W4…SV7J`; despliegue `3539d681` en `SUCCESS` desde `2b7e0d5`). Falta el smoke test de despliegue de bóveda contra la API hosteada con esa fábrica.

## 16. Referencias

- [Connect to the Testnet — Stellar Docs](https://developers.stellar.org/docs/build/guides/freighter/connect-testnet) — guía oficial de instalación de Freighter y conexión a Testnet.
- [Freighter](https://www.freighter.app) y su [documentación de la API](https://docs.freighter.app/extension-freighter-api/installation.md).
- [Stellar Lab — fondeo de cuentas](https://lab.stellar.org/account/fund) y [creación de cuenta](https://lab.stellar.org/account/create).
- [Stellar Expert — explorador de Testnet](https://stellar.expert/explorer/testnet).
- [Redes de Stellar](https://developers.stellar.org/docs/networks) — Testnet, passphrase y XLM sin valor real.
- [[docs/planning/demo-run-preflight|Preflight de la demo]] — prerrequisitos del operador, variables y pisos de saldo.
- `docs/planning/freighter-and-testnet-account-setup.md` — runbook interno de preparación y lista de seguridad.
- `docs/architecture/stellar-accounts-and-keys.md` — por qué existen dos pares de claves y por qué la cuenta de la PyME se crea al desplegar la bóveda.

[^owner-pending]: Copy sin diseño en el template, pendiente de aprobación del owner: puede cambiar. Incluye «Aprobar y continuar» (verificación del inversor), «Declarar ventas», «Revisar y firmar», «Tus transacciones de aporte», «Aportes en el período», «Ver bóveda en el explorador», «Evidencia», «Ver evidencia Testnet» y los títulos de la cadena admin. Lista completa en `odd/tasks/retire-scripted-journey.md` (WU4, WU5, WU5b y WU7b).

> [!question] Verificación de este documento
> Los enlaces de instalación de Freighter, el comportamiento de Friendbot (exige una dirección `G` o `C`) y la disponibilidad de Stellar Lab y de Horizon se verificaron en vivo el **2026-09-20**. La passphrase de red está fijada en `apps/api/src/application/config/stellar-config.ts` y afirmada por un test.
>
> **Reescrita el 2026-10-10 (#438, WU7b)** para el flujo por roles. Las rutas salen del árbol de `apps/web/src/app` (rama de #438, hoy en `main`); las etiquetas, del código: selector y redirección por rol (`application/auth/auth-form.ts`), wizard (`application/pyme-onboarding/{kyc,registration,ai,review}-step.ts`), conexión de wallet por mensaje firmado (`application/pyme-onboarding/wallet-connection.ts`), consola admin (`application/admin/{admin-guard,queue,kyc,assessment,decision,deployment,evidence}.ts`), detalle y aporte (`presentation/components/campaign-detail/`), retiro y reembolso (`application/portfolio/actions.ts`), estados de la campaña (`application/company/campaign-state.ts`), PyME (`application/company/copy.ts`, `presentation/components/company/`). El despliegue disparado por la aprobación sale de `apps/api/src/application/use-cases/record-human-decision.ts`, y el alta de la cuenta de la PyME con 2 XLM, de `open-campaign.ts`. Ningún paso se ejecutó en vivo para esta reescritura.
>
> **Corregido el 2026-09-25:** una versión anterior de §5 decía que la segunda cuenta tenía su propia frase de recuperación. Es incorrecto. Freighter no genera una frase nueva al agregar una cuenta: la deriva de la frase existente mediante otro índice de derivación, cosa que está confirmada por el comportamiento de la extensión y por el propio código de Freighter, que ancla el cálculo del índice a la mnemónica (`stellar/freighter-mobile#874`) y ofrece agregar cuentas por clave secreta (`stellar/freighter#2208`). El punto se detectó al ejecutar la guía, no al escribirla.
