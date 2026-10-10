# Bitácora — Feature #418: landing pública

Rama: `Vaqcrow#418_Feat_Build_the_public_landing_page` (creada desde `main` `afede2c`, sin commits al abrir esta bitácora). Sub-issues: #419 (implementar) · #420 (probar) · #421 (evidencia). Feature bajo la Epic #373 (sitio público).

## Objetivo

Entregar la landing pública en `/` con: hero, campaña destacada, «PyMEs en campaña», las secciones explicativas («Cómo funciona», «Qué es real y qué es simulado») y el placeholder del asistente flotante «Ayuda», fiel al template.

## Problema y por qué

Hoy `apps/web/src/app/page.tsx` es solo `<AppShell><h1 className="sr-only">Vaqcrow</h1></AppShell>`. La landing es la primera pantalla que ve tanto el inversor como la PyME: es una página de marketing. El template `docs/design/template/Vaqcrow Landing.dc.html` (fuente de verdad visual, git-ignored) la define completa. La consigna del owner: desarrollar la sección tal cual el template, sin simplificar; los links a páginas que todavía no existen se incluyen igual (404 aceptado) como recordatorio de las guías pendientes.

## Alcance

- **En alcance:** todo lo de `/` — secciones del template, footer rico de la landing, asistente flotante «Ayuda», variante full-bleed del `AppShell`, ancla española del header, y el consumo del listado público `GET /marketplace/campaigns` para la destacada y la grilla.
- **Fuera de alcance:** el centro de ayuda y las guías (Feature #394), rutas nuevas, y el bloque «Recorré la demo completa» (retirado, decisión D1 de #438). Sin migraciones (todo es frontend).

## Decisiones cerradas (owner, 2026-10-10)

Memoria Engram: `decision/418-featured-campaign`, `decision/418-help-assistant`, `decision/418-minor-decisions`.

- **Q1 — Destacada.** Se deriva del listado público: la campaña con **mayor `fundedPercentBps`** (preferir una con `imageUrl` no nulo), desempate por **`closeDate` más próximo**. **Si no hay campaña**, se muestra una **card de ejemplo simulada** — el «Panadería Horizonte SRL» del template, completo, marcado `SIMULADO` — para que la PyME vea cómo se verá su producto y el inversor qué datos tendrá. Cuando aparece una campaña real, **reemplaza** al ejemplo. La card **real** muestra solo campos del contrato público (sin «desde» ni KYC → fila de 2 columnas); la **simulada** reproduce el template completo (3 columnas con KYC).
- **Q2 — Asistente flotante.** Va en #418 tal cual el template; sus links (3 rápidos + «Ir al centro de ayuda») apuntan al centro de ayuda (#394) aunque den 404.
- **Q3 — Menores.** Anclas internas en español (`#como-funciona`, `#limites`); **footer rico** del template (no el `SiteFooter` compacto); **sin** chip «Imagen representativa» sobre fotos reales; CTA «Ver evidencia y riesgo» → `/campaigns/:id`; hero «Quiero financiar mi negocio» por rol (anónimo → `/signup`, PYME → `/company`, INVERSOR → **oculto**); destacada **excluida** de «PyMEs en campaña»; 3 tarjetas por **cierre más próximo**; vacío/error **reutilizan el copy de `/explore`**; el callout simulado usa el texto canónico `disclosures.simulation`; `AppShell` gana variante **full-bleed**; los badges del hero (DEMO / TESTNET / DATOS SIMULADOS) se mantienen.

## Restricciones

- Fidelidad al template. Los links a rutas no construidas se muestran **a propósito** (404 aceptado).
- Copy de UI en español, inline (patrón del repo); rutas en inglés; anclas internas en español.
- El texto de disclosure se renderiza **solo** por `CanonicalDisclosure`; `microcopy.testnetBadge` no es un `DisclosureId`.
- Política test-first de ODD (Strict TDD no activo — no hay cache `strict-tdd` ni dirs SDD). Runner web: `pnpm --filter @vaqcrow/web test`.
- Un writer por WU; verificación independiente al cierre de cada WU; RDD desactivado.

## Superficie mapeada (evidencia)

- **Shell:** `apps/web/src/presentation/components/app-shell.tsx` (`main` con `max-w-[1264px] px-8` en :17), `app-header.tsx`, `demo-navbar.tsx`, `apps/web/src/application/navigation/shell-nav.ts:56` (`/#how-it-works`).
- **Datos públicos:** `apps/web/src/application/ports/marketplace-port.ts` (`MarketplaceCard`, `MarketplacePort.list()`), `apps/web/src/infrastructure/marketplace/http-marketplace-gateway.ts:49`, `apps/web/src/state/use-marketplace.ts:43` (SWR, `["marketplace-campaigns"]`), `/explore` es client page.
- **Reuso:** `campaign-card.tsx:99`, `progress-bar.tsx:40`, `badge.tsx`, `empty-state.tsx`, `error-state.tsx`, `canonical-disclosure.tsx:15`, `apps/web/src/application/trust/disclosures.ts` (`simulation`, `no-production`, `microcopy.testnetBadge`), `apps/web/src/application/marketplace/view-model.ts:59`, `explore-marketplace.tsx` (copy de vacío/error).
- **Tests que rompen / tocar:** `apps/web/src/app/page.test.tsx` (h1 sr-only), `shell-nav.test.ts` y `app-header.test.tsx` (assertan `/#how-it-works`).

## Tareas (checklist)

- [x] **WU1 — Shell full-bleed + ancla + secciones estáticas.** Variante full-bleed de `AppShell`; ancla `/#como-funciona` en `shell-nav.ts` (+ sus tests); reescribir `page.tsx` con hero (badges, h1, copy, CTAs por rol, «Leer los límites»), franja de garantías, «Cómo funciona» (4 pasos, ancla `#como-funciona`) y «Qué es real y qué es simulado» (ancla `#limites`, disclosure canónico). Reescribir `page.test.tsx`. — **Commit `d60d3ef`.** Verificado (tier high, verificador independiente PASS).
- [ ] **WU2 — Datos públicos + destacada + grilla.** Selección derivada de la destacada (mayor `fundedPercentBps`, preferir foto, desempate cierre); card de ejemplo simulada; «PyMEs en campaña» (destacada excluida, 3 por cierre, vacío/error con copy de `/explore`); estados de carga/error sanitizados.
- [ ] **WU3 — Footer rico de la landing.** Footer del template de la landing (columnas Plataforma / Aprender / Proyecto + disclosure canónico + fila legal), links reales donde existan y 404-aceptado para el resto; sin tocar el footer de las demás páginas.
- [ ] **WU4 — Asistente flotante «Ayuda».** Botón flotante + panel del template (saludo, 3 links rápidos, input deshabilitado, «Ir al centro de ayuda»); accesible (dialog, `aria-expanded`, cierre con Escape); links al centro de ayuda (#394).
- [ ] **WU5 — Evidencia + cierre.** `docs/planning/public-landing-page-evidence.md` (español, criterios citados) + alineación de docs (`demo-tasks-list.md`, `README.md`, `DEMO.md`, `CLAUDE.md`/`AGENTS.md` si aplica) y cierre de esta bitácora.

## Estrategia de entrega

Forecast grueso de líneas propias: ~900 (WU1 ~320, WU2 ~260, WU3 ~130, WU4 ~120, WU5 doc ~150). Supera el heurístico de ~400 → por convención del repo (un PR por Feature) se usa **una sola rama/PR** (`feature-branch-chain`) rebanada por commits de WU; si el owner prefiere PRs encadenados, se corta por WU.

## Verificación

Por WU: `pnpm --filter @vaqcrow/web test` (+ `pnpm --filter @vaqcrow/web typecheck` y lint del workspace). Al cierre de la Feature: `pnpm run verify` completo (lint + typecheck + test + build + boundaries + test:boundaries). El listado público se consume con dobles locales: las pruebas determinísticas nunca dependen de Testnet, Supabase ni el proveedor LLM.

## Iteración

### WU1 — Shell full-bleed + ancla + secciones estáticas · commit `d60d3ef`

- Código: `app-shell.tsx` variante `fullBleed` (default byte-idéntico); `shell-nav.ts` ancla `/#como-funciona`; `page.tsx` reescrita; nuevos `presentation/components/landing/{landing-hero,hero-account-cta,trust-strip,how-it-works,real-vs-simulated}.tsx`.
- Tests: `page.test.tsx` reescrito (8 tests); assertions de ancla actualizadas en `shell-nav.test.ts` y `app-header.test.tsx`.
- RED→GREEN: 3 archivos fallando (10 tests) → 31 pasando. Suite web completa: 194 archivos / 1971 tests.
- Verificación independiente (tier `high`): **PASS**. Avisos no bloqueantes: (a) `docs/design/demo-ui.md:174` y `account-creation-sign-in-and-role-aware-shell-evidence.md:136` siguen citando `/#how-it-works` → alinear en WU5; (b) padding inferior del hero 80 px vs 96 px del template (cosmético); (c) `pnpm run build`/RSC no corrido en el WU (se cubre en `pnpm run verify` al cierre).
