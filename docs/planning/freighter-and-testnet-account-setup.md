# Preparación de Freighter y una cuenta Testnet

> [!info] Para qué sirve este documento
> Es el camino operativo para dejar lista la billetera y la cuenta descartable de Stellar **Testnet** que exige la demo. No explica la arquitectura: explica qué hacer, en qué orden, y qué se verifica en cada paso.

## 1. Qué desbloquea

| Si esto queda listo… | …entonces se puede |
|---|---|
| Freighter instalado, habilitado y en Testnet, con una cuenta descartable fondeada | Cumplir la condición 2 del *Definition of ready* antes de [#74](https://github.com/reyduar/Vaqcrow/issues/74) (`stellar-blockchain-requirements.md`, Parte 3 §3.a) |
| La cuenta descartable y su dirección pública registradas | Correr el *preflight* manual acotado en Testnet (`stellar-blockchain-requirements.md`, Parte 3 §1.b) |
| La lista de seguridad firmada | Cerrar la condición 6 del mismo gate, y aportar la evidencia que pide [#76](https://github.com/reyduar/Vaqcrow/issues/76) |

Sin esto, el *bounded Testnet check* que la estrategia de pruebas de [#23](https://github.com/reyduar/Vaqcrow/issues/23) pide **no se puede ejecutar**, y la evidencia tiene que declararlo como limitación externa en lugar de como resultado observado.

## 2. El principio que no se negocia

> [!warning] Vaqcrow nunca pide tu seed
> Vaqcrow solicita y muestra **únicamente direcciones públicas** (las que empiezan con `G`). Nunca pide, recibe, copia ni muestra la frase de recuperación, la seed ni la clave privada.
>
> Freighter es una billetera e interfaz de firma, **no un custodio**. Vos conservás tus claves; Vaqcrow prepara y verifica la transacción, y vos la revisás y la firmás dentro de Freighter.
>
> **Si en algún momento algo te pide la frase de recuperación para esta demo, está mal.** Frená y avisá.

## 3. Herramientas: comprobar, no instalar a ciegas

Estas órdenes son de solo lectura. Si alguna falla, resolvé ese requisito antes de seguir.

```bash
command -v git && git --version
command -v node && node --version
command -v pnpm && pnpm --version
```

> [!important] Node tiene que ser 24
> Este repositorio fija `engines.node` en `>=24.0.0 <25.0.0` y activa `engine-strict`, así que **`pnpm install` falla con cualquier otra versión** — incluso una más nueva. Verificá que `node --version` imprima `v24.x`.
>
> Si el `node` del sistema es otro, cambiá de versión solo para esta terminal:
>
> ```bash
> export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"
> node --version   # tiene que imprimir v24.21.0
> ```
>
> En este equipo el `node` global es v26, así que ese `export` es necesario en cada terminal nueva. Un `pnpm install` con la versión equivocada se corta con `Your Node version is incompatible`; no es un problema del repositorio.

Versión de pnpm esperada: `11.27.0` (fijada en `packageManager`).

## 4. Instalar Freighter

Instalá la extensión **solo** desde sus enlaces oficiales, en **Chrome, Brave o Firefox**:

| Navegador | Enlace oficial |
|---|---|
| Chrome o Brave | [Chrome Web Store](https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/freighter/) |

Verificá que la extensión se abra y aparezca **habilitada**. Una orden de terminal no demuestra de forma fiable que una extensión esté instalada y autorizada: eso se mira en el navegador.

## 5. Crear la cuenta descartable de Testnet

1. Creá una **billetera nueva y descartable, exclusiva para Testnet**. No importes una cuenta que custodie fondos reales.
2. Guardá la frase de recuperación **fuera del repositorio** (papel, gestor de contraseñas). Nunca en un archivo versionado, ni en un `.env`, ni en una captura.
3. Seleccioná **Testnet** en Freighter.
4. Verificá **visualmente** la red y la dirección pública activa antes de fondear o firmar. Si Freighter dice `PUBLIC` o cualquier otra red, cambiá a Testnet ahora.

> [!tip] Cuentas separadas por rol
> Cuando resulte práctico, usá cuentas descartables separadas para los roles de **inversor**, **PyME** y **distribución**. La separación reduce errores de guion y hace visible quién autoriza cada operación.

## 6. Fondear con XLM de prueba

Solo XLM de Testnet, que **no tiene valor económico**. Dos caminos:

**Opción A — Stellar Lab (visual):** abrí <https://lab.stellar.org/account/fund>, pegá tu **dirección pública** y fondeá.

**Opción B — Friendbot (por API):**

```bash
# Reemplazá por TU dirección pública (empieza con G). Nunca una seed.
curl "https://friendbot.stellar.org?addr=TU_DIRECCION_PUBLICA_G..."
```

> [!important] Friendbot quiere una dirección pública, y lo dice él mismo
> Verificado el **2026-09-20**: pedirle a `https://friendbot.stellar.org` sin `addr` devuelve `400` con el detalle `invalid address: must be a valid G or C address`. Es decir, el propio servicio exige una dirección **G** (pública) o **C** (contrato). No existe ningún camino en el que una seed haga falta acá.

Comprobá que llegó el saldo: la cuenta debería mostrar XLM en Freighter y existir en el explorador.

## 7. Verificar la red desde la integración

Antes de cualquier firma de demostración, confirmá que lo que ve Vaqcrow coincide con lo que ves vos:

| Verificación | Valor esperado |
|---|---|
| `getAddress()` | La misma dirección pública que muestra Freighter |
| `getNetwork()` | `TESTNET` |
| Passphrase de red | `Test SDF Network ; September 2015` |
| Horizon | `https://horizon-testnet.stellar.org` |

> [!note] Esa passphrase está fijada en el código
> La constante vive en `apps/api/src/application/config/stellar-config.ts` y un test la afirma igual a `Networks.TESTNET` del SDK. Si algún día difiere, las firmas se construirían para una red que no existe.

## 8. Lista de seguridad

Firmá esta lista cuando todos los ítems sean verdaderos. Es la condición 6 del gate.

- [ ] Todas las cuentas y billeteras usadas por la demo son **descartables y exclusivas de Testnet**.
- [ ] Ninguna cuenta de demo contiene fondos reales y ninguna operación apunta a Public Network.
- [ ] Ninguna seed, frase de recuperación ni clave privada aparece en el repositorio, archivos `.env`, logs, fixtures, historial de terminal ni entradas de la aplicación.
- [ ] Vaqcrow y sus formularios solicitan **únicamente direcciones públicas**; nunca solicitan secretos de billetera.
- [ ] La red y la passphrase se declaran de forma explícita al construir, decodificar, verificar y solicitar la firma de una transacción.
- [ ] La dirección pública y la red activa se vuelven a verificar **antes de cada firma** de demostración.
- [ ] Cuando sea práctico, inversor, PyME y distribución usan cuentas descartables separadas.

## 9. Registro y rotación

Al terminar cada ejecución de la demo, registrá:

| Qué | Dónde |
|---|---|
| Dirección pública y rol de cada cuenta usada | Registro de evidencia |
| Hash de cada transacción, con enlace al explorador de Stellar Lab | Registro de evidencia |
| Estado final de cada transacción (`completed` / `failed`) | Registro de evidencia |
| Capturas de Freighter en cada firma | Directorio de evidencia de la demo |
| Log de cada intento de *polling* de Horizon, con timestamps | Logs de la aplicación |

**Rotación:** las cuentas de Testnet son descartables y no se reutilizan entre demos sin un reinicio explícito. Después de cada demo, fondeá cuentas nuevas con Friendbot para la siguiente ejecución. Las anteriores no se borran (Testnet no lo requiere), pero se registran como inactivas.

Si una cuenta descartable acumuló fondos reales por error, documentá el incidente y descartá la cuenta.

## 10. Qué NO hacer

- **No pegues una seed en ningún formulario, chat, issue, PR ni archivo.** Ni siquiera "para probar".
- **No importes una billetera con fondos reales.** Creá una nueva.
- **No uses Mainnet ni otra red.** La demo liquida solo en Testnet y el código rechaza cualquier otra red por construcción.
- **No dejes la frase de recuperación en el portapapeles** más tiempo del necesario; limpialo después.
- **No compartas capturas que muestren la frase de recuperación**, aunque el resto de la pantalla sea inocuo.

## 11. Referencias

- [Instalación de Freighter](https://docs.freighter.app/extension-freighter-api/installation.md) y [sitio oficial](https://www.freighter.app) — enlaces oficiales y navegadores soportados.
- [Conexión](https://docs.freighter.app/extension-freighter-api/connecting.md), [lectura de dirección y red](https://docs.freighter.app/extension-freighter-api/reading-data.md) y [firma](https://docs.freighter.app/extension-freighter-api/signing.md) — el contrato de la API que usa el adaptador.
- [Redes de Stellar](https://developers.stellar.org/docs/networks) y [fondeo de cuentas en Stellar Lab](https://developers.stellar.org/docs/tools/lab/account) — Testnet, passphrase y XLM sin valor real.
- `docs/planning/stellar-blockchain-requirements.md` — Parte 2 §2, §3, §4 y §8 son la fuente de este runbook; Parte 3 §1.b y §3.a son lo que desbloquea.
- `odd/tasks/stellar-and-freighter-integration.md` — la bitácora de la Feature #23, incluido el aviso A5 sobre el *bounded Testnet check*.

> [!question] Verificación de este documento
> Los enlaces de instalación de Freighter se verificaron el **2026-09-20** contra `docs.freighter.app`. El comportamiento de Friendbot (`400`, exige dirección `G` o `C`) y la disponibilidad de `lab.stellar.org/account/fund` y `horizon-testnet.stellar.org` se comprobaron en vivo esa misma fecha. Las constantes de red provienen del código y están afirmadas por un test.
