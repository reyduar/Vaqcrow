# Evidencia de cierre de la Feature #418 — Issue #421

> Documento de cierre de Feature. Consolida la evidencia de las Tasks [#419](https://github.com/reyduar/Vaqcrow/issues/419) (implementar), [#420](https://github.com/reyduar/Vaqcrow/issues/420) (probar) y [#421](https://github.com/reyduar/Vaqcrow/issues/421) (documentar) de la Feature [#418](https://github.com/reyduar/Vaqcrow/issues/418) («Feature: Build the public landing page», Epic [#373](https://github.com/reyduar/Vaqcrow/issues/373)); mapea cada criterio de aceptación de la Feature, **citado textualmente**, a su resultado y a la fuente de ese resultado; y registra las decisiones del owner del **2026-10-10** que reemplazan el comportamiento *descrito* en el issue, para que este documento no contradiga la evidencia. La bitácora de iteración que lo alimenta es [[odd/tasks/public-landing-page|Bitácora: landing pública]].

> [!warning] Estado de entrega: nada de #418 está en `main`
> El trabajo vive en la rama `Vaqcrow#418_Feat_Build_the_public_landing_page`, creada desde `main` (`afede2c`). La rama **no está mergeada** y **todavía no hay PR**. En `main`, `/` sigue siendo el esqueleto (`<AppShell><h1 className="sr-only">Vaqcrow</h1></AppShell>`); este documento **no** reporta un estado mergeado ni un resultado de CI de una PR que no existe.

## 1. Contexto y objetivo

La Feature #418 entrega la landing pública en `/`: la primera pantalla que ve tanto el inversor como la PyME, fiel al template de Claude Design (`Vaqcrow Landing.dc.html`, la fuente de verdad visual). La consigna del owner fue desarrollar la sección tal cual el template, sin simplificar; los enlaces a páginas que todavía no existen se muestran a propósito (un 404 es aceptado) como recordatorio de las guías pendientes.

Se entregó en cuatro work units (WU) sobre una sola rama de Feature —convención del repo de un PR por Feature, rebanado por commits de WU—:

| WU | Qué entrega | Commit |
|---|---|---|
| WU1 | Shell full-bleed, ancla del header en español y secciones estáticas (hero, franja de garantías, «Cómo funciona», «Qué es real y qué es simulado») | `d60d3ef` |
| WU2 | Campaña destacada (real o ejemplo simulado) y grilla «PyMEs en campaña» desde el listado público | `84ebf4b` |
| WU3 | Footer rico de la landing | `8f2bfa8` |
| WU4 | Asistente flotante «Ayuda» | `8536a77` |

El cierre de la Feature y de sus Tasks lo decide el owner. La Feature cuelga de la Epic [#373](https://github.com/reyduar/Vaqcrow/issues/373) (sitio público).

## 2. Cómo leer esta evidencia

- **Dos fuentes, siempre nombradas.** (a) **Bitácora** — una entrada por work unit en [[odd/tasks/public-landing-page|`odd/tasks/public-landing-page.md`]], con su commit, sus resultados RED→GREEN y la verificación independiente; se **cita**, no se re-ejecutó. (b) **Gate re-ejecutado por el orquestador** el 2026-10-10 sobre esta rama: sus números son los observados ahí (§4).
- **Dobles, no proveedores.** Ninguna prueba de esta Feature habla con Testnet, Horizon, RPC de Soroban, el LLM, Resend ni el Supabase remoto. El listado público se consume con dobles locales; las pruebas determinísticas no dependen de servicios externos.
- **Sin secretos ni claims de producción.** Ningún email, contraseña, seed, clave ni token aparece aquí. Todo corre sobre Testnet, sin valor económico; un hash de Testnet demuestra ejecución técnica, no una inversión real.

## 3. Qué quedó implementado

Toda la superficie es frontend (`apps/web`); no hay migraciones. Fuente: bitácora (WU1–WU4, 2026-10-10) y lectura del código en la rama.

### 3.1 Shell y ancla del header (WU1)

- **`apps/web/src/presentation/components/app-shell.tsx`** gana la variante `fullBleed` (quita el contenedor de 1264 px de `<main>` para que la landing use franjas a ancho completo, cada una con su propio contenedor interno) y la prop opcional `footer` (default `SiteFooter`, intacto). La variante por defecto queda **byte-idéntica**, así que `/portfolio`, `/company` y `/explore` no cambian.
- **`apps/web/src/application/navigation/shell-nav.ts`** alinea el ancla interna del header a español: `/#como-funciona`. Las rutas siguen en inglés; solo cambian las **anclas de página**.
- **`apps/web/src/app/page.tsx`** se reescribe: monta `<AppShell fullBleed footer={<LandingFooter/>}>` y compone, en orden del template: hero → franja de garantías → «PyMEs en campaña» → «Cómo funciona» → «Qué es real y qué es simulado» → asistente flotante.

### 3.2 Secciones estáticas (WU1)

- **`landing/landing-hero.tsx`** — grilla de dos columnas: la columna de texto (badges `DEMO` / `TESTNET` / `DATOS SIMULADOS`, el `h1` con la palabra destacada, el párrafo de promesa, el CTA primario «Explorar PyMEs», el CTA secundario por rol y el ancla «Leer los límites de esta demo») y la segunda columna, que es la campaña destacada inyectada como elemento Cliente.
- **`landing/hero-account-cta.tsx`** — isla Cliente del CTA secundario «Quiero financiar mi negocio», por rol: anónimo → `/signup`; `PYME` → `/company`; `INVERSOR` (y `ADMIN`, inferido con el mismo criterio) → oculto. Mientras la sesión carga no renderiza nada (evita que un rol con sesión vea un instante el enlace anónimo).
- **`landing/trust-strip.tsx`** — franja de cuatro garantías técnicas de la demo, verbatim del template.
- **`landing/how-it-works.tsx`** — sección `#como-funciona`: encabezado, subtítulo y los cuatro pasos numerados, verbatim de los datos `steps` del template.
- **`landing/real-vs-simulated.tsx`** — sección `#limites`, con las dos tarjetas («Se ejecuta de verdad, en Testnet» / «Es sintético»). Ambos callouts son divulgaciones canónicas (`testnet` y `simulation`), renderizadas **solo** por `CanonicalDisclosure`, nunca reescritas.

### 3.3 Campaña destacada y grilla (WU2)

- **`apps/web/src/application/marketplace/landing-selection.ts`** — módulo **puro y libre de React**: `selectFeatured` (la campaña con mayor `fundedPercentBps`; ante empate, una con foto, y luego la de cierre más próximo) y `selectGrid` (todo lo demás, cierre más próximo primero, hasta 3, con la destacada excluida). Una `closeDate` no parseable (no se asume válida) rankea **última**, nunca primera.
- **`landing/featured-campaign.tsx`** — isla Cliente: consume el listado público con el mismo camino de datos que `/explore` (`createBrowserMarketplacePort()` + `useMarketplace`, **una sola clave SWR compartida** con la isla de la grilla, así que el pedido se deduplica) y renderiza la card destacada. Tiene **dos variantes**:
  - **Real** (`FeaturedCampaignReal`): construida **solo** con campos del contrato público. Su fila de métricas tiene **dos columnas** (Revenue share y Riesgo) porque el contrato no lleva ni la línea «desde AAAA» ni el resultado de KYC; conserva la foto real de la campaña. El CTA «Ver evidencia y riesgo» apunta a `/campaigns/:id`.
  - **Simulada** (`FeaturedCampaignSimulated`): el «Panadería Horizonte SRL» del template, con datos congelados y marcado `SIMULADO`; reproduce el template completo (fila de **tres** columnas con el KYC simulado) y lleva el chip «Imagen representativa» sobre la imagen. Su CTA apunta a `/explore`, porque no hay campaña que abrir. Cuando **no hay campaña** (lista vacía o lectura fallida), se muestra esta variante en lugar de un espacio vacío (decisión del owner, §5).
- **`landing/pymes-en-campana.tsx`** — isla Cliente: reusa el mismo camino de datos y deriva la grilla con `landing-selection` (destacada excluida, 3 por cierre más próximo). Carga y error **nunca lanzan**: muestra `Skeleton`, y ante fallo `ErrorState` con reintento; el vacío es un copy neutro («Todavía no hay campañas publicadas»), no el de filtros de `/explore`.
- **`apps/web/public/pyme-panaderia.jpg`** — asset de la foto del ejemplo simulado, copiado del template.

### 3.4 Footer rico y asistente flotante (WU3 y WU4)

- **`landing/landing-footer.tsx`** — el footer rico del template, montado **solo** por `/` (las demás páginas conservan el `SiteFooter` compacto): marca + columnas `Plataforma` / `Aprender` / `Proyecto` (cada una un `<nav>` con `aria-label`), `CanonicalDisclosure id="no-production"` y fila legal con `microcopy.testnetBadge`. Los slugs de ruta son los que ya define `shell-nav.ts`; `#limites` es un ancla interna válida. `Contacto` queda en `#`, como el template, porque su destino es una pregunta abierta de #394.
- **`landing/help-assistant.tsx`** — isla Cliente del asistente flotante «Ayuda»: toggle fijo abajo a la derecha con `aria-expanded` e ícono que alterna chat ↔ cierre; panel `role="dialog"` con el saludo, tres enlaces rápidos, un input **deshabilitado** y «Ir al centro de ayuda». Se cierra con **Escape** (listener de `keydown` adjunto solo mientras está abierto). Los enlaces apuntan a `/help` (#394, 404 aceptado) y al ancla `#limites`.

### 3.5 Documentación (WU5)

- Este documento y la alineación de referencias al ancla en `docs/design/demo-ui.md` y `docs/planning/account-creation-sign-in-and-role-aware-shell-evidence.md` (§ downstream). El ancla interna del header, antes apuntando a una variante inglesa que nunca existió en la landing, ahora apunta a `/#como-funciona`.

## 4. Qué quedó probado

### 4.1 Gate completo, re-ejecutado por el orquestador (2026-10-10, esta rama)

| Verificación | Resultado observado | Fuente |
|---|---|---|
| `pnpm run verify` | **Exit 0** (lint, typecheck, test, build, boundaries, test:boundaries) | Re-ejecutado por el orquestador sobre esta rama |
| Boundaries | `no dependency violations found (1098 modules, 3689 dependencies cruised)` | Re-ejecutado por el orquestador |
| Suite raíz (`test:boundaries`) | 9 archivos / **163 tests** | Re-ejecutado por el orquestador |
| `pnpm --filter @vaqcrow/web test` | 200 archivos / **2008 tests** | Re-ejecutado por el orquestador; coincide con el cierre de WU4 en la bitácora |

### 4.2 RED → GREEN por work unit

Fuente: bitácora (2026-10-10). Cada WU se entregó test-first y con verificación independiente (tier `high`).

| WU | RED observado | GREEN | Suite web tras el WU | Verificación independiente |
|---|---|---|---|---|
| WU1 | 3 archivos fallando (10 tests) | 31 pasando | 194 archivos / 1971 tests | **PASS** (con avisos no bloqueantes) |
| WU2 | 7 fallando / 12 pasando | 19 pasando | 197 archivos / 1994 tests | **PASS** tras una corrección de estructura |
| WU3 | 1 fallando / 11 pasando | 18 pasando | 199 archivos / 2001 tests | **PASS** |
| WU4 | import sin resolver | 6 pasando (`page` + asistente: 19 pasando) | 200 archivos / 2008 tests | **PASS**; `build` de web ok |

### 4.3 Qué cubre cada suite

| Comportamiento | Prueba | Fuente del resultado |
|---|---|---|
| Landing compone hero + franja + grilla + «Cómo funciona» + límites; el ancla `#como-funciona` existe y el header enlaza `/#como-funciona`; disclosure canónico presente | `apps/web/src/app/page.test.tsx` | Bitácora (WU1, WU2, WU3, WU4); suite web re-ejecutada |
| Selección de la destacada (mayor fondeo, desempate por foto, luego cierre) y de la grilla (destacada excluida, 3 por cierre, sin mutar la entrada) | `apps/web/src/application/marketplace/landing-selection.test.ts` (12 tests) | Bitácora (WU2) |
| Destacada: variante real (dos columnas, sin «desde»/KYC) y variante simulada (tres columnas con KYC, chip «Imagen representativa»); carga y fallback | `apps/web/src/presentation/components/landing/featured-campaign.test.tsx` (4 tests) | Bitácora (WU2) |
| Grilla: estados de carga, error con reintento y vacío neutro; destacada excluida | `apps/web/src/presentation/components/landing/pymes-en-campana.test.tsx` (4 tests) | Bitácora (WU2) |
| Footer rico: columnas y enlaces, disclosure canónico, fila legal; `AppShell` default vs `footer` inyectado | `apps/web/src/presentation/components/landing/landing-footer.test.tsx` (4), `app-shell.test.tsx` (2) | Bitácora (WU3) |
| Asistente: `aria-expanded` alterna, panel `role="dialog"`, cierre con Escape, copy y enlaces | `apps/web/src/presentation/components/landing/help-assistant.test.tsx` (6) | Bitácora (WU4) |
| Ancla del header en español (`/#como-funciona`) en las vistas sin sesión y por rol | `apps/web/src/application/navigation/shell-nav.test.ts`, `presentation/components/app-header.test.tsx` | Bitácora (WU1); código re-leído |

### 4.4 No re-ejecutado

- **Testnet / Horizon / RPC:** esta Feature no toca la cadena; ninguna transacción real.
- **Playwright / e2e:** fuera de las superficies de esta Feature; no se corrió en el cierre.
- **`pnpm run test:db` y proyecto remoto:** sin migraciones, no aplica.

## 5. Decisiones del owner (2026-10-10) que reemplazan el comportamiento descrito en el issue

El issue describe un comportamiento *antes* de que el owner lo resolviera. Estas decisiones son las que rigen la implementación y **este documento se mide contra ellas**, no contra el texto literal del issue. Memoria Engram: `decision/418-featured-campaign`, `decision/418-help-assistant`, `decision/418-minor-decisions`.

| # | Texto del issue que la decisión reemplaza | Decisión del owner (2026-10-10) |
|---|---|---|
| Q1a — destacada vacía | El issue describe una variante vacía («No hay una campaña destacada ahora»). | Cuando **no hay campaña**, el espacio destacado muestra una **card de ejemplo simulada** (el «Panadería Horizonte SRL» del template, marcado `SIMULADO`), no la variante vacía: la PyME ve cómo lucirá su producto y el inversor qué datos tendrá. Cuando aparece una campaña real, **reemplaza** al ejemplo. **La variante vacía no se renderiza a propósito.** |
| Q1b — campos de la card real | El template dibuja la destacada con «desde AAAA» y una fila de KYC. | La card **real** muestra **solo** campos del contrato público: **quita** la línea «desde AAAA» y la fila de KYC (ninguna está en el contrato), por lo que su fila de métricas pasa a **dos columnas**. La card **simulada** reproduce el template completo (tres columnas con KYC). |
| Q1c — chip de imagen | El issue menciona el chip «Imagen representativa» «donde la foto no sea la propia de la PyME». | El chip se conserva **solo** en el ejemplo simulado (su imagen no es de la PyME); se **quita** en las fotos reales. Consistente con el texto del issue. |
| Q2 — asistente | El issue acota el asistente a su placeholder («Próximamente»). | Se implementa tal cual el template; sus enlaces (3 rápidos + «Ir al centro de ayuda») apuntan al centro de ayuda (#394) aunque hoy den 404. |
| Q3 — anclas | El issue no nombra las anclas internas. | Las **anclas de página** van en español (`#como-funciona`, `#limites`); las **rutas** siguen en inglés. |
| D1 (#438) — bloque de recorrido | El cuerpo de #418 listaba como pregunta abierta el bloque «Recorré la demo completa… Empezar el recorrido». | **Se elimina en forma definitiva** (decisión D1 de [#438](https://github.com/reyduar/Vaqcrow/issues/438), 2026-10-09). La landing de #418 **no** implementa ese bloque; no se agrega. |

Otras decisiones menores de la misma fecha (registradas en `decision/418-minor-decisions`): footer rico del template (no el `SiteFooter` compacto); los badges del hero (`DEMO` / `TESTNET` / `DATOS SIMULADOS`) se mantienen; el hero «Quiero financiar mi negocio» es por rol (anónimo → `/signup`, `PYME` → `/company`, `INVERSOR` → oculto); la destacada se **excluye** de «PyMEs en campaña»; 3 tarjetas por cierre más próximo; el vacío de la grilla usa un copy neutro de landing; el callout simulado usa el texto canónico `disclosures.simulation`.

## 6. Mapeo de criterios de aceptación (citados textualmente del issue #418)

Leyenda: ✅ cumplido · ⚠️ cumplido con la salvedad de una decisión del owner declarada en §5 · ❌ no cumplido.

| # | Criterio (verbatim) | Resultado | Fuente |
|---|---|---|---|
| 1 | "The landing page matches the template's sections, copy and states and is public." | ✅ Secciones y copy verbatim del template (hero, franja de garantías, destacada, «PyMEs en campaña», «Cómo funciona», «Qué es real y qué es simulado», footer rico, asistente); `/` es pública (sin gate de sesión). Desvíos de copy declarados en §5. | §3; `page.test.tsx`; bitácora |
| 2 | "Featured and listed campaigns come from real published campaigns (fixtures until the listing endpoint lands); the empty featured variant renders correctly." | ⚠️ **Cumplido con la salvedad declarada de §5/Q1a.** La destacada y la grilla derivan del listado público `GET /marketplace/campaigns` (contrato `MarketplacePort.list()`); en pruebas se consumen con dobles/fixtures locales. La **variante vacía no se renderiza**: cuando no hay campaña se muestra el ejemplo simulado (decisión del owner), y eso es intencional. | §3.3, §5; `landing-selection.test.ts`, `featured-campaign.test.tsx`, `pymes-en-campana.test.tsx` |
| 3 | "The floating \"Ayuda\" assistant opens a placeholder panel with the quoted copy and links, keyboard accessible (`aria-expanded`)." | ✅ El toggle expone `aria-expanded`; el panel es `role="dialog"` con el saludo, los enlaces rápidos y el input deshabilitado; se cierra con Escape. Los enlaces apuntan a `/help` (#394, 404 aceptado) y a `#limites`. | §3.4; `help-assistant.test.tsx` |
| 4 | "No claim of returns, custody or production readiness appears." | ✅ El copy declara Testnet sin valor económico, custodia por contrato (nunca por personas, nunca «tú custodias»), firma no custodial y «demo no productiva». Las divulgaciones se renderizan solo por `CanonicalDisclosure`; la franja y los «límites» lo refuerzan. | §3.2, §3.4; revisión de este documento |
| 5 | "Required evidence and failure behavior are covered." | ✅ Fallos cubiertos: carga y error de la destacada (fallback al ejemplo simulado), carga/error/vacío de la grilla con reintento y copy honesto; el asistente cierra con Escape. Este documento es la evidencia. | §3.3, §4 |
| 6 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | ✅ Las tres preguntas abiertas de #418 (cómo se elige la destacada; el bloque de recorrido; el comportamiento del asistente) se decidieron (`decision/418-*`, D1 de #438) antes de implementarse. | §5 |
| 7 | "No unsupported production claims or secrets are introduced." | ✅ Sin secretos, seeds ni PII; toda la UI declara la demo como no productiva y los datos como sintéticos; sin afirmaciones de producción ni de retorno. | Revisión de este documento; `verify` exit 0 |

## 7. Límites y pendientes

- **Rutas que todavía no existen (404 aceptado a propósito).** Los enlaces del header, del footer y del asistente apuntan a `/help`, `/about`, `/entrepreneur-guide` y `/investor-guide`; hoy responden 404 hasta que aterricen sus Features ([#394](https://github.com/reyduar/Vaqcrow/issues/394), entre otras). Se muestran deliberadamente como recordatorio de las guías pendientes.
- **`Contacto` queda en `#`.** Es una pregunta abierta de #394; no se inventó una ruta.
- **El bloque «Recorré la demo completa…» no se implementa** (D1 de [#438](https://github.com/reyduar/Vaqcrow/issues/438)); se registra como decisión, no como omisión.
- **Copy de UI sin pantalla en el template:** el vacío neutro de la grilla y las variantes de la card real/simulada (dos columnas vs tres) son decisiones de implementación sobre datos del contrato; queda como copy visible a revisar por el owner.
- **El template no está versionado.** `docs/design/template/` está en `.gitignore` a propósito (es la fuente de verdad visual): la landing se construyó contra `Vaqcrow Landing.dc.html`, que no vive en el repositorio. La variante offline `Landing.html` (export del template) **no se distribuye**; solo se copió el asset `public/pyme-panaderia.jpg`.
- **Avisos cosméticos no bloqueantes** (bitácora): padding inferior del hero 80 px vs 96 px del template; títulos de columna del footer en `font-semibold` (600) vs 650; isotipo del header 33×32 vs 28×28; el swap de ícono chat ↔ cierre del asistente se verificó por inspección, no por test.

## 8. Estado de entrega

- **Nada de #418 está en `main`.** Todo vive en la rama `Vaqcrow#418_Feat_Build_the_public_landing_page`, creada desde `afede2c`. La rama no está mergeada y no hay PR; el merge lo decide el owner.
- **En `main`** `/` sigue siendo el esqueleto. Al mergear, `main` gana la landing pública con la campaña destacada, «PyMEs en campaña», las secciones explicativas y el asistente «Ayuda».
- El cierre de la Feature #418 y de las Tasks #419/#420/#421 lo decide el owner.
