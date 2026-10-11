# Bitácora — Feature #394: Acerca de, guías y centro de ayuda

Rama: `Vaqcrow#394_Feat_Publish_the_About_page_guides_and_help_center` (creada desde `main` `afede2c`). Sub-issues: #395 (implementar) · #396 (probar) · #397 (evidencia). Feature bajo la Epic #373 (sitio público).

## Objetivo

Entregar cuatro páginas públicas, fieles al template: **Acerca de** (`/about`), **Guía para emprendedores** (`/entrepreneur-guide`), **Guía de inversión** (`/investor-guide`) y **Centro de ayuda** (`/help`).

## Problema y por qué

Hoy las cuatro rutas responden 404 y sus slugs ya están cableados a propósito desde el header/footer de #418 (404 aceptado hasta que #394 las construya). Son páginas de contenido estático, públicas: el owner anuló el gate de login que el template dibuja.

## Alcance

- **En alcance:** las cuatro páginas, el contenido puro en `apps/web/src/application/` (sin React), el modal de **Términos y Condiciones**, la entrada de `/help` en el nav, y el test de términos prohibidos que espeja el del repo.
- **Fuera de alcance:** el asistente RAG funcional (queda solo el aviso «Próximamente» + links); backend nuevo; el gate de login del template.

## Decisiones (owner, 2026-10-10)

Memoria Engram: `decision/394-contact-and-terms`.

- **Contacto (opción b), destinos reales:** «Hablemos» en Acerca de → **LinkedIn** `https://www.linkedin.com/in/arielduarte`, **Discord** `https://discord.gg/XnsH2FvSr`, **Email** `mailto:contact@vaqcrow.com`, **GitHub** `https://github.com/reyduar`; «Escribir al equipo» en el centro de ayuda → `mailto:contact@vaqcrow.com` (el template traía el placeholder `.demo`).
- **«Términos»:** no es una página sino un **modal** con Términos y Condiciones estándar para una app de inversión, redactados para el estado real: **beta/demo, todo en Stellar Testnet sin valor económico, no custodial, sin oferta de inversión**, alineados con los disclosures canónicos.
- **Guías y ayuda públicas** (sin gate).
- **Asistente RAG = «Próximamente»**.

## Restricciones

- Rutas en inglés; copy de UI en español, inline; contenido puro en `application/` (sin React), renderizado desde `presentation/`.
- Disclosure canónico **solo** por `CanonicalDisclosure`.
- Espejar el test de términos prohibidos del repo (`application/trust/contract-custody.test.ts`): denylist de regex sobre el copy.
- test-first (ODD; Strict TDD no activo). Runner: `pnpm --filter @vaqcrow/web test`.
- Un writer por WU; verificación independiente; RDD off. Sin migraciones.
- No inventar features, estados ni copy que el template no diseñe.
- ⚠️ Esta rama sale de `main` **sin #418** (que está en PR #468): al mergear #468 hay que reconciliar `shell-nav.ts` (ancla `#como-funciona`) y `app-shell.tsx` (props `fullBleed`/`footer`).

## Superficie mapeada (evidencia)

- **Plantillas** (git-ignored, fuente de verdad visual): `Vaqcrow Acerca de.dc.html` (224 líneas), `Vaqcrow Guia emprendedores.dc.html` (207), `Vaqcrow Guia de inversion.dc.html` (206), `Vaqcrow Ayuda.dc.html` (210) — las tres últimas con un gate de login en `:91-102` que **no se implementa**.
- **App a reusar:** `app-shell.tsx` (en esta rama sin `footer`/`fullBleed`), `page-heading.tsx:8`, `badge.tsx`, `empty-state.tsx:27`, `error-state.tsx:22`, `canonical-disclosure.tsx:15`, `brand-isotipo.tsx:18`, `site-footer.tsx:42` (compacto, sin nav). Modal HeroUI: patrón en `marketplace/marketplace-filters-modal.tsx:70`. **No hay** Accordion ni componente de búsqueda dedicado → nuevos.
- **Contenido puro:** patrón `application/<area>/copy.ts` (p. ej. `application/company/copy.ts:7`).
- **Términos prohibidos:** `application/trust/contract-custody.test.ts:45-63` (denylist) — es el precedente a espejar.
- **Disclosures:** ids en `application/trust/disclosures.ts:19-25` (`no-production`, `simulation`, …).
- **Rutas públicas:** fuera del grupo `(app)` (patrón `app/explore/page.tsx:12`); `proxy.ts:24` no las cubre. `/about` y las guías ya están en `shell-nav.ts:62/73/83`; **`/help` no está en ningún nav** → agregar.

## Tareas (checklist)

- [x] **WU1 — Contenido puro + test de términos prohibidos.** `application/about/copy.ts`, `application/guides/*` (guía emprendedores + inversión, 7 secciones c/u + ejemplo trabajado ARS 3.745.800 × 4,5 % = ARS 168.561,00), `application/help/faq.ts` (4 categorías + 9 FAQs). Test que espeja la denylist. — **Commit `e326a5a`.** Verificado (tier high, verificador independiente PASS).
- [x] **WU2 — Acerca de (`/about`).** Hero, «Misión y visión», «Pilares / ¿Qué es Vaqcrow?» (callout canónico no-production), «Sobre el creador» (foto `creador-gris.png`), «Hablemos» (4 links reales), monedas decorativas `aria-hidden`. — **Commit `5fd806b`.** Verificado (tier high, verificador independiente PASS).
- [x] **WU3 — Guías (`/entrepreneur-guide`, `/investor-guide`).** Hero + TOC + 7 secciones c/u + CTA + footer estándar. — **Commit `b0c29f8`.** Verificado (tier high, verificador independiente PASS tras una corrección).
- [ ] **WU4 — Centro de ayuda (`/help`).** Hero + buscador + 4 categorías + acordeón FAQ (`aria-expanded`) + estado vacío «No encontramos resultados para "…"» + bloque de contacto + aviso «Próximamente».
- [ ] **WU5 — Modal Términos + trigger + nav `/help`.** Modal de T&C; trigger de «Términos»; entrada `/help` en el nav.
- [ ] **WU6 — Evidencia + cierre.** `docs/planning/about-guides-and-help-center-evidence.md` (español, criterios citados) + alineación de docs.

## Decisión de diseño (flag para el owner)

**Dónde vive el trigger de «Términos».** El template solo lo pone en el footer propio de la pantalla Acerca de (nav Inicio/Límites de la demo/GitHub/Términos); el issue dice «header/footer estándar». Propuesta de implementación: agregar «Términos» a la fila legal del `SiteFooter` compartido (alcanzable desde todas las páginas) y montar el modal ahí. Queda flageado; si el owner prefiere solo en `/about` (fiel al template), se cambia.

## Estrategia de entrega

Forecast grueso: ~1200 líneas propias (contenido de guías y FAQ es extenso) → una sola rama/PR por Feature, rebanada por commits de WU.

## Verificación

Por WU: `pnpm --filter @vaqcrow/web test` + typecheck + lint. Al cierre: `pnpm run verify` completo.

## Iteración

### WU1 — Contenido puro + test de términos prohibidos · commit `e326a5a`

- Código: `application/about/copy.ts` (hero, stack, misión, 6 pilares, callout canónico, creador, hnos con 4 links reales); `application/guides/{types,entrepreneur-guide,investor-guide}.ts` (7 secciones c/u + ejemplo trabajado); `application/help/faq.ts` (4 categorías + 9 FAQs + copy de búsqueda/vacío/contacto/«Próximamente»).
- Test: `application/about/public-copy-prohibited-terms.test.ts` (15 casos): presencia de contenido + denylist espejada de `trust/contract-custody.test.ts:45-63`.
- RED→GREEN: import sin resolver → 15 pasando. Suite web: 195 archivos / 1979 tests.
- **Hallazgo (resuelto):** la denylist (`/garantiz/`, `/garantía/`, `/asegur/`, `/retorno/`) choca con el copy **honesto** del template («no garantiza…», «Sin retorno garantizado», «asegurate de tener»). Se resuelve como el precedente del repo: se exceptúan las 7 frases de disclaimer (cada una asserted presente para que la cobertura no envejezca) antes de correr la denylist; una promesa real igual falla. Verificador independiente: **PASS** (exención exacta y sound).
- Pendiente para WU2: el CTA «Ver perfil profesional completo» no tiene destino decidido (template `#`) — propuesta: → LinkedIn del owner.

### WU2 — Acerca de (`/about`) · commit `5fd806b`

- Código: `app/about/page.tsx` (ruta pública fuera de `(app)`, sin gate) + `presentation/components/about/*` (hero + stack, misión, pilares con `CanonicalDisclosure id="no-production"`, creador con foto/estadísticas/CTA LinkedIn, hablemos con los 4 links reales, monedas decorativas `aria-hidden`/`pointer-events-none`); asset `public/creador-gris.png` copiado del template.
- Tests: `app/about/page.test.tsx` (6).
- RED→GREEN: `./page` sin resolver → 6 pasando.
- El CTA del creador → LinkedIn del owner (decisión); se corrigió un comentario de procedencia contradictorio en `copy.ts`.
- Verificador independiente (tier `high`): **PASS**. El writer reportó `partial` solo por flakiness de la suite completa (timeouts de 5s bajo carga en archivos ajenos, ya visto en #418); el test de `/about` pasa y typecheck/lint limpios.
- Nota: esta rama predata #418, así que `AppShell` no tiene `fullBleed`/`footer`; las bandas a sangre se aproximan con `-mx-8 border-y` contra el contenedor del shell. A reconciliar al mergear #468.

### WU3 — Guías (`/entrepreneur-guide`, `/investor-guide`) · commit `b0c29f8`

- Código: `app/{entrepreneur-guide,investor-guide}/page.tsx` (rutas públicas fuera de `(app)`) + `presentation/components/guides/*` (renderer compartido: `guide-page`, `guide-hero`, `guide-toc` isla client con TOC sticky + progreso, `guide-section`, `worked-example`, `guide-final-cta`, `guide-icons`).
- Tests: `page.test.tsx` (7 + 6).
- RED→GREEN: `./page` sin resolver → 13 pasando.
- **Corrección (una):** el verificador flageó (a) el ícono decorativo del eyebrow del hero (el template lo diseña) y (b) el nombre accesible del progreso. Se agregó `eyebrowIcon` al `Guide` + render; y — con autorización del owner de ampliar la superficie a `progress-bar.tsx` — se agregó `ariaLabel?` opcional al `ProgressBar` compartido (retrocompatible; los 5 callers existentes no cambian) para que el nombre accesible sea «Progreso de lectura» dejando la fila visible «Tu lectura». Hallazgo: react-aria concatena `aria-label` con cualquier `<Label>` montado (`aria-labelledby` auto-referente), así que la fila visible pasa a `<span>` solo en la rama con `ariaLabel`. Re-verificado: **PASS**.
- Nota: el TOC sticky/progreso es una isla client acotada (~90 líneas) con guarda `NaN` (la fórmula del template sin guarda rompe en jsdom).
