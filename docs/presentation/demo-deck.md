---
marp: true
theme: default
paginate: true
size: 16:9
header: 'Vaqcrow · Demo TFM'
footer: 'TESTNET · Activos sin valor económico'
style: |
  :root {
    --brand: #8a05be;
    --brand-hover: #7304a0;
    --brand-tint: #f4e6fa;
    --ink: #1a1620;
    --muted: #6b6472;
    --line: #e7e1ec;
  }
  section {
    font-family: 'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: var(--ink);
    background: #ffffff;
    font-size: 26px;
    padding: 56px 68px;
    letter-spacing: -0.01em;
  }
  section::after {
    color: var(--muted);
    font-size: 15px;
  }
  h1, h2, h3 { letter-spacing: -0.02em; }
  h1 { color: var(--brand); }
  h2 {
    color: var(--brand);
    font-size: 42px;
    border-bottom: 3px solid var(--brand-tint);
    padding-bottom: 12px;
    margin-bottom: 26px;
  }
  h3 { color: var(--ink); font-size: 28px; }
  strong { color: var(--brand-hover); }
  a { color: var(--brand); text-decoration: none; }
  ul { line-height: 1.5; }
  li::marker { color: var(--brand); }
  table { font-size: 21px; width: 100%; }
  th { color: var(--brand); text-align: left; }
  td, th { padding: 7px 10px; border-bottom: 1px solid var(--line); }
  code { background: var(--brand-tint); color: var(--brand-hover); border-radius: 6px; padding: 2px 7px; }
  blockquote {
    border-left: 6px solid var(--brand);
    background: var(--brand-tint);
    color: var(--ink);
    padding: 14px 22px;
    border-radius: 0 10px 10px 0;
    font-size: 22px;
  }
  section.lead {
    background: linear-gradient(135deg, #2a0a37 0%, #8a05be 100%);
    color: #ffffff;
    text-align: center;
    justify-content: center;
  }
  section.lead h1 { color: #ffffff; font-size: 74px; margin: 0; }
  section.lead h2 { color: #ffffff; border: 0; }
  section.lead p { color: #f4e6fa; font-size: 26px; }
  section.lead strong { color: #ffffff; }
  section.badge h2 { border: 0; }
  .pill {
    display: inline-block;
    background: rgba(255,255,255,0.16);
    color: #fff;
    border: 1px solid rgba(255,255,255,0.45);
    border-radius: 999px;
    padding: 6px 18px;
    font-size: 18px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .muted { color: var(--muted); font-size: 20px; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
  .card {
    border: 1px solid var(--line);
    border-top: 4px solid var(--brand);
    border-radius: 12px;
    padding: 16px 20px;
    font-size: 22px;
  }
  .linkedin p { display: flex; align-items: center; gap: 16px; font-size: 28px; margin-top: 28px; }
  .ok  { color: #137a3f; font-weight: 700; }
  .sim { color: #7a4b00; font-weight: 700; }
  .warn { color: #b00020; font-weight: 700; }
---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

![w:110](../../apps/web/public/vaqcrow-isotipo.png)

# Vaqcrow

**Financiamiento por revenue share para PyMEs argentinas**

**Reynaldo Ariel Duarte**

Trabajo Fin de Máster · Máster en Desarrollo con IA E.2 · BIG school

<span class="pill">Stellar Testnet · sin valor económico</span>

---

## Quién soy

### Reynaldo Ariel Duarte

Ingeniero de software con **más de 16 años** de experiencia en desarrollo de software, incluidos **más de 5 años** construyendo **sistemas financieros orientados al cumplimiento normativo** en una fintech regulada de Estados Unidos (*broker-dealer* y *ATS*), en mercados de capital privado.

<div class="linkedin">

![w:44](assets/linkedin.svg) [linkedin.com/in/arielduarte](https://www.linkedin.com/in/arielduarte)

</div>

---

## Un poco de historia

La idea nace de mi paso por una **fintech de Nueva York** que hacía crecer empresas del mercado primario y secundario usando el **crowdfunding** como instrumento financiero. Ahí desarrollé plataformas de inversión con el mecanismo de financiamiento tradicional (dinero *fiat*), hasta que llegó la era de las inversiones con **criptomonedas** y el mercado me llevó a entender y desarrollar en **Web3**.

Descubrí la **tokenización de activos** sobre la red de **Ethereum** y aprendí a llevarla al mundo real. Con ese trabajo vi lo fácil que podía ser **digitalizar activos**, crear campañas para buscar financiamiento **sin tanta burocracia** y, sobre todo, **llegar a inversores** a los que les encantan las criptomonedas.

> Así nace **Vaqcrow**, pensado para **Argentina**.

---

## ¿Por qué Argentina?

<style scoped>
ol { font-size: 24px; line-height: 1.45; }
.muted { font-size: 15px; }
</style>

1. **Burocracia y poco financiamiento.** Entre la alta burocracia de los bancos tradicionales y la falta de crédito, solo entre enero de 2020 y enero de 2023 Argentina perdió **unas 12.000 MiPyMEs registradas**, sin contar los pequeños emprendimientos de barrio.
2. **Inflación y criptomonedas.** La inflación convirtió a Argentina en uno de los **mercados cripto más importantes de América Latina** —primera de la región por adopción según Chainalysis— y acercó las billeteras virtuales a la sociedad.
3. **Un marco que avanza.** Con el gobierno actual, la **Ley 27.739** (2024) creó el registro de proveedores de servicios de activos virtuales en la **CNV**, reglamentado en 2025. Más reglas claras dan más libertad para financiarse e invertir, y esperamos que Vaqcrow tenga **un lugarcito** en ese mercado.

<div class="muted">Fuentes: IERAL (Fundación Mediterránea) con datos de AFIP, vía <a href="https://www.elheraldo.com.ar/noticias/economia/cerraron-12000-empresas-en-los-ultimos-tres-anos-con-un-promedio-de-80-por-semana">El Heraldo</a> · Chainalysis, vía <a href="https://www.forbesargentina.com/money/argentina-lider-regional-adopcion-criptomonedas-porque-avanza-revolucion-digital-america-latina-n78387">Forbes Argentina</a> y <a href="https://cointelegraph.com/news/argentina-leads-latin-america-crypto-inflows">Cointelegraph</a> · Ley 27.739 y <a href="https://www.boletinoficial.gob.ar/detalleAviso/primera/322539/20250314">RG CNV 1058/2025</a>.</div>

---

## Qué van a ver

1. **La propuesta** — revenue share en lugar de cuotas fijas
2. **El alcance real** — qué es real y qué está simulado
3. **La arquitectura** — web, API, Supabase y Stellar
4. **Los tres roles** — PyME · inversor · administrador
5. **Stellar** — la bóveda custodia los aportes
6. **El revenue share** — cómo vuelve el capital y dónde termina
7. **La IA** — central, explicable y acotada, y el asistente de ayuda
8. **Cómo se construyó** — agentes de IA con gentle-ai y ODD
9. **Qué se validó** — evidencia y ensayo end-to-end
10. **Lo que queda abierto** — límites y decisiones de producción

<div class="muted">Una demo honesta: muestra el recorrido sin ocultar qué es simulado.</div>

---

## La propuesta

**La PyME se financia sin cuotas fijas ni intereses asfixiantes.** Quienes aportan capital reciben una **participación contractual en las ventas**: la obligación acompaña el desempeño del negocio.

- **Revenue share** para comercios de barrio y PyMEs argentinas.
- **IA asesora** que transforma evidencia en una recomendación auditable.
- **Aprobación humana** que nunca delega la decisión final.
- **Stellar** para custodia y liquidación verificables.
- **No custodial, siempre:** Vaqcrow nunca custodia claves ni recibe o mueve dinero de terceros.

> El producto es **role-based** (`PYME` / `INVERSOR` / `ADMIN`), con la forma exacta del template de diseño.

---

## Qué debe quedar probado

- Los **tres workflows por rol** funcionan de punta a punta, con **cuentas reales** y sin ocultar lo simulado.
- La **IA es central y real**: evaluación estructurada, evidencia, incertidumbre y alertas.
- **Freighter** es la interfaz de firma: la persona conserva sus claves; Vaqcrow nunca recibe la seed.
- Al menos un **fondeo y una distribución** confirmados en **Stellar Testnet**, con evidencia en el explorador.
- Cada **simulación** está identificada y tiene una interfaz de integración de producción creíble.
- Quien presenta puede explicar **qué se validó y qué sigue abierto**.

<div class="muted">Fuente: docs/planning/DEMO.md §2 · «Qué debe quedar probado ante el tribunal evaluador».</div>

---

## Alcance: qué es real y qué se simula

<style scoped>
table { font-size: 18px; }
td, th { padding: 4px 10px; }
</style>

<table>
<tr><th>Capacidad</th><th>En la demo</th></tr>
<tr><td>Cuentas, sesión y roles</td><td><span class="ok">Real</span> — Supabase Auth, roles y RLS</td></tr>
<tr><td>Documentos y fotos de la PyME</td><td><span class="ok">Real</span> — subida a bucket privado</td></tr>
<tr><td>KYC/KYB (PyME e inversor)</td><td><span class="sim">Simulado</span> detrás de un adaptador</td></tr>
<tr><td>Ventas históricas y feed mensual</td><td><span class="sim">Simulado</span>, reproducible, con anomalía</td></tr>
<tr><td>IA (completitud y riesgo)</td><td><span class="ok">Real</span> — proveedor LLM tras un adaptador</td></tr>
<tr><td>Corredor ARS ↔ activo Stellar</td><td><span class="sim">Simulado</span></td></tr>
<tr><td>Wallet y firma</td><td><span class="ok">Real</span> — Freighter, no custodial</td></tr>
<tr><td>Fondeo y distribución</td><td><span class="ok">Real en Testnet</span>, sin valor económico</td></tr>
<tr><td>Cálculo de revenue share</td><td><span class="ok">Real y determinístico</span> — el LLM no calcula</td></tr>
<tr><td>Saldo de la wallet</td><td><span class="ok">Real</span> — leído de Horizon · su equivalente en ARS es <span class="sim">simulado</span></td></tr>
<tr><td>Blog y asistente de ayuda</td><td><span class="ok">Real</span> — artículos por PR y un LLM anclado a una wiki</td></tr>
</table>

---

## Arquitectura

<style scoped>
.card { font-size: 20px; padding: 12px 18px; }
ul { font-size: 23px; line-height: 1.4; }
</style>

**Monorepo** (pnpm + Turborepo) con límites verificados por `dependency-cruiser`:

<div class="two">
<div class="card">

**Web** — Next.js · Vercel
Navegador + Freighter

**API** — Fastify · Railway
Dominio, autorización por rol, IA, cálculo, verificación XDR

</div>
<div class="card">

**Supabase** — Auth · PostgreSQL (RLS) · Storage privado

**Stellar Testnet** — Soroban RPC · Horizon · contratos Rust

**Externos** — proveedor LLM · Resend (email)

**`docs/` en la imagen de la API** — Blog y wiki del asistente

</div>
</div>

- `packages/domain` y `packages/contracts` framework-free y portables.
- `apps/web` y `apps/api` totalmente aislados entre sí.
- La **cadena** es la fuente de verdad del dinero; Supabase es su espejo.

---

## Los tres roles

<style scoped>
table { font-size: 19px; }
td, th { padding: 5px 10px; }
ul { font-size: 23px; line-height: 1.4; }
.muted { font-size: 17px; }
</style>

| Rol | Rutas | Qué hace |
|---|---|---|
| **PyME** | `/company` | Registra su empresa, sube documentos, conecta Freighter y declara ventas |
| **Inversor** | `/explore`, `/campaigns/[id]`, `/portfolio`, `/reports` | Explora PyMEs, aporta firmando en Freighter, retira antes de la meta y cobra el revenue share |
| **Admin** | `/admin` | Cola de PyMEs, revisión humana con decisión registrada y deploy de la bóveda |

- **Rutas siempre en inglés**; la UI en español.
- El ingreso redirige por **rol verificado**, no por el selector del formulario.
- Landing, Explorar, el **detalle de PyME** (compartible por link), Blog, guías y ayuda son **públicos**; aportar exige cuenta.

<div class="muted">Rutas reales en <code>main</code>: <code>/</code>, <code>/signup</code>, <code>/login</code>, <code>/explore</code>, <code>/campaigns/[id]</code>, <code>/blog</code>, <code>/help</code>, <code>/portfolio</code>, <code>/reports</code>, <code>/company</code>, <code>/admin</code>.</div>

---

## Flujo de la PyME

Un **panel** (`/company`) más **un único wizard**, con el stepper en el lugar (sin una ruta por paso):

1. **KYC** — simulado.
2. **Registro PyME** — datos, **destino de los fondos** y **subida real** de 3 documentos obligatorios + hasta 4 fotos.
3. **Evaluación AI** — chequeo de **completitud** (reglas deterministas + relevancia por contenido con visión) y banda de riesgo. **Advierte, no bloquea.**
4. **Revisión humana** — la PyME conecta Freighter (**obligatorio**: su clave pública es el destino de la bóveda) y aprieta **«Enviar a revisión»**.

> Sin wallet, el envío se bloquea (`409`). Con wallet, el admin recibe el aviso por email y campana, y la PyME puede abrir **«Ver lo enviado»**.

---

## Flujo del admin y del inversor

<div class="two">
<div class="card">

### Admin

Cola de PyMEs → **revisión** (chequeos por documento, recomendación de IA, decisión humana con actor, razones y timestamp) → **aprobar** dispara el deploy de la bóveda.

- La plataforma firma `factory.deploy()`
- La cuenta de la PyME es **destino inmutable**
- Al aprobar, la PyME se publica en el marketplace

</div>
<div class="card">

### Inversor

Explorar → detalle → **Aportar**.

- Sin wallet, «Aportar» redirige a `/portfolio` para conectar Freighter
- Modal **«Revisión antes de firmar»** y firma de la invocación
- KYC del inversor **simulado y auto-aprobado** en el primer aporte
- Nadie aporta más del **10 % de la meta** ni más de **lo que falta** para alcanzarla
- Retiro permitido mientras la campaña siga abierta

</div>
</div>

---

## Stellar: la bóveda de contrato

El fondeo lo **custodia un contrato** (Rust + `soroban-sdk`), una bóveda por campaña.

- **Destino inmutable**: el contrato sólo puede pagar a la cuenta de la PyME fijada al abrir la bóveda.
- **Tope por inversor**: nadie puede tener más del 10 % de la meta; lo aplica el contrato.
- **Meta on-chain**: el contrato la evalúa sobre el ledger; al alcanzarla, **liquida en la misma transacción** (atómico, sin recuperación ni clawback).
- **Reembolso permissionless**: si vence sin alcanzar la meta, cualquiera puede dispararlo — el destino ya está fijado.
- La **plataforma firma** el deploy y el `CreateAccount`; el **usuario firma** aportes, retiros y reembolsos con Freighter.

> Claimable Balance (CAP‑23) se evaluó y **se descartó**: no puede expresar «objetivo alcanzado» on-chain.

---

## El revenue share: cómo vuelve el capital

Con la meta alcanzada y el capital en la cuenta de la PyME, **cada mes**:

1. La PyME **declara sus ventas** (sintéticas en la demo).
2. El sistema calcula el **4,5 %** de esas ventas y lo reparte **en proporción a cada aporte** (regla versionada `RS-2026-02`).
3. La plataforma arma **un pago por inversor** y la PyME lo **firma en Freighter**.

- **El acuerdo tiene un final:** cada inversor cobra hasta **1,5 veces lo que aportó**; cuando todos llegan, termina.
- Si la PyME vende menos, ese mes se reparte menos: no hay cuota fija.
- **No está en el contrato:** son pagos clásicos de Stellar. La IA no participa del cálculo.

> El **plazo máximo** del acuerdo (3 a 5 años en este tipo de financiamiento) **no está implementado** en la demo.

---

## IA: central, explicable y limitada

La IA trata el contenido subido como **no confiable** y corre en **dos pasos**: completitud y riesgo.

- **No inventa** datos, no completa faltantes, no presenta inferencias como hechos.
- **No aprueba**, no firma, no construye decisiones finales, **no transfiere fondos**.
- **No calcula** montos, porcentajes ni obligaciones: eso es determinístico y se prueba fuera del LLM.
- Toda recomendación muestra **evidencia, incertidumbre, modelo/prompt** y la aprobación o rechazo humano.
- Ante timeout o salida inválida → el caso deriva a **revisión manual**, nunca a aprobación automática.

> Salida con **esquema estricto**: si cita mal o falta evidencia, se rechaza y pasa a revisión manual.

---

## Blog y asistente de ayuda

**Blog** público con seis artículos en `docs/guides/blog/`, escritos y revisados por PR.

**Asistente** anclado a una **wiki compilada** (`docs/wiki/`), con el método *LLM Wiki* de Karpathy y **sin embeddings**:

- Dos pasos: un **router** que sólo ve el índice elige páginas; la **respuesta** sólo ve esas páginas y las cita.
- **Sin documento, no hay respuesta:** fuera de tema declina y, si ninguna página cubre la pregunta, lo dice.
- La pregunta y la wiki son **datos no confiables**; el código valida páginas, citas y formato.
- Sólo PyME e inversor, **habilitados por un admin**, hasta **5 preguntas cada 24 h**; no se guarda el texto.

---

## Cómo se construyó

Vaqcrow se desarrolló **dirigiendo agentes de IA** —Claude Code y OpenCode— configurados con **gentle-ai**:

- **ODD** (*Organic Driven Development*): explorar antes de cambiar, **tests primero** y un documento por feature que cita textual cada pedido. Más de **110** en `odd/tasks/`.
- **Engram:** memoria persistente entre sesiones.
- **Skills** por tecnología (Supabase, HeroUI, Stellar, OWASP) antes de tocar código.
- **Revisión por riesgo** y un **documento de evidencia** por cada Feature cerrada.

> La persona dirige: el agente explora, propone y ejecuta; las decisiones de producto se preguntan de a una.

---

## No custodial: quién firma qué

| Firma | Quién | Para qué |
|---|---|---|
| `factory.deploy()` | **Plataforma** | Desplegar la bóveda al aprobar el admin |
| `CreateAccount` de la PyME | **Plataforma** | Crear la cuenta destino en Testnet |
| Aporte / retiro / reembolso | **Persona usuaria** | Invocación de la bóveda en **Freighter** |
| Distribución de revenue share | **PyME** | La transacción que la plataforma construyó |

**Vaqcrow nunca custodia claves ni recibe o mueve dinero de terceros (ARS o cripto).** La seed nunca sale del navegador.

<div class="muted">El único punto de uso de <code>STELLAR_PLATFORM_SECRET_KEY</code> es <code>platform-signer.ts</code>.</div>

---

## Motor reutilizado y cálculo determinístico

Los pasos del motor no cambian de naturaleza al pasar a roles:

- Evaluación real de IA con **esquema validado**.
- **Aprobación humana** con auditoría inmutable e idempotencia.
- **Bóveda** con custodia y liquidación atómica.
- Confirmación **asíncrona**: `submitted` → `confirmed` / `failed`.
- **Cálculo determinístico** del revenue share, con **enteros** y reglas versionadas.
- Distribución real en Testnet, **firmada con Freighter**, con hashes y enlaces al explorador.

> En una misma sesión se probaron tres corridas del flujo de aporte **invisibles para los tests determinísticos** y se corrigieron en el camino.

---

## Qué se validó

- **Ensayo hosteado end-to-end, 3/3 en verde** contra el stack desplegado (Railway API + Supabase remoto + Testnet): **deploy de bóveda confirmado** + **aporte firmado `success`**.
- **Corpus de evidencia:** 57 documentos `docs/planning/*-evidence.md` (uno por Feature cerrada).
- **Gates de CI:** `pnpm run verify` (lint + typecheck + test + build + boundaries), Playwright por rol y compilación/prueba/deploy de los contratos Rust en red local.
- **462 archivos de test** (6.888 casos, medido el 2026-10-17) unitarios y de componentes, con dobles locales — sin depender de Testnet, Horizon ni el LLM vivo.

<div class="muted">Los verificadores vivos (ensayo hosteado, e2e en vivo) son <strong>opt-in</strong>: nunca corren en <code>verify</code> ni en CI. Ensayo: <code>scripts/demo/rehearsal/hosted-rehearsal.mjs</code>.</div>

---

## Decisiones de producción abiertas

| Decisión | Estado |
|---|---|
| Clasificación jurídica del instrumento | **Abierta** — requiere asesoría argentina por escrito |
| Regulación / AML / KYC real | **Abierta** — el KYC/KYB de la demo es simulado |
| Corredor ARS ↔ activo Stellar | **No validado** — P0 abierto |
| Privacidad y datos personales | **Abierta** |
| Verificación de ventas y cobranza reales | **Abierta** |
| Auditoría y controles de emergencia del contrato | La bóveda **no está auditada, no es actualizable y no tiene pausa** |
| Token propio | **No emitir en el MVP** |
| Plazo máximo del revenue share | **No implementado** en la demo |
| Dominio propio para la web | **Resuelto:** `www.vaqcrow.com` |

---

## Límites honestos

- **Sin corrida cronometrada end-to-end.** El recorrido completo por navegador contra producción nunca se cronometró; la latencia del LLM es alta e impredecible (93,79 s medidos). **No hay un objetivo de duración.**
- **El e2e en vivo no se observó en verde** en la sesión del congelamiento: es un defecto del **entorno local degradado**, no del producto; su historial verde se cita.
- **Asistente:** una pregunta, una respuesta, **sin streaming**; cada cuenta lo habilita un admin.
- **Tope «lo que falta para la meta»:** lo aplica Vaqcrow antes de la firma, no el contrato.
- **Reset de Testnet del 2026‑12‑16:** invalida las direcciones de contrato; obliga a redesplegar la fábrica y reapuntar `STELLAR_CAMPAIGN_FACTORY_ID`.

---

## Disclaimers

> **Demostración con datos simulados.** El KYC/KYB, el historial de ventas y la conversión ARS/activo Stellar son simulados. Las cuentas son reales, pero no representan una verificación de identidad ni movimientos de dinero real.

> **Stellar Testnet.** Las transacciones mostradas usan activos sin valor económico en Stellar Testnet. Un hash de Testnet demuestra ejecución técnica, no una inversión real ni disponibilidad en producción.

> **Firma no custodial.** Freighter es la wallet e interfaz de firma. La persona usuaria conserva sus claves; Vaqcrow construye y verifica la transacción y nunca recibe su seed.

---

## Disclaimers (cont.)

> **Custodia por contrato.** Durante la campaña, los aportes los custodia el contrato, no una persona: nadie tiene una clave para moverlos. El contrato sólo puede pagar al destino fijo definido al abrir la bóveda, y ese destino es inmutable. La meta la evalúa el contrato sobre el ledger y, al alcanzarla, liquida a la PyME en la misma transacción. No hay recuperación ni clawback: no existe forma de revertir un pago ya liquidado, y los fondos que nadie reclame sólo pueden salir por el barrido; si no, pueden quedarse en el contrato. El reembolso por vencimiento no se dispara solo: exige que alguien envíe la transacción, y es permissionless porque el destino ya está fijado.

> **Aportes por encima de la meta.** Ningún aporte puede superar lo que falta para alcanzar la meta: si faltan 50 XLM, el formulario no acepta más que eso. El aporte que la superaría se rechaza antes de firmarse y no mueve fondos. Este tope lo aplica Vaqcrow, no el contrato: quien firme directamente contra la bóveda todavía puede exceder la meta.

---

## Disclaimers (cont.)

> **IA con supervisión humana.** La IA organiza evidencia, identifica anomalías y propone una evaluación explicable. No inventa datos, no toma la decisión final, no calcula obligaciones financieras y no transfiere fondos.

> **No apto para producción.** Esta demo no constituye una oferta de inversión, recomendación financiera, aprobación regulatoria ni prueba de legalidad, rentabilidad, solvencia, custodia, calidad de proveedores u operación en Argentina.

<div class="muted">Copia canónica y machine-checked en <code>apps/web/src/application/trust/disclosures.ts</code>.</div>

---

<!-- _class: lead -->
<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _footer: '' -->

# Gracias

**Vaqcrow** — _«Juntos podemos hacernos grandes»_

Reynaldo Ariel Duarte · Trabajo Fin de Máster · Máster en Desarrollo con IA E.2 · BIG school

<span class="pill">Stellar Testnet · sin valor económico</span>
