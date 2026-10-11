# Evidencia de cierre de la Feature #394 — Issue #397

> [!success] Mergeado en `main` vía [#469](https://github.com/reyduar/Vaqcrow/pull/469) (merge `48e7b34`, 2026-10-11)
> La Feature #394 y sus Tasks #395/#396/#397 están cerradas y su contenido vive en `main`. El estado que este documento registraba —la rama `Vaqcrow#394_Feat_Publish_the_About_page_guides_and_help_center` sin PR y fuera de `main`, con su último commit de código `80a114f`— describía el estado *de rama* al escribir la evidencia y quedó superado por el merge. El mapeo de criterios (§8) mantiene los 7 criterios de aceptación por cumplidos.

> Documento de cierre de Feature. Consolida la evidencia ya registrada en `odd/tasks/about-guides-and-help-center.md` —las corridas del writer y del verificador independiente de WU1–WU5—, agrega lo que la bitácora no documenta como conjunto: el mapeo contra los criterios de aceptación verbatim de la Feature #394, las decisiones del owner del 2026-10-10 y los límites vigentes. **No re-ejecuta los tests por WU**: su fuente es la bitácora, y cada fila lo dice. No reemplaza a `odd/tasks/about-guides-and-help-center.md`, que sigue siendo la fuente de verdad de cómo se hizo el trabajo.

## 1. Contexto y objetivo

La Feature [#394](https://github.com/reyduar/Vaqcrow/issues/394) ("Feature: Publish the About page, guides and help center"), bajo la Epic [#373](https://github.com/reyduar/Vaqcrow/issues/373) (sitio público), pide entregar cuatro páginas públicas del template, sin cuenta: **Acerca de** (`/about`), **Guía para emprendedores** (`/entrepreneur-guide`), **Guía de inversión** (`/investor-guide`) y **Centro de ayuda** (`/help`), más el modal de **Términos y Condiciones** y la entrada de `/help` en la navegación. El asistente RAG de Ayuda queda como «Próximamente».

Se entregó en una sola rama por Feature, rebanada por commits de unidad de trabajo (WU), con un writer por WU y verificación independiente en cada uno. Sus tres Tasks:

| Task | Issue | Entrega |
|---|---|---|
| Implementar | [#395](https://github.com/reyduar/Vaqcrow/issues/395) | WU1–WU5: commits `e326a5a`, `5fd806b`, `b0c29f8`, `67615d0`, `4a1d078` |
| Probar | [#396](https://github.com/reyduar/Vaqcrow/issues/396) | Tests focales por WU (ver §4); toda la suite corre sin servicios en vivo |
| Documentar evidencia | [#397](https://github.com/reyduar/Vaqcrow/issues/397) | este documento |

**Rama:** `Vaqcrow#394_Feat_Publish_the_About_page_guides_and_help_center`, creada desde `main` `afede2c`. **Cinco commits de implementación:**

| Commit | WU | Entrega |
|---|---|---|
| `e326a5a` | WU1 | Contenido puro (`application/`) + test de términos prohibidos |
| `5fd806b` | WU2 | Página `/about` |
| `b0c29f8` | WU3 | Las dos guías públicas |
| `67615d0` | WU4 | Página `/help` |
| `4a1d078` | WU5 | Modal de Términos + trigger en el footer + entrada `/help` en el nav |
| `80a114f` | cierre | Reconciliación del copy de la bóveda (criterio 4) |

Cada WU tiene, además, su commit de bitácora (`docs(odd): record #394 WUn`).

## 2. Cómo leer esta evidencia

- **Cada resultado nombra su fuente.** Las filas de §4 provienen de las corridas del writer y del verificador independiente **registradas en `odd/tasks/about-guides-and-help-center.md`** (fuente por WU); no se re-ejecutaron en el árbol de este documento. La única verificación re-ejecutada al cerrar es el `grep` de alineación de documentación (§4, última fila). Nada se infiere.
- **Comandos.** Requieren Node 24: `PATH="/opt/homebrew/opt/node@24/bin:$PATH"`. Runner declarado por la Feature: `pnpm --filter @vaqcrow/web test`, más typecheck y lint por WU.
- **Estado de entrega.** Rama apilada; sin merge y sin PR (§10).
- **Bitácora.** `odd/tasks/about-guides-and-help-center.md` es la bitácora de las cinco WU: unidades con hashes, ciclos RED→GREEN, decisiones, avisos y cómo se resolvió cada uno. Este documento la cita; no la reemplaza.

## 3. Qué quedó implementado

### 3.1 Rutas públicas (fuera del grupo `(app)`, sin gate)

Las cuatro páginas viven fuera del grupo `(app)`, como `/explore`: **sin `RouteGate`, sin auth, sin sesión**, así que el gate de login que el template dibuja (`Vaqcrow Guia emprendedores.dc.html:91-102` y equivalentes) **no se implementa** (owner, 2026-10-10). El `matcher` de `apps/web/src/proxy.ts:24` sólo cubre `/portfolio`, `/company`, `/reports`, `/login` y `/signup`, de modo que las cuatro rutas quedan alcanzables sin cuenta.

| Página | Ruta | Archivo |
|---|---|---|
| Acerca de | `/about` | `apps/web/src/app/about/page.tsx` |
| Guía para emprendedores | `/entrepreneur-guide` | `apps/web/src/app/entrepreneur-guide/page.tsx` |
| Guía de inversión | `/investor-guide` | `apps/web/src/app/investor-guide/page.tsx` |
| Centro de ayuda | `/help` | `apps/web/src/app/help/page.tsx` |

Cada página compone el `AppShell` compartido (header + footer) y renderiza un componente de `presentation/`.

### 3.2 Contenido puro (`application/`, sin React)

- `apps/web/src/application/about/copy.ts` — hero y stack, misión y visión, seis pilares, callout canónico (`no-production`), sección del creador y «Hablemos» con los cuatro links reales.
- `apps/web/src/application/guides/types.ts` — tipos del `Guide` (secciones, TOC, ejemplo trabajado, CTA, `eyebrowIcon`).
- `apps/web/src/application/guides/entrepreneur-guide.ts` y `.../investor-guide.ts` — 7 secciones cada una; ejemplo trabajado compartido: ARS 3.745.800,00 × 4,5 % = ARS 168.561,00.
- `apps/web/src/application/help/faq.ts` — 4 categorías + 9 FAQs + copy de búsqueda, estado vacío, contacto y «Próximamente».
- `apps/web/src/application/legal/terms.ts` — Términos y Condiciones (React-free) con 13 secciones; cuatro declaran su `disclosure` canónico (`no-production`, `testnet`, `non-custody`, `simulation`, `human-ai`) y se renderizan vía `CanonicalDisclosure`.

### 3.3 Componentes de presentación

- `presentation/components/about/*` — `about-content`, `about-hero`, `about-mission`, `about-pillars` (con `CanonicalDisclosure id="no-production"`), `about-creator` (foto `public/creador-gris.png`, CTA → LinkedIn), `about-contact` (4 links), `about-icons`, `decorative-coin` (monedas `aria-hidden` / `pointer-events-none`).
- `presentation/components/guides/*` — renderer compartido: `guide-page`, `guide-hero`, `guide-toc` (isla client con TOC sticky y progreso), `guide-section`, `worked-example`, `guide-final-cta`, `guide-icons`.
- `presentation/components/help/*` — `help-content`, `help-explorer` (isla client: buscador + categorías `aria-pressed` + acordeón single-open con `aria-expanded`/`aria-controls`), `help-faq-item`, `help-contact`, `help-icons`.
- `presentation/components/legal/terms-modal.tsx` — modal HeroUI con el trigger `TermsTrigger`.
- `presentation/components/site-footer.tsx` — el trigger «Términos» se agregó a la fila legal del footer **compartido**, por lo que el modal es alcanzable desde toda página que monte este footer.
- `presentation/components/progress-bar.tsx` — se agregó un `ariaLabel?` opcional (retrocompatible) para el nombre accesible del progreso de lectura.
- `application/navigation/shell-nav.ts` + `presentation/components/app-header.tsx` — entrada «Centro de ayuda» → `/help` en los menús con sesión (INVERSOR y PYME), ícono `help-circle`.

## 4. Qué quedó probado

| Verificación (foco) | Resultado observado | Fuente |
|---|---|---|
| WU1 · `application/about/public-copy-prohibited-terms.test.ts` (15 casos) | RED: import sin resolver → GREEN: 15 pasando. Suite web completa: 195 archivos / 1979 tests | Bitácora WU1 (`odd/tasks/about-guides-and-help-center.md`) |
| WU2 · `app/about/page.test.tsx` (6) | RED: `./page` sin resolver → GREEN: 6 pasando | Bitácora WU2 |
| WU3 · `app/entrepreneur-guide/page.test.tsx` (7) + `app/investor-guide/page.test.tsx` (6) | RED: `./page` sin resolver → GREEN: 13 pasando (tras una corrección) | Bitácora WU3 |
| WU4 · `app/help/page.test.tsx` (8) | RED: `./page` sin resolver → GREEN: 8 pasando | Bitácora WU4 |
| WU5 · `site-footer.test.tsx` (+3), `shell-nav.test.ts`, `app-header.test.tsx`, guardián de términos ampliado al copy legal | 3 fallando → 37 pasando | Bitácora WU5 |
| WU5 · `apps/web/e2e/auth-roles.spec.ts` | 6 passed (el cambio de menú rompía el assert exacto del menú; se amplió la superficie con OK del owner) | Bitácora WU5 |
| Verificación independiente por WU (tier `high`) | **PASS** en WU1, WU2, WU3 (tras corrección), WU4 y WU5 | Bitácora WU1–WU5 |
| `grep -rn` de alineación de documentación tras la edición de este WU | Sin coincidencias pendientes (ver §6, último punto) | Re-ejecutado en el árbol de este WU |

**Flakiness de la suite completa.** La suite `pnpm --filter @vaqcrow/web test` (y por lo tanto `pnpm run test` / `verify` sobre web) **es flaky bajo carga del host**: timeout de 5 s por test en archivos ajenos al cambio, ya observado en #418. El writer de WU2 reportó `partial` únicamente por esa razón; los tests focales de cada WU y typecheck/lint quedaron limpios. Los resultados por WU de la tabla provienen de las corridas registradas en la bitácora y **no se re-ejecutó la suite completa** para este documento.

**Reconciliación del copy de la bóveda (criterio 4).** El copy del template sobre el despliegue de la bóveda (que decía que la PyME abre y firma la bóveda) se reconcilió con la decisión del owner: la bóveda la despliega la plataforma tras la aprobación del admin, la PyME sólo conecta Freighter y entrega su clave pública (destino inmutable) y firma las **distribuciones** mensuales. Se detalla en §6 y §8 (criterio 4).

## 5. Decisiones del owner (2026-10-10)

Memoria Engram: `decision/394-contact-and-terms`. Resuelven los puntos de «Not designed in the template (open question)» de #394.

| Pregunta abierta (issue #394) | Resolución (owner, 2026-10-10) |
|---|---|
| Destino de «Escribir al equipo» y «Hablemos» | **Destinos reales (opción b):** «Hablemos» en Acerca de → **LinkedIn** `https://www.linkedin.com/in/arielduarte`, **Discord** `https://discord.gg/XnsH2FvSr`, **Email** `mailto:contact@vaqcrow.com`, **GitHub** `https://github.com/reyduar`; «Escribir al equipo» en el centro de ayuda → `mailto:contact@vaqcrow.com`. El template traía el placeholder `.demo` en el `mailto`, que se reemplazó por la dirección real. |
| La página «Términos» del pie | No es una página sino un **modal** (beta/demo, todo en Stellar Testnet sin valor económico, **no custodial**, sin oferta de inversión), alineado con los disclosures canónicos. El trigger vive en el `SiteFooter` compartido, alcanzable desde toda página que lo monte. |
| Comportamiento del asistente RAG | Queda **sólo** el aviso «Próximamente: un asistente que responde con la documentación de la demo.» y los links; no se implementa el asistente. |
| Gate de login del template | **Anulado.** Guías y ayuda son públicas sin onboarding (override explícito del owner sobre el bloqueo por cuenta del template). |

**Reconciliación del despliegue de la bóveda (decisión del 2026-10-01, previa).** El contacto, Términos y RAG se resolvieron el 2026-10-10; la pregunta del despliegue ya estaba resuelta en el issue: la aprobación del admin dispara el `factory.deploy` **firmado por la plataforma** (`POST /campaigns`) con la clave pública de la PyME como destino inmutable; **la PyME nunca abre ni firma la bóveda**, sólo conecta Freighter y entrega su clave pública antes de la revisión. El copy del template que diga lo contrario debía ajustarse a este flujo. **El copy de la guía para emprendedores se ajustó a este flujo** en la corrección de cierre (commit `80a114f`; ver §6 y §8, criterio 4).

## 6. Límites y brechas vigentes

1. **Criterio 4 — reconciliado durante el cierre (hallazgo).** El WU documental detectó que el copy del template (la PyME abre y firma la bóveda) se había copiado verbatim y contradecía la decisión del owner. Se corrigió `apps/web/src/application/guides/entrepreneur-guide.ts` (el requisito de la wallet y la sección 04): la bóveda la despliega la plataforma tras la aprobación del admin, la PyME sólo conecta Freighter y entrega su clave pública (destino inmutable) y firma las **distribuciones** mensuales. La guía de inversión ya describía correctamente la custodia por contrato y el destino inmutable, sin afirmar que la PyME firma la bóveda, así que no requirió cambios.
2. **`AppShell` predata #418.** Esta rama sale de `main` sin #418 (que está en PR #468): `AppShell` no tiene las props `fullBleed`/`footer`. Las bandas a sangre de `/about` y las guías se aproximan con `-mx-8 border-y` contra el contenedor del shell. **A reconciliar al mergear #468.**
3. **El trigger de «Términos» vive sólo en el footer compacto compartido.** El footer rico de la landing es #418; en esta rama el modal sólo es alcanzable desde el `SiteFooter` compacto (el que montan las páginas nuevas y el shell). El template dibuja «Términos» en el footer propio de la pantalla Acerca de. Flageado en la bitácora.
4. **Docstring obsoleto en `shell-nav.ts`.** El comentario de cabecera (`apps/web/src/application/navigation/shell-nav.ts:7-11`) todavía lista `/about` y las guías entre las «pages that do not exist yet … shown on purpose». En esta rama ya existen. Es un comentario de código **fuera de la superficie de este WU**; queda como pendiente de alineación.
5. **Suite web flaky.** Ver §4: el gate completo de web puede fallar por timeouts de 5 s en archivos ajenos bajo carga del host; los tests focales por WU pasan.
6. **`demo-tasks-list.md`.** Al escribir esta evidencia, la sincronización del roadmap quedaba para el commit posterior al cierre, siguiendo el precedente del repo (p. ej. #14/#46). Con la Feature mergeada, esa lista ya marca #394 y sus Tasks #395–#397 como entregadas y cerradas.

## 7. Correcciones aplicadas durante el ciclo

1. **WU1 — la denylist choca con el copy honesto del template.** Los patrones `/garantiz/`, `/garantía/`, `/asegur/`, `/retorno/` matchean frases legítimas del template («no garantiza…», «Sin retorno garantizado», «asegurate de tener»). Se resolvió como el precedente del repo: se exceptúan 7 frases de disclaimer, **cada una asserted presente** para que la cobertura no envejezca, antes de correr la denylist; una promesa real igual falla. Verificador independiente: PASS.
2. **WU2 — CTA del creador y comentario de procedencia.** El CTA «Ver perfil profesional completo» (template `#`) se resolvió a LinkedIn del owner (decisión); se corrigió un comentario de procedencia contradictorio en `copy.ts`.
3. **WU3 — ícono del eyebrow y nombre accesible del progreso.** El verificador flageó (a) el ícono decorativo del eyebrow del hero (diseñado por el template) y (b) el nombre accesible del progreso. Se agregó `eyebrowIcon` al `Guide` y, con autorización del owner de ampliar la superficie a `progress-bar.tsx`, un `ariaLabel?` opcional (retrocompatible; los 5 callers existentes no cambian). Re-verificado: PASS.
4. **WU4 — hueco de cobertura en categorías.** El `aria-pressed` de las categorías estaba implementado pero sin assert; se agregó el assert inline. Verificador: PASS.
5. **WU5 — ícono, e2e y sección faltante.** (a) El ícono debía ser `help-circle` (mapa en `app-header.tsx`, fuera de superficie → superficie ampliada con OK del owner); (b) el cambio de menú rompía `e2e/auth-roles.spec.ts` (assert del menú exacto → superficie ampliada; el e2e corrió 6 passed); (c) se agregó la sección «La IA es asesora, no decide» (disclosure `human-ai`) que faltaba en el copy renderizado y se ajustó el test de secciones/disclosures.
6. **WU6 — reconciliación del copy de la bóveda (criterio 4).** La revisión documental detectó que el copy del template sobre el despliegue de la bóveda contradecía la decisión del owner; se corrigió en `entrepreneur-guide.ts` (commit `80a114f`), con los tests focales de las guías y del guardián de términos en verde. Ver §6, punto 1, y §8, criterio 4.

## 8. Mapeo de criterios de aceptación

Criterios citados **verbatim** de `gh issue view 394`.

| # | Criterio (verbatim) | Resultado | Evidencia |
|---|---|---|---|
| 1 | "The four pages match their template screens (sections, copy, states, accordion and category filtering) and are reachable without an account." | Cumplido en la rama | Las cuatro rutas viven fuera de `(app)`, sin `RouteGate` ni sesión, y no están en el `matcher` de `proxy.ts` (§3.1). Secciones/copy/estados por página: tests de §4. Desviaciones de fidelidad registradas: el `EmptyState` compartido es centrado (vs. el box izquierdo del template, reuso por sobre pixel-fidelity) y el acordeón es single-open con la 1.ª fila abierta (como el template). |
| 2 | "Search and category filtering work, including the empty state." | Cumplido | `help-explorer` implementa buscador + categorías `aria-pressed` + acordeón `aria-expanded`/`aria-controls` + estado vacío «No encontramos resultados para “…”»; `app/help/page.test.tsx` (8) (§4). |
| 3 | "No page promises returns or contradicts the non-custodial and simulated-data rules." | Cumplido | Denylist de términos prohibidos espejada de `application/trust/contract-custody.test.ts:45-63`, aplicada al copy de About, guías y ayuda (WU1) y ampliada al copy legal (WU5); el disclosure canónico se renderiza **sólo** por `CanonicalDisclosure` (§3.2, §3.3). |
| 4 | "The conflicting guide copy is reconciled with the owner's decision before shipping." | Cumplido | El copy del template (la PyME abre y firma la bóveda) se reconcilió con la decisión del owner en `apps/web/src/application/guides/entrepreneur-guide.ts` (commit `80a114f`): la bóveda la despliega la plataforma tras la aprobación del admin; la PyME sólo conecta Freighter, entrega su clave pública (destino inmutable) y firma las distribuciones (§6, punto 1). |
| 5 | "Required evidence and failure behavior are covered." | Cumplido | Tests de página (About 6, guías 13, ayuda 8), `site-footer` (+3), `shell-nav`, `app-header`; asserts de `aria-expanded`/`aria-pressed` y del estado vacío; guardián de términos prohibidos; este documento (§4, §7). |
| 6 | "Every item under \"Not designed in the template (open question)\" is decided by the owner before it is implemented; none is invented." | Cumplido | Las cuatro preguntas abiertas quedaron decididas por el owner el 2026-10-10 (§5), y la del despliegue de la bóveda el 2026-10-01; el gate de login del template se anula explícitamente. La decisión del despliegue se trasladó al copy en la corrección de cierre (§8, criterio 4). |
| 7 | "No unsupported production claims or secrets are introduced." | Cumplido | Denylist de términos prohibidos (§4); sin secretos ni semillas; sin afirmaciones de producción; el disclosure canónico etiqueta la demo como no productiva y todo lo sintético lleva su marca `SIMULADO`. |

## 9. Resultado visible en la demo

La rama agrega cuatro páginas públicas de contenido estático, alcanzables sin cuenta: `/about`, `/entrepreneur-guide`, `/investor-guide` y `/help`. Aporta además el modal de Términos y Condiciones (alcanzable desde el footer compartido) y la entrada «Centro de ayuda» en los menús con sesión. No agrega backend ni comportamiento de servidor: todo el contenido es data pura en `application/`, renderizada desde `presentation/`. La navegación pública ya enlazaba `/about` y las guías; `/help` es nuevo en los menús de INVERSOR y PYME.

**Estado de la entrega:** en `main` desde [PR #469](https://github.com/reyduar/Vaqcrow/pull/469) (merge `48e7b34`, 2026-10-11), que mergeó la rama `Vaqcrow#394_Feat_Publish_the_About_page_guides_and_help_center`.

## 10. Estado de entrega

- **Feature #394** y sus Tasks #395/#396/#397 **están cerradas y en `main`** vía [PR #469](https://github.com/reyduar/Vaqcrow/pull/469) (merge `48e7b34`, 2026-10-11); el estado *de rama* (sin PR, fuera de `main`) quedó superado por el merge.
- **Cinco commits** de implementación (`e326a5a`, `5fd806b`, `b0c29f8`, `67615d0`, `4a1d078`) más los commits de bitácora por WU.
- **Este documento cierra la Task #397** (evidencia). El criterio 4 (§6, §8) quedó cumplido con la corrección de copy de cierre (commit `80a114f`). Los 7 criterios de aceptación quedaron cubiertos; la Feature y sus Tasks se cerraron en GitHub y su [PR #469](https://github.com/reyduar/Vaqcrow/pull/469) fue mergeado por el owner el 2026-10-11.
- **Docs alineados en este WU:** `docs/design/demo-ui.md` y `docs/planning/account-creation-sign-in-and-role-aware-shell-evidence.md` dejan de declarar `/about`, las guías y el centro de ayuda como inexistentes; pasan a describirlos como entregados **en la rama de #394, hoy en `main` vía #469**.
- Al cerrarse la Feature, su cierre es **manual** en GitHub (el patrón del repo: la Feature no se cierra al completarse sus sub-issues).
