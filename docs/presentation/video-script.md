# Guion para el video de respaldo — demo TFM

Plan de grabación (shot list) del recorrido por roles, para la brecha **«video de respaldo»** del paquete de evidencia de #33. El video lo graba el **operador**; este documento no es el video, es el plan para grabarlo.

- **Qué demuestra:** los tres workflows por rol de punta a punta sobre las pantallas reales, con lo simulado etiquetado.
- **Fuente del recorrido:** `docs/planning/final-build-and-presentation-freeze-evidence.md` §4 (narrativa por rol) y `docs/planning/DEMO.md` §3 (workflows por rol).
- **Sin objetivo de duración** (la demo no lo tiene). Grabá por escenas; si una falla, cortá y reintentá esa escena.

## Antes de grabar (checklist)

- [ ] **Web arriba:** `https://vaqcrow-web-nine.vercel.app` (o el perfil docker local). API Railway `https://api-production-c07f.up.railway.app` con `/health` en 200.
- [ ] **Freighter** instalada, en red **Testnet**, con cuenta para la PyME y para el inversor.
- [ ] **Admin:** `vaqcrow.admin` (email y contraseña vienen de variables de entorno, nunca del repo).
- [ ] **Cuentas frescas** para PyME e inversor en la corrida (o reusar las del ensayo).
- [ ] **Datos: solo sintéticos.** El banner de demo pide no cargar información real. Nada se resetea (Opción A): cada corrida crea registros frescos.
- [ ] **Pantalla limpia:** cerrá terminal/consola con `.env`, el panel de Supabase y el inspector. **Nunca** mostrar seeds, claves privadas ni tokens.

## Reglas de honestidad (mientras grabás)

1. **No muestres secretos** ni el panel de Supabase.
2. **No afirmes producción.** Usá el lenguaje de los disclaimers («demo», «simulado», «Testnet sin valor económico»).
3. **Un hash de Testnet prueba ejecución técnica, no una inversión real.**
4. **Si algo falla, cortá y reintentá la escena** — nunca edites para simular un éxito que no ocurrió.

## Shot list

| # | Escena | Ruta | Acción | Qué decir / resaltar |
|---|---|---|---|---|
| 1 | **Landing** | `/` | Mostrar la promesa, los disclaimers visibles y el CTA «Quiero financiar mi negocio»; pasar por Explorar/Ingresar | «Demo con datos simulados; activos de Testnet sin valor económico» |
| 2 | **Cuenta e ingreso** | `/signup`, `/login` | Crear una cuenta **PYME** y una **inversor**; mostrar que el toggle «Soy PyME / Soy inversor» **debe coincidir** con el rol (si no, se rechaza) | «Autenticación real (Supabase Auth); el ingreso redirige por rol **verificado**, no por el selector» |
| 3 | **Onboarding PyME (wizard)** | `/company` | Stepper en el lugar: **KYC** (simulado) → **Registro** (subir 3 documentos obligatorios + fotos) → **Evaluación AI** (completitud + banda) → **Revisión humana**: conectar **Freighter** (obligatoria) y **Enviar a revisión** | «Los documentos **se suben de verdad**; la IA **advierte, no bloquea**; sin wallet el envío se bloquea; la clave pública es el destino de la bóveda» |
| 4 | **Admin: revisión y deploy** | `/admin` | Cola de PyMEs → abrir la revisión (contexto, evidencia, recomendación de IA, veredictos por documento) → **aprobar** → ver el **deploy de la bóveda en Testnet** | «La decisión es **humana**; la plataforma firma el deploy; la cuenta de la PyME es el **destino inmutable**» |
| 5 | **Inversor: aporte** | `/explore` → `/campaigns/[id]` → `/portfolio` | Explorar, abrir el detalle, conectar Freighter, modal **«Revisión antes de firmar»** y **firmar el aporte** | «**No custodial**: el inversor firma; Vaqcrow nunca recibe la seed» |
| 6 | **Bóveda en Testnet** | detalle de campaña | Mostrar el **`contractAddress`** y el aporte reflejado | «La custodia es del **contrato**, no de una persona» |
| 7 | **Distribución (revenue share)** | `/company` | Declarar las ventas del mes → ver la **obligación calculada** → **firmar en Freighter** la distribución | «El cálculo es **determinístico** (la IA no calcula); la PyME firma» |
| 8 | **Evidencia por rol** | `/portfolio`, `/reports`, `/company` y `/admin/pymes/[applicationId]/evidence` | Mostrar **hashes** y **enlaces al explorador** en cada rol; el admin ve la **cadena completa** | «Cada rol ve su evidencia; el admin ve decisión, deploy, aportes y distribuciones» |
| 9 | **Cierre** | — | Mostrar el aviso de confianza / los disclaimers | Recitar el encuadre: demo, simulado, Testnet, IA asesora, no apto para producción |

## Cómo se ve «bien» cada escena

- **Escena 3:** después de enviar, «Revisión humana» pasa a amarillo (**En proceso**) y el admin recibe aviso (campana/email).
- **Escena 4:** la aprobación dispara el deploy; el estado del despliegue llega a **`confirmed`** y aparece el `campaignId`.
- **Escena 5:** tras firmar, el estado honesto es **«Enviada · pendiente de confirmación»** (la confirmación es asíncrona; no es instantánea).
- **Escena 8:** guardá una captura de los hashes y del contrato para el paquete (…y una nota de los links al explorador Testnet).

## Al terminar

- Nombrá el archivo, p. ej. `demo-walkthrough-<YYYY-MM-DD>.mp4`. Guardalo junto al paquete (`docs/presentation/evidence/` o storage externo) — **no** lo versiones si es pesado.
- Anotá qué quedó validado y qué sigue abierto (referenciá `docs/planning/demo-rehearsal-and-evidence-packaging-evidence.md` y el freeze #34 §8–§9).
- Los **hashes/contratos** que aparezcan en el video ya están en el paquete (`contribution-run2/3-*.json`); no hace falta transcribirlos a mano.
